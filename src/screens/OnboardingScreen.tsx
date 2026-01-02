import React, { useMemo, useState } from "react";
import { View, Text } from "react-native";
import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { ActionBlock, PrimaryButton, GhostButton } from "../components/Buttons";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { setOnboardingComplete } from "../lib/onboarding";

type Step = {
  kicker: string;
  title: string;
  body: string;
  trust?: string;
  primary: string;
  secondary: string;
};

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export default function OnboardingScreen({ navigation }: Props) {
  const padX = Tokens?.pad?.screen ?? 18;
  const [stepIndex, setStepIndex] = useState(0);

  const steps: Step[] = useMemo(
    () => [
      {
        kicker: "Welcome",
        title: "Personal Call Protection",
        body: "SNAPI quietly screens unknown callers before they ever reach you.",
        primary: "Continue",
        secondary: "Back",
      },
      {
        kicker: "Privacy First",
        title: "You stay in control",
        body: "Only suspicious calls are intercepted. Trusted callers ring through.",
        primary: "Continue",
        secondary: "Back",
      },
      {
        kicker: "All Set",
        title: "Protection is ready",
        body: "You’re protected. SNAPI will handle the rest.",
        primary: "Finish",
        secondary: "Back",
      },
    ],
    []
  );

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  async function finishOnboarding() {
    await setOnboardingComplete();
    navigation.replace("Home");
  }

  function handlePrimary() {
    if (isLast) {
      finishOnboarding();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function handleSecondary() {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }

  return (
    <GlassBackground>
      <View
        style={{
          flex: 1,
          paddingHorizontal: padX,
          paddingVertical: Tokens.pad.screen,
          justifyContent: "center",
        }}
      >
        <GlassCard>
          <Text
            style={{
              color: Colors.muted,
              fontSize: 12,
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {step.kicker}
          </Text>

          <Text
            style={{
              color: Colors.text,
              fontSize: 26,
              fontWeight: "700",
              marginBottom: 12,
            }}
          >
            {step.title}
          </Text>

          <Text
            style={{
              color: Colors.subtle,
              fontSize: 16,
              lineHeight: 22,
              marginBottom: 24,
            }}
          >
            {step.body}
          </Text>

          <ActionBlock>
            <PrimaryButton
              label={step.primary}
              onPress={handlePrimary}
            />

            {stepIndex > 0 && (
              <GhostButton
                label={step.secondary}
                onPress={handleSecondary}
              />
            )}
          </ActionBlock>
        </GlassCard>
      </View>
    </GlassBackground>
  );
}
