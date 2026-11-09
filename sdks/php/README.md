# NEXUS PHP / Laravel SDK

Lightweight, zero-dependency PHP 8+ client for connecting your PHP or Laravel backend applications (such as YATA or LEDGED) to NEXUS.

> **Security Rule:** Secret API keys (`nx_sk_...`) must only be used on your backend server. Never expose them in browser HTML, JavaScript bundles, mobile apps, or Unity builds.

---

## Installation

### Option A: Direct Include (Zero Setup)
```php
require_once __DIR__ . '/sdks/php/src/NexusClient.php';

use Nexus\NexusClient;
```

### Option B: Laravel / Composer Autoload
Add the local path repository or PSR-4 mapping in your Laravel project's `composer.json`:
```json
{
  "autoload": {
    "psr-4": {
      "Nexus\\": "../nexus/sdks/php/src/"
    }
  }
}
```
And configure `config/services.php`:
```php
'nexus' => [
    'key' => env('NEXUS_API_KEY'),
    'url' => env('NEXUS_URL', 'http://localhost:8787'),
],
```

---

## Quick Start

```php
<?php

use Nexus\NexusClient;
use Nexus\NexusException;

$nexus = new NexusClient(
    getenv('NEXUS_API_KEY'),
    getenv('NEXUS_URL') ?: 'http://localhost:8787'
);

// 1. Check API & database health
$health = $nexus->health();

// 2. Verify key and get project info
$me = $nexus->me();
echo "Connected project: " . $me['project']['slug'] . PHP_EOL;

// 3. Upload a file to Cloudflare R2
$asset = $nexus->files()->upload(__DIR__ . '/menu-photo.png', [
    'visibility' => 'public',
    'mimeType'   => 'image/png',
]);
echo "Public URL: " . $asset['public_url'] . PHP_EOL;

// 4. List files, toggle visibility, download, and delete
$files = $nexus->files()->list(['visibility' => 'public', 'limit' => 20]);
$nexus->files()->updateVisibility($asset['id'], 'private');
$bytes = $nexus->files()->download($asset['id']);
$nexus->files()->delete($asset['id']);

// 5. Project-scoped Document Storage (/v1/data/{collection}, max 64 KB UTF-8 JSON)
$notes = $nexus->data('notes');

$created = $notes->create(
    ['title' => 'Order Note', 'status' => 'open', 'priority' => 1],
    'order-note-1'
);

$listed = $notes->list([
    'limit'        => 25,
    'offset'       => 0,
    'order'        => 'desc',
    'filter_field' => 'status',
    'filter_value' => 'open',
]);

$fetched = $notes->get($created['id']);

// Full replacement of document `data` via PATCH
$replaced = $notes->replace(
    $created['id'],
    ['title' => 'Order Completed', 'status' => 'closed'],
    'order-note-1'
);

$notes->delete($created['id']);
```

