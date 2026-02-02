// src/navigation/RootNavigator.tsx
import React, { useCallback } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen";
import WelcomeScreen from "../screens/WelcomeScreen";
import OnboardingScreen from "../screens/OnboardingScreen";

import FirstTimeSetupScreen from "../screens/FirstTimeSetupScreen";
import SetupFinalScreen from "../screens/setup/SetupFinalScreen";

import SecureSignInScreen from "../screens/auth/SecureSignInScreen";
import SecurePhoneScreen from "../screens/auth/SecurePhoneScreen";
import SecureOtpScreen from "../screens/auth/SecureOtpScreen";

import SignInScreen from "../screens/SignInScreen";
import HomeScreen from "../screens/HomeScreen";

import CallDetailsScreen from "../screens/CallDetailsScreen";
import CallHistoryScreen from "../screens/CallHistoryScreen";

import { isOnboardingComplete } from "../lib/onboarding";
import { isSetupComplete } from "../lib/setup";

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Onboarding: undefined;

  FirstTimeSetup: undefined;
  SetupFinal: undefined;

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
            navigation.replace(route as any);
          } catch {}
        }, remaining);
      };

      try {
        // 1) Onboarding gate (always first)
        const completed = await isOnboardingComplete();
        if (!completed) {
          replaceOnce("Welcome");
          return;
        }

        // 2) Setup gate (before auth)
        const setupDone = await isSetupComplete();
        if (!setupDone) {
          replaceOnce("FirstTimeSetup");
          return;
        }

        // 3) Setup done -> if authed, go home
        if (authed) {
          replaceOnce("Home");
          return;
        }

        // 4) Not authed -> secure sign-in
        replaceOnce("SecureSignIn");
      } catch {
        // Safe fallback: never block user
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

      <Stack.Screen name="FirstTimeSetup" component={FirstTimeSetupScreen} options={{ animation: "fade" }} />
      <Stack.Screen name="SetupFinal" component={SetupFinalScreen} options={{ animation: "fade" }} />

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
