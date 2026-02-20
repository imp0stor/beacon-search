# Beacon Search Integration Catalog

**Last Updated:** 2026-02-11  
**Total Integrations:** 39 (19 Enterprise + 20 Open Source)

## Overview

Beacon Search supports 39 pre-configured integrations across enterprise SaaS platforms and open-source systems. Each integration is defined via YAML templates that specify authentication, API endpoints, data mapping, and content extraction rules.

## Integration Categories

### Enterprise SaaS (19)

Enterprise-grade cloud platforms with OAuth2 or API token authentication.

| Platform | Category | Content Types | Auth Type | Status |
|----------|----------|---------------|-----------|--------|
| **Notion** | Productivity | Pages, Databases, Blocks | OAuth2 | ✅ Ready |
| **Slack** | Communication | Messages, Files, Threads | OAuth2 | ✅ Ready |
| **Jira** | Project Mgmt | Issues, Comments, Attachments | OAuth2/Token | ✅ Ready |
| **Confluence** | Knowledge Base | Pages, Spaces, Attachments | OAuth2/Token | ✅ Ready |
| **SharePoint** | Document Mgmt | Files, Lists, Sites | OAuth2 | ✅ Ready |
| **OneDrive** | Cloud Storage | Files, Folders | OAuth2 | ✅ Ready |
| **Google Drive** | Cloud Storage | Docs, Sheets, PDFs | OAuth2 | ✅ Ready |
| **Salesforce** | CRM | Accounts, Cases, Knowledge | OAuth2 | ✅ Ready |
| **ServiceNow** | ITSM | Incidents, KB Articles | OAuth2/Basic | ✅ Ready |
| **Zendesk** | Support | Tickets, Articles, Forums | OAuth2/Token | ✅ Ready |
| **Freshdesk** | Support | Tickets, Solutions, Forums | Token | ✅ Ready |
| **Intercom** | Customer Comm | Messages, Articles | OAuth2 | ✅ Ready |
| **HubSpot** | Marketing/CRM | Contacts, Deals, Articles | OAuth2 | ✅ Ready |
| **Asana** | Project Mgmt | Tasks, Projects, Comments | OAuth2/Token | ✅ Ready |
| **Monday.com** | Work OS | Boards, Items, Updates | OAuth2 | ✅ Ready |
| **Airtable** | Databases | Tables, Records, Attachments | Token | ✅ Ready |
| **Box** | Cloud Storage | Files, Folders, Notes | OAuth2 | ✅ Ready |
| **Dropbox** | Cloud Storage | Files, Paper Docs | OAuth2 | ✅ Ready |
| **Coda** | Docs & Sheets | Documents, Tables, Pages | Token | ✅ Ready |

### Open Source / Self-Hosted (20)

Self-hosted platforms that run on-premises or in your cloud infrastructure.

| Platform | Category | Content Types | Auth Type | Status |
|----------|----------|---------------|-----------|--------|
| **GitLab** | DevOps | Wikis, Issues, MRs, READMEs | Token | ✅ Ready |
| **Gitea** | Git Hosting | Repos, Issues, Wikis | Token | ✅ Ready |
| **WordPress** | CMS | Posts, Pages, Comments | Token/Basic | ✅ Ready |
| **Ghost** | Publishing | Posts, Pages, Authors | Token | ✅ Ready |
| **Strapi** | Headless CMS | Collections, Entries | Token | ✅ Ready |
| **Directus** | Headless CMS | Collections, Items | Token | ✅ Ready |
| **Outline** | Wiki | Documents, Collections | Token | ✅ Ready |
| **BookStack** | Documentation | Books, Chapters, Pages | Token | ✅ Ready |
| **DokuWiki** | Wiki | Pages, Namespaces | Token/Basic | ✅ Ready |
| **MediaWiki** | Wiki | Articles, Categories | Token | ✅ Ready |
| **XWiki** | Enterprise Wiki | Pages, Spaces, Attachments | Basic | ✅ Ready |
| **Docusaurus** | Static Docs | Markdown Pages, Sidebars | File | ✅ Ready |
| **Mattermost** | Team Chat | Messages, Channels, Files | Token | ✅ Ready |
| **Rocket.Chat** | Team Chat | Messages, Rooms, Threads | Token/OAuth2 | ✅ Ready |
| **Discourse** | Forums | Topics, Posts, Categories | Token | ✅ Ready |
| **Nextcloud** | File Sync | Files, Folders, Talk | Token/Basic | ✅ Ready |
| **Odoo** | ERP | CRM, Sales, Projects, KB | Token/Basic | ✅ Ready |
| **ERPNext** | ERP | Docs, CRM, Projects | Token | ✅ Ready |
| **Zammad** | Helpdesk | Tickets, Articles, Users | Token | ✅ Ready |
| **Confluence (OSS)** | Wiki | Pages, Spaces | Token/Basic | ✅ Ready |

