import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import GomBadge from '../../../components/common/GomBadge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Textarea } from '../../../components/common/controls';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import LoaiDotVaiBadge from '../../planning/components/LoaiDotVaiBadge';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listChayDacBietCandidates, chayDacBiet, listChuyen } from '../../../services/productionService';
import { fmtNum } from '../../../utils/format';

// Chạy đặc biệt (chỉ thị đặc biệt — bỏ Test Run): CÙNG danh sách Test Run (đợt SX Release 1, chưa CNSP+QA),
// nhưng hành động = "Xác nhận chạy" → chạy thẳng trên chuyền, bỏ qua Test Run + Release 2.
export default function ChayDacBietPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRun = can('PROD_RUN');

  const [rows, setRows] = useState([]);
  const [chuyen, setChuyen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState(null); // đợt SX đang xác nhận chạy
  const [chuyenId, setChuyenId] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listChayDacBietCandidates({ search, limit: 500 });
      setRows(res.data.items);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data || [])).catch(() => {}); }, []);

  const openConfirm = (r) => { setTarget(r); setChuyenId(''); setLyDo(''); };

  const doRun = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await chayDacBiet(target.id, { chuyenId: chuyenId || null, lyDo: lyDo.trim() || null });
      show('Đã chạy đặc biệt (bỏ Test Run) — đợt vào Sản xuất');
      setTarget(null);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => (
      <div>{r.ma_hang || '—'}{r.so_dot_vai > 1 && <div className="mt-0.5"><GomBadge soDotVai={r.so_dot_vai} soPhanIn={r.so_phan_in} /></div>}</div>
    ) },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'chuyen', header: 'Chuyền (KH)', render: (r) => r.ten_chuyen || '—' },
    { key: 'so_luong_release', header: 'SL', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_release) },
    { key: 'act', header: '', className: 'text-right', render: (r) => canRun && (
      <Button className="px-3 py-1.5" onClick={(e) => { e.stopPropagation(); openConfirm(r); }}>Xác nhận chạy</Button>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Chạy đặc biệt (bỏ Test Run)"
        subtitle="Chỉ thị đặc biệt: đợt đã Release 1 nhưng chưa Test Run — Sản xuất tự kiểm rồi chạy thẳng, bỏ Test Run + Release 2"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        <Badge tone="info">{rows.length} đợt</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} sttStart={0}
        emptyText="Không có đợt sản xuất nào đang chờ Test Run" />

      <Modal open={!!target} onClose={() => setTarget(null)}
        title={target ? `Chạy đặc biệt — ${target.ma_lenh_san_xuat || ''}` : 'Chạy đặc biệt'}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>Hủy</Button>
            <Button onClick={doRun} loading={busy}>Xác nhận chạy (bỏ Test Run)</Button>
          </>
        )}>
        {target && (
          <div className="space-y-3">
            <div className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Đợt này sẽ <b>bỏ Test Run + Release 2</b> và chạy thẳng trên chuyền. Thao tác được ghi nhật ký (chỉ thị đặc biệt).
            </div>
            <div className="text-sm text-ink-soft">
              {target.ma_hang} · {target.mau_vai} · SL <b className="text-ink">{fmtNum(target.so_luong_release)}</b>
            </div>
            <Field label="Chuyền chạy" hint={`Bỏ trống = dùng chuyền kế hoạch (${target.ten_chuyen || '—'})`}>
              <ChuyenPicker chuyen={chuyen} value={chuyenId} onChange={setChuyenId} />
            </Field>
            <Field label="Lý do (chỉ thị đặc biệt)">
              <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Vì sao chạy bỏ Test Run..." />
            </Field>
          </div>
        )}
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
