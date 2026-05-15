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
}

export function FindMacScreen({ onBeforeConnect }: FindMacScreenProps) {
  const { services, scanning, rescan } = useDiscovery();
  const phase = useConnection((s) => s.phase);
  const connect = useConnection((s) => s.connect);
  const connecting = phase === "connecting" || phase === "reconnecting";
  const [pendingName, setPendingName] = useState<string | null>(null);

  const sortedServices = useMemo(
    () => services.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  const handleTap = async (service: (typeof sortedServices)[number]) => {
    if (connecting) return;
    const target: ConnectionTarget = {
      name: service.name,
      host: service.host,
      port: service.port,
    };
    setPendingName(service.name);
    if (onBeforeConnect) await onBeforeConnect(target);
    try {
      await AsyncStorage.setItem(LAST_HOST_KEY, JSON.stringify(target));
    } catch {}
    connect(target);
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