## Integration Architecture

### YAML-Based Configuration

Each integration is defined in a YAML file with standardized sections:

```yaml
name: "Platform Name"
type: "rest|sql|file"
description: "Brief description"
icon: "platform-slug"
category: "productivity|communication|development|..."

auth:
  type: "oauth2|token|basic"
  fields: [...]
  
endpoints:
  list_items: {...}
  get_item: {...}
  search: {...}

mapping:
  document_type:
    id: "JSONPath expression"
    title: "..."
    content: "..."
    url: "..."

rate_limit:
  requests_per_minute: 100
  concurrent: 3

features:
  - incremental_sync
  - webhooks
  - permissions
```

### Common Patterns

#### REST API Integration
- OAuth2 or token authentication
- Pagination (cursor, page, or offset-based)
- JSONPath mapping for field extraction
- Rate limiting and retry logic

#### SQL Integration
- Direct database connections (PostgreSQL, MySQL, MSSQL)
- Metadata-first sync (fetch IDs + timestamps, then batch fetch changes)
- Custom queries for permissions and filtering

#### File System Integration
- Local folder scanning
- Recursive directory traversal
- File type filtering (.md, .pdf, .docx, .html, .txt)
- Watch mode for real-time updates

## Authentication Types

### OAuth2 Flow
1. User initiates OAuth flow in admin UI
2. Redirected to provider's authorization URL
3. Provider redirects back with authorization code
4. Backend exchanges code for access + refresh tokens
5. Tokens stored encrypted in database
6. Auto-refresh on expiration

### API Token
1. User generates token in source platform
2. Pastes token in Beacon admin UI
3. Token stored encrypted
4. Included in API request headers

### Basic Auth
1. Username + password provided
2. Credentials stored encrypted
3. Base64-encoded in Authorization header

## Data Mapping

### Standard Fields

All integrations map to a common document schema:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Internal Beacon ID |
| `external_id` | string | Source system's unique ID |
| `document_type` | string | Integration-specific type |
| `title` | string | Document title/name |
| `content` | text | Full text content (searchable) |
| `url` | string | Deep link back to source |
| `author` | string | Creator/author name |
| `created` | timestamp | Creation date |
| `modified` | timestamp | Last update (for sync) |
| `attributes` | JSONB | Custom fields (attr_*) |
| `permission_groups` | string[] | Access control groups |
| `embedding` | vector(384) | Semantic embedding |

### Dynamic Attributes

Integration-specific metadata stored as `attr_*` fields:

```json
{
  "attr_labels": ["bug", "high-priority"],
  "attr_milestone": "v2.0",
  "attr_assignee": "john@example.com",
  "attr_status": "in_progress"
}
```

## Content Extraction

### Supported Content Types

| Type | Extensions | Extraction Method |
|------|------------|-------------------|
| Plain Text | .txt, .md | Direct read |
| Markdown | .md, .mdx | Parse + render to text |
| HTML | .html | Strip tags, extract text |
| PDF | .pdf | pdf-parse library |
| Word | .docx | mammoth library |
| Images | .jpg, .png | OCR (Tesseract.js) |
| Audio | .mp3, .wav | Whisper transcription |
| Video | .mp4, .mkv | Frame extraction + description |

### Content Processors

Custom processors for complex formats:

- **notion_blocks_to_text**: Recursively parse Notion blocks
- **slack_thread_flattener**: Combine thread messages
- **jira_rich_text**: Parse Atlassian Document Format (ADF)
- **confluence_storage**: Parse Confluence storage format
- **markdown_preprocessor**: Extract frontmatter, code blocks
- **html_cleaner**: Remove scripts, styles, navigation

## Incremental Sync

### Metadata-First Algorithm

Efficient sync that minimizes API calls:

1. **Fetch Metadata**: Query source for `(id, last_modified)` pairs
2. **Compare**: Match against existing documents in Beacon
3. **Detect Changes**:
   - **New**: IDs in source but not in Beacon
   - **Updated**: IDs with newer `last_modified` timestamp
   - **Deleted**: IDs in Beacon but not in source
4. **Batch Fetch**: Retrieve full content only for changed documents
5. **Process**: Extract text, generate embeddings, index
6. **Cleanup**: Delete removed documents

### Sync History

Each sync run tracked with:
- Start/end timestamps
- Documents added/updated/removed
- Error messages
- Duration and performance metrics

## Permission Filtering

### Query-Time Permissions

Search results filtered based on user's group membership:

```sql
SELECT * FROM documents
WHERE document_type = 'jira_issue'
  AND (
    permission_groups = '{}'  -- Public
    OR permission_groups && $user_groups  -- User has access
  )
```

### Permission Queries

Integrations can define custom permission resolution:

