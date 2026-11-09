<?php

declare(strict_types=1);

namespace Nexus;

/**
 * Exception thrown when a NEXUS API request fails or returns success: false.
 */
class NexusException extends \RuntimeException
{
    public int $status;
    public string $errorCode;
    public ?string $requestId;

    public function __construct(
        string $message,
        int $status = 0,
        string $errorCode = 'NEXUS_ERROR',
        ?string $requestId = null
    ) {
        parent::__construct($message, $status);
        $this->status = $status;
        $this->errorCode = $errorCode;
        $this->requestId = $requestId;
    }
}

/**
 * Lightweight, zero-dependency PHP / Laravel client for the NEXUS API.
 *
 * Security rule: Use secret API keys (nx_sk_...) only on your backend server.
 */
class NexusClient
{
    private string $apiKey;
    private string $baseUrl;
    private int $timeoutSeconds;

    public function __construct(
        string $apiKey,
        string $baseUrl = 'http://localhost:8787',
        int $timeoutSeconds = 30
    ) {
        $trimmed = trim($apiKey);
        if ($trimmed === '') {
            throw new NexusException(
                'A valid NEXUS project API key (nx_sk_...) is required.',
                0,
                'MISSING_API_KEY'
            );
        }

        $this->apiKey = $trimmed;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeoutSeconds = max(1, $timeoutSeconds);
    }

    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }

    /**
     * GET /v1/health — Check API and database connectivity.
     */
    public function health(): array
    {
        return $this->requestJson('GET', '/v1/health', null, false);
    }

    /**
     * GET /v1/me — Verify the project API key and retrieve project info.
     */
    public function me(): array
    {
        return $this->requestJson('GET', '/v1/me');
    }

    /**
     * File and media storage helper (/v1/files).
     */
    public function files(): NexusFiles
    {
        return new NexusFiles($this);
    }

    /**
     * Project-scoped JSON document storage helper (/v1/data/{collection}).
     */
    public function data(string $collection): NexusDataCollection
    {
        $trimmed = trim($collection);
        if ($trimmed === '') {
            throw new NexusException(
                'A valid collection name is required.',
                0,
                'VALIDATION_ERROR'
            );
        }
        return new NexusDataCollection($this, $trimmed);
    }

    /**
     * Internal helper for JSON / multipart requests returning the standard NEXUS envelope.
     *
     * @param string     $method
     * @param string     $path
     * @param array|null $body
     * @param bool       $auth
     * @param bool       $isMultipart
     * @return array
     */
    public function requestJson(
        string $method,
        string $path,
        ?array $body = null,
        bool $auth = true,
        bool $isMultipart = false
    ): array {
        $url = $this->baseUrl . $path;
        $ch = curl_init($url);
        if ($ch === false) {
            throw new NexusException('Failed to initialize cURL session.', 0, 'CURL_ERROR');
        }

        $headers = ['Accept: application/json'];
        if ($auth) {
            $headers[] = 'Authorization: Bearer ' . $this->apiKey;
        }

        $options = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
        ];

        if ($body !== null) {
            if ($isMultipart) {
                $options[CURLOPT_POSTFIELDS] = $body;
            } else {
                $headers[] = 'Content-Type: application/json';
                $encoded = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if ($encoded === false) {
                    curl_close($ch);
                    throw new NexusException('Failed to encode request body as JSON.', 0, 'INVALID_JSON');
                }
                $options[CURLOPT_POSTFIELDS] = $encoded;
            }
        }

        $options[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($ch, $options);

        $rawResponse = curl_exec($ch);
        $curlErr = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($rawResponse === false) {
            throw new NexusException(
                'NEXUS request failed: ' . ($curlErr ?: 'unknown network error'),
                0,
                'NETWORK_ERROR'
            );
        }

        $json = json_decode((string) $rawResponse, true);
        if (!is_array($json) || $status >= 400 || empty($json['success'])) {
            $message = $json['error']['message'] ?? ('NEXUS request failed with HTTP ' . $status);
            $code = $json['error']['code'] ?? 'HTTP_ERROR';
            $requestId = $json['meta']['request_id'] ?? null;
            throw new NexusException((string) $message, $status, (string) $code, $requestId);
        }

        return is_array($json['data'] ?? null) ? $json['data'] : [];
    }

    /**
     * Internal helper for binary file downloads (GET /v1/files/{id}/content).
     */
    public function requestBinary(string $path, bool $auth = true): string
    {
        $url = $this->baseUrl . $path;
        $ch = curl_init($url);
        if ($ch === false) {
            throw new NexusException('Failed to initialize cURL session.', 0, 'CURL_ERROR');
        }

        $headers = [];
        if ($auth) {
            $headers[] = 'Authorization: Bearer ' . $this->apiKey;
        }

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'GET',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
            CURLOPT_HTTPHEADER => $headers,
        ]);

        $rawResponse = curl_exec($ch);
        $curlErr = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($rawResponse === false) {
            throw new NexusException(
                'NEXUS download failed: ' . ($curlErr ?: 'unknown network error'),
                0,
                'NETWORK_ERROR'
            );
        }

        if ($status >= 400) {
            $json = json_decode((string) $rawResponse, true);
            $message = $json['error']['message'] ?? ('Download failed with HTTP ' . $status);
            $code = $json['error']['code'] ?? 'HTTP_ERROR';
            $requestId = $json['meta']['request_id'] ?? null;
            throw new NexusException((string) $message, $status, (string) $code, $requestId);
        }

        return (string) $rawResponse;
    }
}

