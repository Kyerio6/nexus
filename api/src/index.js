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

async function routeRequest(request, url, method, path, requestId, env) {
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

  return error(requestId, 404, "ROUTE_NOT_FOUND", "The requested route does not exist.");
}
