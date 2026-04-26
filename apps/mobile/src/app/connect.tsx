import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, router } from "@/lib/router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDiscovery } from "@/net/discovery";
import { hasUserDisconnected, useConnection } from "@/state/connection";
import type { ConnectionTarget } from "@/state/connection";

const LAST_HOST_KEY = "entangle.lastHost";

export default function ConnectScreen() {
  const { services, scanning, rescan } = useDiscovery();
  const connect = useConnection((s) => s.connect);
  const phase = useConnection((s) => s.phase);

  useEffect(() => {
    if (phase === "open") {
      router.replace("/(tabs)");
    }
  }, [phase]);

  useEffect(() => {
    if (hasUserDisconnected()) return;
    AsyncStorage.getItem(LAST_HOST_KEY).then((raw) => {
      if (!raw || hasUserDisconnected()) return;
      try {
        const target = JSON.parse(raw) as ConnectionTarget;
        connect(target);
      } catch {}
    });
  }, [connect]);

  const handleSelect = async (target: ConnectionTarget) => {
    await AsyncStorage.setItem(LAST_HOST_KEY, JSON.stringify(target));
    connect(target);
  };

  console.log("scanning", scanning);
  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ title: "Connect" }} />
      <Text style={styles.title}>Find your Mac</Text>
      <Text style={styles.subtitle}>
        Make sure Entangle is running on your Mac and you&apos;re on the same
        Wi-Fi network.
      </Text>

      <View style={styles.listCard}>
        {services.length === 0 ? (
          <View style={styles.empty}>
            {scanning ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.emptyText}>No Macs found yet.</Text>
            )}
          </View>
        ) : (
          services.map((service) => (
            <Pressable
              key={service.name}
              style={styles.row}
              onPress={() =>
                handleSelect({
                  name: service.name,
                  host: service.host,
                  port: service.port,
                })
              }
            >
              <View>
                <Text style={styles.rowName}>{service.name}</Text>
                <Text style={styles.rowHost}>
                  {service.host}:{service.port}
                </Text>
              </View>
              <Text style={styles.rowCta}>Connect</Text>
            </Pressable>
          ))
        )}
      </View>

      <Pressable style={styles.rescan} onPress={rescan}>
        <Text style={styles.rescanText}>
          {scanning ? "Scanning…" : "Scan again"}
        </Text>
      </Pressable>

      <Text style={styles.statusLine}>
        {phase === "connecting" && "Connecting…"}
        {phase === "reconnecting" && "Reconnecting…"}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    backgroundColor: "#000",
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 12,
  },
  subtitle: {
    color: "#8e8e93",
    fontSize: 15,
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  listCard: {
    backgroundColor: "#1c1c1e",
    borderRadius: 12,
    overflow: "hidden",
  },
  empty: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#8e8e93",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomColor: "#2c2c2e",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rowHost: {
    color: "#8e8e93",
    fontSize: 13,
    marginTop: 2,
  },
  rowCta: {
    color: "#0a84ff",
    fontSize: 15,
    fontWeight: "600",
  },
  rescan: {
    marginTop: 16,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  rescanText: {
    color: "#0a84ff",
    fontSize: 15,
  },
  statusLine: {
    color: "#8e8e93",
    textAlign: "center",
    marginTop: 24,
  },
});
