// fpga-serial.ts — the FPGA_FLASH_BEGIN serial protocol (see
// FPGA-Companion/src/esp32/serial_flash.h): stream a bitstream to SPI flash
// or JTAG SRAM over the same USB serial port used for ESP32 flashing and
// WiFi provisioning. Ported from flash.js/loader.js's flashFpgaOverSerial().
import type { SerialLike } from "./transport.js";
import type { SerialLineReader } from "./serial-log.js";

export type FpgaSerialTarget = "flash" | "sram";

// Maps the HTTP OTA endpoint naming to the serial protocol's target keyword.
// /fpga-recover has no serial equivalent — recovery implies the flash may be
// corrupt, but the board still needs to be reachable somehow to even ask for
// it, so it stays OTA-only.
export const SERIAL_FPGA_TARGET: Record<string, FpgaSerialTarget> = {
  "/fpga-update": "flash",
  "/fpga-jtag-sram": "sram",
};

export type ProgressCallback = (loaded: number, total: number) => void;

export async function flashFpgaOverSerial(
  port: SerialLike,
  reader: SerialLineReader,
  target: FpgaSerialTarget,
  data: Uint8Array,
  onProgress: ProgressCallback
): Promise<void> {
  if (!port) throw new Error("No USB serial port connected.");
  // "Connect USB" only selects a port — it doesn't open it. Opening happens
  // lazily here (matching loader.js's flashFpgaOverSerial()) so a port
  // chosen via the top "Connect USB" button (without also using Find IP or
  // Send WiFi, which already start the listener) still works.
  if (!reader.isRunning) await reader.start();
  if (!port.writable) throw new Error("No USB serial port connected.");

  const size = data.byteLength;
  const encoder = new TextEncoder();
  const writer = port.writable.getWriter();

  try {
    // For target=flash, the board does bootloader-SRAM-load + SPI init +
    // full-region erase *before* replying READY (see FPGA-Companion's
    // serial_flash_prepare_spi()) — that can take up to ~60s in the worst
    // case, so this timeout is long. Keeping the erase ahead of READY avoids
    // overflowing the board's small USB RX ring buffer with a payload it
    // can't drain yet.
    const readyPromise = reader.waitForLine(/^READY$|^FPGA_FLASH_ERROR /, 90000);
    await writer.write(encoder.encode(`FPGA_FLASH_BEGIN ${target} ${size}\n`));
    const readyLine = await readyPromise;
    if (readyLine.startsWith("FPGA_FLASH_ERROR")) {
      throw new Error(`Board rejected request: ${readyLine}`);
    }

    // Long timeout — USB-Serial-JTAG is much slower than WiFi OTA for a full
    // bitstream write, especially the SPI-flash target (erase + write).
    const donePromise = reader.waitForLine(/^FPGA_FLASH_OK$|^FPGA_FLASH_ERROR /, 180000, (line) => {
      const m = line.match(/^PROGRESS (\d+)/);
      if (m) onProgress(parseInt(m[1], 10), size);
    });

    if (target === "flash") {
      // Per-chunk flow control: wait for the device's PROGRESS ack (emitted
      // after every chunk for target=flash) before sending the next chunk.
      // The device's usb_serial_jtag RX ring buffer is small (16 KB) —
      // without this, the whole payload can overrun that buffer and wedge
      // the USB transport permanently if a flash write is ever slower than
      // the incoming byte rate.
      const CHUNK = 4096;
      for (let offset = 0; offset < size; offset += CHUNK) {
        const end = Math.min(offset + CHUNK, size);
        // slice() (copy), not subarray() (view) — write() transfers/detaches
        // the underlying buffer, which would invalidate every other view
        // into the same source ArrayBuffer after the first write() call.
        await writer.write(data.slice(offset, end));
        await reader.waitForLine(new RegExp(`^PROGRESS ${end}$|^FPGA_FLASH_ERROR `), 10000);
      }
    } else {
      const CHUNK = 16384;
      for (let offset = 0; offset < size; offset += CHUNK) {
        await writer.write(data.slice(offset, Math.min(offset + CHUNK, size)));
      }
    }

    const resultLine = await donePromise;
    if (resultLine.startsWith("FPGA_FLASH_ERROR")) {
      throw new Error(`Board reported: ${resultLine}`);
    }
    onProgress(size, size);
  } finally {
    writer.releaseLock();
  }
}
