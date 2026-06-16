# @ganatri/db

Database package for Ganatri. Houses schema definitions, migrations, and the Drizzle ORM client.

## Setup (Local Development)

### 1. Start the Postgres database
From the repo root:
```bash
npm run db:up
```

This starts a Postgres 16 container with credentials `postgres:postgres` on `localhost:5432`.

### 2. Run migrations
```bash
npm run db:migrate
```

This applies all pending migrations from `src/migrations/` to the local database.

You can also use Drizzle Studio to browse the schema:
```bash
npm run db:studio
```

## Usage

Import the database client and schema in your server code:

```typescript
import { getDb, users, games } from "@ganatri/db";

const db = getDb();
const allUsers = await db.select().from(users);
```

## Schema

Tables:
- `users` — User accounts (guests + registered)
- `auth_sessions` — Persisted session tokens
- `rooms` — Room lifecycle records
- `games` — Game records with seed, seating, outcome
- `game_players` — Join table with per-player stats
- `game_events` — Move-by-move event log (if enabled)
- `player_stats` — Aggregated player statistics
- `analytics_events` — Product analytics (optional)

All tables are fully typed via TypeScript inference from Drizzle definitions.

## Migrations

Generate migrations after schema changes:
```bash
npm run db:generate
```

This creates a new migration file in `src/migrations/` with the SQL diff.

Always review the generated SQL before committing.

## Connecting the Server

The server (`packages/server`) imports `@ganatri/db` as a workspace dependency.

Set `DATABASE_URL` in the server's `.env`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ganatri
DATABASE_POOL_SIZE=10
```

Then call `migrate()` on server startup (Phase 6d) and use `getDb()` in handlers.

## Environment Variables

### Local Development (docker-compose)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ganatri
DATABASE_POOL_SIZE=10
```

### Production (managed Postgres)
```
DATABASE_URL=postgresql://user:password@host:port/ganatri
DATABASE_POOL_SIZE=20  # adjust based on load
```

## Notes

- Migrations are checked into git; they are the single source of truth for schema
- Schema types are fully inferred from Drizzle definitions — no manual types needed
- Connection pooling is configured for a single Render instance; increase `DATABASE_POOL_SIZE` for horizontal scaling (Phase 7g)
