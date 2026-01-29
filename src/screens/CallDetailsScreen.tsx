// src/screens/CallDetailsScreen.tsx
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { Colors } from "../theme/colors";
import { apiFetch } from "../api/client";

type RecentItem = {
  // NOTE: id is UI-unique in Home (sid:ts:idx). Not stable callSid.
  id?: string;

  callSid?: string;

  from?: string; // E164
  name?: string; // person
  business?: string; // business
  privateNumber?: boolean;

  at?: string;
  ts?: string;

  risk?: number; // 0..100
  voicemailUrl?: string;
  blocked?: boolean;
};

function clean(s?: string) {
  return String(s || "").trim();
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/** Same as Home: dot only, no labels */
function riskDotColor(risk: number) {
  const r = clamp(Number(risk || 0), 0, 100);
  if (r >= 75) return "rgba(255, 72, 72, 0.95)";
  if (r >= 45) return "rgba(255, 196, 72, 0.95)";
  return "rgba(72, 255, 160, 0.95)";
}

/** US-only pretty: +1 720-600-2937 (fallback raw if not parseable) */
function formatPhonePretty(e164OrRaw?: string) {
  const s = clean(e164OrRaw);
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

/**
 * Caller ID definition (your rule):
 * Person name, Business name, Private Number, Unknown Caller
 */
function callerIdLabel(it: RecentItem) {
  const person = clean(it.name);
  if (person) return person;

  const biz = clean(it.business);
  if (biz) return biz;

  if (it.privateNumber) return "Private Number";

  return "Unknown Caller";
}

/** Formats ISO -> "M/D/YYYY     h:mm:ss AM/PM" (no comma) */
function formatTimeLabel(iso?: string) {
  const s = clean(iso);
  if (!s) return "";

  const d = new Date(s);
  if (isNaN(d.getTime())) return s;

  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString();

  // non-breaking spaces for consistent visual gap across platforms
  const gap = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"; // ~6 spaces
  return `${date}${gap}${time}`;
}

export default function CallDetailsScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();

  const item: RecentItem = route?.params?.item || {};

  // ✅ stable callSid comes from route param or item.callSid (NOT item.id)
  const callSid = clean(route?.params?.callSid) || clean(item.callSid);

  const [blocked, setBlocked] = useState<boolean>(Boolean(item.blocked));

  const callerId = useMemo(() => callerIdLabel(item), [item]);
  const dot = useMemo(() => riskDotColor(item.risk ?? 0), [item.risk]);

  const phoneLine = useMemo(() => {
    if (item.privateNumber) return "";
    return formatPhonePretty(item.from);
  }, [item.from, item.privateNumber]);

  const voicemailUrl = clean(item.voicemailUrl);

  const timeIso = clean(item.at) || clean(item.ts);
  const timeLabel = useMemo(() => formatTimeLabel(timeIso), [timeIso]);

  const onToggleBlock = useCallback(async () => {
    const from = clean(item.from);
    if (!from) {
      Alert.alert("Missing number", "No caller number is available to block.");
      return;
    }

    const next = !blocked;
    setBlocked(next);

    try {
      const path = next ? "/app/api/block" : "/app/api/unblock";

      await apiFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: from }),
      });
    } catch {
      setBlocked(!next);
      Alert.alert("Could not update", "Try again.");
    }
  }, [blocked, item.from]);

  const onOpenVoicemail = useCallback(async () => {
    if (!voicemailUrl) return;

    try {
      const ok = await Linking.canOpenURL(voicemailUrl);
      if (!ok) {
        Alert.alert("Can't open voicemail link");
        return;
      }
      await Linking.openURL(voicemailUrl);
    } catch {
      Alert.alert("Could not open voicemail", "Try again.");
    }
  }, [voicemailUrl]);

  const onOpenCallId = useCallback(() => {
    // Call ID only on detail page per your rule.
    if (!callSid) return;
    Alert.alert("Call ID", callSid);
  }, [callSid]);

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
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        </View>

        {/* SUMMARY */}
        <GlassCard style={styles.card}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <Text style={styles.title} numberOfLines={1}>
              {callerId}
            </Text>
          </View>

          {phoneLine ? (
            <Text style={styles.sub} numberOfLines={1}>
              {phoneLine}
            </Text>
          ) : (
            <Text style={styles.sub} numberOfLines={1}>
              {callerId === "Private Number" ? "Number hidden" : " "}
            </Text>
          )}

          {timeLabel ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Time</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {timeLabel}
              </Text>
            </View>
          ) : null}

          {/* Call ID should only be on detail page */}
          {callSid ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Call ID</Text>

              {/* tappable so you can quickly surface it for support */}
              <Pressable onPress={onOpenCallId} style={{ flex: 1 }}>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {callSid}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </GlassCard>

        {/* ACTIONS */}
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onOpenVoicemail}
              disabled={!voicemailUrl}
              style={[
                styles.actionPill,
                styles.actionPillWide,
                !voicemailUrl ? styles.actionPillDisabled : null,
              ]}
            >
              <Text style={styles.actionPillText} numberOfLines={1}>
                {voicemailUrl ? "Play Voicemail" : "Voicemail N/A"}
              </Text>
            </Pressable>

            <Pressable
              onPress={onToggleBlock}
              style={[
                styles.actionPill,
                styles.actionPillNarrow,
                blocked ? styles.actionPillSafe : styles.actionPillDanger,
              ]}
            >
              <Text style={styles.actionPillText} numberOfLines={1}>
                {blocked ? "Unblock" : "Block"}
              </Text>
            </Pressable>
          </View>

          {voicemailUrl ? (
            <Text style={styles.hint} numberOfLines={2}>
              Tip: Voicemail opens in your browser (Twilio recording URL).
            </Text>
          ) : null}
        </GlassCard>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16, gap: 10 },

  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 6,
  },

  // matches the "Refresh/View" pill style language (small + clean)
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  backBtnText: {
    color: Colors.text,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.4,
  },

  card: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  dot: { width: 10, height: 10, borderRadius: 99 },

  title: {
    flex: 1,
    color: Colors.text,
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 0.2,
  },

  sub: {
    marginTop: 6,
    color: Colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },

  sectionTitle: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 10,
  },

  metaRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  metaLabel: { color: Colors.muted, fontSize: 12, width: 60 },
  metaValue: { color: Colors.text, fontSize: 12, flex: 1, fontWeight: "800" },

  // ✅ actions row (single definition)
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // ✅ Base pill (NO flex here; weights control width)
  actionPill: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
    backgroundColor: "rgba(0,229,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  // ✅ width weighting controls (Option B)
  actionPillWide: {
    flex: 1.7, // Play Voicemail (bigger)
  },
  actionPillNarrow: {
    flex: 1, // Block (smaller)
  },

  actionPillText: {
    color: Colors.text,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.6,
  },

  // Optional: subtle disabled state for "Voicemail N/A"
  actionPillDisabled: {
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
    opacity: 0.7,
  },

  // Unblock (safe) matches Home "pillOn" language
  actionPillSafe: {
    borderColor: "rgba(72,255,160,0.45)",
    backgroundColor: "rgba(72,255,160,0.08)",
  },

  // Block (danger) EXACTLY matches Home bigToggleOn red
  actionPillDanger: {
    borderColor: "rgba(255,72,72,0.35)",
    backgroundColor: "rgba(255,72,72,0.08)",
  },

  hint: { marginTop: 10, color: Colors.muted, fontSize: 12, lineHeight: 16 },
});
