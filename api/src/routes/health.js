import { success } from "../response.js";
import { getSupabase } from "../supabase.js";

// GET /v1/health — checks that the API is running and can reach the database.
export async function handleHealth(requestId, env) {
  const database = await checkDatabase(env);

  return success(requestId, {
    status: database === "ok" ? "ok" : "degraded",
    service: "nexus-api",
    database,
    time: new Date().toISOString(),
  });
}

// Returns "ok", "not_configured" (secrets missing) or "error".
async function checkDatabase(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return "not_configured";
  }

  try {
    // Cheapest possible query: count rows without returning any data.
    const supabase = getSupabase(env);
    const { error } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("Health check database error:", error.message);
      return "error";
    }
    return "ok";
  } catch (err) {
    console.error("Health check database error:", err);
    return "error";
  }
}
