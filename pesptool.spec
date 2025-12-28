# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for pesptool standalone executable.
This creates a portable pesptool.exe that users can run directly.
"""

import sys
from pathlib import Path

block_cipher = None

# Get paths
root_dir = Path('.').absolute()
pesptool_dir = root_dir / 'tools' / 'pesptool'
pesptool_package = pesptool_dir / 'pesptool'

a = Analysis(
    [str(pesptool_dir / 'pesptool.py')],
    pathex=[str(pesptool_dir)],
    binaries=[],
    datas=[
        (str(pesptool_package / 'targets'), 'pesptool/targets'),
    ],
    hiddenimports=['pesptool', 'pesptool.cmds', 'pesptool.targets'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'numpy', 'pandas', 'scipy', 'pytest'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='pesptool',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
