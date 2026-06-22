/// <reference lib="webworker" />

/**
 * HEIC → JPEG decode worker. Lives in its own thread + memory space so the
 * main thread doesn't accumulate WASM heap from libheif. Terminating this
 * worker (worker.terminate()) reliably frees every byte the decoder
 * allocated — including any zombie state from a hung or malformed file.
 *
 * Protocol:
 *   in  : { id: string, buffer: ArrayBuffer }   (transferable)
 *   out : { id, ok: true, buffer: ArrayBuffer } (transferable JPEG)
 *       | { id, ok: false, error: string }
 */

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

self.onmessage = async (
  e: MessageEvent<{ id: string; buffer: ArrayBuffer }>
) => {
  const { id, buffer } = e.data;
  try {
    const libheif = (await import("libheif-js/wasm-bundle")) as unknown as
      | LibHeif
      | { default: LibHeif };
    const heif = "default" in libheif ? libheif.default : libheif;

    const decoder = new heif.HeifDecoder();
    const images = decoder.decode(buffer);
    if (!images || images.length === 0) {
      throw new Error("No HEIC images found in file");
    }

    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();
    if (!width || !height) {
      throw new Error("HEIC image has invalid dimensions");
    }

    const imageData = new ImageData(width, height);
    await new Promise<void>((resolve, reject) => {
      image.display(imageData, (data) => {
        if (data) resolve();
        else reject(new Error("libheif display() failed"));
      });
    });

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
    ctx.putImageData(imageData, 0, 0);

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.92,
    });
    const out = await blob.arrayBuffer();

    (self as DedicatedWorkerGlobalScope).postMessage(
      { id, ok: true, buffer: out },
      { transfer: [out] }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "HEIC decode failed";
    (self as DedicatedWorkerGlobalScope).postMessage({ id, ok: false, error: message });
  }
};

export {};
