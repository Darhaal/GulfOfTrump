// The little the game's page may ask of the desktop app's window: full screen
// and quitting (src/lib/desktop.ts). Nothing else crosses over.
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
});
