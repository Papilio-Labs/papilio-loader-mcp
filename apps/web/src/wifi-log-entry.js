import { initWifiLogMonitor } from "@papilio-loader/loader-ui/wifi-log.js";

const panel = document.getElementById("wifi-log-panel");
if (window.papilioDesktop?.subscribeWifiLog) {
  initWifiLogMonitor(panel, window, { popout: true });
} else {
  panel.textContent = "The WiFi UDP log monitor is available in the Papilio Loader desktop app only.";
}
