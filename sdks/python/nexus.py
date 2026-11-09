"""
NEXUS Python SDK.
Lightweight, zero-dependency client using only the Python 3 standard library.

Security Rule:
Secret API keys (nx_sk_...) must only be used in server-side Python backends
or local scripts. Never embed secret API keys in client-side applications.
"""

from __future__ import annotations

import json
import mimetypes
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any, BinaryIO, Dict, List, Optional, Union

_UNSET = object()


class NexusError(Exception):
    """Raised when a NEXUS API request fails or returns success: false."""

    def __init__(
        self,
        message: str,
        status: int = 0,
        code: str = "NEXUS_ERROR",
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.request_id = request_id


class Nexus:
    """Client for the NEXUS REST API (v1)."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:8787",
        timeout: int = 30,
    ) -> None:
        if not api_key or not isinstance(api_key, str) or not api_key.strip():
            raise NexusError(
                "A valid NEXUS project API key (nx_sk_...) is required.",
                code="MISSING_API_KEY",
            )
        self.api_key = api_key.strip()
        self.base_url = (base_url or "http://localhost:8787").rstrip("/")
        self.timeout = max(1, int(timeout))
        self.files = _NexusFiles(self)

    def health(self) -> Dict[str, Any]:
        """GET /v1/health — Check API and database connectivity."""
        return self._request_json("GET", "/v1/health", auth=False)

    def me(self) -> Dict[str, Any]:
        """GET /v1/me — Verify project API key and retrieve project info."""
        return self._request_json("GET", "/v1/me")

    def data(self, collection: str) -> "_NexusDataCollection":
        """Returns a collection-scoped helper for /v1/data/{collection}."""
        if not collection or not isinstance(collection, str) or not collection.strip():
            raise NexusError("A valid collection name is required.", code="VALIDATION_ERROR")
        return _NexusDataCollection(self, collection.strip())

    def _request_json(
        self,
        method: str,
        path: str,
        body: Optional[Dict[str, Any]] = None,
        auth: bool = True,
        raw_body: Optional[bytes] = None,
        content_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers: Dict[str, str] = {"Accept": "application/json"}
        if auth:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload: Optional[bytes] = None
        if raw_body is not None:
            payload = raw_body
            if content_type:
                headers["Content-Type"] = content_type
        elif body is not None:
            payload = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=payload, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                status = resp.status
                raw_text = resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as err:
            status = err.code
            raw_text = err.read().decode("utf-8", errors="replace")
        except urllib.error.URLError as err:
            raise NexusError(f"NEXUS network error: {err.reason}", code="NETWORK_ERROR") from err

        try:
            parsed = json.loads(raw_text)
        except ValueError as err:
            raise NexusError(
                f"NEXUS request failed with HTTP {status}",
                status=status,
                code="HTTP_ERROR",
            ) from err

        if status >= 400 or not parsed.get("success"):
            error_obj = parsed.get("error") or {}
            meta_obj = parsed.get("meta") or {}
            raise NexusError(
                error_obj.get("message") or f"NEXUS request failed with HTTP {status}",
                status=status,
                code=error_obj.get("code") or "HTTP_ERROR",
                request_id=meta_obj.get("request_id"),
            )

        return parsed.get("data") or {}

    def _request_bytes(self, path: str, auth: bool = True) -> bytes:
        url = f"{self.base_url}{path}"
        headers: Dict[str, str] = {}
        if auth:
            headers["Authorization"] = f"Bearer {self.api_key}"

        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as err:
            raw_text = err.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw_text)
                error_obj = parsed.get("error") or {}
                meta_obj = parsed.get("meta") or {}
                raise NexusError(
                    error_obj.get("message") or f"Download failed with HTTP {err.code}",
                    status=err.code,
                    code=error_obj.get("code") or "HTTP_ERROR",
                    request_id=meta_obj.get("request_id"),
                ) from err
            except ValueError:
                raise NexusError(
                    f"Download failed with HTTP {err.code}",
                    status=err.code,
                    code="HTTP_ERROR",
                ) from err
        except urllib.error.URLError as err:
            raise NexusError(f"NEXUS network error: {err.reason}", code="NETWORK_ERROR") from err


class _NexusFiles:
    def __init__(self, client: Nexus) -> None:
        self._client = client

    def upload(
        self,
        file: Union[str, Path, bytes, BinaryIO],
        *,
        visibility: str = "private",
        filename: Optional[str] = None,
        mime_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """POST /v1/files/upload — Upload a file to Cloudflare R2."""
        if isinstance(file, (str, Path)):
            path_obj = Path(file)
            if not path_obj.is_file():
                raise NexusError(f"File not found: {path_obj}", code="VALIDATION_ERROR")
            file_bytes = path_obj.read_bytes()
            resolved_name = filename or path_obj.name
            resolved_mime = mime_type or mimetypes.guess_type(resolved_name)[0] or "application/octet-stream"
        elif isinstance(file, (bytes, bytearray)):
            file_bytes = bytes(file)
            resolved_name = filename or "file"
            resolved_mime = mime_type or "application/octet-stream"
        elif hasattr(file, "read"):
            raw = file.read()
            file_bytes = raw.encode("utf-8") if isinstance(raw, str) else bytes(raw)
            resolved_name = filename or getattr(file, "name", None) or "file"
            resolved_name = os.path.basename(str(resolved_name))
            resolved_mime = mime_type or mimetypes.guess_type(resolved_name)[0] or "application/octet-stream"
        else:
            raise NexusError(
                "file must be a path (str/Path), bytes, or a binary file-like object.",
                code="VALIDATION_ERROR",
            )

        boundary = f"----NexusBoundary{uuid.uuid4().hex}"
        body_parts = [
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{resolved_name}"\r\n'
            f"Content-Type: {resolved_mime}\r\n\r\n".encode("utf-8"),
            file_bytes,
            f"\r\n--{boundary}\r\n"
            f'Content-Disposition: form-data; name="visibility"\r\n\r\n'
            f"{visibility}\r\n"
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
        multipart_bytes = b"".join(body_parts)

        data = self._client._request_json(
            "POST",
            "/v1/files/upload",
            raw_body=multipart_bytes,
            content_type=f"multipart/form-data; boundary={boundary}",
        )
        return data.get("file") or {}

    def list(
        self,
        *,
        visibility: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """GET /v1/files — List uploaded files for this project."""
        params: Dict[str, str] = {}
        if visibility is not None:
            params["visibility"] = str(visibility)
        if limit is not None:
            params["limit"] = str(int(limit))

        qs = urllib.parse.urlencode(params)
        path = f"/v1/files?{qs}" if qs else "/v1/files"
        data = self._client._request_json("GET", path)
        return data.get("files") or []

    def get(self, file_id: str) -> Dict[str, Any]:
        """GET /v1/files/{id} — Get metadata and URLs for a single file."""
        encoded = urllib.parse.quote(str(file_id), safe="")
        data = self._client._request_json("GET", f"/v1/files/{encoded}")
        return data.get("file") or {}

    def update_visibility(self, file_id: str, visibility: str) -> Dict[str, Any]:
        """PATCH /v1/files/{id} — Update file visibility ('public' or 'private')."""
        encoded = urllib.parse.quote(str(file_id), safe="")
        data = self._client._request_json(
            "PATCH",
            f"/v1/files/{encoded}",
            body={"visibility": visibility},
        )
        return data.get("file") or {}

    def download(self, file_id: str) -> bytes:
        """GET /v1/files/{id}/content — Download binary content of an authorized file."""
        encoded = urllib.parse.quote(str(file_id), safe="")
        return self._client._request_bytes(f"/v1/files/{encoded}/content")

    def delete(self, file_id: str) -> Dict[str, Any]:
        """DELETE /v1/files/{id} — Delete file from R2 and database."""
        encoded = urllib.parse.quote(str(file_id), safe="")
        return self._client._request_json("DELETE", f"/v1/files/{encoded}")

    def public_url(self, file_id: str) -> str:
        """Returns the direct public stream URL for a file with visibility == 'public'."""
        encoded = urllib.parse.quote(str(file_id), safe="")
        return f"{self._client.base_url}/v1/public/files/{encoded}"


class _NexusDataCollection:
    """Project-scoped JSON document storage helper (/v1/data/{collection})."""

    def __init__(self, client: Nexus, collection: str) -> None:
        self._client = client
        self._encoded_col = urllib.parse.quote(collection, safe="")

    def create(self, data: Dict[str, Any], *, key: Optional[str] = None) -> Dict[str, Any]:
        """POST /v1/data/{collection} — Create a JSON document (max 64 KB UTF-8)."""
        payload: Dict[str, Any] = {"data": data}
        if key is not None:
            payload["key"] = key

        res = self._client._request_json("POST", f"/v1/data/{self._encoded_col}", body=payload)
        return res.get("record") or {}

    def list(
        self,
        *,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        order: Optional[str] = None,
        key: Optional[str] = None,
        filter_field: Optional[str] = None,
        filter_value: Optional[Union[str, int, float, bool]] = _UNSET,  # type: ignore[assignment]
    ) -> Dict[str, Any]:
        """GET /v1/data/{collection} — List documents with deterministic pagination and filtering."""
        params: Dict[str, str] = {}
        if limit is not None:
            params["limit"] = str(int(limit))
        if offset is not None:
            params["offset"] = str(int(offset))
        if order is not None:
            params["order"] = str(order)
        if key is not None:
            params["key"] = str(key)
        if filter_field is not None:
            params["filter_field"] = str(filter_field)
        if filter_value is not _UNSET:
            if isinstance(filter_value, bool):
                params["filter_value"] = "true" if filter_value else "false"
            elif filter_value is None:
                params["filter_value"] = "null"
            else:
                params["filter_value"] = str(filter_value)

        qs = urllib.parse.urlencode(params)
        path = f"/v1/data/{self._encoded_col}?{qs}" if qs else f"/v1/data/{self._encoded_col}"
        return self._client._request_json("GET", path)

    def get(self, record_id: str) -> Dict[str, Any]:
        """GET /v1/data/{collection}/{id} — Fetch a single document by UUID."""
        encoded_id = urllib.parse.quote(str(record_id), safe="")
        res = self._client._request_json("GET", f"/v1/data/{self._encoded_col}/{encoded_id}")
        return res.get("record") or {}

    def replace(
        self,
        record_id: str,
        data: Dict[str, Any],
        *,
        key: Any = _UNSET,
    ) -> Dict[str, Any]:
        """PATCH /v1/data/{collection}/{id} — Full replacement of document data (and optional key)."""
        encoded_id = urllib.parse.quote(str(record_id), safe="")
        payload: Dict[str, Any] = {"data": data}
        if key is not _UNSET:
            payload["key"] = key

        res = self._client._request_json(
            "PATCH",
            f"/v1/data/{self._encoded_col}/{encoded_id}",
            body=payload,
        )
        return res.get("record") or {}

    def update(
        self,
        record_id: str,
        data: Dict[str, Any],
        *,
        key: Any = _UNSET,
    ) -> Dict[str, Any]:
        """Alias for replace() — performs full document replacement of data."""
        return self.replace(record_id, data, key=key)

    def delete(self, record_id: str) -> Dict[str, Any]:
        """DELETE /v1/data/{collection}/{id} — Delete a document by UUID."""
        encoded_id = urllib.parse.quote(str(record_id), safe="")
        return self._client._request_json("DELETE", f"/v1/data/{self._encoded_col}/{encoded_id}")
