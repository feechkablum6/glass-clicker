<div align="center">

**English** · [Русский](README.ru.md)

# Clicker

Autoclicker for macOS with a glass window and a notice that floats over your game.
One hotkey, up to 100 clicks per second, the click count always in sight.

</div>

The Mac build of the same clicker as [glass-clicker](https://github.com/feechkablum6/glass-clicker) for Windows: same windows, same notice, same settings. Only the layer that talks to the system is different.

## The notice over every window

The clicker is switched on without leaving the game, so it announces itself at the top of the screen. The notice takes neither the mouse nor the focus: clicks pass straight through it. The card names the speed and the button, shrinks into a pill after a second and a half and counts clicks live, then unfolds with the result of the session and leaves.

## The window

The glass is the system material of macOS plus a layer of its own on top, so the labels stay readable over any background. The window has no frame, is dragged by its header, and its corners and shadow are drawn by the system.

## English and Russian

On the first run the clicker asks for a language and remembers the answer. Everything switches at once: the window, the notice over the game, the menu bar item and the key names. The `RU` / `EN` button in the header changes the language at any moment, even while the clicker runs.

## What it does

- The default hotkey is the right `Command`: press it and the clicker runs, press it again and it stops.
- Hold mode: clicks only while the key is held down. A held `Command` or `Shift` never reaches the clicks, they go out clean.
- Speed from 1 to 100 clicks per second, on a slider, while it runs.
- Clicks with the left or the right button.
- Any key or mouse button can become the hotkey, side buttons of gaming mice included.
- Escape stops the clicker from any app.
- Closing the window hides the clicker into the menu bar, the hotkey keeps working.
- The click counter and the settings survive a restart.

## System permission

macOS drops synthetic clicks from an app until it is ticked in Privacy & Security, Accessibility. While the permission is missing the clicker refuses to start and shows a screen with a button that opens the right settings pane.

The build is not signed with a developer certificate, so after every reinstall the system treats the app as a new one and asks for the permission again: untick "Glass Clicker" and tick it back.

## Install from source

Needs macOS 12 or newer, Apple Silicon and Node.js 20+.

```bash
npm install
npm run release
```

`npm run release` builds the app and puts it into Applications, replacing the previous version.

Run from source, without installing:

```bash
npm start
```

Build a `.dmg` to share:

```bash
npm run build
```

## How it works

- Electron 43 — two windows: the settings and the notice above everything else (frameless, transparent, click-through).
- [koffi](https://github.com/Koromix/koffi) — direct CoreGraphics calls: `CGEventPost` for the clicks, `CGEventSourceKeyState` and `CGEventSourceButtonState` for the hotkey.
- The click schedule keeps the requested pace and never catches up on clicks missed while the system stalled, so there is no burst.
- The logic lives outside Electron in `lib/`, so plain tests cover it.

```bash
npm test
```

## License

[MIT](LICENSE)
