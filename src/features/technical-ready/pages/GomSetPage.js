import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Input, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  listGomCandidates, listSets, getSet, createSet, removeFromSet, cancelSet, gomHistory, gomDone,
} from '../../../services/gomsetService';
import { fmtNum, fmtDate } from '../../../utils/format';

const fmtTimeVi = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN') : '');
// Cột riêng cho panel "Đã hoàn thành" của Gom set (đơn vị = set, không phải phần in).
const GOM_DONE_COLUMNS = [
  { key: 'ma', header: 'Set', render: (r) => <Badge tone="info">{r.ma || '—'}</Badge> },
  { key: 'hanh_dong', header: 'Thao tác', render: (r) => r.hanh_dong || '—' },
  { key: 'so_luong', header: 'Số đợt vải', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
  { key: 'mau_list', header: 'Màu', render: (r) => r.mau_list || '—' },
  { key: 'tg', header: 'Giờ', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtTimeVi(r.tg) },
  { key: 'nguoi', header: 'Người', render: (r) => r.nguoi || '—' },
];

// Thẻ 1 đợt vải (dùng cho cả 2 cột). dir: 'right' (nút →) | 'left' (nút ←).
function DotVaiCard({ row, dir, onMove }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ id: row.dot_vai_id, from: dir === 'right' ? 'left' : 'right' }))}
      className="flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-sm hover:bg-surface-muted/50"
    >
      {dir === 'left' && (
        <button onClick={() => onMove(row)} aria-label="Bỏ chọn" className="text-ink-soft hover:text-primary">
          <Icon name="chevron-left" size={18} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{row.ten_khach_hang || '—'}</span>
          <span className="text-ink-soft">·</span>
          <span className="font-medium text-ink">{row.ma_hang}</span>
          <span className="text-ink-soft">·</span>
          <span className="font-medium text-ink">{row.mau_vai || '—'}</span>
        </div>
        <div className="truncate text-xs text-ink-soft">
          {row.ma_don_hang} · Kích {row.kich_vai || '—'}/{row.kich_phim || '—'} · SLĐH {fmtNum(row.so_luong_don_hang)} · SLNV {fmtNum(row.so_luong_vai_ve)}
        </div>
      </div>
      {dir === 'right' && (
        <button onClick={() => onMove(row)} aria-label="Chọn" className="text-ink-soft hover:text-primary">
          <Icon name="chevron-right" size={18} />
        </button>
      )}
    </div>
  );
}

