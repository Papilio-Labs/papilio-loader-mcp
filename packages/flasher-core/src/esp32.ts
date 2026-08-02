// esp32.ts — thin wrapper around esptool-js: flash firmware over WebSerial
// and reboot the board afterward. Ported from flash.js/loader.js. Uses the
// npm `esptool-js` package (pinned, bundled) instead of the unpkg CDN import
// the original static pages used — removes that CDN single-point-of-failure.
import { ESPLoader, Transport } from "esptool-js";
import type { SerialLike } from "./transport.js";

export interface Esp32FlashOptions {
  onLog?(message: string): void;
  onProgress?(written: number, total: number): void;
}

// esptool-js's own reset strategies (classic RTS toggle, and the
// UsbJtagSerialReset used to *enter* the bootloader) don't reliably reboot a
// native-USB-Serial/JTAG ESP32-S3 (Papilio Retrocade) back into the app —
// the board is left requiring a physical RESET press. Python esptool has a
// separate `--after watchdog-reset` mode for exactly this case (arms the RTC
// watchdog and lets it fire, no DTR/RTS involved); esptool-js has no JS
// equivalent, so this is a direct port of ESP32S3ROM.watchdog_reset() from
// esptool's targets/esp32s3.py, using the same three register writes over
// the already-connected ESPLoader. Confirmed reliable on the Papilio
// Retrocade (see esp32s3-usb-auto-reset-findings repo memory).
export async function watchdogResetEsp32S3(loader: ESPLoader): Promise<void> {
  const RTC_CNTL_WDTCONFIG0_REG = 0x60008098;
  const RTC_CNTL_WDTCONFIG1_REG = 0x6000809c;
  const RTC_CNTL_WDTWPROTECT_REG = 0x600080b0;
  const RTC_CNTL_WDT_WKEY = 0x50d83aa1;

  await loader.writeReg(RTC_CNTL_WDTWPROTECT_REG, RTC_CNTL_WDT_WKEY); // unlock
  await loader.writeReg(RTC_CNTL_WDTCONFIG1_REG, 2000); // WDT timeout
  await loader.writeReg(RTC_CNTL_WDTCONFIG0_REG, 0xd0000102); // enable WDT
  await loader.writeReg(RTC_CNTL_WDTWPROTECT_REG, 0); // lock
  await new Promise((resolve) => setTimeout(resolve, 500));
}

// This board has no external reset circuit (see the entry-mode comment
// above), so "Find My IP" previously had to ask the user to physically
// press RESET after connecting. This reuses the exact same
// enter-bootloader/exit-bootloader dance as flashEsp32() — minus the actual
// flash write — to force a fresh boot in software, so the board reprints
// its "WiFi connected - IP: ..." boot log on its own.
export async function resetEsp32ForIp(port: SerialLike, onLog?: (message: string) => void): Promise<void> {
  const transport = new Transport(port as unknown as ConstructorParameters<typeof Transport>[0], true);
  const loader = new ESPLoader({
    transport,
    baudrate: 115200,
    terminal: {
      clean: () => {},
      writeLine: (msg: string) => onLog?.(msg),
      write: (msg: string) => onLog?.(msg),
    },
  });

  try {
    const chipName = await loader.main();
    onLog?.(`Connected to ${chipName} — resetting to read its boot log...`);

    if (loader.chip && loader.chip.CHIP_NAME === "ESP32-S3") {
      await watchdogResetEsp32S3(loader);
    } else {
      await loader.after("hard_reset");
    }
  } finally {
    try {
      await transport.disconnect();
    } catch {
      // already closed/never opened — ignore
    }
  }
}

export interface Esp32FlashResult {
  chipName: string;
}

// Flashes a merged single-file image (bootloader + partition table + app,
// built via `esptool merge-bin`) at offset 0x0. flashMode/Freq/Size use
// "keep" — read from the merged image's own bootloader header rather than
// guessed, matching the original SPA's behavior.
export async function flashEsp32(port: SerialLike, data: Uint8Array, options: Esp32FlashOptions = {}): Promise<Esp32FlashResult> {
  const transport = new Transport(port as unknown as ConstructorParameters<typeof Transport>[0], true);
  const loader = new ESPLoader({
    transport,
    baudrate: 115200,
    terminal: {
      clean: () => {},
      writeLine: (msg: string) => options.onLog?.(msg),
      write: (msg: string) => options.onLog?.(msg),
    },
  });

  try {
    const chipName = await loader.main();
    options.onLog?.(`Connected to ${chipName}.`);

    await loader.writeFlash({
      fileArray: [{ data, address: 0x0 }],
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (_fileIndex: number, written: number, total: number) => {
        options.onProgress?.(written, total);
      },
    });
    options.onLog?.("ESP32 firmware flashed.");

    if (loader.chip && loader.chip.CHIP_NAME === "ESP32-S3") {
      options.onLog?.("Resetting board via RTC watchdog...");
      await watchdogResetEsp32S3(loader);
    } else {
      await loader.after("hard_reset");
    }

    return { chipName };
  } finally {
    // The transport may have opened the port before failing (e.g. chip sync
    // timeout) — always close it so a retry doesn't hit "port already open".
    try {
      await transport.disconnect();
    } catch {
      // already closed/never opened — ignore
    }
  }
}
