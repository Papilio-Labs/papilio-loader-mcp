// transport.ts — the minimal duck-typed surface flasher-core needs from a
// serial connection. Both the browser's real `SerialPort` (from
// navigator.serial.requestPort()) and Electron's renderer-side SerialPort
// satisfy this structurally with zero adapter code — this interface exists
// so the rest of the package (and its unit tests) never import `dom.SerialPort`
// directly, keeping mock-transport tests possible without a browser.
export interface SerialLike {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

// Reported by SerialLineReader when the underlying transport is lost mid-read
// (e.g. USB re-enumeration after a chip reset) vs. a normal stop() call.
export class SerialDisconnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SerialDisconnectError";
  }
}
