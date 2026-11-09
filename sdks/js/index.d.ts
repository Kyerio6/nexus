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

export interface NexusDataRecord<T = Record<string, unknown>> {
  id: string;
  project_id: string;
  collection: string;
  key: string | null;
  data: T;
  created_at: string;
  updated_at: string;
}

export interface NexusDataListResult<T = Record<string, unknown>> {
  records: NexusDataRecord<T>[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    order: "asc" | "desc";
  };
}

export interface NexusDataCollection<T = Record<string, unknown>> {
  create(
    data: T,
    options?: { key?: string | null }
  ): Promise<NexusDataRecord<T>>;
  list(options?: {
    limit?: number;
    offset?: number;
    order?: "asc" | "desc";
    key?: string;
    filterField?: string;
    filterValue?: string | number | boolean | null;
    filter_field?: string;
    filter_value?: string | number | boolean | null;
  }): Promise<NexusDataListResult<T>>;
  get(recordId: string): Promise<NexusDataRecord<T>>;
  replace(
    recordId: string,
    data: T,
    options?: { key?: string | null }
  ): Promise<NexusDataRecord<T>>;
  update(
    recordId: string,
    data: T,
    options?: { key?: string | null }
  ): Promise<NexusDataRecord<T>>;
  delete(recordId: string): Promise<{ deleted: boolean; id: string }>;
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
  data<T = Record<string, unknown>>(collection: string): NexusDataCollection<T>;
}

export default Nexus;

