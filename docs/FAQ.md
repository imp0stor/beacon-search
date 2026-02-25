# Beacon Search FAQ

## What is Beacon Search?
Beacon Search is a search platform for Nostr events and connected data sources (web, files, feeds), with hybrid semantic + keyword ranking and optional WoT filtering.

## What does “hybrid search” mean?
Hybrid mode blends vector similarity and full-text ranking. It generally performs best for mixed natural-language and keyword queries.

## Why did my query return no results?
- Data may not be indexed yet
- Filters (tags/source/author/WoT) may be too strict
- Query syntax may be invalid for boolean operators

Try removing filters and searching with plain language first.

## How do I ingest data?
Go to **Admin → Sources**, create a source, and run sync.

## What is WoT filtering?
Web-of-Trust filtering prioritizes trusted identity networks to reduce spam/noise.

## Is there an API?
Yes. See `docs/API.md`.

## How do I run Beacon in production?
Use `docker-compose.prod.yml`, configure DNS/TLS, and follow `docs/PRODUCTION-LAUNCH-CHECKLIST.md`.

## Where do I report issues?
Use the project issue tracker and include query, timestamp, and any API error response.
