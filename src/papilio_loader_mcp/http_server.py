"""MCP server with HTTP/SSE transport for network access.

Based on working examples from:
- theailanguage/terminal_server
- microsoft/semantic-kernel

The server exposes two endpoints:
- /sse: For initiating SSE connections (GET)
- /messages/: For POST-based message communication
"""

import asyncio
import logging
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.requests import Request
import uvicorn

from .server import app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create SSE transport - the trailing slash is important!
sse = SseServerTransport("/messages/")


async def handle_sse(request: Request):
    """
    Handle new SSE connections.
    This connects the SSE streams to the MCP server.
    """
    # Use connect_sse to establish the SSE connection and get read/write streams
    async with sse.connect_sse(
        request.scope,
        request.receive,
        request._send,  # Low-level send function provided by Starlette
    ) as (read_stream, write_stream):
        # Run the MCP server with these streams
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options(),
        )


# Create Starlette app with SSE and message endpoints
starlette_app = Starlette(
    debug=True,
    routes=[
        Route("/sse", endpoint=handle_sse),          # For initiating SSE connection
        Mount("/messages/", app=sse.handle_post_message),  # For POST-based communication
    ],
)


def run_server(host: str = "127.0.0.1", port: int = 8765):
    """Run the HTTP MCP server."""
    logger.info(f"Starting Papilio Loader MCP Server on http://{host}:{port}")
    logger.info(f"SSE endpoint: http://{host}:{port}/sse")
    uvicorn.run(starlette_app, host=host, port=port)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Papilio Loader MCP HTTP Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8765, help="Port to bind to")
    args = parser.parse_args()
    
    run_server(args.host, args.port)
