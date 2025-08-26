declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
  }
  export function toDataURL(text: string, opts?: QRCodeToDataURLOptions): Promise<string>;
  export function toDataURL(text: string, opts: QRCodeToDataURLOptions, cb: (err: any, url: string) => void): void;
}
