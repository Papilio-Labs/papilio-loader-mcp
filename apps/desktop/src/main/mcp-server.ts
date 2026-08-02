// mcp-server.ts — in-process MCP server exposing the exact tool names/
// signatures cataloged from papilio_loader_mcp/server.py, so any MCP client
// already configured against the Python desktop app (e.g. an AI agent) keeps
// working unchanged after switching to this Electron app. Exposed two ways:
// stdio (bin/mcp-server.ts, spawned per-connection by an MCP client) and an
// always-on HTTP transport the Electron main process starts itself and keeps
// alive for as long as the app lives in the tray (see startHttpMcpServer /
// main/index.ts).
//
// Flashing tools reuse @papilio-loader/flasher-core via NodeSerialAdapter —
// the same protocol logic the browser/renderer UI uses, just driven from
// Node instead of WebSerial (no user gesture / renderer required).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import {
  flashEsp32,
  flashFpgaOverSerial,
  SerialLineReader,
  SERIAL_FPGA_TARGET,
} from "@papilio-loader/flasher-core";
import { NodeSerialAdapter } from "./node-serial-adapter.js";
import { discoverOtaDevices, checkDeviceIp } from "./lan-discovery.js";

const RETROCADE_VID = "303a";
const RETROCADE_PID = "1001";

async function resolvePort(explicitPort?: string): Promise<string> {
  if (explicitPort) return explicitPort;
  const ports = await NodeSerialAdapter.listPorts();
  const retrocade = ports.find(
    (p) => p.vendorId?.toLowerCase() === RETROCADE_VID && p.productId?.toLowerCase() === RETROCADE_PID
  );
  if (retrocade) return retrocade.path;
  if (ports.length === 1) return ports[0].path;
  throw new Error(
    ports.length === 0
      ? "No serial ports found — plug in the board."
      : `Multiple serial ports found — pass an explicit "port" (${ports.map((p) => p.path).join(", ")}).`
  );
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "papilio-loader", version: "0.1.0" });

  server.tool("list_serial_ports", "List available serial ports on this machine.", {}, async () => {
    return textResult(await NodeSerialAdapter.listPorts());
  });

  server.tool(
    "get_device_info",
    "Get basic info (path, VID/PID, manufacturer) for a connected board's serial port.",
    { port: z.string().optional(), device_type: z.enum(["esp32", "fpga"]) },
    async ({ port }) => {
      const resolvedPath = await resolvePort(port);
      const ports = await NodeSerialAdapter.listPorts();
      const info = ports.find((p) => p.path === resolvedPath);
      return textResult({ port: resolvedPath, ...info });
    }
  );

  server.tool(
    "get_flash_status",
    "Check whether a board's serial port is currently present/available.",
    { port: z.string().optional(), device_type: z.enum(["esp32", "fpga"]) },
    async ({ port }) => {
      try {
        const resolvedPath = await resolvePort(port);
        return textResult({ connected: true, port: resolvedPath });
      } catch (err) {
        return textResult({ connected: false, error: (err as Error).message });
      }
    }
  );

  server.tool(
    "flash_device",
    "Flash a local firmware/bitstream file to a board over USB serial. " +
      "device_type=esp32 flashes FPGA-Companion firmware (esptool protocol, merged .bin at 0x0). " +
      "device_type=fpga sends the bitstream to a board already running FPGA-Companion firmware " +
      "over its serial passthrough protocol (SPI flash by default).",
    {
      port: z.string().optional(),
      device_type: z.enum(["esp32", "fpga"]),
      file_path: z.string(),
      address: z.string().optional(),
      verify: z.boolean().optional(),
      force: z.boolean().optional(),
    },
    async ({ port, device_type, file_path }) => {
      const resolvedPath = await resolvePort(port);
      const data = new Uint8Array(await readFile(file_path));
      const adapter = new NodeSerialAdapter(resolvedPath);

      try {
        if (device_type === "esp32") {
          const result = await flashEsp32(adapter, data, {
            onLog: () => {},
            onProgress: () => {},
          });
          return textResult({ success: true, ...result });
        }

        await adapter.open({ baudRate: 115200 });
        const reader = new SerialLineReader(adapter);
        try {
          await flashFpgaOverSerial(adapter, reader, SERIAL_FPGA_TARGET["/fpga-update"], data, () => {});
          return textResult({ success: true, target: "flash" });
        } finally {
          await reader.stop();
          await adapter.close();
        }
      } catch (err) {
        return textResult({ success: false, error: (err as Error).message });
      }
    }
  );

  server.tool(
    "discover_ota_devices",
    "Scan the local /24 subnet for boards with the OTA HTTP server (port 3232) reachable.",
    { timeout: z.number().optional(), port: z.number().optional() },
    async ({ timeout, port }) => {
      const devices = await discoverOtaDevices(timeout, port);
      return textResult({ devicesFound: devices.length, devices });
    }
  );

  server.tool(
    "check_device_ip",
    "Check whether a specific IP address has the OTA HTTP server reachable.",
    { ip: z.string(), port: z.number().optional() },
    async ({ ip, port }) => {
      const available = await checkDeviceIp(ip, port);
      return textResult({ ip, available });
    }
  );

  server.tool(
    "flash_device_ota",
    "Flash a local firmware/bitstream file to a board over WiFi OTA (no USB required).",
    {
      ip: z.string(),
      device_type: z.enum(["esp32", "fpga"]),
      file_path: z.string(),
      port: z.number().optional(),
    },
    async ({ ip, device_type, file_path, port }) => {
      const { flashEsp32Ota, flashFpgaOta } = await import("@papilio-loader/flasher-core");
      const data = await readFile(file_path);
      const nodeFetchPoster = {
        post: async (url: string, body: BodyInit) => {
          const resp = await fetch(url, { method: "POST", body });
          if (!resp.ok) throw new Error(`OTA HTTP ${resp.status}`);
          return resp.text();
        },
      };

      const responseText =
        device_type === "esp32"
          ? await flashEsp32Ota(nodeFetchPoster, ip, new Uint8Array(data), () => {}, port)
          : await flashFpgaOta(nodeFetchPoster, ip, "/fpga-update", data as unknown as BodyInit, () => {}, port);

      return textResult({ success: true, response: responseText });
    }
  );

  return server;
}

export async function startStdioMcpServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export interface HttpMcpServerHandle {
  port: number;
  close(): Promise<void>;
}

// Runs the MCP server over the Streamable HTTP transport on a fixed local
// port so any MCP-http client can connect at will, without needing to spawn
// a process per-session the way the stdio transport requires. Intended to be
// started once when the Electron app launches and kept running for as long
// as it lives in the tray (main/index.ts owns the start/stop lifecycle).
export async function startHttpMcpServer(port: number): Promise<HttpMcpServerHandle> {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
  await server.connect(transport);

  const httpServer: HttpServer = createHttpServer((req, res) => {
    if (req.url === "/mcp") {
      void transport.handleRequest(req, res);
      return;
    }
    res.writeHead(404).end("Not found");
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, "127.0.0.1", resolve);
  });

  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      }),
  };
}
