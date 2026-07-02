import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNow, { fmtRemain } from '../../../hooks/useNow';
import { listDrying, confirmDry } from '../../../services/productionService';
import { fmtNum } from '../../../utils/format';
import { evalSla, slaRowClass } from '../../../utils/sla';

export default function ChoKhoPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow();
  const canDry = can('DRYING');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDrying({ search });
      setRows(res.data);
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

  const doConfirm = async (row) => {
    setBusy(row.tem_id);
    try {
      await confirmDry(row.tem_id);
      show(`Đã xác nhận khô ${row.ma_tem}`);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone="info">{r.ma_tem}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'ma_xe_phoi', header: 'Xe phơi' },
    { key: 'so_luong', header: 'SL pcs', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'remain', header: 'Còn lại', render: (r) => {
      const ms = new Date(r.tg_kt_phoi).getTime() - now;
      return ms <= 0
        ? <Badge tone="success">Đã đủ thời gian</Badge>
        : <span className="font-mono text-amber-600">{fmtRemain(ms)}</span>;
    } },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canDry && <Button className="px-3 py-1.5" loading={busy === r.tem_id} onClick={() => doConfirm(r)}>Xác nhận khô</Button> },
  ];

  return (
    <div>
      <Toolbar title="Quét chờ khô" subtitle="Xác nhận tem đã khô để chuyển sang KCS"
        search={search} onSearch={setSearch} searchPlaceholder="Quét/nhập mã tem...">
        <Badge tone="warning">{rows.length} đang phơi</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="tem_id"
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có tem nào đang phơi" />
      <Toast toast={toast} />
    </div>
  );
}
