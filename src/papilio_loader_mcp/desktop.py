"""Desktop application entry point for Papilio Loader.

Runs the combined server with system tray integration.
"""

import asyncio
import logging
import signal
import sys
import threading
import subprocess
from pathlib import Path

import uvicorn

from .config import get_config
from .tray import SystemTrayApp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DesktopApp:
    """Desktop application coordinator."""
    
    def __init__(self):
        self.config = get_config()
        self.tray_app = None
        self.server = None
        self.server_thread = None
        self.server_process = None  # For subprocess approach in GUI mode
        self.should_exit = False
        
    def on_exit(self):
        """Callback when user requests exit from tray."""
        logger.info("Exit requested from system tray")
        self.should_exit = True
        
        # Stop the uvicorn server
        if self.server:
            self.server.should_exit = True
        
        # Stop subprocess if running
        if self.server_process:
            logger.info("Terminating server subprocess...")
            self.server_process.terminate()
            try:
                self.server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.server_process.kill()
    
    def run_server(self):
        """Run the uvicorn server."""
        # Import combined app from the module
        import sys
        from pathlib import Path
        
        # Add project root to path if needed
        if getattr(sys, 'frozen', False):
            # Running as compiled executable
            base_path = Path(sys.executable).parent
        else:
            # Running from source
            base_path = Path(__file__).parent.parent.parent
        
        # Import the combined app
        sys.path.insert(0, str(base_path))
        
        try:
            from start_combined_server import combined_app
        except ImportError:
            # If that fails, create the combined app here
            logger.info("Creating combined app inline")
            from starlette.applications import Starlette
            from starlette.routing import Route, Mount
            from starlette.requests import Request
            from starlette.responses import Response
            from mcp.server.sse import SseServerTransport
            
            from .server import app as mcp_app
            from .api import api
            
            # Create SSE transport for MCP
            sse = SseServerTransport("/messages/")
            
            async def handle_sse(request: Request):
                """Handle MCP SSE connections."""
                async with sse.connect_sse(
                    request.scope,
                    request.receive,
                    request._send,
                ) as (read_stream, write_stream):
                    await mcp_app.run(
                        read_stream,
                        write_stream,
                        mcp_app.create_initialization_options(),
                    )
            
            # Create combined app
            combined_app = Starlette(
                debug=False,
                routes=[
                    # MCP endpoints
                    Route("/sse", endpoint=handle_sse),
                    Mount("/", app=api),
                ],
            )
        
        # Create server config
        config = uvicorn.Config(
            combined_app,
            host=self.config.bind_address,
            port=self.config.port,
            log_level="info",
            access_log=True,
        )
        
        self.server = uvicorn.Server(config)
        
        logger.info(f"Starting server on {self.config.bind_address}:{self.config.port}")
        
        # Run server
        try:
            self.server.run()
        except Exception as e:
            logger.error(f"Server error: {e}")
    
    def run(self):
        """Run the desktop application."""
        logger.info("Starting Papilio Loader Desktop Application")
        logger.info(f"User data directory: {self.config.user_data_dir}")
        
        # WORKAROUND: In Windows GUI mode (frozen, no console), uvicorn.Config() hangs
        # due to asyncio event loop issues. Solution: Launch console version as hidden subprocess
        if getattr(sys, 'frozen', False) and sys.platform == 'win32':
            # Check if this is the GUI version (look for console version)
            console_exe = Path(sys.executable).parent / "PapilioLoader-Console.exe"
            if console_exe.exists() and not sys.executable.endswith('Console.exe'):
                logger.info(f"GUI mode detected, launching console version as hidden subprocess")
                logger.info(f"Console executable: {console_exe}")
                
                # Create hidden console window
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = 0  # SW_HIDE
                
                self.server_process = subprocess.Popen(
                    [str(console_exe)],
                    startupinfo=startupinfo,
                    creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
                )
                logger.info(f"Server subprocess started with PID: {self.server_process.pid}")
                
                # Give server time to start
                import time
                time.sleep(3)
            else:
                # Console version - use normal threading
                self.server_thread = threading.Thread(target=self.run_server, daemon=True)
                self.server_thread.start()
                logger.info("Server thread started (console mode)")
                import time
                time.sleep(2)
        else:
            # Not frozen or not Windows - use normal threading
            self.server_thread = threading.Thread(target=self.run_server, daemon=True)
            self.server_thread.start()
            logger.info("Server thread started")
            import time
            time.sleep(2)
        
        # Create and run system tray (blocks until exit)
        self.tray_app = SystemTrayApp(
            port=self.config.port,
            on_exit_callback=self.on_exit
        )
        
        # Show startup notification
        logger.info("System tray icon starting...")
        
        # This will block until the user exits from the tray menu
        try:
            self.tray_app.run()
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received")
        except Exception as e:
            logger.error(f"System tray failed: {e}", exc_info=True)
            print(f"ERROR: System tray failed: {e}")
            print("Server is still running at http://localhost:8000")
            print("Press Ctrl+C to stop the server")
            # Keep the application running even if tray fails
            try:
                while not self.should_exit:
                    import time
                    time.sleep(1)
            except KeyboardInterrupt:
                logger.info("Keyboard interrupt received")
        
        logger.info("Shutting down...")
        
        # Cleanup
        if self.server:
            self.server.should_exit = True
        
        # Wait for server thread to finish
        if self.server_thread and self.server_thread.is_alive():
            logger.info("Waiting for server to shut down...")
            self.server_thread.join(timeout=5)
        
        logger.info("Application shutdown complete")


def main():
    """Main entry point for desktop application."""
    app = DesktopApp()
    
    # Handle signals gracefully
    def signal_handler(sig, frame):
        logger.info(f"Received signal {sig}")
        app.on_exit()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        app.run()
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
