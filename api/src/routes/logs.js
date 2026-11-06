import { getSupabase } from "../supabase.js";
import { success, error } from "../response.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Records an administrative or security event in activity_logs.
// Never throws: if logging fails, it prints a warning so the main request still succeeds.
export async function logActivity(
  env,
  { projectId = null, actorType, actorId = null, action, details = {} }
) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return;

  try {
    const supabase = getSupabase(env);
    const { error: dbError } = await supabase.from("activity_logs").insert({
      project_id: projectId,
      actor_type: actorType,
      actor_id: actorId,
      action,
      details,
    });

    if (dbError) {
      console.warn("logActivity warning:", dbError.message);
    }
  } catch (err) {
    console.warn("logActivity error:", err);
  }
}

// GET /v1/logs — list recent activity logs (optional ?project_id= and ?limit=).
export async function handleListLogs(url, requestId, env) {
  const projectId = url.searchParams.get("project_id");
  if (projectId && !UUID_REGEX.test(projectId)) {
    return error(requestId, 400, "INVALID_ID", "project_id must be a valid UUID.");
  }

  const rawLimit = url.searchParams.get("limit");
  let limit = 50;
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      return error(
        requestId,
        400,
        "VALIDATION_ERROR",
        "limit must be a whole number between 1 and 100."
      );
    }
    limit = parsed;
  }

  const supabase = getSupabase(env);
  let query = supabase
    .from("activity_logs")
    .select("id, project_id, actor_type, actor_id, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    console.error(`[${requestId}] listLogs error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not fetch activity logs.");
  }

  return success(requestId, { logs: data });
}

