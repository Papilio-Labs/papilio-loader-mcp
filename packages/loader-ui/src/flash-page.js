// flash-page.js — guided 3-step beginner flow (Flash ESP32 → WiFi → FPGA).
// Ported from papilioworks.com/flash/flash.js onto @papilio-loader/flasher-core.
// UI copy/DOM structure intentionally unchanged — validated with real users.
import {
  SerialLineReader,
  flashEsp32,
  sendWifiCredentials,
  watchProvisioningLine,
  flashFpgaOverSerial,
  resumeAppOverSerial,
  SERIAL_FPGA_TARGET,
  flashFpgaOta,
  uploadRomOta,
  resumeEsp32Ota,
  createBrowserXhrPoster,
  detectBinaryImageType,
} from "@papilio-loader/flasher-core";
import { makeLogger, setStatus } from "./dom.js";

export function initFlashPage(doc = document) {
  const els = {
    unsupportedBanner: doc.getElementById("unsupported-banner"),
    log: doc.getElementById("flash-log"),
    logWrap: doc.getElementById("flash-log-wrap"),
    btnOpenLog: doc.getElementById("btn-open-log"),
    btnCloseLog: doc.getElementById("btn-close-log"),

    esp32File: doc.getElementById("esp32-file"),
    esp32FileLabel: doc.getElementById("esp32-file-label"),
    esp32BundledVersion: doc.getElementById("esp32-bundled-version"),
    esp32Advanced: doc.getElementById("esp32-advanced"),
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
    btnFlashA2600: doc.getElementById("btn-flash-a2600"),
    statusA2600: doc.getElementById("status-a2600"),
    btnLoadRom: doc.getElementById("btn-load-rom"),
    statusRom: doc.getElementById("status-rom"),
    transportPreference: doc.getElementById("transport-preference"),
  };

  if (els.fpgaTarget) els.fpgaTarget.value = "/fpga-update";

  const log = makeLogger(els.log);
  const otaPoster = createBrowserXhrPoster();
  let transportPreference = els.transportPreference?.value || "auto";

  els.btnOpenLog?.addEventListener("click", async () => {
    try {
      if (!serialPort) {
        serialPort = await navigator.serial.requestPort();
        reader = new SerialLineReader(serialPort);
        wireReaderEvents();
        log("Serial port selected for log monitoring.");
      }
      await startSerialListener();
      els.logWrap.open = true;
      setStatus(els.statusWifi, "USB log connection open.", "ok");
    } catch (err) {
      log(`Open log failed: ${err.message}`);
      setStatus(els.statusWifi, `Open log failed: ${err.message}`, "error");
    }
  });
  els.btnCloseLog?.addEventListener("click", async () => {
    try {
      await closeSerialSession();
      serialPort = null;
      reader = null;
      awaitingReconnect = false;
      setStatus(els.statusWifi, "USB log connection closed.");
      updateFlashEsp32Enabled();
      updateFlashFpgaEnabled();
    } catch (err) {
      log(`Close log failed: ${err.message}`);
      setStatus(els.statusWifi, `Close log failed: ${err.message}`, "error");
    }
  });
  els.transportPreference?.addEventListener("change", () => {
    transportPreference = els.transportPreference.value;
  });

  let serialPort = null;
  let reader = null;
  let esp32ImageType = null;
  let fpgaImageType = null;
  let deviceIp = null;
  let awaitingReconnect = false;
  // Bundled firmware manifest (same-origin firmware/manifest.json, written by
  // scripts/fetch-latest-firmware.mjs during the deploy build). Lets Step 1
  // flash the latest official release with no manual download — falls back
  // to the file picker below if the manifest can't be fetched.
  let bundledFirmware = null; // { version, fileName } once fetched
  let bundledA2600Core = null;
  let bundledA2600Rom = null;
  const assetVersion = typeof __LOADER_VERSION__ !== "undefined" ? __LOADER_VERSION__ : "dev";

  if (!("serial" in navigator)) {
    els.unsupportedBanner.hidden = false;
    [els.btnConnect, els.btnFlashEsp32, els.btnSendWifi, els.btnFlashFpga, els.btnFlashA2600, els.btnLoadRom, els.btnFindIp, els.btnOpenLog, els.btnCloseLog].forEach(
      (btn) => (btn.disabled = true)
    );
    return;
  }

  if (els.esp32BundledVersion) {
    fetch(`firmware/manifest.json?v=${encodeURIComponent(assetVersion)}`)
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      })
      .then((manifest) => {
        bundledFirmware = manifest;
        bundledA2600Core = manifest.artifacts?.a2600Core || null;
        bundledA2600Rom = manifest.artifacts?.a2600Rom || null;
        els.esp32BundledVersion.textContent = manifest.version;
        updateFlashEsp32Enabled();
        updateA2600Enabled();
      })
      .catch((err) => {
        log(`Bundled firmware unavailable (${err.message}) — use "different firmware file" below.`);
        els.esp32BundledVersion.textContent = "unavailable";
        if (els.esp32Advanced) els.esp32Advanced.open = true;
        updateFlashEsp32Enabled();
        updateA2600Enabled();
      });
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

  async function startSerialListenerWithRetry(maxAttempts = 3, delayMs = 750) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await startSerialListener();
        return;
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        log(`USB serial port not ready (attempt ${attempt}/${maxAttempts}), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async function closeSerialSession() {
    if (reader?.isRunning) await reader.stop();
    if (serialPort?.close) {
      try {
        await serialPort.close();
      } catch {
        // The port may already be closed after USB re-enumeration.
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

  function setDeviceIp(ip) {
    deviceIp = ip;
    els.deviceIp.textContent = ip;
    setStatus(els.statusWifi, `Board connected — IP ${ip}`, "ok");
    updateFlashFpgaEnabled();
    updateA2600Enabled();
  }

  /* -------------------------------------------------------------------- */
  /* File pickers                                                          */
  /* -------------------------------------------------------------------- */

  els.esp32File.addEventListener("change", async () => {
    const file = els.esp32File.files[0];
    els.esp32FileLabel.textContent = file ? file.name : "Choose *-merged.bin…";
    esp32ImageType = file ? detectBinaryImageType(new Uint8Array(await file.arrayBuffer())) : null;
    if (file && esp32ImageType !== "esp32") setStatus(els.statusEsp32, "Selected file is not ESP32 firmware.", "error");
    updateFlashEsp32Enabled();
  });

  els.fpgaFile.addEventListener("change", async () => {
    const file = els.fpgaFile.files[0];
    els.fpgaFileLabel.textContent = file ? file.name : "Choose bitstream .bin…";
    fpgaImageType = file ? detectBinaryImageType(new Uint8Array(await file.arrayBuffer())) : null;
    if (file && fpgaImageType !== "fpga") setStatus(els.statusFpga, "Selected file is not a Gowin FPGA bitstream.", "error");
    updateFlashFpgaEnabled();
  });

  els.fpgaTarget.addEventListener("change", updateFlashFpgaEnabled);

  function updateFlashEsp32Enabled() {
    const hasFirmware = Boolean(bundledFirmware) || (Boolean(els.esp32File.files[0]) && esp32ImageType === "esp32");
    els.btnFlashEsp32.disabled = !(serialPort && hasFirmware);
  }

  function updateFlashFpgaEnabled() {
    const isRecovery = els.fpgaTarget.value === "/fpga-recover";
    const hasTransport = Boolean(deviceIp || serialPort);
    const hasFile = isRecovery ? Boolean(deviceIp) : Boolean(els.fpgaFile.files[0]) && fpgaImageType === "fpga";
    els.btnFlashFpga.disabled = !(hasTransport && hasFile);
  }

  function updateA2600Enabled() {
    const hasTransport = Boolean(deviceIp || serialPort);
    if (els.btnFlashA2600) els.btnFlashA2600.disabled = !(hasTransport && bundledA2600Core);
    if (els.btnLoadRom) els.btnLoadRom.disabled = !(deviceIp && bundledA2600Rom);
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
      setStatus(
        els.statusEsp32,
        bundledFirmware ? "USB connected. Ready to flash." : "USB connected. Choose a firmware file, then flash.",
        "ok"
      );
      updateFlashEsp32Enabled();
    } catch (err) {
      log(`Connect failed: ${err.message}`);
      setStatus(els.statusEsp32, `Connect failed: ${err.message}`, "error");
    }
  });

  els.btnFlashEsp32.addEventListener("click", async () => {
    const customFile = els.esp32File.files[0];
    if (!serialPort || !(customFile || bundledFirmware)) return;

    els.btnFlashEsp32.disabled = true;
    els.btnConnect.disabled = true;
    els.progressEsp32.hidden = false;
    setStatus(els.statusEsp32, customFile ? "Connecting to ESP32…" : `Downloading bundled firmware ${bundledFirmware.version}…`);

    try {
      let data;
      if (customFile) {
        data = new Uint8Array(await customFile.arrayBuffer());
        if (detectBinaryImageType(data) !== "esp32") {
          setStatus(els.statusEsp32, "Selected file is not ESP32 firmware.", "error");
          return;
        }
      } else {
        const resp = await fetch(
          `firmware/${bundledFirmware.fileName}?v=${encodeURIComponent(assetVersion)}`
        );
        if (!resp.ok) throw new Error(`Firmware download failed (HTTP ${resp.status})`);
        data = new Uint8Array(await resp.arrayBuffer());
        setStatus(els.statusEsp32, "Connecting to ESP32…");
      }
      // esptool-js must own the Web Serial port exclusively while flashing.
      // A log reader left open here causes the browser's "port is already open"
      // error before esptool can enter the ROM bootloader.
      await closeSerialSession();
      await flashEsp32(serialPort, data, {
        onLog: log,
        onProgress: (written, total) => {
          const pct = Math.round((written / total) * 100);
          els.progressEsp32.querySelector(".progress-bar").style.width = `${pct}%`;
        },
      });

      await closeSerialSession();
      log("ESP32 write complete; USB serial port closed.");
      setStatus(els.statusEsp32, "ESP32 flashed.", "ok");
      els.btnSendWifi.disabled = false;
      setStatus(els.statusWifi, "Board rebooting automatically. USB serial port closed.");
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
      await startSerialListenerWithRetry(8, 500);
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
    updateA2600Enabled();
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
      updateA2600Enabled();
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
      if (!isRecovery && detectBinaryImageType(new Uint8Array(body)) !== "fpga") {
        setStatus(els.statusFpga, "Selected file is not a Gowin FPGA bitstream.", "error");
        return;
      }
      let usedPath = null;

      if (transportPreference === "ota" && !deviceIp) {
        throw new Error("OTA / WiFi was selected, but the device IP is not available.");
      }

      if (transportPreference !== "usb" && deviceIp) {
        try {
          setStatus(els.statusFpga, "Uploading to board over WiFi…");
          const responseText = await flashFpgaOta(otaPoster, deviceIp, target, body, updateFpgaProgress);
          log(responseText);
          await resumeAppAfterFpga(deviceIp);
          await closeSerialSession();
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
        await startSerialListenerWithRetry();
        await flashFpgaOverSerial(serialPort, reader, serialTarget, new Uint8Array(body), updateFpgaProgress);
        await resumeAppAfterFpga();
        await closeSerialSession();
        log("FPGA write complete; user app resume requested.");
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

  async function fetchBundledArtifact(artifact) {
    const response = await fetch(`firmware/${artifact.fileName}?v=${encodeURIComponent(assetVersion)}`);
    if (!response.ok) throw new Error(`Download failed (HTTP ${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async function flashBundledA2600() {
    els.btnFlashA2600.disabled = true;
    setStatus(els.statusA2600, `Downloading A2600 core ${bundledA2600Core.release}…`);
    try {
      const data = await fetchBundledArtifact(bundledA2600Core);
      if (detectBinaryImageType(data) !== "fpga") throw new Error("The bundled A2600 file is not a Gowin FPGA bitstream.");
      if (deviceIp) {
        const responseText = await flashFpgaOta(otaPoster, deviceIp, "/fpga-update", data.buffer, updateFpgaProgress);
        log(responseText);
        await resumeAppAfterFpga(deviceIp);
        setStatus(els.statusA2600, "A2600 core programmed successfully via WiFi.", "ok");
      } else if (serialPort) {
        await startSerialListenerWithRetry();
        await flashFpgaOverSerial(serialPort, reader, SERIAL_FPGA_TARGET["/fpga-update"], data, updateFpgaProgress);
        await resumeAppAfterFpga();
        setStatus(els.statusA2600, "A2600 core programmed successfully via USB.", "ok");
      } else {
        throw new Error("Connect USB or enter the board IP first.");
      }
    } catch (err) {
      log(`A2600 core flash failed: ${err.message}`);
      setStatus(els.statusA2600, `A2600 core flash failed: ${err.message}`, "error");
    } finally {
      updateA2600Enabled();
    }
  }

  async function loadBundledRom() {
    els.btnLoadRom.disabled = true;
    setStatus(els.statusRom, "Downloading the Papilio Splash ROM…");
    try {
      const data = await fetchBundledArtifact(bundledA2600Rom);
      const responseText = await uploadRomOta(otaPoster, deviceIp, bundledA2600Rom.fileName, data.buffer, updateFpgaProgress);
      log(responseText);
      setStatus(els.statusRom, "Papilio Splash ROM uploaded and inserted. A FAT-formatted SD card is required.", "ok");
    } catch (err) {
      log(`ROM upload failed: ${err.message}`);
      setStatus(els.statusRom, `ROM upload failed: ${err.message}`, "error");
    } finally {
      updateA2600Enabled();
    }
  }

  els.btnFlashA2600?.addEventListener("click", flashBundledA2600);
  els.btnLoadRom?.addEventListener("click", loadBundledRom);
}
