"""OTA (Over-The-Air) flashing via HTTP for ESP32 and FPGA."""

import json
import asyncio
from pathlib import Path
import aiohttp
from typing import Optional


async def flash_esp_ota(ip: str, file_path: str, port: int = 3232) -> str:
    """
    Flash ESP32 firmware via OTA update.
    
    Args:
        ip: Device IP address
        file_path: Path to ESP32 firmware file (.bin or .elf)
        port: OTA server port (default: 3232)
    
    Returns:
        JSON string with flashing results
    """
    return await _flash_ota(
        ip=ip,
        file_path=file_path,
        port=port,
        endpoint="/update",
        device_type="ESP32"
    )


async def flash_fpga_ota(ip: str, file_path: str, port: int = 3232) -> str:
    """
    Flash FPGA bitstream via OTA update.
    
    Args:
        ip: Device IP address
        file_path: Path to FPGA bitstream file (.bin)
        port: OTA server port (default: 3232)
    
    Returns:
        JSON string with flashing results
    """
    return await _flash_ota(
        ip=ip,
        file_path=file_path,
        port=port,
        endpoint="/fpga-update",
        device_type="FPGA"
    )


async def _flash_ota(
    ip: str,
    file_path: str,
    port: int,
    endpoint: str,
    device_type: str
) -> str:
    """
    Internal function to handle OTA flashing.
    
    Args:
        ip: Device IP address
        file_path: Path to firmware/bitstream file
        port: OTA server port
        endpoint: API endpoint (/update or /fpga-update)
        device_type: Type of device (ESP32 or FPGA)
    
    Returns:
        JSON string with results
    """
    file_path_obj = Path(file_path)
    
    # Validate file exists
    if not file_path_obj.exists():
        return json.dumps({
            "success": False,
            "error": f"File not found: {file_path}"
        }, indent=2)
    
    # Check file extension
    valid_extensions = ['.bin', '.elf'] if device_type == "ESP32" else ['.bin']
    if file_path_obj.suffix.lower() not in valid_extensions:
        return json.dumps({
            "success": False,
            "error": f"Invalid file type for {device_type}: {file_path_obj.suffix}. Expected {', '.join(valid_extensions)}"
        }, indent=2)
    
    try:
        # Read file
        file_size = file_path_obj.stat().st_size
        with open(file_path_obj, 'rb') as f:
            firmware_data = f.read()
        
        # Construct URL
        url = f"http://{ip}:{port}{endpoint}"
        
        print(f"Uploading {device_type} firmware to {url}")
        print(f"File: {file_path_obj.name} ({file_size:,} bytes)")
        
        # Upload firmware via HTTP POST
        timeout = aiohttp.ClientTimeout(total=120)  # 2 minute timeout for upload
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, data=firmware_data) as response:
                response_text = await response.text()
                
                if response.status == 200:
                    return json.dumps({
                        "success": True,
                        "device_type": device_type,
                        "ip": ip,
                        "port": port,
                        "file": str(file_path_obj),
                        "file_size": file_size,
                        "response": response_text,
                        "message": f"✅ {device_type} OTA update successful! Device will reboot."
                    }, indent=2)
                else:
                    return json.dumps({
                        "success": False,
                        "error": f"HTTP {response.status}: {response_text}",
                        "device_type": device_type,
                        "ip": ip,
                        "port": port
                    }, indent=2)
                    
    except aiohttp.ClientError as e:
        return json.dumps({
            "success": False,
            "error": f"Network error: {str(e)}",
            "device_type": device_type,
            "ip": ip,
            "port": port,
            "troubleshooting": [
                "Check that device is powered on and connected to network",
                f"Verify device IP address is {ip}",
                f"Ensure OTA server is running on port {port}",
                "Check firewall settings"
            ]
        }, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": f"Flash failed: {str(e)}",
            "device_type": device_type,
            "ip": ip,
            "port": port
        }, indent=2)


async def flash_device_ota(
    ip: str,
    device_type: str,
    file_path: str,
    port: int = 3232
) -> str:
    """
    Flash a device via OTA - unified interface for ESP32 and FPGA.
    
    Args:
        ip: Device IP address
        device_type: Type of device ("esp32" or "fpga")
        file_path: Path to firmware/bitstream file
        port: OTA server port (default: 3232)
    
    Returns:
        JSON string with flashing results
    """
    if device_type.lower() == "esp32":
        return await flash_esp_ota(ip, file_path, port)
    elif device_type.lower() == "fpga":
        return await flash_fpga_ota(ip, file_path, port)
    else:
        return json.dumps({
            "success": False,
            "error": f"Invalid device type: {device_type}. Expected 'esp32' or 'fpga'"
        }, indent=2)
