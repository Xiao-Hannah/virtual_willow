const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");

function createWindow() {
  // workArea excludes the taskbar/dock. We cover it entirely so the cat can
  // be dragged anywhere on screen; the window itself is fully transparent
  // and click-through except over the cat sprite.
  const { workArea } = screen.getPrimaryDisplay();

  const win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Click-through everywhere by default; mouse-move events are still forwarded
  // to the renderer so it can detect when the cursor enters the cat hitbox
  // and re-enable interaction via the "cat:set-interactive" IPC.
  win.setIgnoreMouseEvents(true, { forward: true });

  ipcMain.on("cat:set-interactive", (_event, interactive) => {
    if (interactive) {
      win.setIgnoreMouseEvents(false);
    } else {
      win.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);