"""Test the saved files database functionality."""

import sys
sys.path.insert(0, 'src')

from papilio_loader_mcp.database import (
    add_saved_file,
    get_saved_files,
    get_saved_file,
    delete_saved_file,
    SAVED_FILES_DIR
)
from pathlib import Path

def test_database():
    print("="*60)
    print("Testing Saved Files Database")
    print("="*60)
    
    # Test 1: Add a file
    print("\n1. Adding test files...")
    file_id1 = add_saved_file(
        original_filename="test_fpga.bin",
        stored_filename="test_fpga_12345.bin",
        device_type="fpga",
        description="Test FPGA bitstream",
        file_size=1024000
    )
    print(f"   ✓ Added FPGA file with ID: {file_id1}")
    
    file_id2 = add_saved_file(
        original_filename="test_esp32.bin",
        stored_filename="test_esp32_67890.bin",
        device_type="esp32",
        description="Test ESP32 firmware",
        file_size=512000
    )
    print(f"   ✓ Added ESP32 file with ID: {file_id2}")
    
    # Test 2: Get all files
    print("\n2. Getting all files...")
    all_files = get_saved_files()
    print(f"   ✓ Found {len(all_files)} files")
    for file in all_files:
        print(f"     - {file['original_filename']} ({file['device_type']})")
    
    # Test 3: Get files by device type
    print("\n3. Getting FPGA files only...")
    fpga_files = get_saved_files(device_type="fpga")
    print(f"   ✓ Found {len(fpga_files)} FPGA files")
    
    print("\n4. Getting ESP32 files only...")
    esp32_files = get_saved_files(device_type="esp32")
    print(f"   ✓ Found {len(esp32_files)} ESP32 files")
    
    # Test 4: Get specific file
    print(f"\n5. Getting file ID {file_id1}...")
    file = get_saved_file(file_id1)
    if file:
        print(f"   ✓ Found: {file['original_filename']}")
        print(f"     Description: {file['description']}")
        print(f"     Size: {file['file_size']} bytes")
        print(f"     Created: {file['created_at']}")
    
    # Test 5: Delete file
    print(f"\n6. Deleting file ID {file_id1}...")
    success = delete_saved_file(file_id1)
    print(f"   {'✓' if success else '✗'} Deleted: {success}")
    
    # Test 6: Verify deletion
    print("\n7. Verifying deletion...")
    remaining = get_saved_files()
    print(f"   ✓ Remaining files: {len(remaining)}")
    
    print("\n" + "="*60)
    print("Database Location:", Path("saved_files.db").absolute())
    print("Saved Files Directory:", SAVED_FILES_DIR.absolute())
    print("="*60)

if __name__ == "__main__":
    test_database()