export default function GomSetPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canGom = can('READY_GOMSET');

  const [view, setView] = useState('create'); // 'create' | 'sets'
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);

  // --- Tạo set (transfer list) ---
  const [cands, setCands] = useState([]);
  const [loadingCands, setLoadingCands] = useState(true);
  const [search, setSearch] = useState('');
  const [staged, setStaged] = useState([]); // row[]
  const [ghiChu, setGhiChu] = useState('');
  const [saving, setSaving] = useState(false);

  // --- Danh sách set ---
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const stagedIds = useMemo(() => new Set(staged.map((s) => s.dot_vai_id)), [staged]);

  const loadCands = useCallback(async () => {
    setLoadingCands(true);
    try {
      const res = await listGomCandidates({ search, limit: 200 });
      setCands(res.data.items);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoadingCands(false);
    }
  }, [search, show]);

  const loadSets = useCallback(async () => {
    setLoadingSets(true);
    try {
      const res = await listSets({});
      setSets(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoadingSets(false);
    }
  }, [show]);

  useEffect(() => { const t = setTimeout(loadCands, 250); return () => clearTimeout(t); }, [loadCands]);
  useEffect(() => { if (view === 'sets') loadSets(); }, [view, loadSets]);

  const left = useMemo(() => cands.filter((c) => !stagedIds.has(c.dot_vai_id)), [cands, stagedIds]);
  const stageRow = (row) => setStaged((s) => (s.some((x) => x.dot_vai_id === row.dot_vai_id) ? s : [...s, row]));
  const unstage = (row) => setStaged((s) => s.filter((x) => x.dot_vai_id !== row.dot_vai_id));
  const stageById = (id) => { const r = cands.find((c) => c.dot_vai_id === id); if (r) stageRow(r); };

  const onDrop = (e, target) => {
    e.preventDefault();
    try {
      const { id, from } = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (target === 'right' && from === 'left') stageById(id);
      if (target === 'left' && from === 'right') { const r = staged.find((x) => x.dot_vai_id === id); if (r) unstage(r); }
    } catch { /* ignore */ }
  };

  const mauSet = useMemo(() => new Set(staged.map((s) => s.mau_vai).filter(Boolean)), [staged]);
  const tongVai = useMemo(() => staged.reduce((s, r) => s + (Number(r.so_luong_vai_ve) || 0), 0), [staged]);

  const doCreate = async () => {
    setSaving(true);
    try {
      const res = await createSet({ ghiChu, dotVaiIds: staged.map((s) => s.dot_vai_id) });
      show(`Đã tạo ${res.data.set.ma_set} (${staged.length} đợt vải)`);
      setStaged([]); setGhiChu('');
      loadCands();
    } catch (e) {
      show(e.message || 'Gom set thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Set detail ---
  const openDetail = async (id) => {
    setLoadingDetail(true);
    setDetail({ set: { id } });
    try {
      const res = await getSet(id);
      setDetail(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải chi tiết', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };
  const doRemove = async (dotVaiId) => {
    try { const res = await removeFromSet(detail.set.id, dotVaiId); setDetail(res.data); loadSets(); loadCands(); }
    catch (e) { show(e.message || 'Tách thất bại', 'error'); }
  };
  const doCancel = async () => {
    try { await cancelSet(detail.set.id); show('Đã hủy set'); setDetail(null); loadSets(); loadCands(); }
    catch (e) { show(e.message || 'Hủy thất bại', 'error'); }
  };

  return (
    <div>
      <Toolbar title="Gom set" subtitle="Gom đợt vải của các phần in để in chung 1 lần (tối ưu khung in, đỡ setup nhiều lần)">
        <div className="flex rounded-control border border-line p-0.5">
          <button onClick={() => setView('create')}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-medium ${view === 'create' ? 'bg-primary text-white' : 'text-ink-soft'}`}>
            Tạo set
          </button>
          <button onClick={() => setView('sets')}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-medium ${view === 'sets' ? 'bg-primary text-white' : 'text-ink-soft'}`}>
            Đã gom set
          </button>
        </div>
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
      </Toolbar>

      {view === 'create' ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Cột trái: phần in ở kỹ thuật */}
            <div className="card flex flex-col p-4" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, 'left')}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Đợt vải ở READY ({left.length})</h3>
                <Badge tone="default">chưa xác nhận khuôn/phim</Badge>
              </div>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3"
                placeholder="Tìm code phần, màu, kích, mã hàng, đợt vải..." />
              <div className="max-h-[60vh] flex-1 space-y-1.5 overflow-y-auto">
                {loadingCands ? (
                  <div className="py-8 text-center text-ink-soft">Đang tải...</div>
                ) : left.length === 0 ? (
                  <div className="py-8 text-center text-sm text-ink-soft">Không còn đợt vải để gom</div>
                ) : (
                  left.map((r) => <DotVaiCard key={r.dot_vai_id} row={r} dir="right" onMove={stageRow} />)
                )}
              </div>
            </div>

            {/* Cột phải: đã chọn để gom */}
            <div className="card flex flex-col p-4" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, 'right')}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Chọn gom set ({staged.length})</h3>
                {staged.length > 0 && (
                  <button onClick={() => setStaged([])} className="text-xs text-ink-soft hover:text-danger">Bỏ hết</button>
                )}
              </div>
              {staged.length > 0 && (
                <div className="mb-2 rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-soft">
                  Tổng SL {fmtNum(tongVai)} · {mauSet.size} màu
                  {mauSet.size > 1 && <span className="ml-1 font-medium text-amber-600">⚠ khác màu</span>}
                </div>
              )}
              <div className="max-h-[52vh] flex-1 space-y-1.5 overflow-y-auto rounded-control border border-dashed border-line p-2">
                {staged.length === 0 ? (
                  <div className="py-10 text-center text-sm text-ink-soft">Kéo phần in qua đây hoặc bấm mũi tên →</div>
                ) : (
                  staged.map((r) => <DotVaiCard key={r.dot_vai_id} row={r} dir="left" onMove={unstage} />)
                )}
              </div>
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <Textarea rows={2} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)}
                  placeholder="Ghi chú set (tùy chọn)..." />
                <Button className="w-full" loading={saving} disabled={!canGom || staged.length === 0} onClick={doCreate}>
                  Gom set ({staged.length} đợt vải)
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        // --- Danh sách đã gom set ---
        loadingSets ? (
          <div className="py-10 text-center text-ink-soft">Đang tải...</div>
        ) : sets.length === 0 ? (
          <div className="card px-6 py-12 text-center text-ink-soft">Chưa có set nào đang mở</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((s) => (
              <button key={s.id} onClick={() => openDetail(s.id)} className="card p-4 text-left transition hover:shadow-card-hover">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-bold text-ink"><Icon name="package" size={16} /> {s.ma_set}</span>
                  <Badge tone="info">{s.so_dot_vai} đợt vải</Badge>
                </div>
                <div className="text-sm text-ink-soft">Màu: <span className="text-ink">{s.mau_list || '—'}</span></div>
                {s.ghi_chu && <div className="mt-1 truncate text-xs text-ink-soft">{s.ghi_chu}</div>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.khac_mau && <Badge tone="warning">⚠ Khác màu ({s.so_mau})</Badge>}
                  {s.so_chua_ready > 0 ? <Badge tone="warning">{s.so_chua_ready} chưa QC</Badge> : <Badge tone="success">Đủ QC</Badge>}
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* Chi tiết set: tách đợt vải / hủy set */}
      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.set?.ma_set ? `Set ${detail.set.ma_set}` : 'Chi tiết set'}
        subtitle={detail?.members ? `${detail.members.length} đợt vải · ${detail.so_mau} màu` : ''}
        width="max-w-2xl"
        footer={canGom && detail?.set?.id ? <Button variant="danger" onClick={doCancel}>Hủy set</Button> : null}
      >
        {loadingDetail || !detail?.members ? (
          <div className="py-10 text-center text-ink-soft">Đang tải...</div>
        ) : (
          <div className="space-y-3">
            {detail.khac_mau && (
              <div className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                ⚠ Set gồm <b>{detail.so_mau} màu khác nhau</b> — kiểm tra lại nếu cần in chung khung.
              </div>
            )}
            {detail.so_chua_ready > 0 && (
              <div className="rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                Còn <b>{detail.so_chua_ready}</b> đợt vải chưa hoàn tất QC — Kế hoạch chỉ release set khi đủ QC.
              </div>
            )}
            {detail.members.map((m) => (
              <div key={m.dot_vai_id} className="flex items-center justify-between rounded-control border border-line px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-ink">{m.ma_phan} · {m.mau_vai}</div>
                  <div className="text-xs text-ink-soft">{m.ma_hang} · {m.ma_dot_vai} · SL {fmtNum(m.so_luong_vai_ve)} · Hạn {fmtDate(m.han_giao_hang)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {m.qc_done ? <Badge tone="success">QC</Badge> : <Badge tone="warning">Chưa QC</Badge>}
                  {canGom && !m.da_release && (
                    <button onClick={() => doRemove(m.dot_vai_id)} className="text-xs font-medium text-primary hover:underline">Tách</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SidePanel>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử thao tác gom set" fetcher={gomHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Set đã tạo/release" columns={GOM_DONE_COLUMNS} fetcher={gomDone} />

      <Toast toast={toast} />
    </div>
  );
}
