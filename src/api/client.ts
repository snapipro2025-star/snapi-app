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
const DEFAULT_PROD_URL = "https://api.snapipro.com";

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
// Support multiple env names so builds don’t silently break
const APP_KEY = clean(
  process.env.EXPO_PUBLIC_SNAPI_APP_KEY ||
    process.env.EXPO_PUBLIC_MOBILE_KEY || // ✅ your current naming
    process.env.EXPO_PUBLIC_APP_KEY // optional fallback
);

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
    const token = await SecureStore.getItemAsync(ACCESS_KEY);

    // TEMP DEBUG: print token (remove after testing)
    console.log("[auth] access token", token ? `${token.slice(0, 18)}...${token.slice(-10)}` : "(null)");

    return token;
  } catch (e) {
    console.log("[auth] getAccessToken error", e);
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(REFRESH_KEY);

    // TEMP DEBUG (optional)
    console.log("[auth] refresh token", token ? `${token.slice(0, 18)}...${token.slice(-10)}` : "(null)");

    return token;
  } catch (e) {
    console.log("[auth] getRefreshToken error", e);
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
  if (!refresh) {
    console.log("[refreshSession] no refresh token");
    return false;
  }

  try {
    const r = await apiFetch("/mobile/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
      quiet: true,
      timeoutMs: 12000,
    });

    if ((r as any)?.ok === false) {
      console.log("[refreshSession] backend returned ok:false");
      return false;
    }

    const accessToken =
      (r as any)?.accessToken ||
      (r as any)?.access_token ||
      (r as any)?.token ||
      (r as any)?.access ||
      (r as any)?.session?.accessToken ||
      "";

    // Refresh token rotation is OPTIONAL — keep the existing one if not provided
    const newRefreshToken =
      (r as any)?.refreshToken ||
      (r as any)?.refresh_token ||
      (r as any)?.refresh ||
      (r as any)?.session?.refreshToken ||
      "";

    if (!accessToken) {
      console.log("[refreshSession] missing accessToken in response");
      return false;
    }

    const finalRefresh = newRefreshToken || refresh;

    console.log("[refreshSession] success", {
      rotatedRefresh: !!newRefreshToken,
    });

    await setTokens(accessToken, finalRefresh);
    return true;
  } catch (e) {
    console.log("[refreshSession] error", e instanceof Error ? e.message : String(e));
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

function buildHeaders(initHeaders: RequestInit["headers"] | undefined, deviceId: string, hasBody: boolean) {
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
  const cfg: ApiFetchInit = init ?? {};

  // --- Launch safety: never use marketing host for API ---
  const rawBase = clean(BASE_URL);

  const isMarketingHost =
    /(^|\/\/)(www\.)?snapipro\.com(\/|$)/i.test(rawBase) && !/\/\/api\.snapipro\.com/i.test(rawBase);

  const effectiveBase = isMarketingHost ? "https://api.snapipro.com" : rawBase;

  const url = joinUrl(effectiveBase, path);

  // --- Fail fast: /app/api/* requires app key ---
  if (path.startsWith("/app/api/") && !APP_KEY) {
    throw makeError("App key missing (EXPO_PUBLIC_SNAPI_APP_KEY).", {
      code: "MISSING_APP_KEY",
      path,
      url,
      baseUrl: BASE_URL,
    });
  }

  const deviceId = await getDeviceId();
  const hasBody = cfg.body !== undefined && cfg.body !== null;

  const headers = buildHeaders(cfg.headers, deviceId, Boolean(hasBody));
  const method = upperMethod(cfg.method);

  // ✅ Attach Bearer token for /mobile/* and /app/api/*
  if (path.startsWith("/mobile/") || path.startsWith("/app/api/")) {
    const access = await getAccessToken();
    if (access) headers["Authorization"] = `Bearer ${access}`;
  }

  const timeoutMs = Number(cfg.timeoutMs ?? 12000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const quiet = Boolean(cfg.quiet);

  const doFetch = async (hdrs: Record<string, string>) => {
    if (!quiet) {
      console.log("[api] ->", method, url, "| keyLen=", APP_KEY.length, "| device=", deviceId);
    }

    const res = await fetch(url, {
      ...cfg,
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
        (data && typeof data === "object" && (((data as any).error as any) || ((data as any).message as any))) ||
        `Request failed (${res.status})`;

      throw makeError(message, {
        status: res.status,
        body: data,
        code: (data && typeof data === "object" && (data as any).code) || undefined,
        url,
        path,
        baseUrl: BASE_URL,
      });
    }

    return data;
  };

  try {
    // ------------------------------
    // SNAPI: prevent double-fire for block/unblock
    // ------------------------------
    const isBlock = path === "/app/api/block" && method === "POST";
    if (isBlock) {
      const bodyObj = parseJsonBody(cfg.body);
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
      // If /mobile/* or /app/api/* is unauthorized, refresh once then retry once
      if ((path.startsWith("/mobile/") || path.startsWith("/app/api/")) && e?.status === 401) {
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

    throw makeError(aborted ? "Server not reachable. Please try again." : "Network error. Check connectivity and try again.", {
      cause: e,
      code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
      url,
      path,
      baseUrl: BASE_URL,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Optional convenience wrappers (if you want them later)
// export const apiGet = (path: string, init: ApiFetchInit = {}) => apiFetch(path, { ...init, method: "GET" });
// export const apiPost = (path: string, body: any, init: ApiFetchInit = {}) =>
//   apiFetch(path, { ...init, method: "POST", body: JSON.stringify(body) });