import { spawn } from "child_process";
import { access, constants } from "fs/promises";

/**
 * Interface for firmware loading operations
 */
export type DeviceType = "fpga" | "esp32";

/**
 * Load firmware to a Papilio board
 * @param port - Serial port path
 * @param filepath - Path to firmware file
 * @param deviceType - Type of device (fpga or esp32)
 * @param address - Flash address for ESP32 (default: 0x1000)
 * @returns Promise with result message
 */
export async function loadFirmware(
  port: string,
  filepath: string,
  deviceType: DeviceType,
  address: string = "0x1000"
): Promise<string> {
  // Verify file exists
  try {
    await access(filepath, constants.R_OK);
  } catch {
    throw new Error(`File not found or not readable: ${filepath}`);
  }

  return new Promise((resolve, reject) => {
    let command: string;
    let args: string[];

    if (deviceType === "fpga") {
      // Use papilio-prog for FPGA bitfiles
      // This assumes papilio-prog is installed and in PATH
      command = "papilio-prog";
      args = ["-v", "-f", filepath, "-b", port];
    } else if (deviceType === "esp32") {
      // Use esptool.py for ESP32 firmware
      // This assumes esptool.py is installed and in PATH
      command = "esptool.py";
      args = [
        "--chip", "esp32",
        "--port", port,
        "--baud", "921600",
        "write_flash",
        "-z",
        address,
        filepath,
      ];
    } else {
      reject(new Error(`Unknown device type: ${deviceType}`));
      return;
    }

    const process = spawn(command, args);
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve(stdout || "Firmware loaded successfully");
      } else {
        reject(
          new Error(
            `Failed to load firmware (exit code ${code}): ${stderr || stdout}`
          )
        );
      }
    });

    process.on("error", (error) => {
      // If command not found, provide helpful error message
      if ((error as any).code === "ENOENT") {
        reject(
          new Error(
            `Command '${command}' not found. Please install ${
              deviceType === "fpga" ? "papilio-prog" : "esptool.py"
            }`
          )
        );
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Simulate firmware loading for testing purposes
 * @param port - Serial port path
 * @param filepath - Path to firmware file
 * @param deviceType - Type of device
 * @returns Promise with simulated result
 */
export async function simulateLoad(
  port: string,
  filepath: string,
  deviceType: DeviceType
): Promise<string> {
  // Verify file exists
  try {
    await access(filepath, constants.R_OK);
  } catch {
    throw new Error(`File not found or not readable: ${filepath}`);
  }

  // Simulate loading delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return `[SIMULATION] Successfully loaded ${deviceType} firmware from ${filepath} to ${port}`;
}
