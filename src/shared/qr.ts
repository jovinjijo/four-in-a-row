// Thin wrapper around dynamic QR generation so UI components stay lean.
// Falls back to a simple data URI if library fails to load.
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    const mod: any = await import("qrcode");
    if (mod?.toDataURL) {
      return await mod.toDataURL(text, { width: 256, margin: 1 });
    }
  } catch (e) {
    // ignore
  }
  return `data:text/plain,${encodeURIComponent(text)}`;
}
