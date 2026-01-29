import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { PrimaryButton, GhostButton } from "../components/Buttons";

import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { setOnboardingComplete } from "../lib/onboarding";

type Step = {
  kicker: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
};

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const padX = Tokens?.pad?.screen ?? 18;
  const [stepIndex, setStepIndex] = useState(0);

  const steps: Step[] = useMemo(
    () => [
      {
        kicker: "WELCOME",
        title: "Personal Call Protection",
        body: "SNAPI quietly screens unknown callers before they ever reach you.",
        primary: "Continue",
        secondary: "Back",
      },
      {
        kicker: "PRIVACY FIRST",
        title: "You stay in control",
        body: "Only suspicious calls are intercepted. Trusted callers ring through.",
        primary: "Continue",
        secondary: "Back",
      },
      {
        kicker: "ALL SET",
        title: "Protection is ready",
        body: "Verify your phone to activate protection across your device.",
        primary: "Activate Protection",
        secondary: "Back",
      },
    ],
    []
  );

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  async function finishOnboarding() {
    await setOnboardingComplete();
    // Option C funnel: onboarding → secure sign-in (not Home yet)
    navigation.replace("SecureSignIn");
  }

  function handlePrimary() {
    if (isLast) finishOnboarding();
    else setStepIndex((i) => i + 1);
  }

  function handleSecondary() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  return (
    <GlassBackground>
      <View
        style={[
          styles.page,
          {
            paddingHorizontal: padX,
            paddingTop: Math.max(insets.top + 18, 28),
            paddingBottom: Math.max(insets.bottom + 18, 24),
          },
        ]}
      >
        <View style={{ flex: 1, justifyContent: "center" }}>
          <GlassCard style={styles.card}>
            {/* Kicker INSIDE card */}
            <Text style={[styles.kicker, { color: Colors?.muted ?? "#9ca3af" }]}>
              {step.kicker}
            </Text>

            <Text
              style={[styles.title, { color: Colors?.text ?? "#f9fafb" }]}
            >
              {step.title}
            </Text>

            <Text
              style={[styles.body, { color: Colors?.subtle ?? "#cbd5e1" }]}
            >
              {step.body}
            </Text>

            <View style={{ height: 18 }} />

            <View style={styles.actions}>
              <PrimaryButton title={step.primary} onPress={handlePrimary} />

              {stepIndex > 0 ? (
                <GhostButton title={step.secondary} onPress={handleSecondary} />
              ) : null}
            </View>

            {/* Step dots (subtle, premium) */}
            <View style={styles.dotsRow}>
              {steps.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === stepIndex ? styles.dotActive : styles.dotIdle,
                  ]}
                />
              ))}
            </View>
          </GlassCard>
        </View>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "transparent",
  },

  card: {
    padding: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(11,21,48,0.30)",
    overflow: "hidden",
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
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0.2,
    marginBottom: 10,
  },

  body: {
    fontSize: 15.5,
    lineHeight: 22,
    fontWeight: "600",
    opacity: 0.9,
  },

  actions: {
    gap: 12,
  },

  dotsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.85,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  dotIdle: {
    backgroundColor: "rgba(148,163,184,0.35)",
  },
  dotActive: {
    backgroundColor: "rgba(0,229,255,0.75)",
  },
});
