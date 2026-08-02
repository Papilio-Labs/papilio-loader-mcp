// build.mjs — bundles the two page entry points into single ESM files that
// the copied flash/index.html and loader/index.html reference directly.
// No framework, no dev server magic — just esbuild producing static output
// that can be served by any static file host (matches papilioworks.com's
// existing GitHub Pages deploy).
import { build, context } from "esbuild";

const shared = {
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
};

const entries = [
  { entry: "src/flash-entry.js", outfile: "flash/flash.bundle.js" },
  { entry: "src/loader-entry.js", outfile: "loader/loader.bundle.js" },
];

const watch = process.argv.includes("--watch");

if (watch) {
  for (const { entry, outfile } of entries) {
    const ctx = await context({ ...shared, entryPoints: [entry], outfile });
    await ctx.watch();
  }
  console.log("Watching for changes...");
} else {
  for (const { entry, outfile } of entries) {
    await build({ ...shared, entryPoints: [entry], outfile });
  }
}
