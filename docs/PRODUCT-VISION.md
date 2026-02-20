# Product Vision: Beacon

## The Problem

Knowledge workers waste hours every week searching for information that exists somewhere in their organization. The tools meant to help have serious drawbacks:

### SaaS Lock-in Problem
- **Notion, Confluence, Algolia** — Your knowledge lives on their servers
- Price increases, feature removals, acquisitions — you have no leverage
- Export is painful, often lossy
- Compliance/security concerns for sensitive data

### AI Gap Problem
- Legacy enterprise search = keyword matching from 2010
- Modern AI (ChatGPT, etc.) = doesn't know your internal data
- RAG solutions exist but are complex to deploy

### Integration Problem
- Knowledge is scattered: databases, wikis, docs, ticketing systems
- Building unified search yourself = months of engineering
- Commercial solutions = expensive enterprise sales cycles

## The Solution

**Beacon** is a self-hosted enterprise knowledge platform with built-in AI.

### Core Value Proposition

> "Find anything in your organization, get AI-powered answers, own your data."

### Key Differentiators

1. **Self-hosted first** — Runs on your infrastructure
2. **AI-native** — Semantic search + RAG built-in
3. **Unified search** — Connect any database or API
4. **Modern stack** — Not Java from 2010
5. **Open source** — AGPL for self-hosted, commercial license available

## Target Users

### Primary: Tech-Forward Teams (50-500 people)

**Profile:**
- Engineering or product-led organizations
- Some DevOps capability (can run Docker)
- Frustrated with Confluence/Notion limitations
- Care about data ownership
- Budget-conscious but willing to pay for good tools

**Pain points:**
- "I know we documented this somewhere..."
- "Which Slack thread had that decision?"
- "The wiki search is useless"
- "I don't want to pay $10/user/month for search"

### Secondary: Regulated Industries

**Profile:**
- Healthcare, finance, legal, government
- Data residency requirements
- Can't use SaaS for sensitive content
- Need audit trails

**Pain points:**
- "We can't put this in the cloud"
- "We need to prove who accessed what"
- "Our compliance team vetoed Notion"

### Tertiary: Knowledge-Intensive Businesses

**Profile:**
- Consulting firms, law firms, research orgs
- Knowledge is their competitive advantage
- High-value information retrieval
- Would pay for time savings

**Pain points:**
- "Junior staff can't find prior art"
- "We keep solving the same problems"
- "Institutional knowledge leaves when people do"

## Market Positioning

### Competitive Landscape

```
                    Hosted                          Self-Hosted
                       │                                  │
                High   │  Algolia                        │  Meilisearch
            (Search)   │  Elastic Cloud                  │  Typesense
                       │  Coveo                          │  
                       │                                  │
                       │────────────────────────────────────────
                       │                                  │
                       │  Notion AI                       │  ← KNOVA MODERN
            Full       │  Confluence                      │  Outline
          (Knowledge)  │  Guru                            │  Wiki.js
                       │  Slite                           │  BookStack
                Low    │                                  │
```

### Direct Competitors

| Product | Strength | Weakness | Our Angle |
|---------|----------|----------|-----------|
| **Algolia** | Fast, great DX | Expensive, search only | Full platform, self-hosted |
| **Elastic** | Powerful | Complex, expensive | Simpler, AI-native |
| **Confluence** | Established | Slow, expensive, SaaS-only | Modern, self-hosted, AI |
| **Notion** | Beautiful UX | SaaS lock-in, weak search | Self-hosted, unified search |
| **Outline** | Self-hosted wiki | No unified search, no AI | Unified search + AI |
| **Meilisearch** | Fast, open source | Search only, no AI | Full platform |

### Our Niche

**"The self-hosted Notion/Algolia/ChatGPT hybrid for teams who care about ownership."**

We don't compete on:
- UI polish (Notion wins)
- Raw search performance (Algolia/Elastic win)
- Enterprise features (Confluence/Coveo win)

We win on:
- Self-hosted + AI combination
- Unified search across sources
- Developer-friendly, modern stack
- Ownership and privacy

## Feature Roadmap

### MVP (v0.1) — "It Works"

- [ ] PostgreSQL + pgvector search
- [ ] Basic connectors (PostgreSQL, MySQL, REST)
- [ ] Semantic search with embeddings
- [ ] Simple admin UI
- [ ] Docker deployment
- [ ] REST API

**Success criteria:** Can index a database and search it with semantic results.

### v1.0 — "Production Ready"

- [ ] RAG with citations
- [ ] Permission-aware search
- [ ] Multiple connectors
- [ ] Incremental sync
- [ ] Monitoring and alerts
- [ ] Documentation
- [ ] Helm chart

**Success criteria:** Can replace legacy search in production.

### v1.1 — "Intelligence"

- [ ] Auto-categorization
- [ ] Entity extraction
- [ ] Related content suggestions
- [ ] Search analytics
- [ ] Custom embeddings training

