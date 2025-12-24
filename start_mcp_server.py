"""Standalone MCP server startup script."""

import sys
from pathlib import Path

# Add src to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

from papilio_loader_mcp.http_server import run_server

if __name__ == "__main__":
    print("=" * 60)
    print("Papilio Loader MCP Server")
    print("=" * 60)
    print()
    print("Starting HTTP server on http://127.0.0.1:8765")
    print("SSE endpoint: http://127.0.0.1:8765/sse")
    print()
    print("Configure VS Code .vscode/mcp.json with:")
    print('{')
    print('  "servers": {')
    print('    "papilio-loader": {')
    print('      "type": "sse",')
    print('      "url": "http://127.0.0.1:8765/sse"')
    print('    }')
    print('  }')
    print('}')
    print()
    print("Press Ctrl+C to stop")
    print("=" * 60)
    print()
    
    run_server()
