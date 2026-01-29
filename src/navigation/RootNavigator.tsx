// src/navigation/RootNavigator.tsx
import React, { useCallback } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen";
import WelcomeScreen from "../screens/WelcomeScreen";
import OnboardingScreen from "../screens/OnboardingScreen";

import SecureSignInScreen from "../screens/auth/SecureSignInScreen";
import SecurePhoneScreen from "../screens/auth/SecurePhoneScreen";
import SecureOtpScreen from "../screens/auth/SecureOtpScreen";

import SignInScreen from "../screens/SignInScreen";
import HomeScreen from "../screens/HomeScreen";

// ✅ NEW: Call Details (matches Home "View" navigation)
import CallDetailsScreen from "../screens/CallDetailsScreen";

// (optional legacy screen — we'll remove the button in Home, but route can stay if you want)
import CallHistoryScreen from "../screens/CallHistoryScreen";

import { isOnboardingComplete } from "../lib/onboarding";

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Onboarding: undefined;

  SecureSignIn: undefined;
  SecurePhone: undefined;
  SecureOtp: { phone: string };

  SignIn: undefined;
  Home: undefined;

  // ✅ NEW
  CallDetails: { item: { callSid?: string; id?: string; from?: string; name?: string; business?: string; privateNumber?: boolean; at?: string; risk?: number; voicemailUrl?: string; blocked?: boolean }; callSid?: string };

  // optional legacy route (keep or remove)
  CallHistory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type SplashProps = NativeStackScreenProps<RootStackParamList, "Splash">;

function SplashGate({ navigation }: SplashProps) {
  const onFinish = useCallback(async () => {
    const t0 = Date.now();
    let didNavigate = false;

    const replaceOnce = (route: "Welcome" | "SecureSignIn") => {
      if (didNavigate) return;
      didNavigate = true;

      const remaining = Math.max(0, 4000 - (Date.now() - t0));
      setTimeout(() => {
        try {
          navigation.replace(route);
        } catch {}
      }, remaining);
    };

    try {
      const completed = await isOnboardingComplete();
      replaceOnce(completed ? "SecureSignIn" : "Welcome");
    } catch {
      replaceOnce("Welcome");
    }
  }, [navigation]);

  return <SplashScreen onFinish={onFinish} />;
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#050816" },
        animation: "simple_push",
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashGate}
        options={{ animation: "none" }}
      />

      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ animation: "none" }}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ animation: "slide_from_right" }}
      />

      <Stack.Screen
        name="SecureSignIn"
        component={SecureSignInScreen}
        options={{ animation: "none" }}
      />
      <Stack.Screen
        name="SecurePhone"
        component={SecurePhoneScreen}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="SecureOtp"
        component={SecureOtpScreen}
        options={{ animation: "fade" }}
      />

      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{ animation: "slide_from_right" }}
      />

      <Stack.Screen name="Home" component={HomeScreen} options={{ animation: "fade" }} />

      {/* ✅ NEW: Call Details */}
      <Stack.Screen
        name="CallDetails"
        component={CallDetailsScreen}
        options={{ animation: "slide_from_right" }}
      />

      {/* Optional legacy route (can remove later) */}
      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
    </Stack.Navigator>
  );
}
