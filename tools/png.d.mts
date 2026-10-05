export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}
export function decodePng(buffer: Uint8Array): DecodedImage;
