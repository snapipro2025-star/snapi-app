import React from "react";
import { View, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";

export default function SnapiField({ size = 72 }) {
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.45)",
    backgroundColor: "rgba(0,229,255,0.08)",
    shadowColor: "#00E5FF",
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
});
