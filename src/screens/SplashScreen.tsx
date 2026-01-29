import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, AccessibilityInfo, Easing } from "react-native";
import GlassBackground from "../components/GlassBackground";

type Props = { onFinish: () => void };

// Fade-in duration (ms)
const FADE_MS = 650;

export default function SplashScreen({ onFinish }: Props) {
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const done = useRef(false);

  useEffect(() => {
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
          // Respect reduced motion: show immediately, then finish.
          imageOpacity.setValue(1);
          finish();
          return;
        }

        // Fade vault in, then finish (RootNavigator enforces total 4s)
        Animated.timing(imageOpacity, {
          toValue: 1,
          duration: FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) finish();
        });
      })
      .catch(() => {
        // Fallback: still animate quickly then finish
        Animated.timing(imageOpacity, {
          toValue: 1,
          duration: FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) finish();
        });
      });

    return () => {
      done.current = true;
      imageOpacity.stopAnimation();
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
    transform: [{ translateX: 10 }], // ✅ move right
  },

  edgeBlend: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,8,22,0.28)",
  },
});
