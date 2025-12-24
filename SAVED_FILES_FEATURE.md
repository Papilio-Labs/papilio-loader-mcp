# Saved Files Library Feature

## Overview

The Papilio Loader now includes a **Saved Files Library** that allows you to save frequently-used firmware files with descriptions for easy reuse.

## Features

✅ **Persistent Storage** - Files saved to disk with SQLite database  
✅ **Device Type Filtering** - View FPGA or ESP32 files separately  
✅ **Descriptions** - Add notes to remember what each file is for  
✅ **Quick Loading** - One-click to load a saved file into the flash form  
✅ **File Management** - Delete old files you no longer need  

## How to Use

### Saving a File

1. Select a file to flash (FPGA or ESP32)
2. Check the **"💾 Save this file to library"** checkbox
3. A description field will appear
4. Enter a description (e.g., "Arcade Template v1.2" or "Main Firmware v2.1")
5. Flash the device as normal
6. The file will be saved to your library before flashing

### Viewing Saved Files

1. Click the **"💾 Saved Files Library"** button to expand the section
2. Use the tabs to filter:
   - **All Files** - Show everything
   - **FPGA** - Show only FPGA bitstreams
   - **ESP32** - Show only ESP32 firmware

### Loading a Saved File

1. Expand the Saved Files Library section
2. Find the file you want to use
3. Click the **"📥 Load"** button
4. The file will be loaded into the appropriate flash form (FPGA or ESP32)
5. Adjust settings (port, address, etc.) if needed
6. Click Flash

### Deleting a Saved File

1. Expand the Saved Files Library section
2. Find the file you want to remove
3. Click the **"🗑️ Delete"** button
4. Confirm the deletion

## File Information Displayed

Each saved file shows:
- **Filename** - Original name of the uploaded file
- **Device Type** - Badge showing FPGA or ESP32
- **Description** - Your custom note about the file
- **File Size** - Size in KB or MB
- **Upload Date** - When the file was saved (e.g., "2 hours ago")

## Storage Location

- **Database**: `saved_files.db` (SQLite database in project root)
- **Files**: `saved_files/` directory (files stored with unique IDs)

These are automatically created when you save your first file.

## Database Schema

```sql
CREATE TABLE saved_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    device_type TEXT NOT NULL,
    description TEXT,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

## API Endpoints

New endpoints added to support this feature:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/web/saved-files` | List saved files (optional `?device_type=` filter) |
| POST | `/web/save-file` | Save a new file with description |
| GET | `/web/saved-files/{id}/download` | Download a saved file |
| DELETE | `/web/saved-files/{id}` | Delete a saved file |

## Technical Details

### Backend

- **Database Module**: `src/papilio_loader_mcp/database.py`
  - SQLite3 for persistence
  - Functions: `add_saved_file()`, `get_saved_files()`, `delete_saved_file()`, etc.
  
- **API Routes**: `src/papilio_loader_mcp/api.py`
  - Web endpoints for CRUD operations
  - Session authentication required

### Frontend

- **UI Components**: `templates/upload.html`
  - Collapsible saved files section
  - Tab filtering (All/FPGA/ESP32)
  - File cards with load/delete actions
  - Save checkbox and description input

### File Storage

Files are stored with UUID-based filenames to prevent conflicts:
- Original filename preserved in database
- Stored as: `{uuid}.bin` in `saved_files/` directory
- Automatic cleanup on deletion

## Benefits

1. **Convenience** - No need to navigate file system repeatedly
2. **Organization** - Add descriptions to remember file purposes
3. **Speed** - One-click file loading
4. **History** - See when files were saved
5. **Clean UI** - Collapsible section doesn't clutter the interface

## Example Workflow

```
1. User uploads "arcade_v1.2.bin" for FPGA
2. Checks "Save to library"
3. Enters description: "Papilio Arcade Template v1.2"
4. Flashes device successfully
5. File is now saved

Later...

6. User clicks "Saved Files Library"
7. Sees the saved file with description
8. Clicks "Load" button
9. File populates FPGA form
10. User can flash immediately
```

## Cleanup

To remove all saved files and start fresh:

```bash
# Delete database
Remove-Item saved_files.db

# Delete saved files directory
Remove-Item saved_files -Recurse

# Files will be recreated automatically on next save
```

## Future Enhancements

Potential improvements:
- Export/import saved files
- Tagging system
- Search functionality
- File versioning
- Bulk operations

## Security Notes

- All endpoints require web session authentication
- Files are stored server-side only (not in browser)
- No direct filesystem access from web interface
- Database uses parameterized queries (SQL injection safe)

---

**Happy Flashing! 💾⚡**
