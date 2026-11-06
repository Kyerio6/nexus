// NEXUS API — entry point.
// Every request comes in through fetch() below and is sent to the matching route.

import { success, error } from "./response.js";
import { requireAdmin, requireApiKey } from "./auth.js";
import { checkRateLimit, handleCorsPreflight, withCors } from "./security.js";
import { handleHealth } from "./routes/health.js";
import {
  handleListProjects,
  handleCreateProject,
  handleGetProject,
  handleUpdateProject,
} from "./routes/projects.js";
import {
  handleCreateKey,
  handleListKeys,
  handleRevokeKey,
} from "./routes/keys.js";
import { handleListLogs } from "./routes/logs.js";
import {
  handleUploadFile,
  handleListFiles,
  handleGetFile,
  handleUpdateFileVisibility,
  handleDownloadFile,
  handlePublicFile,
  handleDeleteFile,
} from "./routes/files.js";
import {
  handleOpenApi,
  handleLlmsTxt,
  handleLlmsFullTxt,
} from "./routes/docs.js";

export default {
  async fetch(request, env) {
    // Handle browser CORS preflight requests first.
    if (request.method === "OPTIONS") {
      return handleCorsPreflight(request, env);
    }

    // A unique ID for this request, returned in every response. Useful for debugging.
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    try {
      // Apply rate limiting before running route handlers.
      const rateLimited = await checkRateLimit(request, env, requestId);
      if (rateLimited) return withCors(rateLimited, request, env);

      const response = await routeRequest(request, url, method, path, requestId, env);
      return withCors(response, request, env);
    } catch (err) {
      // Log the real error for us; never send internal details to the caller.
      console.error(`[${requestId}]`, err);
      return withCors(
        error(requestId, 500, "INTERNAL_ERROR", "An unexpected error occurred."),
        request,
        env
      );
    }
  },
};

// Allows either a project API key ("nx_sk_...") or a logged-in admin token.
async function requireApiKeyOrAdmin(request, env, requestId) {
  const authHeader = request.headers.get("Authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const hasApiKeyHeader = Boolean((request.headers.get("X-API-Key") || "").trim());

  if (hasApiKeyHeader || bearer.startsWith("nx_sk_")) {
    const { project, apiKey, response } = await requireApiKey(request, env, requestId);
    if (response) return { response };
    return { caller: { type: "api_key", project, apiKey } };
  }

  const { user, response } = await requireAdmin(request, env, requestId);
  if (response) return { response };
  return { caller: { type: "admin", user } };
}

async function routeRequest(request, url, method, path, requestId, env) {
  if (method === "GET" && path === "/openapi.json") {
    return handleOpenApi(url);
  }
  if (method === "GET" && path === "/llms.txt") {
    return handleLlmsTxt(url);
  }
  if (method === "GET" && path === "/llms-full.txt") {
    return handleLlmsFullTxt(url);
  }

  if (method === "GET" && path === "/v1/health") {
    return await handleHealth(requestId, env);
  }

  // Returns the logged-in admin. Used to confirm a login works.
  if (method === "GET" && path === "/v1/admin/me") {
    const { user, response } = await requireAdmin(request, env, requestId);
    if (response) return response;
    return success(requestId, { id: user.id, email: user.email });
  }

  // Application route: returns the project associated with the caller's API key.
  if (method === "GET" && path === "/v1/me") {
    const { project, apiKey, response } = await requireApiKey(request, env, requestId);
    if (response) return response;
    return success(requestId, { project, api_key: apiKey });
  }

  // Admin routes: /v1/projects
  if (path === "/v1/projects" && (method === "GET" || method === "POST")) {
    const { user, response } = await requireAdmin(request, env, requestId);
    if (response) return response;

    if (method === "GET") return await handleListProjects(requestId, env);
    if (method === "POST") return await handleCreateProject(request, requestId, env, user.id);
  }

  // Admin routes: /v1/projects/{id}
  const projectMatch = path.match(/^\/v1\/projects\/([^/]+)$/);
  if (projectMatch && (method === "GET" || method === "PATCH")) {
    const { user, response } = await requireAdmin(request, env, requestId);
    if (response) return response;

    const projectId = projectMatch[1];
    if (method === "GET") return await handleGetProject(projectId, requestId, env);
    if (method === "PATCH") {
      return await handleUpdateProject(request, projectId, requestId, env, user.id);
    }
  }

  // Admin routes: /v1/projects/{id}/keys
  const projectKeysMatch = path.match(/^\/v1\/projects\/([^/]+)\/keys$/);
  if (projectKeysMatch && (method === "GET" || method === "POST")) {
    const { user, response } = await requireAdmin(request, env, requestId);
    if (response) return response;

    const projectId = projectKeysMatch[1];
    if (method === "GET") return await handleListKeys(projectId, requestId, env);
    if (method === "POST") {
      return await handleCreateKey(request, projectId, requestId, env, user.id);
    }
  }

  // Admin routes: /v1/keys/{id}
  const keyMatch = path.match(/^\/v1\/keys\/([^/]+)$/);
  if (keyMatch && method === "DELETE") {
    const { user, response } = await requireAdmin(request, env, requestId);
    if (response) return response;

    return await handleRevokeKey(keyMatch[1], requestId, env, user.id);
  }

  // Admin routes: /v1/logs
  if (path === "/v1/logs" && method === "GET") {
    const { response } = await requireAdmin(request, env, requestId);
    if (response) return response;

    return await handleListLogs(url, requestId, env);
  }

  // File routes: POST /v1/files/upload (API key)
  if (path === "/v1/files/upload" && method === "POST") {
    const { project, apiKey, response } = await requireApiKey(request, env, requestId);
    if (response) return response;

    return await handleUploadFile(request, project, apiKey, url.origin, requestId, env);
  }

  // File routes: GET /v1/files (API key or Admin)
  if (path === "/v1/files" && method === "GET") {
    const { caller, response } = await requireApiKeyOrAdmin(request, env, requestId);
    if (response) return response;

    return await handleListFiles(url, caller, requestId, env);
  }

  // File routes: GET /v1/files/{id}/content (API key or Admin)
  const fileContentMatch = path.match(/^\/v1\/files\/([^/]+)\/content$/);
  if (fileContentMatch && method === "GET") {
    const { caller, response } = await requireApiKeyOrAdmin(request, env, requestId);
    if (response) return response;

    return await handleDownloadFile(fileContentMatch[1], caller, requestId, env);
  }

  // File routes: GET, PATCH, DELETE /v1/files/{id} (API key or Admin)
  const fileMatch = path.match(/^\/v1\/files\/([^/]+)$/);
  if (fileMatch && fileMatch[1] !== "upload" && ["GET", "PATCH", "DELETE"].includes(method)) {
    const { caller, response } = await requireApiKeyOrAdmin(request, env, requestId);
    if (response) return response;

    const fileId = fileMatch[1];
    if (method === "GET") return await handleGetFile(fileId, caller, url.origin, requestId, env);
    if (method === "PATCH") {
      return await handleUpdateFileVisibility(request, fileId, caller, url.origin, requestId, env);
    }
    if (method === "DELETE") return await handleDeleteFile(fileId, caller, requestId, env);
  }

  // Public file route: GET /v1/public/files/{id} (no auth required; only serves 'public' files)
  const publicFileMatch = path.match(/^\/v1\/public\/files\/([^/]+)$/);
  if (publicFileMatch && method === "GET") {
    return await handlePublicFile(publicFileMatch[1], requestId, env);
  }

  return error(requestId, 404, "ROUTE_NOT_FOUND", "The requested route does not exist.");
}
