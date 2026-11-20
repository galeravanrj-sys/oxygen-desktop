import { Tabs } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitle: "M8M8S",
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(8, insets.bottom),
        },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="home-outline"
              color={typeof color === "string" ? color : undefined}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="apps"
        options={{
          title: "Apps",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="view-grid-outline"
              color={typeof color === "string" ? color : undefined}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: "Games",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="controller-classic-outline"
              color={typeof color === "string" ? color : undefined}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: "You",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="account-outline"
              color={typeof color === "string" ? color : undefined}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
