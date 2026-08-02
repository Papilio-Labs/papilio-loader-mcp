// dom.js — small DOM helpers shared by both loader-ui pages: log line
// appending and status text/class toggling. Kept framework-free.
export function makeLogger(logEl) {
  return function log(line, kind) {
    if (logEl.tagName === "PRE" || logEl.tagName === "TEXTAREA") {
      logEl.textContent += line.endsWith("\n") ? line : line + "\n";
      logEl.scrollTop = logEl.scrollHeight;
      return;
    }
    // Color-coded div-per-line log (loader page style)
    if (!kind) {
      if (/error|failed|reject/i.test(line)) kind = "error";
      else if (/\bok\b|flashed|success|connected|saved/i.test(line)) kind = "success";
      else kind = "info";
    }
    const div = document.createElement("div");
    div.className = `log-line log-${kind}`;
    div.textContent = line;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  };
}

export function setStatus(el, message, kind) {
  el.textContent = message;
  el.classList.remove("is-error", "is-ok");
  if (kind) el.classList.add(kind === "error" ? "is-error" : "is-ok");
}
