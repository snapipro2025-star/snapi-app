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

  function goToSignIn() {
    navigation.navigate("SignIn");
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
        {/* ---------- SYSTEM CARD ---------- */}
        <GlassCard style={styles.systemCard}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.title,
                  { color: Colors?.textPrimary ?? "#f9fafb" },
                ]}
              >
                SNAPI live shield
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  { color: Colors?.textMuted ?? "#9ca3af" },
                ]}
              >
                Monitoring inbound calls 24/7
              </Text>
            </View>

            {/* Status pill */}
            <View style={styles.statusPill}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: Colors?.ok ?? "#34d399" },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: Colors?.textPrimary ?? "#f9fafb" },
                ]}
              >
                Real-time screening active
              </Text>
            </View>
          </View>

          {/* 3 stat tiles */}
          <View style={styles.tilesRow}>
            <StatTile
              title={"Suspicious calls\nfiltered"}
              value="98.7%"
              foot="last 30 days"
            />
            <StatTile
              title="Verified callers"
              value="+4,120"
              foot="trusted profiles"
              showDotOnFoot
            />
            <StatTile
              title="Time saved"
              value="63 hrs"
              foot="per month*"
              showDotOnFoot
            />
          </View>

          {/* Bottom banner */}
          <View style={styles.banner}>
            <Text
              style={[
                styles.bannerText,
                { color: Colors?.textPrimary ?? "#f9fafb" },
              ]}
            >
              SNAPI routing engine identifies callers, challenges unknown numbers,
              and passes only the real people through.
            </Text>

            <View style={styles.miniPillsCol}>
              <MiniPill label="SNAPIPro" />
              <MiniPill label="SNAPIBusiness" />
            </View>
          </View>
        </GlassCard>

        {/* spacer */}
        <View style={{ flex: 1 }} />

        {/* ---------- ACTIONS ---------- */}
        <View style={styles.actions}>
          <PrimaryButton label="Get Protected" onPress={goToOnboarding} />
          <GhostButton label="Secure sign-in" onPress={goToSignIn} />
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
}: {
  title: string;
  value: string;
  foot: string;
  showDotOnFoot?: boolean;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileTitle}>{title}</Text>

      <View style={{ gap: 6 }}>
        <Text style={styles.tileValue}>{value}</Text>

        <View style={styles.tileFootRow}>
          {showDotOnFoot ? <View style={styles.tileDot} /> : null}
          <Text style={styles.tileFoot}>{foot}</Text>
        </View>
      </View>
    </View>
  );
}

function MiniPill({ label }: { label: string }) {
  return (
    <View style={styles.miniPill}>
      <Text style={styles.miniPillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "transparent",
  },

  systemCard: {
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(11,21,48,0.30)",
    overflow: "hidden",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
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

  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.32)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },

  tilesRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  tile: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(8,14,32,0.55)",
    padding: 12,
    minHeight: 86,
    justifyContent: "space-between",
  },
  tileTitle: {
    color: "rgba(156,163,175,0.95)",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  tileValue: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  tileFootRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tileDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: "#34d399",
  },
  tileFoot: {
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
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  miniPillsCol: {
    gap: 8,
    alignItems: "flex-end",
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

