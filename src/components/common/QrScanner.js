import { useEffect, useRef, useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';
import { startCameraDecode, cameraErrorMessage, playVideo } from './cameraDecoder';

// Quét bằng camera → trả nội dung (mã tem / code phần) qua onResult. Cần HTTPS (secure context).
// ⚠⚠ 2 CHẾ ĐỘ TÁCH RIÊNG ('qr' | 'barcode') — KHÔNG quét chung: dò cả QR + 7 định dạng 1D trong cùng
// một vòng làm **QR rất khó "qua"** (thực tế iPhone quét mãi không ra QR, reader 1D thì đọc bừa ra rác
// từ đường kẻ bảng của phiếu). Mặc định 'qr' vì mã tem & code phần đều là QR.
export default function QrScanner({ open, onClose, onResult, title = 'Quét QR / mã vạch' }) {
  const [mode, setMode] = useState('qr');
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
        // onResult(text, kieu) — `kieu` ('qr' | 'barcode') để trang gọi biết quét loại mã nào mà tra
        // đúng cột (vd Hồ sơ kỹ thuật: QR = code phần, mã vạch = barcode HSKT). Lùi về `mode` khi
        // decoder không nói rõ; caller cũ chỉ nhận 1 tham số nên không ảnh hưởng.
        const stopFn = await startCameraDecode(videoEl, (text, kieu) => {
          if (doneRef.current) return;
          doneRef.current = true;
          stop();
          onResult(text, kieu || mode);
        }, mode);
        if (cancelled) { stopFn(); return; }
        stopRef.current = stopFn;
        videoEl.onplaying = () => setReady(true);
        if (!videoEl.paused && videoEl.readyState >= 2) setReady(true); // đã chạy trước khi kịp gắn
        // iOS chặn autoplay (hay gặp trong PWA) → mời bấm vào khung để phát.
        if (stopFn.autoplayBlocked) setSlow(true);
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    })();

    return () => { cancelled = true; clearTimeout(slowTimer); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, videoEl, mode]);

  return (
    <Modal open={open} onClose={handleClose} title={title}
      footer={<Button variant="ghost" onClick={handleClose}>Đóng</Button>}>
      {error ? (
        <div className="rounded-control border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      ) : (
        <div className="space-y-2">
          {/* CHỌN LOẠI MÃ — mỗi chế độ chỉ dò 1 nhóm reader (xem ghi chú đầu file). */}
          <div className="flex gap-2">
            {[
              { v: 'qr', label: 'QR', icon: 'scan-line' },
              { v: 'barcode', label: 'Mã vạch', icon: 'barcode' },
            ].map((o) => (
              <button key={o.v} type="button" onClick={() => setMode(o.v)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-control border px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === o.v ? 'border-primary bg-primary-wash/50 text-primary' : 'border-line text-ink-soft hover:text-ink'
                }`}>
                <Icon name={o.icon} size={14} />{o.label}
              </button>
            ))}
          </div>
          {/* BẤM vào khung = user-gesture thật → iOS cho phát video khi autoplay bị chặn (PWA). */}
          <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-card bg-black"
            onClick={() => playVideo(videoEl).then((ok) => { if (ok) { setReady(true); setSlow(false); } })}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={setVideoEl} className="h-full w-full object-cover" muted playsInline autoPlay />
            <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/80" />
          </div>
          <p className="text-center text-xs text-ink-soft">
            {ready
              ? (mode === 'qr' ? 'Đưa mã QR vào khung — chỉ đọc QR' : 'Đưa MÃ VẠCH vào khung — chỉ đọc mã vạch')
              : slow
                ? 'Chưa thấy hình? BẤM vào khung để bật camera (iOS chặn tự phát), hoặc kiểm tra quyền camera.'
                : 'Đang mở camera...'}
          </p>
        </div>
      )}
    </Modal>
  );
}
