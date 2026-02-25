# Beacon Search Performance Baseline (2026-02-24)

Environment:
- Beta frontend: `http://10.1.10.143:3002`
- API: `http://10.1.10.143:3001`
- Indexed events: ~1,920

## Search response timing
Command:
```bash
time curl -s "http://10.1.10.143:3001/api/search?q=nostr" > /dev/null
```

Recorded values (2026-02-24 run):
- real: `0.419 sec`
- user/sys: shell timing in this run reported wall-clock only

## Connector API latency
Command:
```bash
time curl -s "http://10.1.10.143:3001/api/connectors" > /dev/null
```

- real: `0.015 sec`

## DB query plan baseline
Command:
```bash
ssh neo@10.1.10.143 "docker exec beacon-search-db-1 psql -U beacon -d beacon_search -c 'EXPLAIN ANALYZE SELECT * FROM documents WHERE content_fts @@ to_tsquery(\'nostr\') LIMIT 20;'"
```

Result notes:
- Provided launch command failed because `content_fts` column does not exist.
- Correct equivalent query used indexed expression:

```sql
EXPLAIN ANALYZE
SELECT *
FROM documents
WHERE to_tsvector('english', content) @@ plainto_tsquery('english','nostr')
LIMIT 20;
```

Observed execution (beta):
- Planning Time: `2.645 ms`
- Execution Time: `0.240 ms`
- Plan used `Bitmap Index Scan` on `idx_documents_content`

## Ingestion throughput baseline
Collect from connector run logs:
- docs/min for web crawl
- events/min for nostr ingestion
- average sync duration

## Baseline notes
This file is a launch baseline template. Fill all `_TBD_` values during production rehearsal and keep snapshots per release date.
