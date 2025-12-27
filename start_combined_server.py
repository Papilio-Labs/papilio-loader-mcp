"""Combined server that runs both MCP (SSE) and Web Interface together.

This allows:
1. MCP clients to connect via SSE at /sse and /messages/
2. Web users to access the UI at / (redirects to /web/login)
3. API endpoints at /ports, /device/info, etc.
"""

import asyncio
import logging
from pathlib import Path

from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.requests import Request
from starlette.responses import Response
from mcp.server.sse import SseServerTransport
import uvicorn

from papilio_loader_mcp.server import app as mcp_app
from papilio_loader_mcp.api import api
from papilio_loader_mcp.config import get_config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


# Mount both FastAPI (for web + API) and MCP SSE endpoints
combined_app = Starlette(
    debug=True,
    routes=[
        # MCP endpoints
        Route("/sse", endpoint=handle_sse),
        Mount("/messages/", app=sse.handle_post_message),
        
        # Mount the entire FastAPI app for web interface and API
        Mount("/", app=api),
    ],
)


def run_combined_server(host: str = "0.0.0.0", port: int = 8000):
    """Run the combined MCP + Web server."""
    config = get_config()
    
    # Display localhost for user-friendly URLs when binding to all interfaces
    display_host = "localhost" if host == "0.0.0.0" else host
    
    logger.info("=" * 70)
    logger.info("🚀 Starting Papilio Loader Combined Server")
    logger.info("=" * 70)
    logger.info(f"Server running on: http://{display_host}:{port}")
    logger.info("")
    logger.info("📱 Web Interface:")
    logger.info(f"   Login: http://{display_host}:{port}/web/login")
    logger.info(f"   Username: {config.web_username}")
    logger.info(f"   Password: {config.web_password}")
    logger.info("")
    logger.info("🔌 MCP Interface (for AI assistants):")
    logger.info(f"   SSE endpoint: http://{display_host}:{port}/sse")
    logger.info("")
    logger.info("🔧 REST API:")
    logger.info(f"   Documentation: http://{display_host}:{port}/docs")
    logger.info(f"   Health Check: http://{display_host}:{port}/health")
    logger.info(f"   API Key: {'Enabled' if config.api_key else 'Disabled'}")
    logger.info("=" * 70)
    
    uvicorn.run(combined_app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Papilio Loader Combined Server (MCP + Web Interface)"
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0 for all interfaces)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to (default: 8000)"
    )
    
    args = parser.parse_args()
    run_combined_server(args.host, args.port)
