import { useEffect, useRef, useState } from 'react';
import { fmtNum } from '../../../utils/format';
import { parseRange } from './ConditionalFormatModal';

// Ký hiệu cột: 0→A, 25→Z, 26→AA...
export function colLabel(n) {
  let s = '';
  let x = n + 1;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}
export const cellKey = (r, c) => `${colLabel(c)}${r + 1}`;

// Parse "AB12" → { r: 11, c: 27 } (0-based). Null nếu sai.
export function parseKey(key) {
  const m = /^([A-Z]+)(\d+)$/.exec(key || '');
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: Number(m[2]) - 1, c: c - 1 };
}

const LOAI_BG = {
  metric: 'bg-primary-wash/40',
  cong_thuc: 'bg-amber-50 dark:bg-amber-950/20',
  danh_sach: 'bg-emerald-50 dark:bg-emerald-950/20',
  hop_kiem: '',
  tha_xuong: '',
  text: '',
  so: '',
};

const SIZE_CLS = { sm: 'text-xs', base: 'text-sm', lg: 'text-base', xl: 'text-lg' };
const ALIGN_CLS = { left: 'text-left', center: 'text-center', right: 'text-right' };
const VALIGN_CLS = { top: 'align-top', giua: 'align-middle', duoi: 'align-bottom' };
const FONT_CLS = { serif: 'font-serif', mono: 'font-mono', sans: 'font-sans' };
export const COL_W = 128; // bề rộng mặc định mỗi cột dữ liệu (px)
export const ROW_H = 36;  // chiều cao mặc định mỗi hàng (px)
const HDR_W = 44;         // bề rộng cột số thứ tự hàng (góc trái)

// Bề rộng cột c (grid.cot_w là map { chỉ-số-cột: px }).
export const colW = (grid, c) => Number(grid?.cot_w?.[c]) || COL_W;
// Chiều cao hàng r (grid.hang_h là map { chỉ-số-hàng: px }).
export const rowH = (grid, r) => Number(grid?.hang_h?.[r]) || ROW_H;

// ---- KHỐI DANH SÁCH: trải dữ liệu dataset lên lưới từ ô neo ----
// Trả { map: { cellKey: {text, kieu, la_dau} }, maxRow, anchors: [{key,r,c,rows,cols}] }.
// Hàng đầu (ô neo) = tiêu đề cột; các hàng sau = dữ liệu. `locHang` lọc client-side theo từng cột.
// Export để `exportReportExcel` dùng CHUNG — Excel phải ra đúng những gì màn hình hiện.
export function buildDsMap(cells, danhSach, locHang) {
  const map = {};
  const anchors = [];
  let maxRow = 0;
  Object.entries(cells).forEach(([key, cell]) => {
    if (!cell || cell.loai !== 'danh_sach') return;
    const p = parseKey(key);
    const blk = danhSach?.[key];
    if (!p || !blk || !blk.cot?.length) return;
    const f = locHang?.[key] || {};
    const rows = (blk.rows || []).filter((row) => blk.cot.every((col) => {
      const q = (f[col.key] || '').trim().toLowerCase();
      return !q || String(row[col.key] ?? '').toLowerCase().includes(q);
    }));
    blk.cot.forEach((col, i) => {
      map[cellKey(p.r, p.c + i)] = { text: col.ten, kieu: 'text', la_dau: true };
    });
    rows.forEach((row, ri) => blk.cot.forEach((col, ci) => {
      const v = row[col.key];
      map[cellKey(p.r + 1 + ri, p.c + ci)] = {
        text: v == null || v === '' ? '' : String(v),
        kieu: col.kieu || 'text',
      };
    }));
    anchors.push({ key, r: p.r, c: p.c, rows: rows.length, cols: blk.cot.length, cot: blk.cot });
    maxRow = Math.max(maxRow, p.r + 1 + rows.length);
  });
  return { map, maxRow, anchors };
}

const toNum = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

