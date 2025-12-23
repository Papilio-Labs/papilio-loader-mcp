"""Start the Papilio Loader API server."""
import uvicorn
from papilio_loader_mcp.api import api
from papilio_loader_mcp.config import get_config

if __name__ == "__main__":
    config = get_config()
    print(f"Starting Papilio Loader API server on {config.bind_address}:{config.port}")
    print(f"API Key Authentication: {'Enabled' if config.api_key else 'Disabled'}")
    print(f"CORS Origins: {config.cors_origins}")
    print(f"\nAccess the API at: http://{config.bind_address}:{config.port}")
    print(f"API Documentation: http://{config.bind_address}:{config.port}/docs")
    print(f"Health Check: http://{config.bind_address}:{config.port}/health\n")
    
    uvicorn.run(
        api,
        host=config.bind_address,
        port=config.port,
        log_level="info"
    )
