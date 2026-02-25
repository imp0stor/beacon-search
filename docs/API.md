# Beacon Search API

Base URL (beta): `http://10.1.10.143:3001`

## Search
- `GET /api/search?q=<query>&mode=<hybrid|vector|text>&limit=20`
- `GET /api/search/facets`
- `GET /api/search/filtered?...` (if enabled)

## Documents
- `GET /api/documents?limit=20`
- `POST /api/documents`
- `DELETE /api/documents/:id`
- `POST /api/documents/:id/process-nlp`
- `POST /api/generate-embeddings`

## Connectors / Sources
- `GET /api/connectors`
- `POST /api/connectors`
- `PUT /api/connectors/:id`
- `DELETE /api/connectors/:id`
- `POST /api/connectors/:id/run`
- `POST /api/connectors/:id/stop`
- `GET /api/connectors/:id/status`
- `GET /api/connectors/:id/history`

Admin API (new dashboard):
- `GET /api/sources`
- `POST /api/sources`
- `POST /api/sources/:id/sync`
- `POST /api/sources/:id/test`

## Analytics / Stats
- `GET /api/stats`
- `GET /api/admin/stats`
- `GET /api/admin/health`
- `GET /api/admin/activity`

## Errors
Error format is JSON with `message` (or `error` in some legacy endpoints). Clients should display friendly fallback text on network/API failures.

## Auth
If auth is enabled in your deployment, admin endpoints must be protected and only available to authorized users.
