import { useEffect, useState, useCallback, useMemo } from 'react';
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
import ReportGrid from '../components/ReportGrid';
import {
  getReport, getMetrics, updateReport, undoReport, renderReport, reportHistory,
} from '../../../services/baoCaoService';

const LOAI_OPTS = [
  { v: '', label: '— Trống —' },
  { v: 'text', label: 'Văn bản (text)' },
  { v: 'so', label: 'Số nhập tay' },
  { v: 'metric', label: 'Dữ liệu hệ thống (metric)' },
  { v: 'cong_thuc', label: 'Công thức (+ − × ÷, ngoặc)' },
];

export default function ReportDesignerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const canDesign = can('BAOCAO_DESIGN');

  const [rep, setRep] = useState(null);
  const [name, setName] = useState('');
  const [moTa, setMoTa] = useState('');
  const [grid, setGrid] = useState({ so_cot: 8, so_hang: 20, o: {} });
  const [kyTu, setKyTu] = useState('');
  const [kyDen, setKyDen] = useState('');
  const [metrics, setMetrics] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('design'); // design | view
  const [ketQua, setKetQua] = useState({});
  const [coTheHoanTac, setCoTheHoanTac] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

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
      setMoTa(d.mo_ta || '');
      const nd = d.noi_dung_json || {};
      setGrid({ so_cot: nd.so_cot || 8, so_hang: nd.so_hang || 20, o: nd.o || {} });
      setKyTu(d.ky_tu ? String(d.ky_tu).slice(0, 10) : '');
      setKyDen(d.ky_den ? String(d.ky_den).slice(0, 10) : '');
      setCoTheHoanTac(!!d.co_the_hoan_tac);
      setMetrics(mt.data);
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); }
  }, [id, show]);

  useEffect(() => { load(); }, [load]);

  const cell = selected ? grid.o[selected] : null;
  const setCell = (key, next) => setGrid((g) => {
    const o = { ...g.o };
    if (next == null) delete o[key]; else o[key] = next;
    return { ...g, o };
  });
  const changeLoai = (loai) => {
    if (!loai) return setCell(selected, null);
    if (loai === 'text') return setCell(selected, { loai, gia_tri: cell?.gia_tri || '' });
    if (loai === 'so') return setCell(selected, { loai, gia_tri: cell?.gia_tri ?? 0 });
    if (loai === 'metric') return setCell(selected, { loai, metric: cell?.metric || metrics[0]?.ma || '' });
    if (loai === 'cong_thuc') return setCell(selected, { loai, bieu_thuc: cell?.bieu_thuc || '' });
    return undefined;
  };

  const doSave = async () => {
    setSaving(true);
    try {
      await updateReport(id, { tenBaoCao: name, moTa, noiDungJson: grid, kyTu: kyTu || null, kyDen: kyDen || null });
      show('Đã lưu báo cáo');
      setCoTheHoanTac(true);
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const doUndo = async () => {
    try {
      const res = await undoReport(id);
      const nd = res.data.noi_dung_json || {};
      setGrid({ so_cot: nd.so_cot || 8, so_hang: nd.so_hang || 20, o: nd.o || {} });
      setCoTheHoanTac(false);
      setMode('design');
      show('Đã hoàn tác về bản trước');
    } catch (e) { show(e.message || 'Hoàn tác thất bại', 'error'); }
  };

  const doPreview = async () => {
    setRendering(true);
    try {
      const res = await renderReport(id, { tu: kyTu || undefined, den: kyDen || undefined, noiDung: grid });
      setKetQua(res.data.ket_qua || {});
      setMode('view');
    } catch (e) { show(e.message || 'Xem trước lỗi', 'error'); }
    finally { setRendering(false); }
  };

  const doExport = async () => {
    try {
      const res = await renderReport(id, { tu: kyTu || undefined, den: kyDen || undefined, noiDung: grid });
      const kq = res.data.ket_qua || {};
      const lines = [];
      for (let r = 0; r < grid.so_hang; r += 1) {
        const cols = [];
        for (let c = 0; c < grid.so_cot; c += 1) {
          const key = `${String.fromCharCode(65 + (c % 26))}${r + 1}`;
          const v = kq[key];
          let s = '';
          if (v) s = v.kieu === 'so' && !v.loi ? String(v.value) : String(v.value ?? '');
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

      {/* Kỳ + thêm cột/hàng */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-ink-soft">Kỳ:</span>
          <input type="date" value={kyTu} onChange={(e) => setKyTu(e.target.value)}
            className="h-9 rounded-input border border-line px-2 text-sm" />
          <span className="text-ink-soft">→</span>
          <input type="date" value={kyDen} onChange={(e) => setKyDen(e.target.value)}
            className="h-9 rounded-input border border-line px-2 text-sm" />
        </div>
        {canDesign && mode === 'design' && (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setGrid((g) => ({ ...g, so_cot: g.so_cot + 1 }))}>+ Cột</Button>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setGrid((g) => ({ ...g, so_hang: g.so_hang + 1 }))}>+ Hàng</Button>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setCatalogOpen(true)}>Danh mục dữ liệu</Button>
          </div>
        )}
        {mode === 'view' && <Badge tone="info">Chế độ xem — hiển thị giá trị đã tính</Badge>}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Lưới */}
        <div className="min-w-0 flex-1">
          <ReportGrid grid={grid} ketQua={ketQua} mode={mode} selected={selected} onSelect={setSelected} metricsByMa={metricsByMa} />
        </div>

        {/* Panel chỉnh ô */}
        {mode === 'design' && (
          <div className="w-full shrink-0 lg:w-80">
            <div className="card p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">
                Ô {selected ? <Badge tone="info">{selected}</Badge> : <span className="text-ink-soft">— chọn 1 ô —</span>}
              </h3>
              {!selected ? (
                <p className="text-sm text-ink-soft">Bấm vào 1 ô trong lưới để gán nội dung.</p>
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
                      <Input value={cell.gia_tri || ''} onChange={(e) => setCell(selected, { loai: 'text', gia_tri: e.target.value })} />
                    </Field>
                  )}
                  {cell?.loai === 'so' && (
                    <Field label="Giá trị số">
                      <Input type="number" value={cell.gia_tri ?? ''} onChange={(e) => setCell(selected, { loai: 'so', gia_tri: e.target.value === '' ? '' : Number(e.target.value) })} />
                    </Field>
                  )}
                  {cell?.loai === 'metric' && (
                    <>
                      <Field label="Chọn dữ liệu">
                        <Select value={cell.metric || ''} onChange={(e) => setCell(selected, { loai: 'metric', metric: e.target.value })}>
                          {Object.entries(metricGroups).map(([nhom, list]) => (
                            <optgroup key={nhom} label={nhom}>
                              {list.map((m) => <option key={m.ma} value={m.ma}>{m.ten}</option>)}
                            </optgroup>
                          ))}
                        </Select>
                      </Field>
                      {metricsByMa[cell.metric] && (
                        <p className="-mt-2 mb-3 text-xs text-ink-soft">{metricsByMa[cell.metric].mo_ta}</p>
                      )}
                    </>
                  )}
                  {cell?.loai === 'cong_thuc' && (
                    <Field label="Biểu thức" hint="Tham chiếu ô: A1, B2… · toán tử: + − * / ( )  · vd (A1+B1)*2">
                      <Textarea rows={2} value={cell.bieu_thuc || ''}
                        onChange={(e) => setCell(selected, { loai: 'cong_thuc', bieu_thuc: e.target.value })} />
                    </Field>
                  )}

                  {cell && (
                    <Button variant="ghost" className="w-full text-danger" onClick={() => setCell(selected, null)}>Xóa nội dung ô</Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Danh mục dữ liệu (metric) */}
      <Modal open={catalogOpen} onClose={() => setCatalogOpen(false)} title="Danh mục dữ liệu có sẵn" size="lg">
        <div className="space-y-4">
          {Object.entries(metricGroups).map(([nhom, list]) => (
            <div key={nhom}>
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">{nhom}</div>
              <div className="space-y-1.5">
                {list.map((m) => (
                  <div key={m.ma} className="rounded-control border border-line p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink">{m.ten}</span>
                      <span className="font-mono text-xs text-ink-soft">{m.ma}{m.don_vi ? ` · ${m.don_vi}` : ''}</span>
                    </div>
                    <div className="text-xs text-ink-soft">{m.mo_ta}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title={`Lịch sử thao tác — ${rep.ma_bao_cao}`} fetcher={(date) => reportHistory(id, date)} />

      <Toast toast={toast} />
    </div>
  );
}
