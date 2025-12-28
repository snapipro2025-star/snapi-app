import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Colors } from "../theme/colors";
import GlassBackground from "../components/GlassBackground";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace("Welcome"), 3000);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <GlassBackground>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: 90,
            height: 90,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: "rgba(0,229,255,.22)",
            backgroundColor: "rgba(11,21,48,.9)",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.accent,
            shadowOpacity: 0.35,
            shadowRadius: 22,
            elevation: 10,
          }}
        >
          <Text style={{ color: Colors.text, fontSize: 28, fontWeight: "900" }}>S</Text>
        </View>

        <Text style={{ color: Colors.text, fontSize: 30, fontWeight: "900", marginTop: 18 }}>
          SNAPI
        </Text>

        <Text style={{ color: Colors.muted, marginTop: 8, textAlign: "center", paddingHorizontal: 28, lineHeight: 20 }}>
          Personal Call Protection Powered by AI
        </Text>
      </View>
    </GlassBackground>
  );
}

