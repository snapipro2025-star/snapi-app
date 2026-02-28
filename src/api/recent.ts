// src/api/recent.ts
import { apiFetch } from "./client";

export type RecentCall = {
  ts: string;
  callSid: string;
  from: string;
  to?: string;
  action?: string;
  status?: string;
  recordingUrl?: string;
  transcript?: string;
  // backend may include these (depending on your implementation)
  isBlocked?: boolean;
  blocked?: boolean;
  blockStatus?: string;
};

export async function fetchRecent(limit = 50): Promise<RecentCall[]> {
  const r = await apiFetch(`/admin/api/recent?limit=${encodeURIComponent(String(limit))}`, {
    method: "GET",
  });

  // Many SNAPI routes return { ok, items } OR just items.
  const items = (r as any)?.items ?? r;
  return Array.isArray(items) ? items : [];
}

export async function setBlocked(fromE164: string, blocked: boolean): Promise<any> {
  // IMPORTANT:
  // Use the SAME endpoint you used on web admin (so behavior matches).
  // If your admin uses /app/api/block, switch to that instead.
  return apiFetch(`/app/api/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromE164, blocked }),
  });
}