# NEXUS — REST API Reference (`v1`)

For AI coding assistants, machine-readable versions of this documentation are also served directly by the API:
- OpenAPI 3.1 Spec: `GET /openapi.json`
- AI Documentation Index: `GET /llms.txt`
- Consolidated AI Reference: `GET /llms-full.txt`
- AI Integration Guide: [`docs/AI_INTEGRATION_GUIDE.md`](./AI_INTEGRATION_GUIDE.md)

---

## Response Envelope

Every JSON response from NEXUS uses the same envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "1785aa73-69ca-44db-9890-3501e5c359b5",
    "version": "v1"
  },
  "error": null
}
```

When an error occurs (`HTTP 4xx` or `5xx`):

```json
{
  "success": false,
  "data": null,
  "meta": {
    "request_id": "d2100d65-7f05-40e6-a7d8-3da635955f5a",
    "version": "v1"
  },
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found."
  }
}
```

---

## Authentication

| Route Type | Required Header | Notes |
|---|---|---|
| **Public** (`/v1/health`, `/v1/public/files/{id}`, `/openapi.json`, `/llms.txt`, `/llms-full.txt`) | None | Accessible without credentials |
| **Application** (`/v1/me`, `/v1/files/*`) | `Authorization: Bearer nx_sk_...` or `X-API-Key: nx_sk_...` | Project is automatically derived from the key hash. **Server-side only.** |
| **Admin** (`/v1/admin/me`, `/v1/projects/*`, `/v1/keys/*`, `/v1/logs`) | `Authorization: Bearer <supabase-access-token>` | User UID must be listed in `ADMIN_USER_IDS` |

---

## Endpoints Summary

### 1. System & Discovery
- **`GET /v1/health`** — Returns `{ status: "ok" | "degraded", service: "nexus-api", database: "ok" | "error" | "not_configured", time }`.
- **`GET /openapi.json`** — OpenAPI 3.1.0 specification.
- **`GET /llms.txt`** — Concise AI assistant index.
- **`GET /llms-full.txt`** — Consolidated AI assistant documentation.

### 2. Identity Verification
- **`GET /v1/admin/me`** *(Admin)* — Returns `{ id, email }` for the logged-in administrator.
- **`GET /v1/me`** *(API Key)* — Validates the caller's `nx_sk_...` key, updates `last_used_at`, and returns `{ project, api_key }`.

### 3. Projects *(Admin)*
- **`GET /v1/projects`** — Lists all projects (`{ projects: [...] }`).
- **`POST /v1/projects`** — Body: `{ name, slug?, description? }`. Returns `201` with `{ project }`. Returns `409 SLUG_TAKEN` if `slug` already exists.
- **`GET /v1/projects/{id}`** — Returns `{ project }`.
- **`PATCH /v1/projects/{id}`** — Body: `{ name?, description?, status?: "active" | "archived" }`. Returns `{ project }`.

### 4. API Keys *(Admin)*
- **`POST /v1/projects/{id}/keys`** — Body: `{ name }`. Generates a `nx_sk_...` key, stores its SHA-256 hash, and returns `201` with `{ api_key: { id, project_id, name, key_prefix, secret_key, created_at } }`. **`secret_key` is shown only once.**
- **`GET /v1/projects/{id}/keys`** — Lists key metadata (`id`, `project_id`, `name`, `key_prefix`, `created_at`, `last_used_at`, `revoked_at`).
- **`DELETE /v1/keys/{id}`** — Revokes a key immediately by setting `revoked_at`.

### 5. File & Media Storage (Cloudflare R2)
- **`POST /v1/files/upload`** *(API Key)* — `multipart/form-data` with `file` (max 25 MB) and optional `visibility` (`"private"` default, or `"public"`). Returns `201` with `{ file }` including `content_url` and `public_url`.
- **`GET /v1/files`** *(API Key or Admin)* — Lists uploaded file metadata (`?visibility=`, `?limit=1..100`, and Admin-only `?project_id=`).
- **`GET /v1/files/{id}`** *(API Key or Admin)* — Returns `{ file }` metadata and URLs.
- **`PATCH /v1/files/{id}`** *(API Key or Admin)* — Body: `{ visibility: "public" | "private" }`. Updates file visibility.
- **`GET /v1/files/{id}/content`** *(API Key or Admin)* — Streams the raw binary file from R2 for authorized callers.
- **`GET /v1/public/files/{id}`** *(Public)* — Streams the binary file without authentication **only when** `visibility === "public"` and the parent project is `"active"`.
- **`DELETE /v1/files/{id}`** *(API Key or Admin)* — Deletes the object from R2 and removes its row from `media_assets`.

### 6. Activity Logs *(Admin)*
- **`GET /v1/logs`** — Query params: optional `?project_id=<uuid>` and `?limit=1..100` (default `50`). Returns `{ logs: [...] }`.

