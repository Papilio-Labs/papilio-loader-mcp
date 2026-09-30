import { describe, it, expect } from "vitest";
import { classifyBootLogLine, classifyStatusResponseText, isLegacyPreMigrationApp } from "../src/device-status.js";

describe("classifyBootLogLine", () => {
  it("recognizes the loader's boot banner", () => {
    expect(classifyBootLogLine("Papilio ESP Bootloader -- Phase 4 (USB-serial fallback)")).toBe("loader");
  });

  it("recognizes FPGA-Companion's ASCII boot banner", () => {
    expect(classifyBootLogLine("           FPGA Companion for ESP32-S2/S3")).toBe("app");
  });

  it("returns null for unrelated lines", () => {
    expect(classifyBootLogLine("I (317) boot: Loaded app from partition at offset 0x280000")).toBeNull();
  });
});

describe("classifyStatusResponseText", () => {
  it("recognizes the loader's GET / banner", () => {
    const body = "Papilio ESP Bootloader\nPOST /fpga-jtag-sram -- program FPGA SRAM via JTAG (.bin bitstream)\n";
    expect(classifyStatusResponseText(body)).toBe("loader");
  });

  // Verified against real hardware: net_recovery.c's status body wording
  // ("FPGA Companion - Network Recovery") differs from the boot-log ASCII
  // banner ("FPGA Companion for ESP32-S2/S3") -- only "FPGA Companion" is
  // common to both.
  it("recognizes FPGA-Companion's net_recovery status banner", () => {
    const body = "FPGA Companion - Network Recovery\n==================================\nRunning partition : ota_1\n";
    expect(classifyStatusResponseText(body)).toBe("app");
  });

  it("returns unknown for anything else", () => {
    expect(classifyStatusResponseText("<html>404</html>")).toBe("unknown");
  });
});

describe("isLegacyPreMigrationApp", () => {
  it("treats 404 as a pre-Phase-6 build", () => {
    expect(isLegacyPreMigrationApp(404)).toBe(true);
  });

  it("treats any other status as a migrated build", () => {
    expect(isLegacyPreMigrationApp(200)).toBe(false);
  });
});
