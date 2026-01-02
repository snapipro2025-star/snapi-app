// src/navigation/RootNavigator.tsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen";
import WelcomeScreen from "../screens/WelcomeScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import SignInScreen from "../screens/SignInScreen";
import HomeScreen from "../screens/HomeScreen";

// ✅ onboarding persistence
// Use whichever helper you actually exported:
// - if your lib exports isOnboardingComplete(): use that
// - if your lib exports getOnboardingComplete(): keep that name
import { isOnboardingComplete } from "../lib/onboarding";

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        // Prevent any default white background during transitions
        contentStyle: { backgroundColor: "#050816" },
        animation: "simple_push",
      }}
    >
      {/* Splash -> (Home | Welcome) based on onboarding state */}
      <Stack.Screen name="Splash" options={{ animation: "none" }}>
        {({ navigation }) => (
          <SplashScreen
            onFinish={async () => {
              try {
                const completed = await isOnboardingComplete();
                navigation.replace(completed ? "Home" : "Welcome");
              } catch {
                // Fail-safe: if storage errors, default to Welcome
                navigation.replace("Welcome");
              }
            }}
          />
        )}
      </Stack.Screen>

      {/* Disable animation on the destination screen to avoid a “flash” */}
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ animation: "none" }}
      />

      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />

      {/* Home = post-onboarding mobile dashboard */}
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ animation: "fade" }}
      />
    </Stack.Navigator>
  );
}
