"""FPGA flashing using papilio-prog."""

import json
import asyncio
import shutil
from pathlib import Path


async def flash_fpga_device(port: str, file_path: str, verify: bool = True) -> str:
    """
    Flash an FPGA device with a bitstream file.
    
    Args:
        port: Serial port
        file_path: Path to .bit file
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
    if file_path_obj.suffix.lower() not in ['.bit', '.bin']:
        return json.dumps({
            "success": False,
            "error": f"Invalid file type: {file_path_obj.suffix}. Expected .bit or .bin"
        }, indent=2)
    
    # Look for papilio-prog binary
    papilio_prog = shutil.which("papilio-prog")
    
    if not papilio_prog:
        return json.dumps({
            "success": False,
            "error": "papilio-prog not found in PATH. Please install papilio-prog.",
            "info": "papilio-prog is required for FPGA programming. Document as external dependency."
        }, indent=2)
    
    try:
        # Build command
        cmd = [papilio_prog, "-p", port, "-f", str(file_path_obj)]
        if verify:
            cmd.append("-v")
        
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
            "output": output
        }, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2)
