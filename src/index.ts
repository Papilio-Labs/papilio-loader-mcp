#!/usr/bin/env node
import { PapilioWebServer } from "./web-server.js";
import { PapilioMCPServer } from "./mcp-server.js";

/**
 * Main entry point - can run both web server and MCP server
 */
const args = process.argv.slice(2);
const mode = args[0] || "web";

async function main() {
  if (mode === "mcp") {
    // Run as MCP server (stdio mode)
    const mcpServer = new PapilioMCPServer();
    await mcpServer.start();
  } else if (mode === "web") {
    // Run as web server
    const port = parseInt(args[1] || "3000", 10);
    const webServer = new PapilioWebServer(port);
    webServer.start();
  } else if (mode === "both") {
    // Run both servers
    // Note: MCP server on stdio, web server on HTTP
    const port = parseInt(args[1] || "3000", 10);

    console.error("Starting Papilio Loader in dual mode...");
    console.error("- MCP Server: stdio");
    console.error(`- Web Server: http://localhost:${port}`);

    const webServer = new PapilioWebServer(port);
    webServer.start();

    // Note: In dual mode, MCP via stdio may conflict with web server logs
    // It's recommended to run them separately
  } else {
    console.error("Usage: papilio-loader-mcp [mode] [port]");
    console.error("Modes:");
    console.error("  web [port]  - Run web server (default, port 3000)");
    console.error("  mcp         - Run MCP server on stdio");
    console.error("  both [port] - Run both web and MCP server");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
