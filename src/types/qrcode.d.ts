declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
  }
  export type QrCallback = (err: Error | null, url: string) => void;
  export function toDataURL(text: string, opts?: QRCodeToDataURLOptions): Promise<string>;
  export function toDataURL(text: string, opts: QRCodeToDataURLOptions, cb: QrCallback): void;
}
