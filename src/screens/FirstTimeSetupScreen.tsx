// src/screens/FirstTimeSetupScreen.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { PrimaryButton, GhostButton } from "../components/Buttons";

import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { setSetupComplete } from "../lib/setup";

type Props = NativeStackScreenProps<RootStackParamList, "FirstTimeSetup">;

export default function FirstTimeSetupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const padX = Tokens?.pad?.screen ?? 18;

  const [loading, setLoading] = useState(false);

  async function startSetup() {
    if (loading) return;
    try {
      setLoading(true);
      // Step flow: FirstTimeSetup -> SetupFinal (required checkbox) -> SecureSignIn
      navigation.navigate("SetupFinal");
    } catch {
      Alert.alert("Setup", "Could not start setup. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function alreadyDone() {
    if (loading) return;
    try {
      setLoading(true);
      // Temporary escape hatch (until we enforce checks):
      // marks setup complete and proceeds to secure sign-in.
      await setSetupComplete(true);
      navigation.replace("SecureSignIn");
    } catch {
      Alert.alert("Setup", "Could not save setup state. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassBackground>
      <View
        style={[
          styles.safe,
          {
            paddingTop: Math.max(insets.top + 12, 16),
            paddingBottom: Math.max(insets.bottom + 16, 16),
            paddingHorizontal: padX,
          },
        ]}
      >
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
            <GlassCard
              style={[
                styles.card,
                {
                  borderColor: (Colors as any)?.border ?? "rgba(148,163,184,0.22)",
                  backgroundColor: (Colors as any)?.glassCard ?? "rgba(11,21,48,0.30)",
                },
              ]}
            >
              <Text style={[styles.kicker, { color: (Colors as any)?.muted ?? "#9ca3af" }]}>
                FIRST-TIME SETUP
              </Text>

              <Text style={[styles.title, { color: (Colors as any)?.text ?? "#f9fafb" }]}>
                Activate protection
              </Text>

              <Text style={[styles.sub, { color: (Colors as any)?.muted ?? "#9ca3af" }]}>
                We’ll guide you through a quick device setup so SNAPI can screen calls and protect you
                in real time.
              </Text>

              <View style={{ height: 14 }} />

              <View style={styles.list}>
                <Text style={[styles.li, { color: (Colors as any)?.text ?? "#f9fafb" }]}>
                  • Enable call screening (required)
                </Text>
                <Text style={[styles.li, { color: (Colors as any)?.text ?? "#f9fafb" }]}>
                  • Allow notifications (required for alerts)
                </Text>
                <Text style={[styles.li, { color: (Colors as any)?.text ?? "#f9fafb" }]}>
                  • Contacts access for “Allowed (Contact)” (optional)
                </Text>
                <Text style={[styles.li, { color: (Colors as any)?.text ?? "#f9fafb" }]}>
                  • Battery optimization (recommended)
                </Text>
              </View>

              <View style={{ height: 18 }} />

              <PrimaryButton
                title={loading ? "Please wait..." : "Start Setup"}
                onPress={startSetup}
                disabled={loading}
              />

              <View style={{ height: 10 }} />

              <GhostButton
                title={loading ? "Please wait..." : "I already did this"}
                onPress={alreadyDone}
                disabled={loading}
              />

              <View style={{ height: 10 }} />

              <GhostButton title="Back" onPress={() => navigation.goBack()} disabled={loading} />

              <Text style={[styles.foot, { color: (Colors as any)?.muted ?? "#9ca3af" }]}>
                {Platform.OS === "android"
                  ? "You can review these anytime in Android Settings."
                  : "Some steps may vary by device."}
              </Text>
            </GlassCard>
          </View>
        </View>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  card: { padding: 18, borderRadius: 26, borderWidth: 1 },

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

  list: { gap: 8, marginTop: 6 },
  li: { fontSize: 13.5, fontWeight: "700", opacity: 0.92 },

  foot: { marginTop: 14, fontSize: 12.5, fontWeight: "600", opacity: 0.85 },
});
