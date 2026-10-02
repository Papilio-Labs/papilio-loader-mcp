# Papilio Loader v0.4.0

This release completes the Phase-8 loader workflow for boards using the
Papilio ESP Bootloader and stripped FPGA Companion.

## Highlights

- OTA-only mode no longer falls through to USB.
- Automatic mode returns to the loader status result before opening USB.
- Failed or aborted status probes invalidate stale cached device roles.
- Web and Electron builds share the same updated loader state machine.
- Desktop startup includes the WiFi log display path.

## Compatibility

Use `FPGA-Companion v2.0.0` only with `papilio-esp-bootloader v0.1.0` or a
compatible Phase-6 bootloader. Pre-Phase-6 boards must be migrated once with
the published merged image over USB.

## Validation

The flasher-core suite passes 35 tests, the TypeScript package compiles, the
web and Electron bundles build successfully, and the Windows installer builds
with Inno Setup 6.6.1. Physical USB recovery, interrupted-write recovery, and
full A2600/C64/NES migrated-board regression remain hardware follow-ups.