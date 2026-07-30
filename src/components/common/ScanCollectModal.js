import { useEffect, useRef, useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';
import { startCameraDecode, cameraErrorMessage, playVideo } from './cameraDecoder';

// So khớp mã: bỏ khoảng trắng + viết thường (khớp cả code phần có chữ lẫn barcode dãy số).
const normStr = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '');
// Chuẩn hóa LỎNG: chỉ giữ chữ + số (bỏ - _ . / # …) — dùng ở lượt khớp cuối, vì QR trên phiếu giấy
// hay ghi code phần khác dấu phân cách với DB (vd "CP-000-006" ↔ "CP000006").
const looseStr = (s) => normStr(s).replace(/[^a-z0-9]/g, '');
const KIND_LABEL = { qr: 'QR', barcode: 'mã vạch' };
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
 * Quét/tích NHIỀU mã. Mặc định dùng CAMERA đa định dạng (đọc CẢ QR code phần lẫn mã vạch 1D).
 * Riêng READY (`usbBarcode`) trên máy tính giữ đầu đọc mã vạch USB (keyboard-wedge gõ dãy số + Enter).
 *
 * 2 chế độ:
 *  - COLLECT (mặc định): dồn vào danh sách "Đã chọn" rồi bấm Xác nhận cùng lúc. `rowAction` = nút phụ mỗi dòng (vd Trả về).
 *  - IMMEDIATE (`immediate`): mỗi lần quét XÁC NHẬN NGAY (`onScanAction`), ghi vào "Lịch sử phiên này" + nút Hủy (`onUndo`).
 *
 * Props chung: open, onClose, title, help, rows, getId, getCodes, getBarcodes, matchMultiple,
 *   primaryLabel, secondaryLabel, renderHeader (node trên cùng, vd checkbox chọn mục ở READY), disabledScan,
 *   usbBarcode (chỉ READY — bật đầu đọc mã vạch USB trên máy tính).
 * COLLECT: isSelected, onToggle, onConfirm, confirmLabel, rowAction={label,icon,onClick(row)}.
 * IMMEDIATE: onScanAction(row)->Promise, onUndo(row)->Promise, actionLabel(row).
 */
