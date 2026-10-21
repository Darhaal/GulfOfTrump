// Gulf of Trump as a desktop app. Electron runs the game's own server (the
// Next.js standalone build) on a fixed local port and shows it in a window.
// Signing in with ChatGPT opens the system browser and returns to the server's
// loopback listener, as OpenAI's guide for open-source apps describes; the
// tokens stay on this computer, in ~/.gulf-of-trump.
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const HOST = "127.0.0.1";
// A fixed port: the game keeps its saves in the browser storage of this origin.
const PORT = 41914;
const ORIGIN = `http://${HOST}:${PORT}`;

/** The few words the app itself says, in the game's three languages. */
const TEXT = {
  en: {
    starting: "Starting Gulf of Trump…",
    portBusy: `Another program is using port ${PORT}, which the game needs. Close it and start the game again.`,
    stopped: (code, logs) => `The game's server stopped (code ${code}). Its log is in ${logs}.`,
    noStart: (logs) => `The game's server did not start. Its log is in ${logs}.`,
    updateReady: (v) => `Gulf of Trump ${v} is ready`,
    updateDetail: "Restart to update. Your games are kept.",
    restart: "Restart now",
    later: "Later",
  },
  ru: {
    starting: "Запуск Gulf of Trump…",
    portBusy: `Порт ${PORT}, нужный игре, занят другой программой. Закройте её и запустите игру снова.`,
    stopped: (code, logs) => `Сервер игры остановился (код ${code}). Журнал лежит в ${logs}.`,
    noStart: (logs) => `Сервер игры не запустился. Журнал лежит в ${logs}.`,
    updateReady: (v) => `Gulf of Trump ${v} готов к установке`,
    updateDetail: "Перезапустите, чтобы обновиться. Партии сохранятся.",
    restart: "Перезапустить",
    later: "Позже",
  },
  uk: {
    starting: "Запуск Gulf of Trump…",
    portBusy: `Порт ${PORT}, потрібний грі, зайнятий іншою програмою. Закрийте її й запустіть гру знову.`,
    stopped: (code, logs) => `Сервер гри зупинився (код ${code}). Журнал лежить у ${logs}.`,
    noStart: (logs) => `Сервер гри не запустився. Журнал лежить у ${logs}.`,
    updateReady: (v) => `Gulf of Trump ${v} готовий до встановлення`,
    updateDetail: "Перезапустіть, щоб оновитися. Партії збережуться.",
    restart: "Перезапустити",
    later: "Пізніше",
  },
};
const text = () => {
  const lang = app.getLocale().slice(0, 2);
  return TEXT[lang === "uk" ? "uk" : lang === "ru" || lang === "be" ? "ru" : "en"];
};

let server = null;
let window = null;
let quitting = false;

const serverDir = () => (app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(__dirname, "server"));
const logDir = () => path.join(app.getPath("userData"), "logs");

/** The window as the player left it: full screen unless they chose a window. */
const windowFile = () => path.join(app.getPath("userData"), "window.json");
function fullScreenWanted() {
  try {
    return JSON.parse(fs.readFileSync(windowFile(), "utf8")).fullScreen !== false;
  } catch {
    return true;
  }
}
function rememberFullScreen(on) {
  try {
    fs.writeFileSync(windowFile(), JSON.stringify({ fullScreen: on }));
  } catch {
    // Not remembered: the next start is full screen again.
  }
}

function portFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, HOST);
  });
}

/** The game's server, on Electron's own Node.js; its output goes to a log for bug reports. */
function startServer() {
  fs.mkdirSync(logDir(), { recursive: true });
  const log = fs.createWriteStream(path.join(logDir(), "server.log"), { flags: "a" });
  log.write(`\n--- ${new Date().toISOString()} · ${app.getVersion()}\n`);
  server = spawn(process.execPath, [path.join(serverDir(), "server.js")], {
    cwd: serverDir(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PORT: String(PORT), HOSTNAME: HOST, GOT_DESKTOP: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on("exit", (code) => {
    server = null;
    if (quitting) return;
    dialog.showErrorBox("Gulf of Trump", text().stopped(code, logDir()));
    app.quit();
  });
}

function waitForServer(ms = 45_000) {
  const until = Date.now() + ms;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(`${ORIGIN}/api/ai/status`, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => (Date.now() > until ? reject(new Error("timeout")) : setTimeout(attempt, 300)));
    };
    attempt();
  });
}

