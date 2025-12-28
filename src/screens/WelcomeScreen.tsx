import React from "react";
import { View, Text } from "react-native";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";
import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { PrimaryButton, GhostButton } from "../components/Buttons";

export default function WelcomeScreen() {
  return (
    <GlassBackground>
      <View
        style={{
          flex: 1,
          padding: Tokens.pad.screen,
          paddingTop: 22,
          gap: Tokens.pad.gap,
        }}
      >
        {/* ── Top brand anchor (matches dashboard grounding) ── */}
        <View style={{ alignItems: "center", marginBottom: Tokens.pad.tight }}>
          <Text
            style={{
              color: Colors.muted,
              fontWeight: "800",
              letterSpacing: 2,
              fontSize: 12,
            }}
          >
            SNAPI
          </Text>
        </View>

        <GlassCard>
          <Text style={{ color: Colors.text, fontSize: 26, fontWeight: "900" }}>
            Protect your phone.
          </Text>

          <Text style={{ color: Colors.muted, marginTop: Tokens.pad.tight, lineHeight: 20, fontSize: 14 }}>
            SNAPI filters unknown callers and lets you decide what gets through.
          </Text>

          <View style={{ marginTop: Tokens.pad.gap, gap: 6 }}>
            <Text style={{ color: Colors.muted, fontSize: 13, opacity: 0.9 }}>• Stops spam and scams</Text>
            <Text style={{ color: Colors.muted, fontSize: 13, opacity: 0.9 }}>• Legit callers can leave a message</Text>
            <Text style={{ color: Colors.muted, fontSize: 13, opacity: 0.9 }}>• You stay in control</Text>
          </View>
        </GlassCard>

        <PrimaryButton title="Protect My Phone" onPress={() => {}} />
        <GhostButton title="How It Works" onPress={() => {}} />
      </View>
    </GlassBackground>
  );
}

