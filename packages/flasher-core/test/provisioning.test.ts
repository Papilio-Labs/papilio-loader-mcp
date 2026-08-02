import { describe, it, expect, vi } from "vitest";
import { sendWifiCredentials, watchProvisioningLine, IP_REGEX } from "../src/provisioning.js";
import { MockSerialPort } from "./mock-transport.js";

describe("provisioning", () => {
  it("sendWifiCredentials writes SSID and PASS lines in order", async () => {
    const port = new MockSerialPort();
    await port.open({ baudRate: 115200 });

    await sendWifiCredentials(port, "MyNetwork", "hunter2");

    const decoder = new TextDecoder();
    expect(port.writes.map((w) => decoder.decode(w))).toEqual([
      "WIFI_SSID=MyNetwork\n",
      "WIFI_PASS=hunter2\n",
    ]);
  });

  it("IP_REGEX captures the device IP from a boot log line", () => {
    const match = "WiFi connected - IP: 10.0.4.35".match(IP_REGEX);
    expect(match?.[1]).toBe("10.0.4.35");
  });

  it("watchProvisioningLine reports IP and status transitions", () => {
    const onIp = vi.fn();
    const onStatus = vi.fn();
    const events = { onIp, onStatus };

    watchProvisioningLine("WiFi connected - IP: 192.168.1.42", events);
    expect(onIp).toHaveBeenCalledWith("192.168.1.42");

    watchProvisioningLine("WIFI_CFG_OK reboot", events);
    expect(onStatus).toHaveBeenCalledWith(expect.stringContaining("rebooting"), "ok");

    watchProvisioningLine("WIFI_CFG_ERR bad_password", events);
    expect(onStatus).toHaveBeenCalledWith(expect.stringContaining("rejected"), "error");
  });
});
