// src/screens/SetupHelpScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Application from "expo-application";
import * as Clipboard from "expo-clipboard";
import * as Contacts from "expo-contacts";
import * as IntentLauncher from "expo-intent-launcher";
import AsyncStorage from "@react-native-async-storage/async-storage";

import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";
import { apiFetch, BASE_URL } from "../api/client";

function clean(v: any) {
  return String(v ?? "").trim();
}

function prettyJson(obj: any) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return String(obj ?? "");
  }
}

const SUPPORT_EMAIL = "support@snapipro.com";
const YOUTUBE_SETUP_URL = "https://youtu.be/5YJ9ae9kr1s";

// ✅ Must match TWILIO_CALLER_ID (what you want users to save as "SNAPI Intercept")
const SNAPI_INTERCEPT_NUMBER = "+17204576848";

// ✅ One-time acknowledgement key (keyed to the number so if callerId changes, it can show again)
const KEY_INTERCEPT_ACK = `snapi:ack:intercept_contact:v1:${SNAPI_INTERCEPT_NUMBER}`;

type Props = { navigation: any };

type Diag = {
  ok?: boolean;

  pingOk?: boolean;
  pingStatus?: number | string;
  pingEcho?: any;

  healthOk?: boolean;
  healthStatus?: number | string;
  healthEcho?: any;

  platform?: string;
  deviceId?: string;
  version?: string;
  build?: string;
  ts?: string;

  error?: string;

  snapiNumber?: string;
  snapiNumberError?: string;
};

