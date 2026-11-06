# NEXUS

My personal API infrastructure platform. See `AGENTS.md` for the full project instructions.

## Structure

- `api/` — the NEXUS API (one Cloudflare Worker)

- `database/migrations/` — SQL files, run in order in the Supabase SQL Editor

## Database setup (once)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor**, paste and run each migration in order:
   - `database/migrations/001_projects_and_api_keys.sql`
   - `database/migrations/002_activity_logs.sql`
   - `database/migrations/003_media_assets.sql`

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
| POST | `/v1/projects/{id}/keys` | **Admin.** Generates a new API key (`name`). Returns the full `secret_key` **once** |
| GET | `/v1/projects/{id}/keys` | **Admin.** Lists API key metadata for a project (never returns the secret) |
| DELETE | `/v1/keys/{id}` | **Admin.** Revokes an API key |
| GET | `/v1/logs` | **Admin.** Lists recent activity logs (optional `?project_id=` and `?limit=1..100`) |
| GET | `/v1/me` | **API Key.** Returns the project associated with the caller's API key |
| POST | `/v1/files/upload` | **API Key.** Uploads a file (`multipart/form-data` with `file` and optional `visibility`: `private` or `public`) |
| GET | `/v1/files` | **API Key / Admin.** Lists uploaded file metadata (scoped to the caller's project for API keys) |
| GET | `/v1/files/{id}` | **API Key / Admin.** Returns one file's metadata and URLs |
| PATCH | `/v1/files/{id}` | **API Key / Admin.** Updates a file's `visibility` (`public` or `private`) |
| GET | `/v1/files/{id}/content` | **API Key / Admin.** Downloads a file's binary content (both `private` and `public` files) |
| DELETE | `/v1/files/{id}` | **API Key / Admin.** Deletes a file from R2 and removes its metadata |
| GET | `/v1/public/files/{id}` | **Public.** Streams a file's binary content without auth **only if** `visibility` is `"public"` and its project is `"active"` |

### Admin routes

Admin routes need a Supabase Auth login token from a user listed in `ADMIN_USER_IDS`:

```
Authorization: Bearer <supabase-access-token>
```

Missing or invalid token → `401 UNAUTHORIZED`. Valid login but not an admin → `403 FORBIDDEN`.

### Application routes (API keys)

Applications authenticate with a project API key (`nx_sk_...`) in either header:

```
Authorization: Bearer nx_sk_...
X-API-Key: nx_sk_...
```

The authorized project is always derived from the validated key hash. Revoked keys return `401 REVOKED_API_KEY`; keys belonging to an archived project return `403 PROJECT_ARCHIVED`.

All responses use the same JSON shape:

```json
{
  "success": true,
  "data": {},
  "meta": { "request_id": "uuid", "version": "v1" },
  "error": null
}
```

