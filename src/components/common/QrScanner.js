import { useEffect, useRef, useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
// jsQR lazy-import (chỉ tải khi mở quét) — tránh phình main bundle.

// Quét QR bằng camera điện thoại → trả nội dung QR (ma_tem) qua onResult.
// Cần HTTPS (getUserMedia chỉ chạy trên secure context / localhost).
export default function QrScanner({ open, onClose, onResult, title = 'Quét QR tem' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const jsqrRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setReady(false);
  }, []);

  const handleClose = useCallback(() => { stop(); onClose(); }, [stop, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError('');
    setReady(false);

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsqrRef.current && jsqrRef.current(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code && code.data) {
            stop();
            onResult(code.data.trim());
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Trình duyệt không hỗ trợ camera (cần chạy trên HTTPS).');
        return;
      }
      try {
        if (!jsqrRef.current) { jsqrRef.current = (await import('jsqr')).default; }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        setReady(true);
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setError(
          e.name === 'NotAllowedError' ? 'Bạn đã từ chối quyền camera — cho phép rồi thử lại.'
            : e.name === 'NotFoundError' ? 'Không tìm thấy camera trên thiết bị.'
              : `Không mở được camera: ${e.message || e.name}`
        );
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
            {ready ? 'Đưa mã QR vào khung' : 'Đang mở camera...'}
          </p>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </Modal>
  );
}
