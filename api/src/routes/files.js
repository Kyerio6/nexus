import { getSupabase } from "../supabase.js";
import { success, error } from "../response.js";
import { logActivity } from "./logs.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Maximum upload size through the Worker: 25 MB.
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Allowed MIME types for uploaded files.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
  "application/pdf",
  "application/json",
  "text/plain",
  "text/csv",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "application/zip",
  "application/octet-stream",
]);

// Keeps only safe filename characters so storage keys stay clean and predictable.
function sanitizeFilename(filename) {
  const cleaned = String(filename || "file")
    .split(/[/\\]/)
    .pop()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);

  return cleaned || "file";
}

// Adds ready-to-use content_url and public_url fields to a media_assets row.
function formatFileRecord(asset, origin) {
  return {
    id: asset.id,
    project_id: asset.project_id,
    original_filename: asset.original_filename,
    storage_key: asset.storage_key,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    visibility: asset.visibility,
    created_at: asset.created_at,
    content_url: `${origin}/v1/files/${asset.id}/content`,
    public_url: asset.visibility === "public" ? `${origin}/v1/public/files/${asset.id}` : null,
  };
}

// Streams an R2 object back to the caller with safe HTTP headers.
function buildBinaryResponse(r2Object, asset, isPublic) {
  const safeName = sanitizeFilename(asset.original_filename);
  const body = r2Object.body ?? r2Object.bytes;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": asset.mime_type || "application/octet-stream",
      "Content-Length": String(asset.size_bytes),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
    },
  });
}

