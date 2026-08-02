// provisioning.ts — WiFi credential provisioning over the still-open USB
// serial port (WIFI_SSID=/WIFI_PASS= lines), plus the device-IP capture
// regex shared by both the "just flashed" flow and the "find my IP" flow.
// Ported from flash.js/loader.js.
import type { SerialLike } from "./transport.js";
import type { SerialLineReader } from "./serial-log.js";

export const IP_REGEX = /WiFi connected - IP:\s*(\d{1,3}(?:\.\d{1,3}){3})/;

export type ProvisioningStatusKind = "ok" | "error" | undefined;

export interface ProvisioningEvents {
  onIp?(ip: string): void;
  onStatus?(message: string, kind?: ProvisioningStatusKind): void;
}

// Call this from a SerialLineReader.onLine() subscription to react to
// WIFI_CFG_OK/WIFI_CFG_ERR acks and IP-capture lines. Kept separate from
// SerialLineReader itself so that class stays protocol-agnostic.
export function watchProvisioningLine(line: string, events: ProvisioningEvents): void {
  const ipMatch = line.match(IP_REGEX);
  if (ipMatch) events.onIp?.(ipMatch[1]);

  if (line.includes("WIFI_CFG_OK ssid")) events.onStatus?.("SSID saved…");
  if (line.includes("WIFI_CFG_OK pass")) events.onStatus?.("Password saved…");
  if (line.includes("WIFI_CFG_OK reboot")) {
    events.onStatus?.("Credentials saved. Board is rebooting and reconnecting…", "ok");
  }
  if (line.includes("WIFI_CFG_ERR")) {
    events.onStatus?.("Board rejected credentials — try again.", "error");
  }
}

export async function sendWifiCredentials(port: SerialLike, ssid: string, pass: string): Promise<void> {
  if (!port.writable) {
    throw new Error("Serial port is not open for writing — start the serial listener first.");
  }
  const writer = port.writable.getWriter();
  const encoder = new TextEncoder();
  try {
    await writer.write(encoder.encode(`WIFI_SSID=${ssid}\n`));
    await writer.write(encoder.encode(`WIFI_PASS=${pass}\n`));
  } finally {
    writer.releaseLock();
  }
}

// USB_HOST_HOLD / USB_HOST_RESUME — on-demand debug console override so the
// serial console stays reachable even after WiFi is already provisioned
// (see papilio-retrocade-usb-reset skill notes / dev-logs for the full
// rationale). Exposed here since it rides the same already-open port.
export async function sendUsbHostHold(port: SerialLike): Promise<void> {
  if (!port.writable) throw new Error("Serial port is not open for writing.");
  const writer = port.writable.getWriter();
  try {
    await writer.write(new TextEncoder().encode("USB_HOST_HOLD\n"));
  } finally {
    writer.releaseLock();
  }
}

export async function sendUsbHostResume(port: SerialLike): Promise<void> {
  if (!port.writable) throw new Error("Serial port is not open for writing.");
  const writer = port.writable.getWriter();
  try {
    await writer.write(new TextEncoder().encode("USB_HOST_RESUME\n"));
  } finally {
    writer.releaseLock();
  }
}

// Convenience wiring: subscribe watchProvisioningLine to a running reader.
export function attachProvisioningWatcher(reader: SerialLineReader, events: ProvisioningEvents): () => void {
  return reader.onLine((line) => watchProvisioningLine(line, events));
}
