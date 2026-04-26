import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColorScheme } from "react-native";

import { Colors } from "@/constants/theme";

export default function TabsLayout() {
  const scheme = useColorScheme();
  const colors =
    Colors[scheme === "unspecified" ? "light" : (scheme ?? "light")];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Trackpad</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="computermouse" md="mouse" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dock" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Dock</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="dock.rectangle" md="dock" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
