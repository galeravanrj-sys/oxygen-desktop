# M8M8S native migration

Source: `D:\PHONE WEBSITE\oxygen-desktop`
Destination: `D:\PHONE WEBSITE\oxygen-mobile`
Scope: a separate React Native / Expo application. The website, Tauri pipeline,
existing database schema, policies, buckets and accounts are preserved.

## Audit and architecture

- [x] Inspect the real launcher, utility apps, native shell, data services,
      Supabase migrations/functions, Android notification worker and assets.
- [x] Inventory all 19 launcher applications, plus account, sign-up, protected
      administration, search, chat extras, ranking history and extra game modes.
- [x] Record 105 source/configuration/asset checksums in `docs/source-baseline.json`.
- [x] Search installed skill locations. No Expo skill, including
      `expo-web-to-native`, was available. Official documentation is used instead;
      no substitute skill functionality is claimed.
- [x] Create an independent official Expo SDK 58 starter with TypeScript and Router.
- [x] Replace starter screens with native screens; add Material 3 components,
      light/dark themes, adaptive grids, safe areas and Android back navigation.
- [x] Reuse calculator arithmetic and history, ranking comparison, passport
      validation and notification-baseline algorithms with native storage/crypto adapters.
- [x] Configure a separate Android ID: `com.m8m8s.oxygen.mobile`.
- [x] Fix the 0.1.0 Android startup crash in 0.1.1: preserve reflected Room and
  WorkManager constructors, verify APK DEX, and pass three cold launches plus
  native Home rendering on Oppo Reno 13F / Android 16. See
  `docs/startup-crash-0.1.1.md` for evidence and remaining test limits.
- [x] Pass TypeScript, lint, seven domain tests, all 20 Expo Doctor checks and
      14 read-only backend checks; preserve all 105 recorded original-file hashes.
- [x] Exercise all 19 routes in the browser preview, verify note/task persistence,
      calculator input and launcher layouts at phone/tablet/landscape sizes.
- [x] Build a standalone ARM64 preview APK with the installed Android toolchain;
      verify its signature and package metadata. Device installation/testing remains open.

## Feature inventory and native replacement

All rows below describe implemented code. Hardware and authenticated write-flow
verification are tracked separately in `TEST_RESULTS.md`; they are not implied
by an implementation checkmark.

| Existing app / flow | Native implementation                                                                                                                             | Data and replacement                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Notifications       | History, unread/category filters, mark read, clear, feed checks, category switches, Android background checks, notification navigation            | Existing public feeds; quiet first baseline; Expo Notifications + BackgroundTask                     |
| Community Chat      | General/Gaming/Help, latest 60 messages, display names, sign-in/sign-up, send, own-message deletion, replies, reactions, reporting, unread counts | Existing tables/RPCs and RLS; realtime with polling fallback                                         |
| Daily Briefing      | Tasks, today’s events, saved-city weather, playing games and discovery shortcuts                                                                  | Existing local models and public APIs                                                                |
| Gaming Passport     | Create/edit/remove, platform/status, notes, rating, finished dates, search/filter, giveaway wishlist, JSON import/export                          | Same validated passport shape; local persistence                                                     |
| Theme Studio        | System/light/dark, preset/custom accents, icon shape, wallpaper, appearance reset, favorite apps and order                                        | Native theme roles; desktop opacity and window styling replaced                                      |
| Weather             | City search, current conditions, feels-like/humidity/wind, seven-day forecast, selected-city time zone, cached/offline results                    | Existing Open-Meteo contracts                                                                        |
| To-do List          | Add, complete/reopen, due dates, filters, remove, clear completed, optional device reminders                                                      | Existing task fields; native date/time picker and notifications                                      |
| Free Games          | Full-game feed, search, Steam/Epic/GOG/itch.io filters, source links, wishlist saves                                                              | Existing GamerPower URL and claim semantics                                                          |
| Gallery             | Private selection, public photos, authorized upload/delete, native sharing/saving, viewer, swipe, slideshow, sync hints and polling               | Existing `oxygen-public-gallery/photos/` objects; local files remain private                         |
| Games Tierlist      | Seven games, categories/roles, character search, source links, stale/cache labels, ranking changes, Grand Cross LR view                           | Five existing function-backed games; bundled Naruto, Black Clover and LR snapshots                   |
| Clock & Widgets     | World clock/time zones, photo/task/event counts, weather and personal summaries                                                                   | Native dashboard replaces movable desktop widgets                                                    |
| Files               | Document picker, private copies, folders, navigation, search, rename, move, copy, delete, share/save externally                                   | App sandbox replaces browser data URLs and desktop folders                                           |
| Browser             | Address/search, bookmarks, external opening                                                                                                       | Android Custom Tabs provide back/forward/reload and secure site sign-in; no embedded desktop browser |
| Settings            | Accounts, appearance, notification preferences, backup/import, passport import, data-location explanations                                        | Native app settings; website is not reconfigured                                                     |
| Calendar            | Month navigation, event CRUD, dates, optional reminders                                                                                           | Existing event records; native date/time selection                                                   |
| Calculator          | Decimal arithmetic, percentages, unary functions, memory, clipboard, repeat operations and persisted history                                      | Reused Decimal-based engine                                                                          |
| Music               | Local audio selection, persistent playlist files, playback/pause/skip/seek/volume, lock-screen/background playback                                | Expo Audio replaces HTMLAudioElement; player stays mounted across routes                             |
| Notes               | Create/edit/search/delete, word counts and text export                                                                                            | Same note shape; native storage/sharing                                                              |
| Camera              | Permission states, front/back, torch, capture, private saving and Gallery navigation                                                              | Expo Camera; preview is unmounted when the route loses focus                                         |
| Accounts and admin  | Existing account authentication, secure persistent sessions, role RPC, drafts/preview/publish, published list                                     | Existing auth and announcement RPCs; no client role assignment                                       |
| Global search       | Launcher search includes apps, notes, tasks and passport entries                                                                                  | Native route navigation replaces desktop window focus                                                |