```yaml
permission_query: |
  SELECT array_agg(project_key)
  FROM jira_projects
  WHERE user_id = ${user_id}
```

## Webhooks

Real-time sync via webhooks (supported integrations):

1. User configures webhook in source platform
2. Webhook points to `https://beacon.example.com/api/webhooks/:source_id`
3. Source platform sends event on create/update/delete
4. Beacon validates signature, processes event
5. Document indexed immediately (no wait for scheduled sync)

**Supported Events:**
- Create: Index new document
- Update: Refresh document content
- Delete: Remove from index
- Move: Update URL/parent

## Rate Limiting

Respect source platform limits to avoid throttling:

```yaml
rate_limit:
  requests_per_minute: 150
  concurrent: 3
  retry_after_header: "Retry-After"
  backoff_strategy: "exponential"
```

Strategies:
- **Fixed delay**: Wait between requests
- **Exponential backoff**: Increase delay on 429 errors
- **Token bucket**: Smooth rate limiting

## Configuration Examples

### Adding a GitLab Integration

```bash
POST /api/sources
{
  "name": "Engineering GitLab",
  "integration": "gitlab",
  "config": {
    "base_url": "https://gitlab.company.com",
    "access_token": "glpat-xxxxxxxxxxxx",
    "content_types": ["wikis", "issues", "merge_requests"]
  },
  "sync_schedule": "0 */6 * * *"  # Every 6 hours
}
```

### Adding a Notion Integration

```bash
POST /api/sources
{
  "name": "Product Notion Workspace",
  "integration": "notion",
  "config": {
    "oauth_client_id": "xxxxx",
    "oauth_client_secret": "xxxxx"
  },
  "sync_schedule": "0 */4 * * *"  # Every 4 hours
}
```

### Adding a Local Folder

```bash
POST /api/sources
{
  "name": "Documentation Folder",
  "integration": "folder",
  "config": {
    "path": "/data/docs",
    "recursive": true,
    "file_types": [".md", ".pdf", ".docx"],
    "watch": true  # Real-time updates
  }
}
```

## Best Practices

### Performance
- Enable incremental sync for large datasets
- Use webhooks for real-time updates when available
- Batch process documents (100-500 per batch)
- Index during off-hours for large syncs

### Security
- Store credentials encrypted at rest
- Use OAuth2 over API tokens when possible
- Rotate tokens periodically
- Validate webhook signatures
- Apply principle of least privilege (read-only tokens)

### Reliability
- Implement exponential backoff on errors
- Log failed document processing (don't halt sync)
- Monitor sync success rate
- Set up alerts for consecutive failures

### Content Quality
- Configure content processors for each integration
- Test mappings with sample documents
- Exclude irrelevant content (test data, drafts)
- Use URL templates for accurate deep links

## Troubleshooting

### Common Issues

**Authentication Failures**
- Verify token hasn't expired
- Check required scopes/permissions
- Confirm base URL is correct

**Missing Content**
- Check content type filters
- Verify permission queries
- Review sync logs for errors

**Slow Syncs**
- Reduce concurrent requests
- Increase batch size
- Use metadata-first sync
- Enable pagination

**Incomplete Results**
- Check pagination configuration
- Verify result field mappings
- Review rate limit settings

## Integration Development

### Adding a New Integration

1. Create YAML file in `integrations/enterprise/` or `integrations/opensource/`
2. Define authentication, endpoints, and mapping
3. Test with sample data
4. Add to integration catalog
5. Document configuration parameters
6. Submit PR with tests

### Testing Integrations

```bash
# Test connection
POST /api/sources/:id/test

# Dry-run sync (don't commit)
POST /api/sources/:id/sync?dry_run=true

# Fetch single document
POST /api/sources/:id/debug/fetch
{
  "external_id": "ABC-123"
}
```

## Roadmap

### Planned Integrations (Q1 2026)
- [ ] Linear (project management)
- [ ] ClickUp (productivity)
- [ ] Microsoft Teams (messages)
- [ ] Discord (community)
- [ ] Figma (design files)
- [ ] Loom (video transcripts)

### Features in Development
- [ ] Multi-workspace support (single integration, multiple instances)
- [ ] Field-level permissions (redact sensitive fields)
- [ ] Custom content transformers (user-defined scripts)
- [ ] GraphQL endpoint support
- [ ] SAML/SSO integration

---

## Quick Reference

**Integration Count:** 39  
**File Location:** `integrations/`  
**Schema:** YAML with JSONPath mappings  
**Auth Types:** OAuth2, Token, Basic  
**Sync Modes:** Scheduled, Manual, Webhook  
**Documentation:** Each YAML includes `docs_url` field

For detailed configuration of a specific integration, see the YAML file in `integrations/enterprise/` or `integrations/opensource/`.
