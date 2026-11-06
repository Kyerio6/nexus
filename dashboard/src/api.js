// Helper for calling the NEXUS REST API from the developer dashboard.
// Automatically attaches the logged-in admin's Bearer token.

export const API_BASE_URL = (
  import.meta.env.VITE_NEXUS_API_URL || "http://localhost:8787"
).replace(/\/+$/, "");

export async function apiRequest(path, { method = "GET", token = null, body = null } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let payload = undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== null && body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: payload,
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    const message = json?.error?.message || `Request failed (HTTP ${response.status})`;
    const err = new Error(message);
    err.code = json?.error?.code || "HTTP_ERROR";
    err.status = response.status;
    throw err;
  }

  return json.data;
}
