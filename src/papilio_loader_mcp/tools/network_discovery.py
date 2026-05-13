"""Network device discovery for OTA-capable devices."""

import json
import asyncio
import socket
from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor
import aiohttp


async def discover_ota_devices(timeout: int = 2, port: int = 3232) -> str:
    """
    Discover OTA-capable devices on the local network.
    
    Scans the local subnet for devices with HTTP OTA endpoint on port 3232.
    
    Args:
        timeout: Timeout in seconds for each device check
        port: OTA server port (default: 3232)
    
    Returns:
        JSON string with discovered devices
    """
    devices = []
    
    try:
        # Get local IP and subnet
        local_ip = get_local_ip()
        if not local_ip:
            return json.dumps({
                "success": False,
                "error": "Could not determine local IP address"
            }, indent=2)
        
        # Parse subnet (assumes /24)
        ip_parts = local_ip.split('.')
        subnet = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}"
        
        # Scan subnet for devices
        print(f"Scanning subnet {subnet}.0/24 for OTA devices on port {port}...")
        
        # Create list of IPs to check
        ip_list = [f"{subnet}.{i}" for i in range(1, 255)]
        
        # Check each IP concurrently
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
            tasks = [check_ota_endpoint(session, ip, port) for ip in ip_list]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect successful results
        for ip, result in zip(ip_list, results):
            if isinstance(result, dict) and result.get('available'):
                devices.append({
                    "ip": ip,
                    "port": port,
                    "url": f"http://{ip}:{port}",
                    "endpoints": {
                        "esp32_update": f"http://{ip}:{port}/update",
                        "fpga_update": f"http://{ip}:{port}/fpga-update"
                    }
                })
        
        return json.dumps({
            "success": True,
            "devices_found": len(devices),
            "devices": devices,
            "scan_info": {
                "subnet": f"{subnet}.0/24",
                "port": port,
                "timeout": timeout
            }
        }, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": f"Discovery failed: {str(e)}"
        }, indent=2)


async def check_ota_endpoint(session: aiohttp.ClientSession, ip: str, port: int) -> Dict:
    """
    Check if an IP has an OTA endpoint available.
    
    Args:
        session: aiohttp session
        ip: IP address to check
        port: Port number
    
    Returns:
        Dict with availability status
    """
    try:
        url = f"http://{ip}:{port}"
        async with session.get(url) as response:
            # If we get any response, consider it available
            # The OTA server might return 200, 404, etc. but it's responding
            return {"available": True, "status": response.status}
    except Exception:
        # Connection failed, device not available
        return {"available": False}


def get_local_ip() -> str:
    """
    Get the local IP address of this machine.
    
    Returns:
        Local IP address as string, or None if unable to determine
    """
    try:
        # Create a socket connection to determine local IP
        # This doesn't actually connect, just determines the interface
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        try:
            # Use Google DNS to determine which interface would be used
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
        finally:
            s.close()
        return local_ip
    except Exception:
        return None


async def check_device_ip(ip: str, port: int = 3232) -> str:
    """
    Check if a specific IP address has an OTA endpoint.
    
    Args:
        ip: IP address to check
        port: OTA server port (default: 3232)
    
    Returns:
        JSON string with check results
    """
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=2)) as session:
            result = await check_ota_endpoint(session, ip, port)
        
        if result.get('available'):
            return json.dumps({
                "success": True,
                "available": True,
                "ip": ip,
                "port": port,
                "url": f"http://{ip}:{port}",
                "endpoints": {
                    "esp32_update": f"http://{ip}:{port}/update",
                    "fpga_update": f"http://{ip}:{port}/fpga-update"
                }
            }, indent=2)
        else:
            return json.dumps({
                "success": True,
                "available": False,
                "ip": ip,
                "port": port,
                "message": "No OTA endpoint found at this address"
            }, indent=2)
            
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": f"Check failed: {str(e)}"
        }, indent=2)
