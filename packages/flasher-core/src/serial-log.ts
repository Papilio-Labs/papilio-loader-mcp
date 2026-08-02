// serial-log.ts — single shared read loop over a SerialLike port: line
// splitting, a promise-based waiter registry for protocol exchanges (READY /
// PROGRESS n / FPGA_FLASH_OK, etc.), and a subscriber list for plain log
// lines (UI display, IP capture). Ported verbatim from flash.js/loader.js's
// startSerialListener()/waitForSerialLine()/handleSerialLine() — the serial
// port's readable stream can only have one active reader, so every consumer
// of a given port's log output must go through one instance of this class.
import type { SerialLike } from "./transport.js";

export type LineListener = (line: string) => void;

interface Waiter {
  matchRegex: RegExp;
  onEachLine?: LineListener;
  resolve: (line: string) => void;
  reject: (err: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

export class SerialLineReader {
  private port: SerialLike;
  private baudRate: number;
  private stopped = true;
  private waiters: Waiter[] = [];
  private lineListeners = new Set<LineListener>();
  private disconnectListeners = new Set<() => void>();
  private reader: ReadableStreamDefaultReader<string> | null = null;

  constructor(port: SerialLike, baudRate = 115200) {
    this.port = port;
    this.baudRate = baudRate;
  }

  get isRunning(): boolean {
    return !this.stopped;
  }

  onLine(listener: LineListener): () => void {
    this.lineListeners.add(listener);
    return () => this.lineListeners.delete(listener);
  }

  // Fired when the read loop dies from a "lost"/"disconnect" style error —
  // e.g. USB re-enumeration after a chip-level reset — as opposed to a
  // deliberate stop().
  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  // Idempotent: calling start() while already running is a no-op, matching
  // the original startSerialListener()'s re-entry guard.
  async start(): Promise<void> {
    if (!this.stopped) return;

    if (!this.port.readable) {
      await this.port.open({ baudRate: this.baudRate });
    }
    if (!this.port.readable) {
      throw new Error("Serial port has no readable stream after open()");
    }

    this.stopped = false;
    const decoder = new TextDecoderStream();
    const readableClosed = this.port.readable
      .pipeTo(decoder.writable as WritableStream<Uint8Array>)
      .catch(() => {});
    const reader = decoder.readable.getReader();
    this.reader = reader;

    let buf = "";
    (async () => {
      try {
        while (!this.stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let idx;
          while ((idx = buf.indexOf("\n")) >= 0) {
            // \r+ (not a single \r): this board's console converts \n to
            // \r\n on output, so its own explicit "\r\n" line endings arrive
            // on the wire as "\r\r\n".
            const line = buf.slice(0, idx).replace(/\r+$/, "");
            buf = buf.slice(idx + 1);
            if (line.length) this.handleLine(line);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!this.stopped && /lost|disconnect/i.test(message)) {
          for (const listener of this.disconnectListeners) listener();
        }
      } finally {
        this.stopped = true;
        try {
          reader.releaseLock();
        } catch {
          // already released
        }
      }
    })();

    readableClosed.then(() => {
      this.stopped = true;
    });
  }

  stop(): void {
    this.stopped = true;
  }

  private handleLine(line: string): void {
    for (const listener of this.lineListeners) listener(line);

    for (const waiter of this.waiters.slice()) {
      if (waiter.matchRegex.test(line)) {
        clearTimeout(waiter.timeoutHandle);
        this.waiters = this.waiters.filter((w) => w !== waiter);
        waiter.resolve(line);
      } else if (waiter.onEachLine) {
        waiter.onEachLine(line);
      }
    }
  }

  waitForLine(matchRegex: RegExp, timeoutMs: number, onEachLine?: LineListener): Promise<string> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        matchRegex,
        onEachLine,
        resolve,
        reject,
        timeoutHandle: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new Error(`Timed out waiting for board (expected ${matchRegex})`));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }
}
