import { useEffect, useRef, useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import { startCameraDecode, cameraErrorMessage } from './cameraDecoder';

// Quét bằng camera → trả nội dung (ma_tem) qua onResult. Đọc CẢ QR lẫn mã vạch 1D (ZXing đa định dạng).
// Cần HTTPS (getUserMedia chỉ chạy trên secure context / localhost).
export default function QrScanner({ open, onClose, onResult, title = 'Quét QR / mã vạch' }) {
  const videoRef = useRef(null);
  const stopRef = useRef(null);
  const doneRef = useRef(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; }
    setReady(false);
  }, []);

  const handleClose = useCallback(() => { stop(); onClose(); }, [stop, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    doneRef.current = false;
    setError('');
    setReady(false);

    (async () => {
      try {
        const stopFn = await startCameraDecode(videoRef.current, (text) => {
          if (doneRef.current) return;
          doneRef.current = true;
          stop();
          onResult(text);
        });
        if (cancelled) { stopFn(); return; }
        stopRef.current = stopFn;
        if (videoRef.current) videoRef.current.onplaying = () => setReady(true);
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    })();

    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onClose={handleClose} title={title}
      footer={<Button variant="ghost" onClick={handleClose}>Đóng</Button>}>
      {error ? (
        <div className="rounded-control border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-card bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/80" />
          </div>
          <p className="text-center text-xs text-ink-soft">
            {ready ? 'Đưa mã QR hoặc mã vạch vào khung' : 'Đang mở camera...'}
          </p>
        </div>
      )}
    </Modal>
  );
}
