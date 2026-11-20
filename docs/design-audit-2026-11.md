# Design and responsiveness fixes

Applied the Hallmark audit recommendations to the current M8M8S website and
Android application. The root `src` in the older local checkout was a legacy
snapshot; implementation uses the latest application from GitHub main so the
existing apps, native shell, preferences and data handlers remain available.

## Changes

- Measure the actual workspace and fit normal, maximized and split windows within it.
- Preserve preferred desktop window dimensions when opening on a phone; rendering
  clamps them without saving a permanently reduced size.
- Disable split controls when two usable panes cannot fit.
- Handle visual viewport changes, short screens and native safe areas.
- Allow launcher grids to scroll when content needs more room.
- Expand shell controls to 44px hit targets, with 48px targets for common touch rows.
- Improve text contrast, immediate keyboard focus, range labels and toggle states.
- Trap focus in Quick Settings and restore the opening control when it closes.
- Centralize shell colors and fonts, simplify the default wallpaper, remove
  redundant section eyebrows and avoid animating window width or height.
- Preserve user-selected wallpapers, themes, functional window controls and app wiring.
- Publish Android preview version 0.4.5 using the existing signing identity.

## Validation

- TypeScript and production website build.
- ESLint for the changed TypeScript components and geometry helper.
- 550 geometry combinations covering narrow, short, desktop and split layouts;
  also exercised by the GitHub Pages workflow.
- Headless Chrome checks at 320, 375, 414, 768, 1024, 1280, 1440 and 1920px.
- Open Gallery, resize to a short phone viewport, and verify containment.
- Verify Quick Settings focus cycling, Escape dismissal and focus restoration.
- Native shell layout checks at 320x640, 375x800, 414x800 and 768x360 with a
  stubbed Tauri bridge. These do not substitute for physical Android testing.
- Hallmark rendered screenshots and inspection of desktop Gallery and native apps.
- ARM64 Android APK build, signature verification and launcher-icon verification.

## Hallmark interpretation

This is targeted app polish, not a claim that every application screen satisfies
every Hallmark aesthetic gate. Gate 47a still flags the functional desktop window
chrome, which is part of the product rather than a marketing mockup. Large
launcher tiles are intentional app targets; the 32–52px control-height heuristic
does not describe their role. Neutral palette warnings are aesthetic suggestions.
The selected-file check does not see every state rule in imported stylesheets.

Browser captures and temporary verification dependencies remain ignored in
`.hallmark/`. No account data or credentials are included in this change.
