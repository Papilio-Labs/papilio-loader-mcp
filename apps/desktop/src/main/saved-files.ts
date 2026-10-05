// saved-files.ts — filesystem-backed saved-files library (Node port of
// papilio_loader_mcp/database.py + the /web/saved-files endpoints in api.py).
// Uses a plain JSON index instead of SQLite to avoid a native/binary Node
// dependency in the packaged Electron app; field names mirror the Python
// schema (original_filename -> originalFilename, etc.) so the desktop UI's
// saved-files panel maps 1:1 onto the existing feature docs.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { z } from "zod";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const filenameSchema = z.string().trim().min(1).max(255).refine(
  (name) => !/[\\/\x00-\x1f]/.test(name) && name !== "." && name !== "..",
  "Filename must not contain path separators or control characters."
);
const recordSchema = z.object({
  id: z.string().min(1),
  originalFilename: filenameSchema,
  storedFilename: filenameSchema,
  deviceType: z.enum(["fpga", "esp32"]),
  description: z.string(),
  fileSize: z.number().int().min(1).max(MAX_FILE_SIZE),
  createdAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid creation date."),
});
const indexSchema = z.object({ files: z.array(recordSchema) });
const legacySchema = z.array(z.object({
  original_filename: filenameSchema,
  device_type: z.enum(["fpga", "esp32"]),
  description: z.string().nullable().optional(),
}));

export interface SavedFileRecord {
  id: string;
  originalFilename: string;
  storedFilename: string;
  deviceType: string;
  description: string;
  fileSize: number;
  createdAt: string;
}

interface SavedFilesIndex {
  files: SavedFileRecord[];
}

export class SavedFilesStore {
  private readonly dir: string;
  private readonly indexPath: string;
  private readonly filesDir: string;
  private pendingMutation: Promise<unknown> = Promise.resolve();

  constructor(userDataDir: string) {
    this.dir = userDataDir;
    this.indexPath = path.join(userDataDir, "saved_files_index.json");
    this.filesDir = path.join(userDataDir, "saved_files");
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await mkdir(this.filesDir, { recursive: true });
  }

  private async readIndex(): Promise<SavedFilesIndex> {
    await this.ensureDirs();
    if (!existsSync(this.indexPath)) return { files: [] };
    return indexSchema.parse(JSON.parse(await readFile(this.indexPath, "utf8")));
  }

