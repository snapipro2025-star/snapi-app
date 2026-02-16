// App.tsx
import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, AppState, AppStateStatus, View } from "react-native";

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import RootNavigator from "./src/navigation/RootNavigator";
import { ensureShieldNotificationOnce } from "./src/lib/shieldNotification";
import { getSession, hydrateSession } from "./src/api/client";

/**
 * Classic React Navigation app (NOT Expo Router).
 * Keep global handlers registered once here to avoid duplicates.
 */

// ---- Notifications (foreground handler) ----
function initForegroundNotificationsOnce() {
  try {
    if (typeof (Notifications as any)?.setNotificationHandler !== "function") return;

    (Notifications as any).setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    console.log("[App] foreground notification handler registered");
  } catch (e: any) {
    console.log("[App] setNotificationHandler failed:", e?.message || String(e));
  }
}

// ---- Global Error Handler (bridgeless-safe) ----
function initGlobalErrorHandlerOnce() {
  try {
    const ErrorUtilsAny = (globalThis as any)?.ErrorUtils;
    if (!ErrorUtilsAny?.setGlobalHandler) return;

    const previous = ErrorUtilsAny.getGlobalHandler?.();

    ErrorUtilsAny.setGlobalHandler((err: any, isFatal?: boolean) => {
      try {
        const msg =
          err?.message ??
          (typeof err === "string" ? err : JSON.stringify(err, null, 2));

        console.log("========== GLOBAL ERROR (App.tsx) ==========");
        console.log("Fatal:", !!isFatal);
        console.log("Message:", msg);
        if (err?.stack) console.log("Stack:", err.stack);

        if (typeof previous === "function") previous(err, isFatal);
      } catch (e2: any) {
        console.log("GLOBAL ERROR HANDLER FAILED:", e2?.message || String(e2));
      }
    });
  } catch (e: any) {
    console.log("[App] initGlobalErrorHandler failed:", e?.message || String(e));
  }
}

// Force dark background to prevent 1-frame white flash during transitions
const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#050816",
  },
};

export default function App() {
  // Gate navigation until SecureStore tokens are loaded
  const [hydrated, setHydrated] = useState(false);

  // Used to remount NavigationContainer when auth flips (fixes "login twice")
  const [navKey, setNavKey] = useState("nav:boot:0");

  const lastAuthedRef = useRef<boolean>(false);
  const pollTimerRef = useRef<any>(null);

  async function runHydrate(reason: string) {
    try {
      const s = await hydrateSession();
      const authed = !!s.isAuthed;

      if (!hydrated) setHydrated(true);

      // Only remount nav when auth changes
      if (lastAuthedRef.current !== authed) {
        lastAuthedRef.current = authed;
        setNavKey(`nav:${authed ? "authed" : "guest"}:${Date.now()}`);
        console.log("[App] nav remount (auth flip)", { reason, authed });
      } else {
        console.log("[App] hydrate ok", { reason, authed, hydrated: true });
      }
    } catch (e: any) {
      // If hydrate fails, still allow app to render (treat as logged out)
      if (!hydrated) setHydrated(true);
      lastAuthedRef.current = false;
      setNavKey(`nav:guest:${Date.now()}`);
      console.log("[App] hydrate failed:", e?.message || String(e));
    }
  }

  useEffect(() => {
    console.log("========== APP.TSX MOUNT ==========");
    console.log("[runtime] appOwnership =", Constants?.appOwnership);

    // DEBUG (keep until hook issue resolved)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const r = require("react");
      console.log("[debug] react.version =", r?.version);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      console.log("[debug] react.path =", require.resolve("react"));
    } catch (e: any) {
      console.log("[debug] react resolve failed", e?.message || String(e));
    }

    // ✅ Critical: hydrate session BEFORE mounting navigation
    runHydrate("boot");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initForegroundNotificationsOnce();
    initGlobalErrorHandlerOnce();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      Promise.resolve()
        .then(() => ensureShieldNotificationOnce())
        .catch((e) =>
          console.log(
            "[App] ensureShieldNotificationOnce failed:",
            e?.message || String(e)
          )
        );
    }, 800);

    return () => clearTimeout(t);
  }, []);

  // ✅ Re-hydrate when app becomes active again (Android)
  useEffect(() => {
    const onState = (st: AppStateStatus) => {
      if (st === "active") runHydrate("appstate:active");
    };
    const sub = AppState.addEventListener("change", onState);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Lightweight poll to catch "tokens just got written" after OTP (without editing RootNavigator yet)
  useEffect(() => {
    // stop any previous timer
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    // only poll after hydration starts
    pollTimerRef.current = setInterval(() => {
      const s = getSession();
      if (!s?.hydrated) return;

      const authed = !!s.isAuthed;
      if (lastAuthedRef.current !== authed) {
        lastAuthedRef.current = authed;
        setNavKey(`nav:${authed ? "authed" : "guest"}:${Date.now()}`);
        console.log("[App] nav remount (poll auth flip)", { authed });
      }
    }, 700);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, []);

  if (!hydrated) {
    // Simple boot splash (dark) while SecureStore loads tokens
    return (
      <View style={{ flex: 1, backgroundColor: "#050816", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={NavTheme} key={navKey}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
