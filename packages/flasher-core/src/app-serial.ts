// app-serial.ts — the APP_FLASH_BEGIN serial protocol (see
// papilio-esp-bootloader/main/serial_flash.c try_handle_app_flash_begin()):
// stream an ESP32 app image into whichever ota_0/ota_1 slot is inactive,
// over the same USB serial port used for FPGA bitstream flashing. Added in
// Phase 7 (host tooling) -- Phase 4 only ported the firmware side, the host
// tooling kept using a full esptool merged-image flash instead.
//
// No per-chunk flow control is needed here (unlike fpga-serial.ts's
// target=flash path): the loader's 64KB USB-serial RX ring buffer easily
// keeps up with esp_ota_write()'s flash-DMA writes (see the Phase 4
// findings in papilio-esp-bootloader-phase1-rollback-findings repo memory
// -- the slow consumer that needed per-chunk ACKs was the JTAG bit-bang
// path, not this one).
import type { SerialLike } from "./transport.js";
import type { SerialLineReader } from "./serial-log.js";
import type { ProgressCallback } from "./fpga-serial.js";

const CHUNK = 16384;

export async function flashEsp32OverSerial(
  port: SerialLike,
  reader: SerialLineReader,
  data: Uint8Array,
  onProgress: ProgressCallback
): Promise<void> {
  if (!port) throw new Error("No USB serial port connected.");
  if (!reader.isRunning) await reader.start();
  if (!port.writable) throw new Error("No USB serial port connected.");

  const size = data.byteLength;
  const encoder = new TextEncoder();
  const writer = port.writable.getWriter();

  try {
    const readyPromise = reader.waitForLine(/^READY$|^APP_FLASH_ERROR /, 10000);
    await writer.write(encoder.encode(`APP_FLASH_BEGIN ${size}\n`));
    const readyLine = await readyPromise;
    if (readyLine.startsWith("APP_FLASH_ERROR")) {
      throw new Error(`Board rejected request: ${readyLine}`);
    }

    // Board reboots automatically on success, so the final line may never
    // arrive if the USB port re-enumerates first -- give it a generous
    // window, but a caller's own onDisconnect handling is the real signal.
    const donePromise = reader.waitForLine(/^APP_FLASH_OK$|^APP_FLASH_ERROR /, 60000, (line) => {
      const m = line.match(/^PROGRESS (\d+)/);
      if (m) onProgress(parseInt(m[1], 10), size);
    });

    for (let offset = 0; offset < size; offset += CHUNK) {
      // slice() (copy), not subarray() (view) -- write() detaches the
      // underlying buffer, invalidating any other view into the same
      // source ArrayBuffer after the first write() call.
      await writer.write(data.slice(offset, Math.min(offset + CHUNK, size)));
    }

    const resultLine = await donePromise;
    if (resultLine.startsWith("APP_FLASH_ERROR")) {
      throw new Error(`Board reported: ${resultLine}`);
    }
    onProgress(size, size);
  } finally {
    writer.releaseLock();
  }
}
