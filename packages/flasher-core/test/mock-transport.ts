// test/mock-transport.ts — an in-memory SerialLike implementation for unit
// tests, so the FPGA serial protocol and provisioning flows can be exercised
// without a browser or real hardware. Mirrors just enough of the real
// Web Serial SerialPort surface (readable/writable/open/close) that
// SerialLineReader and friends can't tell the difference.
import type { SerialLike } from "../src/transport.js";

export class MockSerialPort implements SerialLike {
  readable: ReadableStream<Uint8Array> | null = null;
  writable: WritableStream<Uint8Array> | null = null;
  readonly writes: Uint8Array[] = [];
  onWrite: ((chunk: Uint8Array) => void) | null = null;

  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  async open(_options: { baudRate: number }): Promise<void> {
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
      },
    });
    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) => {
        this.writes.push(chunk);
        this.onWrite?.(chunk);
      },
    });
  }

  async close(): Promise<void> {
    try {
      this.controller?.close();
    } catch {
      // already closed
    }
  }

  // Test helper: simulate the device sending one text line (adds the `\n`
  // the firmware would send).
  emit(line: string): void {
    this.controller?.enqueue(new TextEncoder().encode(line + "\n"));
  }

  // Test helper: simulate the read loop dying with a disconnect-style error,
  // as happens on a real board's USB re-enumeration after a chip reset.
  simulateDisconnect(message = "The device has been lost."): void {
    this.controller?.error(new Error(message));
  }
}
