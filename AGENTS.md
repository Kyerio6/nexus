# NEXUS — Main Project Instructions

## 1. Project Overview

Build **NEXUS**, a personal API infrastructure platform that I can reuse across my own applications and projects.

NEXUS will act as a centralized backend toolbox. Instead of implementing the same infrastructure repeatedly for every project, I want my applications to connect to NEXUS through a simple REST API.

My projects may include:
- YATA — food ordering and delivery application.
- LEDGED — gamified digital asset marketplace.
- Unity games and applications.
- BeginAgain — chat-history and AI-related application.
- Other future personal projects.

NEXUS is intended for my personal development use. It is NOT an enterprise SaaS platform, a public developer marketplace, or a commercial multi-tenant infrastructure service.

The goal is to build something reliable, reusable, affordable, understandable, and easy to maintain.

## 2. Core Development Philosophy

**Simplicity is the highest priority.**

Follow these rules throughout development:

1. Always choose the simplest solution that correctly solves the problem.
2. Write clean, readable, beginner-friendly code.
3. Avoid unnecessary abstractions, design patterns, classes, interfaces, and layers.
4. Do not create additional files, folders, modules, or services unless they serve a real purpose.
5. Do not introduce dependencies without explaining why they are needed.
6. Do not implement features that are not currently required.
7. Do not turn simple functionality into complicated systems.
8. Prefer managed services over building and maintaining infrastructure ourselves.
9. Keep the architecture modular but straightforward.
10. Do not redesign the architecture or replace technologies without asking for approval.

I want to understand and maintain the code myself. Do not generate code that requires an unnecessarily complicated explanation to understand.

If there are multiple ways to implement something, briefly explain the options and recommend the simplest maintainable approach.

## 3. Technology Stack

Use the following technologies unless a genuine technical limitation requires a discussion first.

### Backend
- JavaScript.
- Cloudflare Workers.
- REST API.
- JSON responses.
- Supabase for PostgreSQL database and managed authentication.
- Cloudflare R2 for file and image storage.

### Developer Dashboard
- React.
- Vite.
- JavaScript (JSX).
- Plain CSS or CSS modules.
- No unnecessary UI frameworks.

### SDKs

Eventually, NEXUS should have lightweight SDKs for:

- JavaScript / TypeScript.
- PHP / Laravel.
- C# / Unity.
- Python.

These SDKs should simply make requests to the NEXUS REST API. Do not build complicated SDK frameworks.

Build them incrementally. Do not implement all SDKs before the core API works.

### Development and Deployment
- Git and GitHub.
- Cloudflare Wrangler for deployment.
- GitHub Actions only when useful.
- Environment variables for secrets and configuration.

Use free-tier services whenever practical. Avoid paid services unless necessary. Clearly identify potential costs before introducing a paid dependency.

## 4. Basic Architecture

Keep the architecture simple:

My applications connect to the NEXUS API.

NEXUS API handles requests and communicates with:
- Supabase — database and authentication.
- Cloudflare R2 — files and images.

The developer dashboard communicates with the NEXUS API.

Initially, use:
- One Cloudflare Worker.
- One NEXUS API.
- One developer dashboard.
- One Supabase project for NEXUS platform data.
- One R2 storage configuration.

Do not introduce microservices, multiple backend deployments, Kubernetes, message brokers, or complicated infrastructure.

Use a modular monolithic architecture. Keep related functionality organized in simple modules within the same application.

## 5. Core Features

Build these features gradually, in the following order.

### Phase 1 — Core Foundation

- Initialize the NEXUS repository.
- Configure the Cloudflare Worker.
- Establish the REST API structure.
- Implement basic health/status endpoint.
- Implement consistent JSON responses.
- Configure environment variables.
- Connect to Supabase.
- Create the initial database schema.

### Phase 2 — Projects and API Keys

NEXUS must support multiple personal projects.

Each project should have:
- Project ID.
- Project name.
- Project slug.
- Description.
- Creation date.
- Status.

Implement API key management:
- Generate secure random API keys.
- Associate each key with a project.
- Store only the cryptographic hash of the secret.
- Show the full secret only once when generated.
- Allow keys to be revoked.
- Support basic permissions where necessary.

Every API request must be associated with the correct project.

Never trust a client-provided project ID as proof of authorization. Derive the authorized project from the validated API key or authenticated session.

### Phase 3 — Authentication and Security

Use Supabase Auth instead of implementing a custom authentication system.

Implement the necessary authorization checks for:
- NEXUS dashboard administrators.
- Project API access.
- Authenticated application users, where required.

Security requirements:
- Never expose Supabase service-role credentials.
- Never expose R2 privileged credentials.
- Never embed secret API keys in Unity builds, mobile applications, or frontend code.
- Validate incoming requests.
- Apply reasonable rate limits.
- Keep project data isolated.
- Avoid arbitrary SQL execution through public endpoints.
- Record important security and administrative events.

For public clients such as Unity games, use restricted public credentials and authenticated user sessions where appropriate. Sensitive operations must be validated on the server.

Do not build an unnecessarily elaborate permission system.

### Phase 4 — Database API

Provide a straightforward way for my applications to interact with their backend data.

Use Supabase PostgreSQL.

The API should support explicitly defined and authorized operations rather than unrestricted database access.

Do not expose arbitrary SQL queries or unrestricted table access to API consumers.

Keep NEXUS platform data separate from individual application data.

