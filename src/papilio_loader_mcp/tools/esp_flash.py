"""ESP32 flashing using pesptool (esptool fork)."""

import json
import asyncio
from pathlib import Path


async def flash_esp_device(
    port: str, file_path: str, address: str, verify: bool = True
) -> str:
    """
    Flash an ESP32 device with firmware.
    
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
        # Locate pesptool
        pesptool_path = Path(__file__).parent.parent.parent.parent / "tools" / "pesptool" / "esptool.py"
        
        if not pesptool_path.exists():
            return json.dumps({
                "success": False,
                "error": "pesptool (esptool.py) not found in tools/pesptool directory"
            }, indent=2)
        
        # Build flash command
        cmd = [
            "python",
            str(pesptool_path),
            "--port", port,
            "write_flash",
            address,
            str(file_path_obj)
        ]
        
        if verify:
            cmd.insert(4, "--verify")
        
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
    Flash multiple partitions to ESP32.
    
    Args:
        port: Serial port
        partitions: List of (address, file_path) tuples
        verify: Whether to verify after flashing
    
    Returns:
        JSON string with flashing results
    """
    try:
        pesptool_path = Path(__file__).parent.parent.parent.parent / "tools" / "pesptool" / "esptool.py"
        
        if not pesptool_path.exists():
            return json.dumps({
                "success": False,
                "error": "pesptool (esptool.py) not found"
            }, indent=2)
        
        # Build multi-partition flash command
        cmd = [
            "python",
            str(pesptool_path),
            "--port", port,
            "write_flash"
        ]
        
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
