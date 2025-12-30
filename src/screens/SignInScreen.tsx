import React from "react";
import { View, Text } from "react-native";
import GlassBackground from "../components/GlassBackground";
import { Colors } from "../theme/colors";

export default function SignInScreen() {
  return (
    <GlassBackground>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: Colors.text ?? "#fff", fontSize: 18, fontWeight: "800" }}>
          Sign In
        </Text>
      </View>
    </GlassBackground>
  );
}
