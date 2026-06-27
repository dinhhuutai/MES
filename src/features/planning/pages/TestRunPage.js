import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import { listTestRunCandidates } from '../../../services/planningService';
import { fmtNum } from '../../../utils/format';
import TestRunPanel from '../components/TestRunPanel';

export default function TestRunPage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTestRunCandidates({ search, limit: 50 });
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

  const columns = [
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'ten_chuyen', header: 'Chuyền', render: (r) => `${r.ma_chuyen || '—'} ${r.ten_chuyen || ''}` },
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_release) },
    { key: 'so_dot_vai', header: 'Số đợt vải', className: 'text-right', render: (r) => r.so_dot_vai },
    { key: 'so_lan_test', header: 'Lần test', className: 'text-right', render: (r) => r.so_lan_test },
    { key: 'cnsp_done', header: 'CNSP', render: (r) => r.cnsp_done ? <Badge tone="success">✓</Badge> : <Badge tone="warning">Chờ</Badge> },
    { key: 'qa_done', header: 'QA', render: (r) => r.qa_done ? <Badge tone="success">✓</Badge> : <Badge tone="warning">Chờ</Badge> },
  ];

  return (
    <div>
      <Toolbar title="Test Run" subtitle="CNSP (kỹ thuật) & QA (chất lượng) xác nhận test trước Release 2"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh...">
        <Badge tone="info">{rows.length} lệnh</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => setSel(r.id)}
        emptyText="Không có lệnh nào đang Test Run" />

      {sel && <TestRunPanel lenhId={sel} onClose={() => setSel(null)} onChanged={load} />}
      <Toast toast={toast} />
    </div>
  );
}
