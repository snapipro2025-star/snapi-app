import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";

export default function GlassBackground({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* cyan radial glow (directional, pushed off-screen) */}
      <View
        style={{
          position: "absolute",
          top: -280,
          left: -300,
          width: 700,
          height: 700,
          borderRadius: 700,
          backgroundColor: "rgba(0,229,255,.18)",
          opacity: 0.55,
        }}
      />

      {/* purple radial glow (secondary accent) */}
      <View
        style={{
          position: "absolute",
          top: -240,
          right: -320,
          width: 560,
          height: 560,
          borderRadius: 560,
          backgroundColor: "rgba(139,92,246,.18)",
          opacity: 0.5,
        }}
      />

      {/* base vertical gradient (matches dashboard html/body) */}
      <LinearGradient
        colors={[Colors.bg, Colors.bg2]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1 }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
