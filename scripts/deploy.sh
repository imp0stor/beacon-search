#!/usr/bin/env bash

# =============================================================================
# Beacon Search - Production Deployment Script
# =============================================================================
#
# This script handles:
#   - Environment validation
#   - Service deployment with Docker Compose
#   - Health checks for all services
#   - Database initialization
#   - Embedding model warm-up
#   - Rollback on failure
#
# Usage:
#   ./scripts/deploy.sh [options]
#
# Options:
#   --build       Force rebuild of images
#   --pull        Pull latest images before deploy
#   --migrate     Run database migrations
#   --backup      Create backup before deploy
#   --rollback    Rollback to previous deployment
#   --profile     Enable profiles (typesense, backup)
#   --help        Show this help message
#
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_DIR="${PROJECT_DIR}/backups"
LOG_FILE="${PROJECT_DIR}/logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# Health check settings
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10
BACKEND_STARTUP_TIMEOUT=180  # Backend needs time for embedding model

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)  echo -e "${BLUE}[INFO]${NC} ${message}" ;;
        OK)    echo -e "${GREEN}[OK]${NC} ${message}" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} ${message}" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} ${message}" ;;
    esac
    
    # Also log to file
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

die() {
    log ERROR "$*"
    exit 1
}

check_command() {
    command -v "$1" &> /dev/null || die "Required command not found: $1"
}

# -----------------------------------------------------------------------------
# Pre-flight Checks
# -----------------------------------------------------------------------------

