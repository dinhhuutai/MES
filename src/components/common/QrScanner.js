import { useEffect, useRef, useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import { startCameraDecode, cameraErrorMessage } from './cameraDecoder';

// Quét bằng camera → trả nội dung (ma_tem) qua onResult. Đọc CẢ QR lẫn mã vạch 1D (ZXing đa định dạng).
// Cần HTTPS (getUserMedia chỉ chạy trên secure context / localhost).
export default function QrScanner({ open, onClose, onResult, title = 'Quét QR / mã vạch' }) {
  // ⚠ CALLBACK REF (không dùng useRef): Modal chạy trên Headless UI Portal — lần render ĐẦU sau khi mở,
  // portal chưa có DOM target nên children CHƯA mount ⇒ ref còn null lúc effect chạy ⇒ trước đây ZXing
  // tự tạo <video> ẩn và khung hình đen vĩnh viễn. Dùng state để effect chạy LẠI đúng lúc thẻ video vào DOM.
  const [videoEl, setVideoEl] = useState(null);
  const stopRef = useRef(null);
  const doneRef = useRef(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false); // quá lâu chưa có hình → gợi ý người dùng

  const stop = useCallback(() => {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; }
    setReady(false);
  }, []);

  const handleClose = useCallback(() => { stop(); onClose(); }, [stop, onClose]);

  useEffect(() => {
    if (!open || !videoEl) return undefined;
    let cancelled = false;
    doneRef.current = false;
    setError('');
    setReady(false);
    setSlow(false);
    const slowTimer = setTimeout(() => { if (!cancelled) setSlow(true); }, 6000);

    (async () => {
      try {
        const stopFn = await startCameraDecode(videoEl, (text) => {
          if (doneRef.current) return;
          doneRef.current = true;
          stop();
          onResult(text);
        });
        if (cancelled) { stopFn(); return; }
        stopRef.current = stopFn;
        videoEl.onplaying = () => setReady(true);
        if (!videoEl.paused && videoEl.readyState >= 2) setReady(true); // đã chạy trước khi kịp gắn
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    })();

    return () => { cancelled = true; clearTimeout(slowTimer); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, videoEl]);

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
            <video ref={setVideoEl} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/80" />
          </div>
          <p className="text-center text-xs text-ink-soft">
            {ready
              ? 'Đưa mã QR hoặc mã vạch vào khung'
              : slow
                ? 'Camera chưa hiện hình — đóng rồi mở lại, hoặc kiểm tra quyền camera của trình duyệt.'
                : 'Đang mở camera...'}
          </p>
        </div>
      )}
    </Modal>
  );
}
