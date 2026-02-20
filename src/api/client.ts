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

// ------------------------------
// Helpers
// ------------------------------
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

// ------------------------------
// Session Tokens (persisted)
// ------------------------------
const ACCESS_KEY = "snapi_access_token";
const REFRESH_KEY = "snapi_refresh_token";

export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_KEY);
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}

// ------------------------------
// Session State (in-memory)
// ------------------------------
export type SessionState = {
  hydrated: boolean;
  isAuthed: boolean;
  accessToken?: string; // optional (we don’t log it)
};

let _session: SessionState = {
  hydrated: false,
  isAuthed: false,
};

export function getSession(): SessionState {
  return _session;
}

/**
 * Hydrate session from SecureStore (call once on app startup).
 * This prevents the “login twice / wrong screen” race where navigation
 * decides before tokens are loaded.
 */
export async function hydrateSession(): Promise<SessionState> {
  try {
    const access = await SecureStore.getItemAsync(ACCESS_KEY);
    const refresh = await SecureStore.getItemAsync(REFRESH_KEY);

    _session = {
      hydrated: true,
      isAuthed: !!access && !!refresh,
      accessToken: access || undefined,
    };

    return _session;
  } catch {
    _session = { hydrated: true, isAuthed: false };
    return _session;
  }
}

export async function setTokens(accessToken: string, refreshToken: string) {
  const a = String(accessToken || "");
  const r = String(refreshToken || "");

  await SecureStore.setItemAsync(ACCESS_KEY, a);
  await SecureStore.setItemAsync(REFRESH_KEY, r);

  // ✅ keep in-memory session consistent immediately
  _session = { hydrated: true, isAuthed: !!a && !!r, accessToken: a || undefined };
}

export async function clearTokens() {
  try {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {}

  // ✅ keep in-memory session consistent immediately
  _session = { hydrated: true, isAuthed: false };
}

/**
 * Refresh session by calling your backend refresh endpoint.
 * Returns true if refresh succeeded and tokens are updated.
 */
export async function refreshSession(): Promise<boolean> {
  const refresh = await getRefreshToken();
  if (!refresh) return false;

  try {
    // Note: refresh endpoint might or might not require Authorization.
    // We call it quiet, and it will include x-snapi-app-key + device headers.
    const r = await apiFetch("/mobile/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
      quiet: true,
      timeoutMs: 12000,
    });

    if (r?.ok === false) return false;

    const accessToken =
      r?.accessToken || r?.access_token || r?.token || r?.access || r?.session?.accessToken || "";
    const refreshToken =
      r?.refreshToken || r?.refresh_token || r?.refresh || r?.session?.refreshToken || "";

    if (!accessToken || !refreshToken) return false;

    await setTokens(accessToken, refreshToken);
    return true;
  } catch {
    return false;
  }
}

export type ApiFetchInit = RequestInit & {
  timeoutMs?: number; // fail-fast timeout (ms)
  quiet?: boolean;
};

// ------------------------------
// Header builder (FORCE SNAPI headers last)
// ------------------------------
function headersToObject(h?: RequestInit["headers"]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;

  if (h instanceof Headers) {
    h.forEach((value: string, key: string) => {
      out[String(key)] = String(value);
    });
    return out;
  }

  if (Array.isArray(h)) {
    for (const [k, v] of h) out[String(k)] = String(v);
    return out;
  }

  for (const [k, v] of Object.entries(h as any)) out[String(k)] = String(v as any);
  return out;
}

function buildHeaders(
  initHeaders: RequestInit["headers"] | undefined,
  deviceId: string,
  hasBody: boolean
) {
  const merged: Record<string, string> = headersToObject(initHeaders);

  // Defaults
  if (!merged["Accept"]) merged["Accept"] = "application/json";

  // If body exists and caller did not specify content-type, default to JSON.
  // IMPORTANT: allow callers to override with x-www-form-urlencoded, etc.
  if (hasBody && !merged["Content-Type"] && !merged["content-type"]) {
    merged["Content-Type"] = "application/json";
  }

  // Normalize Content-Type key casing if caller used lowercase
  if (!merged["Content-Type"] && merged["content-type"]) {
    merged["Content-Type"] = merged["content-type"];
    delete merged["content-type"];
  }

  // FORCE SNAPI headers LAST so nothing can overwrite them
  // Keep BOTH headers to be compatible with existing server expectations
  merged["x-snapi-device-id"] = deviceId;
  merged["x-snapi-device"] = deviceId;

  // App key header
  if (APP_KEY) merged["x-snapi-app-key"] = APP_KEY;

  return merged;
}

