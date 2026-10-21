// Gulf of Trump as a desktop app. Electron runs the game's own server (the
// Next.js standalone build) on a fixed local port and shows it in a window.
// Signing in with ChatGPT opens the system browser and returns to the server's
// loopback listener, as OpenAI's guide for open-source apps describes; the
// tokens stay on this computer, in ~/.gulf-of-trump.
const { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const splashLogic = require("./splash-logic.cjs");

const HOST = "127.0.0.1";
// A fixed port: the game keeps its saves in the browser storage of this origin.
// GOT_PORT moves it only for a test run beside an installed copy.
const PORT = Number(process.env.GOT_PORT) || 41914;
const ORIGIN = `http://${HOST}:${PORT}`;

/** The few words the app itself says, in the game's three languages. */
const TEXT = {
  en: {
    portBusy: `Another program is using port ${PORT}, which the game needs. Close it and start the game again.`,
    stopped: (code, logs) => `The game's server stopped (code ${code}). Its log is in ${logs}.`,
    noStart: (logs) => `The game's server did not start. Its log is in ${logs}.`,
    updateReady: (v) => `Gulf of Trump ${v} is ready`,
    updateDetail: "Restart to update. Your games are kept.",
    restart: "Restart now",
    later: "Later",
    phasePort: "Checking the game's port…",
    phaseServer: "Starting the game's server…",
    phaseWaiting: "Loading the maps and the world…",
    phaseOpening: "Opening the game…",
    author: "Artem Okhten",
    madeBy: (name) => `Made by ${name}`,
  },
  ru: {
    portBusy: `Порт ${PORT}, нужный игре, занят другой программой. Закройте её и запустите игру снова.`,
    stopped: (code, logs) => `Сервер игры остановился (код ${code}). Журнал лежит в ${logs}.`,
    noStart: (logs) => `Сервер игры не запустился. Журнал лежит в ${logs}.`,
    updateReady: (v) => `Gulf of Trump ${v} готов к установке`,
    updateDetail: "Перезапустите, чтобы обновиться. Партии сохранятся.",
    restart: "Перезапустить",
    later: "Позже",
    phasePort: "Проверяем порт игры…",
    phaseServer: "Запускаем сервер игры…",
    phaseWaiting: "Загружаем карты и мир…",
    phaseOpening: "Открываем игру…",
    author: "Артём Охтень",
    madeBy: (name) => `Сделал ${name}`,
  },
  uk: {
    portBusy: `Порт ${PORT}, потрібний грі, зайнятий іншою програмою. Закрийте її й запустіть гру знову.`,
    stopped: (code, logs) => `Сервер гри зупинився (код ${code}). Журнал лежить у ${logs}.`,
    noStart: (logs) => `Сервер гри не запустився. Журнал лежить у ${logs}.`,
    updateReady: (v) => `Gulf of Trump ${v} готовий до встановлення`,
    updateDetail: "Перезапустіть, щоб оновитися. Партії збережуться.",
    restart: "Перезапустити",
    later: "Пізніше",
    phasePort: "Перевіряємо порт гри…",
    phaseServer: "Запускаємо сервер гри…",
    phaseWaiting: "Завантажуємо мапи й світ…",
    phaseOpening: "Відкриваємо гру…",
    author: "Артем Охтень",
    madeBy: (name) => `Зробив ${name}`,
  },
};
const text = () => TEXT[splashLogic.localeOf(app.getLocale())];

let server = null;
let window = null;
let quitting = false;

const serverDir = () => (app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(__dirname, "server"));
const logDir = () => path.join(app.getPath("userData"), "logs");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJson(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  } catch {
    // Not kept: the next start guesses again.
  }
}

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
    // The page colour of the system's theme from the first frame, so a dark desktop never flashes white.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0E1116" : "#F8FAFC",
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
  splashReady = new Promise((resolve) => window.webContents.once("did-finish-load", resolve));
  void window.loadFile(path.join(__dirname, "splash.html"));
}

/**
 * The loading screen (splash.html): quotes of the game's eras with their
 * speakers' portraits, who made the game, and a bar that follows the start —
 * the port, the server, the wait for it to answer (paced by how long the
 * last start took), opening the game. The sums are in splash-logic.cjs.
 */
