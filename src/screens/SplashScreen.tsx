// src/screens/SplashScreen.tsx
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, AccessibilityInfo, Easing } from "react-native";

import GlassBackground from "../components/GlassBackground";

// ✅ Real imports (no `as any`)
import { getAccessToken, refreshSessionOnce } from "../api/client";
import { getSetupComplete } from "../lib/setup";

type Props = {
  /**
   * Called once when splash is done AND we've attempted to restore auth.
   * Caller decides where to navigate next.
   */
  onFinish: (result: { authed: boolean; setupDone: boolean }) => void;
};

// Fade-in duration (ms)
const FADE_MS = 650;

// Safety: don't get stuck forever during boot
const BOOT_TIMEOUT_MS = 2500;

export default function SplashScreen({ onFinish }: Props) {
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);

  useEffect(() => {
    let alive = true;

    const finish = (authed: boolean, setupDone: boolean) => {
      if (!alive) return;
      if (doneRef.current) return;
      doneRef.current = true;
      onFinish?.({ authed, setupDone });
    };

    // reset animation on mount
    imageOpacity.stopAnimation();
    imageOpacity.setValue(0);

    // 1) Animation
    const runAnimation = async () => {
      try {
        const reduced = await AccessibilityInfo.isReduceMotionEnabled();
        if (reduced) {
          imageOpacity.setValue(1);
          return;
        }
      } catch {
        // ignore reduce-motion lookup failure
      }

      await new Promise<void>((resolve) => {
        Animated.timing(imageOpacity, {
          toValue: 1,
          duration: FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => resolve());
      });
    };

    // 2) Boot / restore auth
    const runBoot = async (): Promise<{ authed: boolean; setupDone: boolean }> => {
      let authed = false;
      let setupDone = false;

      try {
        // A) Try existing access token
        const access = await getAccessToken().catch(() => null);
        authed = !!access;

        // B) If no access, try refresh
        if (!authed) {
          const ok = await refreshSessionOnce().catch(() => false);
          authed = !!ok;
        }

        // C) Setup completion is meaningful even if not authed (but usually paired)
        setupDone = await getSetupComplete().catch(() => false);

        return { authed, setupDone };
      } catch {
        return { authed: false, setupDone: false };
      }
    };

    (async () => {
      // Run boot with timeout so splash never hangs
      const bootTimed = await Promise.race<{ authed: boolean; setupDone: boolean }>([
        runBoot(),
        new Promise<{ authed: boolean; setupDone: boolean }>((resolve) =>
          setTimeout(() => resolve({ authed: false, setupDone: false }), BOOT_TIMEOUT_MS)
        ),
      ]);

      // Ensure animation completes (unless reduce-motion forced to 1 instantly)
      await runAnimation();

      finish(bootTimed.authed, bootTimed.setupDone);
    })();

    return () => {
      alive = false;
      doneRef.current = true;
      imageOpacity.stopAnimation();
    };
  }, [imageOpacity, onFinish]);

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
