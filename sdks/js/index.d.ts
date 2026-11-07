export interface NexusOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export interface NexusProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "active" | "archived";
  created_at: string;
}

export interface NexusMediaAsset {
  id: string;
  project_id: string;
  original_filename: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  visibility: "private" | "public";
  created_at: string;
  content_url: string;
  public_url: string | null;
}

export class NexusError extends Error {
  status: number;
  code: string;
  requestId: string | null;
  constructor(
    message: string,
    options?: { status?: number; code?: string; requestId?: string | null }
  );
}

export class Nexus {
  apiKey: string;
  baseUrl: string;
  files: {
    upload(
      file: File | Blob | Uint8Array | ArrayBuffer,
      options?: { filename?: string; mimeType?: string; visibility?: "private" | "public" }
    ): Promise<NexusMediaAsset>;
    list(options?: {
      visibility?: "private" | "public";
      limit?: number;
    }): Promise<NexusMediaAsset[]>;
    get(fileId: string): Promise<NexusMediaAsset>;
    updateVisibility(
      fileId: string,
      visibility: "private" | "public"
    ): Promise<NexusMediaAsset>;
    download(fileId: string): Promise<ArrayBuffer>;
    delete(fileId: string): Promise<{ deleted: boolean; id: string }>;
    publicUrl(fileId: string): string;
  };

  constructor(apiKey: string, options?: NexusOptions);
  health(): Promise<{
    status: "ok" | "degraded";
    service: string;
    database: "ok" | "error" | "not_configured";
    time: string;
  }>;
  me(): Promise<{
    project: NexusProject;
    api_key: { id: string; name: string; key_prefix: string };
  }>;
}

export default Nexus;

