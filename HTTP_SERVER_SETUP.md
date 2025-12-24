# HTTP/SSE Server Setup Guide

## Overview

This guide shows you how to set up the Papilio Loader MCP Server as a standalone HTTP/SSE server running on Windows. This is the recommended approach for:

- Running the server as a Windows service
- Accessing the server from remote machines
- Having a persistent server that's always available
- Better separation between VS Code and the hardware interface

## Quick Start

### Step 1: Install Dependencies

```bash
cd c:\development\papilio-loader-mcp
python -m pip install mcp starlette sse-starlette uvicorn pyserial
```

### Step 2: Start the Server

```bash
python start_mcp_server.py
```

You should see output like this:

```
============================================================
Papilio Loader MCP Server
============================================================

Starting HTTP server on http://127.0.0.1:8765
SSE endpoint: http://127.0.0.1:8765/sse

Configure VS Code .vscode/mcp.json with:
{
  "servers": {
    "papilio-loader": {
      "type": "sse",
      "url": "http://127.0.0.1:8765/sse"
    }
  }
}

Press Ctrl+C to stop
============================================================

INFO:     Started server process [11128]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8765 (Press CTRL+C to quit)
```

### Step 3: Configure VS Code

1. In your project, create or update `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "papilio-loader": {
      "type": "sse",
      "url": "http://127.0.0.1:8765/sse"
    }
  }
}
```

2. Reload VS Code window: `Ctrl+Shift+P` → "Developer: Reload Window"

3. Open GitHub Copilot Chat and try: **"List available serial ports"**

## Technical Details

### Architecture

The HTTP/SSE server uses:

- **Starlette** - Fast ASGI web framework
- **Uvicorn** - ASGI server
- **MCP SSE Transport** - Server-Sent Events transport for real-time communication
- **MCP Server** - Core server with tool definitions

Based on working implementations from:
- `theailanguage/terminal_server`  
- `microsoft/semantic-kernel`

### Endpoints

The server exposes two endpoints:

1. **`/sse`** (GET) - Initiates SSE connection for streaming server messages to client
2. **`/messages/`** (POST) - Receives client messages (JSON-RPC requests)

### Communication Flow

```
┌──────────────┐         HTTP/SSE          ┌─────────────────┐
│  VS Code     │ ─────────────────────────▶│  MCP Server     │
│  MCP Client  │◀───────────────────────── │  (Starlette)    │
└──────────────┘    SSE: Server Messages   └─────────────────┘
                    POST: Client Requests           │
                                                    │ Serial/USB
                                                    ▼
                                            ┌─────────────────┐
                                            │ FPGA / ESP32    │
                                            └─────────────────┘
```

## Network Access

To access the server from other machines (WSL, Linux, remote VS Code):

### 1. Start with Network Binding

```bash
python -m papilio_loader_mcp.http_server --host 0.0.0.0 --port 8765
```

### 2. Find Your Windows IP Address

```powershell
ipconfig | findstr IPv4
# Example output: IPv4 Address. . . . . . . . . . . : 192.168.1.100
```

### 3. Update `.vscode/mcp.json`

```json
{
  "mcpServers": {
    "papilio-loader": {
      "type": "sse",
      "url": "http://192.168.1.100:8765/sse"
    }
  }
}
```

### 4. Configure Windows Firewall

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "Papilio MCP Server" `
  -Direction Inbound `
  -LocalPort 8765 `
  -Protocol TCP `
  -Action Allow
```

## Running as Windows Service

To have the server start automatically with Windows:

### Option 1: Using NSSM (Recommended)

NSSM (Non-Sucking Service Manager) is the easiest way to run Python scripts as Windows services.

1. **Download NSSM** from https://nssm.cc/download

2. **Extract and run as Administrator:**

```powershell
# Install service
nssm install PapilioMCP "C:\Python314\python.exe" "C:\development\papilio-loader-mcp\start_mcp_server.py"

# Set working directory
nssm set PapilioMCP AppDirectory "C:\development\papilio-loader-mcp"

# Set description
nssm set PapilioMCP Description "Papilio Loader MCP Server for FPGA and ESP32 programming"

# Start service
nssm start PapilioMCP

# Check status
nssm status PapilioMCP

# View logs
nssm set PapilioMCP AppStdout "C:\development\papilio-loader-mcp\logs\stdout.log"
nssm set PapilioMCP AppStderr "C:\development\papilio-loader-mcp\logs\stderr.log"
```

3. **Service Management:**

```powershell
# Start
nssm start PapilioMCP

