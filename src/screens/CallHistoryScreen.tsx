// src/screens/CallHistoryScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { PrimaryButton, GhostButton } from "../components/Buttons";
import { Colors } from "../theme/colors";
import { apiFetch } from "../api/client";

type RecentItem = {
  id?: string;

  callSid?: string;
  ts?: string; // ISO
  at?: string; // ISO (legacy)

  from?: string;
  name?: string;

  // risk may be number or string like "low"/"high" depending on older records
  risk?: number | string;

  transcript?: string;

  voicemailUrl?: string;
  voicemailRecordingSid?: string;

  recordingUrl?: string;
  recordingSid?: string;

  blocked?: boolean;

  status?: string;
  action?: string;
  decision?: string;
  source?: string;
  device?: string;
};

function clean(s: any) {
  return String(s ?? "").trim();
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function normalizeRisk(risk: RecentItem["risk"]): number {
  if (typeof risk === "number" && Number.isFinite(risk)) return clamp(risk, 0, 100);
  const s = String(risk || "").toLowerCase().trim();
  if (!s) return 0;

  if (s === "low") return 15;
  if (s === "medium" || s === "med") return 55;
  if (s === "high") return 85;

  const n = Number(s);
  return Number.isFinite(n) ? clamp(n, 0, 100) : 0;
}

function riskDotColor(risk: number) {
  const r = clamp(risk || 0, 0, 100);
  if (r >= 75) return "rgba(255, 72, 72, 0.95)";
  if (r >= 45) return "rgba(255, 196, 72, 0.95)";
  return "rgba(72, 255, 160, 0.95)";
}

function fmtWhen(iso?: string) {
  const s = clean(iso);
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function getWhenField(it: RecentItem) {
  return clean(it.at) || clean(it.ts) || "";
}

/**
 * Row identity:
 * - Prefer callSid (most stable)
 * - else id
 * - else fallback from+when+idx (only used if callSid/id missing)
 */
function getRowKey(it: RecentItem, idx: number) {
  const sid = clean(it.callSid);
  if (sid) return `sid:${sid}`;

  const id = clean(it.id);
  if (id) return `id:${id}`;

  const from = clean(it.from) || "unknown";
  const when = getWhenField(it) || "na";
  return `fb:${from}:${when}:${idx}`;
}

function extractRecentList(payload: any): RecentItem[] {
  if (Array.isArray(payload)) return payload as RecentItem[];
  if (Array.isArray(payload?.items)) return payload.items as RecentItem[];
  return [];
}

function getVoicemailSid(it: RecentItem) {
  const sid = clean(it.voicemailRecordingSid) || clean(it.recordingSid);
  return sid && /^RE[a-zA-Z0-9]+$/.test(sid) ? sid : "";
}

function getAnyVoicemailUrl(it: RecentItem) {
  // direct URLs might 401 if Twilio; we only use as fallback
  return clean(it.voicemailUrl) || clean(it.recordingUrl) || "";
}

export default function CallHistoryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const didInitialLoad = useRef(false);

  const [items, setItems] = useState<RecentItem[]>([]);

  // Guards:
  // - rowGuard: prevents same-row double invoke in same tick / fast taps
  // - numberGuard: prevents duplicate POSTs for the same "from" even if row keys differ
  const rowGuardRef = useRef<Record<string, boolean>>({});
  const numberGuardRef = useRef<Record<string, boolean>>({});
  const voicemailGuardRef = useRef<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const rRecent = await apiFetch("/mobile/recent", { method: "GET" })
      setItems(extractRecentList(rRecent));
    } catch (e: any) {
      Alert.alert("Refresh failed", e?.message || "Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const openVoicemail = useCallback(
    async (it: RecentItem, idx: number) => {
      const sid = getVoicemailSid(it);
      const direct = getAnyVoicemailUrl(it);

      if (!sid && !direct) return;

      const rowKey = getRowKey(it, idx);

      // absorb double taps
      if (voicemailGuardRef.current[rowKey]) return;
      voicemailGuardRef.current[rowKey] = true;

      try {
        // Preferred: mint signed URL (works with expo-av, no headers needed)
        if (sid) {
          const r = await apiFetch(`/app/api/voicemail-url?sid=${encodeURIComponent(sid)}`, {
            method: "GET",
          });

          if (r?.ok && r?.url) {
            navigation?.navigate?.("VoicemailPlayer", {
              url: String(r.url),
              item: it,
              callSid: it.callSid,
            });
            return;
          }

          console.warn("[openVoicemail] mint failed:", r);
        }

        // Fallback: try direct URL (may 401 if Twilio)
        if (direct) {
          navigation?.navigate?.("VoicemailPlayer", {
            url: direct,
            item: it,
            callSid: it.callSid,
          });
          return;
        }
      } catch (e) {
        console.warn("[openVoicemail] error:", e);
      } finally {
        setTimeout(() => {
          voicemailGuardRef.current[rowKey] = false;
        }, 500);
      }
    },
    [navigation]
  );

  const toggleBlock = useCallback(async (item: RecentItem, idx: number) => {
    const from = clean(item.from);
    if (!from) {
      Alert.alert("Missing number", "No caller number is available to block.");
      return;
    }

    const rowKey = getRowKey(item, idx);

    if (rowGuardRef.current[rowKey]) return;
    rowGuardRef.current[rowKey] = true;

    if (numberGuardRef.current[from]) {
      setTimeout(() => {
        rowGuardRef.current[rowKey] = false;
      }, 0);
      return;
    }
    numberGuardRef.current[from] = true;

    const next = !Boolean(item.blocked);

    const patchRow = (patch: Partial<RecentItem>) => {
      setItems((prev) =>
        prev.map((x, j) => {
          const same = getRowKey(x, j) === rowKey;
          return same ? { ...x, ...patch } : x;
        })
      );
    };

    patchRow({ blocked: next });

    try {
      const resp = await apiFetch("/app/api/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, blocked: next }),
      });

      const ok =
        resp == null ||
        typeof resp !== "object" ||
        !("ok" in resp) ||
        (resp as any).ok === true;

      if (!ok) {
        const msg = String((resp as any)?.error || (resp as any)?.message || "block_failed");
        throw new Error(msg);
      }

      const serverFrom =
        resp && typeof resp === "object" ? clean((resp as any).from) || from : from;
      const serverBlocked =
        resp && typeof resp === "object" && "blocked" in resp ? !!(resp as any).blocked : next;

      patchRow({ from: serverFrom || undefined, blocked: serverBlocked });
    } catch (e: any) {
      patchRow({ blocked: !next });
      Alert.alert("Could not update", e?.message ? String(e.message) : "Try again.");
    } finally {
      setTimeout(() => {
        rowGuardRef.current[rowKey] = false;
      }, 0);

      setTimeout(() => {
        numberGuardRef.current[from] = false;
      }, 900);
    }
  }, []);

  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;

    let mounted = true;
    (async () => {
      if (!mounted) return;
      setLoading(true);
      await load();
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [load]);

  return (
    <GlassBackground>
      <View
        style={[
          styles.safe,
          {
            paddingTop: Math.max(insets.top, 10),
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Call History</Text>
            <View style={styles.headerRight}>
              <GhostButton
                title={refreshing ? "Refreshing…" : "Refresh"}
                onPress={() => {
                  if (refreshing) return;
                  load();
                }}
                disabled={refreshing}
                style={styles.refreshBtn}
              />
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
          ) : null}

          <GlassCard style={styles.card}>
            {items.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No calls yet</Text>
                <Text style={styles.emptySub}>When SNAPI screens calls, they’ll appear here.</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {items.map((it, idx) => {
                  const risk = normalizeRisk(it.risk);
                  const dot = riskDotColor(risk);

                  const who = clean(it.status) || clean(it.name) || clean(it.from) || "Unknown";
                  const when = fmtWhen(getWhenField(it));

                  const from = clean(it.from);
                  const disabled = !!(from && numberGuardRef.current[from]);

                  const hasVm = !!getVoicemailSid(it) || !!getAnyVoicemailUrl(it);

                  return (
                    <View key={getRowKey(it, idx)} style={styles.row}>
                      <View style={styles.rowTop}>
                        <View style={styles.rowLeft}>
                          <View style={[styles.dot, { backgroundColor: dot }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle} numberOfLines={1}>
                              {who}
                            </Text>
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              Risk {Math.round(risk)} • {when}
                            </Text>
                          </View>
                        </View>

                        <Pressable
                          onPress={() => toggleBlock(it, idx)}
                          disabled={disabled}
                          style={[
                            styles.blockBtn,
                            it.blocked ? styles.blockBtnOn : styles.blockBtnOff,
                            disabled ? styles.blockBtnDisabled : null,
                          ]}
                        >
                          <Text style={styles.blockBtnText}>{it.blocked ? "Unblock" : "Block"}</Text>
                        </Pressable>
                      </View>

                      {it.transcript ? (
                        <Text style={styles.transcript} numberOfLines={3}>
                          {it.transcript}
                        </Text>
                      ) : (
                        <Text style={styles.transcriptEmpty} numberOfLines={2}>
                          No transcript available.
                        </Text>
                      )}

                      <View style={styles.rowActions}>
                        <GhostButton
                          title={hasVm ? "Voicemail" : "Voicemail N/A"}
                          onPress={() => openVoicemail(it, idx)}
                          disabled={!hasVm}
                        />
                        <PrimaryButton
                          title="Details"
                          onPress={() => navigation?.navigate?.("CallDetails", { item: it })}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </GlassCard>
        </ScrollView>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 16, paddingBottom: 18, gap: 10 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 6,
  },
  title: { fontSize: 22, fontWeight: "900", color: Colors.text },
  headerRight: { flexShrink: 0 },

  refreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 6,
  },
  loadingText: { color: Colors.muted, fontSize: 12 },

  card: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 12 },

  empty: { paddingVertical: 10 },
  emptyTitle: { color: Colors.text, fontWeight: "800", fontSize: 13 },
  emptySub: { marginTop: 6, color: Colors.muted, fontSize: 12, lineHeight: 16 },

  list: { gap: 10 },
  row: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 12,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },

  dot: { width: 10, height: 10, borderRadius: 99 },
  rowTitle: { color: Colors.text, fontWeight: "800", fontSize: 13 },
  rowMeta: { marginTop: 2, color: Colors.muted, fontSize: 11 },

  transcript: {
    marginTop: 10,
    color: Colors.text,
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.92,
  },
  transcriptEmpty: { marginTop: 10, color: Colors.muted, fontSize: 12, lineHeight: 16 },

  rowActions: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  blockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  blockBtnOn: {
    borderColor: "rgba(72,255,160,0.35)",
    backgroundColor: "rgba(72,255,160,0.08)",
  },
  blockBtnOff: {
    borderColor: "rgba(255,72,72,0.35)",
    backgroundColor: "rgba(255,72,72,0.08)",
  },
  blockBtnDisabled: {
    opacity: 0.65,
  },
  blockBtnText: { color: Colors.text, fontWeight: "900", fontSize: 11 },
});
