#!/usr/bin/env node
// bin/mcp-server.ts — standalone executable entry point for the MCP server,
// so an MCP client config can point at this file directly (`node dist/bin/mcp-server.js`)
// without launching the full Electron GUI. Mirrors how papilio_loader_mcp's
// Python package exposes `server.py` as its own runnable entry point.
import { startStdioMcpServer } from "../main/mcp-server.js";

startStdioMcpServer().catch((err) => {
  console.error(`MCP server failed to start: ${err.message}`);
  process.exit(1);
});
