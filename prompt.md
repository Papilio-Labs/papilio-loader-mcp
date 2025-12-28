# Plan: Package Papilio-Loader as Desktop App

Package the FPGA/ESP32 flashing tool as an installable Python application with system tray integration and auto-start capability, avoiding Electron overhead since you already have a web interface. Use PyInstaller for single-file Windows distribution with optional pip/uv installation for developers.

## Steps

1. **Create PyInstaller configuration** to bundle start_combined_server.py, templates/, pesptool submodule, and all dependencies into a single Windows executable with hidden console
2. **Add system tray integration** using `pystray` library to show app status icon with menu options (Open Web Interface, Stop Server, Exit) that launches browser to http://localhost:8000
3. **Create Windows installer** with Inno Setup that installs executable to Program Files, creates Start Menu shortcut, offers "Run at startup" checkbox, and optionally registers as Windows service
4. **Publish pip/uv package** to PyPI with entry point `papilio-loader` that runs combined server and includes package data (templates, pesptool directory) via MANIFEST.in or pyproject.toml
5. **Add configuration GUI** (optional) for first-run setup wizard to set port, credentials, and startup options before launching server

## Further Considerations

1. **Desktop UI framework**: System tray (pystray) vs full GUI (tkinter/PyQt)? System tray is lighter and preserves your existing web interface investment
2. **Auto-update mechanism**: Include update checker or rely on pip/winget? Could add GitHub releases API check on startup
3. **Multiple installation methods**: PyInstaller .exe (non-technical users), pip install (developers), or portable ZIP (no install)? All three could coexist
