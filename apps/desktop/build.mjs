// build.mjs — bundles the Electron main process, preload script, and the
// standalone MCP server bin into CommonJS (Electron's main process loads
// CJS most reliably across versions/configs) using esbuild. Native modules
// (serialport, electron, adm-zip) are marked external — esbuild bundles JS,
// not native .node addons, and Electron/electron-builder resolve those from
// node_modules at runtime/packaging time instead.
import { build, context } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  external: ["electron", "serialport", "@serialport/*", "adm-zip", "@modelcontextprotocol/sdk"],
};

// Electron's main/preload processes load CommonJS most reliably. The MCP
// server bin, however, is a standalone `node dist/bin/mcp-server.js` script
// with no Electron involvement, and @modelcontextprotocol/sdk ships ESM-only
// — bundling it to CJS would fail at runtime with ERR_REQUIRE_ESM, so that
// one entry point builds as ESM instead.
const entries = [
  { entry: "src/main/index.ts", outfile: "dist/main/index.js", format: "cjs" },
  { entry: "src/preload/index.ts", outfile: "dist/preload/index.js", format: "cjs" },
  { entry: "src/bin/mcp-server.ts", outfile: "dist/bin/mcp-server.mjs", format: "esm" },
];

const watch = process.argv.includes("--watch");

if (watch) {
  for (const { entry, outfile, format } of entries) {
    const ctx = await context({ ...shared, entryPoints: [entry], outfile, format });
    await ctx.watch();
  }
  console.log("Watching for changes...");
} else {
  for (const { entry, outfile, format } of entries) {
    await build({ ...shared, entryPoints: [entry], outfile, format });
  }
}
