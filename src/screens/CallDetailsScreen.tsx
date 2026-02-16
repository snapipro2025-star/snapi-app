// src/screens/CallDetailsScreen.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
  Platform,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { syncContactsAllowlistNow } from "../lib/allowlistSync";

import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { Colors } from "../theme/colors";
import { apiFetch, BASE_URL } from "../api/client";

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

  // optional newer fields
  status?: string;
  action?: string;
  decision?: string;

  // server fields (present on /app/api/recent)
  allowlisted?: boolean;
  allowed?: boolean;

  // recording sid fields
  voicemailRecordingSid?: string;
  recordingSid?: string;
};

function clean(s?: any) {
  return String(s ?? "").trim();
}

function InfoIcon({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.infoBtn}>
      <Text style={styles.infoBtnText}>ⓘ</Text>
    </Pressable>
  );
}

function formatUSPretty(raw?: string) {
  const s = clean(raw);
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

function formatTimeLabel(iso?: string) {
  const s = clean(iso);
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;

  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString();
  const gap = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0";
  return `${date}${gap}${time}`;
}

function getVoicemailUrl(it: RecentItem) {
  return clean(it.voicemailUrl) || clean(it.recordingUrl);
}

function callerIdLabel(it: RecentItem) {
  const status = clean((it as any)?.status);
  if (status) return status;

  const person = clean(it.name);
  if (person) return person;

  const biz = clean(it.business);
  if (biz) return biz;

  if (it.privateNumber) return "Private Number";
  return "Unknown Caller";
}

function bestCallSid(it: RecentItem, routeSid?: string) {
  const a = clean(routeSid);
  if (a) return a;
  const b = clean((it as any)?.callSid);
  if (b) return b;
  const c = clean((it as any)?.sid);
  if (c) return c;
  return "";
}

// 🔴 blocked | 🟢 allowed | 🟡 unknown
function dotEmoji(blocked: boolean, allowed: boolean) {
  if (blocked) return "🔴";
  if (allowed) return "🟢";
  return "🟡";
}

function inferAllowed(it: RecentItem) {
  const allowlisted = Boolean((it as any)?.allowlisted) || Boolean((it as any)?.allowed);

  const action = clean((it as any)?.action).toLowerCase();
  const decision = clean((it as any)?.decision).toLowerCase();
  const status = clean((it as any)?.status).toLowerCase();

  const implied =
    action === "allow" ||
    decision === "allow" ||
    decision.startsWith("allow_") ||
    status.startsWith("allowed");

  return allowlisted || implied;
}

async function safeCanOpen(url: string) {
  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

function toSearchQueryNumber(raw?: string) {
  const s = clean(raw);
  if (!s) return "";
  const hasPlus = s.trim().startsWith("+");
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

function bestErrorMessage(e: any) {
  // Prefer our rich http error: { status, body, message }
  const msg =
    clean(e?.message) ||
    clean(e?.body?.error) ||
    clean(e?.body?.message) ||
    clean(e?.error) ||
    "";
  return msg || "Try again.";
}

// helper (top of file or near bestErrorMessage)
function formEncode(obj: Record<string, any>) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    p.append(k, String(v));
  });
  return p.toString();
}

