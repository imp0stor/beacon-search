# Beacon Schema Changes & Validation

## Why this exists
Beacon previously lost data due to an ingestion/schema mismatch. To prevent this, deployment now includes an automated schema validation gate that compares the expected Prisma schema to the live database before services are started.

---

## 1) How to create migrations

1. Update `prisma/schema.prisma` with the intended schema changes.
2. Generate a migration:

```bash
npx prisma@5.22.0 migrate dev --name <descriptive_migration_name>
```

3. Review generated SQL before applying.
4. Commit both schema and migration files together.

> If your workflow is SQL-first, keep `prisma/schema.prisma` in sync immediately after SQL changes.

---

## 2) How to test migrations locally

1. Ensure `DATABASE_URL` points to a local/dev database.
2. Apply migrations in dev:

```bash
npx prisma@5.22.0 migrate dev
```

3. Validate schema parity:

```bash
./scripts/validate-schema.sh
```

4. Run backend tests/build before deployment:

```bash
cd backend
npm run build
npm test
```

---

## 3) Schema validation process (pre-deploy gate)

Validation script: `scripts/validate-schema.sh`

What it checks:
- Missing columns/tables
- Type mismatches
- Constraint/index drift
- Any change required to make DB match `prisma/schema.prisma`

How it works:
- Loads `DATABASE_URL` from environment or `.env`
- Runs:

```bash
npx prisma@5.22.0 migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-url "$DATABASE_URL" \
  --script
```

- If actionable SQL diff is produced, script exits `1` and prints details.
- If no diff, exits `0`.

Deployment integration:
- `scripts/deploy.sh` now runs schema validation **before** `docker-compose up -d`.
- On mismatch, deployment aborts.

---

## 4) Rollback procedure if migration fails

1. Stop further deploy steps immediately.
2. Restore from latest backup (created by deploy script when `--backup` is used):

```bash
gunzip -c backups/<backup_file>.sql.gz | docker exec -i beacon-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

3. Revert offending migration/schema commit.
4. Re-run validation:

```bash
./scripts/validate-schema.sh
```

5. Re-deploy only after validation passes and health checks are green.

---

## Operational rule
Never deploy schema-affecting changes unless `./scripts/validate-schema.sh` passes in the target environment.
