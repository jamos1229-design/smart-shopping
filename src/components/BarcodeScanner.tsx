import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { canonicalJan, normalizeJan } from '../lib/jan';

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
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (cancelled || !videoRef.current) return;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });

        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result) => {
            if (!result || doneRef.current) return;
            const jan = canonicalJan(result.getText());
            if (!jan) return; // チェックディジット不一致は読み違いとして無視
            doneRef.current = true;
            controls.stop();
            if (navigator.vibrate) navigator.vibrate(80);
            onDetectedRef.current(jan);
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        stop = () => controls.stop();
        setStatus('scanning');
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
        <p className="muted" style={{ textAlign: 'center', margin: '8px 0 14px' }}>
          バーコードを枠の中に横向きで合わせてください
        </p>
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
