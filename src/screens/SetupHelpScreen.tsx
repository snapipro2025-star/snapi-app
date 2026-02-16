// src/screens/SetupHelpScreen.tsx
import React, { useCallback, useMemo, useState } from "react";
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

import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";
import { apiFetch } from "../api/client";

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

function safeBool(v: any) {
  return v === true;
}

const SUPPORT_EMAIL = "support@snapipro.com";
const YOUTUBE_SETUP_URL = "https://www.youtube.com/";

// ===== SNAPI forwarding =====
const SNAPI_FORWARD_TO = "7204576848";
const CODE_ENABLE_CCF = `*71${SNAPI_FORWARD_TO}`;
const CODE_DISABLE_CCF = "*73";
const CODE_STATUS_CCF = "*#21#";

type Props = { navigation: any };

type Diag = {
  ok?: boolean;
  pingOk?: boolean;
  pingStatus?: number | string;
  pingEcho?: any;
  platform?: string;
  deviceId?: string;
  version?: string;
  build?: string;
  ts?: string;
  error?: string;
};

export default function SetupHelpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState<Diag>({});

  const deviceId = useMemo(() => {
    const id = (Application as any)?.androidId ?? "";
    return clean(id) || "(unknown)";
  }, []);

  const version = useMemo(
    () => clean((Application as any)?.nativeApplicationVersion),
    []
  );

  const build = useMemo(
    () => clean((Application as any)?.nativeBuildVersion),
    []
  );

  const close = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.("Home");
  }, [navigation]);

  const openSetupVideo = useCallback(() => {
    Linking.openURL(YOUTUBE_SETUP_URL).catch(() => {
      Alert.alert(
        "Couldn’t open link",
        "Please try again or copy the link from support."
      );
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

  const tryDial = useCallback(async (code: string) => {
    const url = `tel:${code}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert("Dial manually", code);
    } catch {
      Alert.alert("Dial manually", code);
    }
  }, []);

  const openMail = useCallback(() => {
    const subject = encodeURIComponent("SNAPI Setup Help");
    const body = encodeURIComponent(
      `Hi SNAPI Support,\n\nI need help setting up SNAPI.\n\nDevice:\n- platform: ${Platform.OS}\n- deviceId: ${deviceId}\n- version: ${
        version || "(unknown)"
      }\n- build: ${build || "(unknown)"}\n\nDiagnostics:\n${prettyJson(
        diag
      )}\n`
    );

    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        "Email not available",
        `Please email us at ${SUPPORT_EMAIL}`
      );
    });
  }, [deviceId, version, build, diag]);

  const copyDiagnostics = useCallback(async () => {
    const text =
      `SNAPI Setup Diagnostics\n` +
      `platform: ${Platform.OS}\n` +
      `deviceId: ${deviceId}\n` +
      `version: ${version || "(unknown)"}\n` +
      `build: ${build || "(unknown)"}\n\n` +
      `${prettyJson(diag)}\n`;

    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied", "Diagnostics copied to clipboard.");
    } catch {
      Alert.alert("Copy failed", "Couldn’t copy diagnostics.");
    }
  }, [deviceId, version, build, diag]);

  const runDiagnostics = useCallback(async () => {
    setBusy(true);

    const base: Diag = {
      ts: new Date().toISOString(),
      platform: Platform.OS,
      deviceId,
      version,
      build,
    };

    setDiag(base);

    try {
      const r: any = await apiFetch("/app/api/ping");
      const ok =
        safeBool(r?.ok) || safeBool(r?.success) || r === true;

      const next: Diag = {
        ...base,
        ok,
        pingOk: ok,
        pingStatus: r?.status ?? r?.code ?? "(n/a)",
        pingEcho: r,
      };

      setDiag(next);

      if (!ok) {
        Alert.alert(
          "Diagnostics",
          "Ping failed.\n\nCheck:\n• BASE_URL\n• App key\n• Network\n• Backend"
        );
      } else {
        Alert.alert("Diagnostics", "Ping OK ✅");
      }
    } catch (e: any) {
      const msg = clean(e?.message || e);
      setDiag({ ...base, ok: false, error: msg });
      Alert.alert("Diagnostics failed", msg);
    } finally {
      setBusy(false);
    }
  }, [deviceId, version, build]);

  const hasDiag = useMemo(
    () => Object.keys(diag || {}).length > 0,
    [diag]
  );

  return (
    <GlassBackground>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Setup</Text>
          <Pressable
            onPress={close}
            style={({ pressed }) => [
              styles.headerBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.headerBtnText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.sub}>
          Get SNAPI Shield running in under a minute. If anything feels off, use the quick fixes below.
        </Text>

        <GlassCard style={styles.card}>
          <Text style={styles.h}>Watch Setup Video</Text>
          <Text style={styles.note}>
            60 seconds. Set up forwarding and confirm SNAPI Shield is active.
          </Text>

          <Pressable
            onPress={openSetupVideo}
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          >
            <Text style={styles.btnText}>Open YouTube</Text>
          </Pressable>
        </GlassCard>

        {/* QUICK CHECKS */}
        <GlassCard style={styles.card}>
          <Text style={styles.h}>Quick Checks</Text>

          <View style={styles.row}>
            <Text style={styles.k}>Device ID</Text>
            <Text style={styles.v}>{deviceId}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.k}>App Version</Text>
            <Text style={styles.v}>{version || "(unknown)"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.k}>Build</Text>
            <Text style={styles.v}>{build || "(unknown)"}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.note}>
            SNAPI answers calls only after conditional forwarding is enabled.
          </Text>

          <Pressable
            onPress={openSetupVideo}
            style={({ pressed }) => [
              styles.smallBtn,
              pressed && styles.pressed,
              { marginTop: 12 },
            ]}
          >
            <Text style={styles.smallBtnText}>Open Setup Video</Text>
          </Pressable>
        </GlassCard>

        {/* FORWARDING FIX */}
        <GlassCard style={styles.card}>
          <Text style={styles.h}>Forwarding Fix (Verizon)</Text>

          <Text style={styles.note}>
            If calls behave strangely, disable forwarding, restart your phone,
            then enable SNAPI forwarding again.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.note}>
            Disable: <Text style={styles.mono}>{CODE_DISABLE_CCF}</Text>
            {"\n"}Enable:{" "}
            <Text style={styles.mono}>{CODE_ENABLE_CCF}</Text>
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() =>
                copyText("Disable Forwarding", CODE_DISABLE_CCF)
              }
              style={({ pressed }) => [
                styles.smallBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.smallBtnText}>Copy *73</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                copyText("Enable SNAPI", CODE_ENABLE_CCF)
              }
              style={({ pressed }) => [
                styles.smallBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.smallBtnText}>Copy *71</Text>
            </Pressable>
          </View>

          <View style={[styles.actions, { marginTop: 10 }]}>
            <Pressable
              onPress={() => tryDial(CODE_DISABLE_CCF)}
              style={({ pressed }) => [
                styles.smallBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.smallBtnText}>Dial *73</Text>
            </Pressable>

            <Pressable
              onPress={() => tryDial(CODE_ENABLE_CCF)}
              style={({ pressed }) => [
                styles.smallBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.smallBtnText}>Dial *71</Text>
            </Pressable>
          </View>
        </GlassCard>

        {/* DIAGNOSTICS */}
        <GlassCard style={styles.card}>
          <Text style={styles.h}>Diagnostics</Text>

          <Pressable
            onPress={runDiagnostics}
            disabled={busy}
            style={({ pressed }) => [
              styles.btn,
              pressed && styles.pressed,
              busy && styles.btnDisabled,
            ]}
          >
            <Text style={styles.btnText}>
              {busy ? "Running…" : "Run Diagnostics"}
            </Text>
          </Pressable>

          {hasDiag && (
            <>
              <View style={styles.diagBox}>
                <Text style={styles.diagText}>
                  {prettyJson(diag)}
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={copyDiagnostics}
                  style={({ pressed }) => [
                    styles.smallBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.smallBtnText}>Copy</Text>
                </Pressable>

                <Pressable
                  onPress={openMail}
                  style={({ pressed }) => [
                    styles.smallBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.smallBtnText}>
                    Email Support
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.h}>Support</Text>
          <Text style={styles.note}>{SUPPORT_EMAIL}</Text>
        </GlassCard>
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Tokens.pad?.screen ?? 18,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: "800",
  },

  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  headerBtnText: {
    color: Colors.text,
    fontWeight: "800",
    fontSize: 13,
  },

  sub: {
    color: Colors.subtext,
    fontSize: 14,
    marginBottom: 14,
  },

  card: {
    padding: Tokens.pad?.card ?? 14,
    marginBottom: 14,
  },

  h: {
    color: Colors.text,
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },

  k: {
    color: Colors.subtext,
    fontSize: 13,
  },

  v: {
    color: Colors.text,
    fontSize: 13,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: 10,
  },

  note: {
    color: Colors.subtext,
    fontSize: 13,
    lineHeight: 18,
  },

  btn: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  btnDisabled: { opacity: 0.6 },

  btnText: {
    color: Colors.text,
    fontWeight: "800",
  },

  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92,
  },

  diagBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(0,0,0,0.22)",
  },

  diagText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  smallBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  smallBtnText: {
    color: Colors.text,
    fontWeight: "800",
    fontSize: 13,
  },

  mono: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    color: Colors.text,
  },
});
