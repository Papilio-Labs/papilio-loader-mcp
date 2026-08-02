// flash-page.js — guided 3-step beginner flow (Flash ESP32 → WiFi → FPGA).
// Ported from papilioworks.com/flash/flash.js onto @papilio-loader/flasher-core.
// UI copy/DOM structure intentionally unchanged — validated with real users.
import {
  SerialLineReader,
  flashEsp32,
  sendWifiCredentials,
  watchProvisioningLine,
  flashFpgaOverSerial,
  SERIAL_FPGA_TARGET,
  flashFpgaOta,
  createBrowserXhrPoster,
} from "@papilio-loader/flasher-core";
import { makeLogger, setStatus } from "./dom.js";

export function initFlashPage(doc = document) {
  const els = {
    unsupportedBanner: doc.getElementById("unsupported-banner"),
    log: doc.getElementById("flash-log"),

    esp32File: doc.getElementById("esp32-file"),
    esp32FileLabel: doc.getElementById("esp32-file-label"),
    btnConnect: doc.getElementById("btn-connect"),
    btnFlashEsp32: doc.getElementById("btn-flash-esp32"),
    progressEsp32: doc.getElementById("progress-esp32"),
    statusEsp32: doc.getElementById("status-esp32"),

    wifiSsid: doc.getElementById("wifi-ssid"),
    wifiPass: doc.getElementById("wifi-pass"),
    btnSendWifi: doc.getElementById("btn-send-wifi"),
    statusWifi: doc.getElementById("status-wifi"),
    deviceIp: doc.getElementById("device-ip"),
    deviceIpManual: doc.getElementById("device-ip-manual"),
    btnUseManualIp: doc.getElementById("btn-use-manual-ip"),
    btnFindIp: doc.getElementById("btn-find-ip"),

    fpgaFile: doc.getElementById("fpga-file"),
    fpgaFileLabel: doc.getElementById("fpga-file-label"),
    fpgaTarget: doc.getElementById("fpga-target"),
    btnFlashFpga: doc.getElementById("btn-flash-fpga"),
    progressFpga: doc.getElementById("progress-fpga"),
    statusFpga: doc.getElementById("status-fpga"),
  };

  const log = makeLogger(els.log);
  const otaPoster = createBrowserXhrPoster();

  let serialPort = null;
  let reader = null;
  let deviceIp = null;
  let awaitingReconnect = false;

  if (!("serial" in navigator)) {
    els.unsupportedBanner.hidden = false;
    [els.btnConnect, els.btnFlashEsp32, els.btnSendWifi, els.btnFlashFpga, els.btnFindIp].forEach(
      (btn) => (btn.disabled = true)
    );
    return;
  }

  // A chip-level reset on native ESP32-S3 USB Serial/JTAG resets the USB
  // peripheral itself, so the OS briefly disconnects/reconnects the port.
  // Chrome creates a new SerialPort object for the reappeared device, so we
  // can't compare it against the stale reference — just take whatever port
  // reconnects (this app only ever talks to one board at a time).
  navigator.serial.addEventListener("connect", (event) => {
    if (!awaitingReconnect) return;
    awaitingReconnect = false;
    serialPort = event.target;
    reader = new SerialLineReader(serialPort);
    wireReaderEvents();
    log("Board USB reconnected after reset, resuming serial listener…");
    startSerialListener().catch((err) => log(`Serial listener failed to resume: ${err.message}`));
  });

  function wireReaderEvents() {
    reader.onLine((line) => {
      log(line);
      watchProvisioningLine(line, {
        onIp: (ip) => setDeviceIp(ip),
        onStatus: (message, kind) => setStatus(els.statusWifi, message, kind),
      });
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

  function setDeviceIp(ip) {
    deviceIp = ip;
    els.deviceIp.textContent = ip;
    setStatus(els.statusWifi, `Board connected — IP ${ip}`, "ok");
    updateFlashFpgaEnabled();
  }

  /* -------------------------------------------------------------------- */
  /* File pickers                                                          */
  /* -------------------------------------------------------------------- */

  els.esp32File.addEventListener("change", () => {
    const file = els.esp32File.files[0];
    els.esp32FileLabel.textContent = file ? file.name : "Choose *-merged.bin…";
    updateFlashEsp32Enabled();
  });

  els.fpgaFile.addEventListener("change", () => {
    const file = els.fpgaFile.files[0];
    els.fpgaFileLabel.textContent = file ? file.name : "Choose bitstream .bin…";
    updateFlashFpgaEnabled();
  });

  els.fpgaTarget.addEventListener("change", updateFlashFpgaEnabled);

  function updateFlashEsp32Enabled() {
    els.btnFlashEsp32.disabled = !(serialPort && els.esp32File.files[0]);
  }

  function updateFlashFpgaEnabled() {
    const isRecovery = els.fpgaTarget.value === "/fpga-recover";
    const hasTransport = Boolean(deviceIp || serialPort);
    const hasFile = isRecovery ? Boolean(deviceIp) : Boolean(els.fpgaFile.files[0]);
    els.btnFlashFpga.disabled = !(hasTransport && hasFile);
  }

  // The firmware streams the uploaded bytes verbatim to flash or JTAG SRAM —
  // it never strips Gowin's ASCII comment header, so only headerless .bin
  // ("Binary File" export) works.
  function validateFpgaFileTarget(file, target) {
    if (!file || target === "/fpga-recover") return null;
    if (!/\.bin$/i.test(file.name)) {
      return "Only .bin (Gowin \"Binary File\") bitstreams are supported right now — .fs files are not yet parsed by the firmware.";
    }
    return null;
  }

  /* -------------------------------------------------------------------- */
  /* Step 1 — Connect + flash ESP32 firmware                                */
  /* -------------------------------------------------------------------- */

  els.btnConnect.addEventListener("click", async () => {
    try {
      serialPort = await navigator.serial.requestPort();
      reader = new SerialLineReader(serialPort);
      wireReaderEvents();
      log("Serial port selected.");
      setStatus(els.statusEsp32, "USB connected. Choose a firmware file, then flash.", "ok");
      updateFlashEsp32Enabled();
    } catch (err) {
      log(`Connect failed: ${err.message}`);
      setStatus(els.statusEsp32, `Connect failed: ${err.message}`, "error");
    }
  });

  els.btnFlashEsp32.addEventListener("click", async () => {
    const file = els.esp32File.files[0];
    if (!serialPort || !file) return;

    els.btnFlashEsp32.disabled = true;
    els.btnConnect.disabled = true;
    els.progressEsp32.hidden = false;
    setStatus(els.statusEsp32, "Connecting to ESP32…");

    try {
      const data = new Uint8Array(await file.arrayBuffer());
      await flashEsp32(serialPort, data, {
        onLog: log,
        onProgress: (written, total) => {
          const pct = Math.round((written / total) * 100);
          els.progressEsp32.querySelector(".progress-bar").style.width = `${pct}%`;
        },
      });

      setStatus(els.statusEsp32, "ESP32 flashed.", "ok");
      els.btnSendWifi.disabled = false;

      // Give the board a moment to boot, then resume listening on the same
      // port for its log output (WiFi status, provisioning acks). The board
      // reboots itself automatically — no physical RESET press needed.
      setTimeout(() => {
        startSerialListener().catch((err) => log(`Serial listener failed to start: ${err.message}`));
      }, 1500);
      setStatus(els.statusWifi, "Board rebooting automatically… waiting for it to connect to WiFi.");
    } catch (err) {
      log(`Flash failed: ${err.message}`);
      setStatus(els.statusEsp32, `Flash failed: ${err.message}`, "error");
      els.btnConnect.disabled = false;
      updateFlashEsp32Enabled();
    }
  });

  /* -------------------------------------------------------------------- */
  /* Step 2 — Send WiFi credentials over serial                             */
  /* -------------------------------------------------------------------- */

  els.btnSendWifi.addEventListener("click", async () => {
    const ssid = els.wifiSsid.value.trim();
    const pass = els.wifiPass.value;
    if (!ssid) {
      setStatus(els.statusWifi, "Enter a WiFi network name first.", "error");
      return;
    }

    try {
      await startSerialListener();
      await sendWifiCredentials(serialPort, ssid, pass);
      setStatus(els.statusWifi, "Credentials sent, waiting for board to confirm…");
    } catch (err) {
      log(`Send WiFi credentials failed: ${err.message}`);
      setStatus(els.statusWifi, `Send failed: ${err.message}`, "error");
    }
  });

  els.btnUseManualIp.addEventListener("click", () => {
    const ip = els.deviceIpManual.value.trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      setStatus(els.statusWifi, "Enter a valid IP address (e.g. 192.168.1.42).", "error");
      return;
    }
    setDeviceIp(ip);
    setStatus(els.statusWifi, `Using manually entered IP ${ip}.`, "ok");
  });

  // Two clicks, not one: the port picker only lists devices the OS has
  // already enumerated. The first click tells the user to plug in/power the
  // board; the second (a fresh user gesture, required for requestPort())
  // opens the picker.
  let findIpArmed = false;

  els.btnFindIp.addEventListener("click", async () => {
    if (!findIpArmed) {
      findIpArmed = true;
      els.btnFindIp.textContent = "Now click again to select the port…";
      setStatus(els.statusWifi, "Plug your board into USB now (or press RESET if it's already plugged in), then click the button again.");
      return;
    }

    try {
      serialPort = await navigator.serial.requestPort();
      reader = new SerialLineReader(serialPort);
      wireReaderEvents();
      log("Serial port selected.");
      await startSerialListener();
      setStatus(els.statusWifi, "Listening on USB — press the RESET button on your board to see its IP.");
    } catch (err) {
      log(`Find IP failed: ${err.message}`);
      setStatus(els.statusWifi, `Find IP failed: ${err.message}`, "error");
    } finally {
      findIpArmed = false;
      els.btnFindIp.textContent = "Find My IP";
    }
  });

  /* -------------------------------------------------------------------- */
  /* Step 3 — Flash FPGA bitstream: WiFi OTA first, USB serial fallback      */
  /* -------------------------------------------------------------------- */

  function updateFpgaProgress(loaded, total) {
    const pct = total ? Math.round((loaded / total) * 100) : 0;
    els.progressFpga.querySelector(".progress-bar").style.width = `${pct}%`;
  }

  els.btnFlashFpga.addEventListener("click", async () => {
    const target = els.fpgaTarget.value;
    const file = els.fpgaFile.files[0];
    const isRecovery = target === "/fpga-recover";
    if (!isRecovery && !file) return;

    const mismatchError = validateFpgaFileTarget(file, target);
    if (mismatchError) {
      setStatus(els.statusFpga, mismatchError, "error");
      return;
    }
    if (isRecovery && !deviceIp) {
      setStatus(els.statusFpga, "Recovery requires a known device IP — use Find My IP or send WiFi credentials first.", "error");
      return;
    }

    els.btnFlashFpga.disabled = true;
    els.progressFpga.hidden = false;
    updateFpgaProgress(0, 1);
    setStatus(els.statusFpga, "Uploading to board…");

    try {
      const body = isRecovery ? new ArrayBuffer(0) : await file.arrayBuffer();
      let usedPath = null;

      if (deviceIp) {
        try {
          setStatus(els.statusFpga, "Uploading to board over WiFi…");
          const responseText = await flashFpgaOta(otaPoster, deviceIp, target, body, updateFpgaProgress);
          log(responseText);
          usedPath = "network";
        } catch (otaErr) {
          log(`WiFi OTA upload failed: ${otaErr.message}`);
          if (isRecovery || !serialPort) throw otaErr; // no fallback available
          log("Falling back to USB serial…");
        }
      }

      if (!usedPath) {
        if (isRecovery) throw new Error("Recovery requires a working network/IP path — no USB serial equivalent yet.");
        if (!serialPort) throw new Error("No device IP known and no USB serial port connected.");
        const serialTarget = SERIAL_FPGA_TARGET[target];
        if (!serialTarget) throw new Error("This target has no USB serial equivalent yet — use WiFi OTA.");
        setStatus(els.statusFpga, "No IP known — flashing over USB serial (slower than WiFi)…");
        await flashFpgaOverSerial(serialPort, reader, serialTarget, new Uint8Array(body), updateFpgaProgress);
        usedPath = "serial";
      }

      setStatus(
        els.statusFpga,
        usedPath === "network" ? "FPGA programmed successfully via network." : "FPGA programmed successfully via USB serial.",
        "ok"
      );
    } catch (err) {
      log(`FPGA flash failed: ${err.message}`);
      setStatus(els.statusFpga, `Flash failed: ${err.message}`, "error");
    } finally {
      els.btnFlashFpga.disabled = false;
    }
  });
}