export default function SetupHelpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState<Diag>({});
  const [snapiNumber, setSnapiNumber] = useState<string | null>(null);
  const [snapiNumberError, setSnapiNumberError] = useState<string | null>(null);

  // --------------------------------------------------
  // SNAPI Intercept contact helper (LOCKED)
  // Save Contact → SNAPI Intercept
  // Number → *71${snapiNumber}
  // --------------------------------------------------
  const contactName = "SNAPI Intercept";
  const contactNumber = useMemo(() => {
    const n = String(snapiNumber || diag.snapiNumber || "").trim();
    // Prefer 10-digit formatting for display/use
    const digits = n.replace(/[^\d]/g, "");
    const ten = digits.length >= 10 ? digits.slice(-10) : "";
    return ten ? `*71${ten}` : "";
  }, [snapiNumber, diag.snapiNumber]);

  const [savingContact, setSavingContact] = useState(false);

  // ✅ One-time acknowledgement UI state
  const [showInterceptCard, setShowInterceptCard] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);

  const deviceId = useMemo(() => {
    const id = (Application as any)?.androidId ?? "";
    return clean(id) || "(unknown)";
  }, []);

  const version = useMemo(() => clean((Application as any)?.nativeApplicationVersion), []);
  const build = useMemo(() => clean((Application as any)?.nativeBuildVersion), []);

  const close = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.("Home");
  }, [navigation]);

  const openSetupVideo = useCallback(() => {
    Linking.openURL(YOUTUBE_SETUP_URL).catch(() => {
      Alert.alert("Couldn’t open link", "Please try again or copy the link from support.");
    });
  }, []);

  const copyText = useCallback(async (label: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied", `${label}\n\n${text}`);
    } catch {
      Alert.alert("Copy failed", "Couldn’t copy on this device.");
    }
  }, []);

  // ✅ Load one-time acknowledgement flag
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY_INTERCEPT_ACK);
        setShowInterceptCard(v !== "1"); // show until acknowledged
      } catch {
        setShowInterceptCard(true);
      }
    })();
  }, []);

  // ✅ Mark acknowledged (one-time)
  const markInterceptAcknowledged = useCallback(async () => {
    try {
      await AsyncStorage.setItem(KEY_INTERCEPT_ACK, "1");
    } catch {}
    setShowInterceptCard(false);
  }, []);

  const saveSnapiInterceptContact = useCallback(async () => {
    try {
      setSavingContact(true);

      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Contacts Permission Needed",
          "Please allow Contacts access so SNAPI can save the Intercept contact."
        );
        return;
      }

      // Avoid duplicates
      const found = await Contacts.getContactsAsync({
        name: "SNAPI Intercept",
        fields: [Contacts.Fields.PhoneNumbers],
      });

      const already =
        (found?.data || []).some((c) =>
          (c.phoneNumbers || []).some((p) => {
            const n = String(p.number || "").replace(/\s+/g, "");
            return n === SNAPI_INTERCEPT_NUMBER;
          })
        ) || false;

      if (already) {
        Alert.alert("Already Saved", "SNAPI Intercept is already in your contacts.");
        return;
      }

      await Contacts.addContactAsync({
        [Contacts.Fields.FirstName]: "SNAPI",
        [Contacts.Fields.LastName]: "Intercept",
        [Contacts.Fields.PhoneNumbers]: [{ label: "work", number: SNAPI_INTERCEPT_NUMBER }],
      } as any);

      Alert.alert("Saved", "SNAPI Intercept was added to your contacts.");
    } catch (e: any) {
      Alert.alert("Save Failed", String(e?.message || e));
    } finally {
      setSavingContact(false);
    }
  }, []);

  const runDiagnostics = useCallback(async () => {
    setBusy(true);
    setSnapiNumber(null);
    setSnapiNumberError(null);

    const base = clean(BASE_URL) || clean((globalThis as any)?.BASE_URL) || "";

    const next: Diag = {
      ok: true,
      platform: Platform.OS,
      deviceId,
      version,
      build,
      ts: new Date().toISOString(),
    };

    try {
      // /ping
      try {
        const r = await fetch(`${base}/ping`, { method: "GET" });
        next.pingStatus = r.status;
        next.pingOk = r.ok;
        let body: any = null;
        try {
          body = await r.json();
        } catch {
          body = await r.text().catch(() => "");
        }
        next.pingEcho = body;
      } catch (e: any) {
        next.pingOk = false;
        next.pingStatus = "error";
        next.pingEcho = String(e?.message || e);
      }

      // /health
      try {
        const r = await fetch(`${base}/health`, { method: "GET" });
        next.healthStatus = r.status;
        next.healthOk = r.ok;
        let body: any = null;
        try {
          body = await r.json();
        } catch {
          body = await r.text().catch(() => "");
        }
        next.healthEcho = body;
      } catch (e: any) {
        next.healthOk = false;
        next.healthStatus = "error";
        next.healthEcho = String(e?.message || e);
      }

      // Optional: fetch "your SNAPI number" if endpoint exists (best-effort)
      let fetched: string | null = null;
      const candidates = ["/mobile/snapi-number", "/mobile/number", "/mobile/me/number"];
      for (const path of candidates) {
        try {
          const r = await apiFetch(path, { method: "GET" });
          const n =
            clean((r as any)?.snapiNumber) ||
            clean((r as any)?.number) ||
            clean((r as any)?.value) ||
            "";
          if (n) {
            fetched = n;
            break;
          }
        } catch {
          // ignore and try next candidate
        }
      }

      if (fetched) {
        setSnapiNumber(fetched);
        next.snapiNumber = fetched;
      } else {
        next.snapiNumber = "";
      }

      setDiag(next);
    } catch (e: any) {
      setDiag({
        ...next,
        ok: false,
        error: String(e?.message || e),
      });
    } finally {
      setBusy(false);
    }
  }, [build, deviceId, version]);

  useEffect(() => {
    runDiagnostics().catch(() => {});
  }, [runDiagnostics]);

  return (
    <GlassBackground>
      <View style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 14 }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={close} hitSlop={10} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>

          <Text style={styles.title}>Setup</Text>

          <Pressable onPress={openSetupVideo} hitSlop={10} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Video</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ✅ One-time acknowledgement card */}
          {showInterceptCard && (
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>Identify SNAPI Calls</Text>
              <Text style={styles.cardBody}>
                When SNAPI screens an unknown caller, it may call you back from its secure intercept number.
                Save it as <Text style={styles.bold}>SNAPI Intercept</Text> so you always recognize screening calls.
              </Text>

              <View style={styles.numberBox}>
                <Text style={styles.numberLabel}>SNAPI Intercept Number</Text>
                <Text style={styles.numberValue}>{SNAPI_INTERCEPT_NUMBER}</Text>
              </View>

              <View style={styles.row}>
                <Pressable
                  onPress={saveSnapiInterceptContact}
                  disabled={savingContact}
                  style={[styles.primaryBtn, savingContact && { opacity: 0.6 }]}
                >
                  <Text style={styles.primaryBtnText}>{savingContact ? "Saving..." : "Save Contact"}</Text>
                </Pressable>

                <Pressable
                  onPress={() => copyText("SNAPI Intercept Number", SNAPI_INTERCEPT_NUMBER)}
                  style={styles.ghostBtn}
                >
                  <Text style={styles.ghostBtnText}>Copy</Text>
                </Pressable>
              </View>

              {/* Explicit acknowledgement */}
              <Pressable onPress={() => setAckChecked((v) => !v)} style={styles.ackRow} hitSlop={10}>
                <View style={[styles.checkbox, ackChecked && styles.checkboxOn]}>
                  {ackChecked ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={styles.ackText}>
                  I saved this number as “SNAPI Intercept” (or I understand SNAPI screening calls will come from this number).
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  if (!ackChecked) {
                    Alert.alert(
                      "Confirmation required",
                      "Please check the box to acknowledge this one-time setup step."
                    );
                    return;
                  }
                  await markInterceptAcknowledged();

                  // 🔐 send audit acknowledgement (non-blocking)
                  try {
                    const base = String(BASE_URL || "").trim();
                    if (base) {
                      await fetch(`${base}/mobile/setup-ack`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-snapi-device-id": deviceId, // nice to have for audit logs
                        },
                        body: JSON.stringify({
                          version: "intercept_v1",
                          platform: Platform.OS,
                        }),
                      });
                    }
                  } catch {}

                  // UX confirmation
                  Alert.alert("Confirmed", "You're all set.");
                }}
                style={[styles.confirmBtn, !ackChecked && { opacity: 0.45 }]}
              >
                <Text style={styles.confirmBtnText}>Confirm & Continue</Text>
              </Pressable>
            </GlassCard>
          )}

          {/* Diagnostics */}
          <GlassCard style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle}>Diagnostics</Text>
              <Pressable onPress={runDiagnostics} disabled={busy} style={[styles.smallBtn, busy && { opacity: 0.6 }]}>
                <Text style={styles.smallBtnText}>{busy ? "Running..." : "Run"}</Text>
              </Pressable>
            </View>

            <Text style={styles.mono}>
              {prettyJson({
                BASE_URL: clean(BASE_URL),
                platform: diag.platform,
                deviceId: diag.deviceId,
                version: diag.version,
                build: diag.build,
                ping: { ok: diag.pingOk, status: diag.pingStatus, echo: diag.pingEcho },
                health: { ok: diag.healthOk, status: diag.healthStatus, echo: diag.healthEcho },
                snapiNumber: snapiNumber || diag.snapiNumber || "",
                ts: diag.ts,
                error: diag.error || "",
              })}
            </Text>

            {!!snapiNumberError && <Text style={styles.warnText}>{snapiNumberError}</Text>}
          </GlassCard>

          {/* Call Forwarding Setup (Manual) */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>Call Forwarding Setup</Text>
            <Text style={styles.cardBody}>
              SNAPI uses conditional call forwarding. Enter these codes manually in your phone dialer using your SNAPI
              forwarding number.
            </Text>

            <Text style={styles.mono}>
              SNAPI Number: {snapiNumber || diag.snapiNumber || "(not loaded)"}
            </Text>

            {/* SNAPI Intercept contact instructions */}
            <Text style={styles.mono}>
              Save Contact → SNAPI Intercept
            </Text>

            <Text style={styles.mono}>
              Number → {contactNumber || "*71(loading...)"}
            </Text>

            {!snapiNumber && !diag.snapiNumber ? (
              <Text style={styles.warnText}>
                SNAPI number not loaded yet. Run Diagnostics, then come back here.
              </Text>
            ) : null}

            {/* Verizon */}
            <Text style={[styles.cardBody, { marginTop: 10, fontWeight: "700" }]}>Verizon</Text>
            <Text style={styles.mono}>Activate (No Answer): *71 + SNAPI number</Text>
            <Text style={styles.mono}>Deactivate: *73</Text>

            {/* AT&T */}
            <Text style={[styles.cardBody, { marginTop: 10, fontWeight: "700" }]}>AT&amp;T</Text>
            <Text style={styles.mono}>Activate (If No Answer): *92 + SNAPI number + #</Text>
            <Text style={styles.mono}>Deactivate: *73#</Text>

            {/* T-Mobile */}
            <Text style={[styles.cardBody, { marginTop: 10, fontWeight: "700" }]}>T-Mobile</Text>
            <Text style={styles.mono}>Activate (If No Answer): **61*SNAPI_NUMBER#</Text>
            <Text style={styles.mono}>Deactivate all forwarding: ##004#</Text>

            <Text style={[styles.cardBody, { marginTop: 10 }]}>
              Tip: After enabling, call your phone from another number and ignore the call. It should forward to SNAPI.
            </Text>

            <View style={[styles.row, { marginTop: 10 }]}>
              <Pressable
                onPress={() => copyText("SNAPI Number", String(snapiNumber || diag.snapiNumber || ""))}
                style={styles.ghostBtn}
                disabled={!(snapiNumber || diag.snapiNumber)}
              >
                <Text style={styles.ghostBtnText}>Copy SNAPI Number</Text>
              </Pressable>

              <Pressable
                onPress={() => copyText("SNAPI Intercept", contactNumber)}
                style={styles.ghostBtn}
                disabled={!contactNumber}
              >
                <Text style={styles.ghostBtnText}>Copy SNAPI Intercept</Text>
              </Pressable>

              <Pressable
                onPress={() => Linking.openURL("tel:").catch(() => {})}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Open Dialer</Text>
              </Pressable>
            </View>

            <View style={[styles.row, { marginTop: 10 }]}>
              <Pressable
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("SNAPI Forwarding Help")}`).catch(() => {})}
                style={styles.ghostBtn}
              >
                <Text style={styles.ghostBtnText}>Need Help?</Text>
              </Pressable>

              <Pressable
                onPress={runDiagnostics}
                disabled={busy}
                style={[styles.smallBtn, busy && { opacity: 0.6 }]}
              >
                <Text style={styles.smallBtnText}>{busy ? "Running..." : "Run Diagnostics"}</Text>
              </Pressable>
            </View>
          </GlassCard>

          {/* Support */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>Support</Text>
            <Text style={styles.cardBody}>
              If anything feels off, email support with a screenshot of the Diagnostics card.
            </Text>

            <View style={styles.row}>
              <Pressable onPress={() => copyText("Support Email", SUPPORT_EMAIL)} style={styles.ghostBtn}>
                <Text style={styles.ghostBtnText}>Copy Email</Text>
              </Pressable>

              <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Email Support</Text>
              </Pressable>
            </View>
          </GlassCard>

          <View style={{ height: 16 }} />
        </ScrollView>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Tokens.pad?.screen ?? 18,
  },
  scroll: {
    paddingBottom: 24,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  backBtnText: {
    color: Colors.text,
    fontWeight: "800",
  },
  linkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  linkBtnText: {
    color: Colors.text,
    fontWeight: "800",
  },

  card: {
    marginTop: 12,
    padding: Tokens.pad?.card ?? 14,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  cardBody: {
    color: Colors.subtext,
    marginTop: 8,
    lineHeight: 20,
  },
  bold: {
    color: Colors.text,
    fontWeight: "900",
  },

  numberBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  numberLabel: {
    color: Colors.subtext,
    fontSize: 12,
  },
  numberValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },

  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  primaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  primaryBtnText: {
    color: Colors.text,
    fontWeight: "900",
  },

  ghostBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  ghostBtnText: {
    color: Colors.text,
    fontWeight: "900",
  },

  dangerBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,80,80,0.16)",
  },
  dangerBtnText: {
    color: Colors.text,
    fontWeight: "900",
  },

  smallBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  smallBtnText: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 12,
  },

  mono: {
    marginTop: 10,
    color: Colors.subtext,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 12,
    lineHeight: 16,
  },

  warnText: {
    marginTop: 10,
    color: "rgba(255,170,0,0.95)",
    fontWeight: "800",
  },

  // ✅ Acknowledgement UI
  ackRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.35)",
  },
  checkmark: {
    color: Colors.text,
    fontWeight: "900",
  },
  ackText: {
    flex: 1,
    color: Colors.subtext,
    lineHeight: 18,
    fontSize: 13,
    fontWeight: "700",
  },
  confirmBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  confirmBtnText: {
    color: Colors.text,
    fontWeight: "900",
  },
});