# Stop
nssm stop PapilioMCP

# Restart
nssm restart PapilioMCP

# Remove service
nssm remove PapilioMCP confirm
```

### Option 2: Using Task Scheduler

1. Open **Task Scheduler** (`taskschd.msc`)

2. **Create Basic Task:**
   - Name: `Papilio MCP Server`
   - Description: `Standalone MCP server for device programming`
   - Trigger: **When the computer starts**
   - Action: **Start a program**
     - Program: `C:\Python314\python.exe`
     - Arguments: `C:\development\papilio-loader-mcp\start_mcp_server.py`
     - Start in: `C:\development\papilio-loader-mcp`

3. **Configure Properties:**
   - General tab:
     - ☑ Run whether user is logged on or not
     - ☑ Run with highest privileges
   - Conditions tab:
     - ☑ Start only if the computer is on AC power (optional)
   - Settings tab:
     - ☑ Allow task to be run on demand
     - ☑ If the task fails, restart every: 1 minute (3 attempts)

## Troubleshooting

### Server Won't Start

**Check if port is already in use:**

```bash
netstat -ano | findstr :8765
```

If the port is in use, try a different port:

```bash
python start_mcp_server.py --port 8766
```

### VS Code Can't Connect

1. **Verify server is running**
   - Check terminal output for "Uvicorn running on..."

2. **Check URL in .vscode/mcp.json**
   - Must match exactly: `http://127.0.0.1:8765/sse`

3. **Reload VS Code window**
   - `Ctrl+Shift+P` → "Developer: Reload Window"

4. **Check VS Code Developer Console**
   - `Help` → `Toggle Developer Tools`
   - Look for MCP connection errors in Console

### Serial Port Access Issues

If tools can't access serial ports:

1. **Close other programs using COM ports:**
   - Arduino IDE
   - PuTTY
   - Tera Term
   - Any other serial terminals

2. **Check Device Manager:**
   - Look for COM port conflicts
   - Update serial port drivers

3. **Verify port permissions:**
   - Some USB devices need administrator rights

### Network Connection Issues

**Can't connect from remote machine:**

1. Verify server is listening on `0.0.0.0`:
   ```bash
   netstat -an | findstr :8765
   ```

2. Check Windows Firewall:
   ```powershell
   Get-NetFirewallRule -DisplayName "Papilio MCP Server"
   ```

3. Test with curl from remote machine:
   ```bash
   curl http://192.168.1.100:8765/sse
   ```

4. Check network connectivity:
   ```bash
   ping 192.168.1.100
   ```

## Server Customization

### Command Line Options

```bash
python -m papilio_loader_mcp.http_server --help

Options:
  --host TEXT     Host to bind to (default: 127.0.0.1)
  --port INTEGER  Port to bind to (default: 8765)
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Server settings
PAPILIO_HOST=0.0.0.0
PAPILIO_PORT=8765

# Serial settings
PAPILIO_DEFAULT_BAUD_RATE=115200
PAPILIO_SERIAL_TIMEOUT=10
```

### Logging Configuration

To enable debug logging, modify `http_server.py`:

```python
import logging
logging.basicConfig(level=logging.DEBUG)  # Change from INFO to DEBUG
```

## Performance

The HTTP/SSE server is lightweight and efficient:

- **Memory**: ~50-100 MB
- **CPU**: Minimal (idle ~0%, active ~1-5%)
- **Latency**: <10ms for tool calls
- **Concurrent Clients**: Supports multiple connections

## Security Considerations

For production use:

1. **Use HTTPS** instead of HTTP:
   - Set up nginx/Apache as reverse proxy with SSL
   - Or use Uvicorn with SSL certificates

2. **Add Authentication:**
   - Implement API key authentication
   - Use OAuth2 for enterprise environments

3. **Network Isolation:**
   - Run on internal network only
   - Use VPN for remote access

4. **Firewall Rules:**
   - Restrict access to specific IP ranges
   - Monitor connection logs

## Next Steps

- See [README.md](README.md) for full documentation
- Check [VSCODE_SETUP.md](VSCODE_SETUP.md) for VS Code integration details
- Review [src/papilio_loader_mcp/tools/](src/papilio_loader_mcp/tools/) for available tools
- Try the test scripts in [debugging/](debugging/) to verify functionality

## Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review server logs in terminal
3. Check VS Code Developer Console
4. Open an issue on GitHub with:
   - Server output
   - VS Code console errors
   - Your configuration files
   - Steps to reproduce
