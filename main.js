const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");

function createWindow() {
  // On macOS we use the full display bounds so the cat can roam over the
  // Dock; on Windows/Linux we use workArea to keep the window from being
  // hidden behind the taskbar.
  const display = screen.getPrimaryDisplay();
  const region = process.platform === "darwin" ? display.bounds : display.workArea;

  const win = new BrowserWindow({
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
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

  // On macOS, raise the window above the Dock (the Dock sits at the
  // "dock" level; "screen-saver" floats above it). The second argument
  // ensures the window is also visible over fullscreen apps' menu bar area.
  if (process.platform === "darwin") {
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

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

  ipcMain.on("cat:quit", () => {
    app.quit();
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);