"""Analyze binary file types to distinguish ESP32 firmware from FPGA bitstreams."""

def analyze_file(filepath, name):
    """Read and display the first bytes of a binary file."""
    try:
        with open(filepath, 'rb') as f:
            header = f.read(32)
            
        print(f"\n{name}:")
        print(f"File size: {len(open(filepath, 'rb').read())} bytes")
        print("First 32 bytes (hex):")
        print(' '.join(f'{b:02X}' for b in header))
        print("\nFirst 32 bytes (printable ASCII):")
        print(''.join(chr(b) if 32 <= b < 127 else '.' for b in header))
        
        # Check for ESP32 magic bytes
        if header[0] == 0xE9:
            print("✓ Detected ESP32 image magic byte (0xE9)")
        
        # Check for common FPGA patterns
        # Gowin bitstreams often have specific patterns
        
    except Exception as e:
        print(f"Error reading {name}: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("Binary File Type Analysis")
    print("=" * 60)
    
    analyze_file("debugging/firmware.bin", "ESP32 Firmware (firmware.bin)")
    analyze_file("debugging/papilio_arcade_template.bin", "FPGA Bitstream (papilio_arcade_template.bin)")
    
    print("\n" + "=" * 60)
