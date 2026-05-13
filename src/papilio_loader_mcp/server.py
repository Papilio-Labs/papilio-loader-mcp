"""MCP server core implementation for device programming."""

import logging
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .tools.serial_ports import list_serial_ports
from .tools.device_info import get_device_info
from .tools.flash_status import get_flash_status
from .tools.fpga_flash import flash_fpga_device
from .tools.esp_flash import flash_esp_device
from .tools.network_discovery import discover_ota_devices, check_device_ip
from .tools.ota_flash import flash_device_ota
from .file_detector import validate_file_for_device

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize MCP server
app = Server("papilio-loader-mcp")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List all available tools."""
    return [
        Tool(
            name="list_serial_ports",
            description="List all available serial/COM ports on the system",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="get_device_info",
            description="Get information about a connected device. Port will be auto-detected if not provided.",
            inputSchema={
                "type": "object",
                "properties": {
                    "port": {
                        "type": "string",
                        "description": "COM port (e.g., COM3 on Windows, /dev/ttyUSB0 on Linux). If not provided, will auto-detect.",
                    },
                    "device_type": {
                        "type": "string",
                        "enum": ["fpga", "esp32"],
                        "description": "Type of device to query",
                    },
                },
                "required": ["device_type"],
            },
        ),
        Tool(
            name="get_flash_status",
            description="Get flash status and memory information for a device. Port will be auto-detected if not provided.",
            inputSchema={
                "type": "object",
                "properties": {
                    "port": {
                        "type": "string",
                        "description": "COM port. If not provided, will auto-detect.",
                    },
                    "device_type": {
                        "type": "string",
                        "enum": ["fpga", "esp32"],
                        "description": "Type of device",
                    },
                },
                "required": ["device_type"],
            },
        ),
        Tool(
            name="flash_device",
            description="Flash a device with firmware. Supports Gowin FPGA .bin files and ESP32 firmware (.bin/.elf). Port will be auto-detected if not provided.",
            inputSchema={
                "type": "object",
                "properties": {
                    "port": {
                        "type": "string",
                        "description": "COM port. If not provided, will auto-detect.",
                    },
                    "device_type": {
                        "type": "string",
                        "enum": ["fpga", "esp32"],
                        "description": "Type of device to flash",
                    },
                    "file_path": {
                        "type": "string",
                        "description": "Path to firmware file (bit, bin, or elf)",
                    },
                    "address": {
                        "type": "string",
                        "description": "Flash address in hex (e.g., 0x1000). If not provided, defaults to 0x10000 for ESP32 and 0x100000 for FPGA",
                    },
                    "verify": {
                        "type": "boolean",
                        "description": "Verify after flashing (default: true)",
                        "default": True,
                    },
                    "force": {
                        "type": "boolean",
                        "description": "Force flashing even if file type validation fails (default: false)",
                        "default": False,
                    },
                },
                "required": ["device_type", "file_path"],
            },
        ),
        Tool(
            name="discover_ota_devices",
            description="Discover OTA-capable devices on the local network by scanning for HTTP endpoints on port 3232",
            inputSchema={
                "type": "object",
                "properties": {
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds for each device check (default: 2)",
                        "default": 2,
                    },
                    "port": {
                        "type": "integer",
                        "description": "OTA server port to scan (default: 3232)",
                        "default": 3232,
                    },
                },
            },
        ),
        Tool(
            name="check_device_ip",
            description="Check if a specific IP address has an OTA endpoint available",
            inputSchema={
                "type": "object",
                "properties": {
                    "ip": {
                        "type": "string",
                        "description": "IP address to check (e.g., 10.0.4.35)",
                    },
                    "port": {
                        "type": "integer",
                        "description": "OTA server port (default: 3232)",
                        "default": 3232,
                    },
                },
                "required": ["ip"],
            },
        ),
        Tool(
            name="flash_device_ota",
            description="Flash a device via OTA (Over-The-Air) using WiFi/network instead of USB. Requires device IP address.",
            inputSchema={
                "type": "object",
                "properties": {
                    "ip": {
                        "type": "string",
                        "description": "Device IP address (e.g., 10.0.4.35)",
                    },
                    "device_type": {
                        "type": "string",
                        "enum": ["fpga", "esp32"],
                        "description": "Type of device to flash",
                    },
                    "file_path": {
                        "type": "string",
                        "description": "Path to firmware file (bin or elf for ESP32, bin for FPGA)",
                    },
                    "port": {
                        "type": "integer",
                        "description": "OTA server port (default: 3232)",
                        "default": 3232,
                    },
                },
                "required": ["ip", "device_type", "file_path"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls."""
    try:
        if name == "list_serial_ports":
            result = await list_serial_ports()
            return [TextContent(type="text", text=result)]

        elif name == "get_device_info":
            port = arguments.get("port", "AUTO")
            device_type = arguments["device_type"]
            result = await get_device_info(port, device_type)
            return [TextContent(type="text", text=result)]

        elif name == "get_flash_status":
            port = arguments.get("port", "AUTO")
            device_type = arguments["device_type"]
            result = await get_flash_status(port, device_type)
            return [TextContent(type="text", text=result)]

        elif name == "flash_device":
            port = arguments.get("port", "AUTO")
            device_type = arguments["device_type"]
            file_path = arguments["file_path"]
            # Set default address based on device type
            default_address = "0x10000" if device_type == "esp32" else "0x100000"
            address = arguments.get("address", default_address)
            verify = arguments.get("verify", True)
            force = arguments.get("force", False)

            # Validate file type before flashing
            try:
                with open(file_path, 'rb') as f:
                    file_content = f.read()
                
                validation = validate_file_for_device(file_content, device_type)
                
                if not validation["valid"]:
                    if not force:
                        error_msg = f"❌ File type mismatch!\n\n{validation['warning']}\n\nDetected: {validation['detected_type']}\nIntended: {device_type}\n\nThis could brick your device. Please use the correct firmware file.\n\nTo override this check, set force=true."
                        return [TextContent(type="text", text=error_msg)]
                    else:
                        logger.warning(f"⚠️ FORCED FLASH: {validation['warning']} - User overrode validation")
                
                if validation["warning"] and validation["valid"]:
                    logger.warning(f"File validation warning: {validation['warning']}")
            
            except FileNotFoundError:
                return [TextContent(type="text", text=f"Error: File not found: {file_path}")]
            except Exception as e:
                return [TextContent(type="text", text=f"Error validating file: {str(e)}")]

            if device_type == "fpga":
                result = await flash_fpga_device(port, file_path, address, verify)
            else:  # esp32
                result = await flash_esp_device(port, file_path, address, verify)

            return [TextContent(type="text", text=result)]

        elif name == "discover_ota_devices":
            timeout = arguments.get("timeout", 2)
            port = arguments.get("port", 3232)
            result = await discover_ota_devices(timeout, port)
            return [TextContent(type="text", text=result)]

        elif name == "check_device_ip":
            ip = arguments["ip"]
            port = arguments.get("port", 3232)
            result = await check_device_ip(ip, port)
            return [TextContent(type="text", text=result)]

        elif name == "flash_device_ota":
            ip = arguments["ip"]
            device_type = arguments["device_type"]
            file_path = arguments["file_path"]
            port = arguments.get("port", 3232)
            
            # Validate file type before flashing
            try:
                with open(file_path, 'rb') as f:
                    file_content = f.read()
                
                validation = validate_file_for_device(file_content, device_type)
                
                if not validation["valid"]:
                    error_msg = f"❌ File type mismatch!\n\n{validation['warning']}\n\nDetected: {validation['detected_type']}\nIntended: {device_type}\n\nThis could brick your device. Please use the correct firmware file."
                    return [TextContent(type="text", text=error_msg)]
                
                if validation["warning"] and validation["valid"]:
                    logger.warning(f"File validation warning: {validation['warning']}")
            
            except FileNotFoundError:
                return [TextContent(type="text", text=f"Error: File not found: {file_path}")]
            except Exception as e:
                return [TextContent(type="text", text=f"Error validating file: {str(e)}")]
            
            result = await flash_device_ota(ip, device_type, file_path, port)
            return [TextContent(type="text", text=result)]

        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except Exception as e:
        logger.error(f"Error calling tool {name}: {e}", exc_info=True)
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def main():
    """Run the MCP server."""
    logger.info("Starting Papilio Loader MCP Server...")
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
