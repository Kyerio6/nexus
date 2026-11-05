// Helpers that build every NEXUS JSON response in the same shape:
// { success, data, meta: { request_id, version }, error }

const API_VERSION = "v1";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Use for successful responses.
export function success(requestId, data, status = 200) {
  return jsonResponse(
    {
      success: true,
      data,
      meta: { request_id: requestId, version: API_VERSION },
      error: null,
    },
    status
  );
}

// Use for errors. `code` is a short machine-readable string, e.g. "RESOURCE_NOT_FOUND".
export function error(requestId, status, code, message) {
  return jsonResponse(
    {
      success: false,
      data: null,
      meta: { request_id: requestId, version: API_VERSION },
      error: { code, message },
    },
    status
  );
}

