# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Papilio Loader Desktop Application.

This bundles the application with all dependencies, templates, and tools
into a single executable for Windows.

Usage:
    pyinstaller papilio_loader.spec
"""

import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Get the project root directory
root_dir = Path('.').absolute()
src_dir = root_dir / 'src'
templates_dir = root_dir / 'templates'
dist_dir = root_dir / 'dist'

# Collect all data files from dependencies
datas = []

# Add templates
datas.append((str(templates_dir), 'templates'))

# Add pesptool.exe if it exists (built separately)
pesptool_exe = dist_dir / 'pesptool.exe'
if pesptool_exe.exists():
    datas.append((str(pesptool_exe), '.'))

# Collect data files from packages that need them
datas += collect_data_files('esptool')
datas += collect_data_files('fastapi')
datas += collect_data_files('starlette')

# Hidden imports - modules that PyInstaller might miss
hiddenimports = [
    'pkg_resources.py2_warn',
    'pystray._win32',
    'PIL._tkinter_finder',
    'papilio_loader_mcp',
    'papilio_loader_mcp.desktop',
    'papilio_loader_mcp.tray',
    'papilio_loader_mcp.config',
    'papilio_loader_mcp.server',
    'papilio_loader_mcp.api',
    'papilio_loader_mcp.database',
    'papilio_loader_mcp.http_server',
    'papilio_loader_mcp.file_detector',
    'papilio_loader_mcp.tools',
]

# Collect all submodules from key packages
hiddenimports += collect_submodules('esptool')
hiddenimports += collect_submodules('serial')
hiddenimports += collect_submodules('uvicorn')
hiddenimports += collect_submodules('starlette')
hiddenimports += collect_submodules('fastapi')
hiddenimports += collect_submodules('mcp')
hiddenimports += collect_submodules('pydantic')
hiddenimports += collect_submodules('pydantic_core')

a = Analysis(
    ['start_desktop.py'],
    pathex=[str(src_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'pytest',
        'setuptools',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=block_cipher
)

# Main executable without console (clean GUI app)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PapilioLoader',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # TODO: Add icon file if available
    version=None,  # TODO: Add version info if available
)

# Debug executable with console (for troubleshooting)
exe_console = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PapilioLoader-Console',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Show console for debugging
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
    version=None,
)
