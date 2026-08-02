// loader-page.js — full Device Flash Manager (explicit USB/Serial vs
// OTA/WiFi method selection per card, "fetch latest release" shortcut,
// color-coded status log). Ported from papilioworks.com/loader/loader.js
// onto @papilio-loader/flasher-core, with capability-gated desktop extras
// (LAN discovery, UDP WiFi log monitor, filesystem saved files) that light
// up automatically when running inside the Electron app (window.papilioDesktop).
import {
  SerialLineReader,
  flashEsp32,
  resetEsp32ForIp,
  sendWifiCredentials,
  sendUsbHostHold,
  sendUsbHostResume,
  watchProvisioningLine,
  flashFpgaOverSerial,
  SERIAL_FPGA_TARGET,
  flashFpgaOta,
  flashEsp32Ota,
  createBrowserXhrPoster,
  detectCapabilities,
} from "@papilio-loader/flasher-core";
import { makeLogger, setStatus } from "./dom.js";

const RELEASE_API = "https://api.github.com/repos/Papilio-Retrocade/FPGA-Companion/releases/latest";

export function initLoaderPage(doc = document, win = window) {
  const capabilities = detectCapabilities(win);

  const els = {
    unsupportedBanner: doc.getElementById("unsupported-banner"),
    log: doc.getElementById("loader-log"),
    btnClearLog: doc.getElementById("btn-clear-log"),

    btnConnect: doc.getElementById("btn-connect"),
    btnFindIp: doc.getElementById("btn-find-ip"),
    statusConnect: doc.getElementById("status-connect"),
    wifiSsid: doc.getElementById("wifi-ssid"),
    wifiPass: doc.getElementById("wifi-pass"),
    btnSendWifi: doc.getElementById("btn-send-wifi"),
    deviceIp: doc.getElementById("device-ip"),
    deviceIpManual: doc.getElementById("device-ip-manual"),
    btnUseManualIp: doc.getElementById("btn-use-manual-ip"),
    btnUsbHostHold: doc.getElementById("btn-usb-host-hold"),
    btnUsbHostResume: doc.getElementById("btn-usb-host-resume"),
    statusUsbHost: doc.getElementById("status-usb-host"),

    fpgaFile: doc.getElementById("fpga-file"),
    fpgaFileLabel: doc.getElementById("fpga-file-label"),
    fpgaTarget: doc.getElementById("fpga-target"),
    btnFlashFpga: doc.getElementById("btn-flash-fpga"),
    progressFpga: doc.getElementById("progress-fpga"),
    statusFpga: doc.getElementById("status-fpga"),

    esp32ReleaseFields: doc.getElementById("esp32-release-fields"),
    esp32UploadFields: doc.getElementById("esp32-upload-fields"),
    btnFetchRelease: doc.getElementById("btn-fetch-release"),
    esp32ReleaseLabel: doc.getElementById("esp32-release-label"),
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
  let esp32Release = null; // { name, data } once fetched

  els.btnClearLog?.addEventListener("click", () => {
    els.log.textContent = "";
  });

  if (!capabilities.webSerial) {
    els.unsupportedBanner.hidden = false;
    [els.btnConnect, els.btnFindIp, els.btnSendWifi, els.btnFlashFpga, els.btnFlashEsp32, els.btnUsbHostHold, els.btnUsbHostResume].forEach(
      (btn) => btn && (btn.disabled = true)
    );
    return;
  }

  navigator.serial.addEventListener("connect", (event) => {
    if (!awaitingReconnect) return;
    awaitingReconnect = false;
    serialPort = event.target;
    reader = new SerialLineReader(serialPort);
    wireReaderEvents();
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
      if (line === "USB_HOST_HOLD_OK") {
        setStatus(els.statusUsbHost, "USB console held \u2014 board will not switch to USB Host mode.", "ok");
      } else if (line === "USB_HOST_RESUME_OK") {
        setStatus(els.statusUsbHost, "USB Host mode resumed \u2014 the console may disconnect now.", "ok");
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

  function setDeviceIp(ip) {
    deviceIp = ip;
    els.deviceIp.textContent = ip;
    setStatus(els.statusConnect, `Board connected — IP ${ip}`, "ok");
    updateFlashFpgaEnabled();
    updateFlashEsp32Enabled();
  }

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
      els.btnUsbHostHold.disabled = false;
      els.btnUsbHostResume.disabled = false;
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
        els.btnUsbHostHold.disabled = false;
        els.btnUsbHostResume.disabled = false;
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

  async function sendUsbHostCommand(action, label) {
    if (!serialPort) {
      setStatus(els.statusUsbHost, "Connect USB first.", "error");
      return;
    }
    try {
      await startSerialListener();
      await action(serialPort);
      setStatus(els.statusUsbHost, `${label} sent — waiting for board to confirm…`);
    } catch (err) {
      log(`${label} failed: ${err.message}`, "error");
      setStatus(els.statusUsbHost, `${label} failed: ${err.message}`, "error");
    }
  }

  els.btnUsbHostHold.addEventListener("click", () => sendUsbHostCommand(sendUsbHostHold, "Hold USB Console"));
  els.btnUsbHostResume.addEventListener("click", () => sendUsbHostCommand(sendUsbHostResume, "Resume USB Host"));

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

  function fpgaMethod() {
    return doc.querySelector('input[name="fpga-method"]:checked').value;
  }

  els.fpgaFile.addEventListener("change", () => {
    const file = els.fpgaFile.files[0];
    els.fpgaFileLabel.textContent = file ? file.name : "Choose bitstream .bin…";
    updateFlashFpgaEnabled();
  });

  els.fpgaTarget.addEventListener("change", updateFlashFpgaEnabled);
  doc.querySelectorAll('input[name="fpga-method"]').forEach((r) => r.addEventListener("change", updateFlashFpgaEnabled));

  function updateFlashFpgaEnabled() {
    const method = fpgaMethod();
    const isRecovery = els.fpgaTarget.value === "/fpga-recover";
    const hasFile = isRecovery ? true : Boolean(els.fpgaFile.files[0]);
    const hasTransport = method === "ota" ? Boolean(deviceIp) : Boolean(serialPort) && !isRecovery;
    els.btnFlashFpga.disabled = !(hasFile && hasTransport);
  }

  function validateFpgaFileTarget(file, target) {
    if (!file || target === "/fpga-recover") return null;
    if (!/\.bin$/i.test(file.name)) {
      return "Only .bin (Gowin \"Binary File\") bitstreams are supported — .fs files are not yet parsed by the firmware.";
    }
    return null;
  }

  function updateFpgaProgress(loaded, total) {
    const pct = total ? Math.round((loaded / total) * 100) : 0;
    els.progressFpga.querySelector(".progress-bar").style.width = `${pct}%`;
  }

  els.btnFlashFpga.addEventListener("click", async () => {
    const method = fpgaMethod();
    const target = els.fpgaTarget.value;
    const file = els.fpgaFile.files[0];
    const isRecovery = target === "/fpga-recover";

    const mismatchError = validateFpgaFileTarget(file, target);
    if (mismatchError) {
      setStatus(els.statusFpga, mismatchError, "error");
      return;
    }
    if (method === "usb" && isRecovery) {
      setStatus(els.statusFpga, "Recovery has no USB/Serial equivalent — switch to OTA (WiFi).", "error");
      return;
    }

    els.btnFlashFpga.disabled = true;
    els.progressFpga.hidden = false;
    updateFpgaProgress(0, 1);
    setStatus(els.statusFpga, method === "ota" ? "Uploading to board over WiFi…" : "Uploading to board over USB serial…");

    try {
      const body = isRecovery ? new ArrayBuffer(0) : await file.arrayBuffer();

      if (method === "ota") {
        const responseText = await flashFpgaOta(otaPoster, deviceIp, target, body, updateFpgaProgress);
        log(responseText);
      } else {
        const serialTarget = SERIAL_FPGA_TARGET[target];
        await flashFpgaOverSerial(serialPort, reader, serialTarget, new Uint8Array(body), updateFpgaProgress);
      }

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

  function esp32Method() {
    return doc.querySelector('input[name="esp32-method"]:checked').value;
  }

  function esp32Source() {
    return doc.querySelector('input[name="esp32-source"]:checked').value;
  }

  doc.querySelectorAll('input[name="esp32-source"]').forEach((r) =>
    r.addEventListener("change", () => {
      const useRelease = esp32Source() === "release";
      els.esp32ReleaseFields.hidden = !useRelease;
      els.esp32UploadFields.hidden = useRelease;
      updateFlashEsp32Enabled();
    })
  );
  doc.querySelectorAll('input[name="esp32-method"]').forEach((r) =>
    r.addEventListener("change", () => {
      // A merged.bin fetched for USB/Serial isn't valid for OTA (and vice
      // versa) — force a re-fetch instead of flashing the wrong asset type.
      if (esp32Release) {
        esp32Release = null;
        els.esp32ReleaseLabel.textContent = "not fetched yet — click Fetch Latest Release";
      }
      updateFlashEsp32Enabled();
    })
  );

  els.esp32File.addEventListener("change", () => {
    const file = els.esp32File.files[0];
    els.esp32FileLabel.textContent = file ? file.name : "Choose *-merged.bin…";
    updateFlashEsp32Enabled();
  });

  function updateFlashEsp32Enabled() {
    const method = esp32Method();
    const source = esp32Source();
    const hasFile = source === "release" ? Boolean(esp32Release) : Boolean(els.esp32File.files[0]);
    const hasTransport = method === "ota" ? Boolean(deviceIp) : Boolean(serialPort);
    els.btnFlashEsp32.disabled = !(hasFile && hasTransport);
  }

  // GitHub release assets redirect to objects.githubusercontent.com, which
  // may or may not answer with permissive CORS depending on the asset — on
  // desktop this always works instead (Node fetch, no CORS at all).
  els.btnFetchRelease?.addEventListener("click", async () => {
    els.btnFetchRelease.disabled = true;
    els.esp32ReleaseLabel.textContent = "fetching…";
    const method = esp32Method();
    try {
      let name, data;
      if (capabilities.githubReleaseFetch && win.papilioDesktop?.fetchLatestRelease) {
        ({ name, data } = await win.papilioDesktop.fetchLatestRelease(method));
      } else {
        const resp = await fetch(RELEASE_API);
        if (!resp.ok) throw new Error(`GitHub API HTTP ${resp.status}`);
        const release = await resp.json();
        // OTA needs the app-only image, not the -merged.bin (bootloader +
        // partition table + app) used for USB/Serial esptool flashing —
        // sending the merged image over OTA fails image validation on the
        // board (it tries to boot-verify the bootloader bytes as the app).
        const asset = (release.assets || []).find((a) =>
          method === "ota"
            ? /\.bin$/i.test(a.name) && !/-merged\.bin$/i.test(a.name) && !/^(bootloader|partition-table|ota_data_initial)\.bin$/i.test(a.name)
            : /-merged\.bin$/i.test(a.name)
        );
        if (!asset) throw new Error(`No matching .bin asset found in the latest release for ${method} flashing.`);
        log(`Downloading ${asset.name} from ${release.tag_name}…`);
        const assetResp = await fetch(asset.browser_download_url);
        if (!assetResp.ok) throw new Error(`Asset download HTTP ${assetResp.status}`);
        data = new Uint8Array(await assetResp.arrayBuffer());
        name = `${asset.name} (${release.tag_name})`;
      }

      esp32Release = { name, data };
      els.esp32ReleaseLabel.textContent = name;
      log(`Fetched ${name} (${data.byteLength} bytes).`, "success");
    } catch (err) {
      esp32Release = null;
      els.esp32ReleaseLabel.textContent = "fetch failed (likely CORS) — switch to \"Upload my own\" instead";
      log(`Fetch latest release failed: ${err.message}`, "error");
    } finally {
      els.btnFetchRelease.disabled = false;
      updateFlashEsp32Enabled();
    }
  });

  els.btnFlashEsp32.addEventListener("click", async () => {
    const method = esp32Method();
    const source = esp32Source();

    let data;
    if (source === "release") {
      if (!esp32Release) return;
      data = esp32Release.data;
    } else {
      const file = els.esp32File.files[0];
      if (!file) return;
      data = new Uint8Array(await file.arrayBuffer());
    }

    els.btnFlashEsp32.disabled = true;
    els.progressEsp32.hidden = false;
    setStatus(els.statusEsp32, method === "ota" ? "Uploading to board over WiFi…" : "Connecting to ESP32…");

    try {
      if (method === "ota") {
        const responseText = await flashEsp32Ota(otaPoster, deviceIp, data, (loaded, total) => {
          const pct = total ? Math.round((loaded / total) * 100) : 0;
          els.progressEsp32.querySelector(".progress-bar").style.width = `${pct}%`;
        });
        log(responseText);
        setStatus(els.statusEsp32, "ESP32 firmware updated over WiFi.", "ok");
      } else {
        await flashEsp32(serialPort, data, {
          onLog: (msg) => log(msg, "success"),
          onProgress: (written, total) => {
            const pct = Math.round((written / total) * 100);
            els.progressEsp32.querySelector(".progress-bar").style.width = `${pct}%`;
          },
        });
        setStatus(els.statusEsp32, "ESP32 flashed. Board rebooting automatically.", "ok");
        els.btnSendWifi.disabled = false;
        startSerialListenerWithRetry().catch((err) => log(`Serial listener failed to start: ${err.message}`, "error"));
      }
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
