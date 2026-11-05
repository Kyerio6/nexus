import { getSupabase } from "./supabase.js";
import { error } from "./response.js";

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