// POST /v1/files/upload — upload a file to R2 and save its metadata in Supabase.
export async function handleUploadFile(request, project, apiKey, origin, requestId, env) {
  if (!env.MEDIA_BUCKET) {
    return error(requestId, 500, "STORAGE_NOT_CONFIGURED", "File storage bucket is not configured.");
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return error(
      requestId,
      400,
      "INVALID_FORM_DATA",
      "Request must be multipart/form-data containing a 'file' field."
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return error(requestId, 400, "VALIDATION_ERROR", "A file must be provided in the 'file' field.");
  }

  if (file.size <= 0) {
    return error(requestId, 400, "VALIDATION_ERROR", "Uploaded file cannot be empty.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return error(
      requestId,
      400,
      "FILE_TOO_LARGE",
      `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`
    );
  }

  const mimeType = (file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return error(
      requestId,
      400,
      "UNSUPPORTED_FILE_TYPE",
      `MIME type '${mimeType}' is not allowed.`
    );
  }

  const rawVisibility = formData.get("visibility");
  const visibility = rawVisibility ? String(rawVisibility).trim().toLowerCase() : "private";
  if (visibility !== "private" && visibility !== "public") {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "visibility must be either 'private' or 'public'."
    );
  }

  const originalFilename = String(file.name || "file").trim().slice(0, 255) || "file";
  const safeFilename = sanitizeFilename(originalFilename);
  const assetId = crypto.randomUUID();
  const storageKey = `${project.slug}/${assetId}/${safeFilename}`;

  // 1. Write the binary file to Cloudflare R2.
  try {
    const buffer = await file.arrayBuffer();
    await env.MEDIA_BUCKET.put(storageKey, buffer, {
      httpMetadata: { contentType: mimeType },
    });
  } catch (err) {
    console.error(`[${requestId}] R2 put error:`, err);
    return error(requestId, 500, "STORAGE_ERROR", "Could not store file in R2.");
  }

  // 2. Save the metadata row in Supabase.
  const supabase = getSupabase(env);
  const { data, error: dbError } = await supabase
    .from("media_assets")
    .insert({
      id: assetId,
      project_id: project.id,
      original_filename: originalFilename,
      storage_key: storageKey,
      mime_type: mimeType,
      size_bytes: file.size,
      visibility,
    })
    .select(
      "id, project_id, original_filename, storage_key, mime_type, size_bytes, visibility, created_at"
    )
    .single();

  if (dbError) {
    // Roll back the R2 upload so we don't leave an orphan object behind.
    try {
      await env.MEDIA_BUCKET.delete(storageKey);
    } catch (cleanupErr) {
      console.warn(`[${requestId}] R2 rollback failed:`, cleanupErr);
    }
    console.error(`[${requestId}] media_assets insert error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not save file metadata.");
  }

  await logActivity(env, {
    projectId: project.id,
    actorType: "api_key",
    actorId: apiKey.id,
    action: "file.uploaded",
    details: {
      file_id: data.id,
      filename: data.original_filename,
      size_bytes: data.size_bytes,
      visibility: data.visibility,
    },
  });

  return success(requestId, { file: formatFileRecord(data, origin) }, 201);
}

// GET /v1/files — list uploaded files.
// API keys can only list files belonging to their own project.
// Admins can list all files or filter with ?project_id=<uuid>.
export async function handleListFiles(url, caller, requestId, env) {
  const visibility = url.searchParams.get("visibility");
  if (visibility && visibility !== "private" && visibility !== "public") {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "visibility must be either 'private' or 'public'."
    );
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

  let projectId = null;
  if (caller.type === "api_key") {
    projectId = caller.project.id;
  } else {
    const requestedProjectId = url.searchParams.get("project_id");
    if (requestedProjectId) {
      if (!UUID_REGEX.test(requestedProjectId)) {
        return error(requestId, 400, "INVALID_ID", "project_id must be a valid UUID.");
      }
      projectId = requestedProjectId;
    }
  }

  const supabase = getSupabase(env);
  let query = supabase
    .from("media_assets")
    .select(
      "id, project_id, original_filename, storage_key, mime_type, size_bytes, visibility, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  if (visibility) {
    query = query.eq("visibility", visibility);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    console.error(`[${requestId}] listFiles error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not fetch files.");
  }

  return success(requestId, {
    files: data.map((row) => formatFileRecord(row, url.origin)),
  });
}

// GET /v1/files/{id} — fetch one file's metadata.
export async function handleGetFile(fileId, caller, origin, requestId, env) {
  if (!UUID_REGEX.test(fileId)) {
    return error(requestId, 400, "INVALID_ID", "File ID must be a valid UUID.");
  }

  const supabase = getSupabase(env);
  const { data: asset, error: dbError } = await supabase
    .from("media_assets")
    .select(
      "id, project_id, original_filename, storage_key, mime_type, size_bytes, visibility, created_at"
    )
    .eq("id", fileId)
    .maybeSingle();

  if (dbError) {
    console.error(`[${requestId}] getFile error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not fetch file metadata.");
  }

  if (!asset || (caller.type === "api_key" && asset.project_id !== caller.project.id)) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "File not found.");
  }

  return success(requestId, { file: formatFileRecord(asset, origin) });
}

// PATCH /v1/files/{id} — update a file's visibility ('public' or 'private').
export async function handleUpdateFileVisibility(request, fileId, caller, origin, requestId, env) {
  if (!UUID_REGEX.test(fileId)) {
    return error(requestId, 400, "INVALID_ID", "File ID must be a valid UUID.");
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

  if (body.visibility !== "public" && body.visibility !== "private") {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "visibility is required and must be either 'public' or 'private'."
    );
  }

  const supabase = getSupabase(env);
  const { data: existing, error: findError } = await supabase
    .from("media_assets")
    .select("id, project_id")
    .eq("id", fileId)
    .maybeSingle();

  if (findError) {
    console.error(`[${requestId}] updateFile lookup error:`, findError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not look up file.");
  }

  if (!existing || (caller.type === "api_key" && existing.project_id !== caller.project.id)) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "File not found.");
  }

  const { data: updated, error: updateError } = await supabase
    .from("media_assets")
    .update({ visibility: body.visibility })
    .eq("id", fileId)
    .select(
      "id, project_id, original_filename, storage_key, mime_type, size_bytes, visibility, created_at"
    )
    .single();

  if (updateError) {
    console.error(`[${requestId}] updateFile error:`, updateError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not update file visibility.");
  }

  await logActivity(env, {
    projectId: updated.project_id,
    actorType: caller.type,
    actorId: caller.type === "api_key" ? caller.apiKey.id : caller.user.id,
    action: "file.updated",
    details: { file_id: updated.id, visibility: updated.visibility },
  });

  return success(requestId, { file: formatFileRecord(updated, origin) });
}

// GET /v1/files/{id}/content — stream binary file content for an authorized API key or Admin.
export async function handleDownloadFile(fileId, caller, requestId, env) {
  if (!UUID_REGEX.test(fileId)) {
    return error(requestId, 400, "INVALID_ID", "File ID must be a valid UUID.");
  }

  if (!env.MEDIA_BUCKET) {
    return error(requestId, 500, "STORAGE_NOT_CONFIGURED", "File storage bucket is not configured.");
  }

  const supabase = getSupabase(env);
  const { data: asset, error: dbError } = await supabase
    .from("media_assets")
    .select("id, project_id, original_filename, storage_key, mime_type, size_bytes, visibility")
    .eq("id", fileId)
    .maybeSingle();

  if (dbError) {
    console.error(`[${requestId}] downloadFile lookup error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not look up file.");
  }

  if (!asset || (caller.type === "api_key" && asset.project_id !== caller.project.id)) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "File not found.");
  }

  const object = await env.MEDIA_BUCKET.get(asset.storage_key);
  if (!object) {
    return error(requestId, 404, "FILE_CONTENT_MISSING", "File content was not found in storage.");
  }

  return buildBinaryResponse(object, asset, false);
}

