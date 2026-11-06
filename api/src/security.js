import { error } from "./response.js";

// Simple per-IP in-memory rate-limit counters (used when Cloudflare's RATE_LIMITER binding isn't present).
const memoryWindows = new Map();
const WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 60;

export function resetMemoryRateLimiter() {
  memoryWindows.clear();
}

// Checks whether the caller has exceeded the rate limit.
// Returns null when allowed, or a 429 Response when blocked.
export async function checkRateLimit(request, env, requestId) {
  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "local";

  // 1. Prefer Cloudflare Workers' built-in Rate Limiting binding when available.
  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function") {
    const { success } = await env.RATE_LIMITER.limit({ key: clientIp });
    if (!success) {
      return error(requestId, 429, "RATE_LIMITED", "Too many requests. Please slow down.");
    }
    return null;
  }

  // 2. Fallback in-memory counter per IP (1-minute window).
  const maxRequests = Number(env.RATE_LIMIT_MAX) || DEFAULT_MAX_REQUESTS;
  const now = Date.now();
  const entry = memoryWindows.get(clientIp);

  if (!entry || now - entry.start >= WINDOW_MS) {
    memoryWindows.set(clientIp, { start: now, count: 1 });
    return null;
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    return error(requestId, 429, "RATE_LIMITED", "Too many requests. Please slow down.");
  }

  return null;
}

// Builds CORS headers for browser requests (such as the NEXUS developer dashboard).
// Allowed origins come from env.CORS_ORIGIN (comma-separated), defaulting to local Vite dev URLs.
export function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (!origin) return {};

  const allowedList = (env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (!allowedList.includes("*") && !allowedList.includes(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": allowedList.includes("*") ? "*" : origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// Responds to browser OPTIONS preflight requests.
export function handleCorsPreflight(request, env) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, env),
  });
}

// Attaches CORS headers (if applicable) to an existing Response.
export function withCors(response, request, env) {
  const extra = getCorsHeaders(request, env);
  if (Object.keys(extra).length === 0) return response;

  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(extra)) {
    headers.set(k, v);
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