## Backend preservation

- `oxygen-public-gallery`, `photos/`, `oxygen-gallery-public-v1` are retained.
- Chat retains `community_messages`, `community_reactions`, `community_reports`,
  `community_room_activity(since)` and the existing room/body/reaction contracts.
- Admin retains `announcement_admin_status`, `admin_list_announcements`,
  `save_announcement(p_title,p_body,p_id)`, `publish_announcement(p_id)`.
- The existing public announcement and ranking functions are reused.
- Sessions use chunked Expo SecureStore values and foreground token refresh.
- Only public connection values are copied to ignored `.env.local`; no service-role
  key or database credential is needed or embedded.
- Read-only contract checks passed. Authenticated write tests are not performed
  using another person’s account, and no test messages or photos are published.

## Intentional boundaries and remaining validation

- Browser-local records cannot automatically sync through a database that never
  stored them. Use the provided website export script and native import, or share
  media/documents explicitly. The export script does not extract Auth tokens.
- The website export covers notes, tasks, events, bookmarks, calculator history,
  passport, saved city and appearance ordering. Website IndexedDB private photos,
  data-URL files and existing Tauri data need explicit export/download and native import.
- Mobile device backups include managed media within a 25 MB media budget and
  report omissions. Individual files can be shared separately.
- Desktop multiwindow dragging/snapping, arbitrary window opacity, OS-level
  Wi-Fi/Bluetooth/brightness controls and embedded third-party pages are replaced
  by native navigation, Android settings and Custom Tabs.
- Background checks are OS scheduled, not push delivery guarantees. No Expo push
  server or new production schema is introduced. Existing Tauri workers are untouched.
- Native storage/permissions, authenticated uploads/chat/admin writes, deep links,
  audio interruption, camera orientation and device rotation still require actual
  Android runtime testing. Build status is recorded in `TEST_RESULTS.md`.
- Store-ready signing, privacy declarations, release-key custody and store submission
  remain owner deployment work. Local preview signing is not production signing.

## Official references

- [Expo SDK and starter](https://docs.expo.dev/versions/latest/)
- [Expo Router](https://docs.expo.dev/router/installation/)
- [Development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Camera](https://docs.expo.dev/versions/latest/sdk/camera/),
  [image picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/),
  [file system](https://docs.expo.dev/versions/latest/sdk/filesystem/),
  [audio](https://docs.expo.dev/versions/latest/sdk/audio/)
- [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/),
  [notifications](https://docs.expo.dev/versions/latest/sdk/notifications/),
  [background tasks](https://docs.expo.dev/versions/latest/sdk/background-task/)
- [Supabase React Native authentication](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [CMake object-path hashing](https://cmake.org/cmake/help/latest/variable/CMAKE_OBJECT_PATH_MAX.html)
