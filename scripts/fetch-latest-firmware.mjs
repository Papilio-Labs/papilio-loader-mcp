// fetch-latest-firmware.mjs — downloads the latest FPGA-Companion release's
// merged ESP32 binary and writes it (plus a small manifest) into
// apps/web/getting-started/firmware/ so the Getting Started page can flash it
// with no manual download step.
//
// This must run server-side (CI or a local dev machine) — GitHub only sends
// CORS headers on the release-metadata API, not on the binary asset itself,
// so the browser can never fetch it directly. Runs before `esbuild` builds
// apps/web; the firmware/ directory it writes to is gitignored and is not
// meant to be committed to this repo — only to the deployed static site.

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RELEASES_API = "https://api.github.com/repos/Papilio-Retrocade/FPGA-Companion/releases/latest";
const ASSET_SUFFIX = "-merged.bin";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(scriptDir, "..", "apps", "web", "getting-started", "firmware");

async function main() {
  console.log(`Fetching latest release metadata from ${RELEASES_API}...`);
  const releaseResp = await fetch(RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "papilio-loader-mcp-fetch-latest-firmware",
    },
  });
  if (!releaseResp.ok) {
    throw new Error(`GitHub releases API returned HTTP ${releaseResp.status}`);
  }
  const release = await releaseResp.json();

  const asset = (release.assets || []).find((a) => a.name.endsWith(ASSET_SUFFIX));
  if (!asset) {
    throw new Error(`No asset ending in "${ASSET_SUFFIX}" found on release ${release.tag_name}`);
  }

  console.log(`Downloading ${asset.name} (${asset.size} bytes) from ${release.tag_name}...`);
  const assetResp = await fetch(asset.browser_download_url);
  if (!assetResp.ok) {
    throw new Error(`Asset download returned HTTP ${assetResp.status}`);
  }
  const bytes = new Uint8Array(await assetResp.arrayBuffer());

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, asset.name), bytes);

  const manifest = {
    version: release.tag_name,
    fileName: asset.name,
    size: bytes.length,
    publishedAt: release.published_at,
    sourceUrl: asset.browser_download_url,
    fetchedAt: new Date().toISOString(),
  };
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`Wrote ${manifest.fileName} + manifest.json to ${outDir}`);
}

main().catch((err) => {
  console.error(`fetch-latest-firmware failed: ${err.message}`);
  process.exit(1);
});
