// Machine-readable OpenAPI 3.1 specification and AI-readable documentation
// endpoints (/openapi.json, /llms.txt, /llms-full.txt).

export function handleOpenApi(url) {
  const origin = url.origin;

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "NEXUS API",
      version: "v1",
      description:
        "Personal API infrastructure platform providing project management, API key authentication, Cloudflare R2 file/media storage, and activity logging.",
    },
    servers: [{ url: origin, description: "Current NEXUS API instance" }],
    components: {
      securitySchemes: {
        AdminBearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "Supabase Auth access token from a user listed in ADMIN_USER_IDS.",
        },
        ProjectApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "Project secret API key (nx_sk_...) passed via Authorization: Bearer nx_sk_... or X-API-Key: nx_sk_...",
        },
      },
      schemas: {
        Meta: {
          type: "object",
          required: ["request_id", "version"],
          properties: {
            request_id: { type: "string", format: "uuid" },
            version: { type: "string", example: "v1" },
          },
        },
        ErrorEnvelope: {
          type: "object",
          required: ["success", "data", "meta", "error"],
          properties: {
            success: { type: "boolean", enum: [false] },
            data: { type: "null" },
            meta: { $ref: "#/components/schemas/Meta" },
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string", example: "RESOURCE_NOT_FOUND" },
                message: { type: "string", example: "The requested resource was not found." },
              },
            },
          },
        },
        Project: {
          type: "object",
          required: ["id", "name", "slug", "description", "status", "created_at"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "YATA" },
            slug: { type: "string", example: "yata" },
            description: { type: ["string", "null"] },
            status: { type: "string", enum: ["active", "archived"] },
            created_at: { type: "string", format: "date-time" },
          },
        },
        ApiKeyMetadata: {
          type: "object",
          required: ["id", "project_id", "name", "key_prefix", "created_at", "last_used_at", "revoked_at"],
          properties: {
            id: { type: "string", format: "uuid" },
            project_id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Production Server" },
            key_prefix: { type: "string", example: "nx_sk_1518b19b" },
            created_at: { type: "string", format: "date-time" },
            last_used_at: { type: ["string", "null"], format: "date-time" },
            revoked_at: { type: ["string", "null"], format: "date-time" },
          },
        },
        MediaAsset: {
          type: "object",
          required: [
            "id",
            "project_id",
            "original_filename",
            "storage_key",
            "mime_type",
            "size_bytes",
            "visibility",
            "created_at",
            "content_url",
            "public_url",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            project_id: { type: "string", format: "uuid" },
            original_filename: { type: "string", example: "menu-photo.png" },
            storage_key: { type: "string", example: "yata/uuid/menu-photo.png" },
            mime_type: { type: "string", example: "image/png" },
            size_bytes: { type: "integer", example: 184320 },
            visibility: { type: "string", enum: ["private", "public"] },
            created_at: { type: "string", format: "date-time" },
            content_url: { type: "string", format: "uri" },
            public_url: { type: ["string", "null"], format: "uri" },
          },
        },
        ActivityLog: {
          type: "object",
          required: ["id", "project_id", "actor_type", "actor_id", "action", "details", "created_at"],
          properties: {
            id: { type: "string", format: "uuid" },
            project_id: { type: ["string", "null"], format: "uuid" },
            actor_type: { type: "string", enum: ["admin", "api_key", "system"] },
            actor_id: { type: ["string", "null"] },
            action: { type: "string", example: "file.uploaded" },
            details: { type: "object" },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
    paths: {
      "/v1/health": {
        get: {
          summary: "Check API and database health",
          responses: {
            200: { description: "Health check response" },
          },
        },
      },
      "/v1/admin/me": {
        get: {
          summary: "Verify logged-in administrator",
          security: [{ AdminBearerAuth: [] }],
          responses: {
            200: { description: "Authenticated admin user id and email" },
            401: { description: "Missing or invalid login token" },
            403: { description: "User is not an allow-listed admin" },
          },
        },
      },
      "/v1/me": {
        get: {
          summary: "Verify project API key and retrieve project info",
          security: [{ ProjectApiKeyAuth: [] }],
          responses: {
            200: { description: "Authorized project and API key metadata" },
            401: { description: "Missing, invalid, or revoked API key" },
            403: { description: "Project is archived" },
          },
        },
      },
      "/v1/projects": {
        get: {
          summary: "List all projects",
          security: [{ AdminBearerAuth: [] }],
          responses: { 200: { description: "List of projects" } },
        },
        post: {
          summary: "Create a project",
          security: [{ AdminBearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    slug: { type: "string" },
                    description: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Project created" },
            400: { description: "Validation error" },
            409: { description: "Project slug already taken" },
          },
        },
      },
      "/v1/projects/{id}": {
        get: {
          summary: "Get project by UUID",
          security: [{ AdminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Project details" },
            404: { description: "Project not found" },
          },
        },
        patch: {
          summary: "Update project name, description, or status",
          security: [{ AdminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: ["string", "null"] },
                    status: { type: "string", enum: ["active", "archived"] },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Updated project" },
            404: { description: "Project not found" },
          },
        },
      },
      "/v1/projects/{id}/keys": {
        get: {
          summary: "List API keys for a project",
          security: [{ AdminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "API key metadata list" } },
        },
        post: {
          summary: "Generate a new API key for a project",
          security: [{ AdminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: { name: { type: "string" } },
                },
              },
            },
          },
          responses: {
            201: { description: "Generated API key including one-time secret_key" },
          },
        },
      },
      "/v1/keys/{id}": {
        delete: {
          summary: "Revoke an API key",
          security: [{ AdminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Key revoked" },
            404: { description: "Key not found" },
          },
        },
      },
      "/v1/files/upload": {
        post: {
          summary: "Upload a file to Cloudflare R2",
          security: [{ ProjectApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: { type: "string", format: "binary" },
                    visibility: { type: "string", enum: ["private", "public"] },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Uploaded file metadata and URLs" },
            400: { description: "Validation, size, or MIME type error" },
          },
        },
      },
      "/v1/files": {
        get: {
          summary: "List uploaded files",
          security: [{ ProjectApiKeyAuth: [] }, { AdminBearerAuth: [] }],
          parameters: [
            { name: "visibility", in: "query", schema: { type: "string", enum: ["private", "public"] } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
            { name: "project_id", in: "query", schema: { type: "string", format: "uuid" } },
          ],
          responses: { 200: { description: "List of uploaded file records" } },
        },
      },
      "/v1/files/{id}": {
        get: {
          summary: "Get file metadata by UUID",
          security: [{ ProjectApiKeyAuth: [] }, { AdminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "File metadata and URLs" },
            404: { description: "File not found" },
          },
        },
        patch: {
          summary: "Update file visibility ('public' or 'private')",
          security: [{ ProjectApiKeyAuth: [] }, { AdminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["visibility"],
                  properties: {
                    visibility: { type: "string", enum: ["private", "public"] },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Updated file metadata" } },
        },
        delete: {
          summary: "Delete file from R2 and database",
          security: [{ ProjectApiKeyAuth: [] }, { AdminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "File deleted" } },
        },
      },
      "/v1/files/{id}/content": {
        get: {
          summary: "Download authorized file content",
          security: [{ ProjectApiKeyAuth: [] }, { AdminBearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Binary file stream" },
            404: { description: "File not found" },
          },
        },
      },
      "/v1/public/files/{id}": {
        get: {
          summary: "Stream a public file without authentication",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Binary file stream (only when visibility is 'public' and project is 'active')" },
            404: { description: "File not found or not public" },
          },
        },
      },
      "/v1/logs": {
        get: {
          summary: "List activity logs",
          security: [{ AdminBearerAuth: [] }],
          parameters: [
            { name: "project_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          ],
          responses: { 200: { description: "List of activity logs" } },
        },
      },
    },
  };

  return new Response(JSON.stringify(spec, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function handleLlmsTxt(url) {
  const origin = url.origin;
  const text = `# NEXUS — Personal API Infrastructure Platform

> NEXUS is a centralized REST API backend toolbox (Cloudflare Workers + Supabase PostgreSQL + Cloudflare R2) used across personal applications (YATA, LEDGED, Unity games, BeginAgain, etc.).

## Discovery & Machine-Readable Documentation
- OpenAPI 3.1 Specification: ${origin}/openapi.json
- Complete AI Documentation & Code Examples: ${origin}/llms-full.txt
- Repository Docs: docs/API.md and docs/AI_INTEGRATION_GUIDE.md
- Official JavaScript SDK: sdks/js/index.js

## Available Services
1. Health & Status: GET /v1/health
2. Project Identity & Verification: GET /v1/me (API Key), GET /v1/admin/me (Admin)
3. Project Management (Admin): GET /v1/projects, POST /v1/projects, GET /v1/projects/{id}, PATCH /v1/projects/{id}
4. API Key Management (Admin): POST /v1/projects/{id}/keys, GET /v1/projects/{id}/keys, DELETE /v1/keys/{id}
5. File & Media Storage (Cloudflare R2):
   - Upload: POST /v1/files/upload (API Key, multipart/form-data)
   - List: GET /v1/files
   - Get Metadata: GET /v1/files/{id}
   - Update Visibility: PATCH /v1/files/{id}
   - Authorized Download: GET /v1/files/{id}/content
   - Public Stream: GET /v1/public/files/{id} (No auth required if visibility === "public")
   - Delete: DELETE /v1/files/{id}
6. Activity & Security Logs (Admin): GET /v1/logs

## Authentication Overview
- Application Requests: Send project API key in \`Authorization: Bearer nx_sk_...\` or \`X-API-Key: nx_sk_...\`.
- Admin Requests: Send Supabase Auth token in \`Authorization: Bearer <token>\`.
- Public File Requests: No authentication header needed for \`GET /v1/public/files/{id}\`.

## Critical Security & Implementation Rules for AI Assistants
1. NEVER invent endpoints, query parameters, or response fields. Use only the routes listed in /openapi.json and /llms-full.txt.
2. NEVER embed secret API keys (\`nx_sk_...\`), Supabase secret keys, or R2 credentials in public HTML, React frontends, mobile apps, or Unity game builds.
3. NEVER pass a client-supplied \`project_id\` to claim authorization — NEXUS always derives the authorized project from the validated \`nx_sk_...\` API key on the server.
4. Every JSON response follows the envelope: \`{ "success": boolean, "data": object|null, "meta": { "request_id": "uuid", "version": "v1" }, "error": { "code": string, "message": string }|null }\`.
`;

  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function handleLlmsFullTxt(url) {
  const origin = url.origin;
  const text = `# NEXUS — Complete AI & Developer Documentation (/llms-full.txt)

Base URL: ${origin}
API Version: v1
OpenAPI Spec: ${origin}/openapi.json
Index: ${origin}/llms.txt

---

## 1. AI Coding Assistant Integration Guide

When asked to integrate NEXUS into an application (such as YATA, LEDGED, BeginAgain, a Unity game, a Laravel backend, or a Python script), follow these 8 steps:

### Step 1: Discover Available NEXUS Services
Fetch \`${origin}/llms.txt\` or \`${origin}/openapi.json\` first. NEXUS currently provides:
- Project API key verification (\`GET /v1/me\`)
- File and image storage on Cloudflare R2 (\`POST /v1/files/upload\`, \`GET /v1/files\`, \`GET /v1/files/{id}\`, \`PATCH /v1/files/{id}\`, \`GET /v1/files/{id}/content\`, \`DELETE /v1/files/{id}\`, \`GET /v1/public/files/{id}\`)
- Administrative project, key, and log management (\`/v1/projects\`, \`/v1/keys\`, \`/v1/logs\`)

### Step 2: Retrieve Endpoint Documentation
Use the endpoint specifications in this document or \`${origin}/openapi.json\`. Do not guess or hallucinate unimplemented routes.

### Step 3: Select the Correct Integration Method
- **Server-side JavaScript / Node.js / Cloudflare Workers:** Use the official lightweight JS SDK (\`sdks/js\`) or native \`fetch\`.
- **PHP / Laravel backends:** Use Laravel \`Http::withToken(env('NEXUS_API_KEY'))\` or PHP \`curl\`.
- **Python backends / scripts:** Use \`requests\` with \`Authorization: Bearer <NEXUS_API_KEY>\`.
- **Public Frontends (React, HTML) & Unity Games:**
  - For uploading or managing private files: route requests through your own backend server holding \`NEXUS_API_KEY\`.
  - For displaying or downloading public assets: fetch \`${origin}/v1/public/files/{id}\` directly without any API key.

### Step 4: Authenticate Securely
- Store \`NEXUS_API_KEY=nx_sk_...\` in server environment variables (\`.env\`), never in source control.
- Pass \`Authorization: Bearer nx_sk_...\` (or \`X-API-Key: nx_sk_...\`).
- NEXUS automatically resolves the project from the API key hash.

### Step 5: Standard Response Envelope & Error Handling
All JSON endpoints return:
\`\`\`json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "uuid",
    "version": "v1"
  },
  "error": null
}
\`\`\`
On failure (\`HTTP 4xx\` or \`5xx\`):
\`\`\`json
{
  "success": false,
  "data": null,
  "meta": {
    "request_id": "uuid",
    "version": "v1"
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation."
  }
}
\`\`\`
Always check both \`response.ok\` and \`payload.success === true\`. Log \`payload.meta.request_id\` when debugging errors.

### Step 6: Test the Integration
1. Call \`GET ${origin}/v1/health\` to confirm \`status: "ok"\` and \`database: "ok"\`.
2. Call \`GET ${origin}/v1/me\` with \`Authorization: Bearer YOUR_API_KEY\` to confirm the key resolves to the expected project \`slug\`.

### Step 7: Security Practices That Must Never Be Violated
- NEVER put \`nx_sk_...\` keys in frontend JavaScript bundles, HTML files, mobile binaries, or Unity builds.
- NEVER expose \`SUPABASE_SECRET_KEY\`.
- NEVER trust a client-provided \`project_id\`.

---

## 2. Complete Endpoint Reference (v1)

### GET /v1/health
- Auth: None
- Response \`200\`: \`{ status: "ok" | "degraded", service: "nexus-api", database: "ok" | "error" | "not_configured", time: "ISO-8601" }\`

### GET /v1/me
- Auth: Project API Key (\`Authorization: Bearer nx_sk_...\`)
- Response \`200\`: \`{ project: { id, name, slug, description, status, created_at }, api_key: { id, name, key_prefix } }\`
- Errors: \`401 MISSING_API_KEY\`, \`401 INVALID_API_KEY\`, \`401 REVOKED_API_KEY\`, \`403 PROJECT_ARCHIVED\`

### POST /v1/files/upload
- Auth: Project API Key (\`Authorization: Bearer nx_sk_...\`)
- Content-Type: \`multipart/form-data\`
- Fields:
  - \`file\` (required): Binary file up to 25 MB. Allowed MIME types: \`image/jpeg\`, \`image/png\`, \`image/webp\`, \`image/gif\`, \`image/svg+xml\`, \`image/avif\`, \`application/pdf\`, \`application/json\`, \`text/plain\`, \`text/csv\`, \`audio/mpeg\`, \`audio/wav\`, \`audio/ogg\`, \`audio/mp4\`, \`application/zip\`, \`application/octet-stream\`.
  - \`visibility\` (optional): \`"private"\` (default) or \`"public"\`.
- Response \`201\`:
\`\`\`json
{
  "file": {
    "id": "uuid",
    "project_id": "uuid",
    "original_filename": "photo.png",
    "storage_key": "project-slug/uuid/photo.png",
    "mime_type": "image/png",
    "size_bytes": 12345,
    "visibility": "public",
    "created_at": "ISO-8601",
    "content_url": "${origin}/v1/files/uuid/content",
    "public_url": "${origin}/v1/public/files/uuid"
  }
}
\`\`\`

### GET /v1/files
- Auth: Project API Key (scoped to project) or Admin Bearer Token
- Query Params: \`visibility\` (\`private\`|\`public\`), \`limit\` (\`1..100\`), \`project_id\` (Admin only)
- Response \`200\`: \`{ files: [ MediaAsset ] }\`

### GET /v1/files/{id}
- Auth: Project API Key (must own file) or Admin Bearer Token
- Response \`200\`: \`{ file: MediaAsset }\`

### PATCH /v1/files/{id}
- Auth: Project API Key (must own file) or Admin Bearer Token
- Body: \`{ "visibility": "public" | "private" }\`
- Response \`200\`: \`{ file: MediaAsset }\`

### GET /v1/files/{id}/content
- Auth: Project API Key (must own file) or Admin Bearer Token
- Response \`200\`: Raw binary stream with \`Content-Type\`, \`Content-Disposition\`, and \`Cache-Control: private, no-store\`.

### GET /v1/public/files/{id}
- Auth: None (Public)
- Response \`200\`: Raw binary stream if \`visibility === "public"\` and project \`status === "active"\`. Otherwise \`404 RESOURCE_NOT_FOUND\`.

### DELETE /v1/files/{id}
- Auth: Project API Key (must own file) or Admin Bearer Token
- Response \`200\`: \`{ deleted: true, id: "uuid" }\`

### Admin Endpoints (Require Supabase Auth Bearer Token from ADMIN_USER_IDS)
- \`GET /v1/admin/me\` -> \`{ id, email }\`
- \`GET /v1/projects\` -> \`{ projects: [...] }\`
- \`POST /v1/projects\` -> Body: \`{ name, slug?, description? }\` -> \`201 { project }\`
- \`GET /v1/projects/{id}\` -> \`{ project }\`
- \`PATCH /v1/projects/{id}\` -> Body: \`{ name?, description?, status? }\` -> \`{ project }\`
- \`POST /v1/projects/{id}/keys\` -> Body: \`{ name }\` -> \`201 { api_key: { ..., secret_key } }\`
- \`GET /v1/projects/{id}/keys\` -> \`{ api_keys: [...] }\`
- \`DELETE /v1/keys/{id}\` -> \`{ api_key }\`
- \`GET /v1/logs?project_id=&limit=50\` -> \`{ logs: [...] }\`

---

## 3. Verified Copy-Paste Integration Examples

### JavaScript / Node.js (Fetch API — File Upload)
\`\`\`js
const form = new FormData();
form.append("file", fileBlob, "avatar.png");
form.append("visibility", "public");

const res = await fetch("${origin}/v1/files/upload", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.NEXUS_API_KEY}\` },
  body: form,
});
const json = await res.json();
if (!res.ok || !json.success) throw new Error(json.error?.message);
console.log("Public URL:", json.data.file.public_url);
\`\`\`

### Laravel (PHP — File Upload)
\`\`\`php
use Illuminate\\Support\\Facades\\Http;

$response = Http::withToken(config('services.nexus.key'))
    ->attach('file', file_get_contents($path), 'avatar.png')
    ->post('${origin}/v1/files/upload', ['visibility' => 'public']);

if ($response->failed() || !$response->json('success')) {
    throw new \\RuntimeException($response->json('error.message', 'Upload failed'));
}
$file = $response->json('data.file');
\`\`\`

### Python (requests — File Upload)
\`\`\`python
import os, requests

with open("avatar.png", "rb") as f:
    r = requests.post(
        "${origin}/v1/files/upload",
        headers={"Authorization": f"Bearer {os.environ['NEXUS_API_KEY']}"},
        files={"file": ("avatar.png", f, "image/png")},
        data={"visibility": "public"},
        timeout=30,
    )
payload = r.json()
assert r.ok and payload["success"], payload.get("error")
print(payload["data"]["file"]["public_url"])
\`\`\`

### C# / Unity (Downloading a Public Texture Asset)
\`\`\`csharp
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

public class NexusPublicTextureLoader : MonoBehaviour
{
    public IEnumerator LoadTexture(string fileId, System.Action<Texture2D> onLoaded)
    {
        string url = $"${origin}/v1/public/files/{fileId}";
        using UnityWebRequest req = UnityWebRequestTexture.GetTexture(url);
        yield return req.SendWebRequest();

        if (req.result == UnityWebRequest.Result.Success)
        {
            onLoaded?.Invoke(DownloadHandlerTexture.GetContent(req));
        }
        else
        {
            Debug.LogError($"NEXUS download failed: {req.error}");
        }
    }
}
\`\`\`
`;

  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

