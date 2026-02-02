// src/screens/auth/SecurePhoneScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import GlassBackground from "../../components/GlassBackground";
import GlassCard from "../../components/GlassCard";
import { PrimaryButton, GhostButton } from "../../components/Buttons";

import { Colors } from "../../theme/colors";
import { Tokens } from "../../theme/tokens";

import type { RootStackParamList } from "../../navigation/RootNavigator";
import { apiFetch } from "../../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "SecureSignIn">;

const LAST_PHONE_KEY = "snapi.last_phone_e164";
const PLACEHOLDER_US = "(303) 555-1212";
const PLACEHOLDER_INTL = "+44 20 7946 0958";

/**
 * Normalization:
 * - If user starts with "+": keep any country code, strip non-digits after "+"
 * - Otherwise: assume US only when 10 digits (or 11 digits starting with 1)
 */
function normalizePhone(raw: string) {
  const s = String(raw || "").trim();

  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+1${digits.slice(1)}`;
  if (digits.length === 10) return `+1${digits}`;
  return "";
}

function pickErrorMessage(err: any) {
  const msg = String(err?.message || "");
  const status = Number(err?.status || err?.statusCode || 0);
  const m = msg.toLowerCase();

  if (status === 429 || m.includes("too many")) return "Too many attempts. Please wait and try again.";
  if (m.includes("invalid") || m.includes("phone")) return "That phone number looks invalid. Please double-check.";
  if (m.includes("network") || m.includes("fetch") || m.includes("reachable")) return "Network issue. Please try again.";
  return msg || "Please try again.";
}

export default function SecurePhoneScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const padX = Tokens?.pad?.screen ?? 18;

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const last = await SecureStore.getItemAsync(LAST_PHONE_KEY);
        if (mounted && last) setPhone(last);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isTypingIntl = useMemo(() => String(phone || "").trim().startsWith("+"), [phone]);
  const e164 = useMemo(() => normalizePhone(phone), [phone]);

  // Validation rules:
  // - US mode: require exactly 10 digits (normalized to +1XXXXXXXXXX)
  // - Intl mode: allow any E.164-ish length (min 8 digits total, max 15 per spec)
  const looksValidUS = e164.startsWith("+1") && e164.length === 12; // +1 + 10 digits
  const intlDigits = useMemo(() => (e164.startsWith("+") ? e164.slice(1).replace(/\D/g, "") : ""), [e164]);
  const looksValidIntl = isTypingIntl && intlDigits.length >= 8 && intlDigits.length <= 15;

  const looksValid = isTypingIntl ? looksValidIntl : looksValidUS;

  const borderDefault = (Colors as any)?.border ?? "rgba(148,163,184,0.22)";
  const textDefault = (Colors as any)?.text ?? "#f9fafb";
  const mutedDefault = (Colors as any)?.muted ?? "#9ca3af";

  const inputBorder = looksValid ? "rgba(16,185,129,0.45)" : borderDefault;
  const inputBg = (Colors as any)?.inputBg ?? "rgba(8,14,32,0.55)";
  const glassBg = (Colors as any)?.glassCard ?? "rgba(11,21,48,0.30)";

  const hintText = isTypingIntl
    ? "International supported — start with + and include your country code."
    : "Enter your 10-digit US number to receive your verification code.";

  const placeholder = isTypingIntl ? PLACEHOLDER_INTL : PLACEHOLDER_US;

  async function requestCode() {
    if (loading) return;

    if (!looksValid) {
      Alert.alert(
        "Enter your phone number",
        isTypingIntl
          ? "Please enter your full number starting with + and a valid country code."
          : "Please enter a 10-digit US number."
      );
      return;
    }

    try {
      setLoading(true);
      await SecureStore.setItemAsync(LAST_PHONE_KEY, e164).catch(() => {});

      const r = await apiFetch("/mobile/auth/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });

      if (r?.ok === false) {
        Alert.alert("Couldn’t send code", r?.error || "Please try again.");
        return;
      }

      navigation.navigate("SecureOtp", { phone: e164 });
    } catch (err: any) {
      Alert.alert("Couldn’t send code", pickErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 12, 16),
              paddingBottom: Math.max(insets.bottom + 16, 16),
              paddingHorizontal: padX,
            },
          ]}
        >
          <View style={styles.shell}>
            <GlassCard style={[styles.card, { borderColor: borderDefault, backgroundColor: glassBg }]}>
              <Text style={[styles.kicker, { color: mutedDefault }]}>PHONE VERIFICATION</Text>

              <Text style={[styles.title, { color: textDefault }]}>Enter your phone</Text>

              <Text style={[styles.sub, { color: mutedDefault }]}>
                We’ll verify your number with a secure one-time code.
              </Text>

              <View style={styles.sp16} />

              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder={placeholder}
                placeholderTextColor="rgba(148,163,184,0.65)"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                editable={!loading}
                style={[
                  styles.input,
                  {
                    color: textDefault,
                    borderColor: inputBorder,
                    backgroundColor: inputBg,
                  },
                ]}
              />

              <Text style={[styles.hint, { color: mutedDefault }]}>{hintText}</Text>

              <View style={styles.sp18} />

              <PrimaryButton title={loading ? "Sending..." : "Send Code"} onPress={requestCode} disabled={loading} />

              <View style={styles.sp10} />

              <GhostButton title="Back" onPress={() => navigation.goBack()} disabled={loading} />
            </GlassCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
  },

  shell: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },

  card: {
    padding: 18,
    borderRadius: 26,
    borderWidth: 1,
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
    fontSize: 16,
    fontWeight: "700",
  },

  hint: {
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: "600",
    opacity: 0.9,
  },

  sp10: { height: 10 },
  sp16: { height: 16 },
  sp18: { height: 18 },
});
