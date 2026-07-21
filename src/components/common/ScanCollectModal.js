import { useEffect, useRef, useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';

// So khớp mã: bỏ khoảng trắng + viết thường (khớp cả code phần có chữ lẫn barcode dãy số).
const normStr = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '');
// Thiết bị cảm ứng (điện thoại/pad) → mặc định quét QR; máy tính → mặc định tích barcode.
const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(pointer: coarse)').matches : false;

// Bộ vạch cố định cho hình ảnh động "đang quét" (barcode + thanh dọc chạy qua lại).
const BARS = [3, 1, 2, 4, 1, 3, 1, 1, 2, 5, 1, 2, 3, 1, 4, 1, 2, 1, 3, 2, 1, 5, 1, 3, 1, 2, 4, 1, 2, 1, 3, 1, 2, 5, 1, 3, 1, 2, 1, 4];

function ScanViz() {
  return (
    <div className="relative mx-auto flex h-28 w-full max-w-xs items-center justify-center overflow-hidden rounded-card border border-line bg-white px-4 dark:bg-slate-900">
      <style>{'@keyframes sc_scan{0%{left:4%}50%{left:92%}100%{left:4%}}'}</style>
      <div className="flex h-16 items-stretch gap-[2px]">
        {BARS.map((w, i) => (
          <span key={i} style={{ width: `${w}px` }} className="block bg-ink dark:bg-slate-200" />
        ))}
      </div>
      <span className="pointer-events-none absolute top-2 bottom-2 w-[3px] rounded bg-danger shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]"
        style={{ animation: 'sc_scan 1.6s ease-in-out infinite' }} />
    </div>
  );
}

/**
 * Quét/tích NHIỀU mã. 2 cách nhập: QR (camera, quét code phần liên tục) + Barcode (đầu đọc mã vạch USB
 * = keyboard-wedge gõ dãy số + Enter, hoặc nhập tay). Mặc định theo thiết bị: điện thoại/pad → QR, máy tính → barcode.
 *
 * 2 chế độ:
 *  - COLLECT (mặc định): dồn vào danh sách "Đã chọn" rồi bấm Xác nhận cùng lúc. `rowAction` = nút phụ mỗi dòng (vd Trả về).
 *  - IMMEDIATE (`immediate`): mỗi lần quét XÁC NHẬN NGAY (`onScanAction`), ghi vào "Lịch sử phiên này" + nút Hủy (`onUndo`).
 *
 * Props chung: open, onClose, title, help, rows, getId, getCodes, getBarcodes, matchMultiple,
 *   primaryLabel, secondaryLabel, renderHeader (node trên cùng, vd checkbox chọn mục ở READY), disabledScan.
 * COLLECT: isSelected, onToggle, onConfirm, confirmLabel, rowAction={label,icon,onClick(row)}.
 * IMMEDIATE: onScanAction(row)->Promise, onUndo(row)->Promise, actionLabel(row).
 */
