import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import {
  C,
  F,
  Lede,
  ScreenBody,
  Spinner,
  Title,
} from "@/features/onboarding/atoms";
import { useDiscovery } from "@/net/discovery";
import { useConnection, type ConnectionTarget } from "@/state/connection";
import { Logo } from "@/components/Logo";

export const LAST_HOST_KEY = "entangle.lastHost";

export interface FindMacScreenProps {
  /**
   * Called when the user taps a Mac row, before the actual connection
   * starts. Use this from the onboarding wrapper to mark onboarding
   * complete (or other side effects). The screen will still save the
   * target to AsyncStorage and call `connect()` after this resolves.
   */
  onBeforeConnect?: (target: ConnectionTarget) => void | Promise<void>;
  /**
   * Optional handler for the "Try without a Mac" demo tile. When provided,
   * the tile is rendered below the Rescan row. Required for App Store
   * 4.2.3(i): the app must do something meaningful without the Mac
   * companion installed.
   */
  onTryDemo?: () => void;
}

export function FindMacScreen({ onBeforeConnect, onTryDemo }: FindMacScreenProps) {
  const { services, scanning, rescan } = useDiscovery();
  const phase = useConnection((s) => s.phase);
  const connect = useConnection((s) => s.connect);
  const disconnect = useConnection((s) => s.disconnect);
  const lastError = useConnection((s) => s.lastError);
  const connecting = phase === "connecting" || phase === "reconnecting";
  const [pendingName, setPendingName] = useState<string | null>(null);

  const sortedServices = useMemo(
    () => services.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  const handleTap = async (service: (typeof sortedServices)[number]) => {
    const target: ConnectionTarget = {
      name: service.name,
      host: service.host,
      port: service.port,
    };
    // An attempt already in flight must never make the list untappable:
    // tapping the pending row cancels it, tapping another switches to it.
    if (connecting) {
      disconnect();
      if (pendingName === service.name) {
        setPendingName(null);
        return;
      }
    }
    setPendingName(service.name);
    if (onBeforeConnect) await onBeforeConnect(target);
    connect(target);
    // Remembering the host is best-effort and must not gate the connect.
    AsyncStorage.setItem(LAST_HOST_KEY, JSON.stringify(target)).catch(
      () => undefined,
    );
  };

  return (
    <>
      {/* Minimal header — just the small orb logo. */}
      <View style={styles.header}>
        <Logo size={100} />
      </View>

      <ScreenBody style={{ paddingTop: 8 }}>
        <Title size={36}>Find your Mac.</Title>
        <View style={{ marginTop: 14 }}>
          <Lede>
            {`Make sure Entangle is running on your Mac and you’re on the same Wi‑Fi network.`}
          </Lede>
        </View>

        <View style={{ marginTop: 32, gap: 10 }}>
          {sortedServices.length === 0 && !scanning ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No Macs found yet.</Text>
            </View>
          ) : (
            sortedServices.map((service) => (
              <MacRow
                key={service.name}
                name={service.name}
                host={`${service.host}:${service.port}`}
                net="LAN"
                selected={pendingName === service.name && connecting}
                onPress={() => handleTap(service)}
              />
            ))
          )}
        </View>

        {connecting ? (
          <Text style={styles.status}>
            {phase === "reconnecting"
              ? "Still trying — tap the Mac again to cancel."
              : "Connecting — tap the Mac again to cancel."}
          </Text>
        ) : lastError ? (
          <Text style={styles.error}>{lastError}</Text>
        ) : null}

        <Pressable
          onPress={rescan}
          hitSlop={8}
          style={styles.rescanRow}
          disabled={scanning}
        >
          {scanning && <Spinner size={12} />}
          <Text style={styles.rescanText}>
            {scanning ? "Scanning" : "Rescan"}
          </Text>
        </Pressable>

        {onTryDemo ? (
          <>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
            <Pressable
              onPress={onTryDemo}
              accessibilityLabel="Try without a Mac"
              style={styles.demoTile}
            >
              <View style={styles.demoIconBox}>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path
                    d="M14 4l4 4-9 9H5v-4z"
                    stroke={C.accent}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <Path
                    d="M13 5l4 4"
                    stroke={C.accent}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.demoTitle}>Try without a Mac</Text>
                <Text style={styles.demoSubtitle}>
                  Explore the app in demo mode
                </Text>
              </View>
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path
                  d="M9 6l6 6-6 6"
                  stroke={C.muted}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </Pressable>
          </>
        ) : null}

        <View style={{ flex: 1 }} />

        <View style={styles.tip}>
          <Svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            style={{ marginTop: 2 }}
          >
            <Circle
              cx={12}
              cy={12}
              r={10}
              stroke={C.muted}
              strokeWidth={2}
              fill="none"
            />
            <Path
              d="M12 8v4M12 16h.01"
              stroke={C.muted}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.tipText}>
            {`Not seeing your Mac? Make sure the desktop app is running and you’re on the same Wi‑Fi.`}
          </Text>
        </View>
      </ScreenBody>
    </>
  );
}

function MacRow({
  name,
  host,
  net,
  selected,
  onPress,
}: {
  name: string;
  host: string;
  net?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        rowStyles.row,
        {
          backgroundColor: selected ? C.accentSoft : C.bg2,
          borderColor: selected ? C.accent : C.border,
        },
      ]}
    >
      <View style={rowStyles.iconBox}>
        <Svg width={20} height={16} viewBox="0 0 24 18">
          <Path
            d="M2 2h20v13H2zM9 18h6M12 15v3"
            stroke={C.accent}
            strokeWidth={1.5}
            fill="none"
          />
        </Svg>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={rowStyles.host}>
          {host}
          {net ? ` · ${net}` : ""}
        </Text>
      </View>
      {selected ? (
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Circle
            cx={11}
            cy={11}
            r={10}
            fill="rgba(163,187,214,0.18)"
            stroke={C.accent}
            strokeWidth={1.2}
          />
          <Path
            d="M 6 11 L 9.5 14.5 L 15.5 7.5"
            stroke={C.accent}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 6,
    marginBottom: -32,
  },
  empty: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  emptyText: {
    color: C.muted,
    fontSize: 13,
  },
  status: {
    marginTop: 12,
    color: C.muted,
    fontSize: 12,
    fontFamily: F.body,
  },
  error: {
    marginTop: 12,
    color: "#ff453a",
    fontSize: 12,
    fontFamily: F.body,
  },
  rescanRow: {
    alignSelf: "flex-start",
    marginTop: 18,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rescanText: {
    color: C.muted,
    fontSize: 11,
    fontFamily: F.mono,
    fontWeight: "500",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  tip: {
    padding: 14,
    backgroundColor: "rgba(163,187,214,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  tipText: {
    flex: 1,
    color: C.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: F.body,
  },
  orRow: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  orText: {
    color: C.dim,
    fontSize: 10,
    fontFamily: F.mono,
    fontWeight: "500",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  demoTile: {
    marginTop: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: "rgba(163,187,214,0.06)",
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderStyle: "dashed",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  demoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(163,187,214,0.10)",
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  demoTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: F.body,
  },
  demoSubtitle: {
    color: C.muted,
    fontSize: 12,
    fontFamily: F.body,
    marginTop: 2,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(163,187,214,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: C.text,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: F.body,
  },
  host: {
    color: C.muted,
    fontSize: 12,
    fontFamily: F.mono,
    marginTop: 3,
  },
});
