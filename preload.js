const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petBridge", {
  setInteractive: (interactive) => ipcRenderer.send("cat:set-interactive", interactive),
  quit: () => ipcRenderer.send("cat:quit"),
});
