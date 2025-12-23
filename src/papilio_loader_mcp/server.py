"""MCP server core implementation for device programming."""

import asyncio
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
            description="Get information about a connected device on a specific port",
            inputSchema={
                "type": "object",
                "properties": {
                    "port": {
                        "type": "string",
                        "description": "COM port (e.g., COM3 on Windows, /dev/ttyUSB0 on Linux)",
                    },
                    "device_type": {
                        "type": "string",
                        "enum": ["fpga", "esp32"],
                        "description": "Type of device to query",
                    },
                },
                "required": ["port", "device_type"],
            },
        ),
        Tool(
            name="get_flash_status",
            description="Get flash status and memory information for a device",
            inputSchema={
                "type": "object",
                "properties": {
                    "port": {
                        "type": "string",
                        "description": "COM port",
                    },
                    "device_type": {
                        "type": "string",
                        "enum": ["fpga", "esp32"],
                        "description": "Type of device",
                    },
                },
                "required": ["port", "device_type"],
            },
        ),
        Tool(
            name="flash_device",
            description="Flash a device with firmware. Supports Gowin FPGA .bin files and ESP32 firmware (.bin/.elf)",
            inputSchema={
                "type": "object",
                "properties": {
                    "port": {
                        "type": "string",
                        "description": "COM port",
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
                        "description": "Flash address in hex (e.g., 0x1000). Optional for FPGA, required for ESP32",
                    },
                    "verify": {
                        "type": "boolean",
                        "description": "Verify after flashing (default: true)",
                        "default": True,
                    },
                },
                "required": ["port", "device_type", "file_path"],
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
            port = arguments["port"]
            device_type = arguments["device_type"]
            result = await get_device_info(port, device_type)
            return [TextContent(type="text", text=result)]

        elif name == "get_flash_status":
            port = arguments["port"]
            device_type = arguments["device_type"]
            result = await get_flash_status(port, device_type)
            return [TextContent(type="text", text=result)]

        elif name == "flash_device":
            port = arguments["port"]
            device_type = arguments["device_type"]
            file_path = arguments["file_path"]
            address = arguments.get("address")
            verify = arguments.get("verify", True)

            if device_type == "fpga":
                result = await flash_fpga_device(port, file_path, verify)
            else:  # esp32
                if not address:
                    return [
                        TextContent(
                            type="text",
                            text="Error: address is required for ESP32 flashing",
                        )
                    ]
                result = await flash_esp_device(port, file_path, address, verify)

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
