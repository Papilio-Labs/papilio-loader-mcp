"""
Test script for Papilio board on COM4
"""
import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from papilio_loader_mcp.tools.serial_ports import list_serial_ports
from papilio_loader_mcp.tools.device_info import get_device_info

async def main():
    print("=" * 60)
    print("Papilio Board Test - COM4")
    print("=" * 60)
    
    # List all serial ports
    print("\n1. Listing all serial ports...")
    ports_result = await list_serial_ports()
    print(ports_result)
    
    # Get device info from COM4 - test both FPGA and ESP32
    print("\n2. Getting FPGA device info from COM4...")
    fpga_info = await get_device_info("COM4", "fpga")
    print(fpga_info)
    
    print("\n3. Getting ESP32 device info from COM4...")
    esp32_info = await get_device_info("COM4", "esp32")
    print(esp32_info)
    
    print("\n" + "=" * 60)
    print("Test complete")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
