import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listRelease2Candidates, approveRelease2, approveRelease2Batch, planHistory, release2Done } from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

export default function Release2Page() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canApprove = can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null); // row (đơn) hoặc { batch: true }
  const [busy, setBusy] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRelease2Candidates({ search, limit: 50 });
      setRows(res.data.items);
      setSelected(new Set());
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

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(rows.map((r) => r.id))));

  const doApprove = async () => {
    setBusy(true);
    try {
      if (confirm.batch) {
        const res = await approveRelease2Batch([...selected]);
        const { okCount, failedCount } = res.data;
        show(failedCount ? `Đã duyệt ${okCount} lệnh, ${failedCount} lỗi` : `Đã Release 2 ${okCount} lệnh`,
          failedCount ? 'error' : 'success');
      } else {
        await approveRelease2(confirm.id);
        show(`Đã Release 2 — ${confirm.ma_lenh_san_xuat} sẵn sàng sản xuất`);
      }
      setConfirm(null);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    ...(canApprove ? [{ key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)} aria-label="Chọn lệnh" />
      ) }] : []),
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => (
      <div>{r.ma_hang || '—'}{r.so_dot_vai > 1 && <div className="mt-0.5"><Badge tone="warning">Gom set ({r.so_dot_vai} đợt)</Badge></div>}</div>
    ) },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'so_luong_don_hang', header: 'SLĐH', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_don_hang) },
    { key: 'so_luong_vai_ve', header: 'SLNV', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_vai_ve) },
    { key: 'ngay_vai_ve', header: 'Ngày nhận vải', render: (r) => fmtDate(r.ngay_vai_ve) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
    { key: 'ngay_ke_hoach', header: 'Ngày SX kế hoạch', render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'test', header: 'Test', className: 'whitespace-nowrap',
      render: () => <Badge tone="success" className="whitespace-nowrap">CNSP ✓ · QA ✓</Badge> },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      canApprove && <Button className="px-2.5 py-1 text-xs" onClick={() => setConfirm(r)}>Duyệt Release 2</Button> },
  ];

  return (
    <div>
      <Toolbar title="Release 2 — duyệt cuối" subtitle="Kế hoạch duyệt lệnh đã đủ test (CNSP + QA) để vào sản xuất"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {canApprove && selected.size > 0 && (
          <Button onClick={() => setConfirm({ batch: true })}>Duyệt Release 2 ({selected.size})</Button>
        )}
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{rows.length} chờ duyệt</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} sttStart={0}
        emptyText="Không có lệnh nào chờ Release 2" />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doApprove}
        loading={busy}
        title="Duyệt Release 2"
        message={!confirm ? '' : confirm.batch
          ? `Xác nhận Release 2 cho ${selected.size} lệnh đã chọn? Các lệnh sẽ sẵn sàng vào sản xuất.`
          : `Xác nhận Release 2 cho lệnh ${confirm.ma_lenh_san_xuat}? Lệnh sẽ sẵn sàng vào sản xuất.`}
        confirmText="Release 2"
      />

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử kế hoạch (Release 2 + lập lại)" fetcher={planHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã Release 2" maHeader="Lệnh" fetcher={release2Done} />

      <Toast toast={toast} />
    </div>
  );
}
