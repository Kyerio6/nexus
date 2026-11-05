import { getSupabase } from "../supabase.js";
import { hashApiKey } from "../auth.js";
import { success, error } from "../response.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Generates a new secret API key: "nx_sk_" + 64 random hex characters (32 bytes).
function generateSecretKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `nx_sk_${hex}`;
}

// POST /v1/projects/{id}/keys — generate a new API key for a project.
// The full secret key is returned ONLY in this response and is never stored.
export async function handleCreateKey(request, projectId, requestId, env) {
  if (!UUID_REGEX.test(projectId)) {
    return error(requestId, 400, "INVALID_ID", "Project ID must be a valid UUID.");
  }

  let body;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return error(requestId, 400, "INVALID_BODY", "Request body must be a JSON object.");
    }
  } catch {
    return error(requestId, 400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 100) {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "Key name is required and must be between 1 and 100 characters."
    );
  }

  const supabase = getSupabase(env);

  // Confirm the project exists before creating a key for it.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, status")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    console.error(`[${requestId}] createKey project check error:`, projectError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not verify project.");
  }

  if (!project) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "Project not found.");
  }

  const secretKey = generateSecretKey();
  const keyPrefix = secretKey.slice(0, 14); // e.g. "nx_sk_a1b2c3d4"
  const keyHash = await hashApiKey(secretKey);

  const { data, error: dbError } = await supabase
    .from("api_keys")
    .insert({
      project_id: projectId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
    })
    .select("id, project_id, name, key_prefix, created_at, last_used_at, revoked_at")
    .single();

  if (dbError) {
    console.error(`[${requestId}] createKey insert error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not create API key.");
  }

  return success(
    requestId,
    {
      api_key: {
        ...data,
        secret_key: secretKey,
      },
    },
    201
  );
}

// GET /v1/projects/{id}/keys — list all API keys (metadata only) for a project.
export async function handleListKeys(projectId, requestId, env) {
  if (!UUID_REGEX.test(projectId)) {
    return error(requestId, 400, "INVALID_ID", "Project ID must be a valid UUID.");
  }

  const supabase = getSupabase(env);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    console.error(`[${requestId}] listKeys project check error:`, projectError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not verify project.");
  }

  if (!project) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "Project not found.");
  }

  const { data, error: dbError } = await supabase
    .from("api_keys")
    .select("id, project_id, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (dbError) {
    console.error(`[${requestId}] listKeys error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not fetch API keys.");
  }

  return success(requestId, { api_keys: data });
}

// DELETE /v1/keys/{id} — revoke an API key by setting revoked_at.
export async function handleRevokeKey(keyId, requestId, env) {
  if (!UUID_REGEX.test(keyId)) {
    return error(requestId, 400, "INVALID_ID", "Key ID must be a valid UUID.");
  }

  const supabase = getSupabase(env);

  const { data: existing, error: findError } = await supabase
    .from("api_keys")
    .select("id, project_id, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("id", keyId)
    .maybeSingle();

  if (findError) {
    console.error(`[${requestId}] revokeKey lookup error:`, findError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not look up API key.");
  }

  if (!existing) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "API key not found.");
  }

  if (existing.revoked_at) {
    return success(requestId, { api_key: existing });
  }

  const { data, error: updateError } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .select("id, project_id, name, key_prefix, created_at, last_used_at, revoked_at")
    .single();

  if (updateError) {
    console.error(`[${requestId}] revokeKey update error:`, updateError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not revoke API key.");
  }

  return success(requestId, { api_key: data });
}
