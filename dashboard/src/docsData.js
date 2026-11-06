// Complete endpoint catalog and multi-language code example generator for NEXUS.
// Synchronized with every implemented route in api/src/index.js.

export const CODE_LANGUAGES = [
  { id: "fetch", label: "JavaScript (Fetch)" },
  { id: "html", label: "HTML + Vanilla JS" },
  { id: "react", label: "React" },
  { id: "php", label: "PHP" },
  { id: "laravel", label: "Laravel" },
  { id: "python", label: "Python" },
  { id: "unity", label: "C# / Unity" },
];

export function buildCodeExample(endpoint, lang, baseUrl) {
  const fullUrl = `${baseUrl}${endpoint.examplePath || endpoint.path}`;
  const isUpload = endpoint.id === "upload-file";
  const authTokenPlaceholder =
    endpoint.authType === "admin"
      ? "YOUR_SUPABASE_ADMIN_ACCESS_TOKEN"
      : endpoint.authType === "api_key"
      ? "YOUR_API_KEY"
      : null;

  const hasBody = Boolean(endpoint.sampleRequestBody) && !isUpload;
  const bodyJson = hasBody ? JSON.stringify(endpoint.sampleRequestBody, null, 2) : null;

  if (lang === "fetch") {
    if (isUpload) {
      return `// Server-side or local test script using the Fetch API
const NEXUS_URL = "${baseUrl}";
const API_KEY = "YOUR_API_KEY"; // Never expose nx_sk_ secret keys in public frontend code

async function uploadFile(fileInput) {
  const formData = new FormData();
  formData.append("file", fileInput);
  formData.append("visibility", "private"); // "private" or "public"

  const response = await fetch(\`\${NEXUS_URL}/v1/files/upload\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${API_KEY}\`,
    },
    body: formData,
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message || \`Upload failed (\${response.status})\`);
  }

  console.log("Uploaded file:", result.data.file);
  return result.data.file;
}`;
    }

    const headersLines = [];
    if (authTokenPlaceholder) {
      headersLines.push(`      Authorization: "Bearer ${authTokenPlaceholder}",`);
    }
    if (hasBody) {
      headersLines.push(`      "Content-Type": "application/json",`);
    }

    return `const response = await fetch("${fullUrl}", {
  method: "${endpoint.method}",${
      headersLines.length
        ? `\n  headers: {\n${headersLines.join("\n")}\n  },`
        : ""
    }${
      hasBody
        ? `\n  body: JSON.stringify(${JSON.stringify(endpoint.sampleRequestBody)}),`
        : ""
    }
});

if (response.headers.get("content-type")?.includes("application/json")) {
  const result = await response.json();
  if (!response.ok || !result.success) {
    console.error("NEXUS API Error:", result.error);
  } else {
    console.log("Success:", result.data);
  }
} else {
  const blob = await response.blob();
  console.log("Received binary file:", blob.type, blob.size, "bytes");
}`;
  }

  if (lang === "html") {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NEXUS API Example — ${endpoint.title}</title>
</head>
<body>
  <!-- SECURITY WARNING: Do not put nx_sk_ secret keys in public HTML pages.
       Use this snippet only for local testing or public endpoints. -->
  <button id="runBtn">Call ${endpoint.method} ${endpoint.path}</button>
  <pre id="output">Click the button to run...</pre>

  <script>
    document.getElementById("runBtn").addEventListener("click", async () => {
      const output = document.getElementById("output");
      try {
        const response = await fetch("${fullUrl}", {
          method: "${endpoint.method}",${
      authTokenPlaceholder || hasBody
        ? `\n          headers: {${
            authTokenPlaceholder ? `\n            "Authorization": "Bearer ${authTokenPlaceholder}",` : ""
          }${hasBody ? `\n            "Content-Type": "application/json",` : ""}\n          },`
        : ""
    }${hasBody ? `\n          body: JSON.stringify(${JSON.stringify(endpoint.sampleRequestBody)}),` : ""}
        });
        const data = await response.json();
        output.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        output.textContent = "Error: " + err.message;
      }
    });
  </script>
</body>
</html>`;
  }

  if (lang === "react") {
    return `import { useState } from "react";

// SECURITY NOTE: Secret API keys (nx_sk_...) must stay on your backend server.
// Have your React frontend call your own backend, or only call public NEXUS URLs directly.
export default function NexusExample() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function callNexus() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("${fullUrl}", {
        method: "${endpoint.method}",${
      authTokenPlaceholder || hasBody
        ? `\n        headers: {${
            authTokenPlaceholder ? `\n          Authorization: "Bearer ${authTokenPlaceholder}",` : ""
          }${hasBody ? `\n          "Content-Type": "application/json",` : ""}\n        },`
        : ""
    }${hasBody ? `\n        body: JSON.stringify(${JSON.stringify(endpoint.sampleRequestBody)}),` : ""}
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || "Request failed");
      }
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={callNexus} disabled={loading}>
        {loading ? "Loading..." : "${endpoint.title}"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}`;
  }

  if (lang === "php") {
    if (isUpload) {
      return `<?php
$url = "${fullUrl}";
$apiKey = "YOUR_API_KEY";
$filePath = __DIR__ . "/sample.png";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . $apiKey,
    ],
    CURLOPT_POSTFIELDS => [
        "file" => new CURLFile($filePath, "image/png", "sample.png"),
        "visibility" => "private",
    ],
]);

