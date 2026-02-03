// src/api/client.ts
import * as SecureStore from "expo-secure-store";

/**
 * SNAPI API Client (cloud-only)
 *
 * Base URL selection:
 * 1) EXPO_PUBLIC_API_BASE_URL (or EXPO_PUBLIC_BASE_URL) -> use it
 * 2) else -> DEFAULT_PROD_URL
 *
 * NOTE: Local LAN / localhost intentionally not supported.
 */
const DEFAULT_PROD_URL = "https://www.snapipro.com";

function clean(s: any) {
  return String(s ?? "").trim();
}

function joinUrl(base: string, path: string) {
  const b = clean(base).replace(/\/+$/, "");
  const p = clean(path);
  return `${b}${p.startsWith("/") ? p : `/${p}`}`;
}

function upperMethod(m?: string) {
  return clean(m || "GET").toUpperCase();
}

function safePreview(s: string, n = 1200) {
  const t = String(s || "");
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function makeError(message: string, extra?: any) {
  const err: any = new Error(message);
  if (extra && typeof extra === "object") Object.assign(err, extra);
  return err;
}

// ------------------------------
// Base URL + App Key (baked at build time)
// ------------------------------
const ENV_URL = clean(process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_BASE_URL);
export const BASE_URL = ENV_URL || DEFAULT_PROD_URL;

// App-level auth for /app/api/* routes
const APP_KEY = clean(process.env.EXPO_PUBLIC_SNAPI_APP_KEY);

// Debug (safe): do not leak full key
console.log("[api] BASE_URL =", BASE_URL);
console.log("[api] APP_KEY len =", APP_KEY.length, "| prefix =", APP_KEY ? APP_KEY.slice(0, 3) : "(none)");

// ------------------------------
// Device ID (persisted)
// ------------------------------
const DEVICE_ID_KEY = "snapi.device.id.v1";

function makeDeviceId() {
  return `snapi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;

    const id = makeDeviceId();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return makeDeviceId();
  }
}

export type ApiFetchInit = RequestInit & {
  timeoutMs?: number; // fail-fast timeout (ms)
  // optional: if you ever want to silence logs per-call
  quiet?: boolean;
};

// ------------------------------
// Header builder (FORCE SNAPI headers last)
// ------------------------------
function headersToObject(h?: RequestInit["headers"]): Record<string, string> {
  const out: Record<string, string> = {};

  if (!h) return out;

  if (h instanceof Headers) {
    h.forEach((value, key) => (out[String(key)] = String(value)));
    return out;
  }

  if (Array.isArray(h)) {
    for (const [k, v] of h) out[String(k)] = String(v);
    return out;
  }

  // object
  for (const [k, v] of Object.entries(h as any)) out[String(k)] = String(v as any);
  return out;
}

function buildHeaders(initHeaders: RequestInit["headers"] | undefined, deviceId: string, hasBody: boolean) {
  const merged: Record<string, string> = headersToObject(initHeaders);

  // Defaults
  if (!merged["Accept"]) merged["Accept"] = "application/json";

  // Default JSON content-type when sending a body (unless caller explicitly set it)
  if (hasBody && !merged["Content-Type"]) merged["Content-Type"] = "application/json";

  // FORCE SNAPI headers LAST so nothing can overwrite them
  merged["x-snapi-device"] = deviceId;

  // Only attach key if present (and required for /app/api/*)
  if (APP_KEY) merged["x-snapi-app-key"] = APP_KEY;

  return merged;
}

// ------------------------------
// apiFetch
// ------------------------------
async function readBodySafely(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  // Some 204/empty responses will throw on res.json()
  try {
    if (isJson) return await res.json();
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * apiFetch(path, init)
 * - Prefixes BASE_URL
 * - Adds x-snapi-device header
 * - Adds x-snapi-app-key (EXPO_PUBLIC_SNAPI_APP_KEY) when present
 * - Enforces app key presence for /app/api/* calls (fail-fast)
 * - Uses AbortController timeout so calls don't hang forever on real devices
 * - Throws a rich Error for non-2xx
 */
export async function apiFetch(path: string, init: ApiFetchInit = {}) {
  const p = clean(path);
  const url = joinUrl(BASE_URL, p);

  // Fail fast: /app/api/* requires app key
  if (p.startsWith("/app/api/") && !APP_KEY) {
    throw makeError("App key missing (EXPO_PUBLIC_SNAPI_APP_KEY).", {
      code: "MISSING_APP_KEY",
      path: p,
      url,
      baseUrl: BASE_URL,
    });
  }

  const deviceId = await getDeviceId();
  const hasBody = init.body !== undefined && init.body !== null;

  const headers = buildHeaders(init.headers, deviceId, Boolean(hasBody));

  const timeoutMs = Number(init.timeoutMs ?? 12000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const quiet = Boolean(init.quiet);

  try {
    if (!quiet) {
      console.log("[api] ->", upperMethod(init.method), url, "| keyLen=", APP_KEY.length, "| device=", deviceId);
    }

    const res = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (!quiet) console.log("[api] <-", res.status, res.ok ? "OK" : "ERR", url);

    const data = await readBodySafely(res);

    if (!res.ok) {
      // On error, log a safe preview if text
      if (!quiet && typeof data === "string" && data) {
        console.log("[api] error body =", safePreview(data));
      }

      const message =
        (data && typeof data === "object" && (data.error || data.message)) ||
        `Request failed (${res.status})`;

      throw makeError(message, {
        status: res.status,
        body: data,
        code: (data && typeof data === "object" && (data as any).code) || undefined,
        url,
        path: p,
        baseUrl: BASE_URL,
      });
    }

    return data;
  } catch (e: any) {
    const aborted =
      e?.name === "AbortError" || clean(e?.message).toLowerCase().includes("aborted");

    throw makeError(
      aborted ? "Server not reachable. Please try again." : "Network error. Check connectivity and try again.",
      {
        cause: e,
        code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
        url,
        path: p,
        baseUrl: BASE_URL,
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

// Optional convenience wrappers (if you want them later)
// export const apiGet = (path: string, init: ApiFetchInit = {}) => apiFetch(path, { ...init, method: "GET" });
// export const apiPost = (path: string, body: any, init: ApiFetchInit = {}) =>
//   apiFetch(path, { ...init, method: "POST", body: JSON.stringify(body) });
