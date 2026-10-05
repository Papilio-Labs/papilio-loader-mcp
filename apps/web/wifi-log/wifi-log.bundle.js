// ../../packages/loader-ui/src/wifi-log.js
var foregrounds = ["#4e4e4e", "#f85149", "#3fb950", "#e6a817", "#79c0ff", "#d2a8ff", "#56d4dd", "#c8c8c8"];
var brights = ["#6e7681", "#ff7b72", "#56d364", "#e3b341", "#a5d6ff", "#f778ba", "#76e3ea", "#f0f6fc"];
var backgrounds = ["#1a1a1a", "#6e1c1c", "#1a3b2a", "#3b2d00", "#0d2744", "#2d1b47", "#0d3035", "#3a3a3a"];
function appendAnsiText(element, text) {
  let color = "", background = "", bold = false;
  const parts = text.split(/\x1b\[([0-9;]*)m/);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (!parts[i]) continue;
      const span = element.ownerDocument.createElement("span");
      span.textContent = parts[i];
      span.style.color = color;
      span.style.backgroundColor = background;
      span.style.fontWeight = bold ? "bold" : "";
      element.appendChild(span);
    } else {
      for (const code of (parts[i] || "0").split(";").map(Number)) {
        if (code === 0) {
          color = "";
          background = "";
          bold = false;
        } else if (code === 1) bold = true;
        else if (code === 22) bold = false;
        else if (code >= 30 && code <= 37) color = foregrounds[code - 30];
        else if (code >= 90 && code <= 97) color = brights[code - 90];
        else if (code >= 40 && code <= 47) background = backgrounds[code - 40];
        else if (code >= 100 && code <= 107) background = backgrounds[code - 100];
        else if (code === 39) color = "";
        else if (code === 49) background = "";
      }
    }
  }
}
function initWifiLogMonitor(panel2, win = window, { popout = false, onLine = () => {
} } = {}) {
  const doc = panel2.ownerDocument;
  panel2.hidden = false;
  panel2.innerHTML = `
    <div class="status-log-header"><h2>WiFi Log Monitor (UDP 7777)</h2></div>
    <p class="flash-status" data-status role="status">Connecting...</p>
    <div class="flash-row wifi-log-controls">
      <button class="btn btn-outline" data-stop>Stop</button>
      <button class="btn btn-outline" data-reconnect disabled>Reconnect</button>
      <button class="btn btn-outline" data-clear>Clear</button>
      <button class="btn btn-outline" data-popout>Pop Out</button>
      <label><input type="checkbox" data-autoscroll checked> Auto-scroll</label>
      <span data-count>0 lines</span>
    </div>
    <div class="status-log" data-output aria-live="polite"></div>`;
  const get = (name) => panel2.querySelector(`[data-${name}]`);
  const output = get("output"), status = get("status"), stopButton = get("stop"), reconnectButton = get("reconnect");
  let unsubscribe = null;
  let generation = 0;
  function append(text, error = false) {
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      const div = doc.createElement("div");
      div.className = `log-line${error ? " log-error" : ""}`;
      if (error) div.textContent = line;
      else appendAnsiText(div, line);
      output.appendChild(div);
    }
    while (output.childElementCount > 2e3) output.firstElementChild.remove();
    get("count").textContent = `${output.childElementCount} lines`;
    if (get("autoscroll").checked) output.scrollTop = output.scrollHeight;
  }
  function stop() {
    generation++;
    unsubscribe?.();
    unsubscribe = null;
    stopButton.disabled = true;
    reconnectButton.disabled = false;
  }
  function fail(message) {
    stop();
    status.textContent = `Error: ${message}`;
    status.classList.add("is-error");
    append(message, true);
    if (/EACCES|EPERM|10013|access permissions/i.test(message)) {
      append('Windows may be blocking UDP 7777. In an elevated PowerShell run:\nnetsh advfirewall firewall add rule name="FPGA WiFi Log UDP 7777" dir=in action=allow protocol=UDP localport=7777', true);
    }
  }
  function start() {
    const current = ++generation;
    status.textContent = "Connecting...";
    status.classList.remove("is-error");
    stopButton.disabled = false;
    reconnectButton.disabled = true;
    unsubscribe = win.papilioDesktop.subscribeWifiLog(
      (line) => {
        if (current !== generation) return;
        append(line);
        onLine(line);
      },
      (event) => {
        if (current !== generation) return;
        if (event.type === "error") fail(event.message);
        else status.textContent = event.message;
      }
    );
  }
  stopButton.addEventListener("click", () => {
    stop();
    status.classList.remove("is-error");
    status.textContent = "Stopped";
  });
  reconnectButton.addEventListener("click", start);
  get("clear").addEventListener("click", () => {
    output.replaceChildren();
    get("count").textContent = "0 lines";
  });
  get("popout").hidden = popout;
  get("popout").addEventListener("click", async () => {
    try {
      await win.papilioDesktop.openWifiLogWindow();
    } catch (err) {
      status.textContent = `Could not open WiFi log window: ${err.message}`;
      status.classList.add("is-error");
    }
  });
  win.addEventListener("beforeunload", stop, { once: true });
  start();
  return { stop };
}

// src/wifi-log-entry.js
var panel = document.getElementById("wifi-log-panel");
if (window.papilioDesktop?.subscribeWifiLog) {
  initWifiLogMonitor(panel, window, { popout: true });
} else {
  panel.textContent = "The WiFi UDP log monitor is available in the Papilio Loader desktop app only.";
}
//# sourceMappingURL=wifi-log.bundle.js.map
