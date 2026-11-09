# NEXUS — Official AI Assistant Integration Guide

This guide explains how an AI coding assistant (or human developer) should discover, authenticate, and integrate NEXUS services into an application (such as YATA, LEDGED, BeginAgain, a Unity game, a Laravel app, or a Python script).

> **Rule #1 for AI Assistants:** Always use the official endpoints, request parameters, and response structures documented in `/openapi.json`, `/llms-full.txt`, and `docs/API.md`. Never invent endpoints, parameters, or response fields.

---

## 1. How to Discover Available NEXUS Services

NEXUS publishes three machine-readable discovery endpoints directly on the API Worker:

1. **`GET /llms.txt`** — Concise index of available services, authentication rules, and documentation links.
2. **`GET /llms-full.txt`** — Consolidated documentation containing this guide, all endpoint specifications, and multi-language code examples in a single request.
3. **`GET /openapi.json`** — Machine-readable OpenAPI 3.1.0 specification describing all implemented routes, schemas, status codes, and security schemes.

---

## 2. How to Retrieve Endpoint Documentation

- For a quick overview of routes and authentication, read `/llms.txt` or `README.md`.
- For full request/response schemas and status codes, read `docs/API.md`, `/llms-full.txt`, or `/openapi.json`.
- For interactive browser testing and copy-paste snippets across 7 languages (`JavaScript Fetch`, `HTML + JS`, `React`, `PHP`, `Laravel`, `Python`, `C# / Unity`), open the **Documentation** tab in the NEXUS Developer Dashboard.

---

## 3. How to Select the Correct SDK or Integration Method

| Application Environment | Recommended Integration Method |
|---|---|
| **Node.js / Cloudflare Workers / Backend JS** | Import `Nexus` from `sdks/js/index.js` or use native `fetch` with `Authorization: Bearer nx_sk_...` |
| **PHP / Laravel Backend** | Use Laravel `Http::withToken(config('services.nexus.key'))` or PHP `curl` on your server |
| **Python Backend / Scripts** | Use `requests` with `Authorization: Bearer <NEXUS_API_KEY>` |
| **React / HTML Frontends** | Call your own backend for privileged operations (uploading/deleting files). Load public files directly via `<img src=".../v1/public/files/{id}" />` |
| **C# / Unity Games** | Fetch public assets directly via `GET /v1/public/files/{id}`. Route uploads or private operations through your game server |

---

## 4. How to Authenticate Securely

NEXUS has three access levels:

1. **Project API Key (`nx_sk_...`) — for application backends:**
   - Send in either header:
     ```
     Authorization: Bearer nx_sk_...
     X-API-Key: nx_sk_...
     ```
   - Store the key in a server-side environment variable (e.g. `NEXUS_API_KEY`).
   - NEXUS hashes the incoming key with SHA-256 and resolves the authorized project from the database. Never pass a `project_id` claiming ownership — the server always uses the key's project.

2. **Admin Bearer Token — for the NEXUS Developer Dashboard:**
   - Send a Supabase Auth access token (`Authorization: Bearer <token>`) belonging to a user listed in `ADMIN_USER_IDS`.

3. **Public Access — for public media assets:**
   - `GET /v1/public/files/{id}` requires no authentication header when the file's `visibility` is `"public"` and its parent project's `status` is `"active"`.

---

## 5. How to Implement Integrations Using Official Examples

Always wrap NEXUS calls in a small helper that checks both the HTTP status code and the JSON `success` field:

```js
const NEXUS_URL = process.env.NEXUS_URL || "http://localhost:8787";
const NEXUS_API_KEY = process.env.NEXUS_API_KEY;

export async function nexusRequest(path, options = {}) {
  const response = await fetch(`${NEXUS_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${NEXUS_API_KEY}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const err = new Error(payload.error?.message || `NEXUS HTTP ${response.status}`);
    err.code = payload.error?.code;
    err.requestId = payload.meta?.request_id;
    throw err;
  }

  return payload.data;
}
```

---

## 6. How to Handle Errors

Every JSON error response follows the exact same format:

```json
{
  "success": false,
  "data": null,
  "meta": {
    "request_id": "d2100d65-7f05-40e6-a7d8-3da635955f5a",
    "version": "v1"
  },
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid API key."
  }
}
```

Common error codes:
- `400 VALIDATION_ERROR` / `INVALID_JSON` / `INVALID_BODY` / `INVALID_ID` / `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE`
- `401 UNAUTHORIZED` / `MISSING_API_KEY` / `INVALID_API_KEY` / `REVOKED_API_KEY`
- `403 FORBIDDEN` / `PROJECT_ARCHIVED`
- `404 ROUTE_NOT_FOUND` / `RESOURCE_NOT_FOUND`
- `409 SLUG_TAKEN` / `KEY_TAKEN`
- `413 PAYLOAD_TOO_LARGE`
- `429 RATE_LIMITED`
- `500 INTERNAL_ERROR` / `DATABASE_ERROR` / `STORAGE_ERROR`

---

## 6B. When to Use NEXUS Document Storage (`/v1/data/{collection}`) vs. a Relational Database

NEXUS follows a **hybrid database ownership strategy**:
- **Use `/v1/data/{collection}` (or `nexus.data(collection)` in the JS SDK)** for lightweight, project-scoped JSON documents up to **64 KB UTF-8** such as Unity game saves, player settings, BeginAgain chat/session state, or feature flags.
- **Do NOT use `/v1/data/{collection}` as a relational database replacement:** it intentionally does not support SQL joins, foreign keys across documents, multi-document transactions, or aggregations, and `PATCH` performs full replacement of `data`.
- **Use a dedicated relational schema or database** for applications with complex relational models (such as YATA food ordering/delivery or LEDGED marketplace transactions), while still using NEXUS for file storage, key verification, and shared infrastructure.

---

## 7. How to Test Integrations

1. **Verify connectivity:** Call `GET /v1/health` and confirm `data.status === "ok"` and `data.database === "ok"`.
2. **Verify project credentials:** Call `GET /v1/me` with `Authorization: Bearer YOUR_API_KEY` and confirm `data.project.slug` matches your application.
3. **Verify file lifecycle:** Upload a small test file via `POST /v1/files/upload`, verify it appears in `GET /v1/files`, fetch its content via `GET /v1/files/{id}/content`, and clean it up with `DELETE /v1/files/{id}`.

---

## 8. Security Practices That Must Never Be Violated

1. **Never embed `nx_sk_...` secret API keys in client-side code** (HTML, React, Vue, mobile apps, or Unity game builds).
2. **Never expose `SUPABASE_SECRET_KEY`** outside the NEXUS Cloudflare Worker secrets (`.dev.vars` locally or `wrangler secret` in production).
3. **Never commit `.env`, `.env.local`, or `.dev.vars` files** to Git.
4. **Never bypass project isolation** — each application should have its own NEXUS project and its own `nx_sk_...` API key so keys can be rotated or revoked independently.

