import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { syncPhieuNhanVai, syncHistory } from '../../../services/erpService';
import { fmtNum } from '../../../utils/format';

const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');
const TONE = { THANH_CONG: 'success', DANG_CHAY: 'warning', LOI: 'danger' };
const LABEL = { THANH_CONG: 'Thành công', DANG_CHAY: 'Đang chạy', LOI: 'Lỗi' };

export default function ErpSyncPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canSync = can('ERP_SYNC');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await syncHistory(50);
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const doSync = async () => {
    setBusy(true);
    try {
      const res = await syncPhieuNhanVai();
      const d = res.data;
      show(`Đồng bộ xong: ${d.soMoi} mới · ${d.soCapNhat} cập nhật · ${d.soBoQua || 0} bỏ qua · ${d.soLoi} lỗi (tổng ${d.tong})`,
        d.soLoi && d.tong === 0 ? 'error' : 'success');
      load();
    } catch (e) {
      show(e.message || 'Đồng bộ thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'tg_bd', header: 'Bắt đầu', render: (r) => fmtDt(r.tg_bd) },
    { key: 'tg_kt', header: 'Kết thúc', render: (r) => fmtDt(r.tg_kt) },
    { key: 'tu_dong', header: 'Kiểu', render: (r) => r.tu_dong ? <Badge tone="info">Tự động</Badge> : <Badge tone="default">Thủ công</Badge> },
    { key: 'from_date', header: 'Tham số từ', render: (r) => fmtDt(r.from_date) },
    { key: 'tong_ban_ghi', header: 'Tổng', className: 'text-right tabular-nums', render: (r) => fmtNum(r.tong_ban_ghi) },
    { key: 'so_moi', header: 'Mới', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_moi) },
    { key: 'so_cap_nhat', header: 'Cập nhật', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_cap_nhat) },
    { key: 'so_loi', header: 'Lỗi', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_loi) },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) => <Badge tone={TONE[r.trang_thai] || 'default'}>{LABEL[r.trang_thai] || r.trang_thai}</Badge> },
    { key: 'nguoi', header: 'Người', render: (r) => r.tu_dong ? 'Hệ thống' : (r.nguoi || '—') },
    { key: 'thong_diep', header: 'Ghi chú', render: (r) => r.thong_diep ? <span className="text-xs text-danger">{r.thong_diep}</span> : '—' },
  ];

  return (
    <div>
      <Toolbar title="Đồng bộ ERP" subtitle="Lấy phiếu nhận vải từ ERP (tự động mỗi giờ) — lịch sử các lần đồng bộ">
        {canSync && <Button icon="loader" loading={busy} onClick={doSync}>Đồng bộ ngay</Button>}
        <Badge tone="info">{rows.length} lần</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có lần đồng bộ nào" />

      <Toast toast={toast} />
    </div>
  );
}
