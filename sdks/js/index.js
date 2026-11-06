// NEXUS JavaScript / TypeScript SDK.
// Zero dependencies — uses standard Fetch and FormData APIs.

export class NexusError extends Error {
  constructor(message, { status = 0, code = "NEXUS_ERROR", requestId = null } = {}) {
    super(message);
    this.name = "NexusError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export class Nexus {
  /**
   * @param {string} apiKey - Project secret API key ("nx_sk_...")
   * @param {{ baseUrl?: string, fetch?: typeof globalThis.fetch }} [options]
   */
  constructor(apiKey, options = {}) {
    if (!apiKey || typeof apiKey !== "string") {
      throw new NexusError("A valid NEXUS project API key (nx_sk_...) is required.", {
        code: "MISSING_API_KEY",
      });
    }

    this.apiKey = apiKey.trim();
    this.baseUrl = (options.baseUrl || "http://localhost:8787").replace(/\/+$/, "");
    this._fetch = options.fetch || globalThis.fetch.bind(globalThis);

    this.files = {
      upload: (file, uploadOptions) => this._uploadFile(file, uploadOptions),
      list: (listOptions) => this._listFiles(listOptions),
      get: (fileId) => this._getFile(fileId),
      updateVisibility: (fileId, visibility) => this._updateFileVisibility(fileId, visibility),
      download: (fileId) => this._downloadFile(fileId),
      delete: (fileId) => this._deleteFile(fileId),
      publicUrl: (fileId) => `${this.baseUrl}/v1/public/files/${encodeURIComponent(fileId)}`,
    };
  }

  async _requestJson(path, { method = "GET", body = undefined, auth = true } = {}) {
    const headers = {};
    if (auth) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    let payload = body;
    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: payload,
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.success) {
      throw new NexusError(
        json?.error?.message || `NEXUS request failed with HTTP ${response.status}`,
        {
          status: response.status,
          code: json?.error?.code || "HTTP_ERROR",
          requestId: json?.meta?.request_id || null,
        }
      );
    }

    return json.data;
  }

  // GET /v1/health
  async health() {
    return await this._requestJson("/v1/health", { auth: false });
  }

  // GET /v1/me
  async me() {
    return await this._requestJson("/v1/me");
  }

  // POST /v1/files/upload
  async _uploadFile(file, options = {}) {
    const visibility = options.visibility || "private";
    const form = new FormData();

    if (file instanceof Blob) {
      const filename = options.filename || file.name || "file";
      const fileObj =
        file instanceof File
          ? file
          : new File([file], filename, {
              type: options.mimeType || file.type || "application/octet-stream",
            });
      form.append("file", fileObj);
    } else if (file instanceof Uint8Array || file instanceof ArrayBuffer) {
      const filename = options.filename || "file";
      const mimeType = options.mimeType || "application/octet-stream";
      form.append("file", new File([file], filename, { type: mimeType }));
    } else {
      throw new NexusError(
        "file must be a File, Blob, Uint8Array, or ArrayBuffer.",
        { code: "VALIDATION_ERROR" }
      );
    }

    form.append("visibility", visibility);

    const data = await this._requestJson("/v1/files/upload", {
      method: "POST",
      body: form,
    });
    return data.file;
  }

  // GET /v1/files
  async _listFiles(options = {}) {
    const params = new URLSearchParams();
    if (options.visibility) params.set("visibility", options.visibility);
    if (options.limit !== undefined) params.set("limit", String(options.limit));

    const qs = params.toString();
    const data = await this._requestJson(`/v1/files${qs ? `?${qs}` : ""}`);
    return data.files;
  }

  // GET /v1/files/{id}
  async _getFile(fileId) {
    const data = await this._requestJson(`/v1/files/${encodeURIComponent(fileId)}`);
    return data.file;
  }

  // PATCH /v1/files/{id}
  async _updateFileVisibility(fileId, visibility) {
    const data = await this._requestJson(`/v1/files/${encodeURIComponent(fileId)}`, {
      method: "PATCH",
      body: { visibility },
    });
    return data.file;
  }

  // GET /v1/files/{id}/content
  async _downloadFile(fileId) {
    const response = await this._fetch(
      `${this.baseUrl}/v1/files/${encodeURIComponent(fileId)}/content`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      }
    );

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      throw new NexusError(
        json?.error?.message || `Download failed with HTTP ${response.status}`,
        {
          status: response.status,
          code: json?.error?.code || "HTTP_ERROR",
          requestId: json?.meta?.request_id || null,
        }
      );
    }

    return await response.arrayBuffer();
  }

  // DELETE /v1/files/{id}
  async _deleteFile(fileId) {
    return await this._requestJson(`/v1/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
    });
  }
}

export default Nexus;
