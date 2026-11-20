import { Link, Stack } from "expo-router";
import { Empty, Screen } from "../components/ui";
export default function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Not found" }} />
      <Empty
        title="This page is not available"
        detail="Your apps and saved data are still here."
        action={<Link href="/">Back to Home</Link>}
      />
    </Screen>
  );
}
