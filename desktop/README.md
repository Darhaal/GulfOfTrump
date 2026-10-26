# The desktop app

Gulf of Trump for Windows: the game in its own window, no Node.js or terminal
needed. It plays on the player's own ChatGPT plan, and the sign-in follows
OpenAI's guide for open-source apps:

- the system browser opens for the sign-in;
- the callback returns to a loopback port on this computer;
- the tokens stay on this computer, encrypted, in `~/.gulf-of-trump`.

## How it works

`main.cjs` starts the game's own server — the Next.js standalone build — on
Electron's Node.js, at `http://127.0.0.1:41914`, and shows it in a window. The
port is fixed because the saves live in the browser storage of that origin.
Links outside the game open in the system browser.

The window opens full screen. F11 or Settings → Window switches to a window
and back, and the next start opens the way the player left it
(`%APPDATA%\Gulf of Trump\window.json`). A full-screen window has no close
button, so the header has a Quit button in the app. The page reaches the
window only through `preload.cjs`: whether it is full screen, switching it,
and quitting — and only the game's own page.

The server's log is in `%APPDATA%\Gulf of Trump\logs\server.log`; attach it to
a bug report.

The loading screen is `splash.html`: the emblem, quotes of the game's eras
(the system language's `public/quotes/<locale>.json`, written by `npm run quotes`, with the speakers' portraits from `public/portraits`)
and a bar that follows the start — checking the port, starting the server,
waiting for it to answer, opening the game. The wait is paced by how long
the last one took (`%APPDATA%\Gulf of Trump\startup.json`); the sums are in
`splash-logic.cjs`, and `quotes-seen.json` keeps quotes from repeating until
all have been shown.

Updates come from the public repository's releases (`electron-updater`). The
app checks at start and every four hours, and the page sees each step through
`preload.cjs`: a toast with the download's percent, then "ready — restart now
or later" (later installs on quit); Settings → Version and updates has a
check button. The first start of a new version tells the page which version it
came from (`version.json`). Each step is logged to `logs\updater.log`. The
Microsoft Store copy is updated by the Store instead
([docs/store.md](../docs/store.md)).

## The installer

An NSIS installer (`electron-builder.yml` → `nsis`) that asks, in order:

1. the language — English, Russian or Ukrainian;
2. a welcome, then the licence (AGPL-3.0);
3. for whom — this user, or everyone on the computer (asks for admin rights);
4. the folder;
5. the shortcuts — on the desktop, in the Start menu, both on by default
   (`build/installer.nsh`);

and at the end offers to start the game. Uninstalling asks whether to delete
the saves (`%APPDATA%\Gulf of Trump`) and the ChatGPT sign-in
(`~/.gulf-of-trump`) too; they stay unless the player says yes. An update runs
the installer silently: it asks nothing, keeps the shortcuts as the player
left them and never touches the data.

`build.mjs` copies the licence and draws the pictures (`installerSidebar.bmp`
164×314, `installerHeader.bmp` 150×57) from the emblem at every build.
`installer.nsh` is UTF-8 with a byte order mark, so NSIS reads its Cyrillic.

## Building

```bash
npm run desktop            # the installer, in desktop/dist
npm run desktop -- --dir   # only the unpacked app, in desktop/dist/win-unpacked
```

To try it without spending a plan, start the unpacked app with
`GOT_MOCK_AI=1` set.

Releases are built by `.github/workflows/desktop.yml` when a `v*` tag is
pushed to the public repository: the installer and `latest.yml` go to that
tag's GitHub release.

**Not signed yet.** Windows SmartScreen warns about an unsigned installer
("Windows protected your PC" → More info → Run anyway). A code-signing
certificate removes the warning.
