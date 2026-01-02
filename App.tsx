// App.tsx
import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/navigation/RootNavigator";

/**
 * Classic React Navigation app (NOT Expo Router).
 * Keep global error handler in ONE place to avoid double-hooking.
 * If you already set this in index.ts, remove it here.
 */

// OPTIONAL: debug stacks in Metro (bridgeless-safe) + preserve previous handler
const ErrorUtilsAny = (globalThis as any).ErrorUtils;
if (ErrorUtilsAny?.setGlobalHandler) {
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

      // Forward so Expo redbox / default behavior still works
      if (typeof previous === "function") previous(err, isFatal);
    } catch (e) {
      console.log("GLOBAL ERROR HANDLER FAILED:", (e as any)?.message || e);
    }
  });
}

console.log("========== APP.TSX LOADED ==========");

// Force dark background to prevent 1-frame white flash during transitions
const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#050816",
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={NavTheme}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
