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

  // Expose how much vertical space at the bottom of our window is occupied by
  // OS chrome (the macOS Dock when it's at the bottom). Renderer uses this to
  // pick a default cat Y that sits above the Dock, even though the window
  // itself extends behind it so the cat can be dragged there.
  ipcMain.handle("cat:get-bottom-inset", () => {
    const workAreaBottom = display.workArea.y + display.workArea.height;
    const boundsBottom = display.bounds.y + display.bounds.height;
    return Math.max(0, boundsBottom - workAreaBottom);
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);