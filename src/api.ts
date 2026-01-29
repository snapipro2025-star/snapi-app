// src/api.ts

export type ApiOk<T = unknown> = { ok: true } & T;
export type ApiErr = { ok: false; error?: string; message?: string; status?: number };
export type ApiResult<T = unknown> = ApiOk<T> | ApiErr;

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  baseUrl?: string;
};

async function safeJson(res: Response): Promise<any> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function apiFetch<T = any>(
  path: string,
  opts: ApiFetchOptions = {}
): Promise<ApiResult<T>> {
  const { timeoutMs = 15000, baseUrl = "", ...init } = opts;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    const res = await fetch(url, { ...init, signal: controller.signal });

    const data = await safeJson(res);

    // ✅ res.ok is Response.ok (boolean)
    if (!res.ok || data?.ok === false) {
      const msg =
        data?.error ||
        data?.message ||
        `Request failed (${res.status})`;

      return { ok: false, error: String(msg), status: res.status };
    }

    // If server already returns { ok: true, ... }
    if (data && typeof data === "object" && "ok" in data) {
      return data as ApiOk<T>;
    }

    // Normalize success shape
    return { ok: true, ...(data ?? {}) } as ApiOk<T>;
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "Request timed out. Please try again."
        : e?.message || "Network error. Please try again.";

    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}
