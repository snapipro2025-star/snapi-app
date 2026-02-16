// src/lib/setup.ts
import * as SecureStore from "expo-secure-store";

/**
 * Setup completion flag
 * ---------------------
 * Stored as:
 *   "1" = setup completed
 *
 * We intentionally do NOT store "false".
 * Absence of the key = not completed.
 */
const SETUP_KEY = "snapi.setup_complete";

/**
 * Canonical reader used by Splash + OTP routing.
 */
export async function getSetupComplete(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(SETUP_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

/**
 * Backwards-compatible alias used elsewhere in app.
 * (RootNavigator currently imports this)
 */
export async function isSetupComplete(): Promise<boolean> {
  return getSetupComplete();
}

/**
 * Marks setup complete or clears it.
 */
export async function setSetupComplete(done: boolean): Promise<void> {
  try {
    if (done) {
      await SecureStore.setItemAsync(SETUP_KEY, "1");
    } else {
      await SecureStore.deleteItemAsync(SETUP_KEY);
    }
  } catch {
    // intentionally ignored — setup flag failure should never block app
  }
}

/* ------------------------------------------------------------------ */
/* Timezone helper (kept here for now — lightweight + no async need) */
/* ------------------------------------------------------------------ */

/**
 * Returns device timezone in IANA format.
 * Example: "America/Denver"
 */
export function getDeviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === "string" && tz.length ? tz : "UTC";
  } catch {
    return "UTC";
  }
}
