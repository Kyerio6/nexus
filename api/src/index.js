// NEXUS API — entry point.
// Every request comes in through fetch() below and is sent to the matching route.

import { success, error } from "./response.js";
import { requireAdmin } from "./auth.js";
import { handleHealth } from "./routes/health.js";
import {
  handleListProjects,
  handleCreateProject,
  handleGetProject,
  handleUpdateProject,
} from "./routes/projects.js";

export default {
  async fetch(request, env) {
    // A unique ID for this request, returned in every response. Useful for debugging.
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    try {
      if (method === "GET" && path === "/v1/health") {
        return await handleHealth(requestId, env);
      }

      // Returns the logged-in admin. Used to confirm a login works.
      if (method === "GET" && path === "/v1/admin/me") {
        const { user, response } = await requireAdmin(request, env, requestId);
        if (response) return response;
        return success(requestId, { id: user.id, email: user.email });
      }

      // Admin routes: /v1/projects
      if (path === "/v1/projects" && (method === "GET" || method === "POST")) {
        const { response } = await requireAdmin(request, env, requestId);
        if (response) return response;

        if (method === "GET") return await handleListProjects(requestId, env);
        if (method === "POST") return await handleCreateProject(request, requestId, env);
      }

      // Admin routes: /v1/projects/{id}
      const projectMatch = path.match(/^\/v1\/projects\/([^/]+)$/);
      if (projectMatch && (method === "GET" || method === "PATCH")) {
        const { response } = await requireAdmin(request, env, requestId);
        if (response) return response;

        const projectId = projectMatch[1];
        if (method === "GET") return await handleGetProject(projectId, requestId, env);
        if (method === "PATCH") return await handleUpdateProject(request, projectId, requestId, env);
      }

      return error(requestId, 404, "ROUTE_NOT_FOUND", "The requested route does not exist.");
    } catch (err) {
      // Log the real error for us; never send internal details to the caller.
      console.error(`[${requestId}]`, err);
      return error(requestId, 500, "INTERNAL_ERROR", "An unexpected error occurred.");
    }
  },
};
