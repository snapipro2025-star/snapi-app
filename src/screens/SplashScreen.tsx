import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  Easing,
} from "react-native";
import GlassBackground from "../components/GlassBackground";

type Props = { onFinish: () => void };

export default function SplashScreen({ onFinish }: Props) {
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const done = useRef(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (done.current) return;
      done.current = true;
      onFinish();
    };

    // reset on mount
    imageOpacity.stopAnimation();
    imageOpacity.setValue(0);

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (reduced) {
          imageOpacity.setValue(0.85);
          timeout = setTimeout(finish, 900);
          return;
        }

        // Fade vault in
        Animated.timing(imageOpacity, {
          toValue: 0.5, // vault strength
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();

        // Hold a bit longer (premium feel)
        timeout = setTimeout(finish, 1800);
      })
      .catch(() => {
        imageOpacity.setValue(0.85);
        timeout = setTimeout(finish, 1800);
      });

    return () => {
      done.current = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [onFinish, imageOpacity]);

  return (
    <GlassBackground>
      <View style={styles.screen}>
        <Animated.Image
          source={require("../../assets/splash/vault-phone.png")}
          style={[styles.image, { opacity: imageOpacity }]}
          resizeMode="contain"
          fadeDuration={0} // Android safety
        />

        {/* Subtle edge blend so it doesn’t feel like a hard rectangle */}
        <View pointerEvents="none" style={styles.edgeBlend} />
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  image: {
    width: "92%",
    maxWidth: 520,
    aspectRatio: 16 / 9,
  },

  edgeBlend: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,8,22,0.28)",
  },
});