/**
 * File & Media Storage helper returned by $nexus->files().
 */
class NexusFiles
{
    private NexusClient $client;

    public function __construct(NexusClient $client)
    {
        $this->client = $client;
    }

    /**
     * POST /v1/files/upload — Upload a file from a filesystem path or CURLFile.
     *
     * @param string|\CURLFile $file    Path to local file on disk, or a \CURLFile instance.
     * @param array            $options Optional ['visibility' => 'private'|'public', 'filename' => '...', 'mimeType' => '...']
     */
    public function upload($file, array $options = []): array
    {
        $visibility = $options['visibility'] ?? 'private';

        if ($file instanceof \CURLFile) {
            $curlFile = $file;
        } elseif (is_string($file) && is_file($file)) {
            $filename = $options['filename'] ?? basename($file);
            $mimeType = $options['mimeType'] ?? (mime_content_type($file) ?: 'application/octet-stream');
            $curlFile = new \CURLFile($file, $mimeType, $filename);
        } else {
            throw new NexusException(
                'upload() expects an existing file path string or a CURLFile instance.',
                0,
                'VALIDATION_ERROR'
            );
        }

        $data = $this->client->requestJson(
            'POST',
            '/v1/files/upload',
            [
                'file' => $curlFile,
                'visibility' => (string) $visibility,
            ],
            true,
            true
        );

        return $data['file'] ?? [];
    }

    /**
     * GET /v1/files — List uploaded files for this project.
     *
     * @param array $options Optional ['visibility' => 'private'|'public', 'limit' => 50]
     */
    public function list(array $options = []): array
    {
        $query = [];
        if (isset($options['visibility'])) {
            $query['visibility'] = (string) $options['visibility'];
        }
        if (isset($options['limit'])) {
            $query['limit'] = (int) $options['limit'];
        }

        $qs = http_build_query($query);
        $path = '/v1/files' . ($qs !== '' ? '?' . $qs : '');
        $data = $this->client->requestJson('GET', $path);
        return $data['files'] ?? [];
    }

    /**
     * GET /v1/files/{id} — Get metadata and URLs for a single file.
     */
    public function get(string $fileId): array
    {
        $data = $this->client->requestJson('GET', '/v1/files/' . rawurlencode($fileId));
        return $data['file'] ?? [];
    }

    /**
     * PATCH /v1/files/{id} — Update file visibility ('public' or 'private').
     */
    public function updateVisibility(string $fileId, string $visibility): array
    {
        $data = $this->client->requestJson(
            'PATCH',
            '/v1/files/' . rawurlencode($fileId),
            ['visibility' => $visibility]
        );
        return $data['file'] ?? [];
    }

    /**
     * GET /v1/files/{id}/content — Download raw binary content of an authorized file.
     */
    public function download(string $fileId): string
    {
        return $this->client->requestBinary('/v1/files/' . rawurlencode($fileId) . '/content');
    }

    /**
     * DELETE /v1/files/{id} — Delete a file from R2 and remove its metadata.
     */
    public function delete(string $fileId): array
    {
        return $this->client->requestJson('DELETE', '/v1/files/' . rawurlencode($fileId));
    }

