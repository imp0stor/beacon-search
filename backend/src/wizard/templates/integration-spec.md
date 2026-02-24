# Integration Specification: {{integrationName}}

**Generated:** {{timestamp}}
**Phase:** Planning Complete
**Brief:** [integration-brief.md](./brief.md)

---

## Technical Overview

This specification defines how **{{contentType}}** from {{dataLocation}} will be integrated into Beacon Search.

---

## Connector Configuration

### Selected Connector: {{connectorType}}

**Rationale:** {{connectorReason}}

### Connection Details

| Setting | Value |
|---------|-------|
| **Connector Type** | {{connectorType}} |
| **Source** | {{dataLocation}} |
| **Authentication** | {{authMethod}} |

---

## Data Model

### Field Mappings

| Source Field | Target Field | Type | Searchable | Facetable |
|-------------|--------------|------|------------|-----------|
{{#each fieldMappings}}
| {{sourceField}} | {{targetField}} | {{type}} | {{#if searchable}}✓{{else}}{{/if}} | {{#if facetable}}✓{{else}}{{/if}} |
{{/each}}

### Document Structure

```json
{
  "id": "unique-document-id",
  "title": "Document title (searchable)",
  "content": "Main body text (searchable)",
  "url": "Link to original",
  "source_id": "{{integrationName}}",
  "document_type": "{{contentType}}",
  "attributes": {
    "category": "optional-category",
    "author": "optional-author",
    "date": "optional-date"
  },
  "embedding": "[384-dim vector]"
}
```

---

## Indexing Configuration

### Sync Strategy

| Setting | Value |
|---------|-------|
| **Initial Sync** | {{initialSyncStrategy}} |
| **Refresh Schedule** | {{refreshFrequency}} |
| **Estimated Documents** | {{estimatedDocuments}} |

### Rate Limiting

| Setting | Value |
|---------|-------|
| **Requests/Second** | {{rateLimitRps}} |
| **Max Concurrent** | {{rateLimitConcurrent}} |
| **Backoff Strategy** | Exponential |

### Content Processing

- [ ] Text extraction from documents
- [ ] OCR for image-based PDFs
- [ ] Translation (if needed)
- [ ] AI description for media

---

## Access Control

### Strategy: {{accessControlStrategy}}

{{#if (eq accessControlStrategy "open")}}
No restrictions - content is publicly searchable.
{{/if}}

{{#if (eq accessControlStrategy "authenticated")}}
Requires authentication:
- Session token validation
- User must be logged in
{{/if}}

{{#if (eq accessControlStrategy "role-based")}}
Role-based access:
{{#each accessRoles}}
- {{this}}
{{/each}}
{{/if}}

{{#if (eq accessControlStrategy "document-level")}}
Document-level permissions:
- Each document has ACL
- Permission check on search
- Filter results by user access
{{/if}}

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Data Flow                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Source    │───>│   Connector     │───>│   Processor     │  │
│  │ {{dataLocation}} │    │ ({{connectorType}})      │    │  (Embed/OCR)   │  │
│  └─────────────┘    └─────────────────┘    └─────────────────┘  │
│                              │                      │            │
│                              │                      │            │
│                              ▼                      ▼            │
│                     ┌─────────────────┐    ┌─────────────────┐  │
│                     │   PostgreSQL    │───>│  Search API     │  │
│                     │   (pgvector)    │    │  (Hybrid)       │  │
│                     └─────────────────┘    └─────────────────┘  │
│                                                    │            │
│                                                    ▼            │
│                                            ┌─────────────────┐  │
│                                            │   Frontend      │  │
│                                            │   (React)       │  │
│                                            └─────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

### Required Services
- Beacon Search Backend (running)
- PostgreSQL with pgvector extension
- Embedding model (MiniLM)

### Optional Services
- Tesseract OCR (for image PDFs)
- OpenAI API (for AI descriptions)
- Translation service

### External Access
{{#if (eq connectorType "web")}}
- Network access to {{dataLocation}}
- Outbound HTTPS (port 443)
{{/if}}
{{#if (eq connectorType "folder")}}
- File system access to {{dataLocation}}
- Read permissions on folder
{{/if}}
{{#if (eq connectorType "sql")}}
- Database network access
- Read permissions on tables
{{/if}}

---

## Error Handling

### Expected Errors

| Error | Action |
|-------|--------|
| Connection timeout | Retry with exponential backoff |
| Rate limited (429) | Wait and retry |
| Auth failure (401/403) | Log and alert |
| Content parse error | Log, skip document, continue |

### Monitoring

- Sync status in Connectors dashboard
- Error logs in application logs
- Webhook notifications on sync events

---

## Testing Plan

### Pre-Sync Tests
1. Validate YAML configuration syntax
2. Test source connectivity
3. Verify credentials work
4. Check file/page accessibility

### Post-Sync Tests
1. Verify document count matches expected
2. Run sample search queries
3. Check relevance of results
4. Validate access controls

---

## Rollback Plan

If integration causes issues:

1. Disable connector in dashboard
2. Delete indexed documents: `DELETE FROM documents WHERE source_id = '{{integrationName}}'`
3. Remove configuration file
4. Investigate and fix issues
5. Re-enable when ready

---

## Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Technical | | | [ ] |
| Security | | | [ ] |
| Business | | | [ ] |

---

*Spec generated by BMAD Config Wizard*
