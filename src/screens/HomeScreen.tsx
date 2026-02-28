// src/screens/HomeScreen.tsx  (updated section)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { syncContactsAllowlistIfNeeded } from "../lib/allowlistSync";

import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { GhostButton } from "../components/Buttons";

import { Colors } from "../theme/colors";
import { apiFetch } from "../api/client";

type RecentItem = {
  id?: string;
  callSid?: string;

  from?: string;
  fromDisplay?: string;
  name?: string;
  business?: string;

  privateNumber?: boolean;
  at?: string;
  ts?: string;

  risk?: number | string;

  voicemailUrl?: string;
  recordingUrl?: string;

  blocked?: boolean;

  // server-driven status/action fields
  status?: string;
  action?: string;
  decision?: string;
  source?: string;
  device?: string;

  allowlisted?: boolean;
  allowed?: boolean;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Phase B status dot (LOCKED):
 * 🔴 Blocked
 * 🟢 Allowed/Trusted (allowlisted)
 * 🟡 Unknown/Intercepted (default)
 */
function statusDotEmoji(it: RecentItem) {
  if (it?.blocked) return "🔴";

  const action = String((it as any)?.action || "").toLowerCase().trim();
  const decision = String((it as any)?.decision || "").toLowerCase().trim();
  const status = String((it as any)?.status || "").toLowerCase().trim();

  const allowlisted =
    Boolean((it as any)?.allowlisted) ||
    Boolean((it as any)?.allowed) ||
    action === "allow" ||
    decision.includes("allow") ||
    status.includes("allowed");

  return allowlisted ? "🟢" : "🟡";
}

// Kept for later Phase C/UX tuning; not used for dot in Phase B
function riskDotColor(risk: number | string) {
  const n = typeof risk === "number" ? risk : Number(risk);
  if (Number.isFinite(n)) {
    const r = clamp(n, 0, 100);
    if (r >= 75) return "rgba(255, 72, 72, 0.95)";
    if (r >= 45) return "rgba(255, 196, 72, 0.95)";
    return "rgba(72, 255, 160, 0.95)";
  }

  const s = String(risk || "").toLowerCase().trim();
  if (s === "high") return "rgba(255, 72, 72, 0.95)";
  if (s === "medium" || s === "med") return "rgba(255, 196, 72, 0.95)";
  if (s === "low") return "rgba(72, 255, 160, 0.95)";
  return "rgba(72, 255, 160, 0.95)";
}

function formatUSPretty(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const digits = s.replace(/[^\d]/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    const a = digits.slice(1, 4);
    const b = digits.slice(4, 7);
    const c = digits.slice(7, 11);
    return `+1 ${a}-${b}-${c}`;
  }

  if (digits.length === 10) {
    const a = digits.slice(0, 3);
    const b = digits.slice(3, 6);
    const c = digits.slice(6, 10);
    return `+1 ${a}-${b}-${c}`;
  }

  return s;
}

function callerIdLine(it: RecentItem) {
  const status = String((it as any)?.status || "").trim();
  if (status) return status;

  const person = String(it?.name || "").trim();
  if (person) return person;

  const biz = String(it?.business || "").trim();
  if (biz) return biz;

  if (it?.privateNumber) return "Private Number";
  return "Unknown Caller";
}

function phoneLine(it: RecentItem) {
  const raw = String(it?.fromDisplay || it?.from || "").trim();
  if (!raw) return "";
  return formatUSPretty(raw);
}

function bestCallSid(it: RecentItem) {
  const sid = String((it as any)?.callSid || "").trim();
  if (sid) return sid;
  const sid2 = String((it as any)?.sid || "").trim();
  if (sid2) return sid2;
  return "";
}

function itemKey(it: RecentItem, idx: number) {
  const sid = bestCallSid(it);
  if (sid) return sid;

  const ts = String((it as any)?.ts || "").trim();
  const from = String((it as any)?.from || "").trim();
  const action = String((it as any)?.action || (it as any)?.decision || "").trim();

  const base = `${ts}|${from}|${action}`;
  return base !== "||" ? base : `idx:${idx}`;
}

function dedupeRecent(items: RecentItem[]) {
  const byKey = new Map<string, RecentItem>();

  for (let i = 0; i < (items || []).length; i++) {
    const it = items[i];
    const key = itemKey(it, i);

    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, it);
      continue;
    }

    const tPrev = Date.parse(String((prev as any)?.ts || "")) || 0;
    const tIt = Date.parse(String((it as any)?.ts || "")) || 0;
    if (tIt >= tPrev) byKey.set(key, it);
  }

  return Array.from(byKey.values());
}

