"""List available serial ports."""

import json
import serial.tools.list_ports


async def list_serial_ports() -> str:
    """
    List all available serial/COM ports on the system.
    
    Returns:
        JSON string with port information
    """
    ports = serial.tools.list_ports.comports()
    port_list = []
    
    for port in ports:
        port_info = {
            "device": port.device,
            "name": port.name,
            "description": port.description,
            "hwid": port.hwid,
            "vid": port.vid,
            "pid": port.pid,
            "serial_number": port.serial_number,
            "manufacturer": port.manufacturer,
            "product": port.product,
        }
        port_list.append(port_info)
    
    return json.dumps({"ports": port_list, "count": len(port_list)}, indent=2)
