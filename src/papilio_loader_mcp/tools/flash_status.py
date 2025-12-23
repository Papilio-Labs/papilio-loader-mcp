"""Get flash status and memory information."""

import json
import asyncio
from pathlib import Path


async def get_flash_status(port: str, device_type: str) -> str:
    """
    Get flash status and memory information for a device.
    
    Args:
        port: Serial port
        device_type: Type of device ("fpga" or "esp32")
    
    Returns:
        JSON string with flash status information
    """
    if device_type == "fpga":
        return await _get_fpga_flash_status(port)
    elif device_type == "esp32":
        return await _get_esp32_flash_status(port)
    else:
        return json.dumps({"error": f"Unknown device type: {device_type}"})


async def _get_fpga_flash_status(port: str) -> str:
    """Get Papilio FPGA flash status using pesptool."""
    try:
        pesptool_path = Path(__file__).parent.parent.parent.parent / "tools" / "pesptool" / "esptool.py"
        
        # Run flash_id command to get flash information
        proc = await asyncio.create_subprocess_exec(
            "python",
            str(pesptool_path),
            "--port", port,
            "flash_id",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await proc.communicate()
        
        if proc.returncode == 0:
            output = stdout.decode() + stderr.decode()
            return json.dumps({
                "device_type": "fpga",
                "port": port,
                "status": "Success",
                "flash_info": output
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


async def _get_esp32_flash_status(port: str) -> str:
    """Get ESP32 flash status."""
    try:
        pesptool_path = Path(__file__).parent.parent.parent.parent / "tools" / "pesptool" / "esptool.py"
        
        # Run flash_id command to get flash information
        proc = await asyncio.create_subprocess_exec(
            "python",
            str(pesptool_path),
            "--port", port,
            "flash_id",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await proc.communicate()
        
        if proc.returncode == 0:
            output = stdout.decode() + stderr.decode()
            return json.dumps({
                "device_type": "esp32",
                "port": port,
                "status": "Success",
                "flash_info": output
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
