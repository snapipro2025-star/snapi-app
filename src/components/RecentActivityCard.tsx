// src/components/RecentActivityCard.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, RefreshControl } from "react-native";
import GlassCard from "./GlassCard"; // use your existing card
import { fetchRecent, setBlocked, type RecentCall } from "../api/recent";

function fmtTs(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function getBlockedFlag(item: RecentCall) {
  const b = (item as any)?.isBlocked ?? (item as any)?.blocked;
  if (typeof b === "boolean") return b;
  // Some backends return "blocked"/"allowed"
  const s = String((item as any)?.blockStatus || "").toLowerCase();
  if (s.includes("block")) return true;
  if (s.includes("allow")) return false;
  return false;
}

export default function RecentActivityCard() {
  const [items, setItems] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const list = await fetchRecent(50);
    setItems(list);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const toggleBlock = useCallback(async (row: RecentCall) => {
    const key = row.callSid || row.from || Math.random().toString(36);
    const from = String(row.from || "").trim();
    if (!from) return;

    const currentlyBlocked = getBlockedFlag(row);
    const nextBlocked = !currentlyBlocked;

    // optimistic UI
    setItems((prev) =>
      prev.map((x) =>
        x.callSid === row.callSid
          ? { ...x, isBlocked: nextBlocked, blocked: nextBlocked, blockStatus: nextBlocked ? "blocked" : "allowed" }
          : x
      )
    );

    setBusyMap((m) => ({ ...m, [key]: true }));
    try {
      await setBlocked(from, nextBlocked);
      // re-sync with server truth
      await load();
    } catch (e: any) {
      // rollback on failure
      setItems((prev) =>
        prev.map((x) =>
          x.callSid === row.callSid
            ? { ...x, isBlocked: currentlyBlocked, blocked: currentlyBlocked, blockStatus: currentlyBlocked ? "blocked" : "allowed" }
            : x
        )
      );
      console.log("[recent] toggleBlock failed:", e?.message || e);
    } finally {
      setBusyMap((m) => ({ ...m, [key]: false }));
    }
  }, [load]);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  return (
    <GlassCard style={styles.card}>
      <Text style={styles.h}>Recent Activity</Text>
      <Text style={styles.note}>Latest calls screened by SNAPI. Tap Block/Unblock to test.</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.note}>Loading…</Text>
        </View>
      ) : empty ? (
        <Text style={styles.note}>No recent activity yet.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, idx) => `${it.callSid || it.from || "row"}:${idx}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const blocked = getBlockedFlag(item);
            const key = item.callSid || item.from || "row";
            const busy = !!busyMap[key];

            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.from}>{item.from || "(unknown)"}</Text>
                  <Text style={styles.meta}>
                    {fmtTs(item.ts)} {item.status ? `• ${item.status}` : ""} {item.action ? `• ${item.action}` : ""}
                  </Text>
                  <Text style={styles.meta}>
                    {blocked ? "Blocked" : "Allowed"}
                  </Text>
                </View>

                <Pressable
                  onPress={() => toggleBlock(item)}
                  disabled={busy}
                  style={[styles.btn, blocked ? styles.btnRed : styles.btnGreen, busy && styles.btnDisabled]}
                >
                  <Text style={styles.btnText}>{busy ? "…" : blocked ? "Unblock" : "Block"}</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12 },
  h: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  note: { opacity: 0.8, marginBottom: 10 },
  center: { paddingVertical: 14, alignItems: "center", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  from: { fontSize: 16, fontWeight: "700" },
  meta: { opacity: 0.75, marginTop: 2 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, minWidth: 92, alignItems: "center" },
  btnGreen: { backgroundColor: "rgba(46, 204, 113, 0.25)" },
  btnRed: { backgroundColor: "rgba(231, 76, 60, 0.25)" },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontWeight: "800" },
});