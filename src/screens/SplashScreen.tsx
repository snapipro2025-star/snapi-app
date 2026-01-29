// src/screens/SplashScreen.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  Easing,
} from "react-native";

import GlassBackground from "../components/GlassBackground";

// Import safely (works even if some functions aren't exported yet)
import * as Api from "../api/client";

type Props = {
  /**
   * Called once when splash is done AND we've attempted to restore auth.
   * Backwards compatible: callers can ignore the argument.
   */
  onFinish: (result?: { authed: boolean }) => void;
};

// Fade-in duration (ms)
const FADE_MS = 650;

// Safety: don't get stuck forever during boot
const BOOT_TIMEOUT_MS = 2500;

export default function SplashScreen({ onFinish }: Props) {
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const done = useRef(false);

  useEffect(() => {
    const finish = (authed: boolean) => {
      if (done.current) return;
      done.current = true;
      onFinish?.({ authed });
    };

    // reset on mount
    imageOpacity.stopAnimation();
    imageOpacity.setValue(0);

    // -----------------------------
    // 1) Animation promise
    // -----------------------------
    const runAnimation = async () => {
      try {
        const reduced = await AccessibilityInfo.isReduceMotionEnabled();
        if (reduced) {
          imageOpacity.setValue(1);
          return;
        }

        await new Promise<void>((resolve) => {
          Animated.timing(imageOpacity, {
            toValue: 1,
            duration: FADE_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) resolve();
            else resolve();
          });
        });
      } catch {
        // Fallback: still animate quickly then proceed
        await new Promise<void>((resolve) => {
          Animated.timing(imageOpacity, {
            toValue: 1,
            duration: FADE_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => resolve());
        });
      }
    };

    // -----------------------------
    // 2) Auth bootstrap promise
    // -----------------------------
    const runBoot = async (): Promise<boolean> => {
      const getAccessToken = (Api as any).getAccessToken as undefined | (() => Promise<string | null>);
      const getRefreshToken = (Api as any).getRefreshToken as undefined | (() => Promise<string | null>);
      const refreshSession = (Api as any).refreshSession as undefined | (() => Promise<boolean>);

      try {
        // If helper functions don't exist yet, we can't restore here.
        if (!getAccessToken || !getRefreshToken) return false;

        const access = await getAccessToken();
        if (access) return true;

        const refresh = await getRefreshToken();
        if (refresh && refreshSession) {
          const ok = await refreshSession();
          return !!ok;
        }

        return false;
      } catch {
        return false;
      }
    };

    // -----------------------------
    // Run both in parallel, then finish once.
    // -----------------------------
    let alive = true;

    (async () => {
      const bootPromise = runBoot();

      // timeout wrapper for boot so splash doesn't hang
      const bootTimed = await Promise.race<boolean>([
        bootPromise,
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), BOOT_TIMEOUT_MS)),
      ]);

      // we still want the animation to complete (unless reduce-motion)
      await runAnimation();

      if (!alive) return;
      finish(bootTimed);
    })();

    return () => {
      alive = false;
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
