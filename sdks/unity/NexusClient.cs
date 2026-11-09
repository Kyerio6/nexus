// NEXUS C# / Unity SDK
// Single drop-in file with zero external dependencies.
// Works in .NET 6+ backends, Unity Editor scripts, Unity Dedicated Server builds, and Unity clients.
//
// SECURITY RULE:
// Never embed a secret API key (nx_sk_...) in shipped client-side Unity game builds.
// Use nx_sk_... keys only on trusted game servers or in Unity Editor tools (#if UNITY_EDITOR || UNITY_SERVER).
// Shipped Unity clients should either call your own game server or fetch public files via Files.DownloadPublicAsync(id).

#nullable enable

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

#if UNITY_5_3_OR_NEWER
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
#endif

namespace Nexus
{
    public sealed class NexusException : Exception
    {
        public int Status { get; }
        public string ErrorCode { get; }
        public string? RequestId { get; }

        public NexusException(
            string message,
            int status = 0,
            string errorCode = "NEXUS_ERROR",
            string? requestId = null
        ) : base(message)
        {
            Status = status;
            ErrorCode = errorCode;
            RequestId = requestId;
        }
    }

    public sealed class NexusMediaAsset
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        [JsonPropertyName("project_id")] public string ProjectId { get; set; } = "";
        [JsonPropertyName("original_filename")] public string OriginalFilename { get; set; } = "";
        [JsonPropertyName("storage_key")] public string StorageKey { get; set; } = "";
        [JsonPropertyName("mime_type")] public string MimeType { get; set; } = "";
        [JsonPropertyName("size_bytes")] public long SizeBytes { get; set; }
        [JsonPropertyName("visibility")] public string Visibility { get; set; } = "private";
        [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
        [JsonPropertyName("content_url")] public string ContentUrl { get; set; } = "";
        [JsonPropertyName("public_url")] public string? PublicUrl { get; set; }
    }