// Giá trị ô để so khớp điều kiện: { text, num }.
function cellValue(cell, res, mode) {
  if (mode === 'view') {
    if (!res) return { text: cell?.loai === 'text' ? (cell.gia_tri || '') : '', num: null };
    if (res.kieu === 'bool') return { text: res.value ? 'TRUE' : 'FALSE', num: res.value ? 1 : 0 };
    const n = Number(res.value);
    return { text: String(res.value ?? ''), num: Number.isFinite(n) ? n : null };
  }
  if (!cell) return { text: '', num: null };
  if (cell.loai === 'so') { const n = Number(cell.gia_tri); return { text: String(cell.gia_tri ?? ''), num: Number.isFinite(n) ? n : null }; }
  if (cell.loai === 'hop_kiem') return { text: cell.gia_tri ? 'TRUE' : 'FALSE', num: cell.gia_tri ? 1 : 0 };
  return { text: cell.gia_tri || '', num: null };
}

// Một quy tắc định dạng có điều kiện có khớp ô hay không.
function matchDieuKien(r, text, num) {
  const t = (text ?? '').toString();
  const a = toNum(r.v1); const b = toNum(r.v2);
  switch (r.toan_tu) {
    case 'khong_trong': return t.trim() !== '';
    case 'trong': return t.trim() === '';
    case 'chua': return t.toLowerCase().includes(String(r.v1 || '').toLowerCase());
    case 'khong_chua': return !t.toLowerCase().includes(String(r.v1 || '').toLowerCase());
    case 'bang': return t === String(r.v1) || (num != null && a != null && num === a);
    case 'khac': return !(t === String(r.v1) || (num != null && a != null && num === a));
    case 'lon_hon': return num != null && a != null && num > a;
    case 'lon_hon_bang': return num != null && a != null && num >= a;
    case 'nho_hon': return num != null && a != null && num < a;
    case 'nho_hon_bang': return num != null && a != null && num <= a;
    case 'giua': return num != null && a != null && b != null && num >= Math.min(a, b) && num <= Math.max(a, b);
    default: return false;
  }
}

// Định dạng số/kiểu dữ liệu theo dinh_dang_so của ô.
export function fmtSo(value, kieuSo) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  switch (kieuSo) {
    case 'raw': return String(n);
    case 'percent': return `${fmtNum(n)}%`;
    case 'dp2': return n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'currency': return `${fmtNum(n)} ₫`;
    case 'thousand':
    default: return fmtNum(n);
  }
}

// Chuỗi hiển thị của 1 ô. Trả { text, isCheck?, checked? }.
function display(cell, res, mode, metricName) {
  const dd = cell?.dinh_dang || {};
  if (mode === 'view') {
    if (cell?.loai === 'hop_kiem') return { isCheck: true, checked: !!cell.gia_tri };
    if (cell?.loai === 'tha_xuong') return { text: cell.gia_tri || '' };
    if (!res) return { text: cell?.loai === 'text' ? (cell.gia_tri || '') : '' };
    if (res.loi) return { text: res.value };
    if (res.kieu === 'text') return { text: res.value };
    if (res.kieu === 'bool') return { isCheck: true, checked: !!res.value };
    return { text: fmtSo(res.value, dd.dinh_dang_so) };
  }
  if (!cell) return { text: '' };
  if (cell.loai === 'text') return { text: cell.gia_tri || '' };
  if (cell.loai === 'so') return { text: fmtSo(cell.gia_tri ?? '', dd.dinh_dang_so) };
  if (cell.loai === 'metric') return { text: metricName(cell.metric) };
  if (cell.loai === 'cong_thuc') return { text: `=${cell.bieu_thuc || ''}` };
  if (cell.loai === 'hop_kiem') return { isCheck: true, checked: !!cell.gia_tri };
  if (cell.loai === 'tha_xuong') return { text: cell.gia_tri || '—' };
  return { text: '' };
}

// Chuỗi thô để nhập inline.
function rawOf(cell) {
  if (!cell) return '';
  if (cell.loai === 'cong_thuc') return `=${cell.bieu_thuc || ''}`;
  if (cell.loai === 'so') return String(cell.gia_tri ?? '');
  if (cell.loai === 'text') return cell.gia_tri || '';
  return '';
}

