// src/lib/allowlistSync.ts
import * as Contacts from "expo-contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../api/client";

const LAST_SYNC_OK_KEY = "snapi_allowlist_last_sync_ok_v1";
const LAST_SYNC_ATTEMPT_KEY = "snapi_allowlist_last_sync_attempt_v1";

const DAY_MS = 24 * 60 * 60 * 1000;

// safety knobs (v1)
const MAX_PER_RUN = 400;      // cap so we never do something insane
const CONCURRENCY = 3;        // keep small to be gentle
const TIMEOUT_MS = 15000;

// ---- helpers ----

function clean(s?: any) {
  return String(s ?? "").trim();
}

function digitsOnly(raw?: string) {
  return clean(raw).replace(/\D/g, "");
}

/**
 * v1 normalization:
 * - Prefer E.164 for US numbers (what your /app/api/allow expects)
 * - +1XXXXXXXXXX for 10 digits
 * - +1XXXXXXXXXX for 11 digits starting with 1
 * - If number already begins with "+", keep "+" + digits
 * - Otherwise: return "" (skip)
 */
export function normalizeToE164(raw?: string) {
  const s = clean(raw);
  if (!s) return "";

  if (s.startsWith("+")) {
    const d = digitsOnly(s);
    return d ? `+${d}` : "";
  }

  const d = digitsOnly(s);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+1${d.slice(1)}`;

  // v1: skip non-US / ambiguous lengths
  return "";
}

function formEncode(obj: Record<string, any>) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    p.append(k, String(v));
  });
  return p.toString();
}

async function mapPool<T>(
  items: T[],
  worker: (item: T, idx: number) => Promise<void>,
  concurrency: number
) {
  let i = 0;
  const runners = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

// ---- main ----

export async function syncContactsAllowlistNow(): Promise<{
  ok: boolean;
  count?: number;
  error?: string;
}> {
  try {
    // Stamp attempt immediately to prevent reruns during remounts
    await AsyncStorage.setItem(LAST_SYNC_ATTEMPT_KEY, String(Date.now()));

    const perm = await Contacts.requestPermissionsAsync();
    if (perm.status !== "granted") {
      return { ok: false, count: 0, error: "Contacts permission not granted" };
    }

    const res = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      pageSize: 1000,
      pageOffset: 0,
    });

    const numbers = new Set<string>();

    for (const c of res.data || []) {
      const phones = c.phoneNumbers || [];
      for (const p of phones) {
        const e164 = normalizeToE164(p?.number);
        if (e164) numbers.add(e164);
      }
    }

    const list = Array.from(numbers).slice(0, MAX_PER_RUN);

    if (list.length === 0) {
      // We attempted; don’t mark OK sync, but don’t report failure either.
      return { ok: true, count: 0 };
    }

    let okCount = 0;
    let firstErr = "";

    await mapPool(
      list,
      async (from) => {
        try {
          const r = await apiFetch("/app/api/allow", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formEncode({ from, allow: true }),
            timeoutMs: TIMEOUT_MS,
          });

          if (r?.ok) okCount++;
          else if (!firstErr) firstErr = clean(r?.error) || "sync_failed";
        } catch (e: any) {
          if (!firstErr) firstErr = clean(e?.message) || "sync_failed";
        }
      },
      CONCURRENCY
    );

    if (okCount > 0) {
      await AsyncStorage.setItem(LAST_SYNC_OK_KEY, String(Date.now()));
      return { ok: true, count: okCount };
    }

    return { ok: false, count: 0, error: firstErr || "sync failed" };
  } catch (e: any) {
    return { ok: false, count: 0, error: String(e?.message || e) };
  }
}

export type AllowlistSyncIfNeededResult = {
  didRun: boolean;
  ok?: boolean;
  count?: number;
  error?: string;
};

export async function syncContactsAllowlistIfNeeded(): Promise<AllowlistSyncIfNeededResult> {
  try {
    // Prefer “OK sync” time, fall back to “attempt” time to prevent reruns if we remount mid-run
    const okStr = await AsyncStorage.getItem(LAST_SYNC_OK_KEY);
    const attemptStr = await AsyncStorage.getItem(LAST_SYNC_ATTEMPT_KEY);

    const okTs = okStr ? Number(okStr) : 0;
    const attemptTs = attemptStr ? Number(attemptStr) : 0;

    const lastAny = Math.max(okTs, attemptTs);
    const due = !lastAny || Date.now() - lastAny > DAY_MS;

    const lastMinAgo =
      lastAny > 0 ? Math.round((Date.now() - lastAny) / 60000) : null;

    console.log("[allowlist] due?", due, "lastAnyMinAgo", lastMinAgo);

    if (!due) return { didRun: false };

    const out = await syncContactsAllowlistNow();

    return {
      didRun: true,
      ok: !!out?.ok,
      count: typeof out?.count === "number" ? out.count : 0,
      error: out?.error,
    };
  } catch (e: any) {
    return { didRun: true, ok: false, count: 0, error: String(e?.message || e) };
  }
}
