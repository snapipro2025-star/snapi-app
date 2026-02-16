// src/screens/setup/SetupFinalScreen.tsx

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";

import GlassBackground from "../../components/GlassBackground";
import GlassCard from "../../components/GlassCard";
import { PrimaryButton, GhostButton } from "../../components/Buttons";

import { Colors } from "../../theme/colors";
import { Tokens } from "../../theme/tokens";

import type { RootStackParamList } from "../../navigation/RootNavigator";
import { setSetupComplete } from "../../lib/setup";

type Props = NativeStackScreenProps<RootStackParamList, "SetupFinal">;

export default function SetupFinalScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const padX = Tokens?.pad?.screen ?? 18;

  const [confirmedNotifications, setConfirmedNotifications] = useState(false);

  const canContinue = useMemo(() => confirmedNotifications, [confirmedNotifications]);

  async function openDeviceSettings() {
    try {
      // Most reliable cross-platform way to open app settings
      await Linking.openSettings();
    } catch {
      Alert.alert(
        "Couldn't open settings",
        "Please open your phone settings and enable notifications for SNAPI."
      );
    }
  }

  async function continueToDashboard() {
    if (!canContinue) return;

    try {
      // ✅ Mark setup complete so Splash never routes back to setup
      await setSetupComplete(true);

      // ✅ Next step: verify phone (OTP). Hard reset so user can’t go back into setup.
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "SecureSignIn", params: { fromSetup: true } }],
        })
      );
    } catch {
      Alert.alert("Setup", "Couldn't finish setup. Please try again.");
    }
  }

  return (
    <GlassBackground>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(insets.top + 12, 16),
          paddingBottom: Math.max(insets.bottom + 16, 16),
          paddingHorizontal: padX,
          justifyContent: "flex-start",
        }}
      >
        <View style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
          <GlassCard style={styles.card}>
            <Text style={styles.kicker}>FINAL STEP</Text>

            <Text style={styles.title}>Turn on SNAPI notifications</Text>

            <Text style={styles.sub}>
              SNAPI needs notifications enabled to alert you when a call is blocked, screened, or
              sent to voicemail.
            </Text>

            <View style={{ height: 14 }} />

            <View style={styles.stepBox}>
              <Text style={styles.stepTitle}>Do this now:</Text>

              <Text style={styles.stepLine}>
                1) Open <Text style={styles.stepStrong}>Settings</Text>
              </Text>
              <Text style={styles.stepLine}>
                2) Tap <Text style={styles.stepStrong}>Apps</Text> →{" "}
                <Text style={styles.stepStrong}>SNAPI</Text>
              </Text>
              <Text style={styles.stepLine}>
                3) Tap <Text style={styles.stepStrong}>Notifications</Text> → Turn{" "}
                <Text style={styles.stepStrong}>ON</Text>
              </Text>

              <View style={{ height: 12 }} />

              <GhostButton title="Open Settings" onPress={openDeviceSettings} />
            </View>

            <View style={{ height: 14 }} />

            {/* Required confirmation */}
            <Pressable
              onPress={() => setConfirmedNotifications((v) => !v)}
              style={styles.checkRow}
              hitSlop={10}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmedNotifications }}
              accessibilityLabel="Confirm notifications enabled"
            >
              <View style={[styles.checkbox, confirmedNotifications && styles.checkboxOn]}>
                {confirmedNotifications ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>

              <Text style={styles.checkText}>
                I confirmed SNAPI notifications are enabled in my device settings.
              </Text>
            </Pressable>

            <View style={{ height: 16 }} />

            <PrimaryButton
              title="Continue to Verify"
              onPress={continueToDashboard}
              disabled={!canContinue}
            />

            <View style={{ height: 10 }} />

            <GhostButton title="Back" onPress={() => navigation.goBack()} />
          </GlassCard>

          <Text style={styles.footerHint}>
            Tip: If you ever miss alerts, re-check Settings → Apps → SNAPI → Notifications.
          </Text>
        </View>
      </ScrollView>
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
    color: Colors.muted,
    textTransform: "uppercase",
    letterSpacing: 2.2,
    fontSize: 12,
    fontWeight: "900",
    opacity: 0.9,
    marginBottom: 10,
    includeFontPadding: false,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
    marginBottom: 8,
    includeFontPadding: false,
  },
  sub: {
    color: Colors.muted,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: "600",
    opacity: 0.95,
  },

  stepBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 14,
  },
  stepTitle: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 8,
  },
  stepLine: {
    color: Colors.muted,
    fontWeight: "700",
    fontSize: 12.5,
    marginBottom: 4,
  },
  stepStrong: {
    color: Colors.text,
    fontWeight: "900",
  },

  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.35)",
    backgroundColor: "rgba(0,229,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    borderColor: "rgba(0,229,255,0.65)",
    backgroundColor: "rgba(0,229,255,0.16)",
  },
  checkMark: {
    color: Colors.text,
    fontWeight: "900",
    fontSize: 14,
    marginTop: -1,
  },
  checkText: {
    flex: 1,
    color: Colors.text,
    fontWeight: "800",
    fontSize: 12.5,
    lineHeight: 16,
  },

  footerHint: {
    marginTop: 10,
    textAlign: "center",
    color: Colors.muted,
    fontSize: 11.5,
    fontWeight: "700",
    opacity: 0.9,
  },
});
