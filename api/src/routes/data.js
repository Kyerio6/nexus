import { getSupabase } from "../supabase.js";
import { success, error } from "../response.js";
import { logActivity } from "./logs.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLLECTION_REGEX = /^[a-z0-9][a-z0-9_-]*$/;
const RECORD_KEY_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;
const FILTER_FIELD_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;

// Maximum serialized UTF-8 byte size for record.data: 64 KB (65,536 bytes).
const MAX_DATA_UTF8_BYTES = 65_536;
// Maximum raw HTTP request body size before JSON parsing: 72 KB (73,728 bytes).
const MAX_RAW_BODY_UTF8_BYTES = 73_728;

const utf8Encoder = new TextEncoder();

function utf8ByteLength(str) {
  return utf8Encoder.encode(str).byteLength;
}

function validateCollection(collection, requestId) {
  if (
    typeof collection !== "string" ||
    collection.length < 1 ||
    collection.length > 64 ||
    !COLLECTION_REGEX.test(collection)
  ) {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "Collection name must be 1..64 characters, start with a lowercase letter or number, and contain only [a-z0-9_-]."
    );
  }
  return null;
}

function validateRecordKey(key, requestId) {
  if (key === undefined || key === null) return null;
  if (
    typeof key !== "string" ||
    key.length < 1 ||
    key.length > 128 ||
    !RECORD_KEY_REGEX.test(key)
  ) {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "Record key must be 1..128 characters and contain only letters, numbers, and [._:-]."
    );
  }
  return null;
}

function isPlainJsonObject(val) {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

// Reads and validates the incoming JSON request body, enforcing a pre-parse UTF-8 byte cap
// and a strict 64 KB UTF-8 byte cap on the serialized `data` object.
async function readAndValidateDocumentBody(request, requestId, { allowKey = true } = {}) {
  const contentLengthHeader = request.headers.get("Content-Length");
  if (contentLengthHeader !== null) {
    const declaredBytes = Number(contentLengthHeader);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_RAW_BODY_UTF8_BYTES) {
      return {
        response: error(
          requestId,
          413,
          "PAYLOAD_TOO_LARGE",
          `Request body exceeds the maximum allowed size of ${MAX_RAW_BODY_UTF8_BYTES} bytes.`
        ),
      };
    }
  }

  let rawText;
  try {
    rawText = await request.text();
  } catch {
    return {
      response: error(requestId, 400, "INVALID_JSON", "Could not read request body."),
    };
  }

  if (utf8ByteLength(rawText) > MAX_RAW_BODY_UTF8_BYTES) {
    return {
      response: error(
        requestId,
        413,
        "PAYLOAD_TOO_LARGE",
        `Request body exceeds the maximum allowed size of ${MAX_RAW_BODY_UTF8_BYTES} bytes.`
      ),
    };
  }

  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    return {
      response: error(requestId, 400, "INVALID_JSON", "Request body must be valid JSON."),
    };
  }

  if (!isPlainJsonObject(body)) {
    return {
      response: error(requestId, 400, "INVALID_BODY", "Request body must be a JSON object."),
    };
  }

  // Never allow client-supplied project_id in document payloads.
  if ("project_id" in body || "projectId" in body) {
    return {
      response: error(
        requestId,
        400,
        "VALIDATION_ERROR",
        "project_id cannot be supplied in the request body; the project is derived from the authenticated credential."
      ),
    };
  }

  if ("merge" in body) {
    return {
      response: error(
        requestId,
        400,
        "VALIDATION_ERROR",
        "Partial merge is not supported; PATCH performs full document replacement of 'data'."
      ),
    };
  }

  if (!isPlainJsonObject(body.data)) {
    return {
      response: error(
        requestId,
        400,
        "VALIDATION_ERROR",
        "Field 'data' is required and must be a JSON object ({ ... })."
      ),
    };
  }

  const serializedData = JSON.stringify(body.data);
  const dataBytes = utf8ByteLength(serializedData);
  if (dataBytes > MAX_DATA_UTF8_BYTES) {
    return {
      response: error(
        requestId,
        413,
        "PAYLOAD_TOO_LARGE",
        `Document 'data' exceeds the maximum size of 64 KB (${MAX_DATA_UTF8_BYTES} UTF-8 bytes).`
      ),
    };
  }

  let recordKey = undefined;
  if ("key" in body) {
    if (!allowKey && body.key !== undefined) {
      return {
        response: error(requestId, 400, "VALIDATION_ERROR", "Field 'key' cannot be modified here."),
      };
    }
    const keyErr = validateRecordKey(body.key, requestId);
    if (keyErr) return { response: keyErr };
    recordKey = body.key === null ? null : body.key;
  }

  return { data: body.data, recordKey };
}

