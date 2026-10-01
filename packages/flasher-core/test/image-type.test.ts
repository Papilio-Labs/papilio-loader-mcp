import { describe, expect, it } from "vitest";
import { detectBinaryImageType, isEsp32Image, isGowinFpgaBitstream } from "../src/image-type.js";

function gowinSample(): Uint8Array {
  const data = new Uint8Array(32);
  data.fill(0xff, 0, 22);
  data[22] = 0xa5;
  data[23] = 0xc3;
  return data;
}

describe("binary image detection", () => {
  it("recognizes ESP32 images by their image magic", () => {
    const data = new Uint8Array([0xe9, 0x03, 0x02, 0x2f]);

    expect(detectBinaryImageType(data)).toBe("esp32");
    expect(isEsp32Image(data)).toBe(true);
  });

  it("recognizes headerless Gowin binary exports", () => {
    const data = gowinSample();

    expect(detectBinaryImageType(data)).toBe("fpga");
    expect(isGowinFpgaBitstream(data)).toBe(true);
  });

  it("rejects truncated, random, and wrong-format data", () => {
    expect(detectBinaryImageType(new Uint8Array())).toBe("unknown");
    expect(detectBinaryImageType(new Uint8Array([0xe9]))).toBe("esp32");
    expect(detectBinaryImageType(new Uint8Array(24).fill(0xff))).toBe("unknown");
    expect(detectBinaryImageType(new Uint8Array([0x00, 0xa5, 0xc3]))).toBe("unknown");
  });

  it("does not classify an ESP32 image as an FPGA bitstream", () => {
    const data = new Uint8Array(32);
    data[0] = 0xe9;

    expect(isGowinFpgaBitstream(data)).toBe(false);
  });
});
