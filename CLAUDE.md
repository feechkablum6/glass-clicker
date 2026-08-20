# Project Guide

## Stack

- Electron 43 desktop app for Windows 11.
- Vanilla HTML, CSS, and CommonJS JavaScript, no frontend framework.
- Koffi for Win32 calls: `SendInput`, `GetAsyncKeyState`, acrylic backdrop, timer resolution.
- Node's built-in test runner.

## Structure

- `main.js`: Electron lifecycle, both windows, tray, input polling loop, IPC.
- `preload.js` / `preload-overlay.js`: the only bridges between renderers and main (`contextIsolation` is on).
- `lib/win32.js`: every Win32 call, wrapped so the rest of the code stays testable.
- `lib/click-engine.js`: click scheduling and hotkey modes, pure logic with injected timers.
- `lib/overlay-notice.js`: what the on-top notice says when the clicker starts and stops, pure logic.
- `lib/keys.js`: virtual key codes, Russian labels, capture whitelist.
- `lib/settings.js`: validated settings with debounced writes to `userData`.
- `renderer/`: the main window (`index.html`, `styles.css`, `renderer.js`) and the notice shown over other apps (`overlay.*`); `tokens.css` holds the design tokens both share.
- `test/`: unit tests for the engine, notices, settings, and key labels.

## Commands

- `npm test`: run the test suite.
- `npm start`: run the app from source.
- `npm run build`: build the installer and portable executable (set `ELECTRON_CACHE=E:\DevCaches\Electron` and `ELECTRON_BUILDER_CACHE=E:\DevCaches\electron-builder`).

## Conventions

- Keep Windows-native calls behind `lib/win32.js`; the rest of the code receives plain functions.
- Add behavior with a failing `node:test` case before production code.
- Keep user-facing strings in Russian; keep code and comments as they are in each file.
- Glass look comes from the system acrylic backdrop plus a light CSS layer; the CSS layer alone must stay readable, since the backdrop can be off.

## Anti-patterns

- DO NOT run the app unattended while testing: the hotkey is global, so a bound button pressed by the user starts real clicks anywhere on the desktop.
- DO NOT quit on window close: closing hides the window to the tray and the clicker keeps running. Quitting happens through the tray menu, which sets `isQuitting` before `app.quit()`.
- DO NOT announce the move to the tray with a system balloon; the user turned it down. The on-top notice already shows when the clicker runs.
- DO NOT bind the hotkey to the same button that the clicker sends; in hold mode the synthetic click keeps the button "down" and the clicker never stops. Both directions are rejected in `main.js`.
- DO NOT poll the whole virtual key table on the fast timer; only the capture mode needs it, and it runs at a slower interval.
- DO NOT catch up on clicks missed while the process was suspended; cap the drift (`MAX_CATCH_UP`) or the user gets a burst after every sleep.
- DO NOT keep `timeBeginPeriod(1)` on for the whole session; raise the timer resolution only while clicking.
- DO NOT write settings on every slider step; the writes are debounced and flushed on quit.
- DO NOT expect CSS `border-radius` to shape the system backdrop; the acrylic layer is drawn by Windows over the whole client area, so corners are set through `DwmSetWindowAttribute`.
- DO NOT reassign functions exposed through `contextBridge`; the bridge object is frozen and the assignment silently does nothing.
- DO NOT animate an element that is hidden by default with a keyframe set that omits `to`; with `fill-mode: both` the element settles back on its base rule, so the notice ends up fully transparent and the window shows nothing.
- DO NOT measure the notice layers with `getBoundingClientRect()`; both layers live under the cross-fade `scale()`, so the card would be sized smaller than its own text. `offsetWidth` ignores transforms.
- DO NOT hide the notice window while the clicker runs; the compact pill is the running indicator, and main only hides the window once the result card reports it is gone.
- DO NOT let the notice window take focus or catch the mouse: it is `focusable: false`, shown with `showInactive()` and made click-through, otherwise a notice pulls the player out of the game.
- DO NOT trust the notice renderer alone to close its window; main keeps a fallback timer, or a stalled renderer leaves a card floating over everything.
- DO NOT emit the running state after the first click; the notice counts the clicks of one session from the counter it saw at start.
- DO NOT copy design tokens into a second stylesheet; both windows read `renderer/tokens.css`, so the notice can never drift from the main window.
