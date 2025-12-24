# MCP Server Installation and Testing Guide

## Installation Steps

### 1. Install the Package

```bash
cd c:\development\papilio-loader-mcp
pip install -e .
```

This will install:
- `papilio-loader-mcp` package
- Official `esptool` for ESP32 programming
- All required dependencies (FastAPI, MCP SDK, pyserial, etc.)

### 2. Configure Claude Desktop

Add this to your Claude Desktop configuration file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "papilio-loader": {
      "command": "python",
      "args": [
        "-m",
        "papilio_loader_mcp.server"
      ]
    }
  }
}
```

### 3. Restart Claude Desktop

After updating the configuration, restart Claude Desktop to load the MCP server.

## Available MCP Tools

Once installed, you can ask Claude to:

1. **`list_serial_ports`** - List all available COM ports
   ```
   "List the serial ports on my system"
   ```

2. **`get_device_info`** - Get device information
   ```
   "Get device info for COM4"
   ```

3. **`flash_device`** - Flash FPGA or ESP32
   ```
   "Flash the FPGA bitstream at c:/path/to/bitstream.bin to COM4"
   "Flash ESP32 firmware at c:/path/to/firmware.bin to COM4 at address 0x10000"
   ```

## Direct Python Testing

You can also test the tools directly in Python:

```python
import asyncio
from papilio_loader_mcp.tools.serial_ports import list_serial_ports
from papilio_loader_mcp.tools.fpga_flash import flash_fpga_device  
from papilio_loader_mcp.tools.esp_flash import flash_esp_device

# Test serial ports
result = asyncio.run(list_serial_ports())
print(result)

# Flash FPGA
result = asyncio.run(flash_fpga_device(
    "COM4",
    "c:/path/to/bitstream.bin",
    verify=False
))
print(result)

# Flash ESP32
result = asyncio.run(flash_esp_device(
    "COM4",
    "c:/path/to/firmware.bin",
    "0x10000",
    verify=False
))
print(result)
```

## Test with Debugging Scripts

Pre-configured test scripts are available in the `debugging/` directory:

```bash
# Test both FPGA and ESP32 flashing
python debugging\test_flash_both.py

# Test serial port listing  
python debugging\test_ports.py

# Test COM4 device detection
python debugging\test_com4_device.py
```

## Tool Separation (Safety)

The implementation uses two separate tools for safety:

- **Official esptool** (v5.1.0) → ESP32 firmware programming
  - Safe, stable, widely supported
  - Installed via pip

- **pesptool** (GadgetFactory fork) → FPGA bitstream programming ONLY
  - Located in `tools/pesptool/` (git submodule)
  - Used exclusively for external flash programming

## Verification

To verify the installation:

```bash
# Check if package is installed
pip show papilio-loader-mcp

# Check if esptool is available
python -m esptool version

# Test the MCP server directly
python -m papilio_loader_mcp.server
# (Then type Ctrl+C to stop)
```

## Example Usage in Claude

Once configured, you can use natural language:

- "Show me the available serial ports"
- "Flash this FPGA bitstream to COM4: c:/dev/papilio-loader-mcp/debugging/papilio_arcade_template.bin"
- "Flash ESP32 firmware to COM4 at address 0x10000: c:/dev/papilio-loader-mcp/debugging/firmware.bin"

The server automatically:
- Detects file types (.bin, .elf)
- Uses the correct tool (esptool for ESP32, pesptool for FPGA)
- Validates files before flashing
- Returns detailed results with success/error information
