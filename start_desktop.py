"""Desktop launcher script for Papilio Loader.

This script starts the combined server with system tray integration.
Can be used directly with Python or bundled with PyInstaller.
"""

from papilio_loader_mcp.desktop import main

if __name__ == '__main__':
    main()
