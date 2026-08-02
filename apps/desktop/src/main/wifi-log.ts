// wifi-log.ts — Node port of papilio_loader_mcp/api.py's `_WiFiLogManager`.
// Singleton UDP socket on port 7777 (FPGA-Companion's debug log broadcast),
// fanning decoded text lines out to all active subscribers. The Python
// version fans out via SSE to browser clients; here we fan out directly to
// subscriber callbacks, which main/index.ts forwards to the renderer via IPC.
import { createSocket, type Socket } from "node:dgram";

export const WIFI_LOG_PORT = 7777;

type Subscriber = (line: string) => void;

class WifiLogManager {
  private socket: Socket | null = null;
  private readonly subscribers = new Set<Subscriber>();

  private ensureStarted(): void {
    if (this.socket) return;
    const socket = createSocket({ type: "udp4", reuseAddr: true });
    socket.on("message", (data) => {
      const line = data.toString("utf8").replace(/\r+$/g, "");
      for (const subscriber of this.subscribers) subscriber(line);
    });
    socket.on("error", (err) => {
      console.error(`[wifi-log] UDP socket error: ${err.message}`);
    });
    socket.bind(WIFI_LOG_PORT);
    this.socket = socket;
  }

  subscribe(callback: Subscriber): () => void {
    this.ensureStarted();
    this.subscribers.add(callback);
    return () => this.unsubscribe(callback);
  }

  unsubscribe(callback: Subscriber): void {
    this.subscribers.delete(callback);
    // No active listeners left — free the port so other tools (or a second
    // instance during development) can bind it.
    if (this.subscribers.size === 0 && this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// Singleton — mirrors the Python module-level `wifi_log_manager` instance.
export const wifiLogManager = new WifiLogManager();
