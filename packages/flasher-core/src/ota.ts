// ota.ts — HTTP OTA client for /update, /fpga-update, /fpga-jtag-sram,
// /fpga-recover. The actual POST is injected via an OtaPoster so this file
// stays DOM-free: the web build supplies an XHR-based poster (for real
// upload-progress events), the desktop build can use a Node fetch/http
// poster with no CORS constraints at all.
export type OtaProgressCallback = (loaded: number, total: number) => void;

export interface OtaPoster {
  post(url: string, body: BodyInit, onProgress: OtaProgressCallback): Promise<string>;
}

export const OTA_PORT = 3232;

export async function flashEsp32Ota(
  poster: OtaPoster,
  ip: string,
  data: Uint8Array,
  onProgress: OtaProgressCallback,
  port: number = OTA_PORT
): Promise<string> {
  const url = `http://${ip}:${port}/update`;
  return poster.post(url, data as BodyInit, onProgress);
}

export type FpgaOtaEndpoint = "/fpga-update" | "/fpga-jtag-sram" | "/fpga-recover";

export async function flashFpgaOta(
  poster: OtaPoster,
  ip: string,
  endpoint: FpgaOtaEndpoint,
  body: BodyInit,
  onProgress: OtaProgressCallback,
  port: number = OTA_PORT
): Promise<string> {
  const url = `http://${ip}:${port}${endpoint}`;
  return poster.post(url, body, onProgress);
}

// Browser-only poster (uses XMLHttpRequest for real upload.onprogress events
// — fetch()'s ReadableStream request bodies don't expose upload progress in
// any browser yet). Kept in this file behind a runtime guard rather than a
// separate browser-only module, since XHR is the only DOM API this file
// touches and only when actually invoked.
export function createBrowserXhrPoster(): OtaPoster {
  return {
    post(url, body, onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText || xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error — check the device is on the same WiFi network"));
        xhr.send(body as XMLHttpRequestBodyInit);
      });
    },
  };
}
