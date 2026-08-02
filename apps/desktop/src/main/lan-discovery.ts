// lan-discovery.ts — Node port of papilio_loader_mcp/tools/network_discovery.py.
// Determines the local IP by opening a UDP socket "connected" to 8.8.8.8:80
// (no packet is actually sent — connect() on a UDP socket just picks the
// outbound interface/route), assumes a /24 subnet from that IP, then
// concurrently probes port 3232 (OTA HTTP server) on all 254 host addresses.
import { createSocket } from "node:dgram";

export interface OtaDevice {
  ip: string;
  port: number;
  url: string;
  endpoints: {
    esp32Update: string;
    fpgaUpdate: string;
  };
}

export function getLocalIp(): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = createSocket("udp4");
    socket.once("error", () => {
      socket.close();
      resolve(null);
    });
    socket.connect(80, "8.8.8.8", () => {
      const address = socket.address();
      socket.close();
      resolve(address?.address ?? null);
    });
  });
}

async function probeOtaEndpoint(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Any response (200, 404, etc.) means something is listening — we only
    // care about "is a HTTP server there", not what it says.
    await fetch(`http://${ip}:${port}/`, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Concurrency cap avoids opening 254 sockets simultaneously (can trip OS
// ephemeral-port/file-descriptor limits and makes false negatives on slower
// machines more likely under real load).
const CONCURRENCY = 32;

export async function discoverOtaDevices(timeoutSeconds = 2, port = 3232): Promise<OtaDevice[]> {
  const localIp = await getLocalIp();
  if (!localIp) throw new Error("Could not determine local IP address");

  const [a, b, c] = localIp.split(".");
  const subnet = `${a}.${b}.${c}`;
  const timeoutMs = timeoutSeconds * 1000;
  const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);

  const found: OtaDevice[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < hosts.length) {
      const ip = hosts[cursor++];
      if (await probeOtaEndpoint(ip, port, timeoutMs)) {
        found.push({
          ip,
          port,
          url: `http://${ip}:${port}`,
          endpoints: {
            esp32Update: `http://${ip}:${port}/update`,
            fpgaUpdate: `http://${ip}:${port}/fpga-update`,
          },
        });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  // Stable, human-friendly ordering (host sweep above completes out of order).
  found.sort((x, y) => Number(x.ip.split(".")[3]) - Number(y.ip.split(".")[3]));
  return found;
}

export async function checkDeviceIp(ip: string, port = 3232, timeoutSeconds = 2): Promise<boolean> {
  return probeOtaEndpoint(ip, port, timeoutSeconds * 1000);
}
