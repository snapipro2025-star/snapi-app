import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function GlassBackground({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: "#050816" }}>
      {/* Base depth */}
      <LinearGradient
        colors={["#050816", "#02040a"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={FILL}
      />

      {/* Teal atmosphere (top-left) */}
      <LinearGradient
        colors={["rgba(0,229,255,0.20)", "rgba(0,229,255,0.00)"]}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.6, y: 0.6 }}
        style={FILL}
      />

      {/* Indigo atmosphere (bottom-right) */}
      <LinearGradient
        colors={["rgba(139,92,246,0.18)", "rgba(139,92,246,0.00)"]}
        start={{ x: 0.85, y: 0.75 }}
        end={{ x: 0.25, y: 0.2 }}
        style={FILL}
      />

      {/* Content layer */}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const FILL = {
  position: "absolute" as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
