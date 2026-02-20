# Beacon Search - Complete Documentation Index

**One-stop reference for all Beacon Search documentation**

---

## 📖 Core Documentation

### [README.md](./README.md)
**Project overview, quick start, and features**
- What is Beacon Search
- Key features
- Quick start (5-minute setup)
- Technology stack
- Project status

### [PLAYBOOK.md](./PLAYBOOK.md)
**Complete project playbook (roadmap, architecture, decisions)**
- What we're building
- Architecture diagrams
- Implementation phases
- Technical decisions with rationale
- Pivot log (chronological changes)
- Testing checklist
- Success metrics
- Related projects

---

## 🚀 Getting Started

### [QUICK-START.md](./QUICK-START.md)
**Get Beacon Search running in 5 minutes**
- Prerequisites
- Docker Compose setup
- Environment configuration
- Access endpoints (UI + API)

### [DEPLOYMENT.md](./DEPLOYMENT.md)
**Production deployment guide**
- Server setup (VPS/cloud)
- Docker Compose configuration
- SSL/TLS setup (Caddy)
- Environment variables
- Health monitoring
- Backup procedures

---

## 🔌 API & Integration

### [API-REFERENCE.md](./API-REFERENCE.md) ⭐
**Complete API documentation**
- All endpoints documented
- Request/response formats
- Examples for every endpoint
- Error handling
- Rate limiting
- Best practices
- Performance tips

### [docs/FRPEI.md](./docs/FRPEI.md) ⭐
**Federated Retrieval + Enrichment Index (FRPEI)**
- SearXNG + Beacon + Media federation
- Canonicalization + enrichment pipeline
- Ranking + explainability
- Guardrails + metrics

### [docs/PODCAST-MVP.md](./docs/PODCAST-MVP.md) ⭐
**Podcast content intelligence MVP**
- RSS + transcript ingestion
- Local transcription pipeline
- Chunking + semantic indexing
- Auto-tagging + entity enrichment
- Recommendation preview endpoint
- Rollout checklist + samples

### [docs/MOVIE-MEDIA-CATALOG.md](./docs/MOVIE-MEDIA-CATALOG.md) ⭐
**Movie + mixed-media catalog MVP**
- TMDB/OMDb metadata ingestion
- Collections/genres/cast/crew/providers
- Subtitle provenance + transcript indexing
- Mixed-media discovery endpoints
- Licensing constraints + rollout checklist

### [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) ⭐
**Integrate Beacon Search into your application**
- Integration options (Direct API, SDK, Widget)
- Product-specific guides:
  - NostrCast integration
  - NostrMaxi integration
  - Fragstr integration
- Cross-product search
- Deployment architectures
- Best practices
- Troubleshooting
- Complete code examples

---

## 🛠️ Development

### [STATUS.md](./STATUS.md)
**Current project status and sprint tracking**
- MVP completion status
- Feature checklist
- Known issues
- Roadmap

### [CURRENT-STATUS.md](./CURRENT-STATUS.md)
**Real-time status report (2026-02-13)**
- What's working now
- What was added today
- What needs integration
- Next steps

---

## 🧪 Testing

### [TEST-PLAN.md](./TEST-PLAN.md)
**Comprehensive test plan (12 test cases)**
- Test environment setup
- Detailed test cases
- Performance benchmarks
- Troubleshooting guide
- Test log template

### [test-nostr-e2e.sh](./test-nostr-e2e.sh)
**Automated end-to-end test script**
- Nostr connector testing
- Search validation
- WoT integration test
- Automated execution

---

## 🌐 Nostr Integration

### [NOSTR_INTEGRATION.md](./NOSTR_INTEGRATION.md)
**Nostr-specific documentation**
- Nostr connector overview
- Event indexing (kinds 0, 1, 30023, etc.)
- Relay configuration
- NIP support

### [NOSTR_EXAMPLES.md](./NOSTR_EXAMPLES.md)
**Nostr integration examples**
- Code samples
- Use cases
- Best practices

### [NOSTR_QUICKSTART.md](./NOSTR_QUICKSTART.md)
**Get Nostr indexing running quickly**
- 5-minute setup
- Relay configuration
- Event types
- Testing

---

## 🔧 Advanced Features

### [FEATURE-PARITY.md](./FEATURE-PARITY.md)
**Feature comparison and completion status**
- Core features
- Advanced features
- Enterprise features
- Parity with competitors

### [FIXES-APPLIED.md](./FIXES-APPLIED.md)
**History of bug fixes and improvements**
- Issues resolved
- Patches applied
- Breaking changes

---

## 🏗️ Architecture

### [ARCHITECTURE.md](./ARCHITECTURE.md) (if exists)
**System architecture documentation**
- Component diagrams
- Data flow
- Technology stack
- Scalability considerations

---

## 🔌 Plugins

### [backend/src/plugins/README.md](./backend/src/plugins/README.md)
**Plugin system documentation**
- Plugin architecture
- Creating custom plugins
- Hook points
- Examples

### [backend/src/plugins/wot/README.md](./backend/src/plugins/wot/README.md)
**Web of Trust plugin documentation**
- Multi-provider architecture
- Configuration
- NostrMaxi integration
- Local fallback provider

---

## 📦 Configuration