const startup = { phase: "port", since: Date.now(), expected: splashLogic.FIRST_GUESS_MS, timer: null };
let splashReady = Promise.resolve();
const startupFile = () => path.join(app.getPath("userData"), "startup.json");

function onSplash(script) {
  if (!window || window.webContents.getURL().startsWith(ORIGIN)) return;
  void window.webContents.executeJavaScript(`window.splash && ${script}`).catch(() => undefined);
}

function phase(name) {
  startup.phase = name;
  startup.since = Date.now();
  paintSplash();
}

function paintSplash() {
  const t = text();
  const share = splashLogic.startupProgress(startup.phase, Date.now() - startup.since, startup.expected);
  const status = { port: t.phasePort, server: t.phaseServer, waiting: t.phaseWaiting, opening: t.phaseOpening, done: t.phaseOpening }[startup.phase];
  onSplash(`window.splash.progress(${share}, ${JSON.stringify(status)})`);
}

/** The quotes for this start (none repeats until all have been seen), the made-by line and the version. */
function fillSplash() {
  const t = text();
  const locale = splashLogic.localeOf(app.getLocale());
  const publicDir = path.join(serverDir(), "public");
  const all = readJson(path.join(publicDir, "quotes.json"), []);
  const seenFile = path.join(app.getPath("userData"), "quotes-seen.json");
  const { picked, seen } = splashLogic.pickQuotes(all.map((q) => q.id), readJson(seenFile, []), 4);
  writeJson(seenFile, seen);
  const fileUrl = (file) => (fs.existsSync(file) ? pathToFileURL(file).href : null);
  const quotes = picked
    .map((id) => all.find((q) => q.id === id))
    .filter(Boolean)
    .map((q) => ({ ...splashLogic.quoteIn(q, locale), portrait: q.person ? fileUrl(path.join(publicDir, "portraits", `${q.person}.webp`)) : null }));
  const data = {
    quotes,
    madeBy: { name: t.author, line: t.madeBy(t.author), portrait: fileUrl(path.join(publicDir, "about", "artem-okhten-oil.webp")) },
    version: `v${app.getVersion()}`,
    status: t.phasePort,
  };
  onSplash(`window.splash.setup(${JSON.stringify(data)})`);
}

/**
 * Updates come from the public repository's releases. The page sees every
 * step (preload.cjs → src/lib/updates.ts): checking, downloading with its
 * percent, ready to restart, up to date, failed; it checks at start and every
 * four hours, and each event goes to logs/updater.log. "Later" installs the
 * update when the game quits. The first start of a new version tells the page
 * which version it came from. The Microsoft Store copy is updated by the Store
 * alone (its policy 10.2.5), so it never checks.
 */
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const updates = { status: "idle", version: null, percent: 0, bytesPerSecond: 0, error: null, checkedAt: null, updatedFrom: null };
let updater = null;
const versionFile = () => path.join(app.getPath("userData"), "version.json");

function updaterLog(level, message) {
  try {
    fs.mkdirSync(logDir(), { recursive: true });
    fs.appendFileSync(path.join(logDir(), "updater.log"), `${new Date().toISOString()} ${level} ${String(message).split("\n")[0]}\n`);
  } catch {
    // No log: the update still runs.
  }
}

/** The same steps as the page's reduceUpdate (src/lib/updates.ts), for the state a page asks for when it opens. */
function applyUpdate(state, event) {
  switch (event.type) {
    case "checking":
      return { ...state, status: state.status === "ready" ? "ready" : "checking", error: null };
    case "available":
      return { ...state, status: "downloading", version: event.version, percent: 0 };
    case "progress":
      return { ...state, status: "downloading", percent: event.percent, bytesPerSecond: event.bytesPerSecond };
    case "downloaded":
      return { ...state, status: "ready", version: event.version, percent: 100 };
    case "none":
      return { ...state, status: "none", checkedAt: event.at };
    case "error":
      return { ...state, status: state.status === "ready" ? "ready" : "error", error: event.message };
    default:
      return state;
  }
}

function updateEvent(event) {
  Object.assign(updates, applyUpdate(updates, event));
  updaterLog(event.type === "error" ? "error" : "info", `${event.type}${event.version ? ` ${event.version}` : ""}${event.percent !== undefined ? ` ${Math.round(event.percent)}%` : ""}${event.message ? ` ${event.message}` : ""}`);
  window?.webContents.send("updates:event", event);
}

