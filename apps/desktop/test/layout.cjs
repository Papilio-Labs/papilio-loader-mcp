const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const path = require("node:path");

assert.ok(process.env.PAPILIO_SMOKE_USER_DATA, "Run through npm run test:layout.");
app.setPath("userData", process.env.PAPILIO_SMOKE_USER_DATA);

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1000, height: 680 });
  let exitCode = 0;
  try {
    await window.loadFile(path.join(__dirname, "../../web/wifi-log/index.html"));
    const measure = () => window.webContents.executeJavaScript(`(() => {
      const main = document.querySelector("main").getBoundingClientRect();
      const panel = document.querySelector("#wifi-log-panel").getBoundingClientRect();
      return { viewport: innerWidth, width: main.width, panelWidth: panel.width };
    })()`);
    for (const width of [1000, 1600]) {
      window.setContentSize(width, 900);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const dimensions = await measure();
      assert.ok(Math.abs(dimensions.width - dimensions.viewport) < 2, `Log must fill ${width}px window`);
      assert.ok(Math.abs(dimensions.panelWidth - (dimensions.viewport - 32)) < 2, "Panel must fill width minus padding");
    }
    window.maximize();
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.ok(window.isMaximized(), "Window must be maximized");
    const dimensions = await measure();
    assert.ok(Math.abs(dimensions.width - dimensions.viewport) < 2, "Log must fill maximized window");
    console.log("PASS: WiFi log fills normal, 1600px-wide, and maximized Electron windows.");
  } catch (err) {
    console.error(err);
    exitCode = 1;
  } finally {
    app.exit(exitCode);
  }
});
