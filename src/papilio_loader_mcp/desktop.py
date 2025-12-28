"""Desktop application entry point for Papilio Loader.

Runs the combined server with system tray integration.
"""

import asyncio
import logging
import signal
import sys
import threading
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
        self.should_exit = False
        
    def on_exit(self):
        """Callback when user requests exit from tray."""
        logger.info("Exit requested from system tray")
        self.should_exit = True
        
        # Stop the uvicorn server
        if self.server:
            self.server.should_exit = True
    
    def run_server(self):
        """Run the uvicorn server."""
        from start_combined_server import combined_app
        
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
        
        # Start server in a separate thread
        self.server_thread = threading.Thread(target=self.run_server, daemon=True)
        self.server_thread.start()
        
        # Give server a moment to start
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
