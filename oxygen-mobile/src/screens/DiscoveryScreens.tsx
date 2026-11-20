import { useState } from "react";
import { FlatList, View } from "react-native";
import { Button, Card, Chip, Text } from "react-native-paper";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Empty,
  Feedback,
  Field,
  Panel,
  RemoteStatus,
  Screen,
  styles,
  useAction,
} from "../components/ui";
import { useApp } from "../state/AppProvider";
import { useRemote } from "../hooks/useRemote";
import {
  condition,
  getForecast,
  getOffers,
  getTier,
  searchCities,
} from "../services/api";
import { id } from "../services/files";
import { TIER_GAMES } from "../lib/catalog";
import { compareRankings } from "../lib/tierComparison";
import type { City, TierRow } from "../types/models";

export function WeatherScreen() {
  const { data, update } = useApp();
  const city = data.settings.city;
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<City[]>([]);
  const action = useAction();
  const weather = useRemote("weather:" + city?.id, async () => {
    if (!city) throw new Error("Choose a city.");
    return getForecast(city);
  });
  return (
    <Screen>
      <Panel title="Find your city">
        <Field label="City" value={query} onChangeText={setQuery} />
        <Button
          mode="contained"
          loading={action.busy}
          disabled={action.busy || query.trim().length < 2}
          onPress={() =>
            void action.run(async () => {
              const cities = await searchCities(query);
              setResults(cities);
              if (!cities.length)
                action.setMessage("No cities found. Try another spelling.");
            })
          }
        >
          Search cities
        </Button>
        {results.map((c) => (
          <Button
            key={c.id}
            onPress={() => {
              update("settings", (s) => ({ ...s, city: c }));
              setResults([]);
            }}
          >
            {c.name}
            {c.admin1 ? ", " + c.admin1 : ""}
            {c.country ? ", " + c.country : ""}
          </Button>
        ))}
        <Feedback {...action} />
      </Panel>
      {city ? (
        <>
          <Text variant="headlineMedium">{city.name}</Text>
          <RemoteStatus {...weather} />
          {!!weather.data && (
            <>
              <Panel>
                <Text variant="displayMedium">
                  {Math.round(weather.data.current.temperature_2m)}°C
                </Text>
                <Text variant="titleMedium">
                  {condition(weather.data.current.weather_code)}
                </Text>
                <Text>
                  Feels like{" "}
                  {Math.round(weather.data.current.apparent_temperature)}°C
                </Text>
                <Text>
                  Humidity {weather.data.current.relative_humidity_2m}% · Wind{" "}
                  {weather.data.current.wind_speed_10m} km/h
                </Text>
                <Text>Forecast time zone: {weather.data.timezone}</Text>
              </Panel>
              <Panel title="The week ahead">
                {weather.data.daily.time.map((day, i) => (
                  <View key={day} style={styles.row}>
                    <Text style={styles.grow}>
                      {new Date(day + "T12:00:00").toLocaleDateString(
                        undefined,
                        { weekday: "short", month: "short", day: "numeric" },
                      )}
                    </Text>
                    <Text>
                      {Math.round(weather.data!.daily.temperature_2m_min[i])}° /{" "}
                      {Math.round(weather.data!.daily.temperature_2m_max[i])}°
                    </Text>
                    <Text>
                      {weather.data!.daily.precipitation_probability_max[i]}%
                      rain
                    </Text>
                  </View>
                ))}
              </Panel>
            </>
          )}
        </>
      ) : (
        <Empty
          title="A look outside"
          detail="Choose a city to see its current weather and seven-day forecast."
        />
      )}
      <Text>
        Weather and city search by Open-Meteo. Forecast dates follow the
        selected city.
      </Text>
    </Screen>
  );
}

