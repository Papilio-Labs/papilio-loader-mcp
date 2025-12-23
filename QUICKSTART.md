# Papilio Loader MCP Server - Quick Start Scripts

## Start API Server (Windows PowerShell)

```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Start the API server
python start_api.py
```

## Start API Server (Command Prompt)

```cmd
REM Activate virtual environment
.venv\Scripts\activate.bat

REM Start the API server  
python start_api.py
```

## Start MCP Server for Claude Desktop

Add this to your Claude Desktop config file:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "papilio-loader": {
      "command": "C:\\development\\papilio-loader-mcp\\.venv\\Scripts\\python.exe",
      "args": ["-m", "papilio_loader_mcp.server"]
    }
  }
}
```

## Development Commands

```powershell
# Install dependencies
uv sync

# Run tests
uv run pytest

# Format code
uv run black src/

# Lint code
uv run ruff check src/
```

## Test API with curl

```bash
# Health check
curl http://localhost:8000/health

# List ports
curl http://localhost:8000/ports

# Get device info (with API key)
curl -X POST http://localhost:8000/device/info \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"port": "COM3", "device_type": "esp32"}'
```

## Network Access from WSL/Linux

From WSL or another Linux machine on your network:

```bash
# Find Windows host IP
# On Windows: ipconfig | findstr IPv4

# Test connection
curl http://192.168.1.100:8000/health

# Flash device
curl -X POST http://192.168.1.100:8000/flash/upload \
  -F "file=@firmware.bin" \
  -F "port=COM3" \
  -F "device_type=esp32" \
  -F "address=0x1000"
```
