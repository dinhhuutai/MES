import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import Icon from '../../../components/common/Icon';
import { Field, Input, Select, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import ReportGrid, { parseKey, cellKey } from '../components/ReportGrid';
import { ColorPopover, BorderPopover } from '../components/formatControls';
import ConditionalFormatModal from '../components/ConditionalFormatModal';
import MetricPalette from '../components/MetricPalette';
import MetricPickerModal from '../components/MetricPickerModal';
import {
  getReport, getMetrics, updateReport, undoReport, renderReport, reportHistory,
} from '../../../services/baoCaoService';

const LOAI_OPTS = [
  { v: '', label: '— Trống —' },
  { v: 'text', label: 'Văn bản (text)' },
  { v: 'so', label: 'Số nhập tay' },
  { v: 'metric', label: 'Dữ liệu hệ thống (metric)' },
  { v: 'cong_thuc', label: 'Công thức (+ − × ÷, ngoặc)' },
  { v: 'hop_kiem', label: 'Hộp kiểm (☑/☐)' },
  { v: 'tha_xuong', label: 'Trình thả xuống' },
];

const SIZE_OPTS = [{ v: 'sm', label: 'Nhỏ' }, { v: 'base', label: 'Vừa' }, { v: 'lg', label: 'Lớn' }, { v: 'xl', label: 'Rất lớn' }];
// Định dạng kiểu dữ liệu (hiển thị) cho ô số/metric/công thức.
const SO_OPTS = [
  { v: 'thousand', label: 'Số (ngăn cách nghìn)' }, { v: 'raw', label: 'Số thô' },
  { v: 'percent', label: 'Phần trăm %' }, { v: 'dp2', label: '2 số lẻ' },
  { v: 'currency', label: 'Tiền tệ (₫)' },
];
// Phông chữ.
const FONT_OPTS = [
  { v: 'sans', label: 'Mặc định' }, { v: 'serif', label: 'Có chân (Serif)' }, { v: 'mono', label: 'Đơn cách (Mono)' },
];

// Rectangle bao 2 ô key.
function rectKeys(a, b) {
  const pa = parseKey(a); const pb = parseKey(b);
  if (!pa || !pb) return new Set([b]);
  const r0 = Math.min(pa.r, pb.r); const r1 = Math.max(pa.r, pb.r);
  const c0 = Math.min(pa.c, pb.c); const c1 = Math.max(pa.c, pb.c);
  const s = new Set();
  for (let r = r0; r <= r1; r += 1) for (let c = c0; c <= c1; c += 1) s.add(cellKey(r, c));
  return s;
}

export default function ReportDesignerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const canDesign = can('BAOCAO_DESIGN');

  const [rep, setRep] = useState(null);
  const [name, setName] = useState('');
  const [grid, setGrid] = useState({ so_cot: 8, so_hang: 20, o: {}, merges: [], dinh_dang: {} });
  const [metrics, setMetrics] = useState([]);
  const [selected, setSelected] = useState(() => new Set()); // đa chọn
  const [anchor, setAnchor] = useState(null); // ô neo (chỉnh nội dung)
  const [mode, setMode] = useState('design'); // design | view
  const [ketQua, setKetQua] = useState({});
  const [coTheHoanTac, setCoTheHoanTac] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogQ, setCatalogQ] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [metricPickOpen, setMetricPickOpen] = useState(false); // modal chọn chỉ số cho ô
  const [colorPop, setColorPop] = useState(null); // 'chu' | 'nen' | null
  const [borderPop, setBorderPop] = useState(false);
  const [cfOpen, setCfOpen] = useState(false);

  // Kéo chọn vùng ô (như Google Sheets).
  const dragging = useRef(false);
  const dragAnchor = useRef(null);
  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const metricsByMa = useMemo(() => Object.fromEntries(metrics.map((m) => [m.ma, m])), [metrics]);
  const metricGroups = useMemo(() => {
    const g = {};
    metrics.forEach((m) => { (g[m.nhom] = g[m.nhom] || []).push(m); });
    return g;
  }, [metrics]);

  const load = useCallback(async () => {
    try {
      const [r, mt] = await Promise.all([getReport(id), getMetrics()]);
      const d = r.data;
      setRep(d);
      setName(d.ten_bao_cao);
      const nd = d.noi_dung_json || {};
      setGrid({ so_cot: nd.so_cot || 8, so_hang: nd.so_hang || 20, o: nd.o || {}, merges: nd.merges || [], dinh_dang: nd.dinh_dang || {} });
      setCoTheHoanTac(!!d.co_the_hoan_tac);
      setMetrics(mt.data);
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); }
  }, [id, show]);

  useEffect(() => { load(); }, [load]);

  const cell = anchor ? grid.o[anchor] : null;
  const setCell = (key, next) => setGrid((g) => {
    const o = { ...g.o };
    if (next == null) delete o[key]; else o[key] = next;
    return { ...g, o };
  });
  const patchCell = (key, patch) => setGrid((g) => {
    const o = { ...g.o };
    o[key] = { ...(o[key] || { loai: 'text', gia_tri: '' }), ...patch };
    return { ...g, o };
  });
  // Áp định dạng cho mọi ô đang chọn (tạo ô text rỗng nếu chưa có để giữ định dạng).
  const applyFormat = (patch) => setGrid((g) => {
    const o = { ...g.o };
    selected.forEach((key) => {
      const c = o[key] || { loai: 'text', gia_tri: '' };
      o[key] = { ...c, dinh_dang: { ...(c.dinh_dang || {}), ...patch } };
    });
    return { ...g, o };
  });

  // Vùng chọn dạng "A1:C10" (dùng cho định dạng có điều kiện).
  const selectionRange = useMemo(() => {
    const pts = [...selected].map(parseKey).filter(Boolean);
    if (!pts.length) return '';
    const r0 = Math.min(...pts.map((p) => p.r)); const r1 = Math.max(...pts.map((p) => p.r));
    const c0 = Math.min(...pts.map((p) => p.c)); const c1 = Math.max(...pts.map((p) => p.c));
    const a = cellKey(r0, c0); const b = cellKey(r1, c1);
    return a === b ? a : `${a}:${b}`;
  }, [selected]);

  // Áp viền theo preset (biết vị trí ô trong vùng chọn để làm "Ngoài/Trong…").
  const applyBorder = (preset, mau, day) => setGrid((g) => {
    const pts = [...selected].map(parseKey).filter(Boolean);
    if (!pts.length) return g;
    const r0 = Math.min(...pts.map((p) => p.r)); const r1 = Math.max(...pts.map((p) => p.r));
    const c0 = Math.min(...pts.map((p) => p.c)); const c1 = Math.max(...pts.map((p) => p.c));
    const o = { ...g.o };
    selected.forEach((key) => {
      const p = parseKey(key); if (!p) return;
      const c = o[key] || { loai: 'text', gia_tri: '' };
      const dd = { ...(c.dinh_dang || {}) };
      if (preset === 'none') {
        delete dd.vien; delete dd.vien_mau; delete dd.vien_day; delete dd.vien_dam;
      } else {
        const all = preset === 'all';
        const v = {
          tren: all || preset === 'top' || preset === 'horizontal' || (preset === 'outer' && p.r === r0) || (preset === 'inner' && p.r > r0),
          duoi: all || preset === 'bottom' || preset === 'horizontal' || (preset === 'outer' && p.r === r1) || (preset === 'inner' && p.r < r1),
          trai: all || preset === 'left' || preset === 'vertical' || (preset === 'outer' && p.c === c0) || (preset === 'inner' && p.c > c0),
          phai: all || preset === 'right' || preset === 'vertical' || (preset === 'outer' && p.c === c1) || (preset === 'inner' && p.c < c1),
        };
        dd.vien = v; dd.vien_mau = mau; dd.vien_day = day;
      }
      o[key] = { ...c, dinh_dang: dd };
    });
    return { ...g, o };
  });

  // Xóa toàn bộ định dạng của các ô đang chọn (giữ nội dung).
  const clearFormat = () => setGrid((g) => {
    const o = { ...g.o };
    selected.forEach((key) => {
      const c = o[key]; if (!c) return;
      const { dinh_dang, ...rest } = c;
      o[key] = rest;
    });
    return { ...g, o };
  });

  const saveDieuKien = (rules) => setGrid((g) => ({ ...g, dinh_dang: { ...(g.dinh_dang || {}), dieu_kien: rules } }));

  // Gán 1 ô thành metric (giữ định dạng cũ). Dùng cho kéo–thả + bấm chọn từ Bảng dữ liệu.
  const setCellMetric = (key, ma) => setGrid((g) => {
    const o = { ...g.o };
    const dd = o[key]?.dinh_dang;
    o[key] = { loai: 'metric', metric: ma, ...(dd ? { dinh_dang: dd } : {}) };
    return { ...g, o };
  });
  const dropMetric = (key, ma) => { setCellMetric(key, ma); setAnchor(key); setSelected(new Set([key])); };
  const pickMetric = (ma) => {
    if (!selected.size) { show('Chọn 1 ô trước rồi bấm chỉ số (hoặc kéo–thả thẳng vào ô)', 'error'); return; }
    selected.forEach((k) => setCellMetric(k, ma));
  };

  const changeLoai = (loai) => {
    const dd = cell?.dinh_dang;
    const base = dd ? { dinh_dang: dd } : {};
    if (!loai) return setCell(anchor, dd ? { loai: 'text', gia_tri: '', ...base } : null);
    if (loai === 'text') return setCell(anchor, { loai, gia_tri: cell?.gia_tri || '', ...base });
    if (loai === 'so') return setCell(anchor, { loai, gia_tri: cell?.gia_tri ?? 0, ...base });
    if (loai === 'metric') return setCell(anchor, { loai, metric: cell?.metric || metrics[0]?.ma || '', ...base });
    if (loai === 'cong_thuc') return setCell(anchor, { loai, bieu_thuc: cell?.bieu_thuc || '', ...base });
    if (loai === 'hop_kiem') return setCell(anchor, { loai, gia_tri: cell?.gia_tri === true, ...base });
    if (loai === 'tha_xuong') return setCell(anchor, { loai, tuy_chon: cell?.tuy_chon || [], gia_tri: cell?.gia_tri || '', ...base });
    return undefined;
  };

  // Bắt đầu chọn: shift = mở rộng vùng từ neo; thường = neo mới + bắt đầu kéo.
  const onCellMouseDown = (key, e) => {
    if (e && e.shiftKey && dragAnchor.current) { setSelected(rectKeys(dragAnchor.current, key)); return; }
    dragging.current = true;
    dragAnchor.current = key;
    setAnchor(key);
    setSelected(new Set([key]));
  };
  const onCellMouseEnter = (key) => {
    if (dragging.current && dragAnchor.current) setSelected(rectKeys(dragAnchor.current, key));
  };

  // Nhập trực tiếp trong ô: '=' → công thức; số → ô số; còn lại → văn bản. Giữ định dạng cũ.
  const commitCell = (key, raw) => {
    const prev = grid.o[key];
    const dd = prev?.dinh_dang;
    const base = dd ? { dinh_dang: dd } : {};
    const v = (raw ?? '').trim();
    let next;
    if (v === '') next = dd ? { loai: 'text', gia_tri: '', ...base } : null;
    else if (v.startsWith('=')) next = { loai: 'cong_thuc', bieu_thuc: v.slice(1), ...base };
    else if (Number.isFinite(Number(v))) next = { loai: 'so', gia_tri: Number(v), ...base };
    else next = { loai: 'text', gia_tri: raw, ...base };
    setCell(key, next);
  };
  const toggleCheck = (key) => patchCell(key, { loai: 'hop_kiem', gia_tri: !(grid.o[key]?.gia_tri === true) });
  const selectDropdown = (key, val) => patchCell(key, { loai: 'tha_xuong', gia_tri: val });

  // ----- Merge / Unmerge -----
  const mergeSelected = () => {
    if (selected.size < 2) { show('Kéo chọn nhiều ô (hoặc giữ Shift) rồi Hợp nhất', 'error'); return; }
    const pts = [...selected].map(parseKey).filter(Boolean);
    const r0 = Math.min(...pts.map((p) => p.r)); const r1 = Math.max(...pts.map((p) => p.r));
    const c0 = Math.min(...pts.map((p) => p.c)); const c1 = Math.max(...pts.map((p) => p.c));
    const o = cellKey(r0, c0);
    setGrid((g) => {
      // bỏ các merge cũ giao với vùng
      const keep = (g.merges || []).filter((m) => {
        const p = parseKey(m.o); if (!p) return false;
        const overlap = !(p.c + (m.c || 1) - 1 < c0 || p.c > c1 || p.r + (m.r || 1) - 1 < r0 || p.r > r1);
        return !overlap;
      });
      return { ...g, merges: [...keep, { o, r: r1 - r0 + 1, c: c1 - c0 + 1 }] };
    });
    setSelected(new Set([o])); setAnchor(o);
  };
  const unmergeSelected = () => setGrid((g) => ({
    ...g,
    merges: (g.merges || []).filter((m) => {
      const p = parseKey(m.o); if (!p) return true;
      // bỏ merge nếu anchor hoặc vùng của nó giao với các ô đang chọn
      for (const k of selected) {
        const pk = parseKey(k); if (!pk) continue;
        if (pk.r >= p.r && pk.r <= p.r + (m.r || 1) - 1 && pk.c >= p.c && pk.c <= p.c + (m.c || 1) - 1) return false;
      }
      return true;
    }),
  }));

  const toggleZebra = () => setGrid((g) => ({ ...g, dinh_dang: { ...(g.dinh_dang || {}), mau_xen_ke: !g.dinh_dang?.mau_xen_ke } }));

  const doSave = async () => {
    setSaving(true);
    try {
      await updateReport(id, { tenBaoCao: name, noiDungJson: grid });
      show('Đã lưu báo cáo');
      setCoTheHoanTac(true);
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const doUndo = async () => {
    try {
      const res = await undoReport(id);
      const nd = res.data.noi_dung_json || {};
      setGrid({ so_cot: nd.so_cot || 8, so_hang: nd.so_hang || 20, o: nd.o || {}, merges: nd.merges || [], dinh_dang: nd.dinh_dang || {} });
      setCoTheHoanTac(false);
      setMode('design');
      show('Đã hoàn tác về bản trước');
    } catch (e) { show(e.message || 'Hoàn tác thất bại', 'error'); }
  };

  const doPreview = async () => {
    setRendering(true);
    try {
      const res = await renderReport(id, { noiDung: grid });
      setKetQua(res.data.ket_qua || {});
      setMode('view');
    } catch (e) { show(e.message || 'Xem trước lỗi', 'error'); }
    finally { setRendering(false); }
  };

  const doExport = async () => {
    try {
      const res = await renderReport(id, { noiDung: grid });
      const kq = res.data.ket_qua || {};
      const lines = [];
      for (let r = 0; r < grid.so_hang; r += 1) {
        const cols = [];
        for (let c = 0; c < grid.so_cot; c += 1) {
          const v = kq[cellKey(r, c)];
          let s = '';
          if (v) {
            if (v.kieu === 'bool') s = v.value ? 'x' : '';
            else s = String(v.value ?? '');
          }
          cols.push(`"${s.replace(/"/g, '""')}"`);
        }
        lines.push(cols.join(','));
      }
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${rep?.ma_bao_cao || 'bao-cao'}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { show(e.message || 'Xuất lỗi', 'error'); }
  };

  if (!rep) return <div className="py-10 text-center text-ink-soft">Đang tải...</div>;

  const canFmt = canDesign && mode === 'design' && selected.size > 0;
  const FmtBtn = ({ onClick, children, title, active }) => (
    <button type="button" title={title} onClick={onClick} disabled={!canFmt}
      className={`h-8 min-w-8 rounded-control border px-2 text-sm font-semibold transition disabled:opacity-40
        ${active ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink hover:bg-surface-muted'}`}>
      {children}
    </button>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="px-2" onClick={() => navigate('/bao-cao')}><Icon name="chevron-left" size={18} /></Button>
          <div>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canDesign}
              className="w-64 rounded border-0 bg-transparent text-lg font-bold text-ink focus:bg-surface-muted focus:outline-none" />
            <div className="text-xs text-ink-soft">{rep.ma_bao_cao} · chủ: {rep.nguoi_tao || '—'}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'design' ? (
            <Button variant="secondary" icon="eye" loading={rendering} onClick={doPreview}>Xem trước</Button>
          ) : (
            <Button variant="secondary" onClick={() => setMode('design')}>Về thiết kế</Button>
          )}
          {canDesign && <Button icon="history" variant="ghost" onClick={doUndo} disabled={!coTheHoanTac}>Hoàn tác</Button>}
          {canDesign && <Button loading={saving} onClick={doSave}>Lưu</Button>}
          <Button variant="ghost" onClick={doExport}>Xuất CSV</Button>
          <Button variant="ghost" onClick={() => window.print()}>In</Button>
          <Button variant="ghost" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        </div>
      </div>

      {/* Ghi chú realtime + thêm cột/hàng */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="rounded-control bg-primary-wash/50 px-3 py-1.5 text-xs text-ink-soft">
          <Icon name="clock" size={13} className="mr-1 inline" />
          Số liệu hệ thống được lấy <b>realtime</b> lúc Xem trước / Xuất. Mỗi chỉ số tự có mốc thời gian riêng (hôm nay / hiện tại) — không cần chọn kỳ.
        </p>
        {canDesign && mode === 'design' && (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setGrid((g) => ({ ...g, so_cot: g.so_cot + 1 }))}>+ Cột</Button>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setGrid((g) => ({ ...g, so_hang: g.so_hang + 1 }))}>+ Hàng</Button>
            <Button variant={paletteOpen ? 'primary' : 'ghost'} className="px-2.5 py-1 text-xs" onClick={() => setPaletteOpen((v) => !v)}>Bảng dữ liệu</Button>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setCatalogOpen(true)}>Giải thích chỉ số</Button>
          </div>
        )}
        {mode === 'view' && <Badge tone="info">Chế độ xem — hiển thị giá trị đã tính</Badge>}
      </div>

      {/* Thanh công cụ định dạng (Google-Sheets-like) — dính đỉnh khi cuộn */}
      {canDesign && mode === 'design' && (
        <div className="sticky top-0 z-30 mb-3 flex flex-wrap items-center gap-1.5 rounded-card border border-line bg-surface px-3 py-2 shadow-card">
          <FmtBtn title="In đậm" onClick={() => applyFormat({ dam: !(cell?.dinh_dang?.dam) })} active={cell?.dinh_dang?.dam}><b>B</b></FmtBtn>
          <FmtBtn title="In nghiêng" onClick={() => applyFormat({ nghieng: !(cell?.dinh_dang?.nghieng) })} active={cell?.dinh_dang?.nghieng}><i>I</i></FmtBtn>
          <FmtBtn title="Gạch chân" onClick={() => applyFormat({ gach_chan: !(cell?.dinh_dang?.gach_chan) })} active={cell?.dinh_dang?.gach_chan}><span className="underline">U</span></FmtBtn>
          <FmtBtn title="Gạch ngang" onClick={() => applyFormat({ gach_ngang: !(cell?.dinh_dang?.gach_ngang) })} active={cell?.dinh_dang?.gach_ngang}><s>S</s></FmtBtn>
          <span className="mx-1 h-6 w-px bg-line" />
          <select disabled={!canFmt} title="Phông chữ" onChange={(e) => applyFormat({ phong_chu: e.target.value })}
            value={cell?.dinh_dang?.phong_chu || 'sans'}
            className="h-8 rounded-control border border-line px-1.5 text-sm disabled:opacity-40">
            {FONT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <select disabled={!canFmt} title="Cỡ chữ" onChange={(e) => applyFormat({ co_chu: e.target.value })}
            value={cell?.dinh_dang?.co_chu || 'base'}
            className="h-8 rounded-control border border-line px-1.5 text-sm disabled:opacity-40">
            {SIZE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <span className="mx-1 h-6 w-px bg-line" />
          {/* Màu chữ */}
          <div className="relative">
            <button type="button" title="Màu chữ" disabled={!canFmt} onClick={() => setColorPop(colorPop === 'chu' ? null : 'chu')}
              className="flex h-8 items-center gap-1 rounded-control border border-line px-2 text-sm disabled:opacity-40">
              <span className="font-bold" style={{ color: cell?.dinh_dang?.mau_chu || undefined }}>A</span>
              <span className="h-1.5 w-4 rounded" style={{ backgroundColor: cell?.dinh_dang?.mau_chu || '#111827' }} />
            </button>
            <ColorPopover open={colorPop === 'chu'} onClose={() => setColorPop(null)} current={cell?.dinh_dang?.mau_chu}
              onPick={(c) => applyFormat({ mau_chu: c || undefined })} allowNone />
          </div>
          {/* Màu nền */}
          <div className="relative">
            <button type="button" title="Màu nền" disabled={!canFmt} onClick={() => setColorPop(colorPop === 'nen' ? null : 'nen')}
              className="flex h-8 items-center gap-1 rounded-control border border-line px-2 text-sm disabled:opacity-40">
              🖌
              <span className="h-1.5 w-4 rounded border border-line" style={{ backgroundColor: cell?.dinh_dang?.mau_nen || '#ffffff' }} />
            </button>
            <ColorPopover open={colorPop === 'nen'} onClose={() => setColorPop(null)} current={cell?.dinh_dang?.mau_nen}
              onPick={(c) => applyFormat({ mau_nen: c || undefined })} allowNone />
          </div>
          {/* Viền */}
          <div className="relative">
            <button type="button" title="Viền" disabled={!canFmt} onClick={() => setBorderPop((v) => !v)}
              className="h-8 min-w-8 rounded-control border border-line px-2 text-sm disabled:opacity-40">▦</button>
            <BorderPopover open={borderPop && canFmt} onClose={() => setBorderPop(false)} onApply={applyBorder} />
          </div>
          <span className="mx-1 h-6 w-px bg-line" />
          {/* Căn lề ngang */}
          <FmtBtn title="Căn trái" onClick={() => applyFormat({ can_le: 'left' })} active={cell?.dinh_dang?.can_le === 'left'}>⬅</FmtBtn>
          <FmtBtn title="Căn giữa" onClick={() => applyFormat({ can_le: 'center' })} active={cell?.dinh_dang?.can_le === 'center'}>⬌</FmtBtn>
          <FmtBtn title="Căn phải" onClick={() => applyFormat({ can_le: 'right' })} active={cell?.dinh_dang?.can_le === 'right'}>➡</FmtBtn>
          {/* Căn dọc */}
          <FmtBtn title="Căn trên" onClick={() => applyFormat({ can_doc: 'top' })} active={cell?.dinh_dang?.can_doc === 'top'}>⤒</FmtBtn>
          <FmtBtn title="Căn giữa dọc" onClick={() => applyFormat({ can_doc: 'giua' })} active={cell?.dinh_dang?.can_doc === 'giua'}>↕</FmtBtn>
          <FmtBtn title="Căn dưới" onClick={() => applyFormat({ can_doc: 'duoi' })} active={cell?.dinh_dang?.can_doc === 'duoi'}>⤓</FmtBtn>
          <FmtBtn title="Xuống dòng tự động" onClick={() => applyFormat({ xuong_dong: !(cell?.dinh_dang?.xuong_dong) })} active={cell?.dinh_dang?.xuong_dong}>↵</FmtBtn>
          <span className="mx-1 h-6 w-px bg-line" />
          <select disabled={!canFmt} title="Định dạng dữ liệu (số)" onChange={(e) => applyFormat({ dinh_dang_so: e.target.value })}
            value={cell?.dinh_dang?.dinh_dang_so || 'thousand'}
            className="h-8 rounded-control border border-line px-1.5 text-sm disabled:opacity-40">
            {SO_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <FmtBtn title="Xóa định dạng" onClick={clearFormat}>⌫</FmtBtn>
          <span className="mx-1 h-6 w-px bg-line" />
          <Button variant="ghost" className="px-2 py-1 text-xs" disabled={selected.size < 2} onClick={mergeSelected}>Hợp nhất</Button>
          <Button variant="ghost" className="px-2 py-1 text-xs" disabled={selected.size === 0} onClick={unmergeSelected}>Bỏ hợp nhất</Button>
          <Button variant={grid.dinh_dang?.mau_xen_ke ? 'primary' : 'ghost'} className="px-2 py-1 text-xs" onClick={toggleZebra}>Màu xen kẽ</Button>
          <Button variant={grid.dinh_dang?.dieu_kien?.length ? 'primary' : 'ghost'} className="px-2 py-1 text-xs" onClick={() => setCfOpen(true)}>
            Định dạng có điều kiện{grid.dinh_dang?.dieu_kien?.length ? ` (${grid.dinh_dang.dieu_kien.length})` : ''}
          </Button>
          <span className="ml-auto text-xs text-ink-soft">{selected.size > 0 ? `${selected.size} ô đang chọn · kéo/Shift để chọn vùng · bấm đúp để nhập` : 'Kéo chọn ô · bấm đúp để nhập trực tiếp'}</span>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Lưới */}
        <div className="min-w-0 flex-1">
          <ReportGrid grid={grid} ketQua={ketQua} mode={mode} selected={selected} metricsByMa={metricsByMa}
            editable={canDesign}
            onCellMouseDown={onCellMouseDown} onCellMouseEnter={onCellMouseEnter}
            onEditCommit={commitCell} onToggleCheck={toggleCheck} onSelectDropdown={selectDropdown}
            onDropMetric={dropMetric} />
        </div>

        {/* Panel chỉnh ô + Bảng dữ liệu */}
        {mode === 'design' && (
          <div className="w-full shrink-0 space-y-4 lg:w-80">
            {paletteOpen && (
              <MetricPalette metricGroups={metricGroups} hasSelection={selected.size > 0}
                onPick={pickMetric} onClose={() => setPaletteOpen(false)} />
            )}
            <div className="card p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">
                Ô {anchor ? <Badge tone="info">{anchor}</Badge> : <span className="text-ink-soft">— chọn 1 ô —</span>}
              </h3>
              {!anchor ? (
                <p className="text-sm text-ink-soft">Bấm 1 ô để chọn, <b>bấm đúp để nhập trực tiếp</b>. <b>Kéo chuột</b> (hoặc giữ Shift) để chọn vùng rồi định dạng / hợp nhất.</p>
              ) : !canDesign ? (
                <p className="text-sm text-ink-soft">Bạn không có quyền chỉnh sửa.</p>
              ) : (
                <>
                  <Field label="Loại ô">
                    <Select value={cell?.loai || ''} onChange={(e) => changeLoai(e.target.value)}>
                      {LOAI_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </Select>
                  </Field>

                  {cell?.loai === 'text' && (
                    <Field label="Nội dung">
                      <Input value={cell.gia_tri || ''} onChange={(e) => patchCell(anchor, { loai: 'text', gia_tri: e.target.value })} />
                    </Field>
                  )}
                  {cell?.loai === 'so' && (
                    <Field label="Giá trị số">
                      <Input type="number" value={cell.gia_tri ?? ''} onChange={(e) => patchCell(anchor, { loai: 'so', gia_tri: e.target.value === '' ? '' : Number(e.target.value) })} />
                    </Field>
                  )}
                  {cell?.loai === 'metric' && (
                    <>
                      <Field label="Chọn dữ liệu">
                        <button type="button" onClick={() => setMetricPickOpen(true)}
                          className="flex w-full items-center justify-between gap-2 rounded-input border border-line bg-surface px-3 py-2 text-left text-sm hover:border-primary">
                          <span className="min-w-0 truncate text-ink">{metricsByMa[cell.metric]?.ten || '— Bấm để chọn chỉ số —'}</span>
                          <Icon name="chevron-down" size={16} className="shrink-0 text-ink-soft" />
                        </button>
                      </Field>
                      {metricsByMa[cell.metric] && (() => {
                        const m = metricsByMa[cell.metric];
                        return (
                          <div className="-mt-1 mb-3 rounded-card border border-primary/30 bg-primary-wash/40 p-3 text-xs">
                            <div className="mb-1.5 flex items-start justify-between gap-2">
                              <span className="font-semibold text-ink">{m.ten}</span>
                              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary">{m.don_vi || '—'}</span>
                            </div>
                            <p className="leading-relaxed text-ink-soft">{m.mo_ta}</p>
                            <div className="mt-2 grid grid-cols-[54px_1fr] gap-x-2 gap-y-0.5 text-ink-soft">
                              <span className="font-medium text-ink">Nhóm</span><span>{m.nhom}</span>
                              <span className="font-medium text-ink">Mã</span><span className="font-mono">{m.ma}</span>
                            </div>
                            <p className="mt-2 flex items-center gap-1 font-medium text-primary">
                              <Icon name="clock" size={12} /> Tự cập nhật realtime khi Xem trước / Xuất.
                            </p>
                          </div>
                        );
                      })()}
                    </>
                  )}
                  {cell?.loai === 'cong_thuc' && (
                    <Field label="Biểu thức" hint="Tham chiếu ô: A1, B2… · toán tử: + − * / ( )  · vd (A1+B1)*2">
                      <Textarea rows={2} value={cell.bieu_thuc || ''}
                        onChange={(e) => patchCell(anchor, { loai: 'cong_thuc', bieu_thuc: e.target.value })} />
                    </Field>
                  )}
                  {cell?.loai === 'hop_kiem' && (
                    <Field label="Trạng thái">
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input type="checkbox" checked={cell.gia_tri === true}
                          onChange={(e) => patchCell(anchor, { loai: 'hop_kiem', gia_tri: e.target.checked })}
                          className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
                        Đã tích (trong công thức: TRUE=1, FALSE=0)
                      </label>
                    </Field>
                  )}
                  {cell?.loai === 'tha_xuong' && (
                    <>
                      <Field label="Danh sách tùy chọn" hint="Mỗi dòng 1 lựa chọn">
                        <Textarea rows={3} value={(cell.tuy_chon || []).join('\n')}
                          onChange={(e) => patchCell(anchor, { loai: 'tha_xuong', tuy_chon: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />
                      </Field>
                      <Field label="Giá trị đang chọn">
                        <Select value={cell.gia_tri || ''} onChange={(e) => patchCell(anchor, { loai: 'tha_xuong', gia_tri: e.target.value })}>
                          <option value="">— Chọn —</option>
                          {(cell.tuy_chon || []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </Select>
                      </Field>
                    </>
                  )}

                  {cell && (
                    <Button variant="ghost" className="w-full text-danger" onClick={() => setCell(anchor, null)}>Xóa nội dung ô</Button>
                  )}
                  <p className="mt-2 text-xs text-ink-soft">Định dạng (đậm/màu/viền/căn lề…) áp cho <b>{selected.size}</b> ô đang chọn qua thanh công cụ phía trên.</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Danh mục dữ liệu (metric) */}
      <Modal open={catalogOpen} onClose={() => setCatalogOpen(false)} title="Danh mục dữ liệu có sẵn" size="lg">
        <p className="mb-3 rounded-control bg-primary-wash/50 px-3 py-2 text-xs text-ink-soft">
          Đây là các <b>chỉ số hệ thống</b> có thể chèn vào ô (Loại ô → “Dữ liệu hệ thống”). Mỗi chỉ số tự tính <b>realtime</b> lúc Xem trước / Xuất,
          tự mang mốc thời gian riêng: nhóm <b>“… hôm nay”</b> lọc theo ngày hôm nay, nhóm <b>“… (hiện tại)/tổng”</b> là trạng thái hiện tại hoặc lũy kế.
        </p>
        <div className="mb-3">
          <Input placeholder="Tìm theo tên, mã, mô tả…" value={catalogQ} onChange={(e) => setCatalogQ(e.target.value)} />
        </div>
        {(() => {
          const q = catalogQ.trim().toLowerCase();
          const groups = Object.entries(metricGroups)
            .map(([nhom, list]) => [nhom, q ? list.filter((m) => `${m.ten} ${m.ma} ${m.mo_ta} ${nhom}`.toLowerCase().includes(q)) : list])
            .filter(([, list]) => list.length);
          if (!groups.length) return <p className="py-6 text-center text-sm text-ink-soft">Không có chỉ số khớp “{catalogQ}”.</p>;
          return (
            <div className="space-y-4">
              {groups.map(([nhom, list]) => (
                <div key={nhom}>
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                    <span>{nhom}</span>
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium normal-case">{list.length} chỉ số</span>
                  </div>
                  <div className="space-y-1.5">
                    {list.map((m) => (
                      <div key={m.ma} className="rounded-control border border-line p-2.5 hover:border-primary/40 hover:bg-primary-wash/20">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-ink">{m.ten}</span>
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">{m.don_vi || '—'}</span>
                        </div>
                        <div className="mt-0.5 text-xs leading-relaxed text-ink-soft">{m.mo_ta}</div>
                        <div className="mt-1 font-mono text-[10px] text-ink-soft/70">{m.ma}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </Modal>

      <MetricPickerModal open={metricPickOpen} metricGroups={metricGroups} current={cell?.metric}
        onPick={(ma) => { if (anchor) patchCell(anchor, { loai: 'metric', metric: ma }); }}
        onClose={() => setMetricPickOpen(false)} />

      <ConditionalFormatModal open={cfOpen} onClose={() => setCfOpen(false)}
        rules={grid.dinh_dang?.dieu_kien || []} selectionRange={selectionRange} onSave={saveDieuKien} />

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title={`Lịch sử thao tác — ${rep.ma_bao_cao}`} fetcher={(date) => reportHistory(id, date)} />

      <Toast toast={toast} />
    </div>
  );
}
