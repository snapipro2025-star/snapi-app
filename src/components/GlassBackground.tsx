import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  children: React.ReactNode;
};

export default function GlassBackground({ children }: Props) {
  return (
    <View style={styles.root}>
      {/* Base depth */}
      <LinearGradient
        colors={["#050816", "#02040a"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Teal atmosphere (top-left) */}
      <LinearGradient
        colors={["rgba(0,229,255,0.20)", "rgba(0,229,255,0.00)"]}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.6, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Indigo atmosphere (bottom-right) */}
      <LinearGradient
        colors={["rgba(139,92,246,0.18)", "rgba(139,92,246,0.00)"]}
        start={{ x: 0.85, y: 0.75 }}
        end={{ x: 0.25, y: 0.2 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Content layer (MUST be last) */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050816",
  },
  content: {
    flex: 1,
  },
});
