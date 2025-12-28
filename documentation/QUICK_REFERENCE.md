# Quick Reference: Desktop Application Commands

## Installation

```bash
# Install with desktop dependencies
pip install -e .[desktop]

# Or using uv
uv pip install -e .[desktop]
```

## Running (Development)

```bash
# Run desktop app (Python)
papilio-loader-desktop

# Or directly
python start_desktop.py
```

## Building

```powershell
# Full build (executable + installer)
.\build.ps1

# Executable only
.\build.ps1 -NoInstaller

# Installer only (from existing build)
.\build.ps1 -InstallerOnly

# Help
.\build.ps1 -Help
```

```bash
# Cross-platform (Python)
python build.py
python build.py --no-installer
python build.py --installer-only
```

## Manual Build

```bash
# Build with PyInstaller
pyinstaller papilio_loader.spec --clean

# Executable location
dist/PapilioLoader.exe
```

## Output Locations

- **Executable**: `dist/PapilioLoader.exe`
- **Installer**: `installer_output/PapilioLoader-Setup-x.x.x.exe`
- **User Data** (when installed): `%LOCALAPPDATA%\papilio-loader-mcp\`

## Testing

```powershell
# Test executable
.\dist\PapilioLoader.exe

# Should start system tray icon
# Right-click → Open Web Interface → Opens browser
```

## Environment Variables

```powershell
# Custom port
$env:PAPILIO_PORT = "8080"

# Custom credentials
$env:PAPILIO_WEB_USERNAME = "myuser"
$env:PAPILIO_WEB_PASSWORD = "mypass"

# Run with custom settings
papilio-loader-desktop
```

## Cleanup

```bash
# Remove build artifacts
rm -r build, dist, installer_output
```

## Documentation

- [DESKTOP_APP.md](DESKTOP_APP.md) - User guide
- [BUILD.md](BUILD.md) - Detailed build instructions
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Technical details
