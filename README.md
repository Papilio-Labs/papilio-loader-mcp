# Papilio Loader MCP

A dual-mode server for loading FPGA bitfiles and ESP32 firmware to Papilio boards. Provides both:
- **MCP Server**: Integration with Claude and other AI assistants via Model Context Protocol
- **Web Interface**: Browser-based file upload for easy firmware flashing

## Features

- 🚀 Upload FPGA bitfiles (.bit) to Papilio boards
- 📡 Flash ESP32 firmware (.bin) via serial connection
- 🌐 Beautiful web interface with drag-and-drop support
- 🤖 MCP tools for AI assistant integration
- 🔌 Automatic serial port detection
- 📦 Support for multiple device types on the same board

## Installation

### Prerequisites

1. **Node.js** (v18 or higher)
2. **papilio-prog** - For FPGA programming
   ```bash
   # Installation varies by platform
   # See: https://github.com/GadgetFactory/Papilio-Loader
   ```
3. **esptool.py** - For ESP32 firmware flashing
   ```bash
   pip install esptool
   ```

### Install Dependencies

```bash
npm install
npm run build
```

## Usage

### Web Interface Mode (Default)

Start the web server for browser-based uploads:

```bash
npm start
# or
node dist/index.js web 3000
```

Then open your browser to `http://localhost:3000`

#### Using the Web Interface

1. **Select Device Type**: Click on either "FPGA (.bit)" or "ESP32 (.bin)" tab
2. **Choose Serial Port**: Select your Papilio board's serial port from the dropdown
3. **Upload File**:
   - Click the upload area to browse for a file
   - Or drag and drop your .bit or .bin file
4. **Flash**: Click "Upload to FPGA" or "Upload to ESP32"

### MCP Server Mode

Run as an MCP server for AI assistant integration:

```bash
node dist/index.js mcp
```

#### MCP Configuration

Add to your MCP settings (e.g., Claude Desktop config):

```json
{
  "mcpServers": {
    "papilio-loader": {
      "command": "node",
      "args": ["/path/to/papilio-loader-mcp/dist/index.js", "mcp"]
    }
  }
}
```

#### Available MCP Tools

1. **load_fpga_bitfile**
   - Load a .bit file to FPGA
   - Parameters: `port` (serial port), `filepath` (path to .bit file)

2. **load_esp32_firmware**
   - Flash .bin firmware to ESP32
   - Parameters: `port` (serial port), `filepath` (path to .bin file), `address` (flash address, default: 0x1000)

3. **list_serial_ports**
   - List all available serial ports
   - No parameters required

## API Endpoints

When running in web mode, the following REST API endpoints are available:

### GET /api/ports
Get list of available serial ports

**Response:**
```json
{
  "success": true,
  "ports": [
    {
      "path": "/dev/ttyUSB0",
      "manufacturer": "FTDI",
      "serialNumber": "A1B2C3D4",
      "vendorId": "0403",
      "productId": "6001"
    }
  ]
}
```

### POST /api/upload/fpga
Upload and flash FPGA bitfile

**Request:**
- Method: POST (multipart/form-data)
- Fields:
  - `file`: .bit file
  - `port`: Serial port path

**Response:**
```json
{
  "success": true,
  "message": "FPGA bitfile loaded successfully to /dev/ttyUSB0",
  "details": "..."
}
```

### POST /api/upload/esp32
Upload and flash ESP32 firmware

**Request:**
- Method: POST (multipart/form-data)
- Fields:
  - `file`: .bin file
  - `port`: Serial port path
  - `address`: Flash address (optional, default: 0x1000)

**Response:**
```json
{
  "success": true,
  "message": "ESP32 firmware loaded successfully to /dev/ttyUSB0",
  "details": "..."
}
```

### GET /api/health
Health check endpoint

## Project Structure

```
papilio-loader-mcp/
├── src/
│   ├── index.ts           # Main entry point
│   ├── mcp-server.ts      # MCP server implementation
│   ├── web-server.ts      # Express web server
│   └── papilio-loader.ts  # Firmware loading logic
├── public/
│   ├── index.html         # Web UI
│   └── app.js            # Frontend JavaScript
├── uploads/              # Temporary upload storage
├── package.json
└── tsconfig.json
```

## Development

```bash
# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Run web server
npm start

# Run MCP server
node dist/index.js mcp
```

## Troubleshooting

### "Command 'papilio-prog' not found"
Install papilio-prog for FPGA support. See [Papilio Loader](https://github.com/GadgetFactory/Papilio-Loader)

### "Command 'esptool.py' not found"
Install esptool: `pip install esptool`

### Serial port access denied
On Linux, add your user to the dialout group:
```bash
sudo usermod -a -G dialout $USER
# Log out and back in for changes to take effect
```

### No serial ports detected
- Check that your Papilio board is connected
- Verify USB cable supports data transfer
- Check that drivers are installed (FTDI drivers for most Papilio boards)

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.
