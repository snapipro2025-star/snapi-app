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

import GlassBackground from "../../components/GlassBackground";
import GlassCard from "../../components/GlassCard";
import { PrimaryButton, GhostButton } from "../../components/Buttons";

import { Colors } from "../../theme/colors";
import { Tokens } from "../../theme/tokens";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootNavigator";

// ✅ RootNavigator param list must include:
// SecureOtp: { phone: string };
type Props = NativeStackScreenProps<RootStackParamList, "SecureOtp">;

function digitsOnly(v: string) {
  return String(v || "").replace(/\D/g, "");
}

export default function SecureOtpScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const padX = Tokens?.pad?.screen ?? 18;

  const phone = route.params?.phone || "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // --- resend cooldown (premium UX) ---
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Prevent double-submit (auto verify + button press)
  const verifyingRef = useRef(false);

  const canVerify = useMemo(() => digitsOnly(code).length === 6, [code]);

  const verify = useCallback(
    async (codeOverride?: string) => {
      const c = digitsOnly(codeOverride ?? code).trim();

      if (c.length < 6) {
        Alert.alert(
          "Enter the code",
          "Check your text messages and enter the 6-digit verification code."
        );
        return;
      }

      if (loading || verifyingRef.current) return;

      try {
        verifyingRef.current = true;
        setLoading(true);

        // ✅ TODO: call your verify endpoint here (phone + code)
        // Example (once you wire it):
        // const r = await apiFetch("/auth/verify", { method:"POST", body:{ phone, code:c }});
        // await setAuthToken(r.token);
        // navigation.reset({ index: 0, routes: [{ name: "Home" as any }] });

        navigation.replace("Home");
      } catch (e: any) {
        Alert.alert("Verification failed", e?.message || "Please try again.");
      } finally {
        verifyingRef.current = false;
        setLoading(false);
      }
    },
    [code, loading, navigation, phone]
  );

  const resend = useCallback(async () => {
    if (loading) return;
    if (cooldown > 0) return;

    try {
      setLoading(true);

      // ✅ TODO: call your resend/start endpoint here (phone)
      // Example:
      // await apiFetch("/auth/start", { method:"POST", body:{ phone } });

      setCooldown(25);
      Alert.alert("Code sent", `We sent a new verification code to ${phone}.`);
    } catch (e: any) {
      Alert.alert("Resend failed", e?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [cooldown, loading, phone]);

  return (
    <GlassBackground>
      <View
        style={[
          styles.page,
          {
            // ✅ tighter + avoids feeling like "dead space"
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

            <Text style={[styles.title, { color: Colors.text }]}>
              Enter the code
            </Text>

            <Text style={[styles.sub, { color: Colors.muted }]}>
              Sent to {phone}
            </Text>

            <View style={{ height: 14 }} />

            <TextInput
              value={code}
              autoFocus
              onChangeText={(v) => {
                const clean = digitsOnly(v);
                setCode(clean);
              }}
              placeholder="123456"
              placeholderTextColor="rgba(148,163,184,0.65)"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={() => verify()}
              editable={!loading}
              style={[
                styles.input,
                {
                  color: Colors.text,
                  borderColor: canVerify
                    ? "rgba(16,185,129,0.45)"
                    : "rgba(148,163,184,0.22)",
                  backgroundColor: "rgba(8,14,32,0.55)",
                },
              ]}
              accessibilityLabel="Verification code input"
            />

            <View style={{ height: 12 }} />

            {/* ✅ subtle helper row */}
            <View style={styles.helperRow}>
              <Text style={[styles.helperText, { color: Colors.muted }]}>
                Didn’t get it?
              </Text>

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
              onPress={() => verify()}
              disabled={loading || !canVerify}
            />

            <View style={{ height: 10 }} />

            <GhostButton title="Back" onPress={() => navigation.goBack()} />
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
  },

  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
    marginBottom: 8,
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
