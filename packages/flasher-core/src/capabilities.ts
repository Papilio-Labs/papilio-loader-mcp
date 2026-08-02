// capabilities.ts — the capability model the UI asks the host about at
// startup so one UI can render correctly on both web and desktop with no
// forks. See plan doc's "Capability model" table.
export interface HostCapabilities {
  webSerial: boolean;
  httpOta: boolean;
  lanDiscovery: boolean;
  githubReleaseFetch: boolean;
  savedFilesFilesystem: boolean;
  wifiLogUdp: boolean;
  mcpServer: boolean;
  serialPortAutoSelect: boolean;
}

export const WEB_CAPABILITIES: HostCapabilities = {
  webSerial: true,
  httpOta: true,
  lanDiscovery: false,
  githubReleaseFetch: false,
  savedFilesFilesystem: false,
  wifiLogUdp: false,
  mcpServer: false,
  serialPortAutoSelect: false,
};

export const DESKTOP_CAPABILITIES: HostCapabilities = {
  webSerial: true,
  httpOta: true,
  lanDiscovery: true,
  githubReleaseFetch: true,
  savedFilesFilesystem: true,
  wifiLogUdp: true,
  mcpServer: true,
  serialPortAutoSelect: true,
};

// Detects the running host by checking for the desktop preload bridge
// (window.papilioDesktop, injected by apps/desktop/main/preload.ts) — falls
// back to WEB_CAPABILITIES with webSerial gated on navigator.serial support.
export function detectCapabilities(win: typeof globalThis & { papilioDesktop?: unknown; navigator?: Navigator }): HostCapabilities {
  if (win.papilioDesktop) return DESKTOP_CAPABILITIES;
  const hasWebSerial = typeof win.navigator !== "undefined" && "serial" in win.navigator;
  return { ...WEB_CAPABILITIES, webSerial: hasWebSerial };
}