export default function ScanCollectModal({
  open, onClose, title = 'Quét / tích mã', help,
  rows = [], getId = (r) => r.id,
  getCodes = (r) => [r.ma_phan], getBarcodes,
  // Barcode HSKT: quét trúng → chọn TẤT CẢ phần in/đợt cùng HSKT (dù matchMultiple=false). Mặc định đọc r.barcode_hskt.
  getHsktBarcodes = (r) => (r && r.barcode_hskt ? [r.barcode_hskt] : []),
  // NHÓM GOM SET (ERP): `hskt_inset` ≠ 0 ⇒ phần in CÙNG HSKT là một nhóm gom set. Quét TRÚNG bất kỳ
  // mã nào của nhóm (code phần / barcode đợt / barcode HSKT) ⇒ chọn–xác nhận CẢ NHÓM.
  getGomSetKey = (r) => (r && r.barcode_hskt && r.hskt_inset != null && Number(r.hskt_inset) !== 0
    ? `HSKT#${r.barcode_hskt}` : null),
  matchMultiple = false,
  // Dòng có được CHỌN không: trả `true`, hoặc CHUỖI LÝ DO để báo cho người quét.
  // ⚠ Vì sao cần: các màn có điều kiện chọn (QC READY đòi đủ mục KT · Test Run đòi chưa QA & không chờ
  // kỹ thuật · Kế hoạch tạm đòi đã Ready) trước đây truyền TẬP CON đã lọc vào `rows` ⇒ quét phần in
  // ĐANG HIỆN trên bảng nhưng chưa đủ điều kiện thì báo "Không thấy" — người dùng tưởng máy quét hỏng.
  // Nay truyền ĐỦ rows + `canSelect` để nói rõ TẠI SAO không chọn được.
  canSelect,
  isSelected, onToggle,
  primaryLabel = (r) => r.ma_phan, secondaryLabel,
  onConfirm, confirmLabel = 'Xác nhận',
  rowAction,
  renderHeader, disabledScan = false,
  immediate = false, onScanAction, onUndo, actionLabel,
  usbBarcode = false,
}) {
  const hasBarcode = typeof getBarcodes === 'function';
  // ⚠⚠ 2 CHẾ ĐỘ TÁCH RIÊNG (chốt 2026-07-30) — 'qr' | 'barcode'. Trước đây camera quét CHUNG QR + 1D
  // trong cùng một vòng nên **QR rất khó "qua"** (thực tế iPhone quét mãi không ra QR, còn reader 1D
  // đọc bừa ra rác từ đường kẻ bảng của phiếu). Mỗi chế độ chỉ 1 nhóm reader ⇒ nhanh & chắc hơn nhiều.
  //   · 'qr'      → CAMERA chỉ đọc QR (code phần / mã tem)
  //   · 'barcode' → đầu đọc USB (READY trên máy tính) HOẶC camera chỉ đọc mã vạch 1D (HSKT / đợt vải)
  const [modeSel, setModeSel] = useState(null); // null = theo mặc định của thiết bị/màn hình
  // Mặc định: điện thoại/pad → QR (hay dùng nhất). Máy tính ở READY có đầu đọc USB → mã vạch.
  const autoMode = !IS_TOUCH && usbBarcode && hasBarcode ? 'barcode' : 'qr';
  const mode = modeSel || autoMode;
  // Đầu đọc mã vạch USB (keyboard-wedge) chỉ dùng ở READY trên MÁY TÍNH; còn lại 'barcode' = camera 1D.
  const usbMode = mode === 'barcode' && usbBarcode && hasBarcode && !IS_TOUCH;
  const camMode = !usbMode; // luôn có camera, trừ khi đang dùng đầu đọc USB
  const [log, setLog] = useState([]);       // feedback tạm (không tìm thấy / lỗi)
  const [session, setSession] = useState([]); // immediate: đã xác nhận phiên này (có nút Hủy)
  const [manual, setManual] = useState('');  // ô nhập tay / đầu đọc USB (mọi màn)
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false); // quá lâu chưa có hình → gợi ý người dùng

  // ⚠ CALLBACK REF (không dùng useRef): Modal chạy trên Headless UI Portal — lần render ĐẦU sau khi mở,
  // portal chưa có DOM target nên children CHƯA mount ⇒ ref còn null lúc effect chạy ⇒ trước đây ZXing
  // tự tạo <video> ẩn và khung hình đen vĩnh viễn. Dùng state để effect chạy LẠI khi thẻ video vào DOM.
  const [videoEl, setVideoEl] = useState(null);
  const stopRef = useRef(null); // hàm dừng camera ZXing
  const recentRef = useRef(new Map()); // code → ts (chống lặp)
  const bufRef = useRef({ s: '', t: 0, timer: null }); // buffer bắt phím đầu đọc mã vạch
  const idRef = useRef(0);
  // Giữ props mới nhất cho vòng lặp camera (effect chỉ chạy lại theo open/mode).
  const stateRef = useRef({});
  stateRef.current = { rows, getCodes, getBarcodes, getHsktBarcodes, getGomSetKey, matchMultiple, canSelect, isSelected, onToggle, immediate, onScanAction, actionLabel, primaryLabel, disabledScan };

  useEffect(() => {
    if (open) { setLog([]); setSession([]); setManual(''); recentRef.current = new Map(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pushLog = useCallback((text, okFlag) => {
    idRef.current += 1;
    const id = idRef.current;
    setLog((l) => [{ id, text, ok: okFlag }, ...l].slice(0, 6));
  }, []);

  // Mở rộng kết quả quét sang CẢ NHÓM GOM SET: quét 1 code phần (hoặc barcode HSKT/đợt vải) của phần in
  // có gom set ⇒ mọi phần in cùng nhóm cũng hiện lên / được xác nhận theo.
  const withGomSet = useCallback((matched) => {
    const s = stateRef.current;
    if (typeof s.getGomSetKey !== 'function' || !matched.length) return matched;
    const keys = new Set(matched.map((r) => s.getGomSetKey(r)).filter(Boolean));
    if (!keys.size) return matched;
    const seenIds = new Set(matched.map((r) => getId(r)));
    const extra = s.rows.filter((r) => !seenIds.has(getId(r)) && keys.has(s.getGomSetKey(r)));
    return extra.length ? [...matched, ...extra] : matched;
  }, [getId]);

  const matchRows = useCallback((raw, kind) => {
    const s = stateRef.current;
    const c = normStr(raw);
    if (!c) return [];
    // Thứ tự tra cột theo LOẠI MÃ quét được:
    //  • 'qr'      → QR = CODE PHẦN (ưu tiên code phần)
    //  • 'barcode' → mã vạch 1D = BARCODE HSKT (ưu tiên HSKT), rồi barcode đợt vải (đầu đọc USB ở READY)
    //  • 'camera'/khác (nhập tay, không rõ loại) → thử lần lượt cả ba
    // getHsktBarcodes (forceMulti): trúng barcode HSKT → CHỌN CẢ NHÓM phần in cùng HSKT (dù matchMultiple=false).
    const getterList = kind === 'barcode'
      ? [[s.getHsktBarcodes, true], [s.getBarcodes, false], [s.getCodes, false]]
      : kind === 'qr'
        ? [[s.getCodes, false], [s.getHsktBarcodes, true], [s.getBarcodes, false]]
        : [[s.getCodes, false], [s.getBarcodes, false], [s.getHsktBarcodes, true]];
    const list = getterList.filter(([g]) => typeof g === 'function');
    const lc = looseStr(raw);
    // 3 LƯỢT (mỗi lượt quét HẾT các cột theo thứ tự ưu tiên trên, rồi mới xuống lượt sau) —
    // để một cột ưu tiên khớp "lỏng" không cướp mất cột sau khớp chính xác:
    //  1. 'exact'      : bằng nhau (kể cả sau khi bỏ dấu phân cách)
    //  2. 'rowHasScan' : giá trị trong DB CHỨA mã vừa quét (gõ tay thiếu, quét được phần đầu)
    //  3. 'scanHasRow' : mã vừa quét CHỨA giá trị trong DB — ⚠ CA CHÍNH của lỗi "quét QR code phần
    //     không ra": QR trên phiếu giấy thường mang THÊM dữ liệu quanh code phần (tiền tố/hậu tố/
    //     URL/nhiều trường ghép), payload DÀI HƠN code phần nên 2 lượt trên đều trượt.
    const test = (mode) => {
      for (const [getters, forceMulti] of list) {
        let best = 0;
        let pool = [];
        for (const r of s.rows) {
          let score = 0;
          for (const v of (getters(r) || [])) {
            if (!v) continue;
            const nv = normStr(v);
            const lv = looseStr(v);
            if (!nv) continue;
            const hit = mode === 'exact'
              ? (nv === c || (!!lv && lv === lc))
              : mode === 'rowHasScan'
                ? nv.includes(c)
                // Chặn khớp rác: chỉ nhận giá trị đủ dài (≥4) mới cho phép "mã quét chứa giá trị DB".
                : nv.length >= 4 && (c.includes(nv) || (lv.length >= 4 && lc.includes(lv)));
            if (hit && nv.length > score) score = nv.length;
          }
          if (!score) continue;
          // Giữ các dòng khớp bằng giá trị DÀI NHẤT (khớp cụ thể nhất) → giảm khớp nhầm ở lượt 3.
          if (score > best) { best = score; pool = [r]; } else if (score === best) pool.push(r);
        }
        if (pool.length) return withGomSet((s.matchMultiple || forceMulti) ? pool : [pool[0]]);
      }
      return null;
    };
    return test('exact') || test('rowHasScan') || test('scanHasRow') || [];
  }, [withGomSet]);

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
    let matched = matchRows(raw, kind);
    // Khớp được nhưng dòng KHÔNG đủ điều kiện chọn → nêu RÕ lý do (đừng để im lặng như "không thấy").
    if (matched.length && typeof s.canSelect === 'function') {
      const blocked = [];
      const okRows = [];
      matched.forEach((r) => {
        const v = s.canSelect(r);
        if (v === true) okRows.push(r);
        else blocked.push(`${s.primaryLabel(r)}: ${typeof v === 'string' && v ? v : 'chưa đủ điều kiện chọn'}`);
      });
      blocked.slice(0, 3).forEach((m) => pushLog(`✗ ${m}`, false));
      matched = okRows;
      if (!matched.length) return;
    }
    if (!matched.length) {
      // Hiện RÕ loại mã + nguyên văn payload đọc được: nếu quét QR mà dòng này KHÔNG hiện thì camera
      // chưa đọc được QR; hiện mà báo "không thấy" thì payload khác dữ liệu trong danh sách.
      const k = KIND_LABEL[kind];
      pushLog(`Không thấy${k ? ` (${k})` : ''} "${String(raw).trim()}"`, false);
      return;
    }
    if (s.immediate) { matched.forEach((row) => doImmediate(row)); return; }
    matched.forEach((row) => { if (!s.isSelected(row)) s.onToggle(row); });
    pushLog(`＋ ${s.primaryLabel(matched[0])}${matched.length > 1 ? ` (${matched.length} dòng)` : ''}`, true);
  }, [matchRows, doImmediate, pushLog]);

  // ---- Camera đa định dạng (QR + mã vạch 1D, liên tục) ----
  const stopCam = useCallback(() => {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; }
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open || !camMode || !videoEl) { stopCam(); return undefined; }
    let cancelled = false;
    setError('');
    setReady(false);
    setSlow(false);
    const slowTimer = setTimeout(() => { if (!cancelled) setSlow(true); }, 6000);

    (async () => {
      try {
        // Chỉ quét đúng loại mã đang chọn ('qr' | 'barcode') — xem ghi chú ở cameraDecoder.
        const stopFn = await startCameraDecode(videoEl, (text, kieu) => processScan(text, kieu || mode), mode);
        if (cancelled) { stopFn(); return; }
        stopRef.current = stopFn;
        videoEl.onplaying = () => setReady(true);
        if (!videoEl.paused && videoEl.readyState >= 2) setReady(true); // đã chạy trước khi kịp gắn
        // iOS chặn autoplay (hay gặp trong PWA) → mời bấm vào khung để phát (bấm = user-gesture thật).
        if (stopFn.autoplayBlocked) setSlow(true);
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    })();

    return () => { cancelled = true; clearTimeout(slowTimer); stopCam(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, camMode, videoEl]);

  // BẮT PHÍM đầu đọc mã vạch toàn cục (không cần ô nhập): buffer ký tự, xử lý khi Enter hoặc khi ngừng gõ 120ms.
  // Bỏ qua khi đang gõ trong 1 field (INPUT/TEXTAREA/SELECT — vd ô "Người test") để không nuốt phím.
  useEffect(() => {
    if (!open || !usbMode) return undefined;
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
  }, [open, usbMode, processScan]);

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

        {/* CHỌN LOẠI MÃ — hiện ở MỌI màn quét. Mỗi chế độ chỉ dò 1 nhóm reader (xem ghi chú ở đầu
            component + cameraDecoder): quét chung QR + 1D làm QR rất khó "qua". */}
        <div className="flex gap-2">
          {[
            { v: 'qr', label: 'QR', icon: 'scan-line' },
            { v: 'barcode', label: 'Mã vạch', icon: 'barcode' },
          ].map((o) => (
            <button key={o.v} type="button" onClick={() => setModeSel(o.v)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-control border px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === o.v ? 'border-primary bg-primary-wash/50 text-primary' : 'border-line text-ink-soft hover:text-ink'
              }`}>
              <Icon name={o.icon} size={14} />{o.label}
            </button>
          ))}
        </div>

        {/* ĐẦU ĐỌC USB (chỉ READY trên máy tính): không có camera, bắt phím tự động → tự xác nhận. */}
        {usbMode && (
          <div className="space-y-1">
            <ScanViz />
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">
              <Icon name="barcode" size={14} /> Dùng đầu đọc mã vạch để tích — tự động xác nhận, hiện ngay bên dưới.
            </p>
            <p className="text-center text-xs text-amber-600">
              Đầu đọc mã vạch KHÔNG đọc được QR — muốn quét <b>QR code phần</b> thì bấm <b>QR</b> ở trên.
            </p>
          </div>
        )}

        {/* CAMERA — chỉ đọc đúng loại mã đang chọn (QR hoặc mã vạch 1D) */}
        {camMode && (
          error ? (
            <div className="rounded-control border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>
          ) : (
            <div className="space-y-1">
              {/* BẤM vào khung = user-gesture thật → iOS cho phát video khi autoplay bị chặn (PWA). */}
              <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-card bg-black"
                onClick={() => playVideo(videoEl).then((ok) => { if (ok) { setReady(true); setSlow(false); } })}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={setVideoEl} className="h-full w-full object-cover" muted playsInline autoPlay />
                <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/80" />
              </div>
              <p className="text-center text-xs text-ink-soft">
                {ready
                  ? (mode === 'qr'
                    ? 'Đang quét QR (code phần) — chỉ đọc QR, bấm "Mã vạch" nếu cần quét mã vạch'
                    : 'Đang quét MÃ VẠCH (HSKT / đợt vải) — chọn cả nhóm gom set')
                  : slow
                    ? 'Chưa thấy hình? BẤM vào khung để bật camera (iOS chặn tự phát), hoặc kiểm tra quyền camera.'
                    : 'Đang mở camera...'}
              </p>
            </div>
          )
        )}

        {/* Ô NHẬP TAY / ĐẦU ĐỌC USB — LUÔN có ở mọi màn, mọi chế độ.
            Lý do: chỉ màn READY (usbBarcode) mới bắt phím đầu đọc toàn cục, còn các màn khác dùng camera —
            máy tính không có camera thì trước đây KHÔNG quét được mã vạch HSKT. Ô này nhận cả đầu đọc USB
            (gõ xong tự Enter) lẫn gõ tay, cho mọi loại mã: code phần · barcode đợt vải · barcode HSKT. */}
        <form
          onSubmit={(e) => { e.preventDefault(); processScan(manual, 'camera'); setManual(''); }}
          className="flex items-center gap-2"
        >
          <Icon name="scan" size={16} className="shrink-0 text-ink-soft" />
          {/* ⚠ `text-base` (16px) là BẮT BUỘC, KHÔNG hạ xuống text-sm: iOS Safari TỰ PHÓNG TO cả trang
              khi focus input có font-size < 16px, và vì viewport không đặt `maximum-scale` nên nó
              KHÔNG tự thu lại ⇒ đang mở camera quét mà bấm vào ô này là giao diện phóng to kẹt luôn
              (lỗi đã gặp thật trên PWA iPhone). Cách chuẩn là để font ≥ 16px, không phải chặn zoom. */}
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Quét đầu đọc / nhập mã: code phần · barcode HSKT · barcode đợt vải"
            className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-base md:text-sm text-ink outline-none focus:border-primary"
          />
          <Button type="submit" variant="secondary" disabled={!manual.trim()}>Thêm</Button>
        </form>

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
    </Modal>
  );
}
