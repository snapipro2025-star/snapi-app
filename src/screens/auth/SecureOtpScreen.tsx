// src/screens/auth/SecureOtpScreen.tsx (section rewrite)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import GlassBackground from "../../components/GlassBackground";
import GlassCard from "../../components/GlassCard";
import { PrimaryButton, GhostButton } from "../../components/Buttons";

import { Colors } from "../../theme/colors";
import { Tokens } from "../../theme/tokens";

import type { RootStackParamList } from "../../navigation/RootNavigator";
import { apiFetch, setTokens } from "../../api/client";
import { setSetupComplete } from "../../lib/setup";

// RootNavigator param list must include:
// SecureOtp: { phone: string };
type Props = NativeStackScreenProps<RootStackParamList, "SecureOtp">;

function digitsOnly(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function pickErrMsg(e: any) {
  const msg = String(e?.message || "");
  const status = Number(e?.status || e?.statusCode || 0);
  const m = msg.toLowerCase();

  if (status === 429 || m.includes("too many")) return "Too many attempts. Please wait a bit and try again.";
  if (m.includes("network") || m.includes("fetch") || m.includes("reachable")) return "Network issue. Please try again.";
  if (m.includes("invalid") || m.includes("code")) return "That code doesn’t look right. Please try again.";
  return msg || "Please try again.";
}

export default function SecureOtpScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const padX = Tokens?.pad?.screen ?? 18;

  const phone = String(route.params?.phone || "").trim();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // resend cooldown
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Prevent double-submit
  const verifyingRef = useRef(false);

  const cleanCode = useMemo(() => digitsOnly(code).slice(0, 6), [code]);
  const canVerify = cleanCode.length === 6;

    const verify = useCallback(
      async (codeOverride?: string) => {
        const c = digitsOnly(codeOverride ?? code).slice(0, 6).trim();

        if (c.length !== 6) {
          Alert.alert("Enter the code", "Please enter the 6-digit verification code.");
          return;
        }
        if (loading || verifyingRef.current) return;

        try {
          verifyingRef.current = true;
          setLoading(true);

          const r = await apiFetch("/mobile/auth/otp/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, code: c }),
          });

          if (r?.ok === false) {
            Alert.alert("Verification failed", r?.error || "Please try again.");
            return;
          }

          // accept multiple shapes
          const accessToken =
            r?.accessToken || r?.access_token || r?.access || r?.token || r?.jwt || r?.session?.accessToken || "";
          const refreshToken =
            r?.refreshToken || r?.refresh_token || r?.refresh || r?.rt || r?.session?.refreshToken || "";

          if (!accessToken || !refreshToken) {
            Alert.alert(
              "Verification failed",
              "Server did not return session tokens. Check /mobile/auth/otp/verify response."
            );
            return;
          }

          // ✅ Persist auth + mark setup complete, then hard-reset to Home
          await setTokens(String(accessToken), String(refreshToken));

          // TEMP DEBUG (remove later)
          try {
            const { getSession } = await import("../../api/client");
            console.log("[OTP] session after setTokens =", getSession?.());
          } catch (e) {
            console.log("[OTP] session debug failed", e);
          }

          // optional: give SecureStore a beat on some devices
          await new Promise((res) => setTimeout(res, 150));

          navigation.reset({
            index: 0,
            routes: [{ name: "Home" }],
          });
        } catch (e: any) {
          Alert.alert("Verification failed", pickErrMsg(e));
        } finally {
          verifyingRef.current = false;
          setLoading(false);
        }
      },
      [code, loading, phone, navigation]
    );

  const resend = useCallback(async () => {
    if (loading) return;
    if (cooldown > 0) return;

    if (!phone) {
      Alert.alert("Missing phone", "Please go back and enter your phone number again.");
      return;
    }

    try {
      setLoading(true);

      const r = await apiFetch("/mobile/auth/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      if (r?.ok === false) {
        Alert.alert("Resend failed", r?.error || "Please try again.");
        return;
      }

      setCooldown(25);
      Alert.alert("Code sent", `We sent a new verification code to ${phone}.`);
    } catch (e: any) {
      Alert.alert("Resend failed", pickErrMsg(e));
    } finally {
      setLoading(false);
    }
  }, [cooldown, loading, phone]);

  const borderOk = "rgba(16,185,129,0.45)";
  const borderDefault = "rgba(148,163,184,0.22)";
  const inputBorder = canVerify ? borderOk : borderDefault;

  // ... rest of your component continues
  return (
    <GlassBackground>
      <View
        style={[
          styles.page,
          {
            paddingTop: Math.max(insets.top, 10),
            paddingHorizontal: padX,
            alignItems: "center",
            justifyContent: "flex-start",
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ width: "100%", maxWidth: 520, marginTop: 10 }}
        >
          <GlassCard style={styles.card}>
            <Text style={[styles.kicker, { color: Colors.muted }]}>VERIFY</Text>

            <Text style={[styles.title, { color: Colors.text }]}>Enter the code</Text>

            <Text style={[styles.sub, { color: Colors.muted }]}>Sent to {phone || "your phone"}</Text>

            <View style={{ height: 14 }} />

            <TextInput
              value={cleanCode}
              autoFocus
              onChangeText={(v) => setCode(digitsOnly(v))}
              placeholder="123456"
              placeholderTextColor="rgba(148,163,184,0.65)"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={() => verify(cleanCode)}
              editable={!loading}
              style={[
                styles.input,
                {
                  color: Colors.text,
                  borderColor: inputBorder,
                  backgroundColor: "rgba(8,14,32,0.55)",
                },
              ]}
              accessibilityLabel="Verification code input"
            />

            <View style={{ height: 12 }} />

            <View style={styles.helperRow}>
              <Text style={[styles.helperText, { color: Colors.muted }]}>Didn’t get it?</Text>

              <Pressable
                onPress={resend}
                disabled={loading || cooldown > 0}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.resendBtn,
                  {
                    opacity: loading || cooldown > 0 ? 0.5 : pressed ? 0.75 : 1,
                    borderColor: "rgba(0,229,255,0.25)",
                  },
                ]}
              >
                <Text style={[styles.resendText, { color: Colors.text }]}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </Text>
              </Pressable>
            </View>

            <View style={{ height: 16 }} />

            <PrimaryButton
              title={loading ? "Verifying..." : "Verify"}
              onPress={() => verify(cleanCode)}
              disabled={loading || !canVerify}
            />

            <View style={{ height: 10 }} />

            <GhostButton title="Back" onPress={() => navigation.goBack()} disabled={loading} />
          </GlassCard>
        </KeyboardAvoidingView>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "transparent" },

  card: {
    padding: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(11,21,48,0.30)",
  },

  kicker: {
    textTransform: "uppercase",
    letterSpacing: 2.2,
    fontSize: 12,
    fontWeight: "800",
    opacity: 0.85,
    marginBottom: 10,
    includeFontPadding: false,
  },

  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
    marginBottom: 8,
    includeFontPadding: false,
  },

  sub: {
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: "600",
    opacity: 0.9,
  },

  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 3,
    textAlign: "center",
  },

  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  helperText: {
    fontSize: 13.5,
    fontWeight: "700",
    opacity: 0.9,
  },

  resendBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  resendText: {
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
