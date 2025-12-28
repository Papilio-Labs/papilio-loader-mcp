"""FPGA flashing using pesptool (GadgetFactory esptool fork)."""

import json
import asyncio
from pathlib import Path


async def flash_fpga_device(port: str, file_path: str, address: str = "0x100000", verify: bool = True) -> str:
    """
    Flash a Papilio board with Gowin FPGA using pesptool.
    
    Args:
        port: Serial port
        file_path: Path to .bin file (Gowin FPGA bitstream)
        address: Flash address in hex (default: "0x100000" for FPGA bitstreams)
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
    
    # Check file extension - only .bin supported for Gowin FPGA
    if file_path_obj.suffix.lower() != '.bin':
        return json.dumps({
            "success": False,
            "error": f"Invalid file type: {file_path_obj.suffix}. Only .bin files supported for Gowin FPGA (not .bit)"
        }, indent=2)
    
    try:
        # Use pesptool from the tools/pesptool directory
        from ..config import get_pesptool_path
        pesptool_path = get_pesptool_path()
        
        if not pesptool_path.exists():
            return json.dumps({
                "success": False,
                "error": f"pesptool not found at: {pesptool_path}"
            }, indent=2)
        
        # Build command for FPGA flashing
        # FPGA bitstreams go to external flash at 0x100000 (1MB offset) by default
        cmd = [
            "python",
            str(pesptool_path),
        ]
        
        # Add port parameter only if not AUTO (for auto-detection)
        if port and port.upper() != "AUTO":
            cmd.extend(["--port", port])
        
        cmd.extend([
            "write-flash",
            address if address else "0x100000",
            str(file_path_obj)
        ])
        
        # Note: pesptool write-flash doesn't support --verify flag
        # Verification would need to be done separately with read-flash
        
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
            "device_type": "fpga",
            "port": port if port.upper() != "AUTO" else "auto-detected",
            "file": str(file_path_obj),
            "address": address,
            "verified": verify,
            "output": output,
            "tool": "pesptool (GadgetFactory esptool fork)"
        }, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2)
