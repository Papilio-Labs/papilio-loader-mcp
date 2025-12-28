"""Get device information."""

import sys
import json
import asyncio
from pathlib import Path


async def get_device_info(port: str, device_type: str) -> str:
    """
    Get information about a connected device.
    
    Args:
        port: Serial port (e.g., COM3, /dev/ttyUSB0)
        device_type: Type of device ("fpga" or "esp32")
    
    Returns:
        JSON string with device information
    """
    if device_type == "fpga":
        return await _get_fpga_info(port)
    elif device_type == "esp32":
        return await _get_esp32_info(port)
    else:
        return json.dumps({"error": f"Unknown device type: {device_type}"})


async def _get_fpga_info(port: str) -> str:
    """Get Papilio FPGA device information using pesptool."""
    try:
        from ..config import get_pesptool_path
        pesptool_path = get_pesptool_path()
        
        # Build command
        cmd = [
            "python",
            str(pesptool_path),
        ]
        
        # Add port parameter only if not AUTO (for auto-detection)
        if port and port.upper() != "AUTO":
            cmd.extend(["--port", port])
        
        cmd.append("flash_id")
        
        # Use flash_id to detect device
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await proc.communicate()
        
        if proc.returncode == 0:
            output = stdout.decode() + stderr.decode()
            return json.dumps({
                "device_type": "fpga",
                "port": port,
                "status": "Connected",
                "output": output,
                "tool": "pesptool"
            }, indent=2)
        else:
            return json.dumps({
                "device_type": "fpga",
                "port": port,
                "status": "Error",
                "error": stderr.decode()
            }, indent=2)
            
    except Exception as e:
        return json.dumps({
            "device_type": "fpga",
            "port": port,
            "error": str(e)
        }, indent=2)


async def _get_esp32_info(port: str) -> str:
    """Get ESP32 device information using esptool."""
    try:
        # Use pesptool from the tools/pesptool directory
        from ..config import get_pesptool_path
        pesptool_path = get_pesptool_path()
        
        # Build command
        cmd = [
            sys.executable,
            str(pesptool_path),
        ]
        
        # Add port parameter only if not AUTO (for auto-detection)
        if port and port.upper() != "AUTO":
            cmd.extend(["--port", port])
        
        cmd.append("chip_id")
        
        # Run chip_id command
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await proc.communicate()
        
        if proc.returncode == 0:
            output = stdout.decode() + stderr.decode()
            return json.dumps({
                "device_type": "esp32",
                "port": port,
                "status": "Connected",
                "output": output
            }, indent=2)
        else:
            return json.dumps({
                "device_type": "esp32",
                "port": port,
                "status": "Error",
                "error": stderr.decode()
            }, indent=2)
            
    except Exception as e:
        return json.dumps({
            "device_type": "esp32",
            "port": port,
            "error": str(e)
        }, indent=2)
