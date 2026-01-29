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

import CallDetailsScreen from "../screens/CallDetailsScreen";
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

  CallDetails: {
    item: {
      callSid?: string;
      id?: string;
      from?: string;
      name?: string;
      business?: string;
      privateNumber?: boolean;
      at?: string;
      risk?: number;
      voicemailUrl?: string;
      blocked?: boolean;
    };
    callSid?: string;
  };

  CallHistory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type SplashProps = NativeStackScreenProps<RootStackParamList, "Splash">;

function SplashGate({ navigation }: SplashProps) {
  const onFinish = useCallback(
    async ({ authed } = { authed: false }) => {
      const t0 = Date.now();
      let didNavigate = false;

      const replaceOnce = (route: keyof RootStackParamList) => {
        if (didNavigate) return;
        didNavigate = true;

        // Keep total splash time at least 4 seconds (including boot work)
        const remaining = Math.max(0, 4000 - (Date.now() - t0));
        setTimeout(() => {
          try {
            // Use replace so users can't "go back" to splash
            navigation.replace(route as any);
          } catch {}
        }, remaining);
      };

      try {
        const completed = await isOnboardingComplete();

        // If onboarding not complete -> Welcome first (always)
        if (!completed) {
          replaceOnce("Welcome");
          return;
        }

        // Onboarding complete -> go straight to Home if authed notice from Splash boot
        replaceOnce(authed ? "Home" : "SecureSignIn");
      } catch {
        // Safe fallback: Welcome (so user isn't blocked)
        replaceOnce("Welcome");
      }
    },
    [navigation]
  );

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
      <Stack.Screen name="Splash" component={SplashGate} options={{ animation: "none" }} />

      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ animation: "none" }} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: "slide_from_right" }} />

      <Stack.Screen name="SecureSignIn" component={SecureSignInScreen} options={{ animation: "none" }} />
      <Stack.Screen name="SecurePhone" component={SecurePhoneScreen} options={{ animation: "fade" }} />
      <Stack.Screen name="SecureOtp" component={SecureOtpScreen} options={{ animation: "fade" }} />

      <Stack.Screen name="SignIn" component={SignInScreen} options={{ animation: "slide_from_right" }} />

      <Stack.Screen name="Home" component={HomeScreen} options={{ animation: "fade" }} />

      <Stack.Screen name="CallDetails" component={CallDetailsScreen} options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
    </Stack.Navigator>
  );
}
