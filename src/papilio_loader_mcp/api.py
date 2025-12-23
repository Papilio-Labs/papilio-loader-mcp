"""FastAPI REST API for remote network access."""

import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .tools.serial_ports import list_serial_ports
from .tools.device_info import get_device_info
from .tools.flash_status import get_flash_status
from .tools.fpga_flash import flash_fpga_device
from .tools.esp_flash import flash_esp_device
from .config import get_config

# Create FastAPI app
api = FastAPI(
    title="Papilio Loader API",
    description="REST API for remote FPGA and ESP32 device programming",
    version="0.1.0",
)

# Configure CORS
config = get_config()
api.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class DeviceInfoRequest(BaseModel):
    port: str
    device_type: str  # "fpga" or "esp32"


class FlashRequest(BaseModel):
    port: str
    device_type: str
    address: Optional[str] = None
    verify: bool = True


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


# Authentication middleware
async def verify_api_key(x_api_key: Optional[str] = Header(None)) -> bool:
    """Verify API key if configured."""
    if config.api_key:
        if not x_api_key or x_api_key != config.api_key:
            raise HTTPException(status_code=401, detail="Invalid API key")
    return True


@api.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "papilio-loader-mcp"}


@api.get("/ports")
async def get_ports(_: bool = Header(None, alias="x-api-key")):
    """List all available serial ports."""
    await verify_api_key(_)
    result = await list_serial_ports()
    return ApiResponse(success=True, message="Ports retrieved", data={"ports": result})


@api.post("/device/info")
async def device_info(
    request: DeviceInfoRequest, _: bool = Header(None, alias="x-api-key")
):
    """Get device information."""
    await verify_api_key(_)
    result = await get_device_info(request.port, request.device_type)
    return ApiResponse(success=True, message="Device info retrieved", data={"info": result})


@api.post("/device/flash-status")
async def flash_status(
    request: DeviceInfoRequest, _: bool = Header(None, alias="x-api-key")
):
    """Get flash status."""
    await verify_api_key(_)
    result = await get_flash_status(request.port, request.device_type)
    return ApiResponse(success=True, message="Flash status retrieved", data={"status": result})


@api.post("/flash/upload")
async def upload_and_flash(
    port: str,
    device_type: str,
    file: UploadFile = File(...),
    address: Optional[str] = None,
    verify: bool = True,
    x_api_key: Optional[str] = Header(None),
):
    """Upload and flash a firmware file."""
    await verify_api_key(x_api_key)

    # Validate file size
    contents = await file.read()
    if len(contents) > config.max_upload_size:
        raise HTTPException(
            status_code=413, detail=f"File too large (max {config.max_upload_size} bytes)"
        )

    # Save uploaded file temporarily
    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)
    temp_file = temp_dir / file.filename
    
    try:
        with open(temp_file, "wb") as f:
            f.write(contents)

        # Flash the device
        if device_type == "fpga":
            result = await flash_fpga_device(str(temp_file), port, verify)
        elif device_type == "esp32":
            if not address:
                raise HTTPException(status_code=400, detail="Address required for ESP32")
            result = await flash_esp_device(str(temp_file), port, address, verify)
        else:
            raise HTTPException(status_code=400, detail="Invalid device type")

        return ApiResponse(
            success=True,
            message="Device flashed successfully",
            data={"result": result},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Clean up temp file
        if temp_file.exists():
            temp_file.unlink()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api, host=config.bind_address, port=config.port)
