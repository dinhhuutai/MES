import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import { listTestRunCandidates, testRunHistory, confirmQABatch, testQaDone } from '../../../services/planningService';
import TestRunPanel from '../components/TestRunPanel';

const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' }, { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' }, { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' }, { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];

export default function TestRunPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const { statusLenh } = useNghenMap();
  const canQA = can('TESTRUN_QA');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState(null);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [batching, setBatching] = useState(false);
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const filtered = useMemo(() => filterRows(rows, filters, FILTER_FIELDS), [rows, filters]);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTestRunCandidates({ search, limit: 500 });
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
    { key: 'sel', className: 'w-10', selection: true,
      header: canQA ? <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" /> : '',
      render: (r) => canQA && selectable(r) && (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)} aria-label="Chọn lệnh" />
      ) },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-[10px] text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => (
      <div>{r.ma_hang || '—'}{r.so_dot_vai > 1 && <div className="mt-0.5"><Badge tone="warning">Gom set ({r.so_dot_vai} đợt)</Badge></div>}</div>
    ) },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-[10px] text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
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
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{filtered.length} lệnh</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={(r) => setSel(r.id)} sttStart={0}
        rowClassName={(r) => slaRowClass(statusLenh(r.id))}
        emptyText="Không có lệnh nào đang Test Run" />

      {sel && <TestRunPanel lenhId={sel} onClose={() => setSel(null)} onChanged={load} />}

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử Test Run" fetcher={testRunHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã QA xác nhận" maHeader="Lệnh" fetcher={testQaDone} />

      <Toast toast={toast} />
    </div>
  );
}
