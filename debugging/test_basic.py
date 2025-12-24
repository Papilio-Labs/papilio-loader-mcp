"""Test script for basic functionality."""
import asyncio
from papilio_loader_mcp.tools.serial_ports import list_serial_ports

async def main():
    print("Testing serial port listing...")
    result = await list_serial_ports()
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
