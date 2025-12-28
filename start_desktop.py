"""Desktop launcher script for Papilio Loader.

This script starts the combined server with system tray integration.
Can be used directly with Python or bundled with PyInstaller.

Command-line options:
    --console    Show console window for debugging (Windows only)
"""

import sys
from papilio_loader_mcp.desktop import main

if __name__ == '__main__':
    # Check for --console flag
    show_console = '--console' in sys.argv
    
    # On Windows, show/hide console window based on flag
    if sys.platform == 'win32' and not show_console:
        try:
            import ctypes
            # Hide console window if not requested
            if getattr(sys, 'frozen', False):
                # Only hide in frozen executable
                kernel32 = ctypes.windll.kernel32
                user32 = ctypes.windll.user32
                hwnd = kernel32.GetConsoleWindow()
                if hwnd:
                    user32.ShowWindow(hwnd, 0)  # SW_HIDE = 0
        except Exception:
            pass  # Silently fail if console manipulation doesn't work
    
    main()