const YOUTUBE_START_HERE_URL = "https://youtu.be/5YJ9ae9kr1s";

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const didInitialLoad = useRef(false);

  const [enabled, setEnabled] = useState(true);
  const [spamOn, setSpamOn] = useState(true);
  const [unknownOn, setUnknownOn] = useState(true);
  const [voicemailOn, setVoicemailOn] = useState(true);

  const [recent, setRecent] = useState<RecentItem[]>([]);

  // Auto-sync contacts allowlist (at most once per app session + once per 24h inside lib)
  const didKickAllowlistSync = useRef(false);

  useEffect(() => {
    if (didKickAllowlistSync.current) return;
    didKickAllowlistSync.current = true;

    let alive = true;

    syncContactsAllowlistIfNeeded()
      .then((r) => {
        if (!alive) return;

        if (!r?.didRun) return; // not due
        if (!r.ok) {
          console.log("[allowlist] sync failed:", r.error || "unknown error");
          return;
        }

        const count = typeof r.count === "number" ? r.count : 0;
        if (count > 0) console.log("[allowlist] synced contacts:", count);
      })
      .catch((e) => {
        if (!alive) return;
        console.log("[allowlist] sync error:", String(e?.message || e));
      });

    return () => {
      alive = false;
    };
  }, []);

  const statusLabel = enabled ? "Protection Active" : "Protection Paused";
  const statusSub = enabled
    ? "SNAPI Shield is guarding your calls."
    : "Shield is paused. Calls will ring through normally.";

  const statusPillStyle = useMemo(
    () => [styles.pill, enabled ? styles.pillOn : styles.pillOff],
    [enabled]
  );

  const loadRefresh = useCallback(async () => {
    try {
      setRefreshing(true);

      const [protRes, rulesRes, recentRes] = await Promise.allSettled([
        apiFetch("/mobile/protection", { method: "GET" }),
        apiFetch("/mobile/rules", { method: "GET" }),
        apiFetch("/mobile/recent", { method: "GET" }),
      ]);

      // ---- protection ----
      if (protRes.status === "fulfilled") {
        const r = protRes.value;
        setEnabled(Boolean(r?.enabled ?? r?.protectionEnabled ?? true));
      }

      // ---- rules ----
      if (rulesRes.status === "fulfilled") {
        const r = rulesRes.value;
        setSpamOn(Boolean(r?.spamOn ?? r?.spam ?? true));
        setUnknownOn(Boolean(r?.unknownOn ?? r?.unknown ?? true));
        setVoicemailOn(Boolean(r?.voicemailOn ?? r?.voicemail ?? true));
      }

      // ---- recent ----
      const rRecent =
        recentRes.status === "fulfilled" ? recentRes.value : { items: [] as any[] };

      const items: RecentItem[] = Array.isArray(rRecent)
        ? (rRecent as any)
        : Array.isArray((rRecent as any)?.items)
        ? ((rRecent as any).items as any)
        : [];

      const unique = dedupeRecent(items);
      setRecent(unique.slice(0, 25));
    } catch (e: any) {
      Alert.alert("Refresh failed", e?.message || "Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onToggleEnabled = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);

    try {
      await apiFetch("/mobile/protection", {
        method: "POST",
        body: JSON.stringify({ enabled: next }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      // rollback UI
      setEnabled(!next);

      const message = err instanceof Error ? err.message : "Try again.";
      Alert.alert("Could not update", message);
    }
  }, [enabled]);

  const setRule = useCallback(
    async (key: "spam" | "unknown" | "voicemail", value: boolean) => {
      // Optimistic UI update + rollback on failure
      const prev = key === "spam" ? spamOn : key === "unknown" ? unknownOn : voicemailOn;

      if (key === "spam") setSpamOn(value);
      if (key === "unknown") setUnknownOn(value);
      if (key === "voicemail") setVoicemailOn(value);

      try {
        await apiFetch("/mobile/rules", {
          method: "POST",
          body: JSON.stringify({ [key]: value }),
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        // rollback
        if (key === "spam") setSpamOn(prev);
        if (key === "unknown") setUnknownOn(prev);
        if (key === "voicemail") setVoicemailOn(prev);

        const message = err instanceof Error ? err.message : "Try again.";
        Alert.alert("Could not update", message);
      }
    },
    [spamOn, unknownOn, voicemailOn]
  );

  const toggleSpam = useCallback(() => {
    const v = !spamOn;
    setSpamOn(v);
    setRule("spam", v);
  }, [spamOn, setRule]);

  const toggleUnknown = useCallback(() => {
    const v = !unknownOn;
    setUnknownOn(v);
    setRule("unknown", v);
  }, [unknownOn, setRule]);

  const toggleVoicemail = useCallback(() => {
    const v = !voicemailOn;
    setVoicemailOn(v);
    setRule("voicemail", v);
  }, [voicemailOn, setRule]);

  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;

    let mounted = true;

    (async () => {
      try {
        if (!mounted) return;
        setLoading(true);

        // loads status + recent
        await loadRefresh();

        // loads greeting preview
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadRefresh]);

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
          {/* HERO */}
          <View style={styles.headerRow}>
            <Text style={styles.heroTitle}>SNAPI Shield</Text>

            <Pressable
              onPress={() => Linking.openURL(YOUTUBE_START_HERE_URL)}
              style={styles.youtubeBtn}
              hitSlop={10}
            >
              <Ionicons name="logo-youtube" size={22} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.pill, enabled ? styles.pillOn : styles.pillOff]}>
              <Text style={styles.pillText}>{statusLabel}</Text>
            </View>

            <Pressable onPress={onToggleEnabled} style={styles.pauseBtn} hitSlop={10}>
              <Text style={styles.pauseText}>{enabled ? "PAUSE" : "RESUME"}</Text>
            </Pressable>
          </View>
          {/* QUICK CONTROLS */}
          <GlassCard style={[styles.card, styles.qcCard]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, styles.qcTitle]} numberOfLines={2}>
                Quick Connect
              </Text>

              <View style={styles.headerRight}>
                <Pressable
                  onPress={() => navigation?.navigate?.("SetupHelp")}
                  style={styles.helpBtn}
                >
                  <Text style={styles.helpBtnText}>Setup</Text>
                </Pressable>

                <GhostButton
                  title={refreshing ? "Refreshing…" : "Refresh"}
                  onPress={() => {
                    if (refreshing) return;
                    loadRefresh();
                  }}
                  disabled={refreshing}
                  style={styles.refreshBtn}
                />
              </View>
            </View>

            <View style={styles.pillStack}>
              <ControlPill title="Spam" desc="Block known spam" value={spamOn} onPress={toggleSpam} />
              <ControlPill
                title="Unknown"
                desc="Screen unknown callers"
                value={unknownOn}
                onPress={toggleUnknown}
              />
              <ControlPill
                title="Voicemail"
                desc="Capture voicemail"
                value={voicemailOn}
                onPress={toggleVoicemail}
              />
            </View>

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Loading status…</Text>
              </View>
            ) : null}
            
          </GlassCard>

          {/* RECENT */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                Recent Activity
              </Text>
              <Text style={styles.cardHint}>Last {Math.min(25, recent.length)} of 25</Text>
            </View>

            {recent.length === 0 ? (
              <Text style={styles.emptySub}>
                When SNAPI screens a call, you’ll see it listed here.
              </Text>
            ) : (
              <>
                <View style={styles.list}>
                  {recent.map((it, idx) => {
                    const dot = statusDotEmoji(it);
                    const top = callerIdLine(it);
                    const bottom = phoneLine(it);
                    const callSid = bestCallSid(it);

                    return (
                      <View key={itemKey(it, idx)} style={styles.row}>
                        <View style={styles.rowTop}>
                          <View style={styles.rowLeft}>
                            <View style={styles.dotWrap}>
                              <Text style={styles.statusDot}>{dot}</Text>
                            </View>

                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.rowTopLine} numberOfLines={1}>
                                {top}
                              </Text>

                              {bottom ? (
                                <Text style={styles.rowBottomLine} numberOfLines={1}>
                                  {bottom}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          <Pressable
                            style={[styles.viewBtn, styles.viewBtnRaised]}
                            onPress={() =>
                              navigation?.navigate?.("CallDetails", {
                                item: it,
                                callSid,
                              })
                            }
                          >
                            <Text style={styles.viewBtnText}>View</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* LEGEND */}
                <View style={styles.statusLegend}>
                  <Text style={styles.statusLegendText}>🔴 Blocked</Text>
                  <Text style={styles.statusLegendText}>🟢 Allowlisted</Text>
                  <Text style={styles.statusLegendText}>🟡 Screened</Text>
                </View>
              </>
            )}
          </GlassCard>
        </ScrollView>
      </View>
    </GlassBackground>
  );
}

function ControlPill({
  title,
  desc,
  value,
  onPress,
}: {
  title: string;
  desc: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.ctrlPill, value ? styles.ctrlPillOn : styles.ctrlPillOff]}
    >
      <View style={styles.ctrlLeft}>
        <Text style={styles.ctrlTitle}>{title}</Text>
        <Text style={styles.ctrlDesc} numberOfLines={1}>
          {desc}
        </Text>
      </View>

      <View style={[styles.ctrlState, value ? styles.ctrlStateOn : styles.ctrlStateOff]}>
        <Text style={styles.ctrlStateText}>{value ? "ON" : "OFF"}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  container: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 8,
  },

  heroWrap: {
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 0,
  },

  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: 0.2,
  },
  heroSub: { marginTop: 4, fontSize: 13, color: Colors.muted },

  heroRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  refreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
    backgroundColor: "rgba(0,229,255,0.08)",
  },

  helpBtn: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
    marginRight: 8,
  },
  helpBtnText: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.4,
  },

  qcCard: { marginTop: 1 },

  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillOn: {
    borderColor: "rgba(72,255,160,0.45)",
    backgroundColor: "rgba(72,255,160,0.08)",
  },
  pillOff: {
    borderColor: "rgba(255,72,72,0.45)",
    backgroundColor: "rgba(255,72,72,0.08)",
  },
  pillText: { color: Colors.text, fontWeight: "700", fontSize: 12 },

  bigToggle: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  bigToggleOn: {
    borderColor: "rgba(255,72,72,0.35)",
    backgroundColor: "rgba(255,72,72,0.08)",
  },
  bigToggleOff: {
    borderColor: "rgba(72,255,160,0.35)",
    backgroundColor: "rgba(72,255,160,0.08)",
  },
  bigToggleText: {
    color: Colors.text,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 12,
  },
  pauseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pauseText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  card: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 0,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
    minHeight: 40,
  },

  cardTitle: {
    color: Colors.text,
    fontWeight: "800",
    fontSize: 14,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    includeFontPadding: false,
    textAlignVertical: "center",
    lineHeight: 18,
    marginTop: 8,
  },

  qcTitle: { paddingTop: 2 },
  headerRight: {
    flexShrink: 0,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
  },
  cardHint: { color: Colors.muted, fontSize: 12 },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  loadingText: { color: Colors.muted, fontSize: 12 },

  emptySub: {
    marginTop: 6,
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },

  pillStack: { gap: 10 },
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

  dotWrap: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  statusDot: {
    fontSize: 11,
    lineHeight: 18,
    marginTop: 1,
    textAlign: "center",
  },

  rowTopLine: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.2,
  },

  rowBottomLine: {
    marginTop: 2,
    color: Colors.muted,
    fontWeight: "800",
    fontSize: 12,
  },

  viewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
    backgroundColor: "rgba(0,229,255,0.08)",
  },

  viewBtnRaised: {
    alignSelf: "flex-start",
    marginTop: 2,
  },

  viewBtnText: {
    color: Colors.text,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.4,
  },

  youtubeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  greetingQuote: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.95,
  },
  greetingHint: {
    color: Colors.subtext,
    fontSize: 12,
    marginTop: 6,
    opacity: 0.85,
  },

  ctrlPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  ctrlPillOn: {
    borderColor: "rgba(0,229,255,0.35)",
    backgroundColor: "rgba(0,229,255,0.10)",
  },
  ctrlPillOff: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  ctrlLeft: { flex: 1, paddingRight: 12 },
  ctrlTitle: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  ctrlDesc: {
    marginTop: 3,
    color: Colors.muted,
    fontSize: 11.5,
    fontWeight: "700",
    opacity: 0.95,
  },

  ctrlState: {
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  ctrlStateOn: {
    borderColor: "rgba(0,229,255,0.55)",
    backgroundColor: "rgba(0,229,255,0.12)",
  },
  ctrlStateOff: {
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  ctrlStateText: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.8,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  statusLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },

  statusLegendText: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.85,
  },
});
