# Papilio Loader v0.4.0

This release completes the loader workflow for boards using the
factory-resident Papilio ESP Bootloader and the stripped FPGA Companion.

## Highlights

- OTA-only mode no longer falls through to USB.
- Automatic mode returns to the loader status result before opening USB.
- Failed or aborted status probes invalidate stale cached device roles.
- Web and Electron builds share the same updated loader state machine.
- Desktop startup includes the WiFi log display path.
- OTA programming is available through the bootloader regardless of which
	user application is installed.

## Compatibility

Use `FPGA-Companion v2.0.0` only with `papilio-esp-bootloader v0.1.0` or a
compatible factory-resident bootloader. Boards using the previous
application-centered OTA design must be migrated once with the published
merged image over USB.

## Validation

The flasher-core suite passes 35 tests, the TypeScript package compiles, the
web and Electron bundles build successfully, and the Windows installer builds
with Electron Builder 26.15.3. Physical USB recovery, interrupted-write
recovery, and full A2600/C64/NES migrated-board regression remain hardware
follow-ups.