import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Tokens } from "../theme/tokens";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function GlassCard({ children, style }: Props) {
  // Defensive: avoid crashes if Tokens.r is undefined during hot reload / early boot
  const R = typeof (Tokens as any)?.r === "number" ? (Tokens as any).r : 24;
  const innerR = Math.max(0, R - 1);

  return (
    <View style={[styles.card, { borderRadius: R }, style]}>
      {/* Glass border/shine layer */}
      <View
        pointerEvents="none"
        style={[styles.inner, { borderRadius: innerR }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  inner: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.10)",
  },
});

