"""Quick test to verify the web interface setup."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

def test_imports():
    """Test that all required modules can be imported."""
    print("Testing imports...")
    
    try:
        from papilio_loader_mcp.config import get_config
        print("✓ Config module imported")
        
        from papilio_loader_mcp.api import api
        print("✓ API module imported")
        
        from papilio_loader_mcp.server import app as mcp_app
        print("✓ MCP server imported")
        
        import starlette.middleware.sessions
        print("✓ Session middleware available")
        
        # Test config
        config = get_config()
        print(f"✓ Config loaded - Web username: {config.web_username}")
        print(f"✓ Config loaded - Web password: {config.web_password}")
        print(f"✓ Config loaded - Port: {config.port}")
        
        # Check templates exist
        template_dir = Path(__file__).parent / "templates"
        login_template = template_dir / "login.html"
        upload_template = template_dir / "upload.html"
        
        if login_template.exists():
            print(f"✓ Login template exists: {login_template}")
        else:
            print(f"✗ Login template missing: {login_template}")
            
        if upload_template.exists():
            print(f"✓ Upload template exists: {upload_template}")
        else:
            print(f"✗ Upload template missing: {upload_template}")
        
        print("\n✅ All imports successful!")
        print("\nReady to start the server with:")
        print("  python start_combined_server.py")
        print("\nOr use the convenience script:")
        print("  .\\start.ps1")
        
        return True
        
    except ImportError as e:
        print(f"\n❌ Import error: {e}")
        print("\nPlease run: uv pip install -e .")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False


if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)
