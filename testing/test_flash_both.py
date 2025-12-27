"""
Test flashing FPGA bitstream and ESP32 firmware to Papilio board
"""
import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from papilio_loader_mcp.tools.fpga_flash import flash_fpga_device
from papilio_loader_mcp.tools.esp_flash import flash_esp_device

# File paths - using local copies in debugging directory
FPGA_BIN = Path(__file__).parent / "papilio_arcade_template.bin"
ESP32_BIN = Path(__file__).parent / "firmware.bin"

async def main():
    print("=" * 70)
    print("Papilio Board Flash Test - COM4")
    print("=" * 70)
    
    # Check if files exist
    if not FPGA_BIN.exists():
        print(f"\n✗ FPGA bitstream not found: {FPGA_BIN}")
    else:
        print(f"\n✓ FPGA bitstream found: {FPGA_BIN.name}")
        print(f"  Size: {FPGA_BIN.stat().st_size:,} bytes")
    
    if not ESP32_BIN.exists():
        print(f"\n✗ ESP32 firmware not found: {ESP32_BIN}")
        print("  Build the firmware first with: python -m platformio run -e papilio_arcade")
    else:
        print(f"\n✓ ESP32 firmware found: {ESP32_BIN.name}")
        print(f"  Size: {ESP32_BIN.stat().st_size:,} bytes")
    
    print("\n" + "=" * 70)
    
    # Flash FPGA if file exists
    if FPGA_BIN.exists():
        print("\n1. Flashing FPGA bitstream to COM4...")
        print("-" * 70)
        result = await flash_fpga_device("COM4", str(FPGA_BIN), verify=False)
        print(result)
    
    # Flash ESP32 if file exists  
    if ESP32_BIN.exists():
        print("\n2. Flashing ESP32 firmware to COM4...")
        print("-" * 70)
        result = await flash_esp_device("COM4", str(ESP32_BIN), address="0x10000", verify=False)
        print(result)
    
    print("\n" + "=" * 70)
    print("Flash test complete")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
