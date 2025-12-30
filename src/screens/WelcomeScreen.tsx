import React from "react";
import { View, Text } from "react-native";
import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { PrimaryButton, GhostButton } from "../components/Buttons";
import { Colors } from "../theme/colors";
import { Tokens } from "../theme/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  
  return (
    <GlassBackground>
      <View
        style={{
          flex: 1,
          paddingHorizontal: Tokens?.pad?.screen ?? 18,
          paddingTop: Math.max(insets.top + 14, 28),
          paddingBottom: Math.max(insets.bottom + 14, 24),
        }}
      >
        {/* ---------- SYSTEM CARD (matches desktop) ---------- */}
        <GlassCard
          style={{
            padding: 16,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: "rgba(148,163,184,0.22)",
            backgroundColor: "rgba(11,21,48,0.30)",
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: Colors?.textPrimary ?? "#f9fafb",
                  fontSize: 18,
                  fontWeight: "900",
                  letterSpacing: 0.2,
                }}
              >
                SNAPI live shield
              </Text>
              <Text
                style={{
                  color: Colors?.textMuted ?? "#9ca3af",
                  marginTop: 4,
                  fontSize: 12.5,
                  lineHeight: 16,
                }}
              >
                Monitoring inbound calls 24/7
              </Text>
            </View>

            {/* Status pill (top-right) */}
            <View
              style={{
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
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  backgroundColor: Colors?.ok ?? "#34d399",
                }}
              />
              <Text
                style={{
                  color: Colors?.textPrimary ?? "#f9fafb",
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                Real-time screening active
              </Text>
            </View>
          </View>

          {/* 3 stat tiles */}
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <StatTile
              title="Suspicious calls\nfiltered"
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

          {/* Bottom banner inside the system card */}
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "rgba(148,163,184,0.20)",
              backgroundColor: "rgba(139,92,246,0.14)",
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text
              style={{
                flex: 1,
                color: Colors?.textPrimary ?? "#f9fafb",
                fontSize: 13,
                lineHeight: 18,
                fontWeight: "650",
              }}
            >
              SNAPI routing engine identifies callers, challenges unknown numbers,
              and passes only the real people through.
            </Text>

            <View style={{ gap: 8, alignItems: "flex-end" }}>
              <MiniPill label="SNAPIPro" />
              <MiniPill label="SNAPIBusiness" />
            </View>
          </View>
        </GlassCard>

        {/* ---------- ACTIONS (kept outside, same vibe) ---------- */}
        <View style={{ flex: 1 }} />

        <View style={{ gap: 12 }}>
          <PrimaryButton title="Get Protected" />
          <GhostButton title="I already have an account" />
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
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(148,163,184,0.22)",
        backgroundColor: "rgba(8,14,32,0.55)",
        padding: 12,
        minHeight: 86,
        justifyContent: "space-between",
      }}
    >
      <Text
        style={{
          color: "rgba(156,163,175,0.95)",
          fontSize: 12,
          lineHeight: 15,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>

      <View style={{ gap: 6 }}>
        <Text
          style={{
            color: "#f9fafb",
            fontSize: 18,
            fontWeight: "900",
            letterSpacing: 0.2,
          }}
        >
          {value}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {showDotOnFoot ? (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                backgroundColor: "#34d399",
              }}
            />
          ) : (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                backgroundColor: "#34d399",
              }}
            />
          )}

          <Text
            style={{
              color: "rgba(156,163,175,0.95)",
              fontSize: 11.5,
              fontWeight: "650",
            }}
          >
            {foot}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MiniPill({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(148,163,184,0.22)",
        backgroundColor: "rgba(8,14,32,0.45)",
      }}
    >
      <Text style={{ color: "#f9fafb", fontSize: 12, fontWeight: "900" }}>
        {label}
      </Text>
    </View>
  );
}
