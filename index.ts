// index.ts (ENTRY)
import { registerRootComponent } from "expo";

console.log("========== SNAPI ENTRY LOADED (index.ts) ==========");

// Global error logging (optional but helpful)
const ErrorUtilsAny = (globalThis as any).ErrorUtils;
if (ErrorUtilsAny?.setGlobalHandler) {
  const previous = ErrorUtilsAny.getGlobalHandler?.();
  ErrorUtilsAny.setGlobalHandler((err: any, isFatal?: boolean) => {
    try {
      console.log("========== GLOBAL ERROR ==========");
      console.log("Fatal:", !!isFatal);
      console.log("Message:", err?.message ?? String(err));
      if (err?.stack) console.log("Stack:", err.stack);
      if (typeof previous === "function") previous(err, isFatal);
    } catch {}
  });
}

import App from "./App";

// This is the correct Expo entry for classic apps
registerRootComponent(App);