### [.env.example](./.env.example)
**Environment variable reference**
- Database configuration
- OpenAI API keys
- Processing options (OCR, translation)
- Frontend settings

### [docker-compose.yml](./docker-compose.yml)
**Docker Compose configuration**
- Service definitions
- Port mappings
- Volume mounts
- Health checks

### [docker-compose.prod.yml](./docker-compose.prod.yml)
**Production Docker Compose configuration**
- Production-specific settings
- SSL/TLS configuration
- Resource limits
- Logging

---

## 📋 Checklists & Summaries

### [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) (if exists)
**Pre-launch checklist**
- Security hardening
- Performance optimization
- Monitoring setup
- Backup verification

### [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)
**Deployment summary and status**
- Deployment history
- Configuration notes
- Known issues

### [DOCS-SUMMARY.md](./DOCS-SUMMARY.md)
**Documentation overview**
- Available documentation
- Coverage status

---

## 🎯 Task Management

### [TASK-COMPLETION-REPORT.md](./TASK-COMPLETION-REPORT.md)
**Completed tasks and deliverables**
- Sprint completion report
- Deliverables summary

### [REVIEW-SUMMARY.md](./REVIEW-SUMMARY.md)
**Code review and QA summary**
- Review findings
- Recommendations

---

## 📚 Quick Reference

### For Users
1. Start here: [README.md](./README.md)
2. Get running: [QUICK-START.md](./QUICK-START.md)
3. Learn the API: [API-REFERENCE.md](./API-REFERENCE.md)

### For Developers Integrating Beacon Search
1. Read: [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md)
2. Reference: [API-REFERENCE.md](./API-REFERENCE.md)
3. Examples: [NOSTR_EXAMPLES.md](./NOSTR_EXAMPLES.md)

### For DevOps / Deployment
1. Deploy: [DEPLOYMENT.md](./DEPLOYMENT.md)
2. Configure: [.env.example](./.env.example)
3. Test: [TEST-PLAN.md](./TEST-PLAN.md)

### For Project Management
1. Overview: [PLAYBOOK.md](./PLAYBOOK.md)
2. Status: [STATUS.md](./STATUS.md)
3. Features: [FEATURE-PARITY.md](./FEATURE-PARITY.md)

---

## 🔍 Find What You Need

| I want to... | Read this... |
|--------------|--------------|
| Understand what Beacon Search is | [README.md](./README.md) |
| Get it running locally | [QUICK-START.md](./QUICK-START.md) |
| Deploy to production | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Use the API | [API-REFERENCE.md](./API-REFERENCE.md) |
| Integrate into my app | [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) |
| Index Nostr events | [NOSTR_INTEGRATION.md](./NOSTR_INTEGRATION.md) |
| Run tests | [TEST-PLAN.md](./TEST-PLAN.md) |
| Create a plugin | [backend/src/plugins/README.md](./backend/src/plugins/README.md) |
| Configure WoT | [backend/src/plugins/wot/README.md](./backend/src/plugins/wot/README.md) |
| See project status | [STATUS.md](./STATUS.md) |
| Understand architecture | [PLAYBOOK.md](./PLAYBOOK.md) |
| Troubleshoot issues | [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) → Troubleshooting |

---

## 📝 Documentation Standards

All Beacon Search documentation follows these standards:

### Structure
- **Overview** - What is this?
- **Quick Start** - Get started fast
- **Detailed Guide** - Comprehensive coverage
- **Examples** - Code samples
- **Troubleshooting** - Common issues
- **Reference** - Technical details

### Code Examples
- All examples are **copy-paste ready**
- Real URLs and realistic data
- Comments explain non-obvious code
- Error handling included

### Maintenance
- **Last Updated** dates on all docs
- **Status** badges (✅ Complete, 🚧 In Progress, 📋 Planned)
- **Changelog** for major documentation updates

---

## 🤝 Contributing to Documentation

Found an issue or want to improve docs?

1. **Small fixes:** Edit directly via GitHub
2. **New sections:** Create a new .md file and add to this index
3. **Major changes:** Discuss in GitHub Issues first

**Documentation Files Should:**
- Include date and version
- Have clear headings
- Provide examples
- Be kept up-to-date with code

---

## 📅 Documentation Changelog

### 2026-02-13
- ✅ Created `API-REFERENCE.md` (complete API docs)
- ✅ Created `INTEGRATION-GUIDE.md` (integration examples)
- ✅ Created `DOCUMENTATION-INDEX.md` (this file)
- ✅ Updated `PLAYBOOK.md` (deployment validation)
- ✅ Created `TEST-PLAN.md` (comprehensive testing)
- ✅ Created `test-nostr-e2e.sh` (automated testing)
- ✅ Created `CURRENT-STATUS.md` (real-time status)

### 2026-02-11
- ✅ Initial documentation structure
- ✅ Created README.md, DEPLOYMENT.md, QUICK-START.md
- ✅ Created Nostr integration docs

---

## 🌐 External Resources

- **GitHub Repository:** https://github.com/strangesignal/beacon-search (if public)
- **Issue Tracker:** GitHub Issues
- **Discord:** https://discord.com/invite/clawd (OpenClaw community)

---

**Last Updated:** 2026-02-13  
**Documentation Status:** ✅ Complete and Production-Ready
