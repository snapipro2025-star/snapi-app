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
import { PrimaryButton, GhostButton } from "../components/Buttons";
import { Colors } from "../theme/colors";
import { apiFetch } from "../api/client";

type RecentItem = {
  id: string;
  from?: string;
  name?: string;
  at?: string; // ISO
  risk?: number; // 0..100
  transcript?: string;
  voicemailUrl?: string;
  blocked?: boolean;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function riskDotColor(risk: number) {
  const r = clamp(risk || 0, 0, 100);
  if (r >= 75) return "rgba(255, 72, 72, 0.95)";
  if (r >= 45) return "rgba(255, 196, 72, 0.95)";
  return "rgba(72, 255, 160, 0.95)";
}

function fmtWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export default function CallHistoryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const didInitialLoad = useRef(false);

  const [items, setItems] = useState<RecentItem[]>([]);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);

      // Reuse your refresh endpoint
      const r = await apiFetch("/mobile/refresh", { method: "GET" });

      const list: RecentItem[] = Array.isArray(r?.recent)
        ? r.recent
        : Array.isArray(r?.calls)
        ? r.calls
        : [];

      // For now: last 10. Later: last 50 + pagination.
      setItems(list.slice(0, 10));
    } catch (e: any) {
      Alert.alert("Could not load", e?.message || "Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const toggleBlock = useCallback(async (item: RecentItem) => {
    const next = !item.blocked;
    setItems((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, blocked: next } : x))
    );
    try {
      await apiFetch("/app/api/block", {
        method: "POST",
        body: JSON.stringify({ from: item.from, blocked: next }),
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, blocked: !next } : x))
      );
      Alert.alert("Could not update", "Try again.");
    }
  }, []);

  React.useEffect(() => {
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
          { paddingTop: Math.max(insets.top, 10), paddingBottom: Math.max(insets.bottom, 10) },
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
                <Text style={styles.emptySub}>
                  When SNAPI screens calls, they’ll appear here.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {items.map((it) => {
                  const risk = it.risk ?? 0;
                  const dot = riskDotColor(risk);
                  const who = it.name || it.from || "Unknown";
                  const when = fmtWhen(it.at);

                  return (
                    <View key={it.id} style={styles.row}>
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
                          onPress={() => toggleBlock(it)}
                          style={[
                            styles.blockBtn,
                            it.blocked ? styles.blockBtnOn : styles.blockBtnOff,
                          ]}
                        >
                          <Text style={styles.blockBtnText}>
                            {it.blocked ? "Unblock" : "Block"}
                          </Text>
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
                          title={it.voicemailUrl ? "Voicemail" : "Voicemail N/A"}
                          onPress={() => {
                            if (!it.voicemailUrl) return;
                            navigation?.navigate?.("VoicemailPlayer", {
                              url: it.voicemailUrl,
                              item: it,
                            });
                          }}
                          disabled={!it.voicemailUrl}
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

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 6 },
  title: { fontSize: 22, fontWeight: "900", color: Colors.text },
  headerRight: { flexShrink: 0 },

  refreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
  },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6 },
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

  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },

  dot: { width: 10, height: 10, borderRadius: 99 },
  rowTitle: { color: Colors.text, fontWeight: "800", fontSize: 13 },
  rowMeta: { marginTop: 2, color: Colors.muted, fontSize: 11 },

  transcript: { marginTop: 10, color: Colors.text, fontSize: 12, lineHeight: 16, opacity: 0.92 },
  transcriptEmpty: { marginTop: 10, color: Colors.muted, fontSize: 12, lineHeight: 16 },

  rowActions: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", gap: 10 },

  blockBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  blockBtnOn: { borderColor: "rgba(72,255,160,0.35)", backgroundColor: "rgba(72,255,160,0.08)" },
  blockBtnOff: { borderColor: "rgba(255,72,72,0.35)", backgroundColor: "rgba(255,72,72,0.08)" },
  blockBtnText: { color: Colors.text, fontWeight: "900", fontSize: 11 },
});