// grid: { so_cot, so_hang, o, merges, dinh_dang }; ketQua: map value; mode 'design'|'view'.
// selected: Set<key> (đa chọn) hoặc string đơn.
// Tương tác (design + editable): kéo chọn vùng (mousedown/enter), nhập trực tiếp (double-click).
export default function ReportGrid({
  grid, ketQua = {}, mode = 'design', selected, metricsByMa = {},
  editable = false, danhSach = {}, datasetsByMa = {},
  onCellMouseDown, onCellMouseEnter, onEditCommit, onToggleCheck, onSelectDropdown, onDropMetric,
  onColResize,
}) {
  const cells = grid?.o || {};
  // Bộ lọc theo hàng của khối danh sách: { [ô neo]: { [cột]: 'chuỗi lọc' } } — thuần client, không lưu DB.
  const [locHang, setLocHang] = useState({});
  const ds = buildDsMap(cells, danhSach, locHang);
  const soCot = grid?.so_cot || 8;
  // Lưới TỰ NỞ đủ chứa dữ liệu khối danh sách (dataset có bao nhiêu dòng thì hiện bấy nhiêu).
  const soHang = Math.max(grid?.so_hang || 20, ds.maxRow);
  const merges = grid?.merges || [];
  const xenKe = !!(grid?.dinh_dang?.mau_xen_ke);
  const dieuKien = (grid?.dinh_dang?.dieu_kien || [])
    .map((r) => ({ ...r, _range: parseRange(r.vung, parseKey) }))
    .filter((r) => r._range);
  const metricName = (ma) => metricsByMa[ma]?.ten || ma;
  const selSet = selected instanceof Set ? selected : (selected ? new Set([selected]) : new Set());

  const [edit, setEdit] = useState(null); // { key, val }
  const inputRef = useRef(null);
  useEffect(() => { if (edit && inputRef.current) inputRef.current.focus(); }, [edit]);

  const startEdit = (key) => {
    if (!editable) return;
    const c = cells[key];
    // Các loại này chỉnh ở panel/click, không nhập trực tiếp. Ô do khối danh sách đổ ra cũng không sửa tay.
    if (c && ['metric', 'hop_kiem', 'tha_xuong', 'danh_sach'].includes(c.loai)) return;
    if (ds.map[key]) return;
    setEdit({ key, val: rawOf(c) });
  };
  const commit = () => {
    if (!edit) return;
    if (onEditCommit) onEditCommit(edit.key, edit.val);
    setEdit(null);
  };

  // Bản đồ merge: anchor → span; các ô bị nuốt → hidden.
  const spanByKey = {};
  const hidden = new Set();
  merges.forEach((m) => {
    const p = parseKey(m.o);
    if (!p) return;
    const rs = Math.max(1, m.r || 1);
    const cs = Math.max(1, m.c || 1);
    spanByKey[m.o] = { rowSpan: rs, colSpan: cs };
    for (let dr = 0; dr < rs; dr += 1) {
      for (let dc = 0; dc < cs; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        hidden.add(cellKey(p.r + dr, p.c + dc));
      }
    }
  });

  // ---- CỐ ĐỊNH (freeze) hàng/cột: { hang, cot } — hàng đầu dính đỉnh, cột đầu dính trái.
  const fz = grid?.dong_bang || {};
  const fzHang = Math.max(0, Number(fz.hang) || 0);
  const fzCot = Math.max(0, Number(fz.cot) || 0);
  // Vị trí `left` của cột c khi dính = 44px (cột STT) + tổng bề rộng các cột trước.
  const leftOf = (c) => {
    let x = HDR_W;
    for (let i = 0; i < c; i += 1) x += colW(grid, i);
    return x;
  };
  // `top` của hàng r khi dính = chiều cao hàng tiêu đề (A/B/C…) + tổng chiều cao các hàng trước.
  const topOf = (r) => {
    let y = 28;
    for (let i = 0; i < r; i += 1) y += rowH(grid, i);
    return y;
  };
  const fzCell = (r, c) => {
    const s = {};
    if (c < fzCot) { s.position = 'sticky'; s.left = leftOf(c); s.zIndex = 12; }
    if (r < fzHang) { s.position = 'sticky'; s.top = topOf(r); s.zIndex = c < fzCot ? 14 : 11; }
    return s;
  };

  // Kéo mép phải tiêu đề cột để đổi bề rộng (chỉ ở chế độ thiết kế).
  const startResize = (c, e) => {
    if (!onColResize) return;
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX; const w0 = colW(grid, c);
    const move = (ev) => onColResize(c, Math.max(48, w0 + ev.clientX - x0));
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  return (
    <div className="overflow-auto rounded-card border border-line max-h-[calc(100vh-16rem)]">
      {/* table-fixed + colgroup: cột có bề rộng cố định → "xuống dòng" mới bẻ dòng đúng
          khi nội dung dài hơn ô (thay vì cột nở ra theo nội dung). */}
      <table className={`w-max table-fixed border-collapse text-sm ${mode === 'design' ? 'select-none' : ''}`}>
        <colgroup>
          <col style={{ width: HDR_W }} />
          {Array.from({ length: soCot }).map((_, c) => <col key={c} style={{ width: colW(grid, c) }} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 border border-line bg-surface-muted" style={{ width: HDR_W }} />
            {Array.from({ length: soCot }).map((_, c) => (
              <th key={c}
                style={c < fzCot ? { position: 'sticky', left: leftOf(c), zIndex: 25 } : undefined}
                className="sticky top-0 z-20 border border-line bg-surface-muted px-2 py-1 text-xs font-semibold text-ink-soft">
                <span className="relative block">
                  {colLabel(c)}
                  {mode === 'design' && onColResize && (
                    // Tay cầm kéo bề rộng cột — nằm ở mép phải ô tiêu đề.
                    <span onMouseDown={(e) => startResize(c, e)}
                      title={`Kéo để đổi bề rộng cột ${colLabel(c)} (${colW(grid, c)}px)`}
                      className="absolute -right-2 top-0 h-full w-2 cursor-col-resize hover:bg-primary/40" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: soHang }).map((_, r) => (
            <tr key={r} style={{ height: rowH(grid, r) }}>
              <td
                style={r < fzHang ? { position: 'sticky', left: 0, top: topOf(r), zIndex: 15 } : undefined}
                className="sticky left-0 z-10 border border-line bg-surface-muted px-2 py-1 text-center text-xs font-medium text-ink-soft">
                {r + 1}
              </td>
              {Array.from({ length: soCot }).map((_, c) => {
                const key = cellKey(r, c);
                if (hidden.has(key)) return null;
                const cell = cells[key];
                const res = ketQua[key];
                const dsc = ds.map[key];
                const isSel = selSet.has(key);
                const ddBase = cell?.dinh_dang || {};
                // Định dạng có điều kiện: gộp đè lên định dạng gốc theo thứ tự quy tắc.
                let cfmt = null;
                if (dieuKien.length) {
                  const p = parseKey(key);
                  const { text, num } = cellValue(cell, res, mode);
                  for (const rl of dieuKien) {
                    const rg = rl._range;
                    if (p && p.r >= rg.r0 && p.r <= rg.r1 && p.c >= rg.c0 && p.c <= rg.c1 && matchDieuKien(rl, text, num)) {
                      cfmt = { ...(cfmt || {}), ...(rl.dinh_dang || {}) };
                    }
                  }
                }
                const dd = cfmt ? { ...ddBase, ...cfmt } : ddBase;
                const span = spanByKey[key] || {};
                const bg = mode === 'design' && cell ? LOAI_BG[cell.loai] || '' : '';
                const err = mode === 'view' && res?.loi;
                const zebra = xenKe && mode === 'view' && r % 2 === 1 && !dd.mau_nen;
                const disp = display(cell, res, mode, metricName);
                const editing = edit && edit.key === key;
                const deco = [dd.gach_chan && 'underline', dd.gach_ngang && 'line-through'].filter(Boolean).join(' ');

                const cls = [
                  'border border-line px-2 py-1',
                  VALIGN_CLS[dd.can_doc] || 'align-middle',
                  err ? 'bg-rose-50 text-danger dark:bg-rose-950/20' : bg,
                  dsc?.la_dau ? 'bg-surface-muted' : '',
                  zebra ? 'bg-surface-muted/40' : '',
                  SIZE_CLS[dd.co_chu] || 'text-sm',
                  FONT_CLS[dd.phong_chu] || '',
                  dd.dam ? 'font-semibold' : '',
                  dd.nghieng ? 'italic' : '',
                  dd.vien_dam ? 'border-2 border-ink/60' : '',
                  // Mặc định: SỐ căn phải (tabular), CHỮ/còn lại căn TRÁI (kể cả chế độ Xem).
                  // Ô khối danh sách: theo `kieu` của cột dataset (tiêu đề luôn căn trái).
                  ALIGN_CLS[dd.can_le]
                    || ((dsc && !dsc.la_dau && dsc.kieu === 'so')
                      || (!dsc && (cell?.loai === 'so' || (mode === 'view' && res && res.kieu !== 'text' && res.kieu !== 'bool' && !res.loi)))
                      ? 'text-right tabular-nums' : 'text-left'),
                  editable && mode === 'design' ? 'cursor-cell' : (mode === 'view' ? '' : 'cursor-pointer'),
                ].filter(Boolean).join(' ');

                const style = { ...fzCell(r, c) };
                if (style.position === 'sticky' && !dd.mau_nen) style.backgroundColor = 'var(--surface, #fff)';
                if (dd.mau_chu) style.color = dd.mau_chu;
                if (dd.mau_nen && !err) style.backgroundColor = dd.mau_nen;
                if (deco) style.textDecorationLine = deco;
                // Viền + ô đang chọn — vẽ bằng box-shadow inset (không bị "border-collapse"
                // của bảng nuốt mất cạnh; ô chọn hiện đủ 4 cạnh kể cả cột lẻ).
                const sh = [];
                if (isSel && mode === 'design') sh.push('inset 0 0 0 2px #0058be');
                if (dd.vien && typeof dd.vien === 'object') {
                  const t = dd.vien_day === 'dam' ? 2 : 1;
                  const bc = dd.vien_mau || '#000000';
                  if (dd.vien.tren) sh.push(`inset 0 ${t}px 0 0 ${bc}`);
                  if (dd.vien.duoi) sh.push(`inset 0 -${t}px 0 0 ${bc}`);
                  if (dd.vien.trai) sh.push(`inset ${t}px 0 0 0 ${bc}`);
                  if (dd.vien.phai) sh.push(`inset -${t}px 0 0 0 ${bc}`);
                }
                if (sh.length) style.boxShadow = sh.join(', ');

                // Nội dung ô
                let inner;
                if (dsc) {
                  // Ô thuộc KHỐI DANH SÁCH: hàng đầu = tiêu đề cột (kèm ô lọc), các hàng sau = dữ liệu.
                  const anc = ds.anchors.find((a) => a.r === r && a.c <= c && c < a.c + a.cols);
                  const col = anc && anc.cot[c - anc.c];
                  const soCan = dsc.kieu === 'so';
                  inner = dsc.la_dau ? (
                    <div>
                      <div className="truncate text-xs font-semibold uppercase tracking-wide text-ink-soft" title={dsc.text}>{dsc.text}</div>
                      {mode === 'view' && anc && col && (
                        <input
                          value={(locHang[anc.key] || {})[col.key] || ''}
                          onChange={(e) => setLocHang((m) => ({ ...m, [anc.key]: { ...(m[anc.key] || {}), [col.key]: e.target.value } }))}
                          placeholder="Lọc…"
                          className="mt-0.5 h-5 w-full rounded border border-line bg-surface px-1 text-[11px] font-normal normal-case outline-none focus:border-primary" />
                      )}
                    </div>
                  ) : (
                    <span className={`block ${dd.xuong_dong ? 'whitespace-pre-wrap break-words' : 'truncate'}`} title={dsc.text}>
                      {soCan ? fmtSo(dsc.text, dd.dinh_dang_so) : dsc.text}
                    </span>
                  );
                } else if (mode === 'design' && cell?.loai === 'danh_sach') {
                  // Ô NEO khối danh sách khi CHƯA có dữ liệu (chưa Xem trước) — hiện nhãn nguồn.
                  inner = (
                    <span className="block truncate text-xs font-semibold text-primary">
                      <span className="mr-1 rounded bg-primary/20 px-1 text-[10px] font-bold uppercase">DS</span>
                      {datasetsByMa[cell.ds?.nguon]?.ten || cell.ds?.nguon || 'Chưa chọn nguồn'}
                    </span>
                  );
                } else if (editing) {
                  inner = (
                    <input ref={inputRef} value={edit.val}
                      onChange={(e) => setEdit({ key, val: e.target.value })}
                      onBlur={commit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commit(); }
                        else if (e.key === 'Escape') { e.preventDefault(); setEdit(null); }
                      }}
                      className="w-full min-w-[90px] bg-transparent text-sm outline-none" />
                  );
                } else if (mode === 'design' && editable && cell?.loai === 'tha_xuong') {
                  inner = (
                    <select value={cell.gia_tri || ''}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => onSelectDropdown && onSelectDropdown(key, e.target.value)}
                      className="w-full bg-transparent text-sm outline-none">
                      <option value="">— chọn —</option>
                      {(cell.tuy_chon || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  );
                } else if (disp.isCheck) {
                  inner = (
                    <span
                      onMouseDown={(e) => { if (mode === 'design' && editable && cell?.loai === 'hop_kiem') { e.stopPropagation(); e.preventDefault(); onToggleCheck && onToggleCheck(key); } }}
                      className="block text-center text-base">{disp.checked ? '☑' : '☐'}</span>
                  );
                } else {
                  const isMetricDesign = cell?.loai === 'metric' && mode === 'design';
                  inner = (
                    <span
                      // Xuống dòng: bẻ dòng trong bề rộng cột cố định; nếu không thì cắt bớt (…).
                      className={`block ${dd.xuong_dong ? 'whitespace-pre-wrap break-words' : 'truncate'} ${cell?.loai === 'cong_thuc' && mode === 'design' ? 'font-mono text-xs text-amber-700 dark:text-amber-400' : ''}`}
                    >
                      {isMetricDesign && (
                        <span className="mr-1 rounded bg-primary/20 px-1 text-[10px] font-bold uppercase text-primary">Σ</span>
                      )}
                      {disp.text}
                    </span>
                  );
                }

                return (
                  <td key={c}
                    rowSpan={span.rowSpan} colSpan={span.colSpan}
                    onMouseDown={(e) => { if (mode === 'design' && !editing && onCellMouseDown) onCellMouseDown(key, e); }}
                    onMouseEnter={() => { if (mode === 'design' && !editing && onCellMouseEnter) onCellMouseEnter(key); }}
                    onDragOver={(e) => { if (mode === 'design' && editable && onDropMetric) e.preventDefault(); }}
                    onDrop={(e) => {
                      if (mode !== 'design' || !editable || !onDropMetric) return;
                      const ma = e.dataTransfer.getData('text/metric');
                      if (ma) { e.preventDefault(); onDropMetric(key, ma); }
                    }}
                    onDoubleClick={() => startEdit(key)}
                    title={mode === 'view'
                      ? (!dd.xuong_dong && disp.text ? String(disp.text) : undefined)
                      : (cell?.loai === 'metric' ? metricsByMa[cell.metric]?.mo_ta : undefined)}
                    style={style}
                    className={`h-9 ${cls}`}>
                    {inner}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
