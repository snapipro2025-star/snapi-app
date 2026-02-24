// src/screens/VoicemailPlayerScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Audio } from "expo-av";
import type { AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system";

import GlassBackground from "../components/GlassBackground";
import GlassCard from "../components/GlassCard";
import { Colors } from "../theme/colors";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { BASE_URL, apiFetch } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "VoicemailPlayer">;

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function pct(done: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((done / total) * 100)));
}

function pickErrMsg(e: any) {
  const msg = String(e?.message || e || "");
  return msg || "Playback error. Please try again.";
}

export default function VoicemailPlayerScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();

  // ---- FileSystem typing shim (fixes TS errors across Expo SDK variations) ----
  const FS: any = FileSystem as any;
  const fsOk = Boolean(FS?.cacheDirectory || FS?.documentDirectory);

  // Incoming params
  const rawUrl = safeStr((route?.params as any)?.url);

  const recordingSid =
    safeStr((route?.params as any)?.recordingSid) ||
    safeStr((route?.params as any)?.item?.voicemailRecordingSid) ||
    safeStr((route?.params as any)?.item?.recordingSid);

  const fallbackUrl =
    rawUrl ||
    safeStr((route?.params as any)?.item?.voicemailUrl) ||
    safeStr((route?.params as any)?.item?.recordingUrl) ||
    "";

  const hasRecordingSid = Boolean(recordingSid && recordingSid.startsWith("RE"));
  const hasAnySource = Boolean(hasRecordingSid || fallbackUrl);

  const soundRef = useRef<Audio.Sound | null>(null);
  const cacheUriRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const didAutoLoadRef = useRef(false);

  // download resumable reference (typed as any to avoid missing TS exports)
  const dlRef = useRef<any>(null);

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "resolving" | "downloading" | "loading" | "ready">("idle");
  const [downloadPct, setDownloadPct] = useState(0);
  const [downloadBytes, setDownloadBytes] = useState<{ written: number; expected: number }>({
    written: 0,
    expected: 0,
  });

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(0);
  const [errMsg, setErrMsg] = useState("");

  // Audio mode + mount guard
  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
      } catch {}
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onStatus = useCallback((st: AVPlaybackStatus) => {
    if (!st.isLoaded) {
      const e = (st as any)?.error ? String((st as any).error) : "";
      if (e) setErrMsg(e);
      setPlaying(false);
      return;
    }

    setReady(true);
    setPlaying(Boolean(st.isPlaying));
    setPosMs(Number(st.positionMillis || 0));
    setDurMs(Number(st.durationMillis || 0));
  }, []);

  const unload = useCallback(async () => {
    try {
      const s = soundRef.current;
      soundRef.current = null;
      if (s) await s.unloadAsync();
    } catch {
      // ignore
    } finally {
      setReady(false);
      setPlaying(false);
      setPosMs(0);
      setDurMs(0);
    }
  }, []);

  const cancelDownload = useCallback(async () => {
    try {
      const dl = dlRef.current;
      dlRef.current = null;
      if (dl?.pauseAsync) await dl.pauseAsync().catch(() => {});
    } catch {}
  }, []);

  const cleanupCacheFile = useCallback(async () => {
    const uri = cacheUriRef.current;
    cacheUriRef.current = null;

    try {
      if (uri && fsOk && FS?.deleteAsync) {
        await FS.deleteAsync(uri, { idempotent: true });
      }
    } catch {}
  }, [FS, fsOk]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelDownload();
      unload();
      cleanupCacheFile();
    };
  }, [cancelDownload, unload, cleanupCacheFile]);

  /**
   * Resolve a player-friendly URL:
   * - Preferred: mint short-lived open URL from server using recordingSid (RE...)
   * - Fallback: use raw/twilio url only if recordingSid missing
   */
  const resolvePlaybackUrl = useCallback(async (): Promise<string> => {
    setPhase("resolving");

    if (hasRecordingSid) {
      const r = await apiFetch(`/app/api/audio-open-url/${encodeURIComponent(recordingSid)}`);
      if (!r?.ok || !r?.url) throw new Error(r?.error || "Failed to get voicemail link");
      const u = String(r.url);
      return u.startsWith("http") ? u : `${BASE_URL}${u}`;
    }

    if (fallbackUrl) return fallbackUrl;

    throw new Error("No voicemail available.");
  }, [fallbackUrl, hasRecordingSid, recordingSid]);

  /**
   * Download to local cache ALWAYS (when FS is available).
   * Then validate we didn't download HTML/JSON/401 pages.
   */
  const downloadToCacheStrict = useCallback(
    async (url: string): Promise<string> => {
      if (!fsOk) throw new Error("FileSystem unavailable on this build.");

      const base = String(FS?.cacheDirectory || FS?.documentDirectory || "");
      if (!base) throw new Error("Cache directory unavailable.");

      const safeId = recordingSid ? recordingSid.replace(/[^a-zA-Z0-9_\-]/g, "") : String(Date.now());

      // Try to preserve extension if present (twilio sometimes uses .mp3 or .wav)
      const extMatch = url.split("?")[0].match(/\.(mp3|m4a|aac|wav)$/i);
      const ext = (extMatch?.[1] || "mp3").toLowerCase();

      const filename = `snapi_vm_${safeId}.${ext}`;
      const dest = base + filename;

      // reset progress UI
      setPhase("downloading");
      setDownloadPct(0);
      setDownloadBytes({ written: 0, expected: 0 });

      // Ensure old file removed
      try {
        if (FS?.deleteAsync) await FS.deleteAsync(dest, { idempotent: true }).catch(() => {});
      } catch {}
      cacheUriRef.current = dest;

      const onProgress = (p: any) => {
        if (!mountedRef.current) return;
        const written = Number(p?.totalBytesWritten || 0);
        const expected = Number(p?.totalBytesExpectedToWrite || 0);
        setDownloadBytes({ written, expected });
        setDownloadPct(pct(written, expected));
      };

      if (!FS?.createDownloadResumable) throw new Error("Download API unavailable.");

      const dl = FS.createDownloadResumable(url, dest, {}, onProgress);
      dlRef.current = dl;

      let result: any = null;
      try {
        result = await dl.downloadAsync();
      } finally {
        dlRef.current = null;
      }

      const downloadedUri = result?.uri ? String(result.uri) : "";
      if (!downloadedUri) throw new Error("Download failed (no file).");

      const info = FS?.getInfoAsync ? await FS.getInfoAsync(downloadedUri, { size: true }) : null;
      const exists = Boolean(info?.exists);
      const size = Number((info as any)?.size || 0);

      // If it's tiny, it's almost certainly not audio (often HTML/JSON/error payload)
      if (!exists || size < 2000) {
        // Attempt to read a small text head for debugging (best-effort)
        let head = "";
        try {
          if (FS?.readAsStringAsync) {
            head = await FS.readAsStringAsync(downloadedUri, { encoding: FS.EncodingType.UTF8 });
            head = String(head || "").slice(0, 160);
          }
        } catch {}

        throw new Error(
          `Downloaded file is not valid audio (size=${size}).` + (head ? ` Head: ${head}` : "")
        );
      }

      return downloadedUri;
    },
    [FS, fsOk, recordingSid]
  );

  const loadIntoPlayer = useCallback(
    async (uri: string) => {
      setPhase("loading");

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, positionMillis: 0 },
        onStatus
      );

      soundRef.current = sound;

      const st = await sound.getStatusAsync();
      onStatus(st as any);

      setPhase("ready");
    },
    [onStatus]
  );

  const load = useCallback(async () => {
    if (busy) return;

    if (!hasAnySource) {
      Alert.alert("No voicemail", "This call does not have a voicemail recording.");
      return;
    }

    setErrMsg("");
    setBusy(true);

    try {
      await cancelDownload();
      await unload();
      await cleanupCacheFile();

      const url = await resolvePlaybackUrl();
      if (!mountedRef.current) return;

      // ✅ Always download then play local (prevents garbled streaming)
      const localUri = await downloadToCacheStrict(url);
      if (!mountedRef.current) return;

      await loadIntoPlayer(localUri);
    } catch (e: any) {
      const msg = pickErrMsg(e);
      setErrMsg(msg);
      Alert.alert("Playback error", msg);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    cancelDownload,
    cleanupCacheFile,
    downloadToCacheStrict,
    hasAnySource,
    loadIntoPlayer,
    resolvePlaybackUrl,
    unload,
  ]);

  // Auto-load once
  useEffect(() => {
    if (!hasAnySource) return;
    if (didAutoLoadRef.current) return;
    didAutoLoadRef.current = true;

    const t = setTimeout(() => {
      load().catch(() => {});
    }, 150);

    return () => clearTimeout(t);
  }, [hasAnySource, load]);

  const togglePlay = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;

    try {
      const st = await s.getStatusAsync();
      if (!st.isLoaded) return;
      if (st.isPlaying) await s.pauseAsync();
      else await s.playAsync();
    } catch {
      Alert.alert("Could not play", "Try again.");
    }
  }, []);

  const seekBy = useCallback(async (deltaMs: number) => {
    const s = soundRef.current;
    if (!s) return;

    try {
      const st = await s.getStatusAsync();
      if (!st.isLoaded) return;

      const cur = Number(st.positionMillis || 0);
      const dur = Number(st.durationMillis || 0);
      const next = Math.max(0, Math.min(dur || Number.MAX_SAFE_INTEGER, cur + deltaMs));
      await s.setPositionAsync(next);
    } catch {}
  }, []);

  const timeLeft = useMemo(() => Math.max(0, (durMs || 0) - (posMs || 0)), [durMs, posMs]);
  const canControl = ready && !busy;

  const mainLabel = useMemo(() => {
    if (!hasAnySource) return "N/A";
    if (!ready) return busy ? "Loading…" : "Load";
    return playing ? "Pause" : "Play";
  }, [busy, hasAnySource, playing, ready]);

  const sourceText = useMemo(() => {
    if (hasRecordingSid) return `recordingSid: ${recordingSid}`;
    return fallbackUrl ? `url: ${fallbackUrl}` : "(none)";
  }, [fallbackUrl, hasRecordingSid, recordingSid]);

  const onPressInfo = useCallback(() => {
    const lines = [
      `Source: ${sourceText}`,
      `FS: ${fsOk ? "download" : "no-fs"}`,
      `Phase: ${phase}`,
      `DL: ${downloadPct}% (${downloadBytes.written}/${downloadBytes.expected || 0})`,
      errMsg ? `Error: ${errMsg}` : "",
    ].filter(Boolean);
    Alert.alert("Voicemail Info", lines.join("\n"));
  }, [downloadBytes.expected, downloadBytes.written, downloadPct, errMsg, fsOk, phase, sourceText]);

  return (
    <GlassBackground>
      <View style={[styles.safe, { paddingTop: Math.max(insets.top, 10), paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Voicemail</Text>

          <Pressable style={[styles.infoBtn, errMsg ? styles.infoBtnError : null]} hitSlop={10} onPress={onPressInfo}>
            <Text style={styles.infoBtnText}>{errMsg ? "!" : "i"}</Text>
          </Pressable>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.cardTopRow}>
            <Text style={styles.headerMini} numberOfLines={1}>
              Source: {sourceText}
            </Text>
          </View>

          <View style={styles.timeline}>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{msToClock(posMs)}</Text>
              <Text style={styles.timeText}>{msToClock(durMs)}</Text>
            </View>

            <View style={styles.scrubBar}>
              <View
                style={[
                  styles.scrubFill,
                  { width: durMs > 0 ? `${Math.min(100, (posMs / durMs) * 100)}%` : "0%" },
                ]}
              />
            </View>

            {busy ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>
                  {phase === "resolving"
                    ? "Preparing secure link…"
                    : phase === "downloading"
                    ? `Downloading… ${downloadPct}%`
                    : phase === "loading"
                    ? "Preparing audio…"
                    : "Loading…"}
                </Text>
              </View>
            ) : null}

            <View style={styles.controlsRow}>
              <Pressable
                onPress={() => seekBy(-15000)}
                disabled={!canControl}
                style={[styles.ctrlBtn, !canControl && styles.ctrlBtnDisabled]}
              >
                <Text style={styles.ctrlBtnText}>-15s</Text>
              </Pressable>

              <Pressable
                onPress={ready ? togglePlay : load}
                disabled={!hasAnySource || busy}
                style={[styles.mainBtn, (!hasAnySource || busy) && styles.ctrlBtnDisabled]}
              >
                <Text style={styles.mainBtnText}>{mainLabel}</Text>
              </Pressable>

              <Pressable
                onPress={() => seekBy(15000)}
                disabled={!canControl}
                style={[styles.ctrlBtn, !canControl && styles.ctrlBtnDisabled]}
              >
                <Text style={styles.ctrlBtnText}>+15s</Text>
              </Pressable>
            </View>

            {ready ? <Text style={styles.meta}>Remaining: {msToClock(timeLeft)}</Text> : null}

            {phase === "downloading" && downloadBytes.expected > 0 ? (
              <Text style={styles.meta}>
                {Math.floor(downloadBytes.written / 1024)} KB / {Math.floor(downloadBytes.expected / 1024)} KB
              </Text>
            ) : null}

            {errMsg ? (
              <View style={styles.errBox}>
                <Text style={styles.errTitle}>Playback error</Text>
                <Text style={styles.errText}>{errMsg}</Text>
              </View>
            ) : null}

            {hasRecordingSid ? (
              <Text style={styles.hint}>
                Secure playback is enabled. SNAPI mints a short-lived URL so voicemail plays reliably on all phones.
              </Text>
            ) : null}
          </View>
        </GlassCard>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16, gap: 10 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  headerTitle: { color: Colors.text, fontWeight: "900", fontSize: 16, letterSpacing: 0.2 },

  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  backBtnText: { color: Colors.text, fontWeight: "800", fontSize: 11, letterSpacing: 0.4 },

  infoBtn: {
    width: 52,
    height: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtnError: {
    borderColor: "rgba(255,72,72,0.35)",
    backgroundColor: "rgba(255,72,72,0.10)",
  },
  infoBtnText: { color: Colors.text, fontWeight: "900", fontSize: 12, marginTop: -1 },

  card: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, borderRadius: 18 },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerMini: { color: Colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },

  timeline: { marginTop: 4 },

  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { color: Colors.muted, fontWeight: "800", fontSize: 12 },

  scrubBar: {
    marginTop: 8,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  scrubFill: { height: "100%", backgroundColor: "rgba(0,229,255,0.35)" },

  loadingRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontWeight: "800", fontSize: 12 },

  controlsRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },

  ctrlBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnText: { color: Colors.text, fontWeight: "900", fontSize: 12, letterSpacing: 0.6 },

  mainBtn: {
    flex: 1.4,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.30)",
    backgroundColor: "rgba(0,229,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  mainBtnText: { color: Colors.text, fontWeight: "900", fontSize: 12, letterSpacing: 0.6 },

  ctrlBtnDisabled: { opacity: 0.6 },

  meta: { marginTop: 10, color: Colors.muted, fontWeight: "800", fontSize: 12 },

  errBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,72,72,0.25)",
    backgroundColor: "rgba(255,72,72,0.08)",
    padding: 12,
  },
  errTitle: { color: Colors.text, fontWeight: "900", fontSize: 12, marginBottom: 6 },
  errText: { color: Colors.text, fontWeight: "700", fontSize: 12, lineHeight: 16, opacity: 0.92 },

  hint: { marginTop: 10, color: Colors.muted, fontSize: 12, lineHeight: 16, fontWeight: "700" },
});