$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result = json_decode($response, true);
if ($status >= 400 || empty($result["success"])) {
    throw new RuntimeException($result["error"]["message"] ?? "NEXUS upload failed");
}

print_r($result["data"]["file"]);`;
    }

    return `<?php
$url = "${fullUrl}";
${authTokenPlaceholder ? `$token = "${authTokenPlaceholder}";\n` : ""}$ch = curl_init($url);

$headers = [
    "Accept: application/json",${
      authTokenPlaceholder ? `\n    "Authorization: Bearer " . $token,` : ""
    }${hasBody ? `\n    "Content-Type: application/json",` : ""}
];

curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => "${endpoint.method}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => $headers,${
      hasBody
        ? `\n    CURLOPT_POSTFIELDS => json_encode(${JSON.stringify(endpoint.sampleRequestBody)}),`
        : ""
    }
]);

$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result = json_decode($response, true);
if ($status >= 400 || empty($result["success"])) {
    echo "NEXUS Error: " . ($result["error"]["message"] ?? "HTTP $status") . PHP_EOL;
} else {
    print_r($result["data"]);
}`;
  }

  if (lang === "laravel") {
    if (isUpload) {
      return `<?php

use Illuminate\\Support\\Facades\\Http;

$response = Http::withToken(config("services.nexus.key"))
    ->attach("file", file_get_contents(storage_path("app/sample.png")), "sample.png")
    ->post("${fullUrl}", [
        "visibility" => "private",
    ]);

if ($response->failed() || !$response->json("success")) {
    throw new \\RuntimeException($response->json("error.message", "NEXUS upload failed"));
}

$file = $response->json("data.file");`;
    }

    const methodCall = endpoint.method.toLowerCase();
    return `<?php

use Illuminate\\Support\\Facades\\Http;

$request = Http::acceptJson()${
      authTokenPlaceholder ? `\n    ->withToken("${authTokenPlaceholder}")` : ""
    };

$response = $request->${methodCall}("${fullUrl}"${
      hasBody ? `, ${JSON.stringify(endpoint.sampleRequestBody)}` : ""
    });

if ($response->failed() || !$response->json("success")) {
    logger()->error("NEXUS API error", ["error" => $response->json("error")]);
    abort($response->status(), $response->json("error.message", "NEXUS request failed"));
}

$data = $response->json("data");`;
  }

  if (lang === "python") {
    if (isUpload) {
      return `import requests

NEXUS_URL = "${fullUrl}"
API_KEY = "YOUR_API_KEY"

with open("sample.png", "rb") as f:
    response = requests.post(
        NEXUS_URL,
        headers={"Authorization": f"Bearer {API_KEY}"},
        files={"file": ("sample.png", f, "image/png")},
        data={"visibility": "private"},
        timeout=30,
    )

payload = response.json()
if not response.ok or not payload.get("success"):
    raise RuntimeError(payload.get("error", {}).get("message", "Upload failed"))

print("Uploaded file:", payload["data"]["file"])`;
    }

    return `import requests

url = "${fullUrl}"
headers = {${
      authTokenPlaceholder ? `\n    "Authorization": "Bearer ${authTokenPlaceholder}",` : ""
    }${hasBody ? `\n    "Content-Type": "application/json",` : ""}
}

response = requests.request(
    "${endpoint.method}",
    url,
    headers=headers,${hasBody ? `\n    json=${JSON.stringify(endpoint.sampleRequestBody)},` : ""}
    timeout=15,
)

