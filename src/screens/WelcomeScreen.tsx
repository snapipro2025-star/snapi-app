// src/screens/WelcomeScreen.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { PrimaryButton, GhostButton } from "../components/Buttons";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export default function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const padX = Tokens?.pad?.screen ?? 18;

  function goToOnboarding() {
    navigation.navigate("Onboarding");
  }

  function goToSecureSignIn() {
    navigation.navigate("SecureSignIn");
  }

  return (
    <GlassBackground>
      <View
        style={[
          styles.page,
          {
            paddingHorizontal: padX,
            paddingTop: Math.max(insets.top + 14, 28),
            paddingBottom: Math.max(insets.bottom + 14, 24),
          },
        ]}
      >
        <GlassCard style={styles.systemCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text
                style={[styles.title, { color: Colors?.textPrimary ?? "#f9fafb" }]}
                numberOfLines={1}
              >
                SNAPI live shield
              </Text>

              <Text
                style={[styles.subtitle, { color: Colors?.textMuted ?? "#9ca3af" }]}
                numberOfLines={1}
              >
                Monitoring inbound calls 24/7
              </Text>
            </View>
          </View>

          {/* 3 stat tiles */}
          <View style={styles.tilesRow}>
            <StatTile
              title="Suspicious calls"
              value="98.7%"
              foot="filtered (30d)"
              showDotOnFoot
              footDotColor={styles.dotAmber.backgroundColor as string}
            />
            <StatTile
              title="Verified callers"
              value="+4,120"
              foot="trusted profiles"
              showDotOnFoot
              footDotColor={styles.dotGreen.backgroundColor as string}
            />
            <StatTile
              title="Time saved"
              value="63 hrs"
              foot="per month*"
              showDotOnFoot
              footDotColor={styles.dotGreen.backgroundColor as string}
            />
          </View>

          {/* Banner */}
          <View style={styles.banner}>
            <Text
              style={[styles.bannerText, { color: Colors?.textPrimary ?? "#f9fafb" }]}
              numberOfLines={3}
            >
              SNAPI routing engine identifies callers, challenges unknown numbers, and
              passes only the real people through.
            </Text>

            <View style={styles.miniPillsCol}>
              <MiniPill label="SNAPIPro" />
              <MiniPill label="SNAPIBusiness" />
            </View>
          </View>
        </GlassCard>

        <View style={{ flex: 1 }} />

        <View style={styles.actions}>
          <PrimaryButton title="Get Protected" onPress={goToOnboarding} />
          <GhostButton title="Secure sign-in" onPress={goToSecureSignIn} />
        </View>
      </View>
    </GlassBackground>
  );
}

function StatTile({
  title,
  value,
  foot,
  showDotOnFoot,
  footDotColor,
}: {
  title: string;
  value: string;
  foot: string;
  showDotOnFoot?: boolean;
  footDotColor?: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileTitle} numberOfLines={2} ellipsizeMode="tail">
        {title}
      </Text>

      <View style={styles.tileBottom}>
        <Text
          style={styles.tileValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.9}
        >
          {value}
        </Text>

        <View style={styles.tileFootRow}>
          {showDotOnFoot ? (
            <View
              style={[
                styles.tileDot,
                { backgroundColor: footDotColor ?? styles.dotGreen.backgroundColor },
              ]}
            />
          ) : null}

          <Text style={styles.tileFoot} numberOfLines={1} ellipsizeMode="tail">
            {foot}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MiniPill({ label }: { label: string }) {
  return (
    <View style={styles.miniPill}>
      <Text style={styles.miniPillText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "transparent",
  },

  systemCard: {
    width: "100%",
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(11,21,48,0.30)",
    overflow: "hidden",
  },

  headerRow: {
    flexDirection: "row",
    width: "100%",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "600",
  },

  tilesRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
    marginBottom: 12,
  },

  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(8,14,32,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 94,
  },

  tileTitle: {
    color: "rgba(156,163,175,0.95)",
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "800",
    minHeight: 28,
    marginBottom: 6,
  },

  tileBottom: {
    gap: 5,
  },

  tileValue: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  tileFootRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },

  tileDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },

  // dot colors (kept as styles so you can tweak once)
  dotGreen: {
    backgroundColor: Colors?.ok ?? "#34d399",
  },
  dotAmber: {
    backgroundColor: "rgba(251,191,36,0.95)", // amber (warning/filtered)
  },

  tileFoot: {
    flex: 1,
    minWidth: 0,
    color: "rgba(156,163,175,0.95)",
    fontSize: 11.5,
    fontWeight: "600",
  },

  banner: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.20)",
    backgroundColor: "rgba(139,92,246,0.14)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  bannerText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  miniPillsCol: {
    gap: 8,
    alignItems: "flex-end",
    flexShrink: 0,
  },

  miniPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(8,14,32,0.45)",
  },

  miniPillText: {
    color: "#f9fafb",
    fontSize: 12,
    fontWeight: "800",
  },

  actions: {
    gap: 12,
  },
});
