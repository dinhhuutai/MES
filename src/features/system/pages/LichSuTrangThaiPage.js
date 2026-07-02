import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listConfirmHistory, cancelReadyItem } from '../../../services/readyService';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');

export default function LichSuTrangThaiPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canCancel = can('READY_CANCEL');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null); // row cần xóa mềm
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listConfirmHistory({ date, search });
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [date, search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const doCancel = async () => {
    setBusy(true);
    try {
      await cancelReadyItem(confirm.phan_in_id, confirm.ma_checkpoint);
      show(`Đã xóa mềm xác nhận ${confirm.muc_label} — ${confirm.ma_phan}. Người phụ trách có thể xác nhận lại.`);
      setConfirm(null);
      load();
    } catch (e) {
      show(e.message || 'Xóa thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'tg_xac_nhan', header: 'Giờ xác nhận', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtTime(r.tg_xac_nhan) },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu · Kích', render: (r) => [r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—' },
    { key: 'muc_label', header: 'Mục xác nhận', render: (r) => (
      <div className="flex items-center gap-1.5">
        <Badge tone="info">{r.muc_label}</Badge>
        {r.gia_tri_text ? <span className="text-xs text-ink-soft">{r.gia_tri_text}</span> : null}
      </div>
    ) },
    { key: 'nguoi_xac_nhan', header: 'Người xác nhận', render: (r) => r.nguoi_xac_nhan || '—' },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canCancel && (
        <Button variant="danger" className="px-3 py-1.5" onClick={(e) => { e.stopPropagation(); setConfirm(r); }}>
          Xóa mềm
        </Button>
      ) },
  ];

  return (
    <div>
      <Toolbar title="Lịch sử trạng thái" subtitle="Xác nhận READY đã thực hiện — quản trị có thể xóa mềm nếu bấm nhầm để người phụ trách xác nhận lại"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, mã hàng, màu/kích...">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-input border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
        <Badge tone="default">{rows.length} lượt</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="ket_qua_id"
        emptyText="Không có xác nhận nào trong ngày" />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doCancel}
        loading={busy}
        title="Xóa mềm xác nhận"
        message={confirm
          ? `Xóa mềm xác nhận "${confirm.muc_label}" của phần in ${confirm.ma_phan} (do ${confirm.nguoi_xac_nhan || '—'} xác nhận)? Mục này sẽ trở lại trạng thái CHƯA xác nhận để người phụ trách làm lại.`
          : ''}
        confirmText="Xóa mềm"
        variant="danger"
      />

      <Toast toast={toast} />
    </div>
  );
}
