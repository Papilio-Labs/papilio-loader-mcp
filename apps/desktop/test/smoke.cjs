const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { createSocket } = require("node:dgram");

const userData = process.env.PAPILIO_SMOKE_USER_DATA;
assert.ok(userData, "Run through npm run test:smoke to isolate user data.");
app.setPath("userData", userData);
require("../dist/main/index.js");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(operation, message) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await operation()) return;
    await delay(50);
  }
  throw new Error(`Timed out: ${message}`);
}

app.whenReady().then(async () => {
  const sender = createSocket("udp4");
  await new Promise((resolve) => sender.bind(0, "127.0.0.1", resolve));
  let exitCode = 0;
  const errors = [];
  try {
    const main = BrowserWindow.getAllWindows()[0];
    main.webContents.on("console-message", (event) => {
      if (event.level === "error") errors.push(event.message);
    });
    const run = (code) => main.webContents.executeJavaScript(code);
    await waitFor(() => run('Boolean(document.querySelector("#saved-files-panel") && !document.querySelector("#saved-files-panel").hidden)'), "desktop UI initialization");
    await waitFor(() => run('document.querySelector("[data-status]").textContent.includes("Listening")'), "UDP listening");

    await run(`(() => {
      const input = document.querySelector("#fpga-file");
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array([...Array(22).fill(255), 165, 195, 1])], "core.bin"));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change"));
      document.querySelector("#fpga-save-name").value = "Arcade";
      document.querySelector("#fpga-save-description").value = "Original description";
      document.querySelector("#btn-save-fpga").click();
    })()`);
    await waitFor(() => run('document.querySelectorAll(".saved-file-card").length === 1'), "saving offline");
    assert.match(await run('document.querySelector(".saved-file-card").textContent'), /Arcade\.bin.*Original description/s);
    await run('document.querySelector("#saved-files-panel").open = true; document.querySelector(".saved-file-card button").click()');
    await waitFor(() => run('document.querySelector("#fpga-file").files[0]?.name === "Arcade.bin" && !document.querySelector("#btn-flash-fpga").disabled'), "loading and image validation");
    assert.equal(await run('document.querySelector("#fpga-save").checked'), false);

    for (const [label, value] of [["Rename", "Renamed"], ["Edit Description", "Edited description"]]) {
      await run(`Array.from(document.querySelectorAll(".saved-file-card button")).find(b => b.textContent === ${JSON.stringify(label)}).click()`);
      await waitFor(() => run('document.querySelector("#saved-file-edit").open'), "edit dialog");
      await run(`document.querySelector("#saved-file-edit-value").value = ${JSON.stringify(value)}; document.querySelector("#saved-file-edit button[value=save]").click()`);
      await waitFor(() => run(`document.querySelector(".saved-file-card").textContent.includes(${JSON.stringify(value)})`), label);
    }
    await run('document.querySelector("#saved-files-filter").value = "esp32"; document.querySelector("#saved-files-filter").dispatchEvent(new Event("change"))');
    await waitFor(() => run('document.querySelectorAll(".saved-file-card").length === 0'), "ESP32 filter");
    await run('document.querySelector("#saved-files-filter").value = ""; document.querySelector("#saved-files-filter").dispatchEvent(new Event("change"))');
    await waitFor(() => run('document.querySelectorAll(".saved-file-card").length === 1'), "all-files filter");

    await run(`(() => {
      window.smokePortRequests = 0;
      navigator.serial.getPorts = async () => [];
      navigator.serial.requestPort = async () => { window.smokePortRequests++; throw new Error("Smoke test: no board"); };
      const input = document.querySelector("#esp32-file");
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array([233, 1, 2])], "app.bin"));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change"));
      document.querySelector("#esp32-save").checked = true;
      document.querySelector("#esp32-save-name").value = "../invalid.bin";
    })()`);
    await waitFor(() => run('!document.querySelector("#btn-flash-esp32").disabled'), "ESP32 image validation");
    await run('document.querySelector("#btn-flash-esp32").click()');
    await waitFor(() => run('document.querySelector("#status-esp32").classList.contains("is-error")'), "save failure aborts programming");
    assert.equal(await run('window.smokePortRequests'), 0, "A failed save must not request hardware");
    await run('document.querySelector("#esp32-save-name").value = "app.bin"; document.querySelector("#btn-flash-esp32").click()');
    await waitFor(() => run('document.querySelectorAll(".saved-file-card").length === 2 && window.smokePortRequests === 1'), "save before programming");
    assert.equal(await run('document.querySelector("#esp32-save").checked'), false);
    await waitFor(() => run('document.querySelector("#status-esp32").textContent.includes("Smoke test: no board")'), "save persists after programming failure");

    const exportPath = path.join(userData, "export.zip");
    const downloaded = new Promise((resolve, reject) => {
      main.webContents.session.once("will-download", (_event, item) => {
        item.setSavePath(exportPath);
        item.once("done", (_event, state) => state === "completed" ? resolve() : reject(new Error(`Download ${state}`)));
      });
    });
    await run('document.querySelector("#btn-export-files").click()');
    await Promise.race([downloaded, delay(10000).then(() => { throw new Error("Export download timed out"); })]);
    const archive = [...readFileSync(exportPath)];
    await run(`(() => {
      const input = document.querySelector("#import-files");
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(${JSON.stringify(archive)})], "export.zip"));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change"));
    })()`);
    await waitFor(() => run('document.querySelectorAll(".saved-file-card").length === 4'), "ZIP import UI");
    await run('window.confirm = () => true; Array.from(document.querySelectorAll(".saved-file-card button")).find(b => b.textContent === "Delete").click()');
    await waitFor(() => run('document.querySelectorAll(".saved-file-card").length === 3'), "delete UI");
    main.reload();
    await waitFor(() => run('document.querySelectorAll(".saved-file-card").length === 3'), "persistence after reload");

    await run('document.querySelector("[data-popout]").click()');
    await waitFor(() => BrowserWindow.getAllWindows().length === 2, "pop-out window");
    const popup = BrowserWindow.getAllWindows().find((window) => window !== main);
    const runPopup = (code) => popup.webContents.executeJavaScript(code);
    await waitFor(() => runPopup('document.querySelector("[data-status]")?.textContent.includes("Listening")'), "pop-out listener");
    popup.setContentSize(1600, 900);
    await waitFor(() => runPopup('Math.abs(document.querySelector("main").getBoundingClientRect().width - innerWidth) < 2'), "log fills wide window");
    assert.equal(await runPopup('innerWidth > 1140'), true, "Wide-window test must exceed the loader page width cap");
    popup.maximize();
    await waitFor(() => popup.isMaximized(), "maximize log window");
    await waitFor(() => runPopup('Math.abs(document.querySelector("main").getBoundingClientRect().width - innerWidth) < 2'), "log fills maximized window");
    popup.unmaximize();
    await run('document.querySelector("[data-popout]").click()');
    assert.equal(BrowserWindow.getAllWindows().length, 2, "Pop Out must reuse its window");
    sender.send(Buffer.from("\x1b[31mSMOKE-RED\x1b[0m\nsecond line"), 7777, "127.0.0.1");
    for (const evaluate of [run, runPopup]) {
      await waitFor(() => evaluate('document.querySelector("[data-output]").textContent.includes("SMOKE-RED")'), "UDP fan-out");
      assert.equal(await evaluate('document.querySelector("[data-count]").textContent'), "2 lines");
      assert.equal(await evaluate('document.querySelector("[data-output] span").style.color'), "rgb(248, 81, 73)");
    }
    await runPopup('document.querySelector("[data-stop]").click()');
    await delay(100);
    sender.send(Buffer.from("MAIN-ONLY"), 7777, "127.0.0.1");
    await waitFor(() => run('document.querySelector("[data-output]").textContent.includes("MAIN-ONLY")'), "main listener while popup stopped");
    assert.equal(await runPopup('document.querySelector("[data-output]").textContent.includes("MAIN-ONLY")'), false);
    await runPopup('document.querySelector("[data-reconnect]").click()');
    await waitFor(() => runPopup('document.querySelector("[data-status]").textContent.includes("Listening")'), "reconnect");
    await runPopup('document.querySelector("[data-clear]").click(); document.querySelector("[data-autoscroll]").checked = false');
    assert.equal(await runPopup('document.querySelector("[data-count]").textContent'), "0 lines");
    sender.send(Buffer.from(Array.from({ length: 2005 }, (_, i) => `BOUNDED-${i}`).join("\n")), 7777, "127.0.0.1");
    await waitFor(() => runPopup('document.querySelector("[data-output]").textContent.includes("BOUNDED-2004")'), "bounded log buffer");
    assert.equal(await runPopup('document.querySelector("[data-count]").textContent'), "2000 lines");
    assert.equal(await runPopup('document.querySelector("[data-output]").scrollTop'), 0, "Auto-scroll off preserves scroll position");
    sender.send(Buffer.from('<img src=x onerror="window.smokeInjected=true">'), 7777, "127.0.0.1");
    await waitFor(() => runPopup('document.querySelector("[data-output]").textContent.includes("<img")'), "literal log text");
    assert.equal(await runPopup('!!document.querySelector("[data-output] img") || !!window.smokeInjected'), false);
    await runPopup('document.querySelector("[data-autoscroll]").checked = true');
    main.close();
    assert.equal(main.isVisible(), false, "Main close hides to tray");
    sender.send(Buffer.from("POPUP-AFTER-MAIN-CLOSE"), 7777, "127.0.0.1");
    await waitFor(() => runPopup('document.querySelector("[data-output]").textContent.includes("POPUP-AFTER-MAIN-CLOSE")'), "independent popup");
    assert.equal(await runPopup('const output = document.querySelector("[data-output]"); Math.abs(output.scrollHeight - output.clientHeight - output.scrollTop) < 2'), true, "Auto-scroll on follows new output");
    popup.close();
    await delay(100);
    sender.send(Buffer.from("MAIN-AFTER-POPUP-CLOSE"), 7777, "127.0.0.1");
    await waitFor(() => run('document.querySelector("[data-output]").textContent.includes("MAIN-AFTER-POPUP-CLOSE")'), "main listener after popup close");
    await run('document.querySelector("[data-stop]").click()');
    assert.deepEqual(errors, [], "Renderer must not log errors");
    console.log("PASS: Electron saved-file CRUD, filter, ZIP download/import, reload persistence, pop-out reuse, ANSI rendering, UDP fan-out, Stop/Reconnect/Clear, and independent window lifecycle.");
  } catch (err) {
    exitCode = 1;
    console.error(err);
  } finally {
    sender.close();
    app.once("will-quit", () => {
      app.exit(exitCode);
    });
    app.quit();
  }
});
