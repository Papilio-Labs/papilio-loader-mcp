"""FPGA flashing using pesptool (GadgetFactory esptool fork)."""

import json
import asyncio
from pathlib import Path


async def flash_fpga_device(port: str, file_path: str, verify: bool = True) -> str:
    """
    Flash a Papilio board with Gowin FPGA using pesptool.
    
    Args:
        port: Serial port
        file_path: Path to .bin file (Gowin FPGA bitstream)
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
        pesptool_path = Path(__file__).parent.parent.parent.parent / "tools" / "pesptool" / "esptool.py"
        
        if not pesptool_path.exists():
            return json.dumps({
                "success": False,
                "error": "pesptool (esptool.py) not found in tools/pesptool directory"
            }, indent=2)
        
        # Build command for FPGA flashing
        # pesptool uses write_flash command with FPGA-specific addressing
        cmd = [
            "python",
            str(pesptool_path),
            "--port", port,
            "write_flash",
            "0x0",  # FPGA bitstreams typically start at 0x0
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
            "device_type": "fpga",
            "port": port,
            "file": str(file_path_obj),
            "verified": verify,
            "output": output,
            "tool": "pesptool (GadgetFactory esptool fork)"
        }, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2)