// GET /v1/public/files/{id} — stream binary file content without authentication
// ONLY when visibility is 'public' and the parent project is 'active'.
export async function handlePublicFile(fileId, requestId, env) {
  if (!UUID_REGEX.test(fileId)) {
    return error(requestId, 400, "INVALID_ID", "File ID must be a valid UUID.");
  }

  if (!env.MEDIA_BUCKET) {
    return error(requestId, 500, "STORAGE_NOT_CONFIGURED", "File storage bucket is not configured.");
  }

  const supabase = getSupabase(env);
  const { data: asset, error: dbError } = await supabase
    .from("media_assets")
    .select(
      "id, project_id, original_filename, storage_key, mime_type, size_bytes, visibility, projects ( status )"
    )
    .eq("id", fileId)
    .maybeSingle();

  if (dbError) {
    console.error(`[${requestId}] publicFile lookup error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not look up file.");
  }

  // Never reveal whether a private file or archived project's file exists: always return 404.
  if (!asset || asset.visibility !== "public" || asset.projects?.status !== "active") {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "Public file not found.");
  }

  const object = await env.MEDIA_BUCKET.get(asset.storage_key);
  if (!object) {
    return error(requestId, 404, "FILE_CONTENT_MISSING", "File content was not found in storage.");
  }

  return buildBinaryResponse(object, asset, true);
}

// DELETE /v1/files/{id} — delete a file from R2 and remove its metadata row.
export async function handleDeleteFile(fileId, caller, requestId, env) {
  if (!UUID_REGEX.test(fileId)) {
    return error(requestId, 400, "INVALID_ID", "File ID must be a valid UUID.");
  }

  if (!env.MEDIA_BUCKET) {
    return error(requestId, 500, "STORAGE_NOT_CONFIGURED", "File storage bucket is not configured.");
  }

  const supabase = getSupabase(env);
  const { data: asset, error: findError } = await supabase
    .from("media_assets")
    .select("id, project_id, original_filename, storage_key")
    .eq("id", fileId)
    .maybeSingle();

  if (findError) {
    console.error(`[${requestId}] deleteFile lookup error:`, findError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not look up file.");
  }

  // If an API key tries to delete another project's file, return 404 so project data stays isolated.
  if (!asset || (caller.type === "api_key" && asset.project_id !== caller.project.id)) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "File not found.");
  }

  try {
    await env.MEDIA_BUCKET.delete(asset.storage_key);
  } catch (err) {
    console.error(`[${requestId}] R2 delete error:`, err);
    return error(requestId, 500, "STORAGE_ERROR", "Could not delete file from storage.");
  }

  const { error: deleteError } = await supabase.from("media_assets").delete().eq("id", fileId);

  if (deleteError) {
    console.error(`[${requestId}] media_assets delete error:`, deleteError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not delete file metadata.");
  }

  await logActivity(env, {
    projectId: asset.project_id,
    actorType: caller.type,
    actorId: caller.type === "api_key" ? caller.apiKey.id : caller.user.id,
    action: "file.deleted",
    details: { file_id: asset.id, filename: asset.original_filename },
  });

  return success(requestId, { deleted: true, id: fileId });
}
