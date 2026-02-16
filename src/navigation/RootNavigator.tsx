// src/navigation/RootNavigator.tsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen";

import FirstTimeSetupScreen from "../screens/FirstTimeSetupScreen";
import SetupFinalScreen from "../screens/setup/SetupFinalScreen";
import SetupHelpScreen from "../screens/SetupHelpScreen";

import SecurePhoneScreen from "../screens/auth/SecurePhoneScreen";
import SecureOtpScreen from "../screens/auth/SecureOtpScreen";

import HomeScreen from "../screens/HomeScreen";

import CallDetailsScreen from "../screens/CallDetailsScreen";
import CallHistoryScreen from "../screens/CallHistoryScreen";
import VoicemailPlayerScreen from "../screens/VoicemailPlayerScreen";

export type RootStackParamList = {
  Splash: undefined;

  FirstTimeSetup: undefined;
  SetupFinal: undefined;
  SetupHelp: undefined;

  SecureSignIn: undefined | { fromSetup?: boolean };
  SecurePhone: undefined;
  SecureOtp: { phone: string };

  Home: undefined;
  CallDetails: { item: any; callSid?: string };
  CallHistory: undefined;
  VoicemailPlayer: { url: string; item: any; callSid?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function SplashGate({ navigation }: any) {
  const didRouteRef = React.useRef(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetOnce = React.useCallback(
    (route: keyof RootStackParamList, params?: any) => {
      if (didRouteRef.current) return;
      didRouteRef.current = true;

      try {
        navigation.reset({ index: 0, routes: [{ name: route as any, params }] });
      } catch {
        // fallback (older nav edge cases)
        try {
          navigation.replace(route as any, params);
        } catch {
          try {
            navigation.navigate(route as any, params);
          } catch {}
        }
      }
    },
    [navigation]
  );

  // Keep your "minimum splash time" UX
  const routeWithMinSplash = React.useCallback(
    (route: keyof RootStackParamList, t0: number) => {
      const remaining = Math.max(0, 2500 - (Date.now() - t0));
      const go = () => resetOnce(route);
      if (remaining <= 0) go();
      else timerRef.current = setTimeout(go, remaining);
    },
    [resetOnce]
  );

  // ✅ IMPORTANT: accept SplashScreen's computed result and route ONLY here.
  const onFinish = React.useCallback(
    (result: { authed: boolean; setupDone: boolean }) => {
      if (didRouteRef.current) return;

      const t0 = Date.now();

      try {
        const authed = !!result?.authed;
        const setupDone = !!result?.setupDone;

        // ✅ First gate after splash: setup
        if (!setupDone) return routeWithMinSplash("FirstTimeSetup", t0);

        // ✅ Setup done -> auth gate
        if (authed) return routeWithMinSplash("Home", t0);
        return routeWithMinSplash("SecureSignIn", t0);
      } catch {
        // safest fallback for fresh install
        return routeWithMinSplash("FirstTimeSetup", t0);
      }
    },
    [routeWithMinSplash]
  );

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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

      <Stack.Screen name="FirstTimeSetup" component={FirstTimeSetupScreen} options={{ animation: "fade" }} />
      <Stack.Screen name="SetupFinal" component={SetupFinalScreen} options={{ animation: "fade" }} />
      <Stack.Screen name="SetupHelp" component={SetupHelpScreen} options={{ headerShown: false }} />

      {/* Keep SecureSignIn as your phone/OTP entry flow */}
      <Stack.Screen name="SecureSignIn" component={SecurePhoneScreen} options={{ animation: "fade" }} />
      <Stack.Screen name="SecurePhone" component={SecurePhoneScreen} options={{ animation: "fade" }} />
      <Stack.Screen name="SecureOtp" component={SecureOtpScreen} options={{ animation: "fade" }} />

      <Stack.Screen name="Home" component={HomeScreen} options={{ animation: "fade" }} />
      <Stack.Screen name="CallDetails" component={CallDetailsScreen} options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
      <Stack.Screen
        name="VoicemailPlayer"
        component={VoicemailPlayerScreen}
        options={{ animation: "slide_from_right" }}
      />
    </Stack.Navigator>
  );
}