Discuss the simplest practical database ownership and isolation strategy before implementing application data access.

### Phase 5 — File and Image Storage

Integrate Cloudflare R2.

Applications should be able to:
- Upload files.
- Retrieve files.
- Delete files.
- Access public files.
- Access private files through authorized requests.

Store file metadata in Supabase, not the actual binary files.

Metadata may include:
- Asset ID.
- Project ID.
- Original filename.
- Storage key.
- MIME type.
- File size.
- Visibility.
- Upload date.

Use secure upload mechanisms, such as short-lived presigned URLs, when appropriate.

For images, support common image formats and basic optimization.

Possible image variants:
- Thumbnail.
- Small.
- Medium.
- Large.
- Original.

Avoid implementing an elaborate image-processing pipeline. Use managed Cloudflare capabilities where appropriate.

### Phase 6 — Developer Dashboard

Build a simple React + Vite dashboard.

Initial pages:

1. Overview — basic platform status.
2. Projects — create and manage projects.
3. API Keys — generate, view metadata, and revoke keys.
4. Media Library — view uploaded assets.
5. Usage / Logs — basic request and activity information.
6. Documentation — API usage and examples.
7. Settings — basic account and platform settings.

The dashboard should be functional, clean, and easy to navigate.

Do not prioritize elaborate animations, visual effects, or complicated UI systems.

Never connect the dashboard directly to privileged infrastructure credentials. Use the NEXUS API and authenticated administrative access.

### Phase 7 — SDK Development

Once the API is stable, create lightweight SDKs.

Suggested order:

1. JavaScript.
2. PHP / Laravel.
3. C# / Unity.
4. Python.

Each SDK should provide simple methods for interacting with the NEXUS API.

For example:

JavaScript:
const nexus = new Nexus("PROJECT_API_KEY");
await nexus.files.upload(file);

Unity:
await nexus.Files.Upload(texture);

PHP:
$nexus = new NexusClient("PROJECT_API_KEY");
$nexus->files()->upload($file);

Python:
nexus = Nexus("PROJECT_API_KEY")
nexus.files.upload(file)

These are illustrative examples, not mandatory API signatures. Keep the actual SDKs consistent with the final API design.

## 6. API Design Standards

Use versioned REST endpoints.

Start with:

/v1

Examples:

GET /v1/health

GET /v1/projects

POST /v1/projects

GET /v1/projects/{id}

POST /v1/projects/{id}/keys

DELETE /v1/keys/{id}

POST /v1/files/upload

GET /v1/files

DELETE /v1/files/{id}

Adjust endpoint names when needed, but keep naming consistent and predictable.

Use a consistent JSON response format.

Successful response example:

{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "uuid",
    "version": "v1"
  },
  "error": null
}

Error response example:

{
  "success": false,
  "data": null,
  "meta": {
    "request_id": "uuid",
    "version": "v1"
  },
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found."
  }
}

Use appropriate HTTP status codes.

Keep API documentation updated as endpoints are implemented.

## 7. Database Guidelines

Use PostgreSQL through Supabase.

Start with only the tables that are genuinely needed.

The initial platform schema should be minimal. Likely starting tables:

- projects
- api_keys
- media_assets

Supabase Auth should handle user authentication.

Additional tables should only be introduced when an implemented feature requires them.

Use:
- UUID primary keys.
- Foreign key constraints.
- Appropriate indexes.
- UTC timestamps.
- JSONB only when flexible structured data is genuinely useful.

Do not create speculative tables for features that have not been implemented.

## 8. Future Features — Do Not Implement Yet

These are possible future additions:

- Email notifications.
- Push notifications.
- Background jobs.
- Webhooks.
- Video hosting.
- Advanced analytics.
- More detailed usage tracking.
- Additional storage integrations.

Do not implement these during the initial development.

Only introduce them when an actual project needs them.

## 9. Development Workflow

Work incrementally.

Do not generate the entire platform in one response or one massive implementation.

Follow this workflow:

1. Inspect the existing project before making changes.
2. Explain the next implementation step.
3. Identify the files that need to be created or modified.
4. Explain any important technical decisions in beginner-friendly language.
5. Implement only the current phase.
6. Test the implementation.
7. Fix errors before proceeding.
8. Update documentation when necessary.
9. Summarize what was completed and what comes next.

Never silently skip tests or claim that something works without verifying it.

When modifying existing code:
- Preserve working functionality.
- Avoid unnecessary rewrites.
- Avoid unrelated changes.
- Keep the code consistent with the existing project.

If a decision could significantly affect the architecture, security, cost, or future maintainability, stop and ask for my approval before proceeding.

## 10. Cost Awareness

NEXUS should prioritize free infrastructure.

Before introducing any service or feature:
- Identify whether it has a free tier.
- Explain its relevant limitations.
- Identify possible usage-based charges.
- Recommend the most affordable reasonable option.

Do not assume that a free tier will always remain free.

Do not introduce paid services just because they are convenient.

## 11. Final Development Principle

NEXUS is my personal developer toolbox.

I want one dependable platform that allows my applications to reuse common backend infrastructure without having to rebuild everything.

I do not need enterprise architecture.

I do not need unnecessary abstractions.

I do not need features that sound impressive but solve no current problem.

I need straightforward, secure, maintainable software that I can understand and continue developing myself.

**Always prioritize simplicity, reliability, security, and maintainability over complexity and feature count.**