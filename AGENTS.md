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

## 12. GitHub and Git Workflow

This project must be maintained in Git and synchronized with my GitHub repository.

Follow these rules throughout development:

1. Always check the Git status before making changes.
2. Keep the project under Git version control.
3. After completing and testing a meaningful development milestone, prepare a Git commit.
4. Use clear, descriptive commit messages.
5. Push completed milestone commits to the connected GitHub repository after showing me the changes and obtaining my approval for the push.
6. Do not create meaningless commits just to increase contribution counts.
7. Do not commit temporary files, build outputs, dependencies, or unnecessary generated files.
8. Never commit `.env`, API keys, passwords, private credentials, database secrets, or other sensitive information.
9. Maintain a proper `.gitignore`.
10. Never force-push, rewrite published history, or delete remote branches without my explicit permission.
11. Never overwrite or discard existing work without checking first.
12. If Git reports a conflict or authentication error, explain the problem before attempting potentially destructive fixes.

### Commit message format

Use conventional, descriptive messages such as:

- `feat: add project management endpoints`
- `feat: integrate Supabase connection`
- `fix: correct API key validation`
- `docs: update API documentation`
- `refactor: simplify file upload handler`
- `test: add project API tests`

### Important

I want GitHub to reflect my actual development progress.

Commit meaningful, tested changes regularly, preferably after each completed milestone.

Do not make fake commits, manipulate commit dates, or generate artificial activity.

Always keep the repository clean, understandable, and presentable for my future developer portfolio.


## 13. Developer Documentation and Copy-Paste Code Examples

NEXUS must have developer-friendly API documentation.

The documentation should not merely explain what an endpoint does. Developers should be able to copy a working code example, provide their own credentials, and integrate the endpoint into their applications.

### A. Documentation Requirements

Every implemented API endpoint must have documentation containing:

1. Endpoint name and description.
2. HTTP method and URL.
3. Authentication requirements.
4. Required headers.
5. Required parameters.
6. Optional parameters.
7. Request body format.
8. Successful response example.
9. Possible error responses.
10. Ready-to-copy code examples.

Never document an endpoint that has not actually been implemented and tested.

### B. Supported Code Examples

Where applicable, provide examples for:

- HTML + Vanilla JavaScript.
- JavaScript (Fetch API).
- React.
- PHP.
- Laravel.
- Python.
- C# / Unity.

Use simple, practical examples that developers can copy directly into their projects.

Examples should include:
- Necessary imports.
- Required configuration.
- API endpoint.
- Authentication headers.
- Request construction.
- Error handling.
- Response handling.

Avoid incomplete pseudocode presented as working code.

Use clear placeholders such as YOUR_API_KEY and YOUR_PROJECT_ID.

### C. Copy Code Functionality

Every code example must have a Copy Code button.

Copied examples must preserve formatting and be ready to edit and use.

### D. Interactive API Testing

Where practical, implement a Try It feature.

It should allow developers to:
- Enter their project credentials.
- Provide required parameters.
- Upload test files when relevant.
- Execute requests against the actual NEXUS API.
- View HTTP status codes.
- View response JSON.
- View useful error messages.

Never expose administrator credentials, Supabase service-role keys, R2 credentials, or other privileged secrets in the browser.

Warn developers that browser-based API credentials are visible to users. Do not encourage putting secret keys into public HTML, React applications, mobile applications, or Unity builds.

For endpoints requiring privileged operations, use a safe server-side testing approach.

### E. Documentation Accuracy

Documentation must always reflect the actual implementation.

When an endpoint changes:
- Update its documentation.
- Update its code examples.
- Update request and response examples.
- Verify examples against the actual endpoint.

Do not invent endpoint functionality, request fields, or response properties.

### F. Documentation Design

Create a clean developer documentation interface with:

- Sidebar navigation.
- Searchable API reference.
- Organized endpoint categories.
- Language selectors for code examples.
- Copy Code buttons.
- Request and response examples.
- Try It functionality where appropriate.

Keep the documentation interface consistent with the NEXUS dashboard.

### G. Development Principle

Documentation is part of the feature, not an optional task to complete later.

An API endpoint is not considered fully complete until its documentation and practical code examples are available and verified.

## 14. AI-Friendly Documentation and AI IDE Integration

NEXUS documentation must be designed for both human developers and AI coding assistants.

The goal is to allow an AI coding assistant to understand NEXUS, discover its available services, retrieve integration instructions, and implement NEXUS features in another project with minimal manual guidance.

### A. OpenAPI Specification

Maintain a machine-readable OpenAPI specification.

Publish it at:

/openapi.json

It must describe:
- All implemented API endpoints.
- HTTP methods.
- Request parameters.
- Request body schemas.
- Authentication requirements.
- Response schemas.
- HTTP status codes.
- Error responses.
- Useful descriptions and examples.

Keep the specification synchronized with the actual API implementation.

Never document endpoints that do not exist.

### B. AI-Readable Documentation

Publish these resources:

/llms.txt
/llms-full.txt

`llms.txt` should be a concise documentation index containing:
- What NEXUS is.
- Available services.
- Authentication overview.
- API reference links.
- SDK documentation links.
- Integration guides.
- Security guidelines.
- Important implementation rules.

`llms-full.txt` should contain the complete consolidated documentation for AI assistants that prefer retrieving everything in one request.

Also provide individual Markdown documentation pages so AI assistants can retrieve only the relevant information.

### C. AI Integration Guide

Create an official AI integration guide explaining how an AI coding assistant should integrate NEXUS into an existing application.

It must explain:
1. How to discover available NEXUS services.
2. How to retrieve endpoint documentation.
3. How to select the correct SDK or integration method.
4. How to authenticate securely.
5. How to implement integrations using official examples.
6. How to handle errors.
7. How to test integrations.
8. What security practices must never be violated.

The guide must instruct AI assistants to use official NEXUS documentation instead of inventing endpoints, parameters, or implementation details.

### D. Code Examples

All API documentation must include verified code examples for supported environments where applicable.

Examples should be accessible individually and through the consolidated AI documentation.

### E. Future MCP Integration

Plan for a lightweight NEXUS documentation MCP server.

Its initial purpose should be read-only documentation access.

Potential tools:
- search_docs
- get_endpoint
- get_example
- get_sdk_guide

Do not implement MCP during the initial API development unless there is a clear practical need.

When implemented, it must expose documentation without exposing project secrets, private user data, or administrative infrastructure credentials.

### F. Documentation Maintenance

Whenever an API endpoint, SDK, authentication method, or integration example changes:

- Update the human-readable documentation.
- Update the OpenAPI specification.
- Update the relevant AI-readable documentation.
- Update code examples.
- Verify that the documentation matches the actual implementation.

Documentation must remain version-aware and must not silently describe outdated API behavior.

### G. Final Goal

A developer should be able to give an AI coding assistant the NEXUS documentation URL and ask it to integrate a NEXUS service into an existing project.

The assistant should be able to discover the correct implementation without requiring the developer to manually explain the NEXUS architecture every time.