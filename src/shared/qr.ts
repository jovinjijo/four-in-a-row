// Thin wrapper around dynamic QR generation so UI components stay lean.
// Falls back to a simple data URI if library fails to load.
import type { QRCodeToDataURLOptions } from "qrcode";

type QrModule = {
  toDataURL: (text: string, opts?: QRCodeToDataURLOptions, cb?: (err: Error | null, url: string) => void) => Promise<string> | void;
};

export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    const mod = (await import("qrcode")) as QrModule;
    if (typeof mod.toDataURL === "function") {
      const url = await mod.toDataURL(text, { width: 256, margin: 1 });
      if (typeof url === "string") return url;
    }
  } catch {
    // Swallow and fallback to plain text data URI.
  }
  return `data:text/plain,${encodeURIComponent(text)}`;
}
