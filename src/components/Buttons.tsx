import React from "react";
import { Pressable, Text, View, ViewStyle, StyleProp } from "react-native";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";

type BtnProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ActionBlock({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          padding: Tokens?.pad?.screen ?? 16,
          borderRadius: 22,
          backgroundColor: "rgba(8, 18, 40, 0.86)", // dark blue block
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

/** PRIMARY: aqua outline + white text (sits on ActionBlock) */
export function PrimaryButton({ title, onPress, disabled, style }: BtnProps) {
  const aqua = Colors?.accent ?? "#00E5FF";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          borderWidth: 1.6,
          borderColor: aqua,
          borderRadius: 999,
          paddingVertical: 14,
          paddingHorizontal: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        },
        style as any,
      ]}
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

/** SECONDARY: subtle outline, still white text (never louder than primary) */
export function GhostButton({ title, onPress, disabled, style }: BtnProps) {
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
          backgroundColor: "rgba(2, 6, 20, 0.22)",
          opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
        },
        style as any,
      ]}
    >
      <Text
        style={{
          color: "rgba(255,255,255,0.88)",
          fontSize: 14.5,
          fontWeight: "750",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
