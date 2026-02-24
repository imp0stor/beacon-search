# Beacon Search Deployment Guide

Production deployment guide for Beacon Search - a semantic search engine with RAG capabilities.

## Prerequisites

- Docker & Docker Compose v2+
- 4GB+ RAM (embedding model needs ~2GB)
- PostgreSQL with pgvector extension (included in Docker setup)
- OpenAI API key (for RAG query answering)
- Domain name + SSL certificates (for production)

## Quick Start (Development)

```bash
# Clone and enter directory
cd beacon-search

# Copy environment template
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# Start all services
docker compose up -d

# Check logs
docker compose logs -f

# Access:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:3001
# - Health check: http://localhost:3001/health
```

## Production Deployment

### 1. Server Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose v2
sudo apt install docker-compose-plugin

# Create app directory
sudo mkdir -p /opt/beacon-search
cd /opt/beacon-search
```

### 2. Environment Configuration

```bash
# Copy project files
git clone <your-repo> .

# Create production environment file
cp .env.example .env
```

Edit `.env` with production values:

```bash
# Strong database password
POSTGRES_PASSWORD=<generate-strong-password>
DATABASE_URL=postgresql://beacon:<password>@db:5432/beacon_search

# Your OpenAI key
OPENAI_API_KEY=sk-...

# Production API URL (your domain)
REACT_APP_API_URL=https://api.yourdomain.com
```

### 3. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  db:
    image: pgvector/pgvector:pg16
    container_name: beacon-db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-beacon}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-beacon_search}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U beacon -d beacon_search"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - beacon-net

  backend:
    build: ./backend
    container_name: beacon-backend
    restart: always
    environment:
      DATABASE_URL: ${DATABASE_URL}
      PORT: 3001
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_MODEL: ${OPENAI_MODEL:-gpt-4o-mini}
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - beacon-net

  frontend:
    build:
      context: ./frontend
      args:
        REACT_APP_API_URL: ${REACT_APP_API_URL:-http://localhost:3001}
    container_name: beacon-frontend
    restart: always
    depends_on:
      - backend
    networks:
      - beacon-net

  nginx:
    image: nginx:alpine
    container_name: beacon-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - frontend
      - backend
    networks:
      - beacon-net

volumes:
  pgdata:

networks:
  beacon-net:
    driver: bridge
```

### 4. Nginx Configuration

Create `nginx/conf.d/beacon.conf`:

```nginx
upstream backend {
    server beacon-backend:3001;
}

upstream frontend {
    server beacon-frontend:80;
}

server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    
    # Redirect to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
    
    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # Backend API
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 5. SSL Setup with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot

# Get certificates (stop nginx first)
docker compose -f docker-compose.prod.yml stop nginx

sudo certbot certonly --standalone \
    -d yourdomain.com \
    -d api.yourdomain.com

# Copy certificates
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
sudo chmod 644 nginx/ssl/*.pem

# Restart nginx
docker compose -f docker-compose.prod.yml up -d nginx
```

Auto-renewal cron:
```bash
# Add to crontab
0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/*.pem /opt/beacon-search/nginx/ssl/ && docker restart beacon-nginx
```

### 6. Database Migrations

For existing databases, run migrations:

```bash
# Connect to running database
docker exec -it beacon-db psql -U beacon -d beacon_search

# Run migration manually
\i /path/to/migrations/002_webhooks_and_source_portal.sql
```

Or mount migrations in docker-compose:
```yaml
volumes:
  - ./migrations:/docker-entrypoint-initdb.d/migrations:ro
```

### 7. Start Production

```bash
# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# Check status
docker compose -f docker-compose.prod.yml ps

# Check health
curl https://api.yourdomain.com/health
```

## Monitoring

### Health Checks

The `/health` endpoint returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": { "status": "ok", "latency": 5 },
    "embedding": { "status": "ok" }
  }
}
```

Status codes:
- `200` - All systems operational
- `503` - One or more systems degraded

### Logging

```bash
# All logs
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Prometheus Metrics (Optional)

Add to backend for metrics:
```typescript
// TODO: Add prometheus metrics endpoint
app.get('/metrics', (req, res) => {
  // Export metrics
});
```

## Backup & Recovery

### Database Backup

```bash
# Backup
docker exec beacon-db pg_dump -U beacon beacon_search > backup_$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker exec -i beacon-db psql -U beacon -d beacon_search
```

### Automated Backups

```bash
# Crontab entry for daily backups
0 2 * * * docker exec beacon-db pg_dump -U beacon beacon_search | gzip > /backups/beacon_$(date +\%Y\%m\%d).sql.gz
```

## Scaling

### Horizontal Scaling

For high load, scale the backend:

```yaml
services:
  backend:
    deploy:
      replicas: 3
```

Add load balancer upstream in nginx:
```nginx
upstream backend {
    least_conn;
    server beacon-backend-1:3001;
    server beacon-backend-2:3001;
    server beacon-backend-3:3001;
}
```

### Database Scaling

For large document collections (>1M documents):
- Increase `lists` parameter in IVFFlat index
- Consider pgvector HNSW index for better performance
- Add read replicas for search queries

## Troubleshooting

### Embedding Model Not Loading

```bash
# Check memory
docker stats beacon-backend

# Increase memory limit
deploy:
  resources:
    limits:
      memory: 4G
```

### Database Connection Issues

```bash
# Check database is healthy
docker exec beacon-db pg_isready -U beacon

# Check logs
docker logs beacon-db
```

### Frontend Can't Reach API

- Verify `REACT_APP_API_URL` is set correctly at build time
- Check CORS settings in backend
- Verify nginx proxy configuration

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `PORT` | No | 3001 | Backend API port |
| `OPENAI_API_KEY` | No* | - | OpenAI API key for RAG |
| `OPENAI_MODEL` | No | gpt-4o-mini | OpenAI model |
| `ENABLE_OCR` | No | true | Enable OCR processing |
| `ENABLE_TRANSLATION` | No | false | Enable translation |
| `ENABLE_AI_DESCRIPTION` | No | false | Enable AI descriptions |
| `REACT_APP_API_URL` | Yes | - | API URL for frontend |

*Required for `/api/ask` endpoint (RAG queries)
