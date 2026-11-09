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
| **Application** (`/v1/me`, `/v1/files/*`, `/v1/data/*`) | `Authorization: Bearer nx_sk_...` or `X-API-Key: nx_sk_...` | Project is automatically derived from the key hash. **Server-side only.** |
| **Admin** (`/v1/admin/*`, `/v1/projects/*`, `/v1/keys/*`, `/v1/logs`) | `Authorization: Bearer <supabase-access-token>` | User UID must be listed in `ADMIN_USER_IDS` |

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

### 6. Project-Scoped Document Storage (`app_records`)
> **Hybrid Database Strategy & Limitations:**
> - `/v1/data/{collection}` provides lightweight project-scoped JSON document storage (game saves, player preferences, chat/session logs, simple app records).
> - **Not a relational database replacement:** No SQL joins, no cross-document foreign keys, no multi-document transactions, and no server-side aggregations. Applications with complex relational requirements (such as YATA or LEDGED) should use their own dedicated relational schema or database alongside NEXUS.
> - **Strict project isolation:** Every `/v1/data/*` request requires a project API key (`nx_sk_...`) and derives `project_id` exclusively from that key. Passing `project_id` in query params or the request body is rejected with `400 VALIDATION_ERROR`.
> - **Size & replacement rules:** `data` must be a plain JSON object (`{ ... }`) up to **64 KB UTF-8** (`65,536` bytes), with a `72 KB` raw HTTP body cap. `PATCH` performs **full replacement** of `data` (partial `merge` is not supported).

- **`POST /v1/data/{collection}`** *(API Key ONLY)* — Body: `{ key?: string, data: object }`. Collection name must be `1..64` chars matching `^[a-z0-9][a-z0-9_-]*$`. Optional `key` (`1..128` chars, `^[a-zA-Z0-9][a-zA-Z0-9._:-]*$`) is unique per `(project_id, collection)`. Returns `201` with `{ record }`, `409 KEY_TAKEN` on duplicate key, or `413 PAYLOAD_TOO_LARGE` if `data` exceeds 64 KB UTF-8.
- **`GET /v1/data/{collection}`** *(API Key ONLY)* — Lists documents in the collection with deterministic pagination sorted by `(created_at, id)`:
  - `?limit=1..100` (default `25`)
  - `?offset=0..100000` (default `0`)
  - `?order=asc|desc` (default `desc`)
  - `?key=<exact_key>` (optional exact key lookup)
  - `?filter_field=<top_level_field>&filter_value=<value>` (optional top-level JSON containment filter)
  - Returns `{ records: [...], pagination: { limit, offset, total, order } }`.
- **`GET /v1/data/{collection}/{id}`** *(API Key ONLY)* — Fetches a single document scoped to `(id, project_id, collection)`. Returns `{ record }` or `404 RESOURCE_NOT_FOUND`.
- **`PATCH /v1/data/{collection}/{id}`** *(API Key ONLY)* — Body: `{ key?: string | null, data: object }`. Replaces the entire `data` object (and optional `key`) and updates `updated_at`, scoped to `(id, project_id, collection)`. Returns `{ record }`.
- **`DELETE /v1/data/{collection}/{id}`** *(API Key ONLY)* — Deletes a document scoped to `(id, project_id, collection)`. Returns `{ deleted: true, id }`.
- **`GET /v1/admin/projects/{projectId}/data/{collection}`**, **`GET /v1/admin/projects/{projectId}/data/{collection}/{id}`**, **`DELETE /v1/admin/projects/{projectId}/data/{collection}/{id}`** *(Admin ONLY)* — Separate administrator routes for inspecting or deleting project documents.

### 7. Activity Logs *(Admin)*
- **`GET /v1/logs`** — Query params: optional `?project_id=<uuid>` and `?limit=1..100` (default `50`). Returns `{ logs: [...] }`.


