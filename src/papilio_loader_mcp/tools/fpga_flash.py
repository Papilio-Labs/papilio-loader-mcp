"""FPGA flashing using pesptool (GadgetFactory esptool fork)."""

import sys
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
        # Use pesptool.exe from the application directory
        if getattr(sys, 'frozen', False):
            # Running as frozen executable - pesptool.exe is in same directory
            pesptool_path = Path(sys.executable).parent / "pesptool.exe"
        else:
            # Running from source - use the dist/pesptool.exe if available
            pesptool_path = Path(__file__).parent.parent.parent.parent / "dist" / "pesptool.exe"
            if not pesptool_path.exists():
                # Fallback: try to find in PATH
                import shutil
                pesptool_in_path = shutil.which("pesptool")
                if pesptool_in_path:
                    pesptool_path = Path(pesptool_in_path)
                else:
                    return json.dumps({
                        "success": False,
                        "error": "pesptool.exe not found. Please build it first with: python -m PyInstaller pesptool.spec"
                    }, indent=2)
        
        if not pesptool_path.exists():
            return json.dumps({
                "success": False,
                "error": f"pesptool.exe not found at: {pesptool_path}"
            }, indent=2)
        
        # Build command for FPGA flashing
        # FPGA bitstreams go to external flash at 0x100000 (1MB offset) by default
        cmd = [
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
