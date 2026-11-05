import { getSupabase } from "../supabase.js";
import { success, error } from "../response.js";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Turns "Begin Again!" into "begin-again".
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Safely reads a JSON request body. Returns { body } or { response }.
async function readJsonBody(request, requestId) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {
        response: error(requestId, 400, "INVALID_BODY", "Request body must be a JSON object."),
      };
    }
    return { body };
  } catch {
    return {
      response: error(requestId, 400, "INVALID_JSON", "Request body must be valid JSON."),
    };
  }
}

// GET /v1/projects — list all projects, newest first.
export async function handleListProjects(requestId, env) {
  const supabase = getSupabase(env);
  const { data, error: dbError } = await supabase
    .from("projects")
    .select("id, name, slug, description, status, created_at")
    .order("created_at", { ascending: false });

  if (dbError) {
    console.error(`[${requestId}] listProjects error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not fetch projects.");
  }

  return success(requestId, { projects: data });
}

// POST /v1/projects — create a new project.
export async function handleCreateProject(request, requestId, env) {
  const { body, response } = await readJsonBody(request, requestId);
  if (response) return response;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 100) {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "Project name is required and must be between 1 and 100 characters."
    );
  }

  const rawSlug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : slugify(name);
  if (!SLUG_REGEX.test(rawSlug)) {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "Project slug must contain only lowercase letters, numbers, and single hyphens (e.g. 'my-app')."
    );
  }

  let description = null;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      return error(requestId, 400, "VALIDATION_ERROR", "Description must be a string.");
    }
    description = body.description.trim() || null;
  }

  const supabase = getSupabase(env);
  const { data, error: dbError } = await supabase
    .from("projects")
    .insert({ name, slug: rawSlug, description })
    .select("id, name, slug, description, status, created_at")
    .single();

  if (dbError) {
    // PostgreSQL error code 23505 = unique constraint violation (duplicate slug).
    if (dbError.code === "23505") {
      return error(requestId, 409, "SLUG_TAKEN", `A project with slug '${rawSlug}' already exists.`);
    }
    console.error(`[${requestId}] createProject error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not create project.");
  }

  return success(requestId, { project: data }, 201);
}

// GET /v1/projects/{id} — fetch one project by UUID.
export async function handleGetProject(projectId, requestId, env) {
  if (!UUID_REGEX.test(projectId)) {
    return error(requestId, 400, "INVALID_ID", "Project ID must be a valid UUID.");
  }

  const supabase = getSupabase(env);
  const { data, error: dbError } = await supabase
    .from("projects")
    .select("id, name, slug, description, status, created_at")
    .eq("id", projectId)
    .maybeSingle();

  if (dbError) {
    console.error(`[${requestId}] getProject error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not fetch project.");
  }

  if (!data) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "Project not found.");
  }

  return success(requestId, { project: data });
}

// PATCH /v1/projects/{id} — update name, description, or status.
export async function handleUpdateProject(request, projectId, requestId, env) {
  if (!UUID_REGEX.test(projectId)) {
    return error(requestId, 400, "INVALID_ID", "Project ID must be a valid UUID.");
  }

  const { body, response } = await readJsonBody(request, requestId);
  if (response) return response;

  const updates = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 100) {
      return error(
        requestId,
        400,
        "VALIDATION_ERROR",
        "Project name must be between 1 and 100 characters."
      );
    }
    updates.name = name;
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      return error(requestId, 400, "VALIDATION_ERROR", "Description must be a string or null.");
    }
    updates.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }

  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "archived") {
      return error(
        requestId,
        400,
        "VALIDATION_ERROR",
        "Status must be either 'active' or 'archived'."
      );
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "Provide at least one field to update: name, description, or status."
    );
  }

  const supabase = getSupabase(env);
  const { data, error: dbError } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .select("id, name, slug, description, status, created_at")
    .maybeSingle();

  if (dbError) {
    console.error(`[${requestId}] updateProject error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not update project.");
  }

  if (!data) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "Project not found.");
  }

  return success(requestId, { project: data });
}