function updatesSnapshot() {
  return { ...updates, current: app.getVersion(), store: Boolean(process.windowsStore), enabled: Boolean(updater) };
}

const errorText = (error) => String(error?.message ?? error).split("\n")[0].slice(0, 240);

function checkNow() {
  if (!updater || updates.status === "downloading" || updates.status === "ready") return;
  updater.checkForUpdates().catch((error) => {
    // The updater's own "error" event has usually said it already.
    if (updates.status !== "error" || updates.error !== errorText(error)) updateEvent({ type: "error", message: errorText(error) });
  });
}

/** With no window to show it in, the old question in a dialog. */
async function askToRestart(version) {
  const t = text();
  const { response } = await dialog.showMessageBox({ type: "info", buttons: [t.restart, t.later], defaultId: 0, cancelId: 1, message: t.updateReady(version), detail: t.updateDetail });
  if (response === 0) restartToUpdate();
}

function restartToUpdate() {
  if (!updater || updates.status !== "ready") return;
  quitting = true;
  updater.quitAndInstall();
}

function setUpUpdates() {
  const previous = readJson(versionFile(), {}).version;
  if (previous && previous !== app.getVersion()) updates.updatedFrom = previous;
  writeJson(versionFile(), { version: app.getVersion() });
  if (!app.isPackaged || process.windowsStore) return;
  try {
    const { autoUpdater } = require("electron-updater");
    updater = autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = { info: (m) => updaterLog("info", m), warn: (m) => updaterLog("warn", m), error: (m) => updaterLog("error", m), debug: () => undefined };
    autoUpdater.on("checking-for-update", () => updateEvent({ type: "checking" }));
    autoUpdater.on("update-available", (info) => updateEvent({ type: "available", version: info.version }));
    autoUpdater.on("update-not-available", () => updateEvent({ type: "none", at: Date.now() }));
    autoUpdater.on("download-progress", (p) => updateEvent({ type: "progress", percent: p.percent, bytesPerSecond: p.bytesPerSecond }));
    autoUpdater.on("update-downloaded", (info) => {
      updateEvent({ type: "downloaded", version: info.version });
      if (!window || !window.isVisible()) void askToRestart(info.version);
    });
    autoUpdater.on("error", (error) => updateEvent({ type: "error", message: errorText(error) }));
    checkNow();
    setInterval(checkNow, CHECK_EVERY_MS);
  } catch (error) {
    updaterLog("error", `no updater: ${error}`);
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
  ipcMain.handle("updates:get", (event) => (fromGame(event) ? updatesSnapshot() : null));
  ipcMain.handle("updates:check", (event) => {
    if (fromGame(event)) checkNow();
    return fromGame(event) ? updatesSnapshot() : null;
  });
  ipcMain.handle("updates:restart", (event) => {
    if (fromGame(event)) restartToUpdate();
  });
  ipcMain.handle("updates:seen", (event) => {
    if (fromGame(event)) updates.updatedFrom = null;
  });
}

async function main() {
  Menu.setApplicationMenu(null);
  answerThePage();
  app.setAppUserModelId("com.okhten.gulfoftrump");
  createWindow();
  startup.expected = readJson(startupFile(), {}).waitMs || splashLogic.FIRST_GUESS_MS;
  // The loading screen fills in once it has loaded; the start does not wait more than a moment for it.
  void Promise.race([splashReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    fillSplash();
    paintSplash();
    startup.timer = setInterval(paintSplash, 150);
  });
  phase("port");
  if (!(await portFree(PORT))) {
    dialog.showErrorBox("Gulf of Trump", text().portBusy);
    app.quit();
    return;
  }
  phase("server");
  startServer();
  phase("waiting");
  const waitFrom = Date.now();
  try {
    await waitForServer();
  } catch {
    clearInterval(startup.timer);
    dialog.showErrorBox("Gulf of Trump", text().noStart(logDir()));
    app.quit();
    return;
  }
  writeJson(startupFile(), { waitMs: splashLogic.nextEstimate(startup.expected, Date.now() - waitFrom) });
  phase("opening");
  // A click before the first page has finished loading aborts this load; the start goes on regardless.
  if (window) await window.loadURL(ORIGIN).catch(() => undefined);
  clearInterval(startup.timer);
  setUpUpdates();
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
