import { afterEach, expect, it, vi } from "vitest";
import { createSocket, type Socket } from "node:dgram";
import { WifiLogManager, type WifiLogStatus } from "../src/main/wifi-log";

const cleanup: Array<() => void> = [];
afterEach(() => { for (const fn of cleanup.splice(0)) fn(); });

async function subscribe(manager: WifiLogManager, onLine = vi.fn()) {
  let connected!: (status: WifiLogStatus) => void;
  const ready = new Promise<WifiLogStatus>((resolve) => { connected = resolve; });
  const stop = manager.subscribe(onLine, connected);
  cleanup.push(stop);
  const status = await ready;
  expect(status.type).toBe("connected");
  return { stop, onLine, port: Number(status.message.split(" ").at(-1)) };
}

it("shares one UDP listener and unsubscribes individual windows", async () => {
  const manager = new WifiLogManager(0);
  const first = await subscribe(manager);
  const second = await subscribe(manager);
  expect(second.port).toBe(first.port);
  const sender = createSocket("udp4");
  cleanup.push(() => sender.close());
  sender.send(Buffer.from("first\n"), first.port, "127.0.0.1");
  await vi.waitFor(() => {
    expect(first.onLine).toHaveBeenCalledWith("first\n");
    expect(second.onLine).toHaveBeenCalledWith("first\n");
  });
  first.stop();
  first.onLine.mockClear();
  sender.send(Buffer.from("second\n"), second.port, "127.0.0.1");
  await vi.waitFor(() => expect(second.onLine).toHaveBeenCalledWith("second\n"));
  expect(first.onLine).not.toHaveBeenCalled();
});

it("frees the UDP port when the last window stops and can reconnect", async () => {
  const manager = new WifiLogManager(0);
  const first = await subscribe(manager);
  first.stop();
  const probe = createSocket("udp4");
  cleanup.push(() => probe.close());
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.bind(first.port, "127.0.0.1", resolve);
  });
  const second = await subscribe(manager);
  expect(second.port).toBeGreaterThan(0);
});

it("reports bind failures to the UI and recovers after reconnect", async () => {
  const occupied: Socket = createSocket("udp4");
  await new Promise<void>((resolve) => occupied.bind(0, "0.0.0.0", resolve));
  const manager = new WifiLogManager(occupied.address().port);
  const statuses = vi.fn();
  const stop = manager.subscribe(vi.fn(), statuses);
  cleanup.push(stop);
  await vi.waitFor(() => expect(statuses).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  stop();
  await new Promise<void>((resolve) => occupied.close(resolve));
  await subscribe(manager);
});
