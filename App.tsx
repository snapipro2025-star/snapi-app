import React from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import RootNavigator from "./src/navigation/RootNavigator";
import { Colors } from "./src/theme/colors";

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.bg,
    card: Colors.bg,
    text: Colors.text,
    border: Colors.border,
    primary: Colors.accent,
  },
};

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}
