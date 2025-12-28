"""FastAPI REST API for remote network access."""

import os
import secrets
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Cookie, Response, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from .tools.serial_ports import list_serial_ports
from .tools.device_info import get_device_info
from .tools.flash_status import get_flash_status
from .tools.fpga_flash import flash_fpga_device
from .tools.esp_flash import flash_esp_device
from .config import get_config
from .file_detector import validate_file_for_device
from .database import (
    add_saved_file,
    get_saved_files,
    get_saved_file,
    delete_saved_file,
    update_saved_file_name,
    update_saved_file_description,
    get_saved_file_path,
    get_saved_files_dir
)

# Create FastAPI app
api = FastAPI(
    title="Papilio Loader API",
    description="REST API for remote FPGA and ESP32 device programming",
    version="0.1.0",
)

# Configure CORS
config = get_config()

# Add session middleware for web authentication
api.add_middleware(
    SessionMiddleware,
    secret_key=config.session_secret_key,
    max_age=3600 * 24,  # 24 hours
)

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


# ============================================================================
# Web Interface Endpoints (Session-based authentication for human users)
# ============================================================================

class LoginRequest(BaseModel):
    username: str
    password: str


def check_web_session(request: Request) -> bool:
    """Check if user is authenticated via web session."""
    if not request.session.get("authenticated"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return True


@api.get("/web/login", response_class=HTMLResponse)
async def web_login_page():
    """Serve the login page."""
    template_path = Path(__file__).parent.parent.parent / "templates" / "login.html"
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Login page not found")
    return HTMLResponse(content=template_path.read_text(encoding='utf-8'), status_code=200)


@api.post("/web/login")
async def web_login(request: Request, login: LoginRequest):
    """Handle web login."""
    if login.username == config.web_username and login.password == config.web_password:
        request.session["authenticated"] = True
        request.session["username"] = login.username
        return {"success": True, "message": "Login successful"}
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@api.post("/web/logout")
async def web_logout(request: Request):
    """Handle web logout."""
    request.session.clear()
    return {"success": True, "message": "Logged out"}


@api.get("/web/upload", response_class=HTMLResponse)
async def web_upload_page(request: Request):
    """Serve the upload page (requires authentication)."""
    check_web_session(request)
    template_path = Path(__file__).parent.parent.parent / "templates" / "upload.html"
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Upload page not found")
    return HTMLResponse(content=template_path.read_text(encoding='utf-8'), status_code=200)


@api.get("/web/ports")
async def web_get_ports(request: Request):
    """Get serial ports (web interface)."""
    check_web_session(request)
    result = await list_serial_ports()
    # list_serial_ports returns JSON string, parse it
    import json
    parsed_result = json.loads(result)
    return {"success": True, "ports": parsed_result.get("ports", [])}


@api.post("/web/flash")
async def web_flash_device(
    request: Request,
    port: str = Form(...),
    device_type: str = Form(...),
    file: UploadFile = File(...),
    address: Optional[str] = Form("0x10000"),
    verify: bool = Form(True),
    advanced: bool = Form(False),
):
    """Flash device via web interface (requires authentication)."""
    check_web_session(request)
    
    # Validate file size
    contents = await file.read()
    if len(contents) > config.max_upload_size:
        raise HTTPException(
            status_code=413, detail=f"File too large (max {config.max_upload_size} bytes)"
        )
    
    # Validate file type matches intended device (warn but don't block)
    validation = validate_file_for_device(contents, device_type)
    file_type_warning = None
    
    # Store warning if file type mismatch detected
    if not validation["valid"]:
        file_type_warning = {
            "warning": validation["warning"],
            "detected_type": validation["detected_type"],
            "intended_device": device_type,
            "details": validation["details"]
        }

    # Save uploaded file temporarily
    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)
    temp_file = temp_dir / file.filename
    
    try:
        with open(temp_file, "wb") as f:
            f.write(contents)

        # Flash the device and get command string
        import json as json_lib
        
        if device_type == "fpga":
            # Get FPGA address from form or use default
            fpga_address = address if address else "0x100000"
            result_json = await flash_fpga_device(port, str(temp_file), fpga_address, verify)
            result = json_lib.loads(result_json)
            # Build command string for display
            if port and port.upper() != "AUTO":
                command = f"python tools/pesptool/pesptool.py --port {port} write-flash {fpga_address} {temp_file.name}"
            else:
                command = f"python tools/pesptool/pesptool.py write-flash {fpga_address} {temp_file.name}  # auto-detect port"
        elif device_type == "esp32":
            if not address:
                address = "0x10000"
            result_json = await flash_esp_device(port, str(temp_file), address, verify)
            result = json_lib.loads(result_json)
            # Build command string for display
            if port and port.upper() != "AUTO":
                command = f"python -m esptool --port {port} write-flash {address} {temp_file.name}"
            else:
                command = f"python -m esptool write-flash {address} {temp_file.name}  # auto-detect port"
        else:
            raise HTTPException(status_code=400, detail="Invalid device type")

        if not result.get("success"):
            # Return error with output for debugging
            return ApiResponse(
                success=False,
                message=result.get("error", "Flash operation failed"),
                data={
                    "command": command,
                    "output": result.get("output", ""),
                    "error": result.get("error", "Unknown error")
                }
            )

        response_data = {
            "command": command if advanced else None,
            "output": result.get("output", "") if advanced else None,
            "result": result
        }
        
        # Include file type warning if present
        if file_type_warning:
            response_data["file_type_warning"] = file_type_warning
        
        return ApiResponse(
            success=True,
            message="Device flashed successfully" + (" (with warning)" if file_type_warning else ""),
            data=response_data,
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        return ApiResponse(
            success=False,
            message=str(e),
            data={"error": str(e), "traceback": traceback.format_exc()}
        )
    
    finally:
        # Clean up temp file
        if temp_file.exists():
            temp_file.unlink()


# Saved Files Management Endpoints
@api.get("/web/saved-files")
async def web_get_saved_files(request: Request, device_type: Optional[str] = None):
    """Get list of saved files."""
    check_web_session(request)
    
    files = get_saved_files(device_type)
    return {"success": True, "files": files}


@api.post("/web/save-file")
async def web_save_file(
    request: Request,
    file: UploadFile = File(...),
    device_type: str = Form(...),
    description: str = Form(""),
    custom_filename: str = Form(""),
):
    """Save a file for later use."""
    check_web_session(request)
    
    # Read file content
    contents = await file.read()
    file_size = len(contents)
    
    # Validate file size
    if file_size > config.max_upload_size:
        raise HTTPException(
            status_code=413, detail=f"File too large (max {config.max_upload_size} bytes)"
        )
    
    # Use custom filename if provided, otherwise use original
    import os
    original_filename = custom_filename.strip() if custom_filename.strip() else file.filename
    
    # Generate unique filename for storage
    import uuid
    file_extension = os.path.splitext(file.filename)[1]
    stored_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Save file to disk
    saved_files_dir = get_saved_files_dir()
    file_path = saved_files_dir / stored_filename
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Add to database
    file_id = add_saved_file(
        original_filename=original_filename,
        stored_filename=stored_filename,
        device_type=device_type,
        description=description,
        file_size=file_size
    )
    
    return ApiResponse(
        success=True,
        message="File saved successfully",
        data={"file_id": file_id, "filename": original_filename}
    )


@api.put("/web/saved-files/{file_id}/rename")
async def web_rename_saved_file(
    request: Request,
    file_id: int,
    new_filename: str = Form(...)
):
    """Rename a saved file."""
    check_web_session(request)
    
    if update_saved_file_name(file_id, new_filename):
        return ApiResponse(success=True, message="File renamed successfully")
    else:
        raise HTTPException(status_code=404, detail="File not found")


@api.put("/web/saved-files/{file_id}/description")
async def web_update_saved_file_description(
    request: Request,
    file_id: int,
    new_description: str = Form(...)
):
    """Update a saved file's description."""
    check_web_session(request)
    
    if update_saved_file_description(file_id, new_description):
        return ApiResponse(success=True, message="Description updated successfully")
    else:
        raise HTTPException(status_code=404, detail="File not found")


@api.delete("/web/saved-files/{file_id}")
async def web_delete_saved_file(request: Request, file_id: int):
    """Delete a saved file."""
    check_web_session(request)
    
    if delete_saved_file(file_id):
        return ApiResponse(success=True, message="File deleted successfully")
    else:
        raise HTTPException(status_code=404, detail="File not found")


@api.get("/web/saved-files/{file_id}/download")
async def web_download_saved_file(request: Request, file_id: int):
    """Download a saved file."""
    check_web_session(request)
    
    file_info = get_saved_file(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = get_saved_file_path(file_id)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    from starlette.responses import FileResponse
    return FileResponse(
        path=file_path,
        filename=file_info['original_filename'],
        media_type='application/octet-stream'
    )


# Redirect root to web interface
@api.get("/", response_class=HTMLResponse)
async def root():
    """Redirect to web login."""
    return RedirectResponse(url="/web/login")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api, host=config.bind_address, port=config.port)

