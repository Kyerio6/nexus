# NEXUS Python SDK

Lightweight, zero-dependency Python 3.8+ SDK (`nexus.py`) for connecting your Python backend services, AI pipelines (such as BeginAgain), or automation scripts to NEXUS.

> **Security Rule:** Secret API keys (`nx_sk_...`) must only be used in server-side Python backends or local scripts. Never embed secret API keys in client-side applications.

---

## Installation

Copy [`nexus.py`](./nexus.py) directly into your project, or install the folder in editable mode:

```bash
pip install -e ./sdks/python
```

No external packages (`requests`, `httpx`, etc.) are required — it uses only the Python standard library.

---

## Quick Start

```python
import os
from nexus import Nexus, NexusError

nexus = Nexus(
    os.environ["NEXUS_API_KEY"],
    base_url=os.environ.get("NEXUS_URL", "http://localhost:8787"),
)

# 1. Check API & database health
health = nexus.health()

# 2. Verify key and get project info
me = nexus.me()
print("Connected project:", me["project"]["slug"])

# 3. Upload a file to Cloudflare R2
asset = nexus.files.upload(
    b"Hello from BeginAgain",
    filename="greeting.txt",
    mime_type="text/plain",
    visibility="public",
)
print("Public URL:", asset["public_url"])

# 4. List files, toggle visibility, download, and delete
files = nexus.files.list(visibility="public", limit=20)
nexus.files.update_visibility(asset["id"], "private")
content_bytes = nexus.files.download(asset["id"])
nexus.files.delete(asset["id"])

# 5. Project-scoped Document Storage (/v1/data/{collection}, max 64 KB UTF-8 JSON)
sessions = nexus.data("chat_sessions")

created = sessions.create(
    {"title": "Session #1", "status": "active", "turns": 3},
    key="session-1",
)

listed = sessions.list(
    limit=25,
    offset=0,
    order="desc",
    filter_field="status",
    filter_value="active",
)

fetched = sessions.get(created["id"])

# Full replacement of document `data` via PATCH
replaced = sessions.replace(
    created["id"],
    {"title": "Session #1 (Archived)", "status": "archived"},
    key="session-1",
)

sessions.delete(created["id"])
```
