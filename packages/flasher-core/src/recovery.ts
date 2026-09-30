// recovery.ts — Tier 1 forced-entry into the Papilio ESP Bootloader: the
// USB-reset + otadata-blank dance from papilio-works/plans/
// 2026-09-21-papilio-esp-bootloader.md (Phase 5's recovery ladder, wired
// into host tooling in Phase 7). Used when a board can't be reached over
// LAN/OTA at all (crashed/uncooperative user app, or simply never
// provisioned) but is still connected over USB.
import { ESPLoader, Transport } from "esptool-js";
import type { SerialLike } from "./transport.js";
import { watchdogResetEsp32S3 } from "./esp32.js";

// papilio-esp-bootloader's partitions_loader.csv: `otadata` lives at
// 0xC000, size 0x2000 (2 x 4KB ping-pong records). Blanking it makes
// ESP-IDF's stock bootloader treat both records as invalid and fall back to
// `factory` (the loader) on the next boot -- see the Phase 1 rollback
// findings (papilio-esp-bootloader-phase1-rollback-findings repo memory)
// for the byte-level mechanics.
export const OTADATA_OFFSET = 0xc000;
export const OTADATA_SIZE = 0x2000;

export interface RecoveryOptions {
  onLog?(message: string): void;
}

// esptool-js 0.6.0 has no dedicated erase-region command, so this writes an
// explicit all-0xFF buffer over the otadata partition instead -- from the
// bootloader's point of view that's indistinguishable from a real erase
// (both read back as blank/0xFF).
export async function recoverIntoLoader(port: SerialLike, options: RecoveryOptions = {}): Promise<void> {
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
    options.onLog?.(`Connected to ${chipName} — clearing otadata to force a boot into the loader...`);

    const blank = new Uint8Array(OTADATA_SIZE).fill(0xff);
    await loader.writeFlash({
      fileArray: [{ data: blank, address: OTADATA_OFFSET }],
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
    });
    options.onLog?.("otadata cleared — next boot should fall back to the loader (factory partition).");

    if (loader.chip && loader.chip.CHIP_NAME === "ESP32-S3") {
      options.onLog?.("Resetting board via RTC watchdog...");
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
