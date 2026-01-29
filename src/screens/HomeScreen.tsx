// src/screens/HomeScreen.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { GhostButton } from "../components/Buttons";

import { Colors } from "../theme/colors";
import { apiFetch } from "../api/client";

type RecentItem = {
  id?: string; // may be callSid or custom
  callSid?: string;

  from?: string; // raw E164 (ex: +1720...)
  fromDisplay?: string; // pretty (optional)
  name?: string; // person name (optional)
  business?: string; // business name (optional)

  privateNumber?: boolean; // optional hint
  at?: string; // ISO
  ts?: string; // ISO
  risk?: number; // 0..100
  voicemailUrl?: string;
  blocked?: boolean;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Risk dot ONLY (no labels). Tune thresholds later.
 */
function riskDotColor(risk: number) {
  const r = clamp(Number(risk || 0), 0, 100);
  if (r >= 75) return "rgba(255, 72, 72, 0.95)";
  if (r >= 45) return "rgba(255, 196, 72, 0.95)";
  return "rgba(72, 255, 160, 0.95)";
}

/** Format E164-ish into "+1 720-600-2937" (US-only pretty) */
function formatUSPretty(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const digits = s.replace(/[^\d]/g, "");

  // 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith("1")) {
    const a = digits.slice(1, 4);
    const b = digits.slice(4, 7);
    const c = digits.slice(7, 11);
    return `+1 ${a}-${b}-${c}`;
  }

  // 10 digits
  if (digits.length === 10) {
    const a = digits.slice(0, 3);
    const b = digits.slice(3, 6);
    const c = digits.slice(6, 10);
    return `+1 ${a}-${b}-${c}`;
  }

  return s;
}

/**
 * Caller ID definition (your rule):
 * One of: Person name, Business name, Private Number, Unknown Caller
 */
function callerIdLine(it: RecentItem) {
  const person = String(it?.name || "").trim();
  if (person) return person;

  const biz = String(it?.business || "").trim();
  if (biz) return biz;

  if (it?.privateNumber) return "Private Number";

  return "Unknown Caller";
}

/**
 * Second line: phone formatted if present; otherwise blank.
 * (No "or" wording.)
 */
function phoneLine(it: RecentItem) {
  const raw = String(it?.fromDisplay || it?.from || "").trim();
  if (!raw) return "";
  return formatUSPretty(raw);
}

/**
 * Pick the best callSid for display + navigation.
 */
function bestCallSid(it: RecentItem) {
  return String(it?.callSid || it?.id || "").trim();
}

/**
 * Unique React key so duplicates never crash the list.
 * Your feed can include multiple rows with same callSid,
 * so we include timestamp + idx as last resort.
 */
function itemKey(it: RecentItem, idx: number) {
  const sid = bestCallSid(it) || "item";
  const t = String(it?.at || it?.ts || "").trim() || "t";
  return `${sid}:${t}:${idx}`;
}

/**
 * Dedupe for UI list:
 * Keep newest per callSid (or id fallback)
 */
function dedupeRecent(items: RecentItem[]) {
  const bySid = new Map<string, RecentItem>();

  for (const it of items || []) {
    const sid = bestCallSid(it);
    if (!sid) continue;

    const t = String(it?.at || it?.ts || "").trim();
    const cur = bySid.get(sid);

    if (!cur) {
      bySid.set(sid, it);
      continue;
    }

    const curT = String(cur?.at || cur?.ts || "").trim();
    // ISO strings compare lexicographically
    if (t && (!curT || t > curT)) {
      bySid.set(sid, it);
    }
  }

  return Array.from(bySid.values()).sort((a, b) => {
    const ta = String(a?.at || a?.ts || "");
    const tb = String(b?.at || b?.ts || "");
    return tb.localeCompare(ta); // newest first
  });
}

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

      const r = await apiFetch("/mobile/refresh", { method: "GET" });

      setEnabled(Boolean(r?.enabled ?? r?.protectionEnabled ?? true));
      setSpamOn(Boolean(r?.spamOn ?? r?.spam ?? true));
      setUnknownOn(Boolean(r?.unknownOn ?? r?.unknown ?? true));
      setVoicemailOn(Boolean(r?.voicemailOn ?? r?.voicemail ?? true));

      const items: RecentItem[] = Array.isArray(r?.recent)
        ? r.recent
        : Array.isArray(r?.calls)
        ? r.calls
        : [];

      // Condensed plan: up to 25 calls (deduped newest per callSid)
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
    } catch {
      setEnabled(!next);
      Alert.alert("Could not update", "Try again.");
    }
  }, [enabled]);

  const setRule = useCallback(
    async (key: "spam" | "unknown" | "voicemail", value: boolean) => {
      try {
        await apiFetch("/mobile/rules", {
          method: "POST",
          body: JSON.stringify({ [key]: value }),
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        Alert.alert("Could not update", "Try again.");
      }
    },
    []
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

  // initial load once
  React.useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;

    let mounted = true;
    (async () => {
      if (!mounted) return;
      setLoading(true);
      await loadRefresh();
      setLoading(false);
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
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO */}
          <View style={styles.heroWrap}>
            <Text style={styles.heroTitle}>SNAPI Shield</Text>
            <Text style={styles.heroSub}>{statusSub}</Text>

            <View style={styles.heroRow}>
              <View style={statusPillStyle}>
                <Text style={styles.pillText}>{statusLabel}</Text>
              </View>

              <Pressable
                onPress={onToggleEnabled}
                style={[
                  styles.bigToggle,
                  enabled ? styles.bigToggleOn : styles.bigToggleOff,
                ]}
              >
                <Text style={styles.bigToggleText}>
                  {enabled ? "PAUSE" : "RESUME"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* QUICK CONTROLS */}
          <GlassCard style={[styles.card, styles.qcCard]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, styles.qcTitle]} numberOfLines={1}>
                Quick Controls
              </Text>

              <View style={styles.headerRight}>
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
              <ControlPill
                title="Spam"
                desc="Block known spam"
                value={spamOn}
                onPress={toggleSpam}
              />
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
              <Text style={styles.cardHint}>
                Last {Math.min(25, recent.length)} of 25
              </Text>
            </View>

            {recent.length === 0 ? (
              <Text style={styles.emptySub}>
                When SNAPI screens a call, you’ll see it listed here.
              </Text>
            ) : (
              <View style={styles.list}>
                {recent.map((it, idx) => {
                  const dot = riskDotColor(it.risk ?? 0);
                  const top = callerIdLine(it);
                  const bottom = phoneLine(it);
                  const callSid = bestCallSid(it);

                  return (
                    <View key={itemKey(it, idx)} style={styles.row}>
                      <View style={styles.rowTop}>
                        <View style={styles.rowLeft}>
                          <View style={[styles.dot, { backgroundColor: dot }]} />

                          <View style={{ flex: 1 }}>
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
                          style={styles.viewBtn}
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

      <View
        style={[
          styles.ctrlState,
          value ? styles.ctrlStateOn : styles.ctrlStateOff,
        ]}
      >
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
  headerRight: { flexShrink: 0, alignSelf: "center" },
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

  dot: { width: 10, height: 10, borderRadius: 99 },

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

  // mini button that matches Refresh styling language
  viewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  viewBtnText: {
    color: Colors.text,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.4,
  },

  callId: {
    marginTop: 8,
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
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
});
