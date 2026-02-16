export const Colors = {
  // =========================
  // Backgrounds
  // =========================
  bg: "#050816",
  bg2: "#02040a",

  // =========================
  // Primary text tokens
  // =========================
  text: "#f9fafb",
  muted: "#9ca3af",

  // ✅ Standard secondary text (used across SNAPI UI)
  subtext: "rgba(249,250,251,0.7)",

  // =========================
  // Aliases (legacy + compatibility)
  // =========================
  textPrimary: "#f9fafb", // same as text
  textMuted: "#9ca3af",   // same as muted
  subtle: "#cbd5e1",      // onboarding / secondary emphasis

  // =========================
  // Borders
  // =========================
  border: "rgba(148,163,184,.22)",

  // =========================
  // Accent / Status
  // =========================
  accent: "#00e5ff",
  accent2: "#8b5cf6",

  danger: "#f97373",
  warn: "#fbbf24",
  ok: "#34d399",

  // =========================
  // Glass surfaces (SNAPI style)
  // =========================
  glassTop: "rgba(10,16,32,.92)",
  glassBottom: "rgba(10,16,32,.72)",
  glassCard: "rgba(11,21,48,.35)",
  inputBg: "rgba(10,16,32,.85)",

  // =========================
  // Button gradients
  // =========================
  btnTop: "rgba(0,229,255,.12)",
  btnBottom: "rgba(0,229,255,.06)",
  btnTopHover: "rgba(0,229,255,.16)",
  btnBottomHover: "rgba(0,229,255,.08)",
} as const;
