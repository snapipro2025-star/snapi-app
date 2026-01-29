// src/api/client.ts
import * as SecureStore from "expo-secure-store";

/**
 * SNAPI API Client (cloud-only)
 *
 * Base URL selection:
 * 1) If EXPO_PUBLIC_API_BASE_URL (or EXPO_PUBLIC_BASE_URL) is set -> use it
 * 2) Else -> use DEFAULT_PROD_URL
 *
 * NOTE: Local LAN / localhost is intentionally not supported.
 */
const DEFAULT_PROD_URL = "https://www.snapipro.com";

const ENV_URL = String(
  process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_BASE_URL || ""
).trim();

// ✅ single source of truth (cloud-only)
export const BASE_URL = ENV_URL || DEFAULT_PROD_URL;

// ✅ Mobile App Key (app-level auth for /app/api/*)
const APP_KEY = String(process.env.EXPO_PUBLIC_SNAPI_APP_KEY || "").trim();

// ✅ DEBUG: keep during bring-up; remove later if you want quieter logs
console.log("[api] ENV_URL =", ENV_URL || "(unset)");
console.log("[api] BASE_URL =", BASE_URL);
console.log(
  "[api] APP_KEY len/prefix =",
  APP_KEY.length,
  APP_KEY ? APP_KEY.slice(0, 3) : ""
);

// --- Device ID (persisted) ---
const DEVICE_ID_KEY = "snapi.device.id.v1";

function makeDeviceId() {
  return `snapi-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

async function getDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;

    const id = makeDeviceId();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // If SecureStore fails (rare), still provide an ID for this run
    return makeDeviceId();
  }
}

// --- URL helper ---
function joinUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "");
  return `${b}${p.startsWith("/") ? p : `/${p}`}`;
}

// --- Error helper ---
function makeError(message: string, extra?: any) {
  const err: any = new Error(message);
  if (extra && typeof extra === "object") Object.assign(err, extra);
  return err;
}

export type ApiFetchInit = RequestInit & {
  timeoutMs?: number; // fail-fast timeout (ms)
};

// --- helpers ---
function upperMethod(m?: string) {
  return String(m || "GET").toUpperCase();
}

function safePreview(s: string, n = 1000) {
  const t = String(s || "");
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/**
 * Merge headers safely (supports Headers | object | array)
 * and then FORCE SNAPI headers so they cannot be accidentally overwritten.
 */
function buildHeaders(
  initHeaders: RequestInit["headers"] | undefined,
  deviceId: string
): Record<string, string> {
  const merged: Record<string, string> = {};

  // 1) start with any caller-provided headers
  if (initHeaders) {
    if (initHeaders instanceof Headers) {
      initHeaders.forEach((value, key) => {
        merged[String(key)] = String(value);
      });
    } else if (Array.isArray(initHeaders)) {
      for (const [key, value] of initHeaders) {
        merged[String(key)] = String(value);
      }
    } else {
      Object.assign(merged, initHeaders);
    }
  }

  // 2) enforce defaults
  if (!merged["Accept"]) merged["Accept"] = "application/json";

  // 3) enforce SNAPI headers (cannot be overridden by init.headers)
  merged["x-snapi-device"] = deviceId;
  if (APP_KEY) merged["x-snapi-app-key"] = APP_KEY;

  return merged;
}

/**
 * apiFetch(path, init)
 * - Prefixes BASE_URL
 * - Adds x-snapi-device header
 * - Adds x-snapi-app-key header (EXPO_PUBLIC_SNAPI_APP_KEY) when present
 * - Defaults Content-Type to application/json when body is present
 * - Uses AbortController timeout so calls don't hang forever on real devices
 * - Throws a rich Error for non-2xx
 * - Logs status + (on error) response body text (safe preview)
 */
export async function apiFetch(path: string, init: ApiFetchInit = {}) {
  const url = joinUrl(BASE_URL, path);
  const deviceId = await getDeviceId();

  const headers = buildHeaders(init.headers, deviceId);

  // Default JSON content-type when sending a body
  if (!headers["Content-Type"] && init.body) {
    headers["Content-Type"] = "application/json";
  }

  // Require the key for /app/api/* calls (fail fast)
  if (path.startsWith("/app/api/") && !APP_KEY) {
    throw makeError("App key missing (EXPO_PUBLIC_SNAPI_APP_KEY).", {
      code: "MISSING_APP_KEY",
      path,
      url,
      baseUrl: BASE_URL,
    });
  }

  const timeoutMs = Number(init.timeoutMs ?? 12000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;

  try {
    console.log(
      "[api] ->",
      upperMethod(init.method),
      url,
      "| hasKey=",
      Boolean(headers["x-snapi-app-key"])
    );

    res = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    console.log("[api] <-", res.status, res.ok ? "OK" : "ERR", url);

    if (!res.ok) {
      try {
        const clone = res.clone();
        const txt = await clone.text();
        if (txt) console.log("[api] error body =", safePreview(txt, 1200));
      } catch {
        // ignore
      }
    }
  } catch (e: any) {
    const aborted =
      e?.name === "AbortError" ||
      String(e?.message || "").toLowerCase().includes("aborted");

    throw makeError(
      aborted
        ? "Server not reachable. Please try again."
        : "Network error. Check connectivity and try again.",
      {
        cause: e,
        code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
        url,
        path,
        baseUrl: BASE_URL,
      }
    );
  } finally {
    clearTimeout(timer);
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let data: any = null;
  try {
    data = isJson ? await res.json() : await res.text();
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) || `Request failed (${res.status})`;

    throw makeError(message, {
      status: res.status,
      body: data,
      code: data?.code,
      url,
      path,
      baseUrl: BASE_URL,
    });
  }

  return data;
}
