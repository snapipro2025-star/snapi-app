import React from "react";
import {
  Pressable,
  Text,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";

/* ──────────────────────────────────────────────
   Shared types
────────────────────────────────────────────── */
type BtnProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

type BlockProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/* ──────────────────────────────────────────────
   ActionBlock
────────────────────────────────────────────── */
export function ActionBlock({ children, style }: BlockProps) {
  const padding =
    Tokens?.pad?.screen !== undefined ? Tokens.pad.screen : 16;

  return (
    <View
      style={[
        {
          padding,
          borderRadius: 22,
          backgroundColor: "rgba(8,18,40,0.86)",
          borderWidth: 1,
          borderColor: "rgba(148,163,184,0.18)",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ──────────────────────────────────────────────
   PrimaryButton
────────────────────────────────────────────── */
export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  style,
}: BtnProps) {
  const accent = Colors?.accent ?? "#00E5FF";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          borderWidth: 1.6,
          borderColor: accent,
          borderRadius: 999,
          paddingVertical: 14,
          paddingHorizontal: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 16,
          fontWeight: "800",
          letterSpacing: 0.2,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/* ──────────────────────────────────────────────
   GhostButton
────────────────────────────────────────────── */
export function GhostButton({
  title,
  onPress,
  disabled = false,
  style,
}: BtnProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          marginTop: 10,
          borderWidth: 1,
          borderColor: "rgba(148,163,184,0.22)",
          borderRadius: 999,
          paddingVertical: 13,
          paddingHorizontal: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(2,6,20,0.22)",
          opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text
        style={{
          color: "rgba(255,255,255,0.88)",
          fontSize: 14.5,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
