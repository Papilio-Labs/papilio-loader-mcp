"""ESP32 flashing using official esptool (safe and stable)."""

import json
import asyncio
from pathlib import Path

# esptool is used as a subprocess module, not imported directly
# This ensures we use the command-line interface


async def flash_esp_device(
    port: str, file_path: str, address: str, verify: bool = True
) -> str:
    """
    Flash an ESP32 device with firmware using official esptool.
    
    Args:
        port: Serial port
        file_path: Path to firmware file (.bin or .elf)
        address: Flash address in hex (e.g., "0x1000")
        verify: Whether to verify after flashing
    
    Returns:
        JSON string with flashing results
    """
    file_path_obj = Path(file_path)
    
    # Validate file exists
    if not file_path_obj.exists():
        return json.dumps({
            "success": False,
            "error": f"File not found: {file_path}"
        }, indent=2)
    
    # Check file extension
    if file_path_obj.suffix.lower() not in ['.bin', '.elf']:
        return json.dumps({
            "success": False,
            "error": f"Invalid file type: {file_path_obj.suffix}. Expected .bin or .elf"
        }, indent=2)
    
    try:
        # Build flash command for ESP32 (using esptool as subprocess module)
        # Note: esptool doesn't support --verify flag, verification happens automatically
        cmd = [
            "python",
            "-m", "esptool",
        ]
        
        # Add port parameter only if not AUTO (for auto-detection)
        if port and port.upper() != "AUTO":
            cmd.extend(["--port", port])
        
        cmd.extend([
            "write-flash",
            address,
            str(file_path_obj)
        ])
        
        # Execute flashing
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await proc.communicate()
        
        output = stdout.decode() + stderr.decode()
        
        return json.dumps({
            "success": proc.returncode == 0,
            "device_type": "esp32",
            "port": port if port.upper() != "AUTO" else "auto-detected",
            "file": str(file_path_obj),
            "address": address,
            "verified": verify,
            "output": output
        }, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2)


async def flash_esp_multi_partition(
    port: str, partitions: list[tuple[str, str]], verify: bool = True
) -> str:
    """
    Flash multiple partitions to ESP32 using official esptool.
    
    Args:
        port: Serial port (or "AUTO" for auto-detection)
        partitions: List of (address, file_path) tuples
        verify: Whether to verify after flashing
    
    Returns:
        JSON string with flashing results
    """
    try:
        # Build multi-partition flash command (using esptool as subprocess module)
        cmd = [
            "python",
            "-m", "esptool",
        ]
        
        # Add port parameter only if not AUTO (for auto-detection)
        if port and port.upper() != "AUTO":
            cmd.extend(["--port", port])
        
        cmd.append("write-flash")  # Use non-deprecated command name
        
        if verify:
            cmd.append("--verify")
        
        # Add all partitions
        for address, file_path in partitions:
            cmd.extend([address, file_path])
        
        # Execute flashing
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await proc.communicate()
        
        output = stdout.decode() + stderr.decode()
        
        return json.dumps({
            "success": proc.returncode == 0,
            "device_type": "esp32",
            "port": port,
            "partitions": [{"address": addr, "file": fp} for addr, fp in partitions],
            "verified": verify,
            "output": output
        }, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2)
