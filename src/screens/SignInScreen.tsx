import React from "react";
import { View, Text, StyleSheet } from "react-native";
import GlassBackground from "../components/GlassBackground";
import { Colors } from "../theme/colors";

export default function SignInScreen() {
  const textColor = Colors?.text ?? "#FFFFFF";

  return (
    <GlassBackground>
      <View style={styles.container}>
        <Text style={[styles.title, { color: textColor }]}>
          Sign In
        </Text>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
});
