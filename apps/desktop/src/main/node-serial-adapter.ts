// node-serial-adapter.ts — wraps the Node `serialport` package's
// EventEmitter/Node-stream API in the Web Streams `SerialLike` shape that
// @papilio-loader/flasher-core expects (the same duck-typed interface a
// browser/Electron-renderer `navigator.serial` SerialPort satisfies). This
// lets the MCP server (running in the Electron main/Node process, with no
// renderer and no user gesture available for `requestPort()`) reuse the
// exact same flashing logic as the UI instead of a second implementation.
import { SerialPort } from "serialport";
import type { SerialLike } from "@papilio-loader/flasher-core";

export class NodeSerialAdapter implements SerialLike {
  private port: SerialPort | null = null;
  readable: ReadableStream<Uint8Array> | null = null;
  writable: WritableStream<Uint8Array> | null = null;

  constructor(private readonly path: string) {}

  async open(options: { baudRate: number }): Promise<void> {
    const port = new SerialPort({ path: this.path, baudRate: options.baudRate, autoOpen: false });
    await new Promise<void>((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()));
    });
    this.port = port;

    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        port.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        });
        port.on("error", (err) => controller.error(err));
        port.on("close", () => {
          try {
            controller.close();
          } catch {
            // Already closed/errored — ignore.
          }
        });
      },
    });

    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) =>
        new Promise<void>((resolve, reject) => {
          port.write(Buffer.from(chunk), (err) => (err ? reject(err) : undefined));
          port.drain((err) => (err ? reject(err) : resolve()));
        }),
    });
  }

  async close(): Promise<void> {
    const port = this.port;
    if (!port) return;
    await new Promise<void>((resolve) => port.close(() => resolve()));
    this.port = null;
    this.readable = null;
    this.writable = null;
  }

  static async listPorts(): Promise<Array<{ path: string; vendorId?: string; productId?: string; manufacturer?: string }>> {
    const ports = await SerialPort.list();
    return ports.map((p) => ({
      path: p.path,
      vendorId: p.vendorId,
      productId: p.productId,
      manufacturer: p.manufacturer,
    }));
  }
}
