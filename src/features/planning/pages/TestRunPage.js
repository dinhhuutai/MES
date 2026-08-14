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
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import { listTestRunCandidates, testRunHistory, confirmQABatch, testQaDone } from '../../../services/planningService';
import TestRunPanel from '../components/TestRunPanel';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import PhuongAnInBadge from '../../../components/common/PhuongAnInBadge';
import HanGiaoCell from '../../../components/common/HanGiaoCell';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import TraVeBadge from '../../../components/common/TraVeBadge';
import DateRangePicker from '../../../components/common/DateRangePicker';
import { fmtDate, trongKhoangNgay } from '../../../utils/format';
import { LOAI_TABS, hopChipChuyen as hopChip, nhanChip, demChip } from '../../../utils/khuChuyen';
import ChipTabs from '../../../components/common/ChipTabs';
import exportCheckpointExcel, { COT_LENH, moTaBoLoc } from '../../../utils/exportCheckpointExcel';

// Chip lọc theo LOẠI CHUYỀN + KHU của chuyền Bàn — nguồn chung `utils/khuChuyen.js`
// (dùng chung với "Theo dõi chuyền" và "Xác nhận chạy"; sửa 1 chỗ, 3 màn cùng đổi).

const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' }, { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' }, { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' }, { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];

// --- Cột "Lần test 1..N" cho sidebar "Đã hoàn thành" (số cột = số lần test NHIỀU NHẤT trong danh sách).
// Đạt → "Đạt"; không đạt → hiện NGUYÊN NHÂN (ghi_chu) chữ ĐỎ. Đặt ở MODULE SCOPE (không lồng trong
// component) để không remount mỗi lần cha render.
const maxTests = (rows) => rows.reduce((m, r) => Math.max(m, (r.tests || []).length), 0);
const testAt = (r, i) => (r.tests || [])[i];
const testText = (t) => (t.ket_qua === 'DAT' ? 'Đạt' : (t.ghi_chu || '').trim() || 'Không đạt');

const testRunColumns = (rows) => Array.from({ length: maxTests(rows) }, (_, i) => ({
  key: `test_${i + 1}`,
  header: `Lần test ${i + 1}`,
  render: (r) => {
    const t = testAt(r, i);
    if (!t) return <span className="text-ink-soft">—</span>;
    return t.ket_qua === 'DAT'
      ? <span className="font-medium text-success">Đạt</span>
      : <span className="font-medium text-danger">{testText(t)}</span>;
  },
}));

const testRunExcelColumns = (rows) => Array.from({ length: maxTests(rows) }, (_, i) => ({
  header: `Lần test ${i + 1}`,
  width: 26,
  value: (r) => { const t = testAt(r, i); return t ? testText(t) : ''; },
  red: (r) => { const t = testAt(r, i); return !!t && t.ket_qua !== 'DAT'; },
  ok: (r) => { const t = testAt(r, i); return !!t && t.ket_qua === 'DAT'; },
}));

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
  const [loai, setLoai] = useState(''); // chip loại chuyền / khu Bàn ('' = tất cả)
  // Lọc theo NGÀY KẾ HOẠCH SẢN XUẤT (`lenh_san_xuat.ngay_ke_hoach`) — chọn được NHIỀU NGÀY bằng
  // cùng 1 ô như trang Hồ sơ kỹ thuật. Mặc định RỖNG = không lọc: đây là màn thao tác hằng ngày,
  // mặc định lọc "hôm nay" sẽ giấu mất lệnh của các ngày khác mà QA không biết vì sao.
  const [ngayKH, setNgayKH] = useState({ from: '', to: '' });
  const locNgay = useCallback((rs) => rs.filter((r) => trongKhoangNgay(r.ngay_ke_hoach, ngayKH.from, ngayKH.to)),
    [ngayKH]);
  const filtered = useMemo(() => {
    let base = onlyPending ? rows.filter((r) => !r.qa_done) : rows;
    base = locNgay(base);
    if (loai) base = base.filter((r) => hopChip(r, loai));
    return filterRows(base, filters, FILTER_FIELDS);
  }, [rows, filters, onlyPending, loai, locNgay]);
  // Đếm cho badge chip — tính trên tập ĐANG XÉT (ô "Chỉ chờ QA" + khoảng ngày) để số khớp bảng.
  const countChip = useMemo(
    () => demChip(locNgay(onlyPending ? rows.filter((r) => !r.qa_done) : rows)),
    [rows, onlyPending, locNgay]
  );
  const activeCount = Object.values(filters).filter(Boolean).length;
  const doneCount = useMemo(() => rows.filter((r) => r.qa_done).length, [rows]);

  // Xuất Excel: lấy `filtered` = TOÀN BỘ lệnh sau bộ lọc (trang tải-hết rồi phân trang client
  // ⇒ không bị giới hạn ở trang đang xem).
  const doExcel = () => exportCheckpointExcel({
    cols: [...COT_LENH,
      { header: 'QA đã xác nhận', width: 14, center: true, value: (r) => (r.qa_done ? 'Đã QA' : 'Chờ QA'),
        ok: (r) => !!r.qa_done },
      { header: 'Số lần test', width: 11, num: true, value: (r) => r.so_lan_test },
      { header: 'Chờ kỹ thuật', width: 13, center: true, value: (r) => (r.cho_ky_thuat ? 'Chờ KT làm lại' : ''),
        red: (r) => !!r.cho_ky_thuat }],
    rows: filtered,
    title: 'Test Run - QA',
    fileName: 'test-run',
    moTaLoc: moTaBoLoc({
      'tìm kiếm': search, 'chỉ chờ QA': onlyPending ? 'có' : '',
      'ngày SX kế hoạch': [ngayKH.from, ngayKH.to].filter(Boolean).join(' → '),
      khu: nhanChip(loai), ...filters,
    }),
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await listTestRunCandidates({ search, limit: 500 });
      setRows(res.data.items);
      if (!silent) setSelected(new Set());
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Tự tải lại khi trạm khác xác nhận (tránh màn để lâu → dữ liệu cũ).
  // Bỏ qua khi đang tick dở để không mất lựa chọn — `load` xóa danh sách đã chọn.
  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua `setLoading(true)` (bảng không bị
  // thay bằng spinner) và KHÔNG xóa dòng đang tích. Nhiều sự kiện trong 400ms gộp thành 1 lần tải.
  useSocketReload(['workflow:updated', 'ready:confirmed'], () => load(true));

  // Chỉ chọn được lệnh chưa QA đạt VÀ không đang chờ kỹ thuật làm lại (đã bị trả về READY).
  const selectable = (r) => !r.qa_done && !r.cho_ky_thuat;
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
    // CHUYỀN IN do Kế hoạch chọn lúc Release 1 / Tạo đợt SX (`lenh_san_xuat.chuyen_id`).
    // ⚠ Đặt NGAY SAU STT ⇒ phải là cột KHÔNG-selection ĐẦU TIÊN của mảng: `DataTable` render theo
    // thứ tự [cột chọn] → [STT] → [các cột còn lại theo đúng thứ tự khai ở đây].
    // Nguồn `lenhListSql` vốn đã trả `ma_chuyen`/`ten_chuyen` (cùng chỗ nuôi dải chip loại chuyền)
    // ⇒ KHÔNG phải sửa backend. Excel cũng đã có sẵn cột "Chuyền" trong `COT_LENH`.
    { key: 'ten_chuyen', header: 'Chuyền', className: 'whitespace-nowrap font-medium text-ink',
      render: (r) => r.ten_chuyen || r.ma_chuyen || '—' },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
        {/* Test không đạt → đã trả về Kỹ thuật; lệnh GIỮ NGUYÊN, chờ QC xác nhận READY để tự về Test Run. */}
        {r.cho_ky_thuat && (
          <div className="mt-1">
            <TraVeBadge data={r.tra_ve} label="Chờ kỹ thuật làm lại" nguon="Test Run (QA)" />
          </div>
        )}
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
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    { key: 'phuong_an_in', header: 'Phương án in', render: (r) => <PhuongAnInBadge value={r.phuong_an_in} /> },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'nha_gia_cong', header: 'Nhà gia công', render: (r) => r.nha_gia_cong || '—' },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
    // Hiện luôn cột đang được lọc — lọc theo một giá trị không nhìn thấy thì không đối chiếu được.
    { key: 'ngay_ke_hoach', header: 'Ngày SX KH', className: 'whitespace-nowrap', render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'so_lan_test', header: 'Lần test', className: 'text-right tabular-nums', render: (r) => r.so_lan_test },
    { key: 'qa_done', header: 'QA', render: (r) => r.qa_done ? <Badge tone="success">✓</Badge> : <Badge tone="warning">Chờ</Badge> },
  ];

  return (
    <div>
      <Toolbar title="Test Run - QA" subtitle="QA nhập số lượng test, xác nhận đạt hoặc ghi nhận test lỗi"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {canQA && <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét / tích mã</Button>}
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
        {/* Lọc theo NGÀY KẾ HOẠCH SẢN XUẤT — 1 ô chọn cả từ→đến (chọn được nhiều ngày),
            giống ô "Ngày lên MES" của trang Hồ sơ kỹ thuật. */}
        <DateRangePicker value={ngayKH} onChange={setNgayKH} placeholder="Ngày SX kế hoạch" />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-soft">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          Chỉ chờ QA{doneCount ? ` (ẩn ${doneCount} đã xong)` : ''}
        </label>
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="secondary" icon="download" onClick={doExcel} disabled={!filtered.length}>
          Excel ({filtered.length})
        </Button>
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{filtered.length} lệnh</Badge>
      </Toolbar>

      {/* Chip LOẠI CHUYỀN + KHU BÀN — cùng bộ với màn "Theo dõi chuyền" */}
      <ChipTabs tabs={LOAI_TABS} value={loai} counts={countChip} onChange={setLoai} />

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={(r) => setSel(r.id)} sttStart={0}
        rowClassName={(r) => slaRowClass(statusLenh(r.id))}
        emptyText="Không có lệnh nào đang Test Run" />

      {sel && <TestRunPanel lenhId={sel} onClose={() => setSel(null)} onChanged={load} />}

      {/* ĐỦ `rows` (không phải `selRows`) — quét lệnh đang hiện trên bảng cũng khớp; lệnh không chọn
          được thì `canSelect` nói rõ lý do thay vì báo "Không thấy". */}
      <ScanCollectModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Quét / tích lệnh Test Run — QA"
        help="Chọn QR (code phần) hoặc Mã vạch ở trên rồi đưa vào khung camera. Quét nhiều lệnh (chưa QA) rồi nhập người test & bấm QA xác nhận đạt cùng lúc; mỗi dòng có nút Trả về Release 1 nếu test không đạt."
        rows={rows}
        getId={(r) => r.id}
        getCodes={(r) => [r.ma_phan]}
        getBarcodes={(r) => [r.barcode]}
        matchMultiple
        canSelect={(r) => (r.cho_ky_thuat
          ? 'đang chờ kỹ thuật làm lại (Test Run đã trả về) — không test được'
          : r.qa_done ? 'QA đã xác nhận đạt rồi' : true)}
        isSelected={(r) => selected.has(r.id)}
        onToggle={(r) => toggleOne(r.id)}
        primaryLabel={(r) => r.ma_phan || r.barcode || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.ma_hang, r.mau_vai].filter(Boolean).join(' · ')}
        rowAction={{ label: 'Trả về', icon: 'log-out', onClick: (r) => { setScanOpen(false); setSel(r.id); } }}
        renderHeader={(
          <div className="rounded-control border border-line bg-surface-muted px-3 py-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Người test (bắt buộc khi xác nhận đạt)</div>
            <Input value={nguoiTestBatch} onChange={(e) => setNguoiTestBatch(e.target.value)}
              placeholder="Tên người test"
              className={!nguoiTestBatch.trim() ? 'border-danger' : ''} />
          </div>
        )}
        onConfirm={() => {
          if (!nguoiTestBatch.trim()) { show('Bắt buộc nhập người test khi QA xác nhận đạt', 'error'); return; }
          setScanOpen(false); doBatch();
        }}
        confirmLabel="QA xác nhận đạt"
      />


      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử Test Run" fetcher={testRunHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã QA xác nhận" maHeader="Lệnh" fetcher={testQaDone} showChuyen
        extraColumns={testRunColumns} extraExcelColumns={testRunExcelColumns} />

      <Toast toast={toast} />
    </div>
  );
}
