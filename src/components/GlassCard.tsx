import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";

export default function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View
      style={[
        {
          borderRadius: Tokens.r,
          borderWidth: 1,
          borderColor: Colors.border,
          overflow: "hidden",

          // subtle depth
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 18,
          elevation: 6,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[Colors.glassTop, Colors.glassBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ padding: Tokens.pad.card }}
      >
        {/* inner stroke (dashboard-style “glass edge”) */}
        <View
          style={{
            borderRadius: Tokens.r - 1,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,.05)",
            padding: 0,
          }}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}
