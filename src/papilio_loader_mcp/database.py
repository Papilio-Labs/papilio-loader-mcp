"""Database module for storing saved files metadata."""

import sqlite3
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict
import json

# Database file location
DB_PATH = Path(__file__).parent.parent.parent / "saved_files.db"
SAVED_FILES_DIR = Path(__file__).parent.parent.parent / "saved_files"

# Ensure saved files directory exists
SAVED_FILES_DIR.mkdir(exist_ok=True)


def get_db_connection():
    """Get a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    return conn


def init_db():
    """Initialize the database schema."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saved_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL,
            device_type TEXT NOT NULL,
            description TEXT,
            file_size INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()


def add_saved_file(
    original_filename: str,
    stored_filename: str,
    device_type: str,
    description: str,
    file_size: int
) -> int:
    """
    Add a new saved file to the database.
    
    Returns:
        The ID of the newly created record
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO saved_files (original_filename, stored_filename, device_type, description, file_size)
        VALUES (?, ?, ?, ?, ?)
    """, (original_filename, stored_filename, device_type, description, file_size))
    
    file_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return file_id


def get_saved_files(device_type: Optional[str] = None) -> List[Dict]:
    """
    Get all saved files, optionally filtered by device type.
    
    Args:
        device_type: Optional filter by 'esp32' or 'fpga'
        
    Returns:
        List of saved file records as dictionaries
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if device_type:
        cursor.execute("""
            SELECT id, original_filename, device_type, description, file_size, created_at
            FROM saved_files
            WHERE device_type = ?
            ORDER BY created_at DESC
        """, (device_type,))
    else:
        cursor.execute("""
            SELECT id, original_filename, device_type, description, file_size, created_at
            FROM saved_files
            ORDER BY created_at DESC
        """)
    
    rows = cursor.fetchall()
    conn.close()
    
    # Convert rows to dictionaries
    return [dict(row) for row in rows]


def get_saved_file(file_id: int) -> Optional[Dict]:
    """Get a specific saved file by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, original_filename, stored_filename, device_type, description, file_size, created_at
        FROM saved_files
        WHERE id = ?
    """, (file_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None


def delete_saved_file(file_id: int) -> bool:
    """
    Delete a saved file from database and filesystem.
    
    Returns:
        True if deleted, False if not found
    """
    # Get file info first
    file_info = get_saved_file(file_id)
    if not file_info:
        return False
    
    # Delete from database
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM saved_files WHERE id = ?", (file_id,))
    conn.commit()
    conn.close()
    
    # Delete physical file
    file_path = SAVED_FILES_DIR / file_info['stored_filename']
    if file_path.exists():
        file_path.unlink()
    
    return True


def get_saved_file_path(file_id: int) -> Optional[Path]:
    """Get the filesystem path for a saved file."""
    file_info = get_saved_file(file_id)
    if not file_info:
        return None
    
    return SAVED_FILES_DIR / file_info['stored_filename']


# Initialize database on module import
init_db()
