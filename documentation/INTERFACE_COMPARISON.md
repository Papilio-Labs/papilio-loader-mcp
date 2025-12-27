# Interface Comparison

## Three Ways to Access Papilio Loader

| Feature | Web Interface | MCP Server | REST API |
|---------|--------------|------------|----------|
| **URL** | `/web/*` | `/sse`, `/messages/` | `/ports`, `/device/*`, `/flash/*` |
| **Authentication** | Session (username/password) | None (local only) | Optional API Key |
| **Use Case** | Manual device flashing by humans | AI assistant integration | Programmatic access |
| **Client** | Web browser | Claude Desktop, MCP clients | curl, scripts, apps |
| **File Upload** | ✅ Browser form | ✅ Base64 encoded | ✅ multipart/form-data |
| **Real-time UI** | ✅ Yes | N/A | N/A |
| **Port Detection** | ✅ Auto-refresh | ✅ List ports tool | ✅ GET /ports |
| **Device Info** | Via MCP tools | ✅ Native support | ✅ POST /device/info |
| **Flash FPGA** | ✅ Web form | ✅ flash_fpga_device tool | ✅ POST /flash/upload |
| **Flash ESP32** | ✅ Web form | ✅ flash_esp_device tool | ✅ POST /flash/upload |
| **Verify After Flash** | ✅ Checkbox | ✅ Parameter | ✅ Parameter |
| **Status Logging** | ✅ Real-time UI | ✅ Tool responses | ✅ JSON responses |

## When to Use Each Interface

### 🌐 Web Interface
**Best for**: Manual uploads, testing, end users, demonstrations

**Pros**:
- Visual feedback
- No technical knowledge required
- Real-time status updates
- Easy to use

**Cons**:
- Manual process
- Requires browser

**Example**:
1. Open browser to http://localhost:8000
2. Login with credentials
3. Select port and file
4. Click "Flash"

---

### 🤖 MCP Server
**Best for**: AI-assisted workflows, Claude Desktop integration

**Pros**:
- Natural language commands
- AI can analyze device info
- Intelligent error handling
- Context-aware operations

**Cons**:
- Requires MCP client
- Less control over low-level details

**Example**:
```
You: "Flash the FPGA on COM4 with my_bitstream.bin"
Claude: [Uses MCP tools to flash the device]
```

---

### 🔧 REST API
**Best for**: Automation, CI/CD pipelines, custom applications

**Pros**:
- Scriptable
- Integrate with build systems
- No UI overhead
- Programmatic control

**Cons**:
- Requires API key (optional)
- Manual error handling
- No visual feedback

**Example**:
```bash
curl -X POST http://localhost:8000/flash/upload \
  -F "file=@firmware.bin" \
  -F "port=COM4" \
  -F "device_type=esp32" \
  -F "address=0x1000" \
  -H "X-API-Key: your-api-key"
```

---

## Running All Three Simultaneously

The combined server runs all three interfaces at once:

```powershell
.\start.ps1
```

**Endpoints Available**:
- Web: http://localhost:8000/web/login
- MCP: http://localhost:8000/sse
- API: http://localhost:8000/docs

All three share the same backend tools and device access!

---

## Configuration

| Setting | Environment Variable | Default | Affects |
|---------|---------------------|---------|---------|
| Port | `PAPILIO_PORT` | `8000` | All |
| Web Username | `PAPILIO_WEB_USERNAME` | `admin` | Web only |
| Web Password | `PAPILIO_WEB_PASSWORD` | `admin` | Web only |
| Session Secret | `PAPILIO_SESSION_SECRET_KEY` | `change-this...` | Web only |
| API Key | `PAPILIO_API_KEY` | `None` | REST API only |
| CORS Origins | `PAPILIO_CORS_ORIGINS` | `["*"]` | Web + API |
| Max Upload Size | `PAPILIO_MAX_UPLOAD_SIZE` | `52428800` (50MB) | All |

---

## Security Model

```
┌─────────────────────────────────────────┐
│         Combined Server (Port 8000)     │
├─────────────────────────────────────────┤
│                                         │
│  Web Interface (/web/*)                 │
│  ├─ Session-based auth                  │
│  ├─ Cookie: session_id                  │
│  └─ 24-hour timeout                     │
│                                         │
│  MCP Interface (/sse, /messages/)       │
│  ├─ No authentication                   │
│  └─ Designed for local AI assistants    │
│                                         │
│  REST API (/ports, /device/*, /flash/*) │
│  ├─ Optional API key                    │
│  └─ Header: X-API-Key                   │
│                                         │
└─────────────────────────────────────────┘
```

**Note**: Each interface has independent authentication suitable for its use case.

---

## Example Workflows

### Workflow 1: Manual Testing (Web)
1. Developer opens web browser
2. Logs in to web interface
3. Selects device and file
4. Clicks "Flash"
5. Monitors progress in real-time

### Workflow 2: AI-Assisted Development (MCP)
1. Developer asks Claude to flash device
2. Claude uses MCP tools to:
   - List available ports
   - Get device info
   - Flash firmware
   - Verify results
3. Developer gets natural language response

### Workflow 3: CI/CD Pipeline (REST API)
1. Build system compiles firmware
2. Script uploads firmware via REST API
3. Device is automatically flashed
4. Script parses JSON response
5. Pipeline continues based on result

---

## Summary

✅ **One Server, Three Interfaces**  
✅ **All Running Simultaneously**  
✅ **Independent Authentication**  
✅ **Shared Backend Tools**  
✅ **Flexible for Any Use Case**

Choose the interface that best fits your workflow!