// ------------------------------
// Response parsing
// ------------------------------
async function readBodySafely(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  try {
    if (isJson) return await res.json();
    return await res.text();
  } catch {
    return null;
  }
}

// ------------------------------
// De-dupe / debounce for /app/api/block
// ------------------------------
const _blockInflight = new Map<string, Promise<any>>();
const _blockLastAt = new Map<string, number>();

function parseJsonBody(body: any) {
  if (!body) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (typeof body === "object") return body;
  return null;
}

/**
 * apiFetch(path, init)
 * - Prefixes BASE_URL
 * - Adds x-snapi-device-id header
 * - Adds x-snapi-app-key when present
 * - Adds Authorization: Bearer <accessToken> for /mobile/* routes (fixes 401 on mobile rules)
 * - Enforces app key presence for /app/api/* calls (fail-fast)
 * - Uses AbortController timeout so calls don't hang forever on real devices
 * - Throws a rich Error for non-2xx (and does NOT mask it as "network error")
 * - Debounces + de-dupes /app/api/block to prevent accidental double-toggle
 * - Retries /mobile/* once on 401 after refreshSession()
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
  const method = upperMethod(init.method);

  // ✅ Attach Bearer token for /mobile/* routes
  if (p.startsWith("/mobile/") || p.startsWith("/app/api/")) {
    const access = await getAccessToken();
    if (access) headers["Authorization"] = `Bearer ${access}`;
  }

  const timeoutMs = Number(init.timeoutMs ?? 12000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const quiet = Boolean(init.quiet);

  const doFetch = async (hdrs: Record<string, string>) => {
    if (!quiet) {
      console.log("[api] ->", method, url, "| keyLen=", APP_KEY.length, "| device=", deviceId);
    }

    const res = await fetch(url, {
      ...init,
      method,
      headers: hdrs,
      signal: controller.signal,
    });

    if (!quiet) console.log("[api] <-", res.status, res.ok ? "OK" : "ERR", url);

    const data = await readBodySafely(res);

    if (!res.ok) {
      if (!quiet && typeof data === "string" && data) {
        console.log("[api] error body =", safePreview(data));
      }

      const message =
        (data && typeof data === "object" && ((data as any).error || (data as any).message)) ||
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
  };

  try {
    // ------------------------------
    // SNAPI: prevent double-fire for block/unblock
    // ------------------------------
    const isBlock = p === "/app/api/block" && method === "POST";
    if (isBlock) {
      const bodyObj = parseJsonBody(init.body);
      const from = clean(bodyObj?.from);
      const blocked = !!bodyObj?.blocked;

      console.log("[api][block] send", { from, blocked, stack: new Error().stack });

      if (from) {
        const now = Date.now();
        const last = _blockLastAt.get(from) || 0;

        // 800ms debounce per number: ignore rapid second toggle
        if (now - last < 800) {
          console.log("[api][block] debounced", { from, blocked, ms: now - last });
          return { ok: true, debounced: true, from, blocked };
        }

        _blockLastAt.set(from, now);

        // Inflight de-dupe for identical payloads
        const inflightKey = `POST:${from}:${blocked}`;
        const existing = _blockInflight.get(inflightKey);
        if (existing) {
          console.log("[api][block] inflight-join", { from, blocked });
          return await existing;
        }

        const promise = (async () => {
          try {
            return await doFetch(headers);
          } finally {
            _blockInflight.delete(inflightKey);
          }
        })();

        _blockInflight.set(inflightKey, promise);
        return await promise;
      }
    }

    // ------------------------------
    // Normal requests (+ /mobile/* refresh retry on 401)
    // ------------------------------
    try {
      return await doFetch(headers);
    } catch (e: any) {
      // If /mobile/* is unauthorized, refresh once then retry once
      if ((p.startsWith("/mobile/") || p.startsWith("/app/api/")) && e?.status === 401) {
        const ok = await refreshSession();
        if (ok) {
          const access2 = await getAccessToken();
          const headers2: Record<string, string> = { ...headers };
          if (access2) headers2["Authorization"] = `Bearer ${access2}`;
          return await doFetch(headers2);
        }
      }
      throw e;
    }
  } catch (e: any) {
    // ✅ If it's already our rich HTTP error (non-2xx), keep it (don’t mask as network error)
    if (e && typeof e.status === "number") throw e;
    if (e && e.code === "MISSING_APP_KEY") throw e;

    const aborted =
      e?.name === "AbortError" ||
      clean(e?.message).toLowerCase().includes("aborted") ||
      clean(e?.message).toLowerCase().includes("timeout");

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
