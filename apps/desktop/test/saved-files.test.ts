import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { SavedFilesStore } from "../src/main/saved-files";

let dir: string;
let store: SavedFilesStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "papilio-saved-files-test-"));
  store = new SavedFilesStore(dir);
});
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe("SavedFilesStore", () => {
  it("persists, filters, reads, renames, describes and deletes files", async () => {
    const file = await store.add("core.bin", "fpga", "Original", Buffer.from([1, 2, 3]));
    await store.add("app.bin", "esp32", "", Buffer.from([0xe9]));
    store = new SavedFilesStore(dir);
    expect(await store.list("fpga")).toEqual([file]);
    expect((await store.readFile(file.id))?.data).toEqual(Buffer.from([1, 2, 3]));
    expect(await store.rename(file.id, "new.bin")).toBe(true);
    expect(await store.updateDescription(file.id, "Updated")).toBe(true);
    expect(await store.get(file.id)).toMatchObject({ originalFilename: "new.bin", description: "Updated" });
    expect(await store.delete(file.id)).toBe(true);
    expect(await store.readFile(file.id)).toBeNull();
    expect(await store.rename(file.id, "missing.bin")).toBe(false);
    expect(await store.delete(file.id)).toBe(false);
  });

  it("serializes concurrent writes without losing records or metadata", async () => {
    const files = await Promise.all(Array.from({ length: 12 }, (_, i) => store.add(`core${i}.bin`, "fpga", "", Buffer.from([i]))));
    expect(await store.list()).toHaveLength(12);
    await Promise.all([store.rename(files[0].id, "renamed.bin"), store.updateDescription(files[0].id, "Description")]);
    expect(await store.get(files[0].id)).toMatchObject({ originalFilename: "renamed.bin", description: "Description" });
  });

  it("round-trips exports with duplicate display names and fresh IDs", async () => {
    await store.add("core.bin", "fpga", "First", Buffer.from([1]));
    await store.add("core.bin", "esp32", "Second", Buffer.from([2]));
    const original = await store.list();
    expect(await store.importZip(await store.exportZip())).toBe(2);
    const all = await store.list();
    expect(all).toHaveLength(4);
    expect(new Set(all.map((f) => f.id)).size).toBe(4);
    expect(all.filter((f) => original.some((o) => o.id === f.id))).toHaveLength(2);
    expect(all.filter((f) => f.description === "First")).toHaveLength(2);
  });

  it("imports ZIP exports from the Python loader", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from(JSON.stringify([
      { original_filename: "arcade.bin", device_type: "fpga", description: "Arcade" },
      { original_filename: "app.bin", device_type: "esp32", description: null },
    ])));
    zip.addFile("arcade.bin", Buffer.from([1, 2]));
    zip.addFile("app.bin", Buffer.from([0xe9]));
    expect(await store.importZip(zip.toBuffer())).toBe(2);
    expect(await store.list("fpga")).toMatchObject([{ originalFilename: "arcade.bin", description: "Arcade", fileSize: 2 }]);
    expect((await store.list("esp32"))[0].description).toBe("");
  });

  it("rejects incomplete imports without partially saving files", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from(JSON.stringify([
      { original_filename: "ok.bin", device_type: "fpga" },
      { original_filename: "missing.bin", device_type: "fpga" },
    ])));
    zip.addFile("ok.bin", Buffer.from([1]));
    await expect(store.importZip(zip.toBuffer())).rejects.toThrow("missing");
    expect(await store.list()).toEqual([]);
    expect(await readdir(path.join(dir, "saved_files"))).toEqual([]);
  });

  it("rejects invalid names, types, empty files and malformed archives", async () => {
    await expect(store.add("../bad.bin", "fpga", "", Buffer.from([1]))).rejects.toThrow();
    await expect(store.add("core.bin", "invalid", "", Buffer.from([1]))).rejects.toThrow();
    await expect(store.add("core.bin", "fpga", "", Buffer.alloc(0))).rejects.toThrow("50 MB");
    await expect(store.importZip(new AdmZip().toBuffer())).rejects.toThrow("Papilio");
    expect(await store.list()).toEqual([]);
  });

  it("surfaces corrupt indexes rather than overwriting the library", async () => {
    await store.add("core.bin", "fpga", "", Buffer.from([1]));
    const indexPath = path.join(dir, "saved_files_index.json");
    await writeFile(indexPath, "{invalid");
    await expect(store.list()).rejects.toThrow();
    await expect(store.add("other.bin", "fpga", "", Buffer.from([2]))).rejects.toThrow();
    expect(await readFile(indexPath, "utf8")).toBe("{invalid");
    expect(await readdir(path.join(dir, "saved_files"))).toHaveLength(1);
  });

  it("reports missing file content instead of creating incomplete exports", async () => {
    const file = await store.add("core.bin", "fpga", "", Buffer.from([1]));
    await rm(path.join(dir, "saved_files", file.storedFilename));
    await expect(store.exportZip()).rejects.toThrow();
  });
});
