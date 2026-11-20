import { useEffect } from "react";
import { Linking, Platform } from "react-native";
import { Stack, useRootNavigationState, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { ActivityIndicator, useTheme } from "react-native-paper";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppProvider, useApp } from "../state/AppProvider";
import { AudioProvider } from "../state/AudioProvider";
import { startForegroundChecks } from "../services/notifications";
import { supabase } from "../services/supabase";
import { APPS } from "../lib/catalog";
function RootShell() {
  const { ready, dark } = useApp(),
    theme = useTheme(),
    router = useRouter(),
    navigation = useRootNavigationState();
  useEffect(() => {
    if (ready && Platform.OS !== "web") return startForegroundChecks();
  }, [ready]);
  useEffect(() => {
    if (!ready || !navigation?.key || Platform.OS === "web") return;
    const open = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data ?? {};
      const app = APPS.find((a) => a.id === data.app);
      if (app)
        router.push({
          pathname: "/apps/[id]",
          params: {
            id: app.id,
            ...(typeof data.game === "string" ? { game: data.game } : {}),
            ...(typeof data.offer === "number"
              ? { offer: String(data.offer) }
              : {}),
          },
        });
    };
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          open(response);
          void Notifications.clearLastNotificationResponseAsync();
        }
      })
      .catch(() => {});
    return () => sub.remove();
  }, [ready, navigation?.key, router]);
  useEffect(() => {
    async function authLink(url: string | null | undefined) {
      if (!url || !url.startsWith("m8m8s-mobile://")) return;
      try {
        const parsed = new URL(url),
          params = new URLSearchParams(parsed.hash.slice(1));
        const code = parsed.searchParams.get("code");
        if (code) await supabase.auth.exchangeCodeForSession(code);
        else if (params.get("access_token") && params.get("refresh_token"))
          await supabase.auth.setSession({
            access_token: params.get("access_token")!,
            refresh_token: params.get("refresh_token")!,
          });
      } catch {
        /* Account screen offers a fresh sign-in if an expired link cannot be restored. */
      }
    }
    void Linking.getInitialURL().then(authLink);
    const sub = Linking.addEventListener("url", (e) => void authLink(e.url));
    return () => sub.remove();
  }, []);
  if (!ready)
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator accessibilityLabel="Loading saved data" />
      </SafeAreaView>
    );
  return (
    <AudioProvider>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.onSurface,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: "default",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="apps/[id]" />
        <Stack.Screen name="account" options={{ title: "Your account" }} />
        <Stack.Screen
          name="admin"
          options={{ title: "Announcements administration" }}
        />
      </Stack>
    </AudioProvider>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootShell />
      </AppProvider>
    </SafeAreaProvider>
  );
}

export { ErrorBoundary } from "expo-router";