    public sealed class NexusDataRecord
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        [JsonPropertyName("project_id")] public string ProjectId { get; set; } = "";
        [JsonPropertyName("collection")] public string Collection { get; set; } = "";
        [JsonPropertyName("key")] public string? Key { get; set; }
        [JsonPropertyName("data")] public JsonElement Data { get; set; }
        [JsonPropertyName("created_at")] public string CreatedAt { get; set; } = "";
        [JsonPropertyName("updated_at")] public string UpdatedAt { get; set; } = "";
    }

    public sealed class NexusPagination
    {
        [JsonPropertyName("limit")] public int Limit { get; set; }
        [JsonPropertyName("offset")] public int Offset { get; set; }
        [JsonPropertyName("total")] public int Total { get; set; }
        [JsonPropertyName("order")] public string Order { get; set; } = "desc";
    }

    public sealed class NexusDataListResult
    {
        [JsonPropertyName("records")] public List<NexusDataRecord> Records { get; set; } = new();
        [JsonPropertyName("pagination")] public NexusPagination Pagination { get; set; } = new();
    }

    public sealed class NexusClient
    {
        private readonly string? _apiKey;
        private readonly string _baseUrl;
        private readonly HttpClient _http;

        public NexusFilesClient Files { get; }

        /// <param name="apiKey">Project secret key (nx_sk_...) for server/editor calls, or null for public-only client calls.</param>
        /// <param name="baseUrl">NEXUS API base URL (default: http://localhost:8787).</param>
        /// <param name="httpClient">Optional shared HttpClient instance.</param>
        public NexusClient(
            string? apiKey = null,
            string baseUrl = "http://localhost:8787",
            HttpClient? httpClient = null
        )
        {
            _apiKey = string.IsNullOrWhiteSpace(apiKey) ? null : apiKey.Trim();
            _baseUrl = (baseUrl ?? "http://localhost:8787").TrimEnd('/');
            _http = httpClient ?? new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            Files = new NexusFilesClient(this);
        }

        public string BaseUrl => _baseUrl;

        /// <summary>GET /v1/health — Check API and database connectivity.</summary>
        public Task<JsonElement> HealthAsync(CancellationToken ct = default)
        {
            return RequestJsonAsync(HttpMethod.Get, "/v1/health", null, auth: false, ct);
        }

        /// <summary>GET /v1/me — Verify project API key and retrieve project info.</summary>
        public Task<JsonElement> MeAsync(CancellationToken ct = default)
        {
            return RequestJsonAsync(HttpMethod.Get, "/v1/me", null, auth: true, ct);
        }

        /// <summary>Returns a collection-scoped helper for /v1/data/{collection}.</summary>
        public NexusDataCollectionClient Data(string collection)
        {
            if (string.IsNullOrWhiteSpace(collection))
            {
                throw new NexusException("A valid collection name is required.", 0, "VALIDATION_ERROR");
            }
            return new NexusDataCollectionClient(this, collection.Trim());
        }

        internal async Task<JsonElement> RequestJsonAsync(
            HttpMethod method,
            string path,
            HttpContent? content = null,
            bool auth = true,
            CancellationToken ct = default
        )
        {
            using var req = new HttpRequestMessage(method, _baseUrl + path);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            if (auth)
            {
                if (string.IsNullOrEmpty(_apiKey))
                {
                    throw new NexusException(
                        "A valid NEXUS project API key (nx_sk_...) is required for this operation.",
                        0,
                        "MISSING_API_KEY"
                    );
                }
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            }

            if (content != null)
            {
                req.Content = content;
            }

            using var res = await _http.SendAsync(req, ct).ConfigureAwait(false);
            var raw = await res.Content.ReadAsStringAsync().ConfigureAwait(false);

            JsonDocument doc;
            try
            {
                doc = JsonDocument.Parse(raw);
            }
            catch
            {
                throw new NexusException($"NEXUS HTTP {(int)res.StatusCode}: invalid JSON response.", (int)res.StatusCode);
            }

            using (doc)
            {
                var root = doc.RootElement;
                bool isSuccess = res.IsSuccessStatusCode &&
                                 root.TryGetProperty("success", out var sProp) &&
                                 sProp.ValueKind == JsonValueKind.True;

                if (!isSuccess)
                {
                    string code = "HTTP_ERROR";
                    string msg = $"NEXUS request failed with HTTP {(int)res.StatusCode}";
                    string? reqId = null;

                    if (root.TryGetProperty("error", out var errObj) && errObj.ValueKind == JsonValueKind.Object)
                    {
                        if (errObj.TryGetProperty("code", out var c) && c.ValueKind == JsonValueKind.String)
                            code = c.GetString() ?? code;
                        if (errObj.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String)
                            msg = m.GetString() ?? msg;
                    }
                    if (root.TryGetProperty("meta", out var metaObj) &&
                        metaObj.ValueKind == JsonValueKind.Object &&
                        metaObj.TryGetProperty("request_id", out var rId) &&
                        rId.ValueKind == JsonValueKind.String)
                    {
                        reqId = rId.GetString();
                    }

                    throw new NexusException(msg, (int)res.StatusCode, code, reqId);
                }

                if (root.TryGetProperty("data", out var dataProp))
                {
                    return dataProp.Clone();
                }

                return default;
            }
        }

        internal async Task<byte[]> RequestBytesAsync(string path, bool auth = true, CancellationToken ct = default)
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, _baseUrl + path);
            if (auth)
            {
                if (string.IsNullOrEmpty(_apiKey))
                {
                    throw new NexusException(
                        "A valid NEXUS project API key (nx_sk_...) is required for authorized downloads.",
                        0,
                        "MISSING_API_KEY"
                    );
                }
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            }

            using var res = await _http.SendAsync(req, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode)
            {
                var raw = await res.Content.ReadAsStringAsync().ConfigureAwait(false);
                string code = "HTTP_ERROR";
                string msg = $"Download failed with HTTP {(int)res.StatusCode}";
                string? reqId = null;
                try
                {
                    using var doc = JsonDocument.Parse(raw);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("error", out var errObj) && errObj.ValueKind == JsonValueKind.Object)
                    {
                        if (errObj.TryGetProperty("code", out var c) && c.ValueKind == JsonValueKind.String)
                            code = c.GetString() ?? code;
                        if (errObj.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String)
                            msg = m.GetString() ?? msg;
                    }
                    if (root.TryGetProperty("meta", out var metaObj) &&
                        metaObj.ValueKind == JsonValueKind.Object &&
                        metaObj.TryGetProperty("request_id", out var rId) &&
                        rId.ValueKind == JsonValueKind.String)
                    {
                        reqId = rId.GetString();
                    }
                }
                catch
                {
                    // Ignore parse errors on binary error fallback
                }
                throw new NexusException(msg, (int)res.StatusCode, code, reqId);
            }

            return await res.Content.ReadAsByteArrayAsync().ConfigureAwait(false);
        }
    }

    public sealed class NexusFilesClient
    {
        private readonly NexusClient _client;

        internal NexusFilesClient(NexusClient client)
        {
            _client = client;
        }

        /// <summary>POST /v1/files/upload — Upload a file to Cloudflare R2.</summary>
        public async Task<NexusMediaAsset> UploadAsync(
            byte[] fileBytes,
            string filename,
            string mimeType = "application/octet-stream",
            string visibility = "private",
            CancellationToken ct = default
        )
        {
            using var form = new MultipartFormDataContent();
            var byteContent = new ByteArrayContent(fileBytes);
            byteContent.Headers.ContentType = new MediaTypeHeaderValue(mimeType);
            form.Add(byteContent, "file", filename);
            form.Add(new StringContent(visibility), "visibility");

            var data = await _client.RequestJsonAsync(HttpMethod.Post, "/v1/files/upload", form, auth: true, ct)
                .ConfigureAwait(false);

            return JsonSerializer.Deserialize<NexusMediaAsset>(data.GetProperty("file").GetRawText())!;
        }

        /// <summary>GET /v1/files — List uploaded files for this project.</summary>
        public async Task<List<NexusMediaAsset>> ListAsync(
            string? visibility = null,
            int? limit = null,
            CancellationToken ct = default
        )
        {
            var query = new List<string>();
            if (!string.IsNullOrEmpty(visibility))
                query.Add("visibility=" + Uri.EscapeDataString(visibility));
            if (limit.HasValue)
                query.Add("limit=" + limit.Value);

            string path = "/v1/files" + (query.Count > 0 ? "?" + string.Join("&", query) : "");
            var data = await _client.RequestJsonAsync(HttpMethod.Get, path, null, auth: true, ct)
                .ConfigureAwait(false);

            return JsonSerializer.Deserialize<List<NexusMediaAsset>>(data.GetProperty("files").GetRawText()) ?? new();
        }

        /// <summary>GET /v1/files/{id} — Get file metadata by UUID.</summary>
        public async Task<NexusMediaAsset> GetAsync(string fileId, CancellationToken ct = default)
        {
            var data = await _client.RequestJsonAsync(
                HttpMethod.Get,
                "/v1/files/" + Uri.EscapeDataString(fileId),
                null,
                auth: true,
                ct
            ).ConfigureAwait(false);

            return JsonSerializer.Deserialize<NexusMediaAsset>(data.GetProperty("file").GetRawText())!;
        }

        /// <summary>PATCH /v1/files/{id} — Update file visibility ('public' or 'private').</summary>
        public async Task<NexusMediaAsset> UpdateVisibilityAsync(
            string fileId,
            string visibility,
            CancellationToken ct = default
        )
        {
            var json = JsonSerializer.Serialize(new { visibility });
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var data = await _client.RequestJsonAsync(
                new HttpMethod("PATCH"),
                "/v1/files/" + Uri.EscapeDataString(fileId),
                content,
                auth: true,
                ct
            ).ConfigureAwait(false);

            return JsonSerializer.Deserialize<NexusMediaAsset>(data.GetProperty("file").GetRawText())!;
        }

        /// <summary>GET /v1/files/{id}/content — Download authorized file bytes (requires API key).</summary>
        public Task<byte[]> DownloadAsync(string fileId, CancellationToken ct = default)
        {
            return _client.RequestBytesAsync("/v1/files/" + Uri.EscapeDataString(fileId) + "/content", auth: true, ct);
        }

        /// <summary>GET /v1/public/files/{id} — Download a public file without an API key (safe for Unity clients).</summary>
        public Task<byte[]> DownloadPublicAsync(string fileId, CancellationToken ct = default)
        {
            return _client.RequestBytesAsync("/v1/public/files/" + Uri.EscapeDataString(fileId), auth: false, ct);
        }

        /// <summary>DELETE /v1/files/{id} — Delete file from R2 and metadata table.</summary>
        public async Task<bool> DeleteAsync(string fileId, CancellationToken ct = default)
        {
            var data = await _client.RequestJsonAsync(
                HttpMethod.Delete,
                "/v1/files/" + Uri.EscapeDataString(fileId),
                null,
                auth: true,
                ct
            ).ConfigureAwait(false);

            return data.TryGetProperty("deleted", out var d) && d.ValueKind == JsonValueKind.True;
        }

        /// <summary>Returns the direct public URL for a file with visibility == 'public'.</summary>
        public string GetPublicUrl(string fileId)
        {
            return $"{_client.BaseUrl}/v1/public/files/{Uri.EscapeDataString(fileId)}";
        }

#if UNITY_5_3_OR_NEWER
        /// <summary>Unity coroutine helper to download a public Texture2D directly from /v1/public/files/{id}.</summary>
        public IEnumerator LoadPublicTextureCoroutine(
            string fileId,
            Action<Texture2D> onLoaded,
            Action<string>? onError = null
        )
        {
            using var req = UnityWebRequestTexture.GetTexture(GetPublicUrl(fileId));
            yield return req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.Success)
            {
                onLoaded?.Invoke(DownloadHandlerTexture.GetContent(req));
            }
            else
            {
                onError?.Invoke(req.error);
            }
        }
