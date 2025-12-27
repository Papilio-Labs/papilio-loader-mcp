# Installation Guide

## Prerequisites

- **Python 3.12+**
- **Git** with submodule support
- **Windows** (required for COM port access)

## Installation

```bash
# Clone repository with submodules
git clone https://github.com/papilio-labs/papilio-loader-mcp.git
cd papilio-loader-mcp
git submodule update --init --recursive

# Install dependencies
uv pip install -e .
```

This installs:
- Official esptool for ESP32
- All Python dependencies (FastAPI, MCP SDK, pyserial)
- pesptool submodule for FPGA (GadgetFactory fork)

## Configuration

### For MCP (Claude Desktop)

Add to `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "papilio-loader": {
      "type": "sse",
      "url": "http://localhost:8000/sse"
    }
  }
}
```

Restart Claude Desktop after updating the config.

### For Web Interface

Set environment variables (optional, defaults to admin/admin):

```powershell
$env:PAPILIO_WEB_USERNAME = "your_username"
$env:PAPILIO_WEB_PASSWORD = "your_password"
$env:PAPILIO_SESSION_SECRET_KEY = "random-secret-key"
```

## Starting the Server

```powershell
.\start.ps1
```

Access points:
- **Web**: http://localhost:8000/web/login
- **MCP**: http://localhost:8000/sse (for Claude)
- **API**: http://localhost:8000/docs

## Testing

### Test MCP Tools

In Claude Desktop, ask:
- "List the serial ports on my system"
- "Get device info for COM4"
- "Flash the FPGA bitstream at C:/path/to/file.bin to COM4"

### Test Web Interface

1. Open http://localhost:8000/web/login
2. Login with credentials (default: admin/admin)
3. Select port and upload firmware file
4. Click Flash button

### Test REST API

```bash
# List ports
curl http://localhost:8000/ports

# Flash device
curl -X POST http://localhost:8000/flash/upload \
  -F "file=@firmware.bin" \
  -F "port=COM4" \
  -F "device_type=esp32" \
  -F "address=0x1000"
```

## Troubleshooting

**Import errors?**
```powershell
uv pip install -e .
```

**Submodule missing?**
```bash
git submodule update --init --recursive
```

**COM port access denied?**
- Run PowerShell as Administrator
- Check drivers are installed
- Close other programs using the port

## Next Steps

- **Quick Start**: See [QUICKSTART.md](QUICKSTART.md)
- **Web Guide**: See [WEB_INTERFACE_GUIDE.md](WEB_INTERFACE_GUIDE.md)
- **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md)
