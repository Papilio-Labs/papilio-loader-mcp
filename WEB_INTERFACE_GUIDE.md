# Papilio Loader - Web Interface Guide

## Overview

The Papilio Loader now includes a **web interface** that allows end users to manually upload and flash FPGA and ESP32 firmware files through a browser. This works simultaneously with the MCP server interface for AI assistants.

## Features

✅ **Session-based authentication** for secure web access  
✅ **Modern, responsive UI** with real-time status updates  
✅ **FPGA flashing** using pesptool (Gowin FPGA bitstreams)  
✅ **ESP32 flashing** using esptool (official tool)  
✅ **Automatic port detection** with refresh functionality  
✅ **File validation** and progress tracking  
✅ **Simultaneous operation** with MCP server

## Quick Start

### 1. Install Dependencies

```powershell
# Install all Python dependencies
uv pip install -e .
```

### 2. Configure (Optional)

Set environment variables to customize authentication:

```powershell
# Windows PowerShell
$env:PAPILIO_WEB_USERNAME = "admin"
$env:PAPILIO_WEB_PASSWORD = "your-secure-password"
$env:PAPILIO_SESSION_SECRET_KEY = "your-secret-key-here"
```

Default credentials (if not set):
- **Username**: `admin`
- **Password**: `admin`

⚠️ **Change these in production!**

### 3. Start the Combined Server

```powershell
# Option 1: Use the convenient startup script
.\start.ps1

# Option 2: Run directly
python start_combined_server.py

# Option 3: Custom host/port
python start_combined_server.py --host 0.0.0.0 --port 8000
```

### 4. Access the Web Interface

Open your browser and navigate to:
```
http://localhost:8000/web/login
```

Or from another device on your network:
```
http://YOUR-IP-ADDRESS:8000/web/login
```

## Using the Web Interface

### Login

1. Navigate to `http://localhost:8000/web/login`
2. Enter your username and password (default: admin/admin)
3. Click "Login"

### Uploading FPGA Firmware

1. After login, you'll see the upload page
2. In the **FPGA Flash** card:
   - Select the COM port from the dropdown
   - Click "Click to select .bin file" and choose your Gowin FPGA bitstream (.bin file)
   - Check/uncheck "Verify after flashing" as needed
   - Click "⚡ Flash FPGA"
3. Monitor progress in the Status Log below

### Uploading ESP32 Firmware

1. In the **ESP32 Flash** card:
   - Select the COM port from the dropdown
   - Set the flash address (default: `0x1000`)
   - Click "Click to select .bin or .elf file" and choose your firmware
   - Check/uncheck "Verify after flashing" as needed
   - Click "⚡ Flash ESP32"
2. Monitor progress in the Status Log below

### Tips

- Use the **🔄 Refresh** button to update the list of available ports
- The Status Log shows timestamps and color-coded messages
- Files are automatically validated before uploading
- Maximum file size: 50 MB (configurable)

## Architecture

### How It Works Together

The combined server runs three interfaces simultaneously:

```
┌─────────────────────────────────────────┐
│     Combined Server (Port 8000)        │
├─────────────────────────────────────────┤
│                                         │
│  /sse, /messages/  ← MCP Interface     │
│  /web/*           ← Web UI (session)   │
│  /ports, /docs    ← REST API (key)     │
│                                         │
└─────────────────────────────────────────┘
```

1. **MCP Interface** (`/sse`, `/messages/`) - For AI assistants via SSE
2. **Web Interface** (`/web/*`) - Session-based auth for human users
3. **REST API** (`/ports`, etc.) - Optional API key auth for programmatic access

### Authentication Methods

- **Web Interface**: Session-based (username/password)
- **REST API**: Optional API key via `X-API-Key` header
- **MCP Interface**: No authentication (designed for local AI assistants)

## Configuration

All settings can be configured via environment variables with the `PAPILIO_` prefix:

| Variable | Default | Description |
|----------|---------|-------------|
| `PAPILIO_BIND_ADDRESS` | `0.0.0.0` | Server bind address |
| `PAPILIO_PORT` | `8000` | Server port |
| `PAPILIO_WEB_USERNAME` | `admin` | Web login username |
| `PAPILIO_WEB_PASSWORD` | `admin` | Web login password |
| `PAPILIO_SESSION_SECRET_KEY` | `change-this-secret-key-in-production` | Session encryption key |
| `PAPILIO_API_KEY` | `None` | Optional API key for REST endpoints |
| `PAPILIO_MAX_UPLOAD_SIZE` | `52428800` | Max file size (50 MB) |
| `PAPILIO_CORS_ORIGINS` | `["*"]` | CORS allowed origins |

Example:
```powershell
$env:PAPILIO_WEB_PASSWORD = "MySecurePassword123!"
$env:PAPILIO_SESSION_SECRET_KEY = "a-long-random-string-here"
python start_combined_server.py
```

## Security Considerations

### Production Deployment

When deploying to production:

1. **Change default credentials**:
   ```powershell
   $env:PAPILIO_WEB_USERNAME = "yourusername"
   $env:PAPILIO_WEB_PASSWORD = "StrongPassword123!"
   ```

2. **Set a secure session secret**:
   ```powershell
   $env:PAPILIO_SESSION_SECRET_KEY = "$(openssl rand -hex 32)"
   ```

3. **Enable API key authentication** (for REST API):
   ```powershell
   $env:PAPILIO_API_KEY = "your-api-key-here"
   ```

4. **Use HTTPS** (behind a reverse proxy like nginx or Caddy)

5. **Restrict CORS origins**:
   ```powershell
   $env:PAPILIO_CORS_ORIGINS = '["https://yourdomain.com"]'
   ```

## Troubleshooting

### Port Already in Use

If you get "Address already in use" error:
```powershell
# Use a different port
python start_combined_server.py --port 8001
```

### Cannot See Devices

- Make sure devices are connected and drivers are installed
- Click the "🔄 Refresh" button to update the port list
- Check Windows Device Manager for COM port numbers

### Login Not Working

- Check that you're using the correct credentials
- Clear browser cookies and try again
- Verify environment variables are set correctly

### File Upload Fails

- Ensure file is the correct format (.bin for FPGA, .bin/.elf for ESP32)
- Check file size is under 50 MB
- Verify device is connected to the selected port

## Development

### Running Only Web Interface

```powershell
python start_api.py
```

### Running Only MCP Server

```powershell
python start_mcp_server.py
```

### Testing

Access the API documentation at:
```
http://localhost:8000/docs
```

## File Structure

```
papilio-loader-mcp/
├── start_combined_server.py  # Combined server (MCP + Web)
├── start.ps1                  # Convenience startup script
├── templates/
│   ├── login.html            # Web login page
│   └── upload.html           # Web upload interface
├── src/papilio_loader_mcp/
│   ├── api.py                # FastAPI routes (REST + Web)
│   ├── config.py             # Configuration
│   ├── server.py             # MCP server core
│   └── tools/                # Device tools
└── ...
```

## Support

For issues or questions:
1. Check the logs in the terminal output
2. Review the Status Log in the web interface
3. Ensure all dependencies are installed
4. Verify device connections and drivers

## License

See LICENSE file for details.