export function FreeGamesScreen() {
  const { data, update } = useApp(),
    params = useLocalSearchParams<{ offer?: string }>();
  const offers = useRemote("free-games", getOffers, 300000),
    action = useAction();
  const [query, setQuery] = useState(""),
    [store, setStore] = useState("all");
  const patterns: Record<string, RegExp> = {
    Steam: /Steam/i,
    "Epic Games": /Epic Games Store/i,
    GOG: /GOG/i,
    "itch.io": /Itch\.io/i,
  };
  const visible = (offers.data || [])
    .filter(
      (o) =>
        (store === "all" || patterns[store].test(o.platforms)) &&
        (o.title + " " + o.description)
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.id === Number(params.offer)) -
        Number(a.id === Number(params.offer)),
    );
  return (
    <Screen scroll={false}>
      <FlatList
        data={visible}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <Field
              label="Search giveaways"
              value={query}
              onChangeText={setQuery}
            />
            <View style={styles.row}>
              {["all", ...Object.keys(patterns)].map((s) => (
                <Chip
                  key={s}
                  selected={store === s}
                  onPress={() => setStore(s)}
                >
                  {s}
                </Chip>
              ))}
            </View>
            <RemoteStatus {...offers} />
            <Feedback {...action} />
            <Text>
              GamerPower full-game giveaways. Verify deadlines, regions and
              claim requirements on the offer page.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card
            mode={item.id === Number(params.offer) ? "outlined" : "contained"}
          >
            <View style={styles.card}>
              {!!item.image?.startsWith("https://") && (
                <Image
                  source={{ uri: item.image }}
                  style={{ width: "100%", aspectRatio: 2.1, borderRadius: 16 }}
                  contentFit="cover"
                />
              )}
              <Text variant="titleLarge">{item.title}</Text>
              <Text>{item.platforms}</Text>
              <Text>{item.description}</Text>
              <Text>
                Source deadline: {item.end_date || "Check offer page"}
              </Text>
              <View style={styles.row}>
                <Button
                  mode="contained"
                  onPress={() =>
                    void action.run(() =>
                      WebBrowser.openBrowserAsync(item.gamerpower_url),
                    )
                  }
                >
                  View offer
                </Button>
                <Button
                  disabled={data.games.some(
                    (g) => g.title.toLowerCase() === item.title.toLowerCase(),
                  )}
                  onPress={() => {
                    const platform =
                      Object.entries(patterns).find(([, pattern]) =>
                        pattern.test(item.platforms),
                      )?.[0] || "Other";
                    update("games", (old) => [
                      {
                        id: id(),
                        title: item.title.slice(0, 180),
                        platform,
                        status: "wishlist",
                        notes:
                          "Saved from Free Games. Saving does not claim or purchase this game.",
                        rating: 0,
                        addedAt: new Date().toISOString(),
                      },
                      ...old,
                    ]);
                    action.setMessage(
                      "Added to your Gaming Passport wishlist. Open the offer to claim it.",
                    );
                  }}
                >
                  Save to wishlist
                </Button>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          !offers.loading ? (
            <Empty
              title="No matching giveaways"
              detail="Try another store or search. A store may have no active full-game offers."
            />
          ) : undefined
        }
      />
    </Screen>
  );
}