export default function CallDetailsScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();

  const item: RecentItem = route?.params?.item || {};
  const callSid = useMemo(
    () => bestCallSid(item, route?.params?.callSid),
    [item, route?.params?.callSid]
  );

  const from = clean(item.from);
  const canActOnNumber = !!from && !item.privateNumber;

  const [blocked, setBlocked] = useState<boolean>(Boolean(item.blocked));
  const [allowed, setAllowed] = useState<boolean>(inferAllowed(item));

  const [savingBlock, setSavingBlock] = useState(false);
  const [savingAllow, setSavingAllow] = useState(false);
  const [openingVoicemail, setOpeningVoicemail] = useState(false);

  // Actions info modal
  const [showActionsInfo, setShowActionsInfo] = useState(false);

  // mutex to prevent double posts
  const inFlightRef = useRef<Record<string, boolean>>({});
  const saving = savingAllow || savingBlock;

  const callerId = useMemo(() => callerIdLabel(item), [item]);

  const phoneLine = useMemo(() => {
    if (item.privateNumber) return "";
    const raw = clean(item.fromDisplay) || clean(item.from);
    return formatUSPretty(raw);
  }, [item.from, item.fromDisplay, item.privateNumber]);

  const voicemailUrl = useMemo(() => getVoicemailUrl(item), [item]);
  const timeIso = clean(item.at) || clean(item.ts);
  const timeLabel = useMemo(() => formatTimeLabel(timeIso), [timeIso]);

  const dot = useMemo(() => dotEmoji(blocked, allowed), [blocked, allowed]);

  async function postOnce(
    key: string,
    setBusy: (b: boolean) => void,
    fn: () => Promise<any>
  ) {
    if (inFlightRef.current[key]) return;
    inFlightRef.current[key] = true;
    setBusy(true);

    try {
      const r = await fn();
      if (r && typeof r === "object" && "ok" in r && (r as any).ok !== true) {
        throw new Error((r as any).error || "request_failed");
      }
      return r;
    } finally {
      setBusy(false);
      setTimeout(() => {
        inFlightRef.current[key] = false;
      }, 650);
    }
  }

  const setBlock = useCallback(
    async (next: boolean) => {
      if (!canActOnNumber) {
        Alert.alert("Not available", "Private/hidden numbers can’t be updated.");
        return;
      }
      if (savingBlock) return;

      // optimistic UI
      setBlocked(next);
      if (next) setAllowed(false);

      try {
        await postOnce(`block:${from}:${next ? "1" : "0"}`, setSavingBlock, () =>
          apiFetch("/app/api/block", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formEncode({ from, blocked: next }),
          })
        );
      } catch (e: any) {
        setBlocked(!next);
        Alert.alert("Could not update", bestErrorMessage(e));
      }
    },
    [from, canActOnNumber, savingBlock]
  );

  const setAllowAction = useCallback(
    async (next: boolean) => {
      if (!canActOnNumber) {
        Alert.alert("Not available", "Private/hidden numbers can’t be updated.");
        return;
      }
      if (savingAllow) return;

      // optimistic UI
      setAllowed(next);
      if (next) setBlocked(false);

      try {
        await postOnce(`allow:${from}:${next ? "1" : "0"}`, setSavingAllow, () =>
          apiFetch("/app/api/allow", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formEncode({ from, allow: next }),
        })
        );
      } catch (e: any) {
        setAllowed(!next);
        Alert.alert("Could not update", bestErrorMessage(e));
      }
    },
    [from, canActOnNumber, savingAllow]
  );

  const onAddToContacts = useCallback(async () => {
    if (!canActOnNumber) {
      Alert.alert("Not available", "Private/hidden numbers can’t be added to contacts.");
      return;
    }

    try {
      const tel = `tel:${from}`;
      const okTel = await safeCanOpen(tel);
      if (okTel) {
        await Linking.openURL(tel);
        return;
      }

      const contacts = Platform.OS === "android" ? "content://contacts/people/" : "contacts:";
      const okContacts = await safeCanOpen(contacts);
      if (okContacts) {
        await Linking.openURL(contacts);
        return;
      }

      Alert.alert("Not supported", "This device can't open the dialer/contacts.");
    } catch {
      Alert.alert("Could not open", "Try again.");
    }
  }, [from, canActOnNumber]);

  // Tap = search in browser
  const onSearchNumber = useCallback(async () => {
    if (!canActOnNumber) return;

    const q = toSearchQueryNumber(from);
    if (!q) return;

    const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;

    try {
      const ok = await safeCanOpen(url);
      if (!ok) {
        Alert.alert("Not supported", "This device can’t open the browser.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Could not open", "Try again.");
    }
  }, [from, canActOnNumber]);

  // Long press = copy to clipboard
  const onCopyNumber = useCallback(async () => {
    if (!canActOnNumber) return;
    if (!from) return;

    try {
      await Clipboard.setStringAsync(from);
      Alert.alert("Copied", from);
    } catch {
      Alert.alert("Could not copy", "Try again.");
    }
  }, [from, canActOnNumber]);

  const onOpenVoicemail = useCallback(async () => {
    if (openingVoicemail) return;

    const sid = String(
      (item as any)?.voicemailRecordingSid || (item as any)?.recordingSid || ""
    ).trim();

    const url = sid
      ? `${BASE_URL}/app/api/voicemail/${encodeURIComponent(sid)}`
      : String(voicemailUrl || "").trim();

    if (!url) return;

    setOpeningVoicemail(true);

    // Prefer: in-app player
    try {
      navigation?.navigate?.("VoicemailPlayer", {
        url,
        item,
        callSid,
        recordingSid: sid || undefined,
      });
      setTimeout(() => setOpeningVoicemail(false), 250);
      return;
    } catch {
      // fall through
    }

    try {
      const ok = await safeCanOpen(url);
      if (!ok) {
        Alert.alert("Can't open voicemail link");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Could not open voicemail", "Try again.");
    } finally {
      setOpeningVoicemail(false);
    }
  }, [openingVoicemail, item, voicemailUrl, navigation, callSid]);

  const onOpenCallId = useCallback(() => {
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

        {/* SUMMARY (INFO ONLY) */}
        <GlassCard style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.statusDot}>{dot}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {callerId}
            </Text>
          </View>

          {phoneLine ? (
            <Pressable
              onPress={onSearchNumber}
              onLongPress={onCopyNumber}
              delayLongPress={350}
              disabled={!canActOnNumber}
            >
              <Text style={[styles.sub, styles.subLink]} numberOfLines={1}>
                {phoneLine}
              </Text>
              <Text style={styles.tapHint} numberOfLines={1}>
                Tap to search • Hold to copy
              </Text>
            </Pressable>
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

          {callSid ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Call ID</Text>

              <Pressable onPress={onOpenCallId} style={{ flex: 1 }}>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {callSid}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </GlassCard>

        {/* ACTIONS (ALL BUTTONS LIVE HERE) */}
        <GlassCard style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <InfoIcon onPress={() => setShowActionsInfo(true)} />
          </View>

          {/* Voicemail */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={onOpenVoicemail}
              disabled={!voicemailUrl || openingVoicemail}
              style={({ pressed }) => [
                styles.actionPill,
                styles.actionPillWide,
                !voicemailUrl || openingVoicemail ? styles.actionPillDisabled : null,
                pressed && voicemailUrl && !openingVoicemail ? styles.actionPillPressed : null,
              ]}
            >
              <Text style={styles.actionPillText} numberOfLines={1}>
                {voicemailUrl ? "Play Voicemail" : "Voicemail N/A"}
              </Text>
            </Pressable>
          </View>

          {/* Primary Actions */}
          <View style={[styles.actionsCol, { marginTop: 10 }]}>
            <Pressable
              onPress={() => setAllowAction(!allowed)}
              disabled={saving || !canActOnNumber}
              style={({ pressed }) => [
                styles.actionPill,
                styles.actionPillFull,
                styles.actionPillAllow,
                saving || !canActOnNumber ? styles.actionPillDisabled : null,
                pressed && !saving && canActOnNumber ? styles.actionPillPressed : null,
              ]}
            >
              <Text style={styles.actionPillText} numberOfLines={1}>
                {allowed ? "Remove from Allowlist" : "Add to Allowlist"}
              </Text>
            </Pressable>

            <Pressable
              onPress={onAddToContacts}
              disabled={!canActOnNumber}
              style={({ pressed }) => [
                styles.actionPill,
                styles.actionPillFull,
                styles.actionPillNeutral,
                !canActOnNumber ? styles.actionPillDisabled : null,
                pressed && canActOnNumber ? styles.actionPillPressed : null,
              ]}
            >
              <Text style={styles.actionPillText} numberOfLines={1}>
                Add to Contacts
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setBlock(!blocked)}
              disabled={saving || !canActOnNumber}
              style={({ pressed }) => [
                styles.actionPill,
                styles.actionPillFull,
                blocked ? styles.actionPillSafe : styles.actionPillDanger,
                saving || !canActOnNumber ? styles.actionPillDisabled : null,
                pressed && !saving && canActOnNumber ? styles.actionPillPressed : null,
              ]}
            >
              <Text style={styles.actionPillText} numberOfLines={1}>
                {blocked ? "Unblock Caller" : "Block Caller"}
              </Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                try {
                  const r = await syncContactsAllowlistNow();
                  Alert.alert(
                    r.ok ? "Contacts synced" : "Sync failed",
                    r.ok ? `Synced ${r.count ?? 0} numbers.` : (r.error || "Unknown error")
                  );
                } catch (e: any) {
                  Alert.alert("Sync failed", String(e?.message || e));
                }
              }}
              disabled={saving}
              style={({ pressed }) => [
                styles.actionPill,
                styles.actionPillFull,
                styles.actionPillNeutral,
                saving ? styles.actionPillDisabled : null,
                pressed && !saving ? styles.actionPillPressed : null,
              ]}
            >
              <Text style={styles.actionPillText} numberOfLines={1}>
                Sync Contacts
              </Text>
            </Pressable>
          </View>

          {/* Notes */}
          {canActOnNumber && !saving ? (
            <Text style={styles.syncNote} numberOfLines={2}>
              Note: Changes here won’t appear in Call Activity until you press Refresh.
            </Text>
          ) : null}

          {!canActOnNumber ? (
            <Text style={styles.hint} numberOfLines={2}>
              Private/hidden numbers can’t be allowed, blocked, or added to contacts.
            </Text>
          ) : saving ? (
            <Text style={styles.hint} numberOfLines={1}>
              Saving…
            </Text>
          ) : null}
        </GlassCard>
      </View>

      {/* Actions Info Modal (ⓘ) */}
      <Modal
        visible={showActionsInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsInfo(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowActionsInfo(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Actions</Text>

            <Text style={styles.modalText}>Changes you make here apply immediately.</Text>

            <Text style={styles.modalText}>
              Call Activity won’t reflect those changes until you press{" "}
              <Text style={styles.modalStrong}>Refresh</Text>.
            </Text>

            <Pressable style={styles.modalBtn} onPress={() => setShowActionsInfo(false)}>
              <Text style={styles.modalBtnText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  statusDot: {
    width: 16,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    opacity: 0.9,
  },

  title: {
    flex: 1,
    color: Colors.text,
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 0.2,
  },

  sub: { marginTop: 6, color: Colors.muted, fontSize: 13, fontWeight: "800" },

  subLink: {
    color: Colors.accent || Colors.text,
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
  },

  tapHint: {
    marginTop: 2,
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
  },

  sectionTitle: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 14,
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

  actionsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionsCol: { gap: 10 },

  actionPill: {
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
    backgroundColor: "rgba(0,229,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  actionPillWide: { flex: 1 },
  actionPillFull: { width: "100%" },

  actionPillText: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.3,
  },

  actionPillDisabled: {
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.035)", // slightly dimmer
    opacity: 0.55, // lower so disabled is obvious
  },

  actionPillAllow: {
    borderColor: "rgba(0,229,255,0.45)",
    backgroundColor: "rgba(0,229,255,0.10)",
  },

  actionPillNeutral: {
    borderColor: "rgba(0,229,255,0.28)", // slightly stronger
    backgroundColor: "rgba(0,229,255,0.07)", // more visible idle state
  },

  actionPillPressed: {
    backgroundColor: "rgba(0,229,255,0.16)",
    borderColor: "rgba(0,229,255,0.55)",
    transform: [{ scale: 0.97 }],
  },

  actionPillSafe: {
    borderColor: "rgba(72,255,160,0.45)",
    backgroundColor: "rgba(72,255,160,0.08)",
  },

  actionPillDanger: {
    borderColor: "rgba(255,72,72,0.35)",
    backgroundColor: "rgba(255,72,72,0.08)",
  },

  actionsWrap: { 
    marginTop: 10, gap: 10 },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  infoBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtnText: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 14,
    marginTop: -1,
  },

  hint: { marginTop: 10, color: Colors.muted, fontSize: 12, lineHeight: 16 },

  syncNote: {
    marginTop: 10,
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(8,12,28,0.96)",
    padding: 16,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },
  modalText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 6,
  },
  modalStrong: {
    color: Colors.text,
    fontWeight: "900",
  },
  modalBtn: {
    marginTop: 14,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
    backgroundColor: "rgba(0,229,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