payload = response.json()
if not response.ok or not payload.get("success"):
    print("Error:", payload.get("error"))
else:
    print("Success:", payload.get("data"))`;
  }

  if (lang === "unity") {
    return `using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

// SECURITY RULE: Never embed secret API keys (nx_sk_...) in shipped Unity builds.
// Route privileged operations through your game backend, or fetch public files directly.
public class NexusApiExample : MonoBehaviour
{
    private const string EndpointUrl = "${fullUrl}";

    public IEnumerator CallNexus()
    {
        using var request = new UnityWebRequest(EndpointUrl, "${endpoint.method}");
        request.downloadHandler = new DownloadHandlerBuffer();
${
  hasBody
    ? `        byte[] bodyRaw = Encoding.UTF8.GetBytes(${JSON.stringify(JSON.stringify(endpoint.sampleRequestBody))});
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.SetRequestHeader("Content-Type", "application/json");\n`
    : ""
}${
  authTokenPlaceholder
    ? `        request.SetRequestHeader("Authorization", "Bearer ${authTokenPlaceholder}");\n`
    : ""
}
        yield return request.SendWebRequest();

        if (request.result != UnityWebRequest.Result.Success)
        {
            Debug.LogError($"NEXUS HTTP {request.responseCode}: {request.downloadHandler.text}");
        }
        else
        {
            Debug.Log($"NEXUS Response: {request.downloadHandler.text}");
        }
    }
}`;
  }

  return "";
}

export const ENDPOINT_DOCS = [
  {
    id: "health",
    category: "System",
    title: "Health Check",
    method: "GET",
    path: "/v1/health",
    examplePath: "/v1/health",
    authType: "none",
    authDescription: "None (Public)",
    headers: [],
    requiredParams: [],
    optionalParams: [],
    requestBodyFormat: "None",
    description:
      "Checks whether the NEXUS Worker is running and verifies live connectivity to Supabase PostgreSQL.",
    successResponse: {
      success: true,
      data: {
        status: "ok",
        service: "nexus-api",
        database: "ok",
        time: "2026-11-06T08:00:00.000Z",
      },
      meta: { request_id: "1ecfab57-36e6-4b56-8f9e-6db007f0b198", version: "v1" },
      error: null,
    },
    errorResponses: [
      {
        status: 429,
        code: "RATE_LIMITED",
        message: "Too many requests. Please slow down.",
      },
    ],
  },
  {
    id: "admin-me",
    category: "Authentication & Identity",
    title: "Verify Admin Session",
    method: "GET",
    path: "/v1/admin/me",
    examplePath: "/v1/admin/me",
    authType: "admin",
    authDescription: "Admin (Supabase Auth Bearer token from an allow-listed ADMIN_USER_IDS user)",
    headers: [{ name: "Authorization", value: "Bearer <SUPABASE_ACCESS_TOKEN>", required: true }],
    requiredParams: [],
    optionalParams: [],
    requestBodyFormat: "None",
    description:
      "Verifies the caller's Supabase Auth token and confirms their user UID is in ADMIN_USER_IDS.",
    successResponse: {
      success: true,
      data: {
        id: "00000000-0000-0000-0000-000000000000",
        email: "admin@example.com",
      },
      meta: { request_id: "9efef7a3-3702-4bff-84fd-0ce23dede714", version: "v1" },
      error: null,
    },
    errorResponses: [
      { status: 401, code: "UNAUTHORIZED", message: "Missing, invalid, or expired login token." },
      { status: 403, code: "FORBIDDEN", message: "You do not have admin access." },
    ],
  },
  {
    id: "app-me",
    category: "Authentication & Identity",
    title: "Verify Project API Key",
    method: "GET",
    path: "/v1/me",
    examplePath: "/v1/me",
    authType: "api_key",
    authDescription: "Project API Key (Authorization: Bearer nx_sk_... or X-API-Key: nx_sk_...)",
    headers: [{ name: "Authorization", value: "Bearer YOUR_API_KEY", required: true }],
    requiredParams: [],
    optionalParams: [],
    requestBodyFormat: "None",
    description:
      "Validates a project API key, updates its last_used_at timestamp, and returns the authorized project metadata.",
    successResponse: {
      success: true,
      data: {
        project: {
          id: "b7c0c123-0000-4000-8000-000000000001",
          name: "YATA",
          slug: "yata",
          description: "Food ordering and delivery application",
          status: "active",
          created_at: "2026-11-06T08:00:00.000Z",
        },
        api_key: {
          id: "c9d1d234-0000-4000-8000-000000000002",
          name: "Production Server",
          key_prefix: "nx_sk_1518b19b",
        },
      },
      meta: { request_id: "30bd08b3-60eb-4873-a5fb-a46771a4590b", version: "v1" },
      error: null,
    },
    errorResponses: [
      { status: 401, code: "MISSING_API_KEY", message: "Missing API key." },
      { status: 401, code: "INVALID_API_KEY", message: "Invalid API key." },
      { status: 401, code: "REVOKED_API_KEY", message: "This API key has been revoked." },
      {
        status: 403,
        code: "PROJECT_ARCHIVED",
        message: "The project associated with this API key is archived.",
      },
    ],
  },
  {
    id: "list-projects",
    category: "Projects",
    title: "List Projects",
    method: "GET",
    path: "/v1/projects",
    examplePath: "/v1/projects",
    authType: "admin",
    authDescription: "Admin (Supabase Auth Bearer token)",
    headers: [{ name: "Authorization", value: "Bearer <SUPABASE_ACCESS_TOKEN>", required: true }],
    requiredParams: [],
    optionalParams: [],
    requestBodyFormat: "None",
    description: "Lists all personal projects registered in NEXUS, ordered newest first.",
    successResponse: {
      success: true,
      data: {
        projects: [
          {
            id: "b7c0c123-0000-4000-8000-000000000001",
            name: "YATA",
            slug: "yata",
            description: "Food ordering and delivery application",
            status: "active",
            created_at: "2026-11-06T08:00:00.000Z",
          },
        ],
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [
      { status: 401, code: "UNAUTHORIZED", message: "Missing login token." },
      { status: 403, code: "FORBIDDEN", message: "You do not have admin access." },
    ],
  },
  {
    id: "create-project",
    category: "Projects",
    title: "Create Project",
    method: "POST",
    path: "/v1/projects",
    examplePath: "/v1/projects",
    authType: "admin",
    authDescription: "Admin (Supabase Auth Bearer token)",
    headers: [
      { name: "Authorization", value: "Bearer <SUPABASE_ACCESS_TOKEN>", required: true },
      { name: "Content-Type", value: "application/json", required: true },
    ],
    requiredParams: [{ name: "name", in: "body", type: "string (1..100 chars)", description: "Human-readable project name" }],
    optionalParams: [
      { name: "slug", in: "body", type: "string", description: "URL-safe lowercase slug (auto-generated from name if omitted)" },
      { name: "description", in: "body", type: "string | null", description: "Optional project notes" },
    ],
    requestBodyFormat: "JSON object: { name, slug?, description? }",
    sampleRequestBody: {
      name: "YATA",
      slug: "yata",
      description: "Food ordering and delivery application",
    },
    description: "Creates a new project and logs a project.created activity event.",
    successResponse: {
      success: true,
      data: {
        project: {
          id: "b7c0c123-0000-4000-8000-000000000001",
          name: "YATA",
          slug: "yata",
          description: "Food ordering and delivery application",
          status: "active",
          created_at: "2026-11-06T08:00:00.000Z",
        },
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [
      { status: 400, code: "VALIDATION_ERROR", message: "Project name is required and must be between 1 and 100 characters." },
      { status: 409, code: "SLUG_TAKEN", message: "A project with slug 'yata' already exists." },
    ],
  },
  {
    id: "get-project",
    category: "Projects",
    title: "Get Project by ID",
    method: "GET",
    path: "/v1/projects/{id}",
    examplePath: "/v1/projects/YOUR_PROJECT_ID",
    authType: "admin",
    authDescription: "Admin (Supabase Auth Bearer token)",
    headers: [{ name: "Authorization", value: "Bearer <SUPABASE_ACCESS_TOKEN>", required: true }],
    requiredParams: [{ name: "id", in: "path", type: "UUID", description: "Project UUID" }],
    optionalParams: [],
    requestBodyFormat: "None",
    description: "Fetches a single project by its UUID.",
    successResponse: {
      success: true,
      data: {
        project: {
          id: "b7c0c123-0000-4000-8000-000000000001",
          name: "YATA",
          slug: "yata",
          description: "Food ordering and delivery application",
          status: "active",
          created_at: "2026-11-06T08:00:00.000Z",
        },
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [
      { status: 400, code: "INVALID_ID", message: "Project ID must be a valid UUID." },
      { status: 404, code: "RESOURCE_NOT_FOUND", message: "Project not found." },
    ],
  },
  {
    id: "update-project",
    category: "Projects",
    title: "Update or Archive Project",
    method: "PATCH",
    path: "/v1/projects/{id}",
    examplePath: "/v1/projects/YOUR_PROJECT_ID",
    authType: "admin",
    authDescription: "Admin (Supabase Auth Bearer token)",
    headers: [
      { name: "Authorization", value: "Bearer <SUPABASE_ACCESS_TOKEN>", required: true },
      { name: "Content-Type", value: "application/json", required: true },
    ],
    requiredParams: [{ name: "id", in: "path", type: "UUID", description: "Project UUID" }],
    optionalParams: [
      { name: "name", in: "body", type: "string", description: "Updated project name" },
      { name: "description", in: "body", type: "string | null", description: "Updated description" },
      { name: "status", in: "body", type: "'active' | 'archived'", description: "Archiving disables all API keys and public file links for the project" },
    ],
    requestBodyFormat: "JSON object: { name?, description?, status? }",
    sampleRequestBody: {
      description: "Updated project description",
      status: "active",
    },
    description: "Updates a project's name, description, or active/archived status.",
    successResponse: {
      success: true,
      data: {
        project: {
          id: "b7c0c123-0000-4000-8000-000000000001",
          name: "YATA",
          slug: "yata",
          description: "Updated project description",
          status: "active",
          created_at: "2026-11-06T08:00:00.000Z",
        },
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [
      { status: 400, code: "VALIDATION_ERROR", message: "Status must be either 'active' or 'archived'." },
      { status: 404, code: "RESOURCE_NOT_FOUND", message: "Project not found." },
    ],
  },
  {
    id: "create-key",
    category: "API Keys",
    title: "Generate Project API Key",
    method: "POST",
    path: "/v1/projects/{id}/keys",
    examplePath: "/v1/projects/YOUR_PROJECT_ID/keys",
    authType: "admin",
    authDescription: "Admin (Supabase Auth Bearer token)",
    headers: [
      { name: "Authorization", value: "Bearer <SUPABASE_ACCESS_TOKEN>", required: true },
      { name: "Content-Type", value: "application/json", required: true },
    ],
    requiredParams: [
      { name: "id", in: "path", type: "UUID", description: "Project UUID" },
      { name: "name", in: "body", type: "string (1..100 chars)", description: "Label for the API key (e.g. 'Production Server')" },
    ],
    optionalParams: [],
    requestBodyFormat: "JSON object: { name }",
    sampleRequestBody: { name: "Production Server" },
    description:
      "Generates a cryptographically random API key (nx_sk_...) for a project. Stores only its SHA-256 hash and returns the full secret_key once.",
    successResponse: {
      success: true,
      data: {
        api_key: {
          id: "c9d1d234-0000-4000-8000-000000000002",
          project_id: "b7c0c123-0000-4000-8000-000000000001",
          name: "Production Server",
          key_prefix: "nx_sk_1518b19b",
          secret_key: "nx_sk_1518b19b00000000000000000000000000000000000000000000000000000000",
          created_at: "2026-11-06T08:00:00.000Z",
          last_used_at: null,
          revoked_at: null,
        },
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [
      { status: 400, code: "VALIDATION_ERROR", message: "Key name is required and must be between 1 and 100 characters." },
      { status: 404, code: "RESOURCE_NOT_FOUND", message: "Project not found." },
    ],
  },
  {
    id: "list-keys",
    category: "API Keys",
    title: "List Project API Keys",
    method: "GET",
    path: "/v1/projects/{id}/keys",
    examplePath: "/v1/projects/YOUR_PROJECT_ID/keys",
    authType: "admin",
    authDescription: "Admin (Supabase Auth Bearer token)",
    headers: [{ name: "Authorization", value: "Bearer <SUPABASE_ACCESS_TOKEN>", required: true }],
    requiredParams: [{ name: "id", in: "path", type: "UUID", description: "Project UUID" }],
    optionalParams: [],
    requestBodyFormat: "None",
    description:
      "Lists metadata for all API keys belonging to a project. Never returns the raw secret or hash.",
    successResponse: {
      success: true,
      data: {
        api_keys: [
          {
            id: "c9d1d234-0000-4000-8000-000000000002",
            project_id: "b7c0c123-0000-4000-8000-000000000001",
            name: "Production Server",
            key_prefix: "nx_sk_1518b19b",
            created_at: "2026-11-06T08:00:00.000Z",
            last_used_at: "2026-11-06T08:15:00.000Z",
            revoked_at: null,
          },
        ],
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [{ status: 404, code: "RESOURCE_NOT_FOUND", message: "Project not found." }],
  },
  {
    id: "revoke-key",
    category: "API Keys",
    title: "Revoke API Key",
    method: "DELETE",
    path: "/v1/keys/{id}",
    examplePath: "/v1/keys/YOUR_KEY_ID",
    authType: "admin",
    authDescription: "Admin (Supabase Auth Bearer token)",
    headers: [{ name: "Authorization", value: "Bearer <SUPABASE_ACCESS_TOKEN>", required: true }],
    requiredParams: [{ name: "id", in: "path", type: "UUID", description: "API Key UUID" }],
    optionalParams: [],
    requestBodyFormat: "None",
    description: "Immediately revokes an API key by setting its revoked_at timestamp.",
    successResponse: {
      success: true,
      data: {
        api_key: {
          id: "c9d1d234-0000-4000-8000-000000000002",
          project_id: "b7c0c123-0000-4000-8000-000000000001",
          name: "Production Server",
          key_prefix: "nx_sk_1518b19b",
          created_at: "2026-11-06T08:00:00.000Z",
          last_used_at: "2026-11-06T08:15:00.000Z",
          revoked_at: "2026-11-06T08:20:00.000Z",
        },
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [{ status: 404, code: "RESOURCE_NOT_FOUND", message: "API key not found." }],
  },
  {
    id: "upload-file",
    category: "File & Media Storage",
    title: "Upload File to R2",
    method: "POST",
    path: "/v1/files/upload",
    examplePath: "/v1/files/upload",
    authType: "api_key",
    authDescription: "Project API Key (Authorization: Bearer nx_sk_... or X-API-Key: nx_sk_...)",
    headers: [{ name: "Authorization", value: "Bearer YOUR_API_KEY", required: true }],
    requiredParams: [
      { name: "file", in: "formData", type: "File (max 25 MB)", description: "Binary file to upload" },
    ],
    optionalParams: [
      {
        name: "visibility",
        in: "formData",
        type: "'private' | 'public'",
        description: "Defaults to 'private'. If 'public', the file can also be fetched via /v1/public/files/{id}.",
      },
    ],
    requestBodyFormat: "multipart/form-data with 'file' and optional 'visibility'",
    description:
      "Uploads a file to Cloudflare R2 under the key's project namespace and stores metadata in media_assets.",
    successResponse: {
      success: true,
      data: {
        file: {
          id: "dc135196-521d-4f07-b761-d13f26567652",
          project_id: "b7c0c123-0000-4000-8000-000000000001",
          original_filename: "menu-photo.png",
          storage_key: "yata/dc135196-521d-4f07-b761-d13f26567652/menu-photo.png",
          mime_type: "image/png",
          size_bytes: 184320,
          visibility: "public",
          created_at: "2026-11-06T08:30:00.000Z",
          content_url: "http://localhost:8787/v1/files/dc135196-521d-4f07-b761-d13f26567652/content",
          public_url: "http://localhost:8787/v1/public/files/dc135196-521d-4f07-b761-d13f26567652",
        },
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [
      { status: 400, code: "INVALID_FORM_DATA", message: "Request must be multipart/form-data containing a 'file' field." },
      { status: 400, code: "FILE_TOO_LARGE", message: "File exceeds the maximum allowed size of 25 MB." },
      { status: 400, code: "UNSUPPORTED_FILE_TYPE", message: "MIME type '...' is not allowed." },
    ],
  },
  {
    id: "list-files",
    category: "File & Media Storage",
    title: "List Uploaded Files",
    method: "GET",
    path: "/v1/files",
    examplePath: "/v1/files?limit=50",
    authType: "api_key",
    authDescription: "Project API Key (scoped to project) OR Admin Bearer Token (all projects)",
    headers: [{ name: "Authorization", value: "Bearer YOUR_API_KEY", required: true }],
    requiredParams: [],
    optionalParams: [
      { name: "visibility", in: "query", type: "'public' | 'private'", description: "Filter by file visibility" },
      { name: "limit", in: "query", type: "integer (1..100)", description: "Max files to return (default 50)" },
      { name: "project_id", in: "query", type: "UUID", description: "Admin only: filter by project UUID" },
    ],
    requestBodyFormat: "None",
    description:
      "Lists file metadata rows. When called with a project API key, only that project's files are returned.",
    successResponse: {
      success: true,
      data: {
        files: [
          {
            id: "dc135196-521d-4f07-b761-d13f26567652",
            project_id: "b7c0c123-0000-4000-8000-000000000001",
            original_filename: "menu-photo.png",
            storage_key: "yata/dc135196-521d-4f07-b761-d13f26567652/menu-photo.png",
            mime_type: "image/png",
            size_bytes: 184320,
            visibility: "public",
            created_at: "2026-11-06T08:30:00.000Z",
            content_url: "http://localhost:8787/v1/files/dc135196-521d-4f07-b761-d13f26567652/content",
            public_url: "http://localhost:8787/v1/public/files/dc135196-521d-4f07-b761-d13f26567652",
          },
        ],
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [{ status: 401, code: "UNAUTHORIZED", message: "Missing or invalid credentials." }],
  },
  {
    id: "get-file",
    category: "File & Media Storage",
    title: "Get File Metadata",
    method: "GET",
    path: "/v1/files/{id}",
    examplePath: "/v1/files/YOUR_FILE_ID",
    authType: "api_key",
    authDescription: "Project API Key (must own file) OR Admin Bearer Token",
    headers: [{ name: "Authorization", value: "Bearer YOUR_API_KEY", required: true }],
    requiredParams: [{ name: "id", in: "path", type: "UUID", description: "File Asset UUID" }],
    optionalParams: [],
    requestBodyFormat: "None",
    description: "Returns metadata and download URLs for a single file.",
    successResponse: {
      success: true,
      data: {
        file: {
          id: "dc135196-521d-4f07-b761-d13f26567652",
          project_id: "b7c0c123-0000-4000-8000-000000000001",
          original_filename: "menu-photo.png",
          storage_key: "yata/dc135196-521d-4f07-b761-d13f26567652/menu-photo.png",
          mime_type: "image/png",
          size_bytes: 184320,
          visibility: "public",
          created_at: "2026-11-06T08:30:00.000Z",
          content_url: "http://localhost:8787/v1/files/dc135196-521d-4f07-b761-d13f26567652/content",
          public_url: "http://localhost:8787/v1/public/files/dc135196-521d-4f07-b761-d13f26567652",
        },
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [{ status: 404, code: "RESOURCE_NOT_FOUND", message: "File not found." }],
  },
  {
    id: "update-file",
    category: "File & Media Storage",
    title: "Update File Visibility",
    method: "PATCH",
    path: "/v1/files/{id}",
    examplePath: "/v1/files/YOUR_FILE_ID",
    authType: "api_key",
    authDescription: "Project API Key (must own file) OR Admin Bearer Token",
    headers: [
      { name: "Authorization", value: "Bearer YOUR_API_KEY", required: true },
      { name: "Content-Type", value: "application/json", required: true },
    ],
    requiredParams: [
      { name: "id", in: "path", type: "UUID", description: "File Asset UUID" },
      { name: "visibility", in: "body", type: "'public' | 'private'", description: "New visibility state" },
    ],
    optionalParams: [],
    requestBodyFormat: "JSON object: { visibility: 'public' | 'private' }",
    sampleRequestBody: { visibility: "public" },
    description: "Toggles a file between private and public visibility.",
    successResponse: {
      success: true,
      data: {
        file: {
          id: "dc135196-521d-4f07-b761-d13f26567652",
          project_id: "b7c0c123-0000-4000-8000-000000000001",
          original_filename: "menu-photo.png",
          storage_key: "yata/dc135196-521d-4f07-b761-d13f26567652/menu-photo.png",
          mime_type: "image/png",
          size_bytes: 184320,
          visibility: "public",
          created_at: "2026-11-06T08:30:00.000Z",
          content_url: "http://localhost:8787/v1/files/dc135196-521d-4f07-b761-d13f26567652/content",
          public_url: "http://localhost:8787/v1/public/files/dc135196-521d-4f07-b761-d13f26567652",
        },
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [
      { status: 400, code: "VALIDATION_ERROR", message: "visibility is required and must be either 'public' or 'private'." },
      { status: 404, code: "RESOURCE_NOT_FOUND", message: "File not found." },
    ],
  },
  {
    id: "download-file",
    category: "File & Media Storage",
    title: "Download Authorized File Content",
    method: "GET",
    path: "/v1/files/{id}/content",
    examplePath: "/v1/files/YOUR_FILE_ID/content",
    authType: "api_key",
    authDescription: "Project API Key (must own file) OR Admin Bearer Token",
    headers: [{ name: "Authorization", value: "Bearer YOUR_API_KEY", required: true }],
    requiredParams: [{ name: "id", in: "path", type: "UUID", description: "File Asset UUID" }],
    optionalParams: [],
    requestBodyFormat: "None",
    description:
      "Streams the raw binary file from R2 for both private and public assets belonging to the caller's project.",
    successResponse: {
      note: "Returns raw binary bytes with Content-Type set to the file's mime_type and Cache-Control: private, no-store.",
    },
    errorResponses: [{ status: 404, code: "RESOURCE_NOT_FOUND", message: "File not found." }],
  },
  {
    id: "public-file",
    category: "File & Media Storage",
    title: "Stream Public File",
    method: "GET",
    path: "/v1/public/files/{id}",
    examplePath: "/v1/public/files/YOUR_FILE_ID",
    authType: "none",
    authDescription: "None (Public — works only when file visibility is 'public' and project is 'active')",
    headers: [],
    requiredParams: [{ name: "id", in: "path", type: "UUID", description: "File Asset UUID" }],
    optionalParams: [],
    requestBodyFormat: "None",
    description:
      "Streams a public file without authentication (suitable for <img> tags, Unity asset downloads, and public links). Returns 404 if the file is private or its project is archived.",
    successResponse: {
      note: "Returns raw binary bytes with Content-Type set to the file's mime_type and Cache-Control: public, max-age=3600.",
    },
    errorResponses: [{ status: 404, code: "RESOURCE_NOT_FOUND", message: "Public file not found." }],
  },
  {
    id: "delete-file",
    category: "File & Media Storage",
    title: "Delete File",
    method: "DELETE",
    path: "/v1/files/{id}",
    examplePath: "/v1/files/YOUR_FILE_ID",
    authType: "api_key",
    authDescription: "Project API Key (must own file) OR Admin Bearer Token",
    headers: [{ name: "Authorization", value: "Bearer YOUR_API_KEY", required: true }],
    requiredParams: [{ name: "id", in: "path", type: "UUID", description: "File Asset UUID" }],
    optionalParams: [],
    requestBodyFormat: "None",
    description: "Deletes the binary object from Cloudflare R2 and removes its row from media_assets.",
    successResponse: {
      success: true,
      data: {
        deleted: true,
        id: "dc135196-521d-4f07-b761-d13f26567652",
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [{ status: 404, code: "RESOURCE_NOT_FOUND", message: "File not found." }],
  },
  {
    id: "list-logs",
    category: "Activity Logs",
    title: "List Activity Logs",
    method: "GET",
    path: "/v1/logs",
    examplePath: "/v1/logs?limit=50",
    authType: "admin",
    authDescription: "Admin (Supabase Auth Bearer token)",
    headers: [{ name: "Authorization", value: "Bearer <SUPABASE_ACCESS_TOKEN>", required: true }],
    requiredParams: [],
    optionalParams: [
      { name: "project_id", in: "query", type: "UUID", description: "Filter events by project UUID" },
      { name: "limit", in: "query", type: "integer (1..100)", description: "Max log rows to return (default 50)" },
    ],
    requestBodyFormat: "None",
    description: "Returns recent administrative and security events across NEXUS.",
    successResponse: {
      success: true,
      data: {
        logs: [
          {
            id: "a1b2c3d4-0000-4000-8000-000000000099",
            project_id: "b7c0c123-0000-4000-8000-000000000001",
            actor_type: "admin",
            actor_id: "00000000-0000-0000-0000-000000000000",
            action: "project.created",
            details: { name: "YATA", slug: "yata" },
            created_at: "2026-11-06T08:00:00.000Z",
          },
        ],
      },
      meta: { request_id: "f1234567-89ab-4cde-8f01-234567890abc", version: "v1" },
      error: null,
    },
    errorResponses: [{ status: 401, code: "UNAUTHORIZED", message: "Missing login token." }],
  },
];
