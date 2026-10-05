import electron from "electron";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const userData = await mkdtemp(path.join(os.tmpdir(), "papilio-desktop-smoke-"));
const env = { ...process.env, PAPILIO_SMOKE_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
try {
  const testFile = process.argv.includes("--layout") ? "./layout.cjs" : "./smoke.cjs";
  const child = spawn(electron, [fileURLToPath(new URL(testFile, import.meta.url))], { env, stdio: "inherit" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, 60000);
  try {
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    process.exitCode = timedOut ? 1 : (code ?? 1);
    if (timedOut) console.error("Electron smoke test timed out.");
  } finally {
    clearTimeout(timer);
  }
} finally {
  await rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
