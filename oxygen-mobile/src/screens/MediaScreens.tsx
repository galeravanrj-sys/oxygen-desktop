import type { LocalPhoto, FileEntry } from "../types/models";
import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Button,
  Card,
  Chip,
  IconButton,
  List,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as MediaLibrary from "expo-media-library";
import * as WebBrowser from "expo-web-browser";
import { File } from "expo-file-system";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Empty,
  Feedback,
  Field,
  Panel,
  RemoteStatus,
  Screen,
  confirm,
  styles,
  useAction,
} from "../components/ui";
import { useApp } from "../state/AppProvider";
import { useMusic } from "../state/AudioProvider";
import { useRemote } from "../hooks/useRemote";
import {
  GALLERY_TOPIC,
  backendConfigured,
  supabase,
} from "../services/supabase";
import {
  publishPhoto,
  publicPhotos,
  removePublicPhoto,
} from "../services/gallery";
import {
  deleteManagedFile,
  downloadAndShare,
  id,
  persistFile,
  saveLocalPhoto,
  shareFile,
} from "../services/files";
import { browserAddress } from "../lib/dataValidation";

type ViewPhoto = { key: string; name: string; uri: string; local: boolean };
export function GalleryScreen() {
  const { data, update } = useApp(),
    action = useAction(),
    router = useRouter(),
    theme = useTheme();
  const remote = useRemote("public-gallery", publicPhotos, 10000);
  const refreshGallery = remote.refresh;
  const [collection, setCollection] = useState("all"),
    [viewer, setViewer] = useState<string | null>(null),
    [slideshow, setSlideshow] = useState(false);
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 5 : 3;
  const photos = useMemo<ViewPhoto[]>(
    () => [
      ...(collection === "public"
        ? []
        : data.photos.map((p) => ({
            key: p.id,
            name: p.name,
            uri: p.uri,
            local: true,
          }))),
      ...(collection === "local"
        ? []
        : (remote.data || []).map((p) => ({
            key: p.name,
            name: p.name,
            uri: p.url,
            local: false,
          }))),
    ],
    [collection, data.photos, remote.data],
  );
  const index = photos.findIndex((p) => p.key === viewer),
    photo = photos[index];
  const step = useCallback(
    (direction: number) => {
      if (photos.length)
        setViewer(
          photos[
            (Math.max(0, index) + direction + photos.length) % photos.length
          ].key,
        );
    },
    [index, photos],
  );
  useEffect(() => {
    if (!slideshow || !photo) return;
    const timer = setInterval(() => step(1), 4000);
    return () => clearInterval(timer);
  }, [slideshow, photo, step]);
  useEffect(() => {
    if (!backendConfigured) return;
    const channel = supabase
      .channel(GALLERY_TOPIC)
      .on("broadcast", { event: "changed" }, () => void refreshGallery())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshGallery]);
  const swipe = PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) =>
      Math.abs(g.dx) > 30 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_e, g) => {
      if (Math.abs(g.dx) > 50) step(g.dx < 0 ? 1 : -1);
    },
  });
  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 20,
    });
    if (result.canceled) return;
    const saved: LocalPhoto[] = [];
    for (const asset of result.assets)
      saved.push(
        await saveLocalPhoto(
          asset.uri,
          asset.fileName || "Photo.jpg",
          asset.width,
        ),
      );
    update("photos", (old) => [...saved, ...old]);
  }
  return (
    <Screen scroll={false}>
      <View style={[styles.content, { paddingBottom: 0 }]}>
        <View style={styles.row}>
          <Button
            mode="contained"
            icon="image-plus"
            loading={action.busy}
            disabled={action.busy}
            onPress={() => void action.run(pick)}
          >
            Add photos
          </Button>
          <Button icon="camera" onPress={() => router.push("/apps/camera")}>
            Camera
          </Button>
          <IconButton
            icon="refresh"
            accessibilityLabel="Refresh community photos"
            onPress={() => void remote.refresh()}
          />
        </View>
        <SegmentedButtons
          value={collection}
          onValueChange={setCollection}
          buttons={[
            { value: "all", label: "All" },
            { value: "local", label: "On device" },
            { value: "public", label: "Community" },
          ]}
        />
        <Feedback {...action} />
        {!!(collection !== "local") && <RemoteStatus {...remote} />}
        <Text>
          {photos.length} photos · Device photos stay private until you publish
          a copy.
        </Text>
      </View>
      <FlatList
        key={columns}
        data={photos}
        numColumns={columns}
        keyExtractor={(p) => p.key}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        refreshing={remote.loading}
        onRefresh={() => void remote.refresh()}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${item.name}`}
            onPress={() => setViewer(item.key)}
            style={{ flex: 1 / columns, padding: 3 }}
          >
            <Image
              source={{ uri: item.uri }}
              style={{
                width: "100%",
                aspectRatio: 1,
                borderRadius: 12,
                backgroundColor: theme.colors.surfaceVariant,
              }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <Text numberOfLines={1} variant="labelSmall">
              {item.local ? "Private" : "Community"}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Empty
            title="No photos here yet"
            detail="Add photos or capture one with Camera. Community photos need a connection."
          />
        }
      />
      <Modal
        visible={!!photo}
        onRequestClose={() => {
          setViewer(null);
          setSlideshow(false);
        }}
        animationType="fade"
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
        >
          <View style={styles.row}>
            <IconButton
              icon="close"
              accessibilityLabel="Close photo viewer"
              onPress={() => {
                setViewer(null);
                setSlideshow(false);
              }}
            />
            <Text style={styles.grow} numberOfLines={1}>
              {photo?.name}
            </Text>
            <Text>
              {index + 1}/{photos.length}
            </Text>
          </View>
          {!!photo && (
            <>
              <View style={{ flex: 1 }} {...swipe.panHandlers}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                />
              </View>
              <View style={[styles.content, { padding: 12 }]}>
                <View style={styles.row}>
                  <IconButton
                    icon="chevron-left"
                    accessibilityLabel="Previous photo"
                    onPress={() => step(-1)}
                  />
                  <Button onPress={() => setSlideshow(!slideshow)}>
                    {slideshow ? "Pause slideshow" : "Slideshow"}
                  </Button>
                  <IconButton
                    icon="chevron-right"
                    accessibilityLabel="Next photo"
                    onPress={() => step(1)}
                  />
                </View>
                <View style={styles.row}>
                  <Button
                    disabled={action.busy}
                    onPress={() =>
                      void action.run(() =>
                        photo.local
                          ? shareFile(photo.uri, "image/jpeg")
                          : downloadAndShare(photo.uri),
                      )
                    }
                  >
                    Share / download
                  </Button>
                  {!!photo.local && (
                    <Button
                      disabled={action.busy}
                      onPress={() =>
                        void action.run(async () => {
                          const permission =
                            await MediaLibrary.requestPermissionsAsync(true, [
                              "photo",
                            ]);
                          if (!permission.granted)
                            throw new Error(
                              "Photo saving permission was denied. Use Share to save a copy.",
                            );
                          await MediaLibrary.Asset.create(photo.uri);
                        }, "Saved to your device photo library.")
                      }
                    >
                      Save to Photos
                    </Button>
                  )}
                  {!!photo.local && (
                    <Button
                      disabled={action.busy}
                      onPress={() =>
                        void action.run(async () => {
                          if (
                            await confirm(
                              "Publish to everyone?",
                              "A separate copy will be visible to every visitor. Your private original stays on this device.",
                            )
                          ) {
                            await publishPhoto(photo.uri);
                            await remote.refresh();
                          }
                        }, undefined)
                      }
                    >
                      Publish copy
                    </Button>
                  )}
                  <Button
                    disabled={action.busy}
                    onPress={() =>
                      void action.run(async () => {
                        if (
                          !(await confirm(
                            "Delete photo?",
                            photo.local
                              ? "Remove this photo from the private gallery?"
                              : "Delete the community copy for everyone? Your account must be allowed by the existing storage policy.",
                          ))
                        )
                          return;
                        if (photo.local) {
                          await deleteManagedFile(photo.uri);
                          update("photos", (old) =>
                            old.filter((p) => p.id !== photo.key),
                          );
                        } else {
                          await removePublicPhoto(photo.key);
                          await remote.refresh();
                        }
                        setViewer(null);
                        setSlideshow(false);
                      })
                    }
                  >
                    Delete
                  </Button>
                </View>
                <Feedback {...action} />
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

export function CameraScreen() {
  const { update } = useApp(),
    router = useRouter(),
    action = useAction();
  const [permission, requestPermission] = useCameraPermissions(),
    [facing, setFacing] = useState<"back" | "front">("back"),
    [focused, setFocused] = useState(false),
    [ready, setReady] = useState(false),
    [torch, setTorch] = useState(false);
  const camera = useRef<CameraView>(null);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setReady(false);
      };
    }, []),
  );
  if (!permission)
    return (
      <Screen>
        <Text>Checking camera permission…</Text>
      </Screen>
    );
  if (!permission.granted)
    return (
      <Screen>
        <Empty
          title="Capture a moment"
          detail="Camera permission is used only when this screen is open."
          action={
            <Button
              mode="contained"
              onPress={() =>
                permission.canAskAgain
                  ? void requestPermission()
                  : void Linking.openSettings()
              }
            >
              {permission.canAskAgain
                ? "Allow camera"
                : "Open Android settings"}
            </Button>
          }
        />
      </Screen>
    );
  return (
    <Screen scroll={false}>
      <View
        style={{ flex: 1, margin: 12, borderRadius: 24, overflow: "hidden" }}
      >
        {!!focused && (
          <CameraView
            ref={camera}
            style={{ flex: 1 }}
            facing={facing}
            enableTorch={!!torch && facing === "back"}
            onCameraReady={() => setReady(true)}
            onMountError={(e) => action.setMessage(e.message)}
          />
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Button
            mode="contained"
            disabled={!ready || action.busy}
            loading={action.busy}
            icon="camera"
            onPress={() =>
              void action.run(async () => {
                const picture = await camera.current?.takePictureAsync({
                  quality: 0.9,
                });
                if (!picture)
                  throw new Error(
                    "The camera did not return a photo. Try again.",
                  );
                const saved = await saveLocalPhoto(
                  picture.uri,
                  "Camera-" + new Date().toISOString().slice(0, 10) + ".jpg",
                  picture.width,
                );
                update("photos", (old) => [saved, ...old]);
              }, "Saved privately to Gallery.")
            }
          >
            Capture
          </Button>
          <Button
            icon="camera-flip"
            onPress={() => {
              setReady(false);
              setFacing(facing === "back" ? "front" : "back");
            }}
          >
            Flip
          </Button>
          <Button onPress={() => setTorch(!torch)}>
            {torch ? "Torch off" : "Torch on"}
          </Button>
        </View>
        <Button onPress={() => router.push("/apps/gallery")}>
          Open Gallery
        </Button>
        <Feedback {...action} />
      </View>
    </Screen>
  );
}

export function FilesScreen() {
  const { data, update } = useApp(),
    action = useAction();
  const [folder, setFolder] = useState("root"),
    [query, setQuery] = useState(""),
    [name, setName] = useState(""),
    [selected, setSelected] = useState(""),
    [moveTarget, setMoveTarget] = useState("root");
  const current = data.files.find((f) => f.id === folder),
    entry = data.files.find((f) => f.id === selected);
  const descendants = (root: string) => {
    const ids = new Set([root]);
    let size = 0;
    while (size !== ids.size) {
      size = ids.size;
      data.files
        .filter((f) => f.parent && ids.has(f.parent))
        .forEach((f) => ids.add(f.id));
    }
    return ids;
  };
  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const saved: FileEntry[] = [];
    for (const asset of result.assets) {
      if ((asset.size || new File(asset.uri).size) > 100 * 1024 * 1024)
        throw new Error("Choose files up to 100 MB each.");
      const file = await persistFile(asset.uri, asset.name);
      saved.push({
        id: id(),
        parent: folder,
        name: asset.name,
        kind: "file" as const,
        uri: file.uri,
        mime: asset.mimeType,
        size: file.size,
      });
    }
    update("files", (old) => [...old, ...saved]);
  }
  return (
    <Screen>
      <Panel>
        <View style={styles.row}>
          {!!(folder !== "root") && (
            <Button
              icon="arrow-left"
              onPress={() => {
                setFolder(current?.parent || "root");
                setSelected("");
              }}
            >
              Up
            </Button>
          )}
          <Text variant="titleMedium">{current?.name || "Home"}</Text>
          <Button
            mode="contained"
            loading={action.busy}
            disabled={action.busy}
            onPress={() => void action.run(pick)}
          >
            Add files
          </Button>
        </View>
        <Field
          label="Search this folder"
          value={query}
          onChangeText={setQuery}
        />
        <Field
          label={entry ? "Rename selected item" : "New folder name"}
          value={name}
          maxLength={200}
          onChangeText={setName}
        />
        <View style={styles.row}>
          <Button
            onPress={() => {
              if (!name.trim()) return;
              if (entry)
                update("files", (old) =>
                  old.map((f) =>
                    f.id === entry.id ? { ...f, name: name.trim() } : f,
                  ),
                );
              else
                update("files", (old) => [
                  ...old,
                  {
                    id: id(),
                    parent: folder,
                    name: name.trim(),
                    kind: "folder",
                  },
                ]);
              setName("");
              setSelected("");
            }}
          >
            {entry ? "Rename" : "Create folder"}
          </Button>
          {!!entry && (
            <Button
              onPress={() => {
                setSelected("");
                setName("");
              }}
            >
              Cancel selection
            </Button>
          )}
        </View>
      </Panel>
      <Feedback {...action} />
      {data.files
        .filter(
          (f) =>
            f.parent === folder &&
            f.name.toLowerCase().includes(query.toLowerCase()),
        )
        .map((f) => (
          <Card key={f.id} mode={selected === f.id ? "outlined" : "contained"}>
            <List.Item
              title={f.name}
              description={
                f.kind === "file"
                  ? `${Math.round((f.size || 0) / 1024)} KB`
                  : "Folder"
              }
              left={(p) => (
                <List.Icon
                  {...p}
                  icon={f.kind === "folder" ? "folder-outline" : "file-outline"}
                />
              )}
              onPress={() => {
                if (f.kind === "folder") {
                  setFolder(f.id);
                  setSelected("");
                } else {
                  setSelected(f.id);
                  setName(f.name);
                }
              }}
              right={() => (
                <IconButton
                  icon="dots-vertical"
                  accessibilityLabel={`Actions for ${f.name}`}
                  onPress={() => {
                    setSelected(f.id);
                    setName(f.name);
                  }}
                />
              )}
            />
          </Card>
        ))}
      {!!entry && (
        <Panel title={entry.name}>
          <View style={styles.row}>
            {!!entry.uri && (
              <>
                <Button
                  onPress={() =>
                    void action.run(() => shareFile(entry.uri!, entry.mime))
                  }
                >
                  Share / save copy
                </Button>
                <Button
                  onPress={() =>
                    void action.run(async () => {
                      const copy = await persistFile(entry.uri!, entry.name);
                      update("files", (old) => [
                        ...old,
                        {
                          ...entry,
                          id: id(),
                          name: "Copy of " + entry.name,
                          uri: copy.uri,
                        },
                      ]);
                    })
                  }
                >
                  Copy
                </Button>
              </>
            )}
            <Button
              onPress={() =>
                void action.run(async () => {
                  if (
                    await confirm(
                      "Delete item?",
                      entry.kind === "folder"
                        ? "This removes the folder and its contents from the file manager."
                        : entry.name,
                    )
                  ) {
                    const remove = descendants(entry.id);
                    for (const child of data.files.filter(
                      (f) => remove.has(f.id) && f.uri,
                    ))
                      await deleteManagedFile(child.uri!);
                    update("files", (old) =>
                      old.filter((f) => !remove.has(f.id)),
                    );
                    setSelected("");
                  }
                })
              }
            >
              Delete
            </Button>
          </View>
          <Text>Move into</Text>
          <View style={styles.row}>
            {data.files
              .filter(
                (f) => f.kind === "folder" && !descendants(entry.id).has(f.id),
              )
              .map((f) => (
                <Chip
                  key={f.id}
                  selected={moveTarget === f.id}
                  onPress={() => setMoveTarget(f.id)}
                >
                  {f.name}
                </Chip>
              ))}
          </View>
          <Button
            disabled={
              descendants(entry.id).has(moveTarget) ||
              (moveTarget !== "root" &&
                !data.files.some(
                  (f) => f.id === moveTarget && f.kind === "folder",
                ))
            }
            onPress={() => {
              update("files", (old) =>
                old.map((f) =>
                  f.id === entry.id ? { ...f, parent: moveTarget } : f,
                ),
              );
              setSelected("");
            }}
          >
            Move selected item
          </Button>
        </Panel>
      )}
      <Text>
        Files are copied into this app’s private storage. Share a file to save
        it elsewhere.
      </Text>
    </Screen>
  );
}

export function MusicScreen() {
  const { update } = useApp(),
    music = useMusic(),
    action = useAction();
  async function add() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const entries: FileEntry[] = [];
    for (const asset of result.assets) {
      const file = await persistFile(asset.uri, asset.name);
      entries.push({
        id: id(),
        name: asset.name,
        parent: "root",
        kind: "file" as const,
        uri: file.uri,
        mime: asset.mimeType || "audio/mpeg",
        size: file.size,
      });
    }
    update("files", (old) => [...old, ...entries]);
  }
  const minutes = (v: number) =>
    Number.isFinite(v)
      ? `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`
      : "0:00";
  return (
    <Screen>
      <Panel title={music.current?.name || "Your soundtrack"}>
        <Button
          mode="contained"
          icon="music-note-plus"
          loading={action.busy}
          onPress={() => void action.run(add)}
        >
          Add music
        </Button>
        <Text>
          {minutes(music.position)} / {minutes(music.duration)}
        </Text>
        <View style={styles.row}>
          <IconButton
            icon="skip-previous"
            accessibilityLabel="Previous track"
            onPress={() => music.next(-1)}
          />
          <IconButton
            icon={music.playing ? "pause" : "play"}
            accessibilityLabel={music.playing ? "Pause" : "Play"}
            disabled={!music.current}
            onPress={music.toggle}
          />
          <IconButton
            icon="skip-next"
            accessibilityLabel="Next track"
            onPress={() => music.next(1)}
          />
          <Button
            disabled={!music.current}
            onPress={() =>
              void action.run(() =>
                music.seek(Math.max(0, music.position - 15)),
              )
            }
          >
            -15s
          </Button>
          <Button
            disabled={!music.current}
            onPress={() =>
              void action.run(() =>
                music.seek(Math.min(music.duration, music.position + 15)),
              )
            }
          >
            +15s
          </Button>
        </View>
        <View style={styles.row}>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <Chip key={v} onPress={() => music.volume(v)}>
              {Math.round(v * 100)}%
            </Chip>
          ))}
        </View>
        <Feedback error={action.error || music.error} />
      </Panel>
      {music.tracks.map((track) => (
        <List.Item
          key={track.id}
          title={track.name}
          left={(p) => (
            <List.Icon
              {...p}
              icon={
                track.id === music.current?.id ? "music-circle" : "music-note"
              }
            />
          )}
          onPress={() => music.play(track.id)}
        />
      ))}
      {!!!music.tracks.length && (
        <Empty
          title="Bring your music"
          detail="Choose audio files from your device. Playback continues while you use other apps."
        />
      )}
    </Screen>
  );
}

export function BrowserScreen() {
  const { data, update } = useApp(),
    action = useAction();
  const [address, setAddress] = useState(""),
    [title, setTitle] = useState("");
  const open = (value: string) =>
    action.run(async () => {
      const url = browserAddress(value);
      await WebBrowser.openBrowserAsync(url, {
        showTitle: true,
        enableBarCollapsing: true,
      });
    });
  return (
    <Screen>
      <Panel title="Your browser, securely">
        <Field
          label="Address or search"
          value={address}
          onChangeText={setAddress}
          keyboardType="url"
        />
        <View style={styles.row}>
          <Button mode="contained" onPress={() => void open(address)}>
            Open browser tab
          </Button>
          <Button
            onPress={() =>
              void action.run(async () => {
                await Linking.openURL(browserAddress(address));
              })
            }
          >
            Open externally
          </Button>
        </View>
        <Field
          label="Bookmark title"
          value={title}
          maxLength={300}
          onChangeText={setTitle}
        />
        <Button
          onPress={() =>
            void action.run(async () => {
              const url = browserAddress(address);
              update("bookmarks", (old) => [
                { id: id(), title: title.trim() || new URL(url).hostname, url },
                ...old,
              ]);
              setTitle("");
            }, "Bookmark saved.")
          }
        >
          Save bookmark
        </Button>
        <Text>
          Android Custom Tabs provide native back, forward, reload and secure
          sign-in. The app does not intercept website passwords or navigation.
        </Text>
      </Panel>
      <Feedback {...action} />
      {data.bookmarks.map((bookmark) => (
        <List.Item
          key={bookmark.id}
          title={bookmark.title}
          description={bookmark.url}
          onPress={() => void open(bookmark.url)}
          left={(p) => <List.Icon {...p} icon="bookmark-outline" />}
          right={() => (
            <IconButton
              icon="delete-outline"
              accessibilityLabel={`Remove ${bookmark.title}`}
              onPress={() =>
                void action.run(async () => {
                  if (await confirm("Remove bookmark?", bookmark.title))
                    update("bookmarks", (old) =>
                      old.filter((b) => b.id !== bookmark.id),
                    );
                })
              }
            />
          )}
        />
      ))}
    </Screen>
  );
}
