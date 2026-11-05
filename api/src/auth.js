import { getSupabase } from "./supabase.js";
import { error } from "./response.js";

// Computes the SHA-256 hex digest of an API key string.
export async function hashApiKey(rawKey) {
  const bytes = new TextEncoder().encode(rawKey);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Checks that the request comes from a logged-in NEXUS admin.
//
// The dashboard sends the Supabase login token in the header:
//   Authorization: Bearer <token>
//
// Returns { user } when allowed, or { response } containing the error to send back.
export async function requireAdmin(request, env, requestId) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return { response: error(requestId, 401, "UNAUTHORIZED", "Missing login token.") };
  }

  // Ask Supabase whether this token is real and not expired.
  const supabase = getSupabase(env);
  const { data, error: authError } = await supabase.auth.getUser(token);

  if (authError || !data?.user) {
    return { response: error(requestId, 401, "UNAUTHORIZED", "Invalid or expired login token.") };
  }

  // A valid login is not enough: the user must be on the admin list.
  // ADMIN_USER_IDS is a comma-separated list of Supabase user IDs.
  const adminIds = (env.ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!adminIds.includes(data.user.id)) {
    return { response: error(requestId, 403, "FORBIDDEN", "You do not have admin access.") };
  }

  return { user: data.user };
}

// Checks that the request has a valid, non-revoked project API key.
//
// Applications can send the key in either header:
//   Authorization: Bearer nx_sk_...
//   X-API-Key: nx_sk_...
//
// Never trusts a client-supplied project ID: the authorized project is always
// derived from the validated API key.
//
// Returns { project, apiKey } when allowed, or { response } with the error.
export async function requireApiKey(request, env, requestId) {
  const authHeader = request.headers.get("Authorization") || "";
  const bearerKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerKey = (request.headers.get("X-API-Key") || "").trim();
  const rawKey = bearerKey || headerKey;

  if (!rawKey) {
    return { response: error(requestId, 401, "MISSING_API_KEY", "Missing API key.") };
  }

  if (!rawKey.startsWith("nx_sk_")) {
    return { response: error(requestId, 401, "INVALID_API_KEY", "Invalid API key.") };
  }

  const keyHash = await hashApiKey(rawKey);
  const supabase = getSupabase(env);

  const { data, error: dbError } = await supabase
    .from("api_keys")
    .select(
      "id, name, key_prefix, project_id, revoked_at, projects ( id, name, slug, description, status, created_at )"
    )
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (dbError) {
    console.error(`[${requestId}] requireApiKey error:`, dbError.message);
    return { response: error(requestId, 500, "DATABASE_ERROR", "Could not verify API key.") };
  }

  if (!data) {
    return { response: error(requestId, 401, "INVALID_API_KEY", "Invalid API key.") };
  }

  if (data.revoked_at) {
    return { response: error(requestId, 401, "REVOKED_API_KEY", "This API key has been revoked.") };
  }

  if (!data.projects || data.projects.status !== "active") {
    return {
      response: error(
        requestId,
        403,
        "PROJECT_ARCHIVED",
        "The project associated with this API key is archived."
      ),
    };
  }

  // Record when the key was last used.
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    project: data.projects,
    apiKey: {
      id: data.id,
      name: data.name,
      key_prefix: data.key_prefix,
    },
  };
}