  private async writeIndex(index: SavedFilesIndex): Promise<void> {
    const temporary = `${this.indexPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(index, null, 2), "utf8");
      await rename(temporary, this.indexPath);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pendingMutation.then(operation);
    this.pendingMutation = result.then(() => undefined, () => undefined);
    return result;
  }

  async add(
    originalFilename: string,
    deviceType: string,
    description: string,
    data: Buffer
  ): Promise<SavedFileRecord> {
    return this.mutate(() => this.addRecord(originalFilename, deviceType, description, data));
  }

  private async addRecord(originalFilename: string, deviceType: string, description: string, data: Buffer): Promise<SavedFileRecord> {
    originalFilename = filenameSchema.parse(originalFilename);
    deviceType = z.enum(["fpga", "esp32"]).parse(deviceType);
    description = z.string().parse(description);
    if (!data.byteLength || data.byteLength > MAX_FILE_SIZE) {
      throw new Error("Files must contain between 1 byte and 50 MB.");
    }
    await this.ensureDirs();
    const index = await this.readIndex();
    const id = randomUUID();
    const storedFilename = `${id}${path.extname(originalFilename)}`;
    await writeFile(path.join(this.filesDir, storedFilename), data);

    const record: SavedFileRecord = {
      id,
      originalFilename,
      storedFilename,
      deviceType,
      description,
      fileSize: data.byteLength,
      createdAt: new Date().toISOString(),
    };

    index.files.push(record);
    try {
      await this.writeIndex(index);
    } catch (err) {
      await rm(path.join(this.filesDir, storedFilename), { force: true });
      throw err;
    }
    return record;
  }

  async list(deviceType?: string): Promise<SavedFileRecord[]> {
    const index = await this.readIndex();
    const files = deviceType ? index.files.filter((f) => f.deviceType === deviceType) : index.files;
    return [...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<SavedFileRecord | null> {
    const index = await this.readIndex();
    return index.files.find((f) => f.id === id) ?? null;
  }

  async readFile(id: string): Promise<{ record: SavedFileRecord; data: Buffer } | null> {
    const record = await this.get(id);
    if (!record) return null;
    const data = await readFile(path.join(this.filesDir, record.storedFilename));
    return { record, data };
  }

  async rename(id: string, newOriginalFilename: string): Promise<boolean> {
    return this.mutate(async () => {
      const name = filenameSchema.parse(newOriginalFilename);
      const index = await this.readIndex();
      const record = index.files.find((f) => f.id === id);
      if (!record) return false;
      record.originalFilename = name;
      await this.writeIndex(index);
      return true;
    });
  }

  async updateDescription(id: string, description: string): Promise<boolean> {
    return this.mutate(async () => {
      const index = await this.readIndex();
      const record = index.files.find((f) => f.id === id);
      if (!record) return false;
      record.description = z.string().parse(description);
      await this.writeIndex(index);
      return true;
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.mutate(async () => {
      const index = await this.readIndex();
      const recordIndex = index.files.findIndex((f) => f.id === id);
      if (recordIndex === -1) return false;
      const [record] = index.files.splice(recordIndex, 1);
      await this.writeIndex(index);
      await rm(path.join(this.filesDir, record.storedFilename), { force: true });
      return true;
    });
  }

  async exportZip(): Promise<Buffer> {
    return this.mutate(() => this.createArchive());
  }

  private async createArchive(): Promise<Buffer> {
    const index = await this.readIndex();
    const zip = new AdmZip();
    zip.addFile("index.json", Buffer.from(JSON.stringify(index, null, 2), "utf8"));
    for (const record of index.files) {
      const data = await readFile(path.join(this.filesDir, record.storedFilename));
      zip.addFile(`saved_files/${record.storedFilename}`, data);
    }
    return zip.toBuffer();
  }

  async importZip(zipData: Buffer): Promise<number> {
    return this.mutate(() => this.importArchive(zipData));
  }

  private async importArchive(zipData: Buffer): Promise<number> {
    if (zipData.byteLength > MAX_FILE_SIZE) throw new Error("ZIP archives must not exceed 50 MB.");
    await this.ensureDirs();
    const zip = new AdmZip(zipData);
    const indexEntry = zip.getEntry("index.json");
    const legacyEntry = zip.getEntry("manifest.json");
    if (!indexEntry && !legacyEntry) throw new Error("Not a Papilio saved-files export (missing index.json or manifest.json).");
    const records = indexEntry
      ? indexSchema.parse(JSON.parse(zip.readAsText(indexEntry))).files.map((record) => ({
        ...record, entryName: `saved_files/${record.storedFilename}`,
      }))
      : legacySchema.parse(JSON.parse(zip.readAsText(legacyEntry!))).map((record) => ({
        originalFilename: record.original_filename,
        deviceType: record.device_type,
        description: record.description ?? "",
        createdAt: new Date().toISOString(),
        entryName: record.original_filename,
      }));
    let totalSize = 0;
    const incoming = records.map((record) => {
      const entry = zip.getEntry(record.entryName);
      if (!entry || entry.isDirectory) throw new Error(`Archive is missing ${record.originalFilename}.`);
      totalSize += entry.header.size;
      if (entry.header.size < 1 || totalSize > MAX_FILE_SIZE) throw new Error("Imported files must be nonempty and total at most 50 MB.");
      const data = entry.getData();
      const id = randomUUID();
      return {
        record: {
          id,
          originalFilename: record.originalFilename,
          deviceType: record.deviceType,
          description: record.description,
          createdAt: record.createdAt,
          storedFilename: `${id}${path.extname(record.originalFilename)}`,
          fileSize: data.byteLength,
        },
        data,
      };
    });
    const index = await this.readIndex();
    const written: string[] = [];
    try {
      for (const { record, data } of incoming) {
        const target = path.join(this.filesDir, record.storedFilename);
        written.push(target);
        await writeFile(target, data);
        index.files.push(record);
      }
      await this.writeIndex(index);
    } catch (err) {
      await Promise.all(written.map((file) => rm(file, { force: true })));
      throw err;
    }
    return incoming.length;
  }
}
