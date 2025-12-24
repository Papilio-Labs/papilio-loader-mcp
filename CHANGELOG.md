# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-24

### Added

#### Web Interface
- Browser-based file upload interface with drag-and-drop support
- Responsive UI with gradient design and modern styling
- Real-time feedback with loading indicators and status alerts
- Separate upload forms for FPGA (.bit) and ESP32 (.bin) files
- Automatic serial port detection and refresh functionality
- File validation to accept only .bit and .bin files
- Visual file information display showing filename and size

#### MCP Server
- Model Context Protocol server implementation for AI assistant integration
- Three MCP tools:
  - `load_fpga_bitfile`: Upload bitfiles to FPGA boards
  - `load_esp32_firmware`: Flash firmware to ESP32 chips
  - `list_serial_ports`: Detect and list available serial ports
- Stdio transport for seamless integration with Claude Desktop and other MCP clients

#### REST API
- Express.js web server with CORS support
- Endpoints:
  - `GET /api/ports`: List available serial ports with device information
  - `POST /api/upload/fpga`: Upload and flash FPGA bitfiles
  - `POST /api/upload/esp32`: Upload and flash ESP32 firmware with configurable flash address
  - `GET /api/health`: Health check endpoint
- Multer middleware for secure file upload handling
- File size limits (50MB max) and type validation

#### Core Functionality
- Firmware loading abstraction supporting both FPGA and ESP32 devices
- Integration with papilio-prog for FPGA programming
- Integration with esptool.py for ESP32 firmware flashing
- Comprehensive error handling and user-friendly error messages
- File existence validation before firmware operations

#### Infrastructure
- TypeScript configuration with strict type checking
- Dual-mode architecture: web server, MCP server, or both
- Configurable web server port (default: 3000)
- Automatic TypeScript compilation on npm install
- Organized project structure with separation of concerns

#### Documentation
- Comprehensive README with:
  - Feature overview
  - Installation instructions for all prerequisites
  - Usage guides for both web and MCP modes
  - API documentation with request/response examples
  - MCP configuration examples
  - Troubleshooting section
  - Development guidelines
- Code comments and JSDoc documentation throughout

### Technical Details

#### Dependencies
- @modelcontextprotocol/sdk: ^1.0.4
- express: ^4.18.2
- multer: ^1.4.5-lts.1
- cors: ^2.8.5
- serialport: ^12.0.0

#### Development Dependencies
- typescript: ^5.3.3
- @types/node, @types/express, @types/multer, @types/cors

#### File Structure
```
papilio-loader-mcp/
├── src/
│   ├── index.ts           - Main entry point with mode selection
│   ├── mcp-server.ts      - MCP server implementation
│   ├── web-server.ts      - Express web server
│   └── papilio-loader.ts  - Firmware loading logic
├── public/
│   ├── index.html         - Web UI interface
│   └── app.js            - Frontend JavaScript
├── uploads/              - Temporary upload storage
└── dist/                 - Compiled JavaScript output
```

### Notes

- Requires papilio-prog to be installed for FPGA functionality
- Requires esptool.py to be installed for ESP32 functionality
- Serial port access may require additional permissions on Linux (dialout group)
- Designed to preserve MCP functionality while adding web capabilities
- Both modes can run independently or together

## [Unreleased]

### Planned
- WebSocket support for real-time upload progress
- Support for additional board types
- Firmware verification after upload
- Upload history and logging
- Multi-file batch uploads
- Custom baud rate configuration for ESP32
