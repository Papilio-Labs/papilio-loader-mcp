# 🚀 Quick Start Guide

## Start the Server

```powershell
.\start.ps1
```

## Access Points

| Interface | URL | Purpose |
|-----------|-----|---------|
| **Web UI** | http://localhost:8000/web/login | Manual device flashing (humans) |
| **MCP Server** | http://localhost:8000/sse | AI assistant integration |
| **API Docs** | http://localhost:8000/docs | REST API documentation |

## Default Login

- **Username**: `admin`
- **Password**: `admin`

⚠️ **Change in production!**

## Change Credentials

```powershell
$env:PAPILIO_WEB_USERNAME = "newuser"
$env:PAPILIO_WEB_PASSWORD = "newpass"
python start_combined_server.py
```

## Flashing Devices

### FPGA (Gowin)
1. Select COM port
2. Upload `.bin` file
3. Click "Flash FPGA"

### ESP32
1. Select COM port
2. Set address (e.g., `0x1000`)
3. Upload `.bin` or `.elf` file
4. Click "Flash ESP32"

## Troubleshooting

**No ports showing?**
- Click "🔄 Refresh" button
- Check device is connected
- Verify drivers installed

**Port already in use?**
```powershell
python start_combined_server.py --port 8001
```

**Login not working?**
- Clear browser cookies
- Check credentials in config
- Restart server

## Files Supported

- **FPGA**: `.bin` (Gowin bitstreams)
- **ESP32**: `.bin`, `.elf` (firmware)

## More Info

- **User Guide**: [WEB_INTERFACE_GUIDE.md](WEB_INTERFACE_GUIDE.md)
- **Implementation**: [WEB_IMPLEMENTATION.md](WEB_IMPLEMENTATION.md)
- **General README**: [README.md](README.md)
