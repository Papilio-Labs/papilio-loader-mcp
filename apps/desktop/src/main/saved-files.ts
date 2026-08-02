// saved-files.ts — filesystem-backed saved-files library (Node port of
// papilio_loader_mcp/database.py + the /web/saved-files endpoints in api.py).
// Uses a plain JSON index instead of SQLite to avoid a native/binary Node
// dependency in the packaged Electron app; field names mirror the Python
// schema (original_filename -> originalFilename, etc.) so the desktop UI's
// saved-files panel maps 1:1 onto the existing feature docs.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

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
    try {
      return JSON.parse(await readFile(this.indexPath, "utf8"));
    } catch {
      return { files: [] };
    }
  }

  private async writeIndex(index: SavedFilesIndex): Promise<void> {
    await writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf8");
  }

  async add(
    originalFilename: string,
    deviceType: string,
    description: string,
    data: Buffer
  ): Promise<SavedFileRecord> {
    await this.ensureDirs();
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

    const index = await this.readIndex();
    index.files.push(record);
    await this.writeIndex(index);
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
    const index = await this.readIndex();
    const record = index.files.find((f) => f.id === id);
    if (!record) return false;
    record.originalFilename = newOriginalFilename;
    await this.writeIndex(index);
    return true;
  }

  async updateDescription(id: string, description: string): Promise<boolean> {
    const index = await this.readIndex();
    const record = index.files.find((f) => f.id === id);
    if (!record) return false;
    record.description = description;
    await this.writeIndex(index);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const index = await this.readIndex();
    const recordIndex = index.files.findIndex((f) => f.id === id);
    if (recordIndex === -1) return false;
    const [record] = index.files.splice(recordIndex, 1);
    await this.writeIndex(index);
    await rm(path.join(this.filesDir, record.storedFilename), { force: true });
    return true;
  }

  async exportZip(): Promise<Buffer> {
    const index = await this.readIndex();
    const zip = new AdmZip();
    zip.addFile("index.json", Buffer.from(JSON.stringify(index, null, 2), "utf8"));
    for (const record of index.files) {
      const filePath = path.join(this.filesDir, record.storedFilename);
      if (existsSync(filePath)) {
        zip.addLocalFile(filePath, "saved_files");
      }
    }
    return zip.toBuffer();
  }

  async importZip(zipData: Buffer): Promise<number> {
    await this.ensureDirs();
    const zip = new AdmZip(zipData);
    const indexEntry = zip.getEntry("index.json");
    if (!indexEntry) throw new Error("Not a valid Papilio saved-files export (missing index.json).");
    const imported: SavedFilesIndex = JSON.parse(zip.readAsText(indexEntry));

    const index = await this.readIndex();
    let importedCount = 0;
    for (const record of imported.files) {
      // Re-key on import to avoid clobbering an existing file that happens
      // to share an id/filename with one already in this library.
      const newId = randomUUID();
      const ext = path.extname(record.storedFilename);
      const newStoredFilename = `${newId}${ext}`;
      const entry = zip.getEntry(`saved_files/${record.storedFilename}`);
      if (!entry) continue;
      await writeFile(path.join(this.filesDir, newStoredFilename), entry.getData());
      index.files.push({ ...record, id: newId, storedFilename: newStoredFilename });
      importedCount++;
    }
    await this.writeIndex(index);
    return importedCount;
  }
}
