// src/lib/shieldNotification.ts
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let didRun = false;

function hasFn(obj: any, name: string) {
  return obj && typeof obj[name] === "function";
}

/**
 * Forces Samsung/OneUI to register SNAPI under notification settings by:
 * - ensuring permission
 * - creating a channel
 * - presenting a visible notification (if supported in this build)
 *
 * This is defensive because dev clients can lack expo-notifications native bindings
 * unless the client was rebuilt with the module.
 */
export async function ensureShieldNotificationOnce() {
  if (didRun) return;
  didRun = true;

  if (Platform.OS !== "android") return;

  try {
    // If expo-notifications isn't fully available in this runtime, bail quietly.
    if (
      !hasFn(Notifications as any, "getPermissionsAsync") ||
      !hasFn(Notifications as any, "requestPermissionsAsync") ||
      !hasFn(Notifications as any, "setNotificationChannelAsync")
    ) {
      console.log("[shieldNotification] notifications module unavailable in this build");
      return;
    }

    // Ensure permission (Android 13+)
    const perms = await Notifications.getPermissionsAsync();
    if (perms.status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== "granted") return;
    }

    // Create channel so Samsung lists the app; HIGH increases visibility
    await Notifications.setNotificationChannelAsync("snapi_shield", {
      name: "SNAPI Shield",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
      enableVibrate: true,
    });

    // Present immediately (optional — feature-detect)
    const present = (Notifications as any).presentNotificationAsync;
    if (typeof present !== "function") {
      console.log("[shieldNotification] presentNotificationAsync unavailable; channel created");
      return;
    }

    await present({
      title: "SNAPI Shield Active",
      body: "Call firewall is running.",
      sound: undefined,
    });
  } catch (e: any) {
    console.log("[shieldNotification] failed:", e?.message || e);
  }
}
