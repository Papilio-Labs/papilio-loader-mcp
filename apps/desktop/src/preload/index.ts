// preload/index.ts — contextBridge surface exposed to the renderer as
// `window.papilioDesktop`. This is the single seam flasher-core's
// `detectCapabilities()` checks for (`Boolean(win.papilioDesktop)`) to decide
// whether to light up desktop-only UI (LAN scan, WiFi log panel, saved files,
// no-CORS release fetch) — see packages/flasher-core/src/capabilities.ts.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("papilioDesktop", {
  discoverLan: () => ipcRenderer.invoke("papilio:discover-lan"),
  checkDeviceIp: (ip: string) => ipcRenderer.invoke("papilio:check-device-ip", ip),
  fetchLatestRelease: (method?: "usb" | "ota") => ipcRenderer.invoke("papilio:fetch-latest-release", method),

  savedFiles: {
    list: (deviceType?: string) => ipcRenderer.invoke("papilio:saved-files-list", deviceType),
    add: (originalFilename: string, deviceType: string, description: string, data: ArrayBuffer) =>
      ipcRenderer.invoke("papilio:saved-files-add", originalFilename, deviceType, description, Buffer.from(data)),
    read: (id: string) => ipcRenderer.invoke("papilio:saved-files-read", id),
    delete: (id: string) => ipcRenderer.invoke("papilio:saved-files-delete", id),
    rename: (id: string, name: string) => ipcRenderer.invoke("papilio:saved-files-rename", id, name),
    describe: (id: string, description: string) => ipcRenderer.invoke("papilio:saved-files-describe", id, description),
    exportZip: () => ipcRenderer.invoke("papilio:saved-files-export-zip"),
    importZip: (data: ArrayBuffer) => ipcRenderer.invoke("papilio:saved-files-import-zip", Buffer.from(data)),
  },

  subscribeWifiLog: (onLine: (line: string) => void) => {
    ipcRenderer.invoke("papilio:wifi-log-subscribe");
    const listener = (_event: Electron.IpcRendererEvent, line: string) => onLine(line);
    ipcRenderer.on("papilio:wifi-log-line", listener);
    return () => ipcRenderer.removeListener("papilio:wifi-log-line", listener);
  },

  // Minimal fallback serial-port picker used only when Electron's
  // select-serial-port handler sees multiple ambiguous candidates with no
  // known-board VID/PID match (see main/index.ts). A real picker dialog is a
  // nice-to-have follow-up; a blocking prompt is a reasonable stopgap since
  // this only fires for the rare multi-device case.
  __pickSerialPort: (ports: Array<{ portId: string; displayName: string }>) => {
    const listing = ports.map((p, i) => `${i + 1}. ${p.displayName}`).join("\n");
    const choice = window.prompt(`Multiple serial devices found — enter a number:\n${listing}`, "1");
    const index = Number(choice) - 1;
    return ports[index]?.portId;
  },
});
