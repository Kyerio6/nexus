# NEXUS

My personal API infrastructure platform. See `AGENTS.md` for the full project instructions.

## Structure

- `api/` — the NEXUS API (one Cloudflare Worker)

- `database/migrations/` — SQL files, run in order in the Supabase SQL Editor

## Database setup (once)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor**, paste the contents of `database/migrations/001_projects_and_api_keys.sql`, and run it.

## Run the API locally

Requires Node.js.

```bash
cd api
npm install
copy .dev.vars.example .dev.vars   # then fill in your Supabase URL and secret key
npm run dev
```

The API runs at http://localhost:8787. Test it:

```bash
curl http://localhost:8787/v1/health
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/v1/health` | Returns `status: "ok"` if the API is running and the database is reachable, otherwise `"degraded"`. `database` is `"ok"`, `"error"` or `"not_configured"` |
| GET | `/v1/admin/me` | **Admin.** Returns the logged-in admin's `id` and `email` |
| GET | `/v1/projects` | **Admin.** Lists all projects (newest first) |
| POST | `/v1/projects` | **Admin.** Creates a project (`name`, optional `slug`, optional `description`) |
| GET | `/v1/projects/{id}` | **Admin.** Fetches one project by UUID |
| PATCH | `/v1/projects/{id}` | **Admin.** Updates a project's `name`, `description`, or `status` (`active` / `archived`) |

### Admin routes

Admin routes need a Supabase Auth login token from a user listed in `ADMIN_USER_IDS`:

```
Authorization: Bearer <supabase-access-token>
```

Missing or invalid token → `401 UNAUTHORIZED`. Valid login but not an admin → `403 FORBIDDEN`.

All responses use the same JSON shape:

```json
{
  "success": true,
  "data": {},
  "meta": { "request_id": "uuid", "version": "v1" },
  "error": null
}
```

