"""Test the binary file type detector."""

import sys
sys.path.insert(0, 'src')

from papilio_loader_mcp.file_detector import detect_binary_type, validate_file_for_device

def test_file(filepath, device_type):
    """Test file detection."""
    print(f"\n{'='*60}")
    print(f"Testing: {filepath}")
    print(f"Intended device: {device_type.upper()}")
    print('='*60)
    
    with open(filepath, 'rb') as f:
        content = f.read()
    
    # Detect type
    detection = detect_binary_type(content)
    print(f"\nDetection Result:")
    print(f"  Type: {detection['type'].upper()}")
    print(f"  Confidence: {detection['confidence']}")
    print(f"  Reason: {detection['reason']}")
    
    # Validate for device
    validation = validate_file_for_device(content, device_type)
    print(f"\nValidation for {device_type.upper()}:")
    print(f"  Valid: {'✓ YES' if validation['valid'] else '✗ NO'}")
    print(f"  Detected: {validation['detected_type'].upper()}")
    if validation['warning']:
        print(f"  Warning: {validation['warning']}")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("BINARY FILE TYPE DETECTOR TEST")
    print("="*60)
    
    # Test ESP32 firmware on ESP32 device (should pass)
    test_file("debugging/firmware.bin", "esp32")
    
    # Test FPGA bitstream on FPGA device (should pass)
    test_file("debugging/papilio_arcade_template.bin", "fpga")
    
    # Test ESP32 firmware on FPGA device (should warn)
    test_file("debugging/firmware.bin", "fpga")
    
    # Test FPGA bitstream on ESP32 device (should warn)
    test_file("debugging/papilio_arcade_template.bin", "esp32")
    
    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60 + "\n")
