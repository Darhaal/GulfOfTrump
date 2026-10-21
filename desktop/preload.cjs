// The little the game's page may ask of the desktop app's window: full screen,
// quitting and the updates (src/lib/desktop.ts, src/lib/updates.ts). Nothing
// else crosses over, and main.cjs answers only the game's own page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gulfDesktop", {
  isFullScreen: () => ipcRenderer.invoke("window:is-full-screen"),
  setFullScreen: (on) => ipcRenderer.invoke("window:set-full-screen", on === true),
  onFullScreen: (listener) => {
    const handler = (_event, on) => listener(on === true);
    ipcRenderer.on("window:full-screen", handler);
    return () => ipcRenderer.removeListener("window:full-screen", handler);
  },
  quit: () => ipcRenderer.invoke("app:quit"),
  updates: {
    get: () => ipcRenderer.invoke("updates:get"),
    check: () => ipcRenderer.invoke("updates:check"),
    restart: () => ipcRenderer.invoke("updates:restart"),
    seen: () => ipcRenderer.invoke("updates:seen"),
    onEvent: (listener) => {
      const handler = (_event, update) => listener(update);
      ipcRenderer.on("updates:event", handler);
      return () => ipcRenderer.removeListener("updates:event", handler);
    },
  },
});
