# Papilio Loader MCP Server

An MCP (Model Context Protocol) server for loading FPGA bit files and ESP32 firmware over the network. This server runs on Windows with direct access to USB/serial ports, while allowing remote clients (like WSL or Linux machines) to program devices over the network.

## Features

- **MCP Server**: Integrates with Claude Desktop and other MCP clients for AI-assisted device programming
- **REST API**: FastAPI-based HTTP API for remote network access
- **FPGA Programming**: Flash Papilio FPGA boards using papilio-prog
- **ESP32 Programming**: Flash ESP32 devices using pesptool (bundled esptool fork from GadgetFactory)
- **Multi-format Support**: Handles FPGA bit files, ESP32 bin/elf files, and multi-partition flashing
- **Network-based**: Run on Windows with serial port access, control from WSL/Linux over network

## Architecture

```
┌─────────────────┐         Network          ┌──────────────────┐
│   WSL / Linux   │ ◄────────────────────► │  Windows Host    │
│  Build Machine  │      HTTP/MCP           │   MCP Server     │
│                 │                         │                  │
│ - Build FPGA    │                         │ - pyserial       │
│ - Build ESP32   │                         │ - papilio-prog   │
│ - Send files    │                         │ - pesptool       │
└─────────────────┘                         └────────┬─────────┘
                                                     │ USB/Serial
                                                     ▼
                                            ┌─────────────────┐
                                            │ FPGA / ESP32    │
                                            │ Hardware        │
                                            └─────────────────┘
```

## Installation

### Prerequisites

1. **Python 3.12+**: Required for running the server
2. **papilio-prog**: External dependency for FPGA programming
   - Download from [Papilio Loader](http://papilio.cc/index.php?n=Papilio.PapilioLoaderV2)
   - Add to your system PATH
3. **pesptool**: Included as git submodule (GadgetFactory's esptool fork)

### Setup

```bash
# Clone the repository
git clone https://github.com/papilio-labs/papilio-loader-mcp.git
cd papilio-loader-mcp

# Initialize submodules
git submodule update --init --recursive

# Create virtual environment using uv
uv venv

# Install dependencies
uv pip install -e .
```

## Configuration

Set environment variables to configure the server:

```bash
# Network settings
PAPILIO_BIND_ADDRESS=0.0.0.0  # Use 0.0.0.0 for remote access, 127.0.0.1 for local only
PAPILIO_PORT=8000

# Security
PAPILIO_API_KEY=your-secret-key-here  # Optional API authentication
PAPILIO_CORS_ORIGINS=["http://localhost:3000"]  # Comma-separated list

# Limits
PAPILIO_MAX_UPLOAD_SIZE=52428800  # 50 MB in bytes
PAPILIO_RATE_LIMIT=60  # Requests per minute

# Serial settings
PAPILIO_DEFAULT_BAUD_RATE=115200
PAPILIO_SERIAL_TIMEOUT=10
```

## Usage

### As MCP Server (Claude Desktop)

1. Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "papilio-loader": {
      "command": "python",
      "args": ["-m", "papilio_loader_mcp.server"]
    }
  }
}
```

2. Restart Claude Desktop

3. Use natural language to interact:
   - "List available serial ports"
   - "Flash this bit file to COM3"
   - "Get ESP32 chip information on /dev/ttyUSB0"

### As REST API Server

```bash
# Start the API server
python -m papilio_loader_mcp.api

# Or use uvicorn directly
uvicorn papilio_loader_mcp.api:api --host 0.0.0.0 --port 8000
```

### API Endpoints

#### Health Check
```bash
curl http://localhost:8000/health
```

#### List Serial Ports
```bash
curl -H "X-API-Key: your-key" http://localhost:8000/ports
```

#### Get Device Info
```bash
curl -X POST http://localhost:8000/device/info \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"port": "COM3", "device_type": "esp32"}'
```

#### Flash Device
```bash
curl -X POST http://localhost:8000/flash/upload \
  -H "X-API-Key: your-key" \
  -F "file=@firmware.bin" \
  -F "port=COM3" \
  -F "device_type=esp32" \
  -F "address=0x1000" \
  -F "verify=true"
```

## MCP Tools

The server provides these MCP tools:

- `list_serial_ports`: List all available COM ports
- `get_device_info`: Query device information (FPGA/ESP32)
- `get_flash_status`: Get flash memory status and info
- `flash_device`: Flash firmware to device with verification

## Development

### Project Structure

```
papilio-loader-mcp/
├── src/
│   └── papilio_loader_mcp/
│       ├── __init__.py
│       ├── server.py          # MCP server implementation
│       ├── api.py             # FastAPI REST API
│       ├── config.py          # Configuration management
│       └── tools/             # Tool implementations
│           ├── serial_ports.py
│           ├── device_info.py
│           ├── flash_status.py
│           ├── fpga_flash.py
│           └── esp_flash.py
├── tools/
│   └── pesptool/             # Git submodule (GadgetFactory/esptool)
├── temp/                     # Temporary file uploads
├── logs/                     # Application logs
├── pyproject.toml
└── README.md
```

### Running Tests

```bash
# TODO: Add tests
uv run pytest
```

## Client Examples

### Python Client

```python
import requests

API_URL = "http://windows-host:8000"
API_KEY = "your-key"

headers = {"X-API-Key": API_KEY}

# List ports
response = requests.get(f"{API_URL}/ports", headers=headers)
print(response.json())

# Flash ESP32
with open("firmware.bin", "rb") as f:
    files = {"file": f}
    data = {
        "port": "COM3",
        "device_type": "esp32",
        "address": "0x1000",
        "verify": "true"
    }
    response = requests.post(
        f"{API_URL}/flash/upload",
        headers=headers,
        files=files,
        data=data
    )
    print(response.json())
```

### WSL/Linux Client

```bash
#!/bin/bash
# flash_from_wsl.sh

WINDOWS_HOST="192.168.1.100:8000"
API_KEY="your-key"

# Build your project
make build

# Flash to device via Windows host
curl -X POST "http://${WINDOWS_HOST}/flash/upload" \
  -H "X-API-Key: ${API_KEY}" \
  -F "file=@build/firmware.bin" \
  -F "port=COM3" \
  -F "device_type=esp32" \
  -F "address=0x1000"
```

### curl Examples

```bash
# List ports
curl http://localhost:8000/ports

# Get device info
curl -X POST http://localhost:8000/device/info \
  -H "Content-Type: application/json" \
  -d '{"port": "COM3", "device_type": "fpga"}'

# Flash FPGA
curl -X POST http://localhost:8000/flash/upload \
  -F "file=@design.bit" \
  -F "port=COM3" \
  -F "device_type=fpga"
```

## Troubleshooting

### Port Access Issues
- Ensure no other programs are using the serial port
- On Windows, check Device Manager for COM port assignments
- Verify USB drivers are installed for your device

### Permission Errors
- Run as Administrator on Windows if accessing USB ports fails
- Check firewall settings for network access

### pesptool Not Found
- Ensure git submodules are initialized: `git submodule update --init`
- Check that `tools/pesptool/esptool.py` exists

### papilio-prog Not Found
- Download and install Papilio Loader
- Add papilio-prog to your system PATH
- Verify with: `papilio-prog --version`

## License

[Add your license here]

## Contributing

Contributions welcome! Please open issues or pull requests.

## References

- [MCP (Model Context Protocol)](https://github.com/anthropics/mcp)
- [Papilio FPGA](http://papilio.cc)
- [GadgetFactory pesptool](https://github.com/GadgetFactory/esptool)
- [ESP32 Documentation](https://docs.espressif.com/projects/esp-idf/)