#endif
    }

    public sealed class NexusDataCollectionClient
    {
        private readonly NexusClient _client;
        private readonly string _encodedCollection;

        internal NexusDataCollectionClient(NexusClient client, string collection)
        {
            _client = client;
            _encodedCollection = Uri.EscapeDataString(collection);
        }

        /// <summary>POST /v1/data/{collection} — Create a JSON document (max 64 KB UTF-8).</summary>
        public async Task<NexusDataRecord> CreateAsync(
            object data,
            string? key = null,
            CancellationToken ct = default
        )
        {
            var payload = new Dictionary<string, object?> { ["data"] = data };
            if (key != null)
            {
                payload["key"] = key;
            }

            var json = JsonSerializer.Serialize(payload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var res = await _client.RequestJsonAsync(
                HttpMethod.Post,
                "/v1/data/" + _encodedCollection,
                content,
                auth: true,
                ct
            ).ConfigureAwait(false);

            return JsonSerializer.Deserialize<NexusDataRecord>(res.GetProperty("record").GetRawText())!;
        }

        /// <summary>GET /v1/data/{collection} — List documents with deterministic pagination and filtering.</summary>
        public async Task<NexusDataListResult> ListAsync(
            int? limit = null,
            int? offset = null,
            string? order = null,
            string? key = null,
            string? filterField = null,
            string? filterValue = null,
            CancellationToken ct = default
        )
        {
            var query = new List<string>();
            if (limit.HasValue) query.Add("limit=" + limit.Value);
            if (offset.HasValue) query.Add("offset=" + offset.Value);
            if (!string.IsNullOrEmpty(order)) query.Add("order=" + Uri.EscapeDataString(order));
            if (!string.IsNullOrEmpty(key)) query.Add("key=" + Uri.EscapeDataString(key));
            if (!string.IsNullOrEmpty(filterField)) query.Add("filter_field=" + Uri.EscapeDataString(filterField));
            if (filterValue != null) query.Add("filter_value=" + Uri.EscapeDataString(filterValue));

            string path = "/v1/data/" + _encodedCollection + (query.Count > 0 ? "?" + string.Join("&", query) : "");
            var res = await _client.RequestJsonAsync(HttpMethod.Get, path, null, auth: true, ct)
                .ConfigureAwait(false);

            return JsonSerializer.Deserialize<NexusDataListResult>(res.GetRawText())!;
        }

        /// <summary>GET /v1/data/{collection}/{id} — Fetch a single document by UUID.</summary>
        public async Task<NexusDataRecord> GetAsync(string recordId, CancellationToken ct = default)
        {
            var res = await _client.RequestJsonAsync(
                HttpMethod.Get,
                $"/v1/data/{_encodedCollection}/{Uri.EscapeDataString(recordId)}",
                null,
                auth: true,
                ct
            ).ConfigureAwait(false);

            return JsonSerializer.Deserialize<NexusDataRecord>(res.GetProperty("record").GetRawText())!;
        }

        /// <summary>PATCH /v1/data/{collection}/{id} — Full replacement of document data (and optional key).</summary>
        public async Task<NexusDataRecord> ReplaceAsync(
            string recordId,
            object data,
            string? key = null,
            bool updateKey = false,
            CancellationToken ct = default
        )
        {
            var payload = new Dictionary<string, object?> { ["data"] = data };
            if (key != null || updateKey)
            {
                payload["key"] = key;
            }

            var json = JsonSerializer.Serialize(payload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var res = await _client.RequestJsonAsync(
                new HttpMethod("PATCH"),
                $"/v1/data/{_encodedCollection}/{Uri.EscapeDataString(recordId)}",
                content,
                auth: true,
                ct
            ).ConfigureAwait(false);

            return JsonSerializer.Deserialize<NexusDataRecord>(res.GetProperty("record").GetRawText())!;
        }

        /// <summary>Alias for ReplaceAsync() — performs full replacement of document data.</summary>
        public Task<NexusDataRecord> UpdateAsync(
            string recordId,
            object data,
            string? key = null,
            bool updateKey = false,
            CancellationToken ct = default
        )
        {
            return ReplaceAsync(recordId, data, key, updateKey, ct);
        }

        /// <summary>DELETE /v1/data/{collection}/{id} — Delete a document by UUID.</summary>
        public async Task<bool> DeleteAsync(string recordId, CancellationToken ct = default)
        {
            var res = await _client.RequestJsonAsync(
                HttpMethod.Delete,
                $"/v1/data/{_encodedCollection}/{Uri.EscapeDataString(recordId)}",
                null,
                auth: true,
                ct
            ).ConfigureAwait(false);

            return res.TryGetProperty("deleted", out var d) && d.ValueKind == JsonValueKind.True;
        }
    }
}

