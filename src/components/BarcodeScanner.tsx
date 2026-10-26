import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { canonicalJan, normalizeJan } from '../lib/jan';
import { getBarcodeDetector } from '../lib/barcodeDetector';

type ExtendedCaps = MediaTrackCapabilities & {
  focusMode?: string[];
  zoom?: { min: number; max: number; step?: number };
};

/** ピントを連続オートフォーカスにし、寄りすぎてもピントが合うよう少しズームする（対応端末のみ） */
async function tuneCamera(track: MediaStreamTrack | undefined) {
  if (!track || !('getCapabilities' in track)) return;
  const caps = track.getCapabilities() as ExtendedCaps;
  const advanced: Record<string, unknown>[] = [];
  if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
  if (caps.zoom && caps.zoom.max >= 1.5) advanced.push({ zoom: Math.min(2, caps.zoom.max) });
  for (const c of advanced) {
    try {
      await track.applyConstraints({ advanced: [c as MediaTrackConstraintSet] });
    } catch {
      // 未対応の設定は無視
    }
  }
}

interface BarcodeScannerProps {
  title?: string;
  onDetected: (jan: string) => void;
  onClose: () => void;
}

type ScanStatus = 'starting' | 'scanning' | 'error';

/**
 * カメラでJAN（EAN-13/EAN-8/UPC）バーコードを読み取るモーダル。
 * 読み取りライブラリ（ZXing）は開いたときだけ読み込む。
 * カメラが使えない環境では、数字を手入力して同じ流れに進める。
 */
export function BarcodeScanner({ title = 'バーコードを読み取る', onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const doneRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const [status, setStatus] = useState<ScanStatus>('starting');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');
  const [torchTrack, setTorchTrack] = useState<MediaStreamTrack | null>(null);
  const [torchOn, setTorchOn] = useState(false);

  async function toggleTorch() {
    if (!torchTrack) return;
    const next = !torchOn;
    try {
      await torchTrack.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchTrack(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setErrorMessage('この環境ではカメラを使えません。下の欄に数字を入力してください。');
        return;
      }
      try {
        // 検出器（wasm）の読み込みとカメラ起動を同時に進める
        const [detector, stream] = await Promise.all([
          getBarcodeDetector(),
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          }),
        ]);
        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const track = stream.getVideoTracks()[0];
        await tuneCamera(track);

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play().catch(() => undefined);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let timer: number | undefined;
        let attempt = 0;

        const scan = async () => {
          if (cancelled || doneRef.current) return;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (ctx && vw > 0 && vh > 0) {
            attempt++;
            // 基本は枠の周辺（中央の帯）だけを切り出して高速に読む。3回に1回は画面全体も読む。
            const full = attempt % 3 === 0;
            const sx = full ? 0 : Math.round(vw * 0.05);
            const sw = full ? vw : Math.round(vw * 0.9);
            const sy = full ? 0 : Math.round(vh * 0.2);
            const sh = full ? vh : Math.round(vh * 0.6);
            const scale = Math.min(1, 1280 / sw);
            canvas.width = Math.round(sw * scale);
            canvas.height = Math.round(sh * scale);
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            try {
              const codes = await detector.detect(canvas);
              for (const code of codes) {
                const jan = canonicalJan(code.rawValue);
                if (!jan || doneRef.current || cancelled) continue; // チェックディジット不一致は読み違いとして無視
                doneRef.current = true;
                stopStream();
                if (navigator.vibrate) navigator.vibrate(80);
                onDetectedRef.current(jan);
                return;
              }
            } catch (err) {
              console.warn('[BarcodeScanner]', err);
            }
          }
          timer = window.setTimeout(scan, 40);
        };

        const stopStream = () => {
          window.clearTimeout(timer);
          stream.getTracks().forEach((t) => t.stop());
          video.srcObject = null;
        };
        stop = stopStream;

        if (track && 'getCapabilities' in track) {
          const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
          if (caps.torch) setTorchTrack(track);
        }
        setStatus('scanning');
        scan();
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : '';
        setStatus('error');
        setErrorMessage(
          name === 'NotAllowedError'
            ? 'カメラの使用が許可されていません。設定でカメラを許可するか、下の欄に数字を入力してください。'
            : name === 'NotFoundError'
              ? 'カメラが見つかりません。下の欄に数字を入力してください。'
              : 'カメラを起動できませんでした。下の欄に数字を入力してください。',
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  function submitManual() {
    const jan = canonicalJan(manualCode);
    if (!jan) {
      const len = normalizeJan(manualCode).length;
      setManualError(
        len === 0
          ? '数字を入力してください。'
          : ![8, 12, 13].includes(len)
            ? 'JANコードは8桁または13桁です。'
            : '数字に誤りがあるようです（チェックディジット不一致）。',
      );
      return;
    }
    doneRef.current = true;
    onDetected(jan);
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="scanner-frame">
        <video ref={videoRef} className="scanner-video" muted playsInline autoPlay />
        <div className="scanner-guide" aria-hidden="true" />
        {status === 'starting' && <div className="scanner-overlay-text">カメラを起動しています…</div>}
        {status === 'error' && <div className="scanner-overlay-text">{errorMessage}</div>}
      </div>
      {status === 'scanning' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '8px 0 14px' }}>
          <p className="muted" style={{ margin: 0 }}>
            バーコードを枠に合わせてください（少し離すとピントが合います）
          </p>
          {torchTrack && (
            <button type="button" className="icon-btn" aria-label="ライト" onClick={toggleTorch}>
              {torchOn ? '🔦' : '💡'}
            </button>
          )}
        </div>
      )}

      <div className="field" style={{ marginTop: 12 }}>
        <label>読み取れないときは数字を入力</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="tel"
            inputMode="numeric"
            value={manualCode}
            onChange={(e) => {
              setManualCode(e.target.value);
              setManualError('');
            }}
            placeholder="4901234567894"
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={submitManual}>
            決定
          </button>
        </div>
        {manualError && (
          <p className="muted" style={{ color: 'var(--danger)', marginTop: 4 }}>
            {manualError}
          </p>
        )}
      </div>
    </Modal>
  );
}
