import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listKeHoachTam, confirmKeHoachTam, deleteKeHoachTam } from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

const hhmm = (t) => {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Màn "Kế hoạch tạm": bản nháp chuyền/giờ/ngày cho phần in CHƯA Ready. Khi phần in Ready xong (QA xác nhận)
// → bấm "Xác nhận Release 1" (dùng lại chuyền/giờ/ngày đã lưu, không chọn lại).
export default function KeHoachTamPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canDo = can('RELEASE1') || can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null); // { id, label }
  const [del, setDel] = useState(null); // { id, label }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listKeHoachTam({ search, limit: 500 });
      setRows(res.data.items);
      setMeta(res.data.meta || { total: res.data.items.length });
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

  const doConfirm = async () => {
    if (!confirm) return;
    setSaving(true);
    try {
      await confirmKeHoachTam(confirm.id);
      show(`Đã xác nhận Release 1 cho ${confirm.label}`);
      setConfirm(null);
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!del) return;
    setSaving(true);
    try {
      await deleteKeHoachTam(del.id);
      show(`Đã xóa kế hoạch tạm ${del.label}`);
      setDel(null);
      load();
    } catch (e) {
      show(e.message || 'Xóa thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'trang_thai', header: 'Tình trạng', render: (r) => (
      r.qc_done ? <Badge tone="success">Đã Ready</Badge> : <Badge tone="warning">Chờ Ready</Badge>
    ) },
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => r.ma_phan || '—' },
    { key: 'ten_khach_hang', header: 'Khách hàng', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'so_luong', header: 'SL', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'ten_chuyen', header: 'Chuyền (dự kiến)', render: (r) => r.ten_chuyen || '—' },
    { key: 'ngay_ke_hoach', header: 'Ngày KH', render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'gio', header: 'Giờ BD–KT', render: (r) => (r.tg_bd_kh || r.tg_kt_kh ? `${hhmm(r.tg_bd_kh) || '—'}–${hhmm(r.tg_kt_kh) || '—'}` : '—') },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    ...(canDo ? [{ key: 'act', header: '', className: 'text-right whitespace-nowrap', render: (r) => (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" icon="check" disabled={!r.qc_done}
          onClick={(e) => { e.stopPropagation(); setConfirm({ id: r.id, label: r.ma_phan }); }}>
          Xác nhận Release 1
        </Button>
        <Button size="sm" variant="ghost" icon="trash-2"
          onClick={(e) => { e.stopPropagation(); setDel({ id: r.id, label: r.ma_phan }); }} aria-label="Xóa" />
      </div>
    ) }] : []),
  ];

  return (
    <div>
      <Toolbar title="Kế hoạch tạm" subtitle="Bản kế hoạch sớm cho phần in CHƯA Ready. Khi phần in Ready xong (QA xác nhận) → bấm 'Xác nhận Release 1' (dùng lại chuyền/giờ/ngày đã lưu)"
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm code phần, mã hàng, màu, khách...">
        <Badge tone="info">{meta.total || rows.length} bản</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} sttStart={0}
        emptyText="Chưa có kế hoạch tạm nào" />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        loading={saving}
        title="Xác nhận Release 1"
        confirmText="Xác nhận Release 1"
        message={confirm ? `Xác nhận Release 1 cho ${confirm.label} theo chuyền/giờ/ngày đã lập kế hoạch tạm?` : ''}
      />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={doDelete}
        loading={saving}
        variant="danger"
        title="Xóa kế hoạch tạm"
        confirmText="Xóa"
        message={del ? `Xóa bản kế hoạch tạm của ${del.label}?` : ''}
      />

      <Toast toast={toast} />
    </div>
  );
}
