import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "snapi:onboardingComplete:v1";

/** Returns true if onboarding is completed, otherwise false */
export async function isOnboardingComplete(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === "1";
  } catch {
    return false;
  }
}

/** Mark onboarding as completed */
export async function setOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {
    // ignore write failures (won't block app)
  }
}

/** Dev helper: reset onboarding (optional) */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}