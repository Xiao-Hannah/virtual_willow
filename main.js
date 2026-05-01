const { app, BrowserWindow, screen } = require("electron");

function createWindow() {
  const { bounds } = screen.getPrimaryDisplay();

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y + bounds.height - 220, // 👈 关键：贴近 Dock
    width: bounds.width,
    height: 220,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);