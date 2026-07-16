import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import { Input } from '../../../components/common/controls';
import GomBadge from '../../../components/common/GomBadge';
import DonePanel from '../../../components/common/DonePanel';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import { listTestRunCandidates, testRunHistory, confirmQABatch, testQaDone } from '../../../services/planningService';
import TestRunPanel from '../components/TestRunPanel';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import HanGiaoCell from '../../../components/common/HanGiaoCell';
import QrScanner from '../../../components/common/QrScanner';
import { baseMaTem } from '../../../utils/format';

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
  const [nguoiTestBatch, setNguoiTestBatch] = useState('');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [onlyPending, setOnlyPending] = useState(true); // mặc định chỉ hiện lệnh CHƯA QA xong (khớp Test Run ở dashboard)
  const filtered = useMemo(() => {
    const base = onlyPending ? rows.filter((r) => !r.qa_done) : rows;
    return filterRows(base, filters, FILTER_FIELDS);
  }, [rows, filters, onlyPending]);
  const activeCount = Object.values(filters).filter(Boolean).length;
  const doneCount = useMemo(() => rows.filter((r) => r.qa_done).length, [rows]);

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

  // Quét QR = CODE PHẦN → tìm lệnh Test Run của phần in đó (ưu tiên lệnh chưa QA) → mở SidePanel xác nhận.
  const onScan = (code) => {
    setScanOpen(false);
    const c = baseMaTem((code || '').trim()); // QR có thể chứa tiền tố → lấy phần gốc
    if (!c) return;
    const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '');
    const match = rows.filter((r) => norm(r.ma_phan) === norm(c) || norm(r.ma_phan).includes(norm(c)));
    if (match.length === 0) { show(`Không thấy lệnh Test Run cho code phần "${c}"`, 'error'); return; }
    const pick = match.find((r) => !r.qa_done) || match[0]; // ưu tiên lệnh chưa QA xong
    setSel(pick.id);
  };

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
    if (!nguoiTestBatch.trim()) { show('Bắt buộc nhập người test khi QA xác nhận đạt', 'error'); return; }
    setBatching(true);
    try {
      const res = await confirmQABatch([...selected], { nguoiTest: nguoiTestBatch.trim() });
      const { okCount, failedCount } = res.data;
      show(failedCount ? `QA xác nhận ${okCount} lệnh, ${failedCount} lỗi` : `Đã QA xác nhận đạt ${okCount} lệnh`,
        failedCount ? 'error' : 'success');
      setNguoiTestBatch('');
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
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
    { key: 'so_lan_test', header: 'Lần test', className: 'text-right tabular-nums', render: (r) => r.so_lan_test },
    { key: 'qa_done', header: 'QA', render: (r) => r.qa_done ? <Badge tone="success">✓</Badge> : <Badge tone="warning">Chờ</Badge> },
  ];

  return (
    <div>
      <Toolbar title="Test Run - QA" subtitle="QA nhập số lượng test, xác nhận đạt hoặc ghi nhận test lỗi"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {canQA && <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR code phần</Button>}
        {canQA && selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Input value={nguoiTestBatch} onChange={(e) => setNguoiTestBatch(e.target.value)}
              placeholder="Người test (bắt buộc)"
              className={`!w-44 ${!nguoiTestBatch.trim() ? 'border-danger' : ''}`} />
            <Button loading={batching} onClick={doBatch} disabled={!nguoiTestBatch.trim()}>
              QA xác nhận đạt ({selected.size})
            </Button>
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-soft">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          Chỉ chờ QA{doneCount ? ` (ẩn ${doneCount} đã xong)` : ''}
        </label>
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

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={onScan} title="Quét QR code phần" />


      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử Test Run" fetcher={testRunHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã QA xác nhận" maHeader="Lệnh" fetcher={testQaDone} />

      <Toast toast={toast} />
    </div>
  );
}
