import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";

type Props = {
  size?: number;
};

export default function SnapiLogo({ size = 28 }: Props) {
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size * 0.35,
        },
      ]}
    >
      <Text style={[styles.icon, { fontSize: size * 0.6 }]}>
        🛡
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.45)",
    backgroundColor: "rgba(0,229,255,0.10)",
  },
  icon: {
    color: Colors.accent ?? "#00E5FF",
  },
});