export function TierListScreen() {
  const params = useLocalSearchParams<{ game?: string }>();
  const [game, setGame] = useState(
      TIER_GAMES.some((g) => g.id === params.game) ? params.game! : "zzz",
    ),
    [category, setCategory] = useState(""),
    [query, setQuery] = useState(""),
    [grandCross, setGrandCross] = useState("general"),
    [changesFilter, setChangesFilter] = useState("all");
  const request =
    game === "grandcross" && grandCross === "lr" ? "grandcross-lr" : game;
  const remote = useRemote("tiers:" + request, () => getTier(request));
  const action = useAction(),
    payload = remote.data;
  const groups = payload?.modes
    ? Object.fromEntries(payload.modes.map((m) => [m.id, m.tiers]))
    : payload?.grids && Object.keys(payload.grids).length
      ? payload.grids
      : { overall: payload?.tiers || [] };
  const group = Object.hasOwn(groups, category)
    ? category
    : Object.keys(groups)[0];
  const rows: TierRow[] = groups[group] || [];
  const changes = payload?.previous
    ? compareRankings(payload.previous, payload)
    : [];
  return (
    <Screen scroll={false}>
      <FlatList
        data={rows}
        keyExtractor={(row, i) => row.tier + ":" + i}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <View style={styles.row}>
              {TIER_GAMES.map((g) => (
                <Chip
                  key={g.id}
                  selected={game === g.id}
                  onPress={() => {
                    setGame(g.id);
                    setCategory("");
                    setQuery("");
                  }}
                >
                  {g.name}
                </Chip>
              ))}
            </View>
            {!!(game === "grandcross") && (
              <View style={styles.row}>
                {["general", "lr"].map((c) => (
                  <Chip
                    key={c}
                    selected={grandCross === c}
                    onPress={() => {
                      setGrandCross(c);
                      setCategory("");
                    }}
                  >
                    {c === "lr" ? "LR heroes" : "General"}
                  </Chip>
                ))}
              </View>
            )}
            <RemoteStatus {...remote} />
            <Feedback {...action} />
            {!!payload && (
              <>
                <Text variant="headlineSmall">
                  {TIER_GAMES.find((g) => g.id === game)?.name}
                </Text>
                <Text>
                  {payload.modes || request === "grandcross-lr"
                    ? "Bundled source snapshot"
                    : "Shared website ranking cache"}{" "}
                  ·{" "}
                  {payload.stale || payload.cache_status === "stale"
                    ? "Source is stale"
                    : payload.updated_at ||
                      payload.imported_at ||
                      "See source for update time"}
                </Text>
                {!!payload.source && (
                  <Button
                    onPress={() =>
                      void action.run(() =>
                        WebBrowser.openBrowserAsync(payload.source!),
                      )
                    }
                  >
                    Open ranking source
                  </Button>
                )}
                <View style={styles.row}>
                  {Object.keys(groups).map((key) => (
                    <Chip
                      key={key}
                      selected={group === key}
                      onPress={() => setCategory(key)}
                    >
                      {payload.modes?.find((m) => m.id === key)?.label ||
                        key.replace(/([A-Z])/g, " $1")}
                    </Chip>
                  ))}
                </View>
                <Field
                  label="Find a character"
                  value={query}
                  onChangeText={setQuery}
                />
              </>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const roles = item.roles || { characters: item.characters || [] };
          return (
            <Panel title={item.tier}>
              {Object.entries(roles).map(([role, characters]) => (
                <View key={role} style={{ gap: 12 }}>
                  {!!(role !== "characters") && (
                    <Text variant="titleSmall">
                      {role.replace(/([A-Z])/g, " $1")}
                    </Text>
                  )}
                  <View style={styles.wrap}>
                    {characters
                      .filter((c) =>
                        c.name.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((c, i) => (
                        <View key={c.name + i} style={{ width: 88, gap: 4 }}>
                          {!!(c.image && /^https:\/\//.test(c.image)) && (
                            <Image
                              source={{ uri: c.image }}
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 12,
                              }}
                              contentFit="cover"
                            />
                          )}
                          <Text variant="labelMedium">{c.name}</Text>
                          {!!c.subtitle && (
                            <Text variant="bodySmall">{c.subtitle}</Text>
                          )}
                        </View>
                      ))}
                  </View>
                </View>
              ))}
            </Panel>
          );
        }}
        ListFooterComponent={
          payload ? (
            <Panel title="What changed?">
              <Text>
                {payload.previous
                  ? `${changes.length} changes since ${payload.previous_updated_at || "the previous ranking"}`
                  : "History begins after the next successful ranking change. Bundled snapshots do not include live history."}
              </Text>
              {!!payload.previous && (
                <>
                  <View style={styles.row}>
                    {["all", "up", "down", "added", "removed", "changed"].map(
                      (f) => (
                        <Chip
                          key={f}
                          selected={changesFilter === f}
                          onPress={() => setChangesFilter(f)}
                        >
                          {f}
                        </Chip>
                      ),
                    )}
                  </View>
                  {changes
                    .filter(
                      (c) =>
                        changesFilter === "all" ||
                        c.direction === changesFilter,
                    )
                    .map((c) => (
                      <View key={c.context + ":" + c.name}>
                        <Text>
                          {c.name}: {c.from || "New"} → {c.to || "Removed"}
                        </Text>
                        <Text variant="bodySmall">
                          {c.context} · {c.direction}
                        </Text>
                      </View>
                    ))}
                </>
              )}
            </Panel>
          ) : undefined
        }
      />
    </Screen>
  );
}
