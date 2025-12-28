"""Build script for creating Papilio Loader desktop application.

This script:
1. Builds the executable using PyInstaller
2. Optionally creates the Windows installer using Inno Setup
"""

import subprocess
import sys
import shutil
from pathlib import Path


def run_command(cmd, description):
    """Run a command and handle errors."""
    print(f"\n{'=' * 60}")
    print(f"{description}")
    print(f"{'=' * 60}")
    print(f"Running: {' '.join(cmd)}\n")
    
    result = subprocess.run(cmd, shell=True)
    
    if result.returncode != 0:
        print(f"\n❌ Error: {description} failed with code {result.returncode}")
        return False
    
    print(f"\n✅ {description} completed successfully")
    return True


def clean_build():
    """Clean previous build artifacts."""
    print("\n🧹 Cleaning previous build artifacts...")
    
    dirs_to_clean = ['build', 'dist', '__pycache__']
    
    for dir_name in dirs_to_clean:
        dir_path = Path(dir_name)
        if dir_path.exists():
            shutil.rmtree(dir_path)
            print(f"  Removed: {dir_name}/")
    
    print("✅ Cleanup complete")


def build_executable():
    """Build the executable using PyInstaller."""
    if not Path('papilio_loader.spec').exists():
        print("❌ Error: papilio_loader.spec not found")
        return False
    
    # Install desktop dependencies if not already installed
    print("\n📦 Installing desktop dependencies...")
    run_command(
        [sys.executable, "-m", "pip", "install", "-e", ".[desktop]"],
        "Installing dependencies"
    )
    
    # Run PyInstaller
    return run_command(
        [sys.executable, "-m", "PyInstaller", "papilio_loader.spec", "--clean"],
        "Building executable with PyInstaller"
    )


def build_installer():
    """Build the Windows installer using Inno Setup."""
    # Check if Inno Setup is installed
    inno_paths = [
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files\Inno Setup 6\ISCC.exe",
    ]
    
    iscc_exe = None
    for path in inno_paths:
        if Path(path).exists():
            iscc_exe = path
            break
    
    if not iscc_exe:
        print("\n⚠️  Warning: Inno Setup not found")
        print("   Download from: https://jrsoftware.org/isinfo.php")
        print("   Skipping installer creation")
        return False
    
    if not Path('installer.iss').exists():
        print("❌ Error: installer.iss not found")
        return False
    
    # Run Inno Setup compiler
    return run_command(
        [iscc_exe, "installer.iss"],
        "Building Windows installer with Inno Setup"
    )


def main():
    """Main build process."""
    print("🚀 Papilio Loader Desktop Build Script")
    print("=" * 60)
    
    # Parse command line arguments
    skip_clean = '--no-clean' in sys.argv
    skip_installer = '--no-installer' in sys.argv
    installer_only = '--installer-only' in sys.argv
    
    # Clean previous builds
    if not skip_clean and not installer_only:
        clean_build()
    
    # Build executable
    if not installer_only:
        if not build_executable():
            print("\n❌ Build failed!")
            return 1
        
        print("\n✅ Executable built successfully!")
        print(f"   Location: {Path('dist/PapilioLoader.exe').absolute()}")
    
    # Build installer
    if not skip_installer:
        print("\n")
        if build_installer():
            print("\n✅ Installer built successfully!")
            print(f"   Location: {Path('installer_output').absolute()}")
        else:
            print("\n⚠️  Installer build skipped or failed")
    
    print("\n" + "=" * 60)
    print("🎉 Build process complete!")
    print("=" * 60)
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
