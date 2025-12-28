# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] — 2025-12-28
- Desktop Windows installer with GUI and console executables
- Tool separation: `pesptool.exe` (FPGA) and `esptool.exe` (ESP32)
- Fixed write permissions by using `%LOCALAPPDATA%\\papilio-loader-mcp\\` for temp and saved data
- Bundled esptool chip stub JSONs to support ESP32 variants

See detailed release notes: [RELEASE_NOTES.md](RELEASE_NOTES.md)
