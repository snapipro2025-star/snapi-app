// src/lib/setup.ts
import * as SecureStore from "expo-secure-store";

const SETUP_KEY = "snapi.setup_complete"; // "1" = done

export async function isSetupComplete(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(SETUP_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function setSetupComplete(done: boolean): Promise<void> {
  try {
    if (done) await SecureStore.setItemAsync(SETUP_KEY, "1");
    else await SecureStore.deleteItemAsync(SETUP_KEY);
  } catch {
    // ignore
  }
}
