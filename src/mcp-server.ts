#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { loadFirmware } from "./papilio-loader.js";

/**
 * MCP Server for Papilio FPGA and ESP32 firmware loading
 */
export class PapilioMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "papilio-loader-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: "load_fpga_bitfile",
          description: "Load a bitfile (.bit) to a Papilio FPGA board",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "string",
                description: "Serial port path (e.g., /dev/ttyUSB0 or COM3)",
              },
              filepath: {
                type: "string",
                description: "Path to the .bit file to upload",
              },
            },
            required: ["port", "filepath"],
          },
        },
        {
          name: "load_esp32_firmware",
          description: "Load firmware (.bin) to an ESP32 on a Papilio board",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "string",
                description: "Serial port path (e.g., /dev/ttyUSB0 or COM3)",
              },
              filepath: {
                type: "string",
                description: "Path to the .bin file to upload",
              },
              address: {
                type: "string",
                description: "Flash address (default: 0x1000)",
                default: "0x1000",
              },
            },
            required: ["port", "filepath"],
          },
        },
        {
          name: "list_serial_ports",
          description: "List available serial ports for Papilio boards",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "load_fpga_bitfile": {
            const { port, filepath } = args as { port: string; filepath: string };
            const result = await loadFirmware(port, filepath, "fpga");
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully loaded FPGA bitfile to ${port}: ${result}`,
                },
              ],
            };
          }

          case "load_esp32_firmware": {
            const { port, filepath, address } = args as {
              port: string;
              filepath: string;
              address?: string;
            };
            const result = await loadFirmware(
              port,
              filepath,
              "esp32",
              address || "0x1000"
            );
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully loaded ESP32 firmware to ${port}: ${result}`,
                },
              ],
            };
          }

          case "list_serial_ports": {
            const { SerialPort } = await import("serialport");
            const ports = await SerialPort.list();
            const portList = ports
              .map((p) => `${p.path} - ${p.manufacturer || "Unknown"}`)
              .join("\n");
            return {
              content: [
                {
                  type: "text",
                  text: `Available serial ports:\n${portList}`,
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Papilio Loader MCP Server running on stdio");
  }
}

// Start the MCP server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const mcpServer = new PapilioMCPServer();
  mcpServer.start().catch(console.error);
}
