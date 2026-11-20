import { useState, type ReactNode } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Banner,
  Button,
  Card,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useApp } from "../state/AppProvider";
export { spacing } from "../theme/tokens";
export const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
  },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  card: { padding: 16, gap: 12 },
  grow: { flex: 1 },
  field: { marginBottom: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  muted: { opacity: 0.8 },
  center: { padding: 32, alignItems: "center", gap: 12 },
});
export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme(),
    app = useApp();
  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <KeyboardAvoidingView
        keyboardVerticalOffset={80}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {!!app.offline && (
          <Banner visible icon="wifi-off">
            Offline. Saved data is available; shared updates need a connection.
          </Banner>
        )}
        {!!app.error && (
          <Banner
            visible
            actions={[{ label: "Dismiss", onPress: app.dismissError }]}
          >
            {app.error}
          </Banner>
        )}
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, style]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, style]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Panel({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <Card mode="contained">
      <View style={styles.card}>
        {!!title && <Text variant="titleMedium">{title}</Text>}
        {children}
      </View>
    </Card>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Text variant="titleMedium">{title}</Text>
      <Text style={{ textAlign: "center" }}>{detail}</Text>
      {action}
    </View>
  );
}
export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator accessibilityLabel="Loading" />
      <Text>Loading…</Text>
    </View>
  );
}
export function Feedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  const theme = useTheme();
  return error || message ? (
    <Text
      accessibilityLiveRegion="polite"
      style={{ color: error ? theme.colors.error : theme.colors.onSurface }}
    >
      {error || message}
    </Text>
  ) : null;
}
export function RemoteStatus({
  loading,
  error,
  cached,
  refresh,
}: {
  loading: boolean;
  error: string;
  cached?: boolean;
  refresh: () => unknown;
}) {
  return (
    <>
      {!!loading && <Loading />}
      {!!cached && <Text>Showing saved data. It may be out of date.</Text>}
      {!!error && (
        <Panel>
          <Feedback error={error} />
          <Button onPress={() => void refresh()}>Retry</Button>
        </Panel>
      )}
    </>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  secureTextEntry = false,
  maxLength,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  multiline?: boolean;
  secureTextEntry?: boolean;
  maxLength?: number;
  keyboardType?: "email-address" | "url" | "numeric" | "default";
}) {
  return (
    <TextInput
      mode="outlined"
      label={label}
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      secureTextEntry={secureTextEntry}
      maxLength={maxLength}
      keyboardType={keyboardType}
      autoCapitalize={
        keyboardType === "email-address" || keyboardType === "url"
          ? "none"
          : "sentences"
      }
      style={styles.field}
    />
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run<T>(action: () => Promise<T>, success?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (success) setMessage(success);
      return result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "This action could not be completed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, message, run, setMessage };
}
export function confirm(title: string, message: string) {
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
