import React, { useEffect } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export default function SignInScreen({ navigation }: Props) {
  useEffect(() => {
    navigation.replace("SecureSignIn");
  }, [navigation]);

  return <View />;
}
