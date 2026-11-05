// NEXUS API — entry point.
// Every request comes in through fetch() below and is sent to the matching route.

import { error } from "./response.js";
import { handleHealth } from "./routes/health.js";

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

      return error(requestId, 404, "ROUTE_NOT_FOUND", "The requested route does not exist.");
    } catch (err) {
      // Log the real error for us; never send internal details to the caller.
      console.error(`[${requestId}]`, err);
      return error(requestId, 500, "INTERNAL_ERROR", "An unexpected error occurred.");
    }
  },
};

