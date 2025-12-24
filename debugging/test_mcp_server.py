"""
Test the MCP server by listing tools and flashing test files
"""
import asyncio
import json
from pathlib import Path

# MCP client setup
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def test_mcp_server():
    """Test MCP server capabilities"""
    
    # Server path - use Python module
    server_params = StdioServerParameters(
        command="python",
        args=["-m", "papilio_loader_mcp.server"],
        env=None
    )
    
    print("=" * 70)
    print("Testing Papilio Loader MCP Server")
    print("=" * 70)
    
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize the session
            await session.initialize()
            
            # List available tools
            print("\n1. Listing available MCP tools...")
            print("-" * 70)
            tools = await session.list_tools()
            for tool in tools.tools:
                print(f"\n✓ {tool.name}")
                print(f"  {tool.description}")
            
            # Test listing serial ports
            print("\n\n2. Testing list_serial_ports...")
            print("-" * 70)
            result = await session.call_tool("list_serial_ports", {})
            ports_data = json.loads(result.content[0].text)
            print(json.dumps(ports_data, indent=2))
            
            # Test flashing FPGA (if test file exists)
            fpga_bin = Path(__file__).parent / "papilio_arcade_template.bin"
            if fpga_bin.exists():
                print("\n\n3. Testing flash_device (FPGA)...")
                print("-" * 70)
                result = await session.call_tool("flash_device", {
                    "port": "COM4",
                    "device_type": "fpga",
                    "file_path": str(fpga_bin),
                    "verify": False
                })
                flash_result = json.loads(result.content[0].text)
                print(f"Success: {flash_result['success']}")
                if flash_result['success']:
                    print(f"Device: {flash_result['device_type']}")
                    print(f"Port: {flash_result['port']}")
                    print(f"File: {Path(flash_result['file']).name}")
                    print(f"Tool: {flash_result['tool']}")
                else:
                    print(f"Error: {flash_result.get('error', 'Unknown error')}")
            
            # Test flashing ESP32 (if test file exists)
            esp32_bin = Path(__file__).parent / "firmware.bin"
            if esp32_bin.exists():
                print("\n\n4. Testing flash_device (ESP32)...")
                print("-" * 70)
                result = await session.call_tool("flash_device", {
                    "port": "COM4",
                    "device_type": "esp32",
                    "file_path": str(esp32_bin),
                    "address": "0x10000",
                    "verify": False
                })
                flash_result = json.loads(result.content[0].text)
                print(f"Success: {flash_result['success']}")
                if flash_result['success']:
                    print(f"Device: {flash_result['device_type']}")
                    print(f"Port: {flash_result['port']}")
                    print(f"File: {Path(flash_result['file']).name}")
                    print(f"Address: {flash_result['address']}")
                else:
                    print(f"Error: {flash_result.get('error', 'Unknown error')}")
            
            print("\n" + "=" * 70)
            print("MCP Server Test Complete!")
            print("=" * 70)

if __name__ == "__main__":
    asyncio.run(test_mcp_server())
