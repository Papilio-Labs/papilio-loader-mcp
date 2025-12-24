# Papilio Loader - Combined Server Startup Script
# Runs both MCP server and Web Interface together

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Papilio Loader - Combined Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Python not found. Please install Python 3.12 or higher." -ForegroundColor Red
    exit 1
}

# Check Python version
$pythonVersion = python --version 2>&1
Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green

# Start the combined server
Write-Host ""
Write-Host "Starting combined server (MCP + Web Interface)..." -ForegroundColor Yellow
Write-Host ""

python start_combined_server.py --host 0.0.0.0 --port 8000