### v1.2 — "Collaboration"

- [ ] Saved searches
- [ ] Annotations
- [ ] Bookmarks
- [ ] Team workspaces
- [ ] Activity feeds

### v2.0 — "Platform"

- [ ] Managed hosting option
- [ ] Marketplace for connectors
- [ ] Plugin system
- [ ] SSO/SCIM
- [ ] Audit logs

## Revenue Model

### Tier 1: Community (Free)

- Self-hosted
- All features
- Community support (GitHub, Discord)
- No restrictions on usage

**Goal:** Adoption, community building, feedback.

### Tier 2: Managed ($29/seat/month)

- We host it
- Automatic updates
- Email support
- 99.9% SLA
- Daily backups

**Payments:** Stripe + Lightning (for Bitcoin-native customers).

**Goal:** Revenue, lower friction for non-technical teams.

### Tier 3: Enterprise (Custom pricing)

- Dedicated instance
- SSO/SCIM integration
- Custom connectors
- Dedicated support engineer
- SLA with teeth
- Training and onboarding

**Goal:** Large accounts, high-touch revenue.

### Revenue Projections

| Year | Community Users | Managed Seats | Enterprise Accounts | ARR |
|------|-----------------|---------------|---------------------|-----|
| 1 | 500 | 50 | 0 | $17k |
| 2 | 2,000 | 300 | 2 | $150k |
| 3 | 5,000 | 1,000 | 10 | $500k |

Assumptions:
- 1% community → managed conversion
- $29/seat for managed
- $30k/year average enterprise

## Go-to-Market Strategy

### Phase 1: Developer Adoption

**Channels:**
- Hacker News launch (self-hosted angle)
- Reddit (r/selfhosted, r/sysadmin)
- Product Hunt
- Dev Twitter/Mastodon/Nostr
- Blog posts on architecture

**Content:**
- "Why we built a self-hosted enterprise search"
- "PostgreSQL + pgvector vs. Elasticsearch"
- "RAG for your internal knowledge base"

### Phase 2: Community Building

- Discord server for support
- GitHub discussions
- Documentation site
- YouTube tutorials
- Conference talks (local meetups → larger events)

### Phase 3: Managed Service Launch

- Landing page with pricing
- Free trial (14 days)
- Stripe/Lightning billing
- Support ticketing system

### Phase 4: Enterprise Sales

- Case studies from managed customers
- Outbound to companies with compliance needs
- Partner with consultants/integrators
- Industry-specific landing pages

## Integration Strategy

### Leverage Strange Signal Ecosystem

1. **KCS Engine (from Hive)**
   - Knowledge-centered service methodology
   - Article lifecycle management
   - Integrate as optional module

2. **Nostr Identity**
   - Optional authentication via Nostr
   - Decentralized identity for power users
   - Align with Bitcoin/sovereignty crowd

3. **Outline Integration**
   - Connector for Outline wikis
   - Potential merge/acquisition target
   - Shared self-hosted philosophy

### Third-Party Integrations

Priority connectors:
1. PostgreSQL (done)
2. MySQL
3. REST APIs
4. Confluence (big migration opportunity)
5. Notion (export + connect)
6. Slack/Discord archives
7. Google Workspace
8. GitHub/GitLab (issues, wikis, code)

## Success Metrics

### Adoption Metrics

- GitHub stars (vanity but signals interest)
- Docker pulls
- Active instances (anonymous telemetry, opt-in)
- Community size (Discord, GitHub discussions)

### Product Metrics

- Documents indexed per instance
- Queries per day
- RAG answer quality (thumbs up/down)
- Search result CTR

### Business Metrics

- Managed tier conversions
- Enterprise pipeline
- ARR
- Churn rate
- NPS

## Risks and Mitigations

### Risk: OpenAI dependency

**Mitigation:** Support Ollama for local models. Make AI optional — semantic search works without RAG.

### Risk: pgvector doesn't scale

**Mitigation:** Architecture allows swapping to Pinecone/Weaviate. Start with pgvector (good to 10M vectors), migrate if needed.

### Risk: No one cares about self-hosted

**Mitigation:** Target regulated industries where they MUST self-host. Managed tier for those who don't want to.

### Risk: Enterprise sales cycle too long

**Mitigation:** Focus on bottom-up adoption. Free tier → team adoption → org-wide → enterprise deal.

### Risk: Competitor copies features

**Mitigation:** Move fast, build community, focus on developer experience. Open source moat is the community.

## The Vision

In 3 years, Beacon is the default choice for teams who want:
- AI-powered search across all their knowledge
- Ownership of their data
- A modern, developer-friendly experience

We're not trying to kill Notion or Confluence. We're serving the segment they can't: teams who want the future of knowledge management on their own terms.

---

*"Your knowledge, your infrastructure, your rules."*