    /**
     * Returns the direct public stream URL for a public file.
     */
    public function publicUrl(string $fileId): string
    {
        return $this->client->getBaseUrl() . '/v1/public/files/' . rawurlencode($fileId);
    }
}

/**
 * Project-scoped JSON Document Storage helper returned by $nexus->data($collection).
 * Note: replace() / update() performs full replacement of the document's `data` object.
 */
class NexusDataCollection
{
    private NexusClient $client;
    private string $encodedCollection;

    public function __construct(NexusClient $client, string $collection)
    {
        $this->client = $client;
        $this->encodedCollection = rawurlencode($collection);
    }

    /**
     * POST /v1/data/{collection} — Create a JSON document (max 64 KB UTF-8).
     */
    public function create(array $data, ?string $key = null): array
    {
        // Ensure empty PHP arrays serialize as JSON objects `{}` rather than `[]`.
        $payload = ['data' => (object) $data];
        if ($key !== null) {
            $payload['key'] = $key;
        }

        $res = $this->client->requestJson(
            'POST',
            '/v1/data/' . $this->encodedCollection,
            $payload
        );
        return $res['record'] ?? [];
    }

    /**
     * GET /v1/data/{collection} — List documents with deterministic pagination and filtering.
     *
     * @param array $options Optional ['limit' => 25, 'offset' => 0, 'order' => 'desc'|'asc', 'key' => '...', 'filter_field' => '...', 'filter_value' => '...']
     */
    public function list(array $options = []): array
    {
        $query = [];
        if (isset($options['limit'])) {
            $query['limit'] = (int) $options['limit'];
        }
        if (isset($options['offset'])) {
            $query['offset'] = (int) $options['offset'];
        }
        if (isset($options['order'])) {
            $query['order'] = (string) $options['order'];
        }
        if (isset($options['key'])) {
            $query['key'] = (string) $options['key'];
        }

        $filterField = $options['filter_field'] ?? $options['filterField'] ?? null;
        if ($filterField !== null) {
            $query['filter_field'] = (string) $filterField;
        }
        if (array_key_exists('filter_value', $options) || array_key_exists('filterValue', $options)) {
            $rawVal = array_key_exists('filter_value', $options) ? $options['filter_value'] : $options['filterValue'];
            if (is_bool($rawVal)) {
                $query['filter_value'] = $rawVal ? 'true' : 'false';
            } elseif ($rawVal === null) {
                $query['filter_value'] = 'null';
            } else {
                $query['filter_value'] = (string) $rawVal;
            }
        }

        $qs = http_build_query($query);
        $path = '/v1/data/' . $this->encodedCollection . ($qs !== '' ? '?' . $qs : '');
        return $this->client->requestJson('GET', $path);
    }

    /**
     * GET /v1/data/{collection}/{id} — Fetch a single document by UUID.
     */
    public function get(string $recordId): array
    {
        $res = $this->client->requestJson(
            'GET',
            '/v1/data/' . $this->encodedCollection . '/' . rawurlencode($recordId)
        );
        return $res['record'] ?? [];
    }

    /**
     * PATCH /v1/data/{collection}/{id} — Full replacement of document `data` (and optional `key`).
     */
    public function replace(string $recordId, array $data, ?string $key = null, bool $updateKey = false): array
    {
        $payload = ['data' => (object) $data];
        if ($key !== null || $updateKey) {
            $payload['key'] = $key;
        }

        $res = $this->client->requestJson(
            'PATCH',
            '/v1/data/' . $this->encodedCollection . '/' . rawurlencode($recordId),
            $payload
        );
        return $res['record'] ?? [];
    }

    /**
     * Alias for replace() — performs full document replacement of `data`.
     */
    public function update(string $recordId, array $data, ?string $key = null, bool $updateKey = false): array
    {
        return $this->replace($recordId, $data, $key, $updateKey);
    }

    /**
     * DELETE /v1/data/{collection}/{id} — Delete a document by UUID.
     */
    public function delete(string $recordId): array
    {
        return $this->client->requestJson(
            'DELETE',
            '/v1/data/' . $this->encodedCollection . '/' . rawurlencode($recordId)
        );
    }
}
