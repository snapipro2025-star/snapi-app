import { CONFIG } from "./config";

type ApiOk = { ok: true };
type ApiErr = { ok: false; error?: string; message?: string };

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

export async function authStart(email: string): Promise<ApiOk> {
  try {
    const r = await fetch(`${CONFIG.BASE_URL}/api/auth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = (await r.json().catch(() => ({}))) as Partial<ApiOk & ApiErr>;

    if (!r.ok || data.ok === false) {
      const msg = data.error || data.message || `Request failed (${r.status})`;
      throw new Error(msg);
    }

    return { ok: true };
  } catch (e) {
    throw new Error(toErrorMessage(e));
  }
}