const isGame = (url) => url === ORIGIN || url.startsWith(`${ORIGIN}/`);
const openOutside = (url) => {
  if (/^https?:\/\//.test(url)) void shell.openExternal(url);
};

/**
 * What the game's own page may use: the microphone for voice input (sound,
 * never the camera), the clipboard for a shared picture, full screen. Any
 * other page, and anything else, is refused.
 */
function guardPermissions() {
  const { session } = require("electron");
  const ALLOWED = new Set(["media", "clipboard-sanitized-write", "fullscreen"]);
  const allowed = (permission, url, media) => ALLOWED.has(permission) && isGame(url ?? "") && (permission !== "media" || (media.length > 0 && media.every((m) => m === "audio")));
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => callback(allowed(permission, details.requestingUrl, details.mediaTypes ?? [])));
  // A check (listing devices, permissions.query) grants nothing by itself; it only must not say yes to the camera.
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin, details) => allowed(permission, details?.requestingUrl || origin, details?.mediaType === "video" ? ["video"] : ["audio"]));
}

function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    title: "Gulf of Trump",
    backgroundColor: "#F8FAFC",
    icon: path.join(__dirname, "build", "icon.png"),
    fullscreen: fullScreenWanted(),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, preload: path.join(__dirname, "preload.cjs") },
  });
  // F11 switches between full screen and a window, as in a browser; the choice holds for the next start.
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || input.key !== "F11") return;
    event.preventDefault();
    window?.setFullScreen(!window.isFullScreen());
  });
  for (const [name, on] of [["enter-full-screen", true], ["leave-full-screen", false]]) {
    window.on(name, () => {
      rememberFullScreen(on);
      window?.webContents.send("window:full-screen", on);
    });
  }
  // Everything outside the game — ChatGPT's sign-in, GitHub, the docs — opens in the system browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!isGame(url)) openOutside(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (isGame(url)) return;
    event.preventDefault();
    openOutside(url);
  });
  window.on("closed", () => {
    window = null;
  });
  const splash = `<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;background:#F8FAFC;color:#1A1F26;font:600 15px system-ui,sans-serif">${text().starting}</body>`;
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splash)}`);
}

/**
 * Updates come from the public repository's releases; one is installed when
 * the player restarts. The Microsoft Store copy is updated by the Store alone
 * (its policy 10.2.5), so it never checks.
 */
function checkForUpdates() {
  if (!app.isPackaged || process.windowsStore) return;
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.on("update-downloaded", async (info) => {
      const t = text();
      const { response } = await dialog.showMessageBox(window ?? undefined, {
        type: "info",
        buttons: [t.restart, t.later],
        defaultId: 0,
        cancelId: 1,
        message: t.updateReady(info.version),
        detail: t.updateDetail,
      });
      if (response === 0) {
        quitting = true;
        autoUpdater.quitAndInstall();
      }
    });
    autoUpdater.checkForUpdates().catch(() => undefined);
  } catch {
    // No updater: the game still runs.
  }
}

/** What the game's page may ask (preload.cjs) — only the game's own page. */
function answerThePage() {
  const fromGame = (event) => isGame(event.senderFrame?.url ?? "");
  ipcMain.handle("window:is-full-screen", (event) => fromGame(event) && !!window?.isFullScreen());
  ipcMain.handle("window:set-full-screen", (event, on) => {
    if (fromGame(event)) window?.setFullScreen(on === true);
    return !!window?.isFullScreen();
  });
  ipcMain.handle("app:quit", (event) => {
    if (fromGame(event)) app.quit();
  });
}

async function main() {
  Menu.setApplicationMenu(null);
  answerThePage();
  app.setAppUserModelId("com.okhten.gulfoftrump");
  createWindow();
  if (!(await portFree(PORT))) {
    dialog.showErrorBox("Gulf of Trump", text().portBusy);
    app.quit();
    return;
  }
  startServer();
  try {
    await waitForServer();
  } catch {
    dialog.showErrorBox("Gulf of Trump", text().noStart(logDir()));
    app.quit();
    return;
  }
  if (window) await window.loadURL(ORIGIN);
  checkForUpdates();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  app.on("before-quit", () => {
    quitting = true;
    server?.kill();
  });
  app.on("window-all-closed", () => app.quit());
  app.whenReady().then(() => {
    guardPermissions();
    return main();
  });
}
