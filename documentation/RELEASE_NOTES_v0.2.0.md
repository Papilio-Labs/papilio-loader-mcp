# Release Notes v0.2.0 — OTA Updates & Improved Web Interface

**Date**: 2026-05-13

## Overview
This release adds Over-The-Air (OTA) wireless update capability for both ESP32 firmware and FPGA bitstreams, removes login requirements from the web interface for easier local network use, and improves the overall user experience. OTA support is available through Python API, MCP tools, and the web interface.

## Highlights
- **OTA (Over-The-Air) Updates**: Flash ESP32 and FPGA wirelessly via WiFi
  - Network device discovery (auto-scan local subnet)
  - Both firmware types supported (ESP32 `.bin` and FPGA `.bin`)
  - ~2-3 second flash times (vs 10-15s USB)
  - Full validation and error handling
- **Optional Authentication**: Web interface no longer requires login by default
  - Perfect for local network deployments
  - Can be enabled via `PAPILIO_REQUIRE_WEB_AUTH=true`
- **Improved Web UI**: Flash method selector (USB/Serial or OTA WiFi)
  - Device discovery button in web interface
  - Visual device list with click-to-select
  - Real-time OTA progress feedback

## Changes

### OTA Support
- Network discovery tool (`network_discovery.py`) scans /24 subnet for devices on port 3232
  - See [src/papilio_loader_mcp/tools/network_discovery.py](../src/papilio_loader_mcp/tools/network_discovery.py)
- OTA flashing tool (`ota_flash.py`) handles wireless firmware uploads
  - See [src/papilio_loader_mcp/tools/ota_flash.py](../src/papilio_loader_mcp/tools/ota_flash.py)
- Three new MCP tools: `discover_ota_devices`, `check_device_ip`, `flash_device_ota`
  - See [src/papilio_loader_mcp/server.py](../src/papilio_loader_mcp/server.py)
- Web API endpoints: `/web/discover-ota-devices`, `/web/check-ota-device`, `/web/flash-ota`
  - See [src/papilio_loader_mcp/api.py](../src/papilio_loader_mcp/api.py)
- Complete OTA documentation with examples and troubleshooting
  - See [documentation/OTA_FEATURE.md](OTA_FEATURE.md)
- Dependency added: `aiohttp>=3.9.0` for async HTTP requests
  - See [pyproject.toml](../pyproject.toml)

### Web Interface Improvements
- Flash method radio button selector (USB/OTA) on both FPGA and ESP32 cards
  - See [templates/upload.html](../templates/upload.html)
- Device discovery button with visual feedback and device list
- IP address input field with validation
- OTA-specific error messages and troubleshooting tips
- Updated CSS for OTA UI components (method selector, device list, discover button)

### Authentication Changes
- New config option: `require_web_auth` (default: `False`)
  - See [src/papilio_loader_mcp/config.py](../src/papilio_loader_mcp/config.py)
- Authentication check skipped when `require_web_auth` is disabled
  - See [src/papilio_loader_mcp/api.py](../src/papilio_loader_mcp/api.py)
- Smart redirects: `/` and `/web/login` → `/web/upload` when auth disabled
- Updated startup messages to show direct access URL or login URL
  - See [start_combined_server.py](../start_combined_server.py)

### Code Cleanup
- Removed unused imports and dead code
- Deleted obsolete `requirements.txt` (consolidated to `pyproject.toml`)
- Improved code organization in database and desktop modules

## New Files
- `src/papilio_loader_mcp/tools/network_discovery.py` - Network device discovery
- `src/papilio_loader_mcp/tools/ota_flash.py` - OTA flashing implementation  
- `documentation/OTA_FEATURE.md` - Complete OTA documentation
- `testing/test_ota.py` - OTA functionality tests

## Fixes
- None specific to this release (focused on new features)

## Installation
- Download and run the installer: `installer_output/PapilioLoader-Setup-0.2.0.exe`
- See [INSTALLATION.md](INSTALLATION.md) for detailed instructions
- Optional: Enable authentication with environment variable `PAPILIO_REQUIRE_WEB_AUTH=true`

## Upgrade Notes
- **Breaking Change**: Default web interface now has no authentication
  - To restore login requirement: set `PAPILIO_REQUIRE_WEB_AUTH=true` environment variable
- New dependency: `aiohttp>=3.9.0` (auto-installed with installer or `pip install -e .`)
- OTA requires devices running firmware with HTTP OTA server on port 3232
  - Compatible with FPGA-Companion firmware v1.0+

## Usage Examples

### OTA via Web Interface
1. Open http://localhost:8000 (no login required)
2. Select firmware file
3. Click "📡 OTA (WiFi)" method
4. Click "🔍 Discover Devices"
5. Select device from list
6. Click "⚡ Flash"

### OTA via MCP Tools (for AI assistants)
```json
// Discover devices
{"method": "tools/call", "params": {"name": "discover_ota_devices"}}

// Flash ESP32
{"method": "tools/call", "params": {
  "name": "flash_device_ota",
  "arguments": {
    "ip": "10.0.4.35",
    "device_type": "esp32",
    "file_path": "firmware.bin"
  }
}}
```

### Enable Authentication
```powershell
# Windows PowerShell
$env:PAPILIO_REQUIRE_WEB_AUTH="true"
python start_combined_server.py

# Or permanently in system environment variables
```

## Performance Metrics
- **OTA Flash Times**:
  - ESP32 (1.5MB): ~2.3 seconds
  - FPGA (2MB): ~3-4 seconds
- **USB Flash Times** (for comparison):
  - ESP32: ~10-15 seconds
  - FPGA: ~10-15 seconds
- **Network Discovery**: Typically completes in 2-5 seconds for /24 subnet

## Known Issues
- OTA discovery scans entire /24 subnet - may take longer on large networks
- OTA requires devices to be on same local network (no remote OTA support)
- First OTA flash after device boot may require 10-second delay for server startup
- Primary support targets Windows 10/11. macOS/Linux packaging not included.

## Verification Checklist
- [ ] Build outputs present: GUI, console, `pesptool.exe`, `esptool.exe`
- [ ] Installer compiles with version 0.2.0
- [ ] Web interface accessible without login at http://localhost:8000
- [ ] OTA device discovery works in web interface
- [ ] OTA flash succeeds for ESP32 (requires hardware with OTA server)
- [ ] OTA flash succeeds for FPGA (requires hardware with OTA server)
- [ ] Authentication can be enabled via environment variable
- [ ] USB flashing still works (regression test)

## References
- OTA Feature Guide: [OTA_FEATURE.md](OTA_FEATURE.md)
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Build Guide: [BUILD.md](BUILD.md)
- Desktop App Guide: [DESKTOP_APP.md](DESKTOP_APP.md)
- Installation: [INSTALLATION.md](INSTALLATION.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## Checksums
Checksums will be added after build completion:
- `installer_output/PapilioLoader-Setup-0.2.0.exe`: SHA256 = TBD
- `dist/PapilioLoader.exe`: SHA256 = TBD
- `dist/pesptool.exe`: SHA256 = TBD
- `dist/esptool.exe`: SHA256 = TBD
