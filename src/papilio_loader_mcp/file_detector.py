"""Binary file type detection for ESP32 and FPGA files."""

def detect_binary_type(file_content: bytes) -> dict:
    """
    Detect if a binary file is ESP32 firmware or FPGA bitstream.
    
    Args:
        file_content: Binary content of the file
        
    Returns:
        dict with 'type' (esp32/fpga/unknown), 'confidence', and 'reason'
    """
    if len(file_content) < 32:
        return {
            "type": "unknown",
            "confidence": "low",
            "reason": "File too small to identify"
        }
    
    header = file_content[:32]
    
    # ESP32 firmware detection
    # ESP32 images start with magic byte 0xE9
    if header[0] == 0xE9:
        return {
            "type": "esp32",
            "confidence": "high",
            "reason": "ESP32 image magic byte (0xE9) detected at start"
        }
    
    # FPGA bitstream detection (Gowin)
    # Gowin bitstreams typically start with many 0xFF bytes (padding)
    # followed by sync pattern
    ff_count = sum(1 for b in header[:22] if b == 0xFF)
    
    if ff_count >= 20:  # Most of first 22 bytes are 0xFF
        # Check for Gowin sync pattern (0xA5C3 or similar)
        for i in range(len(header) - 1):
            if header[i] == 0xA5 and header[i+1] in [0xC3, 0x5C]:
                return {
                    "type": "fpga",
                    "confidence": "high",
                    "reason": "Gowin FPGA bitstream pattern detected (0xFF padding + sync word)"
                }
        
        # Even without sync word, many 0xFF bytes suggest FPGA
        return {
            "type": "fpga",
            "confidence": "medium",
            "reason": "FPGA bitstream pattern detected (0xFF padding)"
        }
    
    # Unknown type
    return {
        "type": "unknown",
        "confidence": "low",
        "reason": "No recognizable pattern detected"
    }


def validate_file_for_device(file_content: bytes, intended_device: str) -> dict:
    """
    Validate if a binary file matches the intended device type.
    
    Args:
        file_content: Binary content of the file
        intended_device: 'esp32' or 'fpga'
        
    Returns:
        dict with 'valid', 'detected_type', 'warning', 'details'
    """
    detection = detect_binary_type(file_content)
    detected = detection["type"]
    
    if detected == "unknown":
        return {
            "valid": True,  # Allow unknown types (user's choice)
            "detected_type": "unknown",
            "warning": f"⚠️ Could not identify file type. {detection['reason']}",
            "details": detection
        }
    
    if detected == intended_device:
        return {
            "valid": True,
            "detected_type": detected,
            "warning": None,
            "details": detection
        }
    
    # Mismatch detected!
    device_names = {"esp32": "ESP32", "fpga": "FPGA"}
    return {
        "valid": False,
        "detected_type": detected,
        "warning": f"⚠️ WARNING: This appears to be {device_names.get(detected, 'unknown')} firmware, but you're trying to flash it to {device_names.get(intended_device, 'unknown')}!",
        "details": detection
    }