preflight_checks() {
    log INFO "Running pre-flight checks..."
    
    # Check required commands
    check_command docker
    check_command docker-compose
    check_command curl
    
    # Check Docker is running
    docker info &> /dev/null || die "Docker is not running"
    
    # Check compose file exists
    [[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
    
    # Check env file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        log WARN "Environment file not found: $ENV_FILE"
        log INFO "Creating from .env.example..."
        if [[ -f "${PROJECT_DIR}/.env.example" ]]; then
            cp "${PROJECT_DIR}/.env.example" "$ENV_FILE"
            log WARN "Please edit $ENV_FILE with your settings before deploying"
            exit 1
        else
            die "No .env.example file found"
        fi
    fi
    
    # Validate required environment variables
    source "$ENV_FILE"
    
    [[ -n "${POSTGRES_PASSWORD:-}" ]] || die "POSTGRES_PASSWORD is required in .env"
    
    if [[ -z "${OPENAI_API_KEY:-}" ]]; then
        log WARN "OPENAI_API_KEY not set - RAG features will be disabled"
    fi
    
    log OK "Pre-flight checks passed"
}

validate_schema_predeploy() {
    log INFO "Running schema validation check..."

    "${PROJECT_DIR}/scripts/validate-schema.sh" || {
        log ERROR "Schema validation failed! Aborting deploy."
        return 1
    }

    log OK "Schema validation passed"
    return 0
}

# -----------------------------------------------------------------------------
# Health Checks
# -----------------------------------------------------------------------------

wait_for_service() {
    local service=$1
    local url=$2
    local timeout=${3:-$HEALTH_CHECK_RETRIES}
    local interval=${4:-$HEALTH_CHECK_INTERVAL}
    
    log INFO "Waiting for $service to be healthy..."
    
    local attempt=1
    while [[ $attempt -le $timeout ]]; do
        if curl -sf "$url" &> /dev/null; then
            log OK "$service is healthy"
            return 0
        fi
        
        log INFO "Attempt $attempt/$timeout - $service not ready, waiting ${interval}s..."
        sleep $interval
        ((attempt++))
    done
    
    log ERROR "$service failed to become healthy after $timeout attempts"
    return 1
}

check_database() {
    log INFO "Checking database connection..."
    
    docker exec beacon-db pg_isready -U "${POSTGRES_USER:-beacon}" -d "${POSTGRES_DB:-beacon_search}" &> /dev/null || {
        log ERROR "Database is not ready"
        return 1
    }
    
    # Check if schema is initialized
    local table_count=$(docker exec beacon-db psql -U "${POSTGRES_USER:-beacon}" -d "${POSTGRES_DB:-beacon_search}" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
    
    if [[ "$table_count" -lt 5 ]]; then
        log WARN "Database schema appears incomplete (found $table_count tables)"
        return 1
    fi
    
    log OK "Database is healthy with $table_count tables"
    return 0
}

check_redis() {
    log INFO "Checking Redis connection..."
    
    docker exec beacon-redis redis-cli ping | grep -q "PONG" || {
        log ERROR "Redis is not responding"
        return 1
    }
    
    log OK "Redis is healthy"
    return 0
}

check_backend() {
    log INFO "Checking backend API..."
    
    # Backend takes longer due to embedding model loading
    wait_for_service "Backend API" "http://localhost:3001/health" $((BACKEND_STARTUP_TIMEOUT / HEALTH_CHECK_INTERVAL)) $HEALTH_CHECK_INTERVAL || return 1
    
    # Verify embedding model is loaded
    local health_response=$(curl -sf "http://localhost:3001/health" 2>/dev/null)
    
    if echo "$health_response" | grep -q '"embedding".*"status":"ok"'; then
        log OK "Embedding model is loaded"
    else
        log WARN "Embedding model may not be fully loaded yet"
    fi
    
    return 0
}

check_frontend() {
    log INFO "Checking frontend..."
    
    wait_for_service "Frontend" "http://localhost:80" || return 1
    
    return 0
}

run_all_health_checks() {
    log INFO "Running comprehensive health checks..."
    
    local failed=0
    
    check_database || ((failed++))
    check_redis || ((failed++))
    check_backend || ((failed++))
    check_frontend || ((failed++))
    
    if [[ $failed -gt 0 ]]; then
        log ERROR "$failed health check(s) failed"
        return 1
    fi
    
    log OK "All health checks passed"
    return 0
}

# -----------------------------------------------------------------------------
# Deployment Functions
# -----------------------------------------------------------------------------

create_backup() {
    log INFO "Creating database backup..."
    
    mkdir -p "$BACKUP_DIR"
    local backup_file="${BACKUP_DIR}/beacon_search_$(date +%Y%m%d_%H%M%S).sql"
    
    docker exec beacon-db pg_dump -U "${POSTGRES_USER:-beacon}" "${POSTGRES_DB:-beacon_search}" > "$backup_file" || {
        log ERROR "Backup failed"
        return 1
    }
    
    # Compress the backup
    gzip "$backup_file"
    
    log OK "Backup created: ${backup_file}.gz"
    return 0
}

pull_images() {
    log INFO "Pulling latest images..."
    
    docker-compose -f "$COMPOSE_FILE" pull || {
        log ERROR "Failed to pull images"
        return 1
    }
    
    log OK "Images pulled successfully"
    return 0
}

build_images() {
    log INFO "Building images..."
    
    docker-compose -f "$COMPOSE_FILE" build --no-cache || {
        log ERROR "Build failed"
        return 1
    }
    
    log OK "Images built successfully"
    return 0
}

deploy_services() {
    local profiles="${1:-}"
    
    log INFO "Deploying services..."
    
    local compose_cmd="docker-compose -f $COMPOSE_FILE"
    
    if [[ -n "$profiles" ]]; then
        for profile in $profiles; do
            compose_cmd="$compose_cmd --profile $profile"
        done
    fi
    
    $compose_cmd up -d || {
        log ERROR "Deployment failed"
        return 1
    }
    
    log OK "Services deployed"
    return 0
}

initialize_database() {
    log INFO "Checking database initialization..."
    
    # Wait for database to be ready
    sleep 5
    
    if check_database; then
        log OK "Database already initialized"
        return 0
    fi
    
    log INFO "Initializing database schema..."
    
    # Schema is auto-loaded from init.sql by PostgreSQL container
    # Wait for it to complete
    local attempt=1
    while [[ $attempt -le 10 ]]; do
        if check_database; then
            log OK "Database initialized successfully"
            return 0
        fi
        log INFO "Waiting for database initialization... ($attempt/10)"
        sleep 5
        ((attempt++))
    done
    
    log ERROR "Database initialization timed out"
    return 1
}

run_migrations() {
    log INFO "Running database migrations..."
    
    # Check for migration files
    if [[ ! -d "${PROJECT_DIR}/migrations" ]] || [[ -z "$(ls -A "${PROJECT_DIR}/migrations" 2>/dev/null)" ]]; then
        log INFO "No migrations to run"
        return 0
    fi
    
    # Run migrations
    for migration in "${PROJECT_DIR}"/migrations/*.sql; do
        if [[ -f "$migration" ]]; then
            log INFO "Applying migration: $(basename "$migration")"
            docker exec -i beacon-db psql -U "${POSTGRES_USER:-beacon}" -d "${POSTGRES_DB:-beacon_search}" < "$migration" || {
                log ERROR "Migration failed: $(basename "$migration")"
                return 1
            }
        fi
    done
    
    log OK "Migrations completed"
    return 0
}

warmup_embedding_model() {
    log INFO "Warming up embedding model..."
    
    # Wait for backend to be ready
    check_backend || return 1
    
    # Send a test query to trigger model loading
    local response=$(curl -sf -X GET "http://localhost:3001/api/search?q=test&limit=1" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        log OK "Embedding model warmed up"
        return 0
    fi
    
    log WARN "Embedding model warm-up may have failed"
    return 0  # Non-critical
}

generate_embeddings() {
    log INFO "Generating embeddings for existing documents..."
    
    local response=$(curl -sf -X POST "http://localhost:3001/api/generate-embeddings" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        log OK "Embedding generation triggered: $response"
        return 0
    fi
    
    log WARN "Embedding generation may have failed"
    return 0  # Non-critical
}

# -----------------------------------------------------------------------------
# Rollback
# -----------------------------------------------------------------------------

rollback() {
    log WARN "Rolling back deployment..."
    
    # Stop services
    docker-compose -f "$COMPOSE_FILE" down || true
    
    # Find most recent backup
    local latest_backup=$(ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -1)
    
    if [[ -n "$latest_backup" ]]; then
        log INFO "Found backup: $latest_backup"
        log INFO "To restore, run:"
        log INFO "  gunzip -c $latest_backup | docker exec -i beacon-db psql -U beacon -d beacon_search"
    else
        log WARN "No backup found for restore"
    fi
    
    # Restart with previous images
    docker-compose -f "$COMPOSE_FILE" up -d || die "Rollback failed"
    
    log OK "Rollback completed"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

show_help() {
    cat << EOF
Beacon Search - Production Deployment Script

Usage: $0 [options]

Options:
    --build       Force rebuild of images
    --pull        Pull latest images before deploy
    --migrate     Run database migrations
    --backup      Create backup before deploy
    --rollback    Rollback to previous deployment
    --profile     Enable profiles (comma-separated: typesense,backup)
    --help        Show this help message

Examples:
    # Basic deployment
    $0

    # Deployment with rebuild and migrations
    $0 --build --migrate

    # Deployment with Typesense enabled
    $0 --profile typesense

    # Create backup and deploy
    $0 --backup --build

    # Rollback to previous deployment
    $0 --rollback

EOF
}

main() {
    local do_build=false
    local do_pull=false
    local do_migrate=false
    local do_backup=false
    local do_rollback=false
    local profiles=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --build)
                do_build=true
                shift
                ;;
            --pull)
                do_pull=true
                shift
                ;;
            --migrate)
                do_migrate=true
                shift
                ;;
            --backup)
                do_backup=true
                shift
                ;;
            --rollback)
                do_rollback=true
                shift
                ;;
            --profile)
                profiles="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log ERROR "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log INFO "=========================================="
    log INFO "Beacon Search Production Deployment"
    log INFO "=========================================="
    log INFO "Started at: $(date)"
    log INFO "Project dir: $PROJECT_DIR"
    
    # Rollback mode
    if [[ "$do_rollback" == true ]]; then
        rollback
        exit 0
    fi
    
    # Pre-flight checks
    preflight_checks
    
    # Create backup if requested
    if [[ "$do_backup" == true ]]; then
        # Only if database is running
        if docker ps | grep -q beacon-db; then
            create_backup || log WARN "Backup failed, continuing..."
        else
            log INFO "No existing database to backup"
        fi
    fi
    
    # Pull images if requested
    if [[ "$do_pull" == true ]]; then
        pull_images
    fi
    
    # Build images if requested
    if [[ "$do_build" == true ]]; then
        build_images
    fi

    # Validate schema before bringing services up
    validate_schema_predeploy
    
    # Deploy services
    deploy_services "$profiles"
    
    # Wait for services to start
    log INFO "Waiting for services to start..."
    sleep 10
    
    # Initialize database
    initialize_database
    
    # Run migrations if requested
    if [[ "$do_migrate" == true ]]; then
        run_migrations
    fi
    
    # Run health checks
    run_all_health_checks || {
        log ERROR "Health checks failed - consider rolling back"
        log INFO "Run '$0 --rollback' to rollback"
        exit 1
    }
    
    # Warm up embedding model
    warmup_embedding_model
    
    # Generate embeddings for any documents without them
    generate_embeddings
    
    log INFO "=========================================="
    log OK "Deployment completed successfully!"
    log INFO "=========================================="
    log INFO ""
    log INFO "Services:"
    log INFO "  - Frontend: http://localhost (or https://${DOMAIN:-localhost})"
    log INFO "  - API: http://localhost:3001/api"
    log INFO "  - Health: http://localhost:3001/health"
    log INFO ""
    log INFO "Useful commands:"
    log INFO "  - View logs: docker-compose -f docker-compose.prod.yml logs -f"
    log INFO "  - Stop: docker-compose -f docker-compose.prod.yml down"
    log INFO "  - Stats: docker stats"
    log INFO ""
    log INFO "Log file: $LOG_FILE"
}

main "$@"
