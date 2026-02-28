// src/api/actions.ts
import { apiFetch } from "./client";

function formEncode(obj: Record<string, any>) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    p.append(k, String(v));
  });
  return p.toString();
}

export async function apiSetBlocked(from: string, blocked: boolean) {
  return apiFetch("/app/api/block", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: formEncode({ from, blocked }),
  });
}

export async function apiSetAllowed(from: string, allowed: boolean) {
  return apiFetch("/app/api/allow", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: formEncode({ from, allowed }),
  });
}