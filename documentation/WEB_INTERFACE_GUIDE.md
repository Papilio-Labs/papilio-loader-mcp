# Web Interface User Guide

## Features

- **Session-based authentication** for secure access
- **Saved Files Library** - Save frequently-used firmware with descriptions
- **FPGA flashing** - Gowin FPGA bitstreams (.bin) via pesptool
- **ESP32 flashing** - Firmware (.bin/.elf) via official esptool
- **Auto port detection** with refresh
- **Real-time status logging** with color-coded messages
- **Runs alongside MCP and API** on the same port

## Getting Started

Start the server:
```powershell
.\start.ps1
```

Access at: **http://localhost:8000/web/login**

Default credentials: **admin / admin** ⚠️ Change in production!

### Configure Authentication

```powershell
$env:PAPILIO_WEB_USERNAME = "your_username"
$env:PAPILIO_WEB_PASSWORD = "secure_password"
$env:PAPILIO_SESSION_SECRET_KEY = "random-secret-key"
```

## Using the Interface

### Flashing FPGA Firmware

1. Select the COM port
2. Click to select a .bin file (Gowin FPGA bitstream)
3. Optional: Check "Verify after flashing"
4. Click "⚡ Flash FPGA"
5. Monitor progress in Status Log

### Flashing ESP32 Firmware

1. Select the COM port  
2. Set flash address (default: 0x1000)
3. Click to select .bin or .elf file
4. Optional: Check "Verify after flashing"
5. Click "⚡ Flash ESP32"
6. Monitor progress in Status Log

### Saved Files Library

**Save a file:**
1. Check "💾 Save this file to library" before flashing
2. Enter a description (e.g., "Arcade v1.2")
3. Flash normally - file is saved automatically

**Load a saved file:**
1. Click "💾 Saved Files Library" to expand
2. Use tabs to filter by device type
3. Click "📥 Load" on the file you want
4. File loads into the flash form automatically

**Manage files:**
- **Rename**: Click "📝" button, enter new name
- **Edit Description**: Click "📝 Edit Description", update text
- **Delete**: Click "🗑️" button, confirm deletion

## Tips

- Use **🔄 Refresh** to update port list when connecting devices
- Status Log shows color-coded messages with timestamps
- Files are validated automatically before upload
- Advanced options (ports, verify, addresses) can be collapsed

## Network Access

To access from other devices on your network:

```powershell
# Start server on all interfaces
python start_combined_server.py --host 0.0.0.0

# Access from other devices
http://YOUR-WINDOWS-IP:8000/web/login
```

**Security Note**: Set strong credentials before allowing network access!

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No ports showing | Click 🔄 Refresh, check device connections and drivers |
| Login fails | Verify credentials (default admin/admin), clear browser cookies |
| Upload fails | Check file type (.bin for FPGA, .bin/.elf for ESP32) |
| Permission errors | Run PowerShell as Administrator, check COM port access |

## Security Best Practices

1. **Change default credentials** before production use
2. **Use HTTPS** if exposing to network (requires reverse proxy)
3. **Set strong session secret**: 
   ```powershell
   $env:PAPILIO_SESSION_SECRET_KEY = (New-Guid).ToString()
   ```
4. **Enable API key** for REST endpoints if needed
5. **Use firewall rules** to limit network access

## Integration with Other Interfaces

The web interface runs alongside:
- **MCP Server** at http://localhost:8000/sse
- **REST API** at http://localhost:8000/docs

All three work simultaneously without conflicts. Choose the interface that best fits your workflow:
- **Web**: Manual uploads, testing, demonstrations
- **MCP**: AI-assisted workflows with Claude Desktop
- **API**: Automation, CI/CD, custom applications

See [INTERFACE_COMPARISON.md](INTERFACE_COMPARISON.md) for detailed comparison.
