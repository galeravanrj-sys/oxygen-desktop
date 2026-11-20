import { Stack, useLocalSearchParams } from "expo-router";
import { APPS, type AppId } from "../../lib/catalog";
import { Empty, Screen } from "../../components/ui";
import {
  NotesScreen,
  TasksScreen,
  CalendarScreen,
  CalculatorScreen,
  PassportScreen,
} from "../../screens/PersonalScreens";
import {
  GalleryScreen,
  CameraScreen,
  FilesScreen,
  MusicScreen,
  BrowserScreen,
} from "../../screens/MediaScreens";
import {
  WeatherScreen,
  FreeGamesScreen,
  TierListScreen,
} from "../../screens/DiscoveryScreens";
import { ChatScreen } from "../../screens/CommunityScreens";
import {
  AppearanceScreen,
  BriefingScreen,
  NotificationsScreen,
  SettingsScreen,
  WidgetsScreen,
} from "../../screens/DashboardScreens";
const screens: Record<AppId, React.ComponentType> = {
  notes: NotesScreen,
  tasks: TasksScreen,
  calendar: CalendarScreen,
  calculator: CalculatorScreen,
  passport: PassportScreen,
  gallery: GalleryScreen,
  camera: CameraScreen,
  files: FilesScreen,
  music: MusicScreen,
  browser: BrowserScreen,
  weather: WeatherScreen,
  "free-games": FreeGamesScreen,
  tiers: TierListScreen,
  chat: ChatScreen,
  appearance: AppearanceScreen,
  briefing: BriefingScreen,
  notifications: NotificationsScreen,
  settings: SettingsScreen,
  widgets: WidgetsScreen,
};
export default function AppScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = APPS.find((a) => a.id === id);
  if (!app)
    return (
      <Screen>
        <Empty
          title="App not found"
          detail="Go back to the launcher and choose an app."
        />
      </Screen>
    );
  const Component = screens[app.id];
  return (
    <>
      <Stack.Screen options={{ title: app.name }} />
      <Component key={app.id} />
    </>
  );
}
