import React, { useState } from "react";
import { Pressable, Text, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";

type BtnProps = {
  title: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export function PrimaryButton({ title, onPress, style }: BtnProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        {
          height: Tokens.btnH,
          borderRadius: Tokens.rBtn,
          borderWidth: 1,
          borderColor: pressed ? "rgba(0,229,255,.34)" : "rgba(0,229,255,.28)",
          overflow: "hidden",

          // softer, more “dashboard” aura (not a big blob)
          shadowColor: Colors.accent,
          shadowOpacity: pressed ? 0.18 : 0.16,
          shadowRadius: pressed ? 14 : 18,
          elevation: pressed ? 7 : 9,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[
          pressed ? Colors.btnTopHover : Colors.btnTop,
          pressed ? Colors.btnBottomHover : Colors.btnBottom,
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* inner highlight ring to mimic inset stroke */}
        <LinearGradient
          colors={["rgba(0,229,255,.14)", "rgba(0,229,255,0)"]}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.8, y: 1 }}
          style={{
            position: "absolute",
            inset: 0,
          }}
        />

        <Text style={{ color: Colors.text, fontWeight: "900", fontSize: 15 }}>
          {title}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({ title, onPress, style }: BtnProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        {
          height: Tokens.btnH,
          borderRadius: Tokens.rBtn,
          borderWidth: 1,
          borderColor: pressed ? "rgba(148,163,184,.32)" : Colors.border,
          backgroundColor: "rgba(10,16,32,.6)",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text style={{ color: Colors.muted, fontWeight: "900", fontSize: 15 }}>
        {title}
      </Text>
    </Pressable>
  );
}
