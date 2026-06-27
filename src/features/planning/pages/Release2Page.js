import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listRelease2Candidates, approveRelease2 } from '../../../services/planningService';
import { fmtNum } from '../../../utils/format';

export default function Release2Page() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canApprove = can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRelease2Candidates({ search, limit: 50 });
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

  const doApprove = async () => {
    setBusy(true);
    try {
      await approveRelease2(confirm.id);
      show(`Đã Release 2 — ${confirm.ma_lenh_san_xuat} sẵn sàng sản xuất`);
      setConfirm(null);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'ten_chuyen', header: 'Chuyền', render: (r) => `${r.ma_chuyen || '—'} ${r.ten_chuyen || ''}` },
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_release) },
    { key: 'so_dot_vai', header: 'Số đợt vải', className: 'text-right', render: (r) => r.so_dot_vai },
    { key: 'test', header: 'Test', render: () => <Badge tone="success">CNSP ✓ · QA ✓</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canApprove && <Button className="px-3 py-1.5" onClick={() => setConfirm(r)}>Duyệt Release 2</Button> },
  ];

  return (
    <div>
      <Toolbar title="Release 2 — duyệt cuối" subtitle="Kế hoạch duyệt lệnh đã đủ test (CNSP + QA) để vào sản xuất"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh...">
        <Badge tone="info">{rows.length} chờ duyệt</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading}
        emptyText="Không có lệnh nào chờ Release 2" />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doApprove}
        loading={busy}
        title="Duyệt Release 2"
        message={confirm ? `Xác nhận Release 2 cho lệnh ${confirm.ma_lenh_san_xuat}? Lệnh sẽ sẵn sàng vào sản xuất.` : ''}
        confirmText="Release 2"
      />
      <Toast toast={toast} />
    </div>
  );
}
