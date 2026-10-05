import { setStatus } from "./dom.js";

function binFilename(name) {
  return /\.bin$/i.test(name) ? name : `${name}.bin`;
}

export function initSavedFiles(doc, win, validateFile) {
  const api = win.papilioDesktop?.savedFiles;
  if (!api) return { saveBeforeProgramming: async () => {} };
  const panel = doc.getElementById("saved-files-panel");
  const list = doc.getElementById("saved-files-list");
  const status = doc.getElementById("saved-files-status");
  const filter = doc.getElementById("saved-files-filter");
  const dialog = doc.getElementById("saved-file-edit");
  let generation = 0;
  panel.hidden = false;

  async function action(operation) {
    try {
      await operation();
    } catch (err) {
      setStatus(status, err.message, "error");
    }
  }

  async function refresh() {
    const current = ++generation;
    const records = await api.list(filter.value || undefined);
    if (current !== generation) return;
    list.replaceChildren();
    if (!records.length) {
      list.textContent = "No saved files yet. Select a file above and save it to your library.";
    }
    for (const record of records) {
      const card = doc.createElement("div");
      card.className = "saved-file-card";
      const name = doc.createElement("strong");
      name.textContent = record.originalFilename;
      const info = doc.createElement("p");
      info.className = "card-note";
      info.textContent = `${record.deviceType.toUpperCase()} | ${(record.fileSize / 1024).toFixed(1)} KB | ${new Date(record.createdAt).toLocaleString()}`;
      const description = doc.createElement("p");
      description.textContent = record.description;
      const controls = doc.createElement("div");
      controls.className = "flash-row";
      const button = (label, operation) => {
        const btn = doc.createElement("button");
        btn.className = "btn btn-outline";
        btn.textContent = label;
        btn.addEventListener("click", () => action(async () => {
          btn.disabled = true;
          try { await operation(); } finally { btn.disabled = false; }
        }));
        controls.appendChild(btn);
      };
      button("Load", async () => {
        const saved = await api.read(record.id);
        if (!saved) throw new Error("This saved file no longer exists.");
        const file = new win.File([saved.data], binFilename(saved.record.originalFilename), { type: "application/octet-stream" });
        const input = doc.getElementById(`${record.deviceType}-file`);
        const transfer = new win.DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new win.Event("change"));
        doc.getElementById(`${record.deviceType}-save`).checked = false;
        doc.getElementById(`${record.deviceType}-save-name`).value = record.originalFilename;
        doc.getElementById(`${record.deviceType}-save-description`).value = record.description;
        setStatus(status, `Loaded ${record.originalFilename} into the ${record.deviceType.toUpperCase()} form.`, "ok");
      });
      const edit = async (label, value, update) => {
        doc.getElementById("saved-file-edit-label").textContent = label;
        const input = doc.getElementById("saved-file-edit-value");
        input.value = value;
        dialog.returnValue = "";
        const result = new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue), { once: true }));
        dialog.showModal();
        if (await result !== "save") return;
        if (!await update(input.value)) throw new Error("This saved file no longer exists.");
        await refresh();
        setStatus(status, "Saved file updated.", "ok");
      };
      button("Rename", () => edit("Filename", record.originalFilename, (value) => {
        if (!value.trim()) throw new Error("Enter a filename.");
        return api.rename(record.id, binFilename(value.trim()));
      }));
      button("Edit Description", () => edit("Description", record.description, (value) => api.describe(record.id, value)));
      button("Delete", async () => {
        if (!win.confirm(`Delete "${record.originalFilename}" from the library?`)) return;
        if (!await api.delete(record.id)) throw new Error("This saved file no longer exists.");
        await refresh();
        setStatus(status, "Saved file deleted.", "ok");
      });
      card.append(name, info, description, controls);
      list.appendChild(card);
    }
  }

  async function save(type, file = doc.getElementById(`${type}-file`).files[0]) {
    if (!file) throw new Error("Select a file to save first.");
    if (await validateFile(file, type) !== type) throw new Error(`Select a valid ${type.toUpperCase()} .bin file.`);
    const name = binFilename(doc.getElementById(`${type}-save-name`).value.trim() || file.name);
    const description = doc.getElementById(`${type}-save-description`).value;
    await api.add(name, type, description, await file.arrayBuffer());
    doc.getElementById(`${type}-save`).checked = false;
    await refresh();
    setStatus(status, `Saved ${name} to the library.`, "ok");
  }

  for (const type of ["fpga", "esp32"]) {
    doc.getElementById(`${type}-save-fields`).hidden = false;
    const btn = doc.getElementById(`btn-save-${type}`);
    btn.addEventListener("click", () => action(async () => {
      btn.disabled = true;
      try { await save(type); } finally { btn.disabled = false; }
    }));
  }
  filter.addEventListener("change", () => action(refresh));
  const exportButton = doc.getElementById("btn-export-files");
  exportButton.addEventListener("click", () => action(async () => {
    exportButton.disabled = true;
    try {
      const data = await api.exportZip();
      const url = win.URL.createObjectURL(new win.Blob([data], { type: "application/zip" }));
      const link = doc.createElement("a");
      link.href = url;
      link.download = "papilio_saved_files.zip";
      doc.body.appendChild(link);
      link.click();
      link.remove();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
      setStatus(status, "Library exported.", "ok");
    } finally { exportButton.disabled = false; }
  }));
  const importInput = doc.getElementById("import-files");
  importInput.addEventListener("change", () => action(async () => {
    const file = importInput.files[0];
    if (!file) return;
    importInput.disabled = true;
    try {
      const count = await api.importZip(await file.arrayBuffer());
      await refresh();
      setStatus(status, `Imported ${count} file(s).`, "ok");
    } finally {
      importInput.disabled = false;
      importInput.value = "";
    }
  }));
  void action(refresh);
  return {
    saveBeforeProgramming: async (type, file) => {
      if (doc.getElementById(`${type}-save`).checked) await save(type, file);
    },
  };
}
