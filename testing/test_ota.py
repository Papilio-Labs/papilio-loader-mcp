"""Test OTA discovery and flashing capabilities."""

import asyncio
import sys
from pathlib import Path

# Add src to path for local development
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from papilio_loader_mcp.tools.network_discovery import (
    discover_ota_devices,
    check_device_ip
)
from papilio_loader_mcp.tools.ota_flash import flash_device_ota


async def test_discovery():
    """Test network discovery of OTA devices."""
    print("=" * 60)
    print("Testing OTA Device Discovery")
    print("=" * 60)
    
    print("\n1. Discovering OTA devices on network...")
    result = await discover_ota_devices(timeout=1, port=3232)
    print(result)
    
    print("\n2. Checking specific IP address...")
    # Replace with your device IP
    test_ip = "10.0.4.35"
    result = await check_device_ip(test_ip, port=3232)
    print(result)


async def test_flash():
    """Test OTA flashing (requires valid firmware file and device IP)."""
    print("\n" + "=" * 60)
    print("Testing OTA Flash (DEMO - no actual flash)")
    print("=" * 60)
    
    # These are example paths - replace with actual files
    device_ip = "10.0.4.35"
    esp32_firmware = "build/fpga_companion.bin"
    fpga_bitstream = "impl/pnr/a2600nano_retrocade.bin"
    
    print(f"\nWould flash to device at: {device_ip}")
    print(f"ESP32 firmware: {esp32_firmware}")
    print(f"FPGA bitstream: {fpga_bitstream}")
    print("\nTo actually flash, uncomment the flash calls below.")
    
    # Uncomment to actually flash:
    # print("\nFlashing ESP32 firmware...")
    # result = await flash_device_ota(device_ip, "esp32", esp32_firmware, 3232)
    # print(result)
    
    # print("\nFlashing FPGA bitstream...")
    # result = await flash_device_ota(device_ip, "fpga", fpga_bitstream, 3232)
    # print(result)


async def main():
    """Run all tests."""
    try:
        await test_discovery()
        await test_flash()
        
        print("\n" + "=" * 60)
        print("✅ Tests completed")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
