# Project Guide

## Stack

- Electron 43 desktop app for macOS 12+ on Apple Silicon.
- Vanilla HTML, CSS, and CommonJS JavaScript, no frontend framework.
- Koffi for CoreGraphics calls: `CGEventPost`, `CGEventSourceKeyState`, `CGEventSourceButtonState`, `AXIsProcessTrusted`.
- Node's built-in test runner.

## Structure

- `main.js`: Electron lifecycle, both windows, the menu bar item, input polling loop, IPC.
- `preload.js` / `preload-overlay.js`: the only bridges between renderers and main (`contextIsolation` is on).
- `lib/macos.js`: every CoreGraphics call, wrapped so the rest of the code stays testable.
- `lib/click-engine.js`: click scheduling and hotkey modes, pure logic with injected timers.
- `lib/overlay-notice.js`: what the on-top notice says when the clicker starts and stops, pure logic.
- `lib/i18n.js`: every user-facing string in English and Russian, plus number grouping and plural forms.
- `lib/keys.js`: key codes, translated labels, capture whitelist.
- `lib/settings.js`: validated settings with debounced writes to `userData`.
- `renderer/`: the main window (`index.html`, `styles.css`, `renderer.js`) and the notice shown over other apps (`overlay.*`); `tokens.css` holds the design tokens both share.
- `scripts/`: icon rendering and the release install into `/Applications`.
- `test/`: unit tests for the engine, notices, settings, and key labels.

## Commands

- `npm test`: run the test suite.
- `npm start`: run the app from source.
- `npm run icons`: redraw `build/icon.png` and the menu bar template images from `build/icon.svg`.
- `npm run release`: build and replace the copy in `/Applications`.
- `npm run build`: build the `.dmg` and `.zip` for sharing.

## Conventions

- Keep macOS-native calls behind `lib/macos.js`; the rest of the code receives plain functions.
- Add behavior with a failing `node:test` case before production code.
- Every user-facing string lives in `lib/i18n.js` in both languages; keep code and comments as they are in each file.
- Static labels in the window carry `data-i18n`, `data-i18n-title` or `data-i18n-aria`; dynamic text goes through `t()` in `renderer.js`.
- Key codes and mouse buttons share one numbering: keyboard codes stay under `MOUSE_BASE`, mouse buttons start at it.
- Glass comes from the system material plus a light CSS layer; the CSS layer alone must stay readable.

## Anti-patterns

- DO NOT run the app unattended while testing: the hotkey is global, so a bound key pressed by the user starts real clicks anywhere on the desktop.
- DO NOT start the clicker without the Accessibility permission: `CGEventPost` drops the events silently, the counter still runs, and the user sees a clicker that does nothing.
- DO NOT read the input state with `kCGEventSourceStateCombinedSessionState`; it also reports the app's own synthetic clicks, so a mouse button hotkey would retrigger itself.
- DO NOT quit on window close: closing hides the window into the menu bar and the clicker keeps running. Quitting happens through the menu bar item, which sets `isQuitting` before `app.quit()`.
- DO NOT set `transparent: true` on the main window: the vibrancy material turns black behind a transparent surface. The notice window is the transparent one, and it draws its own background.
- DO NOT bind the hotkey to the same button that the clicker sends; in hold mode the synthetic click keeps the button "down" and the clicker never stops. Both directions are rejected in `main.js`.
- DO NOT post a click at a point other than the current cursor: the pointer jumps to whatever coordinates the event carries.
- DO NOT let the click carry modifier flags: on macOS the flags travel inside the event, and the default hotkey is the right Command, so every click would land as a Command-click. `click()` zeroes them right before posting.
- DO NOT recreate the click events on every tick; they are created once and only their location is updated.
- DO NOT poll the whole key table on the fast timer; only the capture mode needs it, and it runs at a slower interval.
- DO NOT catch up on clicks missed while the process was suspended; cap the drift (`MAX_CATCH_UP`) or the user gets a burst after every sleep.
- DO NOT write settings on every slider step; the writes are debounced and flushed on quit.
- DO NOT reassign functions exposed through `contextBridge`; the bridge object is frozen and the assignment silently does nothing.
- DO NOT animate an element that is hidden by default with a keyframe set that omits `to`; with `fill-mode: both` the element settles back on its base rule, so the notice ends up fully transparent and the window shows nothing.
- DO NOT measure the notice layers with `getBoundingClientRect()`; both layers live under the cross-fade `scale()`, so the card would be sized smaller than its own text. `offsetWidth` ignores transforms.
- DO NOT hide the notice window while the clicker runs; the compact pill is the running indicator, and main only hides the window once the result card reports it is gone.
- DO NOT let the notice window take focus or catch the mouse: it is `focusable: false`, shown with `showInactive()` and made click-through, otherwise a notice pulls the player out of the game.
- DO NOT trust the notice renderer alone to close its window; main keeps a fallback timer, or a stalled renderer leaves a card floating over everything.
- DO NOT emit the running state after the first click; the notice counts the clicks of one session from the counter it saw at start.
- DO NOT copy design tokens into a second stylesheet; both windows read `renderer/tokens.css`, so the notice can never drift from the main window.
- DO NOT hardcode a visible string anywhere outside `lib/i18n.js`, and do not keep a second copy of the dictionary in the renderer: the window receives it from main with the state, so one language can never lag behind.
- DO NOT ship the dictionary with every state update; it travels only on `state:get` and on a language change, while the fast path stays small.
- DO NOT recreate the notice source when the language changes; `setLanguage()` keeps the running session, its start time and its click count.
- DO NOT treat a missing language in settings as English: `null` means the first run, and the window asks the question before anything else.
