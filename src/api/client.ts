// src/api/client.ts
import * as SecureStore from "expo-secure-store";
export type ApiFetchResult = any;

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
function clean(s: unknown): string {
  return String(s ?? "").trim();
}

function joinUrl(base: string, path: string): string {
  const b = clean(base).replace(/\/+$/, "");
  const p = clean(path).replace(/^\/+/, ""); // prevent double slashes
  return `${b}/${p}`;
}

function upperMethod(m?: string): string {
  return clean(m || "GET").toUpperCase();
}

function safePreview(s: unknown, n = 1200): string {
  const t = String(s ?? "");
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function makeError(message: string, extra?: unknown): Error & Record<string, unknown> {
  const err = new Error(message) as Error & Record<string, unknown>;
  if (extra && typeof extra === "object") Object.assign(err, extra as object);
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

// Debug (safe): do not leak keys in production builds
if (__DEV__) {
  console.log("[api] BASE_URL =", BASE_URL);
  console.log("[api] APP_KEY len =", APP_KEY.length, "| prefix =", APP_KEY ? APP_KEY.slice(0, 3) : "(none)");
}

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
    console.log("[auth] access token", token ? `len=${token.length}` : "(null)");

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
    console.log("[auth] refresh token", token ? `len=${token.length}` : "(null)");

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

  _session = { hydrated: true, isAuthed: false };
}

/* ================================
   Refresh storm protection
================================ */

let _refreshInflight: Promise<boolean> | null = null;
let _refreshLastAt = 0;
const REFRESH_DEBOUNCE_MS = 1500;

/**
 * Ensures only one refresh runs at a time, and repeated calls
 * within a short window don't hammer /mobile/auth/refresh.
 */
export async function refreshSessionOnce(): Promise<boolean> {
  const now = Date.now();

  if (_refreshInflight) return _refreshInflight;

  if (now - _refreshLastAt < REFRESH_DEBOUNCE_MS) {
    // "recently attempted" — don't claim success
    return false;
  }

  _refreshLastAt = now;

  _refreshInflight = (async () => {
    try {
      return await refreshSession(); // ✅ correct
    } finally {
      _refreshInflight = null;
    }
  })();

  return _refreshInflight;
}

/* existing function continues below */

export async function refreshSession(): Promise<boolean> {
  const refresh = await getRefreshToken();
  if (!refresh) {
    console.log("[refreshSession] no refresh token");
    return false;
  }

  try {
    const deviceId = await getDeviceId();

    // Use the same “marketing host safety” logic as apiFetch
    const rawBase = clean(BASE_URL);
    const isMarketingHost =
      /(^|\/\/)(www\.)?snapipro\.com(\/|$)/i.test(rawBase) && !/\/\/api\.snapipro\.com/i.test(rawBase);
    const effectiveBase = isMarketingHost ? "https://api.snapipro.com" : rawBase;

    const url = joinUrl(effectiveBase, "/mobile/auth/refresh");

    // Build headers (NO Authorization header here)
    const headers = buildHeaders({ "Content-Type": "application/json" }, deviceId, true);

    // Helpful for tracking refresh storms without leaking secrets
    console.log("[auth][refresh] -> POST", url);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ refreshToken: refresh }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await readBodySafely(res);

    if (!res.ok) {
      console.log("[refreshSession] HTTP fail", res.status, typeof data === "string" ? safePreview(data) : data);
      return false;
    }

    if ((data as any)?.ok === false) {
      console.log("[refreshSession] backend returned ok:false");
      return false;
    }

    const accessToken =
      (data as any)?.accessToken ||
      (data as any)?.access_token ||
      (data as any)?.token ||
      (data as any)?.access ||
      (data as any)?.session?.accessToken ||
      "";

    const newRefreshToken =
      (data as any)?.refreshToken ||
      (data as any)?.refresh_token ||
      (data as any)?.refresh ||
      (data as any)?.session?.refreshToken ||
      "";

    if (!accessToken) {
      console.log("[refreshSession] missing accessToken in response");
      return false;
    }

    const finalRefresh = newRefreshToken || refresh;

    console.log("[refreshSession] success", { rotatedRefresh: !!newRefreshToken });

    await setTokens(accessToken, finalRefresh);
    return true;
  } catch (e: any) {
    const aborted =
      e?.name === "AbortError" ||
      clean(e?.message).toLowerCase().includes("aborted") ||
      clean(e?.message).toLowerCase().includes("timeout");

    console.log("[refreshSession] error", aborted ? "timeout" : e instanceof Error ? e.message : String(e));
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
  const looksJson = contentType.includes("json") || contentType.includes("+json");

  try {
    // 204 / empty body safety
    if (res.status === 204) return null;

    const text = await res.text();
    if (!text) return null;

    if (looksJson) {
      try {
        return JSON.parse(text);
      } catch {
        // fall through
      }
    }

    return text;
  } catch {
    return null;
  }
}

// ------------------------------
// De-dupe / debounce for /app/api/block
// ------------------------------
const _blockInflight = new Map<string, Promise<any>>();
const _blockLastAt = new Map<
  string,
  { ts: number; blocked: boolean }
>();

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
 * - Prefixes BASE_URL (and guards against marketing host)
 * - Adds x-snapi-device-id header
 * - Adds x-snapi-app-key when present
 * - Adds Authorization: Bearer <accessToken> for /mobile/* and /app/api/*
 * - Enforces app key presence for /app/api/* calls (fail-fast)
 * - Uses AbortController timeout so calls don't hang forever on real devices
 * - Throws a rich Error for non-2xx (and does NOT mask it as "network error")
 * - Debounces + de-dupes /app/api/block to prevent accidental double-toggle
 * - Retries /mobile/* once on 401 after refreshSessionOnce() (rebuilds headers w/ NEW token)
 */
export async function apiFetch(
  path: string,
  init: ApiFetchInit = {}
): Promise<ApiFetchResult> {
  const cfg: ApiFetchInit = init ?? {};

  // ✅ One-shot retry guard for 401 refresh flow
  const alreadyRetried = (cfg as any)?._snapiRetried === true;

  // --- Launch safety: never use marketing host for API ---
  const rawBase = clean(BASE_URL);
  const isMarketingHost =
    /(^|\/\/)(www\.)?snapipro\.com(\/|$)/i.test(rawBase) &&
    !/\/\/api\.snapipro\.com/i.test(rawBase);

  const effectiveBase = isMarketingHost ? "https://api.snapipro.com" : rawBase;
  const p = clean(path);
  const url = joinUrl(effectiveBase, p);

  // --- Fail fast: /app/api/* requires app key ---
  if (p.startsWith("/app/api/") && !APP_KEY) {
    throw makeError("App key missing (EXPO_PUBLIC_SNAPI_APP_KEY).", {
      code: "MISSING_APP_KEY",
      path: p,
      url,
      baseUrl: BASE_URL,
    });
  }

  const deviceId = await getDeviceId();
  const hasBody = cfg.body !== undefined && cfg.body !== null;

  const method = upperMethod(cfg.method);
  const quiet = Boolean(cfg.quiet);

  const timeoutMs = Number(cfg.timeoutMs ?? 12000);

  // NOTE: controller must be per-attempt (including retries), so create inside doFetchAttempt.

  const doFetchAttempt = async (
    hdrs: Record<string, string>
  ): Promise<ApiFetchResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
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
        // ✅ Retry /mobile/* once on 401 after refresh (storm-protected)
        if (
          res.status === 401 &&
          p.startsWith("/mobile/") &&
          p !== "/mobile/auth/refresh" &&
          !alreadyRetried
        ) {
          const ok = await refreshSessionOnce().catch(() => false);

          if (ok) {
            // Rebuild headers so Authorization uses the NEW access token
            // IMPORTANT: strip stale Authorization from cfg.headers first.
            const base = { ...(cfg.headers as any) };
            delete base.Authorization;
            delete base.authorization;

            const freshHeaders = buildHeaders(base, deviceId, Boolean(hasBody));

            const freshAccess = await getAccessToken();
            if (freshAccess) {
              freshHeaders["Authorization"] = `Bearer ${freshAccess}`;

              // Retry once, marked
              const { _snapiRetried, ...rest } = cfg as any;
              return apiFetch(p, {
                ...rest,
                _snapiRetried: true,
                headers: freshHeaders,
              } as any);
            } else {
              if (!quiet) console.warn("[apiFetch] refresh ok but no access token; not retrying", { path: p });
              // Fall through to error below
            }
          }
        }

        if (!quiet && typeof data === "string" && data) {
          console.log("[api] error body =", safePreview(data));
        }

        const message =
          (data &&
            typeof data === "object" &&
            (((data as any).error as any) || ((data as any).message as any))) ||
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
    } finally {
      clearTimeout(timer);
    }
  };

  // Build initial headers
  const headers = buildHeaders(cfg.headers, deviceId, Boolean(hasBody));

  // ✅ Attach Bearer token for /mobile/* and /app/api/*
  if (p.startsWith("/mobile/") || p.startsWith("/app/api/")) {
    const access = await getAccessToken();
    if (access) headers["Authorization"] = `Bearer ${access}`;
  }

  try {
    // ------------------------------
    // SNAPI: prevent double-fire for block/unblock
    //  - Debounce only SAME state (block->block or unblock->unblock)
    //  - Allow fast opposite toggles (block->unblock)
    //  - Inflight de-dupe joins identical payloads
    // ------------------------------
    const isBlock = p === "/app/api/block" && method === "POST";
    if (isBlock) {
      const bodyObj = parseJsonBody(cfg.body);
      const from = clean(bodyObj?.from);
      const blocked = !!bodyObj?.blocked;

      console.log("[api][block] send", { from, blocked, stack: new Error().stack });

      if (from) {
        const now = Date.now();
        const lastEntry = _blockLastAt.get(from); // { ts, blocked } | undefined

        // 800ms debounce per number, BUT only if it's the SAME state
        // (prevents accidental double-tap, while allowing block->unblock quickly)
        if (lastEntry && now - lastEntry.ts < 800 && lastEntry.blocked === blocked) {
          console.log("[api][block] debounced (same state)", {
            from,
            blocked,
            ms: now - lastEntry.ts,
          });
          return { ok: true, debounced: true, from, blocked };
        }

        // record latest action (state-aware)
        _blockLastAt.set(from, { ts: now, blocked });

        // Inflight de-dupe for identical payloads
        const inflightKey = `POST:${from}:${blocked}`;
        const existing = _blockInflight.get(inflightKey);
        if (existing) {
          console.log("[api][block] inflight-join", { from, blocked });
          return await existing;
        }

        const promise: Promise<ApiFetchResult> = (async (): Promise<ApiFetchResult> => {
          try {
            return await doFetchAttempt(headers);
          } finally {
            _blockInflight.delete(inflightKey);
          }
        })();

        _blockInflight.set(inflightKey, promise);
        return await promise;
      }
    }

    // ------------------------------
    // Normal requests (401 retry handled inside doFetchAttempt)
    // ------------------------------
    return await doFetchAttempt(headers);
  } catch (e: any) {
    // ✅ If it's already our rich HTTP error (non-2xx), keep it (don’t mask as network error)
    if (e && typeof e.status === "number") throw e;
    if (e && e.code === "MISSING_APP_KEY") throw e;

    const msg = clean(e?.message).toLowerCase();
    const aborted =
      e?.name === "AbortError" ||
      msg.includes("aborted") ||
      msg.includes("timeout");

    throw makeError(
      aborted
        ? "Server not reachable. Please try again."
        : "Network error. Check connectivity and try again.",
      {
        cause: e,
        code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
        url,
        path: p,
        baseUrl: BASE_URL,
      }
    );
  }
}

// Optional convenience wrappers (if you want them later)
// export const apiGet = (path: string, init: ApiFetchInit = {}) => apiFetch(path, { ...init, method: "GET" });
// export const apiPost = (path: string, body: any, init: ApiFetchInit = {}) =>
//   apiFetch(path, { ...init, method: "POST", body: JSON.stringify(body) });