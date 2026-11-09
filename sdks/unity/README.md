# NEXUS C# / Unity SDK

Single-file, zero-dependency C# client (`NexusClient.cs`) for .NET 6+ game backends, Unity Dedicated Servers, Unity Editor scripts, and Unity game clients.

> **Security Rule for Unity Games:**
> **Never embed a secret API key (`nx_sk_...`) inside a shipped player client build.**
> - **In shipped Unity client builds:** Initialize `new NexusClient(apiKey: null, baseUrl: "...")` to download public files/textures (`Files.DownloadPublicAsync` / `Files.LoadPublicTextureCoroutine`), and route player saves or private uploads through your own game server.
> - **On a C# / Unity Dedicated Server or inside Unity Editor tools (`#if UNITY_EDITOR || UNITY_SERVER`):** Pass your project's `nx_sk_...` secret key to access `/v1/files/*` and `/v1/data/{collection}/*`.

---

## Installation

Copy [`NexusClient.cs`](./NexusClient.cs) into your Unity project (e.g. `Assets/Plugins/Nexus/NexusClient.cs`) or your .NET backend project. No external NuGet packages are required.

---

## Usage 1: Shipped Unity Game Client (Public Assets — No Secret Key)

```csharp
using Nexus;
using UnityEngine;

public class GameBannerLoader : MonoBehaviour
{
    private NexusClient _nexus;

    private void Awake()
    {
        // Safe for public builds: no API key is passed.
        _nexus = new NexusClient(apiKey: null, baseUrl: "http://localhost:8787");
    }

    public void LoadBanner(string publicFileId, Renderer targetRenderer)
    {
        StartCoroutine(_nexus.Files.LoadPublicTextureCoroutine(
            publicFileId,
            onLoaded: texture => targetRenderer.material.mainTexture = texture,
            onError: err => Debug.LogError($"Failed to load banner: {err}")
        ));
    }
}
```

---

## Usage 2: C# Game Server / Unity Dedicated Server / Editor Tool

```csharp
using System;
using System.Text;
using System.Threading.Tasks;
using Nexus;

public static class ServerExample
{
    public static async Task RunAsync()
    {
        var apiKey = Environment.GetEnvironmentVariable("NEXUS_API_KEY")!;
        var nexus = new NexusClient(apiKey, "http://localhost:8787");

        // 1. Verify project identity
        var me = await nexus.MeAsync();
        Console.WriteLine("Connected project: " + me.GetProperty("project").GetProperty("slug").GetString());

        // 2. Upload a file to Cloudflare R2
        byte[] bytes = Encoding.UTF8.GetBytes("level-config-v1");
        NexusMediaAsset asset = await nexus.Files.UploadAsync(
            bytes,
            filename: "level1.txt",
            mimeType: "text/plain",
            visibility: "public"
        );
        Console.WriteLine("Public URL: " + asset.PublicUrl);

        // 3. Store & query project-scoped JSON documents (/v1/data/{collection})
        var saves = nexus.Data("player_saves");

        NexusDataRecord save = await saves.CreateAsync(
            new { playerId = "p-100", level = 4, gold = 250 },
            key: "player-p-100"
        );

        NexusDataListResult list = await saves.ListAsync(
            limit: 25,
            order: "desc",
            filterField: "level",
            filterValue: "4"
        );

        // Full replacement of document data via PATCH
        NexusDataRecord updated = await saves.ReplaceAsync(
            save.Id,
            new { playerId = "p-100", level = 5, gold = 400 },
            key: "player-p-100"
        );

        await saves.DeleteAsync(save.Id);
        await nexus.Files.DeleteAsync(asset.Id);
    }
}
```

