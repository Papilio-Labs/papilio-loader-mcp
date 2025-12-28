# PowerShell Build Script for Papilio Loader Desktop Application
# This is a wrapper around build.py for Windows users

param(
    [switch]$NoClean,
    [switch]$NoInstaller,
    [switch]$InstallerOnly,
    [switch]$Help
)

if ($Help) {
    Write-Host "Papilio Loader Desktop Build Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\build.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -NoClean        Skip cleaning previous build artifacts"
    Write-Host "  -NoInstaller    Skip creating Windows installer"
    Write-Host "  -InstallerOnly  Only create installer (skip executable build)"
    Write-Host "  -Help           Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\build.ps1                 # Full build"
    Write-Host "  .\build.ps1 -NoInstaller    # Build executable only"
    Write-Host "  .\build.ps1 -InstallerOnly  # Create installer from existing build"
    exit 0
}

Write-Host "Papilio Loader Desktop Build Script" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Build arguments array
$args = @()
if ($NoClean) { $args += "--no-clean" }
if ($NoInstaller) { $args += "--no-installer" }
if ($InstallerOnly) { $args += "--installer-only" }

# Run the Python build script
python build.py @args

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build completed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Build failed with error code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
