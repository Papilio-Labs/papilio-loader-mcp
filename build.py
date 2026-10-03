"""Build script for creating Papilio Loader desktop application.

This script:
1. Builds the executable using PyInstaller
2. Optionally creates the Windows installer using Inno Setup
"""

import subprocess
import sys
import shutil
import json
from pathlib import Path


def run_command(cmd, description, cwd=None):
    """Run a command and handle errors."""
    print(f"\n{'=' * 60}")
    print(f"{description}")
    print(f"{'=' * 60}")
    print(f"Running: {' '.join(cmd)}\n")
    
    result = subprocess.run(cmd, cwd=cwd)
    
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


def build_pesptool():
    """Build pesptool.exe standalone executable."""
    if not Path('pesptool.spec').exists():
        print("❌ Error: pesptool.spec not found")
        return False
    
    return run_command(
        [sys.executable, "-m", "PyInstaller", "pesptool.spec", "--clean"],
        "Building pesptool.exe with PyInstaller"
    )


def build_esptool():
    """Build esptool.exe standalone executable."""
    if not Path('esptool.spec').exists():
        print("❌ Error: esptool.spec not found")
        return False
    
    return run_command(
        [sys.executable, "-m", "PyInstaller", "esptool.spec", "--clean"],
        "Building esptool.exe with PyInstaller"
    )


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
    
    # Build pesptool.exe first
    print("\n🔧 Building pesptool.exe standalone tool...")
    if not build_pesptool():
        print("❌ pesptool.exe build failed!")
        return False
    
    # Copy pesptool.exe to dist for bundling
    pesptool_exe = Path('dist/pesptool.exe')
    if not pesptool_exe.exists():
        print("❌ Error: pesptool.exe not found after build")
        return False
    
    print(f"✅ pesptool.exe built: {pesptool_exe.absolute()}")
    
    # Run PyInstaller for main application
    return run_command(
        [sys.executable, "-m", "PyInstaller", "papilio_loader.spec", "--clean"],
        "Building executable with PyInstaller"
    )


def build_installer():
    """Build the current Electron/NSIS Windows installer."""
    node_candidates = [
        shutil.which("node"),
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
    ]
    node_exe = next((path for path in node_candidates if path and Path(path).exists()), None)
    if not node_exe:
        print("\n⚠️  Warning: Node.js not found")
        print("   Install Node.js to build the Electron installer")
        return False
    
    web_dir = Path("apps/web")
    desktop_dir = Path("apps/desktop")
    builder_cli = Path("node_modules/electron-builder/out/cli/cli.js")
    if not web_dir.exists() or not desktop_dir.exists() or not builder_cli.exists():
        print("❌ Error: Electron workspace or electron-builder is missing")
        return False

    if not run_command(
        [node_exe, "build.mjs"],
        "Building the web bundle for the Electron installer",
        cwd=web_dir,
    ):
        return False

    if not run_command(
        [node_exe, "build.mjs"],
        "Building the Electron desktop application",
        cwd=desktop_dir,
    ):
        return False

    release_dir = desktop_dir / "release"
    for stale_dir in (release_dir / "win-unpacked", release_dir / "win-unpacked.tmp"):
        if stale_dir.exists():
            shutil.rmtree(stale_dir)

    if not run_command(
        [node_exe, str(Path("..") / ".." / builder_cli), "--win", "nsis"],
        "Building the Windows installer with Electron Builder",
        cwd=desktop_dir,
    ):
        return False

    version = json.loads((desktop_dir / "package.json").read_text(encoding="utf-8"))["version"]
    built_installer = release_dir / f"Papilio Loader Setup {version}.exe"
    published_installer = Path("installer_output") / f"PapilioLoader-Setup-{version}.exe"
    published_installer.parent.mkdir(exist_ok=True)
    shutil.copy2(built_installer, published_installer)
    print(f"✅ Current Electron installer copied to {published_installer.absolute()}")
    return True


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
    
    # Build standalone tool executables first
    if not installer_only:
        print("\n📦 Building standalone tool executables...")
        
        if not build_pesptool():
            print("\n❌ pesptool build failed!")
            return 1
        print("✅ pesptool.exe built successfully!")
        
        if not build_esptool():
            print("\n❌ esptool build failed!")
            return 1
        print("✅ esptool.exe built successfully!")
    
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
