import React from "react";
import { View, Text } from "react-native";
import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { ActionBlock, PrimaryButton, GhostButton } from "../components/Buttons";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";

export default function OnboardingScreen() {
  return (
    <GlassBackground>
      <View
        style={{
          flex: 1,
          paddingHorizontal: Tokens?.pad?.screen ?? 18,
          paddingTop: 22,
          paddingBottom: 16,
        }}
      >
        {/* Top content */}
        <GlassCard
          style={{
            padding: 18,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: "rgba(148,163,184,0.22)",
            backgroundColor: "rgba(11,21,48,0.28)",
          }}
        >
          <Text
            style={{
              color: Colors?.textMuted ?? "rgba(156,163,175,0.95)",
              fontSize: 12.5,
              fontWeight: "800",
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            Getting started
          </Text>

          <Text
            style={{
              marginTop: 10,
              color: Colors?.textPrimary ?? "#f9fafb",
              fontSize: 22,
              fontWeight: "900",
              lineHeight: 27,
              letterSpacing: 0.2,
            }}
          >
            SNAPI works quietly in the background.
          </Text>

          <Text
            style={{
              marginTop: 12,
              color: Colors?.textMuted ?? "rgba(156,163,175,0.95)",
              fontSize: 13.5,
              lineHeight: 19,
            }}
          >
            To quietly protect you from unwanted calls,{"\n"}
            SNAPI needs permission to screen incoming numbers.
          </Text>

          {/* Trust line (optional but recommended) */}
          <View style={{ marginTop: 14 }}>
            <Text
              style={{
                color: Colors?.textMuted ?? "rgba(156,163,175,0.95)",
                fontSize: 12.5,
                lineHeight: 18,
              }}
            >
              We never listen to your calls — we only act when protection is
              needed.
            </Text>
          </View>
        </GlassCard>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Bottom action block (dark blue slab) */}
        <ActionBlock>
          <PrimaryButton title="Continue" onPress={() => {}} />
          <GhostButton title="Not now" onPress={() => {}} />
        </ActionBlock>
      </View>
    </GlassBackground>
  );
}
