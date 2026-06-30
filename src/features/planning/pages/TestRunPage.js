import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listTestRunCandidates, testRunHistory, confirmQABatch } from '../../../services/planningService';
import TestRunPanel from '../components/TestRunPanel';

export default function TestRunPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canQA = can('TESTRUN_QA');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState(null);
  const [histOpen, setHistOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [batching, setBatching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTestRunCandidates({ search, limit: 50 });
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

  // Chỉ chọn được lệnh chưa QA đạt.
  const selectable = (r) => !r.qa_done;
  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selRows = rows.filter(selectable);
  const allChecked = selRows.length > 0 && selRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(selRows.map((r) => r.id))));

  const doBatch = async () => {
    setBatching(true);
    try {
      const res = await confirmQABatch([...selected]);
      const { okCount, failedCount } = res.data;
      show(failedCount ? `QA xác nhận ${okCount} lệnh, ${failedCount} lỗi` : `Đã QA xác nhận đạt ${okCount} lệnh`,
        failedCount ? 'error' : 'success');
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setBatching(false);
    }
  };

  const columns = [
    { key: 'sel', className: 'w-10',
      header: canQA ? <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" /> : '',
      render: (r) => canQA && selectable(r) && (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)} aria-label="Chọn lệnh" />
      ) },
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'so_dot_vai', header: 'Số phần', className: 'text-right', render: (r) => r.so_dot_vai },
    { key: 'so_lan_test', header: 'Lần test', className: 'text-right tabular-nums', render: (r) => r.so_lan_test },
    { key: 'cnsp_done', header: 'CNSP', render: (r) => r.cnsp_done ? <Badge tone="success">✓</Badge> : <Badge tone="warning">Chờ</Badge> },
    { key: 'qa_done', header: 'QA', render: (r) => r.qa_done ? <Badge tone="success">✓</Badge> : <Badge tone="warning">Chờ</Badge> },
  ];

  return (
    <div>
      <Toolbar title="Test Run - QA" subtitle="QA nhập số lượng test, xác nhận đạt hoặc ghi nhận test lỗi"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {canQA && selected.size > 0 && (
          <Button loading={batching} onClick={doBatch}>QA xác nhận đạt ({selected.size})</Button>
        )}
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{rows.length} lệnh</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => setSel(r.id)}
        emptyText="Không có lệnh nào đang Test Run" />

      {sel && <TestRunPanel lenhId={sel} onClose={() => setSel(null)} onChanged={load} />}

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử Test Run" fetcher={testRunHistory} />

      <Toast toast={toast} />
    </div>
  );
}
