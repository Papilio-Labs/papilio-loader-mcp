export type BinaryImageType = "esp32" | "fpga" | "unknown";

const ESP32_IMAGE_MAGIC = 0xe9;
const GOWIN_PREAMBLE_LENGTH = 22;
const GOWIN_SYNC_A5 = 0xa5;
const GOWIN_SYNC_C3 = 0xc3;

/** Identify the binary formats accepted by the Papilio Retrocade loader. */
export function detectBinaryImageType(data: Uint8Array): BinaryImageType {
  if (data.length > 0 && data[0] === ESP32_IMAGE_MAGIC) {
    return "esp32";
  }

  if (
    data.length >= GOWIN_PREAMBLE_LENGTH + 2 &&
    data.subarray(0, GOWIN_PREAMBLE_LENGTH).every((value) => value === 0xff) &&
    data[GOWIN_PREAMBLE_LENGTH] === GOWIN_SYNC_A5 &&
    data[GOWIN_PREAMBLE_LENGTH + 1] === GOWIN_SYNC_C3
  ) {
    return "fpga";
  }

  return "unknown";
}

export function isEsp32Image(data: Uint8Array): boolean {
  return detectBinaryImageType(data) === "esp32";
}

export function isGowinFpgaBitstream(data: Uint8Array): boolean {
  return detectBinaryImageType(data) === "fpga";
}
