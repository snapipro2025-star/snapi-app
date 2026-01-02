import React from "react";
import { View, Text } from "react-native";
import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { PrimaryButton, GhostButton } from "../components/Buttons";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const padX = Tokens?.pad?.screen ?? 18;

  return (
    <GlassBackground>
      <View
        style={{
          flex: 1,
          paddingHorizontal: padX,
          paddingTop: Math.max(insets.top + 14, 28),
          paddingBottom: Math.max(insets.bottom + 14, 24),
        }}
      >
        <GlassCard
          style={{
            padding: 16,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: "rgba(148,163,184,0.22)",
            backgroundColor: "rgba(11,21,48,0.30)",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: Colors?.textPrimary ?? "#f9fafb",
                  fontSize: 18,
                  fontWeight: "900",
                  letterSpacing: 0.2,
                }}
              >
                Shield status
              </Text>
              <Text
                style={{
                  color: Colors?.textMuted ?? "#9ca3af",
                  marginTop: 4,
                  fontSize: 12.5,
                  lineHeight: 16,
                }}
              >
                Real-time screening enabled
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: "rgba(16,185,129,0.12)",
                borderWidth: 1,
                borderColor: "rgba(16,185,129,0.32)",
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  backgroundColor: Colors?.ok ?? "#34d399",
                }}
              />
              <Text
                style={{
                  color: Colors?.textPrimary ?? "#f9fafb",
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                Active
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <Text
              style={{
                color: Colors?.textMuted ?? "#9ca3af",
                fontSize: 12.5,
                lineHeight: 18,
              }}
            >
              Forwarding to: <Text style={{ color: "#f9fafb", fontWeight: "800" }}>••• ••• ••63</Text>
            </Text>
          </View>

          <View style={{ marginTop: 14, gap: 10 }}>
            <PrimaryButton title="Manage in web dashboard" onPress={() => {}} />
            <GhostButton title="Help & support" onPress={() => {}} />
          </View>
        </GlassCard>

        <View style={{ flex: 1 }} />
      </View>
    </GlassBackground>
  );
}
