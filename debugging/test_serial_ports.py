"""
Test serial port detection and show help for COM4 connection
"""
import serial.tools.list_ports

print("=" * 70)
print("Serial Port Detection Test")
print("=" * 70)

# List all COM ports
ports = list(serial.tools.list_ports.comports())

if ports:
    print(f"\n✓ Found {len(ports)} serial port(s):")
    for i, port in enumerate(ports, 1):
        print(f"\n{i}. {port.device}")
        print(f"   Description: {port.description}")
        print(f"   Manufacturer: {port.manufacturer}")
        print(f"   VID:PID: {port.vid:04X}:{port.pid:04X}" if port.vid else "   VID:PID: N/A")
        print(f"   Serial Number: {port.serial_number}")
else:
    print("\n✗ No serial ports detected by pyserial")
    print("\nTroubleshooting:")
    print("1. Ensure the Papilio board is physically connected via USB")
    print("2. Check Device Manager (devmgmt.msc) for COM ports under 'Ports (COM & LPT)'")
    print("3. Install the appropriate USB driver if needed:")
    print("   - FTDI VCP driver for older Papilio boards")
    print("   - CH340/CH341 driver for some ESP32 boards")
    print("4. Try a different USB cable (some cables are power-only)")
    print("5. Try a different USB port")

print("\n" + "=" * 70)
print("Expected Configuration:")
print("=" * 70)
print("User mentioned: COM4 should have a Papilio board connected")
print("If COM4 appears above, the board is properly connected.")
print("If COM4 doesn't appear, reconnect the board and check drivers.")
print("=" * 70)
