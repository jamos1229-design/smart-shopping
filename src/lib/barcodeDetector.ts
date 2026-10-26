// バーコード検出器を用意する。
// ブラウザ標準の BarcodeDetector があればそれを使い、
// なければ（iPhoneのSafariなど）zxing-cpp の WebAssembly 版で同じAPIを提供する。
// wasm ファイルはアプリと一緒に配信する（外部CDNに頼らない）。

import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

export type DetectorFormat = 'ean_13' | 'ean_8' | 'upc_a' | 'upc_e';
const FORMATS: DetectorFormat[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export interface DetectedCode {
  rawValue: string;
  format: string;
}

export interface CodeDetector {
  detect(source: CanvasImageSource): Promise<DetectedCode[]>;
}

interface NativeDetectorCtor {
  new (options?: { formats?: string[] }): CodeDetector;
  getSupportedFormats(): Promise<string[]>;
}

let detectorPromise: Promise<CodeDetector> | null = null;

async function createDetector(): Promise<CodeDetector> {
  const native = (globalThis as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  if (native) {
    try {
      const supported = await native.getSupportedFormats();
      if (supported.includes('ean_13')) {
        return new native({ formats: FORMATS.filter((f) => supported.includes(f)) });
      }
    } catch {
      // ネイティブが使えなければ wasm 版へ
    }
  }

  const { BarcodeDetector, setZXingModuleOverrides } = await import('barcode-detector/ponyfill');
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
  });
  return new BarcodeDetector({ formats: FORMATS });
}

/** 検出器を1つだけ作って使い回す（初回のみ wasm を読み込む） */
export function getBarcodeDetector(): Promise<CodeDetector> {
  if (!detectorPromise) {
    detectorPromise = createDetector().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}
