# NEXUS JavaScript / TypeScript SDK

Lightweight, zero-dependency SDK for connecting your Node.js, Cloudflare Worker, or backend JavaScript applications to NEXUS.

> **Security Rule:** Secret API keys (`nx_sk_...`) must only be used on trusted servers. Never bundle a secret API key into public HTML, React frontends, mobile apps, or Unity builds.

## Quick Start

```js
import { Nexus } from "./sdks/js/index.js";

const nexus = new Nexus(process.env.NEXUS_API_KEY, {
  baseUrl: process.env.NEXUS_URL || "http://localhost:8787",
});

// 1. Check API & database health
const health = await nexus.health();

// 2. Verify key and get project info
const { project } = await nexus.me();
console.log("Connected project:", project.slug);

// 3. Upload a file to Cloudflare R2
const asset = await nexus.files.upload(new TextEncoder().encode("Hello NEXUS"), {
  filename: "hello.txt",
  mimeType: "text/plain",
  visibility: "public",
});
console.log("Uploaded asset ID:", asset.id);
console.log("Public URL:", asset.public_url);

// 4. List files for this project
const files = await nexus.files.list({ visibility: "public", limit: 20 });

// 5. Toggle visibility to private
await nexus.files.updateVisibility(asset.id, "private");

// 6. Download binary content (ArrayBuffer)
const buffer = await nexus.files.download(asset.id);

// 7. Delete file
await nexus.files.delete(asset.id);
```