export default function ScanCollectModal({
  open, onClose, title = 'Quét / tích mã', help,
  rows = [], getId = (r) => r.id,
  getCodes = (r) => [r.ma_phan], getBarcodes,
  matchMultiple = false,
  isSelected, onToggle,
  primaryLabel = (r) => r.ma_phan, secondaryLabel,
  onConfirm, confirmLabel = 'Xác nhận',
  rowAction,
  renderHeader, disabledScan = false,
  immediate = false, onScanAction, onUndo, actionLabel,
}) {
  // Bật chế độ barcode khi TRANG hỗ trợ (truyền getBarcodes) — KHÔNG phụ thuộc rows đã có barcode chưa.
  // Máy tính dùng đầu đọc mã vạch (thiết bị) nên luôn hiện chế độ tích barcode + ảnh động (thay cho camera).
  const hasBarcode = typeof getBarcodes === 'function';
  // Máy tính (không cảm ứng) + trang hỗ trợ barcode → chế độ TÍCH BARCODE (đầu đọc thiết bị); còn lại → QR camera.
  // KHÔNG cho đổi qua lại (không toggle) theo yêu cầu.
  const mode = hasBarcode && !IS_TOUCH ? 'barcode' : 'qr';
  const [log, setLog] = useState([]);       // feedback tạm (không tìm thấy / lỗi)
  const [session, setSession] = useState([]); // immediate: đã xác nhận phiên này (có nút Hủy)
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const jsqrRef = useRef(null);
  const recentRef = useRef(new Map()); // code → ts (chống lặp)
  const bufRef = useRef({ s: '', t: 0, timer: null }); // buffer bắt phím đầu đọc mã vạch
  const idRef = useRef(0);
  // Giữ props mới nhất cho vòng lặp camera (effect chỉ chạy lại theo open/mode).
  const stateRef = useRef({});
  stateRef.current = { rows, getCodes, getBarcodes, matchMultiple, isSelected, onToggle, immediate, onScanAction, actionLabel, primaryLabel, disabledScan };

  useEffect(() => {
    if (open) { setLog([]); setSession([]); recentRef.current = new Map(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pushLog = useCallback((text, okFlag) => {
    idRef.current += 1;
    const id = idRef.current;
    setLog((l) => [{ id, text, ok: okFlag }, ...l].slice(0, 6));
  }, []);

  const matchRows = useCallback((raw, kind) => {
    const s = stateRef.current;
    const c = normStr(raw);
    if (!c) return [];
    const getters = kind === 'barcode' ? s.getBarcodes : s.getCodes;
    const exact = s.rows.filter((r) => (getters(r) || []).some((v) => v && normStr(v) === c));
    const pool = exact.length ? exact : s.rows.filter((r) => (getters(r) || []).some((v) => v && normStr(v).includes(c)));
    if (!pool.length) return [];
    return s.matchMultiple ? pool : [pool[0]];
  }, []);

  const doImmediate = useCallback(async (row) => {
    const s = stateRef.current;
    try {
      await s.onScanAction(row);
      idRef.current += 1;
      const id = idRef.current;
      const label = (s.actionLabel && s.actionLabel(row)) || s.primaryLabel(row);
      setSession((ss) => [{ id, row, label }, ...ss]);
    } catch (e) {
      pushLog(`✗ ${s.primaryLabel(row)}: ${e.message || 'Lỗi'}`, false);
    }
  }, [pushLog]);

  // Xử lý 1 mã vừa quét/nhập (dùng cho cả camera lẫn barcode).
  const processScan = useCallback((raw, kind) => {
    const s = stateRef.current;
    const c = normStr(raw);
    if (!c) return;
    if (s.disabledScan) { pushLog('Chọn mục cần xác nhận trước', false); return; }
    const now = Date.now();
    const last = recentRef.current.get(c);
    if (last && now - last < 1500) return; // chống lặp cùng mã
    recentRef.current.set(c, now);
    const matched = matchRows(raw, kind);
    if (!matched.length) { pushLog(`Không thấy "${String(raw).trim()}"`, false); return; }
    if (s.immediate) { matched.forEach((row) => doImmediate(row)); return; }
    matched.forEach((row) => { if (!s.isSelected(row)) s.onToggle(row); });
    pushLog(`＋ ${s.primaryLabel(matched[0])}${matched.length > 1 ? ` (${matched.length} dòng)` : ''}`, true);
  }, [matchRows, doImmediate, pushLog]);

  // ---- Camera QR (liên tục) ----
  const stopCam = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open || mode !== 'qr') { stopCam(); return undefined; }
    let cancelled = false;
    setError('');
    setReady(false);

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth; const h = video.videoHeight;
        if (w && h) {
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsqrRef.current && jsqrRef.current(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code && code.data) processScan(code.data.trim(), 'qr');
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Trình duyệt không hỗ trợ camera (cần chạy trên HTTPS).'); return;
      }
      try {
        if (!jsqrRef.current) jsqrRef.current = (await import('jsqr')).default;
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
              : `Không mở được camera: ${e.message || e.name}`,
        );
      }
    })();

    return () => { cancelled = true; stopCam(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  // BẮT PHÍM đầu đọc mã vạch toàn cục (không cần ô nhập): buffer ký tự, xử lý khi Enter hoặc khi ngừng gõ 120ms.
  // Bỏ qua khi đang gõ trong 1 field (INPUT/TEXTAREA/SELECT — vd ô "Người test") để không nuốt phím.
  useEffect(() => {
    if (!open || mode !== 'barcode') return undefined;
    const b = bufRef.current; // object ổn định (không reassign) — dùng chung cho flush/onKey/cleanup
    const flush = () => {
      const code = b.s; b.s = '';
      if (b.timer) { clearTimeout(b.timer); b.timer = null; }
      if (code && code.length >= 2) processScan(code, 'barcode');
    };
    const TEXT_TYPES = ['text', 'number', 'search', 'tel', 'url', 'email', 'password'];
    const onKey = (e) => {
      const t = e.target || {};
      const tag = (t.tagName || '').toUpperCase();
      // Bỏ qua khi đang gõ trong field NHẬP CHỮ (để ô "Người test"... tự nhập); checkbox/nút thì KHÔNG chặn.
      if (tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      if (tag === 'INPUT' && TEXT_TYPES.includes((t.type || 'text').toLowerCase())) return;
      const now = Date.now();
      if (now - b.t > 500) b.s = ''; // gap lớn → bắt đầu mã mới
      b.t = now;
      if (e.key === 'Enter') { e.preventDefault(); flush(); return; }
      if (e.key && e.key.length === 1) {
        b.s += e.key;
        if (b.timer) clearTimeout(b.timer);
        b.timer = setTimeout(flush, 120); // đầu đọc không gửi Enter → tự chốt sau khi ngừng gõ
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (b.timer) clearTimeout(b.timer); };
  }, [open, mode, processScan]);

  const undoEntry = async (entry) => {
    try {
      if (onUndo) await onUndo(entry.row);
      setSession((ss) => ss.filter((x) => x.id !== entry.id));
    } catch (e) { pushLog(`✗ Hủy lỗi: ${e.message || ''}`, false); }
  };

  const handleClose = () => { stopCam(); onClose(); };

  const selectedRows = immediate ? [] : rows.filter((r) => isSelected(r));

  return (
    <Modal open={open} onClose={handleClose} title={title} size="md"
      footer={(
        <>
          <Button variant="ghost" onClick={handleClose}>Đóng</Button>
          {!immediate && onConfirm && (
            <Button onClick={onConfirm} disabled={selectedRows.length === 0} icon="check">
              {confirmLabel} ({selectedRows.length})
            </Button>
          )}
        </>
      )}
    >
      <div className="space-y-3">
        {help && <p className="rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-soft">{help}</p>}
        {renderHeader}

        {/* Barcode (máy tính): chỉ hình ảnh động — đầu đọc mã vạch được bắt phím tự động, tự xác nhận. */}
        {mode === 'barcode' && (
          <div className="space-y-1">
            <ScanViz />
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">
              <Icon name="barcode" size={14} /> Dùng đầu đọc mã vạch để tích — tự động xác nhận, hiện ngay bên dưới.
            </p>
          </div>
        )}

        {/* Camera */}
        {mode === 'qr' && (
          error ? (
            <div className="rounded-control border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>
          ) : (
            <div className="space-y-1">
              <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-card bg-black">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/80" />
              </div>
              <p className="text-center text-xs text-ink-soft">{ready ? 'Đưa mã QR vào khung — quét liên tục' : 'Đang mở camera...'}</p>
            </div>
          )
        )}

        {/* Feedback tạm */}
        {log.length > 0 && (
          <div className="space-y-1">
            {log.map((l) => (
              <div key={l.id} className={`flex items-center gap-1.5 text-xs ${l.ok ? 'text-success' : 'text-danger'}`}>
                <Icon name={l.ok ? 'check' : 'x'} size={13} />{l.text}
              </div>
            ))}
          </div>
        )}

        {/* IMMEDIATE: lịch sử đã xác nhận phiên này (+ Hủy) */}
        {immediate ? (
          <div className="rounded-control border border-line">
            <div className="border-b border-line bg-surface-muted px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Đã xác nhận phiên này ({session.length})</span>
            </div>
            {session.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-ink-soft">Chưa xác nhận mã nào — quét/tích để xác nhận ngay.</p>
            ) : (
              <ul className="max-h-56 divide-y divide-line overflow-auto">
                {session.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-sm font-medium text-ink">{e.label}</div>
                      {secondaryLabel && <div className="truncate text-xs text-ink-soft">{secondaryLabel(e.row)}</div>}
                    </div>
                    <button type="button" onClick={() => undoEntry(e)}
                      className="shrink-0 rounded-control px-2 py-1 text-xs font-medium text-danger hover:bg-surface-muted">Hủy</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          /* COLLECT: danh sách đã chọn */
          <div className="rounded-control border border-line">
            <div className="flex items-center justify-between border-b border-line bg-surface-muted px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Đã chọn ({selectedRows.length})</span>
              {selectedRows.length > 0 && (
                <button type="button" onClick={() => selectedRows.forEach((r) => onToggle(r))}
                  className="text-xs font-medium text-danger hover:underline">Bỏ hết</button>
              )}
            </div>
            {selectedRows.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-ink-soft">Chưa có mã nào — quét/tích để thêm.</p>
            ) : (
              <ul className="max-h-56 divide-y divide-line overflow-auto">
                {selectedRows.map((r) => (
                  <li key={getId(r)} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-sm font-medium text-ink">{primaryLabel(r)}</div>
                      {secondaryLabel && <div className="truncate text-xs text-ink-soft">{secondaryLabel(r)}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {rowAction && (
                        <button type="button" onClick={() => rowAction.onClick(r)}
                          className="rounded-control border border-line px-2 py-1 text-xs font-medium text-ink-soft hover:bg-surface-muted hover:text-danger">
                          {rowAction.icon && <Icon name={rowAction.icon} size={12} className="mr-1 inline" />}{rowAction.label}
                        </button>
                      )}
                      <button type="button" onClick={() => onToggle(r)} aria-label="Bỏ chọn"
                        className="rounded-control p-1 text-ink-soft hover:bg-surface-muted hover:text-danger">
                        <Icon name="trash-2" size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </Modal>
  );
}
