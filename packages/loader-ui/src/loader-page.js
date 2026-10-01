// loader-page.js — full Device Flash Manager (automatic USB recovery and
// OTA/WiFi selection, plus optional desktop extras).
//
// The primary workflow is deliberately small: choose a file and press
// Program. The USB connection is used to enter the loader; the fastest
// available programming path is then selected automatically.
// Ported from papilioworks.com/loader/loader.js
// onto @papilio-loader/flasher-core, with capability-gated desktop extras
// (LAN discovery, UDP WiFi log monitor, filesystem saved files) that light
// up automatically when running inside the Electron app (window.papilioDesktop).
import {
  SerialLineReader,
  flashEsp32,
  resetEsp32ForIp,
  recoverIntoLoader,
  sendWifiCredentials,
  watchProvisioningLine,
  flashFpgaOverSerial,
  flashEsp32OverSerial,
  resumeAppOverSerial,
  flashFpgaOta,
  resumeEsp32Ota,
  fetchDeviceStatusText,
  createBrowserXhrPoster,
  detectCapabilities,
  classifyStatusResponseText,
  classifyBootLogLine,
  detectBinaryImageType,
} from "@papilio-loader/flasher-core";
import { makeLogger, setStatus } from "./dom.js";

export function initLoaderPage(doc = document, win = window) {
  const capabilities = detectCapabilities(win);

  const els = {
    unsupportedBanner: doc.getElementById("unsupported-banner"),
    log: doc.getElementById("loader-log"),
    btnOpenLog: doc.getElementById("btn-open-log"),
    btnCloseLog: doc.getElementById("btn-close-log"),
    btnClearLog: doc.getElementById("btn-clear-log"),
    transportPreference: doc.getElementById("transport-preference"),

    btnConnect: doc.getElementById("btn-connect"),
    btnFindIp: doc.getElementById("btn-find-ip"),
    statusConnect: doc.getElementById("status-connect"),
    wifiSsid: doc.getElementById("wifi-ssid"),
    wifiPass: doc.getElementById("wifi-pass"),
    btnSendWifi: doc.getElementById("btn-send-wifi"),
    deviceIp: doc.getElementById("device-ip"),
    deviceIpManual: doc.getElementById("device-ip-manual"),
    btnUseManualIp: doc.getElementById("btn-use-manual-ip"),
    deviceRole: doc.getElementById("device-role"),
    btnCheckStatus: doc.getElementById("btn-check-status"),
    btnGotoLoader: doc.getElementById("btn-goto-loader"),
    btnResumeApp: doc.getElementById("btn-resume-app"),
    btnRecoverUsb: doc.getElementById("btn-recover-usb"),
    statusRecover: doc.getElementById("status-recover"),

    fpgaFile: doc.getElementById("fpga-file"),
    fpgaFileLabel: doc.getElementById("fpga-file-label"),
    btnFlashFpga: doc.getElementById("btn-flash-fpga"),
    progressFpga: doc.getElementById("progress-fpga"),
    statusFpga: doc.getElementById("status-fpga"),

    esp32File: doc.getElementById("esp32-file"),
    esp32FileLabel: doc.getElementById("esp32-file-label"),
    btnFlashEsp32: doc.getElementById("btn-flash-esp32"),
    progressEsp32: doc.getElementById("progress-esp32"),
    statusEsp32: doc.getElementById("status-esp32"),

    // Desktop-only extras — present in loader/index.html but hidden unless
    // capabilities.lanDiscovery / wifiLogUdp are true.
    btnLanScan: doc.getElementById("btn-lan-scan"),
    lanScanResults: doc.getElementById("lan-scan-results"),
    wifiLogNote: doc.getElementById("wifi-log-note"),
    wifiLogPanel: doc.getElementById("wifi-log-panel"),

    appVersion: doc.getElementById("app-version"),
  };

  // __LOADER_VERSION__ is replaced at build time (see apps/web/build.mjs);
  // fall back gracefully if this page is ever loaded unbundled.
  if (els.appVersion) {
    els.appVersion.textContent = `v${typeof __LOADER_VERSION__ !== "undefined" ? __LOADER_VERSION__ : "dev"}`;
  }

  const log = makeLogger(els.log);
  const otaPoster = createBrowserXhrPoster();

  let serialPort = null;
  let reader = null;
  let deviceIp = null;
  let awaitingReconnect = false;
  let fpgaImageType = null;
  let esp32ImageType = null;
  let transportPreference = els.transportPreference?.value || "auto";
  let recoveryWatch = null; // { resolve } while a Recover-via-USB boot-log classification is armed
  const reconnectWaiters = new Set();

  els.btnClearLog?.addEventListener("click", () => {
    els.log.textContent = "";
  });
  els.btnOpenLog?.addEventListener("click", async () => {
    try {
      if (!serialPort) {
        serialPort = await navigator.serial.requestPort();
        reader = new SerialLineReader(serialPort);
        wireReaderEvents();
        log("Serial port selected for log monitoring.");
      }
      await startSerialListener();
      els.log.hidden = false;
      setStatus(els.statusConnect, "USB log connection open.", "ok");
    } catch (err) {
      log(`Open log failed: ${err.message}`, "error");
      setStatus(els.statusConnect, `Open log failed: ${err.message}`, "error");
    }
  });
  els.btnCloseLog?.addEventListener("click", async () => {
    try {
      await stopSerialListener();
      serialPort = null;
      reader = null;
      awaitingReconnect = false;
      setStatus(els.statusConnect, "USB log connection closed.");
      updateFlashFpgaEnabled();
      updateFlashEsp32Enabled();
    } catch (err) {
      log(`Close log failed: ${err.message}`, "error");
      setStatus(els.statusConnect, `Close log failed: ${err.message}`, "error");
    }
  });
  els.transportPreference?.addEventListener("change", () => {
    transportPreference = els.transportPreference.value;
  });

  if (!capabilities.webSerial) {
    els.unsupportedBanner.hidden = false;
    [
      els.btnConnect,
      els.btnFindIp,
      els.btnSendWifi,
      els.btnFlashFpga,
      els.btnFlashEsp32,
      els.btnRecoverUsb,
      els.btnOpenLog,
      els.btnCloseLog,
      els.btnGotoLoader,
      els.btnResumeApp,
    ].forEach((btn) => btn && (btn.disabled = true));
    return;
  }

  navigator.serial.addEventListener("connect", (event) => {
    if (!awaitingReconnect) return;
    awaitingReconnect = false;
    serialPort = event.target;
    reader = new SerialLineReader(serialPort);
    wireReaderEvents();
    for (const resolve of reconnectWaiters) resolve(serialPort);
    reconnectWaiters.clear();
    log("Board USB reconnected after reset, resuming serial listener…");
    startSerialListenerWithRetry().catch((err) => log(`Serial listener failed to resume: ${err.message}`, "error"));
  });

  function wireReaderEvents() {
    reader.onLine((line) => {
      log(line);
      watchProvisioningLine(line, {
        onIp: (ip) => setDeviceIp(ip),
        onStatus: (message, kind) => setStatus(els.statusConnect, message, kind),
      });
      if (recoveryWatch) {
        const role = classifyBootLogLine(line);
        if (role) {
          recoveryWatch.resolve(role);
          recoveryWatch = null;
        }
      }
    });
    reader.onDisconnect(() => {
      log("Board USB is re-enumerating after reset — waiting to reconnect…");
      awaitingReconnect = true;
    });
  }

  async function startSerialListener() {
    if (!reader) return;
    if (reader.isRunning) return;
    await reader.start();
  }

  // After a chip-level reset (watchdog-reset or hard_reset) this board's
  // native USB Serial/JTAG re-enumerates, so the port is briefly gone from
  // the OS's device list. Re-opening it too early throws "Failed to open
  // serial port" — retry with backoff instead of a single fixed delay.
  async function startSerialListenerWithRetry(maxAttempts = 15, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await startSerialListener();
        return;
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        log(`Serial port not ready yet (attempt ${attempt}/${maxAttempts}), retrying\u2026`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async function stopSerialListener() {
    if (reader?.isRunning) {
      await reader.stop();
    }
    // SerialLineReader owns the stream but intentionally does not close the
    // port. esptool-js needs the Web Serial port itself to be closed before it
    // can reopen it for the ROM download-mode handshake.
    if (serialPort?.close) {
      try {
        await serialPort.close();
      } catch {
        // It may already be closed after USB re-enumeration.
      }
    }
  }

  async function resumeAppAfterFpga(ip) {
    if (ip) {
      try {
        const responseText = await resumeEsp32Ota(ip);
        log(responseText);
      } catch (err) {
        log(`Resume response race (likely harmless): ${err.message}`);
      }
      return;
    }

    await resumeAppOverSerial(serialPort, reader);
  }

  async function waitForUsbReconnect(previousPort, timeoutMs = 15000) {
    const started = Date.now();

    // Chrome may reattach an authorized Web Serial port without dispatching a
    // new connect event. Give the reset a moment to take effect, then poll the
    // authorized port list so the same SerialPort object can be reopened.
    await new Promise((resolve) => setTimeout(resolve, 250));
    while (Date.now() - started < timeoutMs) {
      if (serialPort && serialPort !== previousPort) return serialPort;

      const ports = await navigator.serial.getPorts();
      const candidate = ports.find((port) => {
        if (!port.connected) return false;
        if (port !== previousPort) return true;
        return !previousPort.connected || !reader?.isRunning;
      });

      if (candidate) {
        if (candidate === previousPort) {
          try {
            await candidate.close();
          } catch {
            // The port may already be closed after USB re-enumeration.
          }
          serialPort = candidate;
          reader = new SerialLineReader(serialPort);
          wireReaderEvents();
          awaitingReconnect = false;
          await startSerialListenerWithRetry();
          log("Board USB reconnected after reset, resuming serial listener…");
        }
        return serialPort;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error("Timed out waiting for the board USB port to reconnect.");
  }

  function setDeviceIp(ip) {
    deviceIp = ip;
    els.deviceIp.textContent = ip;
    setStatus(els.statusConnect, `Board connected — IP ${ip}`, "ok");
    els.btnCheckStatus.disabled = false;
    updateFlashFpgaEnabled();
    updateFlashEsp32Enabled();
    checkDeviceStatus().catch((err) => log(`Status check failed: ${err.message}`, "error"));
  }

  async function ensureUsbPort() {
    if (serialPort) return;
    serialPort = await navigator.serial.requestPort();
    reader = new SerialLineReader(serialPort);
    wireReaderEvents();
    log("Serial port selected.");
  }

  function waitForDeviceIp(timeoutMs = 12000) {
    if (deviceIp) return Promise.resolve(deviceIp);
    return new Promise((resolve) => {
      const started = Date.now();
      const poll = () => {
        if (deviceIp || Date.now() - started >= timeoutMs) {
          resolve(deviceIp);
          return;
        }
        setTimeout(poll, 250);
      };
      poll();
    });
  }

  async function prepareForProgramming(statusElement, preference = "auto") {
    await ensureUsbPort();

    await stopSerialListener();

    deviceIp = null;
    setStatus(statusElement, "Entering the loader over USB…");
    const classified = new Promise((resolve) => {
      recoveryWatch = { resolve };
      setTimeout(() => {
        if (recoveryWatch) {
          recoveryWatch = null;
          resolve(null);
        }
      }, 12000);
    });

    const previousPort = serialPort;
    awaitingReconnect = true;
    await recoverIntoLoader(serialPort, { onLog: (message) => log(message) });
    await waitForUsbReconnect(previousPort);
    await startSerialListenerWithRetry();
    const role = await classified;
    if (role && role !== "loader") {
      throw new Error("The board did not boot into the loader.");
    }

    if (preference === "usb") {
      setStatus(statusElement, "Loader ready — using USB serial.");
      return null;
    }

    setStatus(statusElement, "Loader ready — looking for WiFi…");
    const ip = await waitForDeviceIp();
    if (preference === "ota" && !ip) {
      throw new Error("OTA / WiFi was selected, but the loader did not report an IP address.");
    }
    if (ip) log(`Loader found at ${ip}; using OTA where supported.`);
    else log("Loader WiFi not available; using USB serial.");
    return ip;
  }

  /* -------------------------------------------------------------------- */
  /* Device status, resume/reboot, and Tier-1 USB recovery                  */
  /* -------------------------------------------------------------------- */

  async function checkDeviceStatus() {
    if (!deviceIp) return;
    els.btnCheckStatus.disabled = true;
    try {
      const bodyText = await fetchDeviceStatusText(deviceIp);
      const role = classifyStatusResponseText(bodyText);
      setStatus(els.deviceRole, role, role === "unknown" ? undefined : "ok");
      els.btnGotoLoader.disabled = false;
      els.btnResumeApp.disabled = false;
    } catch (err) {
      setStatus(els.deviceRole, "unreachable", "error");
      els.btnGotoLoader.disabled = false;
      els.btnResumeApp.disabled = false;
      log(`Status check failed: ${err.message}`, "error");
    } finally {
      els.btnCheckStatus.disabled = !deviceIp;
    }
  }

  // A reboot (goto-loader/resume) takes several seconds — WiFi reconnect
  // alone can take longer than a single one-shot retry on a weak signal, so
  // poll a few times with backoff instead of giving up after one attempt.
  async function pollDeviceStatusAfterReboot(maxAttempts = 8, intervalMs = 2500) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      if (!deviceIp) return;
      setStatus(els.deviceRole, `rebooting\u2026 (checking ${attempt}/${maxAttempts})`);
      try {
        const bodyText = await fetchDeviceStatusText(deviceIp);
        const role = classifyStatusResponseText(bodyText);
        setStatus(els.deviceRole, role, role === "unknown" ? undefined : "ok");
        els.btnGotoLoader.disabled = false;
        els.btnResumeApp.disabled = false;
        els.btnCheckStatus.disabled = false;
        setStatus(els.statusRecover, "Board is back — status updated above.", "ok");
        return;
      } catch (err) {
        // keep retrying — expected while WiFi reassociates after reboot
      }
    }
    setStatus(els.deviceRole, "unreachable", "error");
    els.btnGotoLoader.disabled = false;
    els.btnResumeApp.disabled = false;
    els.btnCheckStatus.disabled = false;
    setStatus(
      els.statusRecover,
      "Board didn't come back over WiFi after reboot (weak signal can take longer, or its IP may have changed). Try Check Board Status again in a bit, re-enter its IP, or use Find My IP / Recover via USB.",
      "error"
    );
  }

  els.btnCheckStatus.addEventListener("click", () => checkDeviceStatus());

  els.btnGotoLoader.addEventListener("click", async () => {
    els.btnGotoLoader.disabled = true;
    setStatus(els.statusRecover, "Opening USB and starting the ESP bootloader\u2026");
    try {
      await prepareForProgramming(els.statusRecover, "ota");
      setStatus(els.statusRecover, "ESP bootloader started over USB.", "ok");
    } catch (err) {
      log(`Start ESP Bootloader failed: ${err.message}`, "error");
      setStatus(els.statusRecover, `Start ESP Bootloader failed: ${err.message}`, "error");
      els.btnGotoLoader.disabled = false;
    }
  });

  els.btnResumeApp.addEventListener("click", async () => {
    els.btnResumeApp.disabled = true;
    setStatus(els.statusRecover, "Opening USB and preparing to resume the user app\u2026");
    try {
      const ip = await prepareForProgramming(els.statusRecover, "ota");
      if (!ip) throw new Error("The board did not report an IP address after USB recovery.");
      const responseText = await resumeEsp32Ota(ip);
      log(responseText);
      setStatus(els.statusRecover, "App resume requested — board is rebooting into it now.", "ok");
    } catch (err) {
      log(`Resume User App failed: ${err.message}`, "error");
      setStatus(els.statusRecover, `Resume User App failed: ${err.message}`, "error");
      els.btnResumeApp.disabled = false;
    }
  });

  els.btnRecoverUsb.addEventListener("click", async () => {
    // recoverIntoLoader() (like resetEsp32ForIp() above) opens its own
    // esptool-js Transport directly on the port, which needs the readable
    // stream free of any existing reader lock — safe when no reader has
    // started yet (fresh connection), not safe to yank out from under an
    // already-running SerialLineReader.
    if (reader?.isRunning) {
      setStatus(
        els.statusRecover,
        "USB recovery needs an idle serial connection — reload this page and click Recover via USB before Connect USB/Find My IP.",
        "error"
      );
      return;
    }

    els.btnRecoverUsb.disabled = true;
    setStatus(els.statusRecover, "Recovering via USB\u2026 do not disconnect the board.");
    try {
      if (!serialPort) {
        serialPort = await navigator.serial.requestPort();
        reader = new SerialLineReader(serialPort);
        wireReaderEvents();
        log("Serial port selected.");
      }

      const classified = new Promise((resolve) => {
        recoveryWatch = { resolve };
        setTimeout(() => {
          if (recoveryWatch) {
            recoveryWatch = null;
            resolve(null);
          }
        }, 8000);
      });

      awaitingReconnect = true;
      await recoverIntoLoader(serialPort, { onLog: (msg) => log(msg) });
      setStatus(els.statusRecover, "Board reset — waiting for it to reboot\u2026");
      startSerialListenerWithRetry().catch((err) => log(`Serial listener failed to resume: ${err.message}`, "error"));

      const role = await classified;
      if (role === "loader") {
        setStatus(els.statusRecover, "Recovered — board is now running the loader. Flash ESP32/FPGA below.", "ok");
      } else if (role === "app") {
        setStatus(
          els.statusRecover,
          "Board rebooted straight back into an app — it may not have needed recovery. Try Reboot to Loader (OTA) once its IP is known.",
          "error"
        );
      } else {
        setStatus(
          els.statusRecover,
          "No boot log seen after recovery — the board may be blank/corrupt and need a full USB/Serial flash instead.",
          "error"
        );
      }
    } catch (err) {
      recoveryWatch = null;
      log(`USB recovery failed: ${err.message}`, "error");
      setStatus(els.statusRecover, `USB recovery failed: ${err.message}`, "error");
    } finally {
      els.btnRecoverUsb.disabled = false;
    }
  });

  /* -------------------------------------------------------------------- */
  /* Connect USB                                                            */
  /* -------------------------------------------------------------------- */

  els.btnConnect.addEventListener("click", async () => {
    try {
      serialPort = await navigator.serial.requestPort();
      reader = new SerialLineReader(serialPort);
      wireReaderEvents();
      log("Serial port selected.");
      setStatus(els.statusConnect, "USB connected.", "ok");
      els.btnSendWifi.disabled = false;
      updateFlashFpgaEnabled();
      updateFlashEsp32Enabled();
    } catch (err) {
      log(`Connect failed: ${err.message}`, "error");
      setStatus(els.statusConnect, `Connect failed: ${err.message}`, "error");
    }
  });

  els.btnFindIp.addEventListener("click", async () => {
    // Already reported its IP earlier this session (e.g. during WiFi
    // provisioning, or a previous Find My IP) — no need to disturb the
    // board again.
    if (deviceIp) {
      setStatus(els.statusConnect, `Already have this board's IP: ${deviceIp}`, "ok");
      return;
    }

    els.btnFindIp.disabled = true;
    try {
      if (!serialPort) {
        serialPort = await navigator.serial.requestPort();
        reader = new SerialLineReader(serialPort);
        wireReaderEvents();
        log("Serial port selected.");
      }

      // This board has no external reset circuit, so make it reprint its
      // boot log (with its IP) by resetting it ourselves instead of asking
      // the user to find and press the physical RESET button.
      //
      // Unlike sendWifiCredentials() (which writes over an already-running
      // reader, so the reset it triggers is naturally caught by that
      // reader's own read loop dying -> onDisconnect() -> awaitingReconnect
      // = true), resetEsp32ForIp() opens its own esptool-js Transport
      // directly on the port instead of going through our SerialLineReader
      // (which isn't running yet at this point) -- so there's no live read
      // loop to notice the reset-induced USB re-enumeration. Flip the flag
      // ourselves so the navigator.serial "connect" listener still adopts
      // the board's new port object once it reappears, instead of the code
      // below retrying against the stale, now-disconnected one until it
      // times out.
      awaitingReconnect = true;
      setStatus(els.statusConnect, "Resetting board to read its IP\u2026");
      await resetEsp32ForIp(serialPort, (msg) => log(msg));
      setStatus(els.statusConnect, "Listening on USB \u2014 waiting for the board to report its IP\u2026");
      // Fallback/no-op: if the "connect" event above has already fired and
      // started a fresh reader, this sees reader.isRunning === true and
      // returns immediately; otherwise it's the one that actually starts it.
      startSerialListenerWithRetry().catch((err) => log(`Serial listener failed to start: ${err.message}`, "error"));
    } catch (err) {
      awaitingReconnect = false;
      log(`Find IP failed: ${err.message}`, "error");
      setStatus(els.statusConnect, `Find IP failed: ${err.message}`, "error");
    } finally {
      els.btnFindIp.disabled = false;
    }
  });

  els.btnUseManualIp.addEventListener("click", () => {
    const ip = els.deviceIpManual.value.trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      setStatus(els.statusConnect, "Enter a valid IP address (e.g. 192.168.1.42).", "error");
      return;
    }
    setDeviceIp(ip);
  });

  els.btnSendWifi.addEventListener("click", async () => {
    const ssid = els.wifiSsid.value.trim();
    const pass = els.wifiPass.value;
    if (!ssid) {
      setStatus(els.statusConnect, "Enter a WiFi network name first.", "error");
      return;
    }
    if (!serialPort) {
      setStatus(els.statusConnect, "Connect USB first.", "error");
      return;
    }

    try {
      await startSerialListener();
      await sendWifiCredentials(serialPort, ssid, pass);
      setStatus(els.statusConnect, "Credentials sent, waiting for board to confirm…");
    } catch (err) {
      log(`Send WiFi credentials failed: ${err.message}`, "error");
      setStatus(els.statusConnect, `Send failed: ${err.message}`, "error");
    }
  });

  /* -------------------------------------------------------------------- */
  /* FPGA card                                                              */
  /* -------------------------------------------------------------------- */

  els.fpgaFile.addEventListener("change", () => {
    const file = els.fpgaFile.files[0];
    els.fpgaFileLabel.textContent = file ? file.name : "Choose bitstream .bin…";
    validateSelectedFile(file, "fpga").then((type) => {
      fpgaImageType = type;
      updateFlashFpgaEnabled();
    });
  });

  function updateFlashFpgaEnabled() {
    els.btnFlashFpga.disabled = !els.fpgaFile.files[0] || fpgaImageType !== "fpga";
  }

  function validateFpgaFile(file) {
    if (!file) return null;
    if (!/\.bin$/i.test(file.name)) {
      return "Only .bin (Gowin \"Binary File\") bitstreams are supported — .fs files are not yet parsed by the firmware.";
    }
    return null;
  }

  async function validateSelectedFile(file, expectedType) {
    if (!file) return null;
    const extensionError = expectedType === "fpga" ? validateFpgaFile(file) : null;
    if (extensionError) {
      setStatus(expectedType === "fpga" ? els.statusFpga : els.statusEsp32, extensionError, "error");
      return "unknown";
    }
    const type = detectBinaryImageType(new Uint8Array(await file.arrayBuffer()));
    if (type !== expectedType) {
      const label = expectedType === "fpga" ? "a Gowin FPGA bitstream" : "ESP32 firmware";
      setStatus(expectedType === "fpga" ? els.statusFpga : els.statusEsp32, `Selected file is not ${label}.`, "error");
    }
    return type;
  }

  function updateFpgaProgress(loaded, total) {
    const pct = total ? Math.round((loaded / total) * 100) : 0;
    els.progressFpga.querySelector(".progress-bar").style.width = `${pct}%`;
  }

  els.btnFlashFpga.addEventListener("click", async () => {
    const file = els.fpgaFile.files[0];

    const mismatchError = validateFpgaFile(file);
    if (mismatchError) {
      setStatus(els.statusFpga, mismatchError, "error");
      return;
    }

    els.btnFlashFpga.disabled = true;
    els.progressFpga.hidden = false;
    updateFpgaProgress(0, 1);

    try {
      const body = await file.arrayBuffer();
      if (detectBinaryImageType(new Uint8Array(body)) !== "fpga") {
        setStatus(els.statusFpga, "Selected file is not a Gowin FPGA bitstream.", "error");
        return;
      }
      const ip = await prepareForProgramming(els.statusFpga, transportPreference);

      if (ip) {
        const responseText = await flashFpgaOta(otaPoster, ip, "/fpga-update", body, updateFpgaProgress);
        log(responseText);
        await resumeAppAfterFpga(ip);
        await stopSerialListener();
        awaitingReconnect = false;
      } else {
        await flashFpgaOverSerial(serialPort, reader, "flash", new Uint8Array(body), updateFpgaProgress);
        await resumeAppAfterFpga();
        await stopSerialListener();
        awaitingReconnect = false;
      }

      log("FPGA write complete; user app resume requested.", "success");
      setStatus(els.statusFpga, "FPGA programmed successfully.", "ok");
    } catch (err) {
      log(`FPGA flash failed: ${err.message}`, "error");
      setStatus(els.statusFpga, `Flash failed: ${err.message}`, "error");
    } finally {
      els.btnFlashFpga.disabled = false;
      updateFlashFpgaEnabled();
    }
  });

  /* -------------------------------------------------------------------- */
  /* ESP32 card                                                             */
  /* -------------------------------------------------------------------- */

  els.esp32File.addEventListener("change", () => {
    const file = els.esp32File.files[0];
    els.esp32FileLabel.textContent = file ? file.name : "Choose ESP32 firmware .bin…";
    validateSelectedFile(file, "esp32").then((type) => {
      esp32ImageType = type;
      updateFlashEsp32Enabled();
    });
  });

  function updateFlashEsp32Enabled() {
    els.btnFlashEsp32.disabled = !els.esp32File.files[0] || esp32ImageType !== "esp32";
  }

  // A merged image contains the ESP-IDF partition table at 0x8000. Images
  // without that table are app-only binaries and must go through the loader's
  // inactive-slot protocol rather than being written at flash offset 0x0.
  function isMergedEsp32Image(data) {
    return data.length >= 0x8002 && data[0] === 0xe9 && data[0x8000] === 0x50 && data[0x8001] === 0xaa;
  }

  els.btnFlashEsp32.addEventListener("click", async () => {
    const file = els.esp32File.files[0];
    if (!file) return;
    const data = new Uint8Array(await file.arrayBuffer());
    if (detectBinaryImageType(data) !== "esp32") {
      setStatus(els.statusEsp32, "Selected file is not ESP32 firmware.", "error");
      updateFlashEsp32Enabled();
      return;
    }

    els.btnFlashEsp32.disabled = true;
    els.progressEsp32.hidden = false;

    try {
      if (isMergedEsp32Image(data)) {
        await ensureUsbPort();
        await stopSerialListener();
        setStatus(els.statusEsp32, "Connecting to ESP32 over USB…");
        // Merged images are flashed by esptool in ROM download mode.
        await flashEsp32(serialPort, data, {
          onLog: (msg) => log(msg, "success"),
          onProgress: (written, total) => {
            const pct = Math.round((written / total) * 100);
            els.progressEsp32.querySelector(".progress-bar").style.width = `${pct}%`;
          },
        });
        await stopSerialListener();
        awaitingReconnect = false;
        log("ESP32 write complete; USB serial port closed.", "success");
        setStatus(els.statusEsp32, "ESP32 flashed. Board rebooting automatically.", "ok");
      } else {
        setStatus(els.statusEsp32, "App image detected — entering the loader…");
        await prepareForProgramming(els.statusEsp32);
        setStatus(els.statusEsp32, "Streaming app image into the inactive slot…");
        await flashEsp32OverSerial(serialPort, reader, data, (loaded, total) => {
          const pct = total ? Math.round((loaded / total) * 100) : 0;
          els.progressEsp32.querySelector(".progress-bar").style.width = `${pct}%`;
        });
        await stopSerialListener();
        awaitingReconnect = false;
        log("ESP32 write complete; USB serial port closed.", "success");
        setStatus(els.statusEsp32, "ESP32 app flashed into the inactive slot. Board rebooting automatically.", "ok");
      }
      els.btnSendWifi.disabled = false;
    } catch (err) {
      log(`ESP32 flash failed: ${err.message}`, "error");
      setStatus(els.statusEsp32, `Flash failed: ${err.message}`, "error");
    } finally {
      updateFlashEsp32Enabled();
    }
  });

  /* -------------------------------------------------------------------- */
  /* Desktop-only extras (LAN discovery, UDP WiFi log)                      */
  /* -------------------------------------------------------------------- */

  if (capabilities.lanDiscovery && win.papilioDesktop?.discoverLan) {
    els.btnLanScan?.removeAttribute("hidden");
    els.btnLanScan?.addEventListener("click", async () => {
      els.btnLanScan.disabled = true;
      els.lanScanResults.textContent = "Scanning subnet for OTA devices…";
      try {
        const devices = await win.papilioDesktop.discoverLan();
        if (!devices.length) {
          els.lanScanResults.textContent = "No devices found.";
        } else {
          els.lanScanResults.innerHTML = "";
          for (const d of devices) {
            const btn = document.createElement("button");
            btn.className = "btn btn-outline";
            btn.textContent = d.ip;
            btn.addEventListener("click", () => setDeviceIp(d.ip));
            els.lanScanResults.appendChild(btn);
          }
        }
      } catch (err) {
        els.lanScanResults.textContent = `Scan failed: ${err.message}`;
      } finally {
        els.btnLanScan.disabled = false;
      }
    });
  }

  if (capabilities.wifiLogUdp && win.papilioDesktop?.subscribeWifiLog && els.wifiLogPanel) {
    els.wifiLogPanel.removeAttribute("hidden");
    const wifiLogOutput = doc.getElementById("wifi-log-output");
    const wifiLog = wifiLogOutput ? makeLogger(wifiLogOutput) : log;
    win.papilioDesktop.subscribeWifiLog((line) => {
      wifiLog(line);
      // The board's periodic WiFi/UDP status log reports its IP too — if
      // we don't already have one cached, this saves a USB reset entirely.
      if (!deviceIp) watchProvisioningLine(line, { onIp: (ip) => setDeviceIp(ip) });
    });
  } else {
    els.wifiLogNote?.removeAttribute("hidden");
  }

  updateFlashFpgaEnabled();
  updateFlashEsp32Enabled();
}
