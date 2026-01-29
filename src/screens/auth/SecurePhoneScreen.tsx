// src/screens/auth/SecurePhoneScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";

import GlassBackground from "../../components/GlassBackground";
import GlassCard from "../../components/GlassCard";
import { GhostButton } from "../../components/Buttons";

import { Colors } from "../../theme/colors";
import { Tokens } from "../../theme/tokens";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootNavigator";

import { apiFetch } from "../../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "SecurePhone">;

/**
 * Phone normalization:
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

function pickErrorMessage(err: any): string {
  const msg = String(err?.message || "");
  const status = Number(err?.status || err?.statusCode || 0);

  if (!msg) return "Please try again.";

  const m = msg.toLowerCase();
  if (m.includes("too many") || status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (m.includes("invalid") || m.includes("phone")) {
    return "That phone number looks invalid. Please double-check and try again.";
  }
  if (m.includes("network") || m.includes("fetch") || m.includes("reachable")) {
    return "Network issue. Please try again.";
  }
  return msg;
}

export default function SecurePhoneScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const padX = Tokens?.pad?.screen ?? 18;

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const e164 = useMemo(() => normalizePhone(phone), [phone]);
  const looksValid = /^\+\d{8,15}$/.test(e164);

  async function handleSend() {
    if (loading) return;

    if (!looksValid) {
      Alert.alert(
        "Enter your phone number",
        'Include your country code, e.g. "+1 303 555 1212".'
      );
      return;
    }

    try {
      setLoading(true);

      // optional quick reachability check before OTP
      await apiFetch("/ping", { method: "GET", timeoutMs: 12000 });

      await apiFetch("/mobile/auth/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
        timeoutMs: 15000,
      });

      navigation.navigate("SecureOtp", { phone: e164 });
    } catch (err: any) {
      Alert.alert("Couldn’t send code", pickErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const inputBorder = looksValid
    ? "rgba(16,185,129,0.45)"
    : "rgba(148,163,184,0.22)";

  return (
    <GlassBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: Math.max(insets.top + 12, 18),
            paddingBottom: Math.max(insets.bottom + 16, 18),
            paddingHorizontal: padX,
            justifyContent: "flex-start", // ✅ pushes the card upward
          }}
        >
          <View style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
            <GlassCard style={styles.card}>
              <Text style={[styles.kicker, { color: Colors.muted }]}>VERIFY</Text>

              <Text style={[styles.title, { color: Colors.text }]}>
                Enter your phone
              </Text>

              <Text style={[styles.sub, { color: Colors.muted }]}>
                We’ll text a secure one-time code.
              </Text>

              <View style={{ height: 16 }} />

              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder='e.g. +1 303 555 1212'
                placeholderTextColor="rgba(148,163,184,0.65)"
                keyboardType="phone-pad"
                inputMode="tel"
                returnKeyType="done"
                editable={!loading}
                onSubmitEditing={handleSend}
                style={[
                  styles.input,
                  {
                    color: Colors.text,
                    borderColor: inputBorder,
                    backgroundColor: "rgba(8,14,32,0.55)",
                  },
                ]}
              />

              <Text style={[styles.hint, { color: Colors.muted }]}>
                Tip: you can type with or without spaces/dashes.
              </Text>

              <View style={{ height: 18 }} />

              <Pressable
                onPress={handleSend}
                disabled={loading}
                style={[styles.sendBtn, { opacity: loading ? 0.7 : 1 }]}
              >
                {loading ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.sendBtnText}>Send Code</Text>
                )}
              </Pressable>

              <View style={{ height: 12 }} />

              <GhostButton title="Back" onPress={() => navigation.goBack()} />
            </GlassCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
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
  sub: { fontSize: 14.5, lineHeight: 20, fontWeight: "600", opacity: 0.9 },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
  },
  hint: { marginTop: 10, fontSize: 12.5, fontWeight: "600", opacity: 0.9 },
  sendBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,229,255,0.06)",
  },
  sendBtnText: {
    color: "#fff",
    fontWeight: "900",
    letterSpacing: 0.6,
  },
});
