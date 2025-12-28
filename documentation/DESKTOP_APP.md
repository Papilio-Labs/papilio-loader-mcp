# Papilio Loader Desktop Application

The Papilio Loader is now available as a desktop application with system tray integration! This provides an easy-to-use interface for flashing FPGA bit files and ESP32 firmware without needing to run terminal commands.

## Features

- 🖥️ **System Tray Integration**: Runs quietly in your system tray
- 🌐 **Web Interface**: Full-featured web interface accessible from your browser
- 🚀 **Auto-Start**: Optional startup with Windows
- 📦 **Single Installer**: Easy Windows installation with one click
- 💾 **User Data Management**: Stores files and settings in your AppData folder
- 🔄 **Multiple Installation Methods**: Choose what works best for you

## Installation Methods

### Method 1: Windows Installer (Recommended for End Users)

The easiest way to install Papilio Loader on Windows:

1. Download the latest `PapilioLoader-Setup-x.x.x.exe` from [Releases](https://github.com/Papilio-Labs/papilio-loader-mcp/releases)
2. Run the installer
3. Choose installation options:
   - ✅ Create desktop shortcut (optional)
   - ✅ Run at Windows startup (optional)
4. Click Install

The application will be installed to `C:\Program Files\Papilio Loader\` and user data will be stored in `%LOCALAPPDATA%\papilio-loader-mcp\`.

**Note**: User data directory contains:
- Database of saved files
- Uploaded firmware files
- Application logs

### Method 2: Portable Executable

For users who prefer a portable version without installation:

1. Download `PapilioLoader.exe` from [Releases](https://github.com/Papilio-Labs/papilio-loader-mcp/releases)
2. Place it in any folder
3. Run the executable

User data will be stored in `%LOCALAPPDATA%\papilio-loader-mcp\` when run as a standalone executable.

### Method 3: Python Package (For Developers)

If you have Python 3.12+ installed:

```bash
# Install from PyPI
pip install papilio-loader-mcp

# Or install from source with desktop dependencies
git clone https://github.com/Papilio-Labs/papilio-loader-mcp.git
cd papilio-loader-mcp
pip install -e .[desktop]
```

Run the desktop application:

```bash
papilio-loader-desktop
```

Or directly:

```bash
python start_desktop.py
```

## Usage

### Starting the Application

**Windows Installer/Portable:**
- Double-click the Papilio Loader shortcut or executable
- The application icon will appear in your system tray

**Python:**
```bash
papilio-loader-desktop
```

### Using the Application

1. **System Tray Icon**: Look for the Papilio Loader icon in your system tray (bottom-right corner, near the clock)

2. **Open Web Interface**:
   - Right-click the tray icon
   - Select "Open Web Interface"
   - Your default browser will open to `http://localhost:8000`

3. **Web Interface Features**:
   - Login with default credentials (admin/admin)
   - View connected serial devices
   - Flash FPGA bit files to Papilio boards
   - Flash firmware to ESP32 devices
   - Save frequently used files for quick access
   - View device information

4. **Stopping the Application**:
   - Right-click the tray icon
   - Select "Stop Server and Exit"

### Default Configuration

- **Web Interface**: http://localhost:8000
- **Default Login**: admin/admin (⚠️ Change in production!)
- **User Data**: `%LOCALAPPDATA%\papilio-loader-mcp\`

### Configuration

You can configure the application using environment variables with the `PAPILIO_` prefix:

```powershell
# Set custom port
$env:PAPILIO_PORT = "8080"

# Set custom credentials
$env:PAPILIO_WEB_USERNAME = "myuser"
$env:PAPILIO_WEB_PASSWORD = "mypassword"

# Run the application
papilio-loader-desktop
```

Or create a `.env` file in the application directory.

## Building from Source

### Prerequisites

- Python 3.12 or later
- Git
- (Optional) Inno Setup 6 for creating Windows installer

### Build Steps

1. **Clone the repository**:
```bash
git clone https://github.com/Papilio-Labs/papilio-loader-mcp.git
cd papilio-loader-mcp
```

2. **Install dependencies**:
```bash
pip install -e .[desktop]
```

3. **Build the executable**:

Using Python:
```bash
python build.py
```

Using PowerShell:
```powershell
.\build.ps1
```

Build options:
- `--no-clean`: Skip cleaning previous build artifacts
- `--no-installer`: Build executable only, skip installer
- `--installer-only`: Create installer from existing build

4. **Output**:
- Executable: `dist/PapilioLoader.exe`
- Installer: `installer_output/PapilioLoader-Setup-x.x.x.exe`

### Manual Build with PyInstaller

If you prefer manual control:

```bash
# Install PyInstaller
pip install pyinstaller

# Build executable
pyinstaller papilio_loader.spec --clean

# The executable will be in dist/PapilioLoader.exe
```

### Creating the Installer

After building the executable:

1. Install [Inno Setup 6](https://jrsoftware.org/isinfo.php)
2. Open `installer.iss` in Inno Setup
3. Click "Compile" or run:
   ```powershell
   "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
   ```

## Troubleshooting

### Application Won't Start

1. Check if port 8000 is already in use:
   ```powershell
   netstat -ano | findstr :8000
   ```

2. Try a different port:
   ```powershell
   $env:PAPILIO_PORT = "8080"
   papilio-loader-desktop
   ```

3. Check logs in `%LOCALAPPDATA%\papilio-loader-mcp\`

### System Tray Icon Not Appearing

- The icon should appear within a few seconds of starting
- Check Windows system tray settings to ensure icons aren't hidden
- Look in the "hidden icons" overflow area

### Cannot Connect to Web Interface

- Verify the application is running (check system tray)
- Make sure you're using the correct URL: `http://localhost:8000`
- Check firewall settings if accessing from another computer

### Serial Port Access Issues

- Make sure you have the correct drivers installed for your device
- Close any other applications that might be using the serial port
- Try unplugging and reconnecting the device

### Build Errors

**"Module not found" errors:**
```bash
pip install -e .[desktop]
```

**PyInstaller hidden imports:**
Add missing modules to `hiddenimports` in `papilio_loader.spec`

**Template files not found:**
Verify templates are in the correct location and included in the spec file

## File Locations

### When Installed

- **Application**: `C:\Program Files\Papilio Loader\PapilioLoader.exe`
- **User Data**: `%LOCALAPPDATA%\papilio-loader-mcp\`
  - Database: `saved_files.db`
  - Saved Files: `saved_files\`
  - Logs: Application logs

### When Running from Source

- **User Data**: Current working directory
- **Database**: `./saved_files.db`
- **Saved Files**: `./saved_files/`

## Uninstallation

### Installed Version

1. Go to Windows Settings → Apps → Installed Apps
2. Find "Papilio Loader"
3. Click "Uninstall"

Or use the uninstaller:
- Start Menu → Papilio Loader → Uninstall

**Note**: User data in `%LOCALAPPDATA%\papilio-loader-mcp\` is preserved by default. Manually delete this folder if you want to completely remove all data.

### Portable/Python Version

Simply delete the executable or uninstall the Python package:

```bash
pip uninstall papilio-loader-mcp
```

User data in `%LOCALAPPDATA%\papilio-loader-mcp\` can be manually deleted.

## Security Considerations

⚠️ **Important Security Notes:**

1. **Change Default Credentials**: The default username/password (admin/admin) should be changed in production
2. **Network Access**: By default, the server binds to `0.0.0.0`, allowing network access. Use `127.0.0.1` for local-only access
3. **Firewall**: Consider configuring your firewall to restrict access
4. **HTTPS**: For production use over networks, consider setting up a reverse proxy with HTTPS

## Advanced Configuration

### Custom Startup

Create a batch file or PowerShell script with custom settings:

```batch
@echo off
set PAPILIO_PORT=8080
set PAPILIO_WEB_USERNAME=customuser
set PAPILIO_WEB_PASSWORD=custompass
"C:\Program Files\Papilio Loader\PapilioLoader.exe"
```

### Running as Windows Service

For advanced users who want to run Papilio Loader as a Windows Service, consider using [NSSM (Non-Sucking Service Manager)](https://nssm.cc/).

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/Papilio-Labs/papilio-loader-mcp/issues)
- **Documentation**: See other docs in the `documentation/` folder
- **Community**: Gadget Factory forums and Discord

## License

See the main repository for license information.

## Changelog

### Version 0.1.0
- Initial desktop application release
- System tray integration with pystray
- Windows installer with Inno Setup
- User data directory management for Windows installations
- Auto-start capability
- Single-file executable option
