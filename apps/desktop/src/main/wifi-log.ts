// wifi-log.ts — Node port of papilio_loader_mcp/api.py's `_WiFiLogManager`.
// Singleton UDP socket on port 7777 (FPGA-Companion's debug log broadcast),
// fanning decoded text lines out to all active subscribers. The Python
// version fans out via SSE to browser clients; here we fan out directly to
// subscriber callbacks, which main/index.ts forwards to the renderer via IPC.
import { createSocket, type Socket } from "node:dgram";

export const WIFI_LOG_PORT = 7777;

type Subscriber = (line: string) => void;
export type WifiLogStatus = { type: "connected" | "error"; message: string };

export class WifiLogManager {
  private socket: Socket | null = null;
  private readonly subscribers = new Map<Subscriber, (status: WifiLogStatus) => void>();
  private status: WifiLogStatus | null = null;

  constructor(private readonly port = WIFI_LOG_PORT) {}

  private ensureStarted(): void {
    if (this.socket) return;
    this.status = null;
    const socket = createSocket({ type: "udp4", reuseAddr: true });
    socket.on("message", (data) => {
      const line = data.toString("utf8").replace(/\r+$/g, "");
      for (const subscriber of this.subscribers.keys()) subscriber(line);
    });
    socket.on("listening", () => {
      this.status = { type: "connected", message: `Listening on UDP ${socket.address().port}` };
      for (const onStatus of this.subscribers.values()) onStatus(this.status);
    });
    socket.on("error", (err) => {
      console.error(`[wifi-log] UDP socket error: ${err.message}`);
      this.status = { type: "error", message: err.message };
      if (this.socket === socket) {
        this.socket = null;
        socket.close();
      }
      for (const onStatus of this.subscribers.values()) onStatus(this.status);
    });
    this.socket = socket;
    socket.bind(this.port);
  }

  subscribe(callback: Subscriber, onStatus: (status: WifiLogStatus) => void): () => void {
    this.subscribers.set(callback, onStatus);
    this.ensureStarted();
    if (this.status) onStatus(this.status);
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
    if (this.subscribers.size === 0) this.status = null;
  }
}

// Singleton — mirrors the Python module-level `wifi_log_manager` instance.
export const wifiLogManager = new WifiLogManager();
