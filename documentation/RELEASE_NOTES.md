# Release Notes v0.1.0 — Desktop Installer & Tool Separation

**Date**: 2025-12-28

## Overview
This release packages Papilio Loader as a Windows desktop application with an installer, separates flashing tools by device type, and fixes write-permission issues for installed builds. It also bundles required esptool data files to support ESP32 variants.

## Highlights
- Desktop executables: GUI (`PapilioLoader.exe`) and console (`PapilioLoader-Console.exe`).
- Standalone tools: `pesptool.exe` (FPGA) and `esptool.exe` (ESP32, official).
- Windows installer with optional PATH integration and shortcuts.
- User data and temp files written to `%LOCALAPPDATA%\\papilio-loader-mcp\\`.

## Changes
- Standalone `esptool.exe` packaging via spec and entry point.
  - See [esptool.spec](../esptool.spec) and [esptool_entry.py](../esptool_entry.py).
- `esp_flash.py` updated to call the official `esptool.exe`.
  - See [src/papilio_loader_mcp/tools/esp_flash.py](../src/papilio_loader_mcp/tools/esp_flash.py).
- Temp directory fixed for frozen executables using user data path.
  - See [src/papilio_loader_mcp/api.py](../src/papilio_loader_mcp/api.py) and [src/papilio_loader_mcp/config.py](../src/papilio_loader_mcp/config.py).
- Main app packaging updated to include templates and tool binaries.
  - See [papilio_loader.spec](../papilio_loader.spec).
- Build script orchestrates tools + app + installer.
  - See [build.py](../build.py) and [build.ps1](../build.ps1).
- Installer bundles GUI/console apps and tools; optional PATH integration.
  - See [installer.iss](../installer.iss).

## Fixes
- Write-permission errors resolved by moving temp/saved data to `%LOCALAPPDATA%\\papilio-loader-mcp\\`.
- Bundled esptool chip stub JSON files to prevent `FileNotFoundError` for ESP32 variants (e.g., S3).

## Installation
- Download and run the installer in [installer_output](../installer_output). See [INSTALLATION.md](INSTALLATION.md).
- Optional: PATH integration enables `pesptool.exe` and `esptool.exe` from any terminal.

## Upgrade Notes
- Installed builds no longer write to Program Files. All writable data is under `%LOCALAPPDATA%\\papilio-loader-mcp\\`.
- For Python/dev users, behavior is unchanged; dev mode uses the current working directory.

## Known Issues
- Primary support targets Windows 10/11. macOS/Linux packaging is not included in this release.
- Default credentials are `admin/admin`; change for production use.

## Verification Checklist
- Build outputs present: GUI, console, `pesptool.exe`, `esptool.exe`.
- Installer compiles and installs; shortcuts created if selected.
- PATH integration enables CLI tools.
- ESP32 S2/S3/C3 flashing validated post-install (requires hardware).

## References
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Build guide: [BUILD.md](BUILD.md)
- Desktop app guide: [DESKTOP_APP.md](DESKTOP_APP.md)
- Installation: [INSTALLATION.md](INSTALLATION.md)
 - Changelog: [CHANGELOG.md](CHANGELOG.md)

## Checksums (to publish after build)
- `installer_output/PapilioLoader-Setup-0.1.0.exe`: SHA256 = <paste here>
- `dist/PapilioLoader.exe`: SHA256 = <paste here>
- `dist/pesptool.exe`: SHA256 = <paste here>
- `dist/esptool.exe`: SHA256 = <paste here>
