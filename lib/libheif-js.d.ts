declare module "libheif-js/wasm-bundle" {
  interface DecodedImage {
    get_width(): number;
    get_height(): number;
    display(
      imageData: ImageData,
      cb: (data: ImageData | null) => void
    ): void;
  }
  interface HeifDecoder {
    decode(buffer: ArrayBuffer): DecodedImage[];
  }
  interface LibHeif {
    HeifDecoder: new () => HeifDecoder;
  }
  const libheif: LibHeif;
  export default libheif;
}