function formatRecord(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    collection: row.collection,
    key: row.record_key,
    data: row.data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// POST /v1/data/{collection} — create a new document in the authenticated project's collection.
export async function handleCreateRecord(request, collection, project, apiKey, requestId, env) {
  const colErr = validateCollection(collection, requestId);
  if (colErr) return colErr;

  const { data, recordKey, response } = await readAndValidateDocumentBody(request, requestId);
  if (response) return response;

  const supabase = getSupabase(env);
  const { data: inserted, error: dbError } = await supabase
    .from("app_records")
    .insert({
      project_id: project.id,
      collection,
      record_key: recordKey ?? null,
      data,
    })
    .select("id, project_id, collection, record_key, data, created_at, updated_at")
    .single();

  if (dbError) {
    if (dbError.code === "23505") {
      return error(
        requestId,
        409,
        "KEY_TAKEN",
        `A record with key '${recordKey}' already exists in collection '${collection}'.`
      );
    }
    console.error(`[${requestId}] createRecord error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not create document.");
  }

  await logActivity(env, {
    projectId: project.id,
    actorType: "api_key",
    actorId: apiKey.id,
    action: "data.created",
    details: { collection, record_id: inserted.id, key: inserted.record_key },
  });

  return success(requestId, { record: formatRecord(inserted) }, 201);
}

// GET /v1/data/{collection} (or Admin /v1/admin/projects/{projectId}/data/{collection})
// Lists documents in a project's collection with deterministic pagination and simple filtering.
export async function handleListRecords(
  url,
  collection,
  projectId,
  requestId,
  env,
  { isAdminRoute = false } = {}
) {
  const colErr = validateCollection(collection, requestId);
  if (colErr) return colErr;

  if (!isAdminRoute && url.searchParams.has("project_id")) {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "project_id cannot be supplied on application data routes; the project is derived from the API key."
    );
  }

  if (!UUID_REGEX.test(projectId)) {
    return error(requestId, 400, "INVALID_ID", "Project ID must be a valid UUID.");
  }

  // Validate pagination parameters: limit (default 25, 1..100), offset (default 0, >= 0), order ('asc' | 'desc').
  const rawLimit = url.searchParams.get("limit");
  let limit = 25;
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

  const rawOffset = url.searchParams.get("offset");
  let offset = 0;
  if (rawOffset !== null) {
    const parsed = Number(rawOffset);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100_000) {
      return error(
        requestId,
        400,
        "VALIDATION_ERROR",
        "offset must be a whole number between 0 and 100000."
      );
    }
    offset = parsed;
  }

  const order = (url.searchParams.get("order") || "desc").toLowerCase();
  if (order !== "asc" && order !== "desc") {
    return error(requestId, 400, "VALIDATION_ERROR", "order must be either 'asc' or 'desc'.");
  }
  const ascending = order === "asc";

  // Optional exact record_key filter
  const keyFilter = url.searchParams.get("key");
  if (keyFilter !== null) {
    const keyErr = validateRecordKey(keyFilter, requestId);
    if (keyErr) return keyErr;
  }

  // Optional single top-level JSON field equality filter (?filter_field=...&filter_value=...)
  const filterField = url.searchParams.get("filter_field");
  const hasFilterValue = url.searchParams.has("filter_value");
  if ((filterField && !hasFilterValue) || (!filterField && hasFilterValue)) {
    return error(
      requestId,
      400,
      "VALIDATION_ERROR",
      "Both filter_field and filter_value must be provided together."
    );
  }

  let containmentFilter = null;
  if (filterField) {
    if (!FILTER_FIELD_REGEX.test(filterField)) {
      return error(
        requestId,
        400,
        "VALIDATION_ERROR",
        "filter_field must be 1..64 characters and contain only letters, numbers, and [_.-]."
      );
    }
    const rawVal = url.searchParams.get("filter_value");
    let parsedVal = rawVal;
    if (rawVal === "true") parsedVal = true;
    else if (rawVal === "false") parsedVal = false;
    else if (rawVal === "null") parsedVal = null;
    else if (rawVal !== "" && !Number.isNaN(Number(rawVal))) parsedVal = Number(rawVal);

    containmentFilter = { [filterField]: parsedVal };
  }

  const supabase = getSupabase(env);
  let query = supabase
    .from("app_records")
    .select("id, project_id, collection, record_key, data, created_at, updated_at", {
      count: "exact",
    })
    .eq("project_id", projectId)
    .eq("collection", collection);

  if (keyFilter !== null) {
    query = query.eq("record_key", keyFilter);
  }

  if (containmentFilter !== null) {
    query = query.contains("data", containmentFilter);
  }

  // Deterministic ordering on both created_at and id.
  query = query
    .order("created_at", { ascending })
    .order("id", { ascending })
    .range(offset, offset + limit - 1);

  const { data, count, error: dbError } = await query;

  if (dbError) {
    console.error(`[${requestId}] listRecords error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not fetch documents.");
  }

  return success(requestId, {
    records: data.map(formatRecord),
    pagination: {
      limit,
      offset,
      total: count ?? data.length,
      order,
    },
  });
}

// GET /v1/data/{collection}/{id} — fetch a single document scoped to (project_id, collection, id).
export async function handleGetRecord(collection, recordId, projectId, requestId, env) {
  const colErr = validateCollection(collection, requestId);
  if (colErr) return colErr;

  if (!UUID_REGEX.test(recordId)) {
    return error(requestId, 400, "INVALID_ID", "Record ID must be a valid UUID.");
  }

  if (!UUID_REGEX.test(projectId)) {
    return error(requestId, 400, "INVALID_ID", "Project ID must be a valid UUID.");
  }

  const supabase = getSupabase(env);
  const { data, error: dbError } = await supabase
    .from("app_records")
    .select("id, project_id, collection, record_key, data, created_at, updated_at")
    .eq("id", recordId)
    .eq("project_id", projectId)
    .eq("collection", collection)
    .maybeSingle();

  if (dbError) {
    console.error(`[${requestId}] getRecord error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not fetch document.");
  }

  if (!data) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "Document not found.");
  }

  return success(requestId, { record: formatRecord(data) });
}

// PATCH /v1/data/{collection}/{id} — full replacement of document 'data' (and optional 'key')
// strictly scoped to (id, project_id, collection).
export async function handleReplaceRecord(
  request,
  collection,
  recordId,
  project,
  apiKey,
  requestId,
  env
) {
  const colErr = validateCollection(collection, requestId);
  if (colErr) return colErr;

  if (!UUID_REGEX.test(recordId)) {
    return error(requestId, 400, "INVALID_ID", "Record ID must be a valid UUID.");
  }

  const { data, recordKey, response } = await readAndValidateDocumentBody(request, requestId);
  if (response) return response;

  const updates = {
    data,
    updated_at: new Date().toISOString(),
  };
  if (recordKey !== undefined) {
    updates.record_key = recordKey;
  }

  const supabase = getSupabase(env);
  const { data: updated, error: dbError } = await supabase
    .from("app_records")
    .update(updates)
    .eq("id", recordId)
    .eq("project_id", project.id)
    .eq("collection", collection)
    .select("id, project_id, collection, record_key, data, created_at, updated_at")
    .maybeSingle();

  if (dbError) {
    if (dbError.code === "23505") {
      return error(
        requestId,
        409,
        "KEY_TAKEN",
        `A record with key '${recordKey}' already exists in collection '${collection}'.`
      );
    }
    console.error(`[${requestId}] replaceRecord error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not update document.");
  }

  if (!updated) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "Document not found.");
  }

  await logActivity(env, {
    projectId: project.id,
    actorType: "api_key",
    actorId: apiKey.id,
    action: "data.updated",
    details: { collection, record_id: updated.id, key: updated.record_key },
  });

  return success(requestId, { record: formatRecord(updated) });
}

// DELETE /v1/data/{collection}/{id} — delete a document strictly scoped to (id, project_id, collection).
export async function handleDeleteRecord(
  collection,
  recordId,
  projectId,
  caller,
  requestId,
  env
) {
  const colErr = validateCollection(collection, requestId);
  if (colErr) return colErr;

  if (!UUID_REGEX.test(recordId)) {
    return error(requestId, 400, "INVALID_ID", "Record ID must be a valid UUID.");
  }

  if (!UUID_REGEX.test(projectId)) {
    return error(requestId, 400, "INVALID_ID", "Project ID must be a valid UUID.");
  }

  const supabase = getSupabase(env);
  const { data: deletedRow, error: dbError } = await supabase
    .from("app_records")
    .delete()
    .eq("id", recordId)
    .eq("project_id", projectId)
    .eq("collection", collection)
    .select("id, record_key")
    .maybeSingle();

  if (dbError) {
    console.error(`[${requestId}] deleteRecord error:`, dbError.message);
    return error(requestId, 500, "DATABASE_ERROR", "Could not delete document.");
  }

  if (!deletedRow) {
    return error(requestId, 404, "RESOURCE_NOT_FOUND", "Document not found.");
  }

  await logActivity(env, {
    projectId,
    actorType: caller.type,
    actorId: caller.id,
    action: "data.deleted",
    details: { collection, record_id: deletedRow.id, key: deletedRow.record_key },
  });

  return success(requestId, { deleted: true, id: recordId });
}

