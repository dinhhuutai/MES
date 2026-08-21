import { useEffect, useState, useCallback, useMemo } from 'react';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import { codesCuaLenh, laGomSet } from '../utils/phanInLenh';
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
import { LOAI_TABS, hopChipChuyen as hopChip, nhanChip, demChip, locSiSoTheoChip } from '../../../utils/khuChuyen';
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
  const [nghenOpen, setNghenOpen] = useState(false); // modal "Danh sách nghẽn"
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
  // ⚠⚠ ĐÃ BỎ ô tích "Chỉ chờ QA" (20/08/2026): nó có từ thời còn màn Test Run - CNSP riêng. Nay CNSP
  //   gộp hẳn vào màn này nên "QA chưa xác nhận, hoặc xác nhận TEST LỖI" = CHƯA XONG, mà lệnh đã QA
  //   xong thì thuộc màn Release 2 ⇒ màn này LUÔN chỉ là hàng đợi của QA. **Lọc ở BACKEND**
  //   (`listTestRunCandidates`) để bảng · `meta.total` · dải "Theo dõi" cùng một tập.
  const [loai, setLoai] = useState(''); // chip loại chuyền / khu Bàn ('' = tất cả)

  // Lọc theo NGÀY KẾ HOẠCH SẢN XUẤT (`lenh_san_xuat.ngay_ke_hoach`) — chọn được NHIỀU NGÀY bằng
  // cùng 1 ô như trang Hồ sơ kỹ thuật. Mặc định RỖNG = không lọc: đây là màn thao tác hằng ngày,
  // mặc định lọc "hôm nay" sẽ giấu mất lệnh của các ngày khác mà QA không biết vì sao.
  const [ngayKH, setNgayKH] = useState({ from: '', to: '' });

  // Dải "Theo dõi" (sĩ số) bám ô tìm + panel lọc + dải chip loại chuyền/khu của màn này.
  // ⚠ Gửi kèm khoảng NGÀY SX KẾ HOẠCH — thiếu thì 4 số đếm cả lệnh ngoài khoảng ngày, trong khi bảng
  //   bên dưới đã ẩn chúng đi.
  // ⚠⚠ **KHÔNG còn khóa `choQa`** (bỏ 20/08/2026 cùng ô tích): mốc RA của trạm Test Run vốn đã là
  //   "TEST_QA đạt hoặc lệnh rời chặng RELEASE_1" ⇒ ô **Tồn** tự bằng đúng tập bảng đang hiện. Lọc
  //   thêm `cho_qa` chỉ làm hỏng 2 ô còn lại: phần in VÀO rồi RA ngay trong kỳ sẽ bị loại khỏi cả
  //   "Nhận trong kỳ" lẫn "Làm được trong kỳ" ⇒ "Làm được" gần như luôn ra 0.
  // ⚠ PHẢI đặt SAU `useState` của `ngayKH`: đọc biến `const` trước dòng khai báo là lỗi runtime
  //   ("Cannot access before initialization"), không phải cảnh báo lúc build.
  useSiSoLoc({
    timKiem: search,
    ...filters,
    ...locSiSoTheoChip(loai),
    ...(ngayKH.from || ngayKH.to
      ? { loaiNgay: 'NGAY_KE_HOACH', ngayTu: ngayKH.from, ngayDen: ngayKH.to } : {}),
  });
  const locNgay = useCallback((rs) => rs.filter((r) => trongKhoangNgay(r.ngay_ke_hoach, ngayKH.from, ngayKH.to)),
    [ngayKH]);
  // ⚠ KHÔNG lọc `qa_done` ở đây nữa — backend đã chỉ trả lệnh chưa QA đạt.
  const filtered = useMemo(() => {
    let base = locNgay(rows);
    if (loai) base = base.filter((r) => hopChip(r, loai));
    return filterRows(base, filters, FILTER_FIELDS);
  }, [rows, filters, loai, locNgay]);
  // ⚠⚠ ĐẾM THEO PHẦN IN **KHÔNG TRÙNG**, KHÔNG theo lệnh và cũng KHÔNG theo dòng (người dùng chốt
  //   19/08/2026). Dải "Theo dõi" đếm phần in khác nhau, nên đây phải cùng đơn vị mới so được.
  // ⚠ Bản đầu cộng `dsPhanIn(r).length` ⇒ chip "Tất cả" ra **885** trong khi chỉ có **797 phần in
  //   khác nhau**: 68 phần in được release nhiều lần nên xuất hiện ở nhiều lệnh và bị đếm lặp.
  //   885 là số DÒNG bảng vẽ ra — không phải số phần in.
  const countChip = useMemo(
    () => demChip(locNgay(rows), codesCuaLenh),
    [rows, locNgay]
  );
  // Badge: số phần in KHÁC NHAU đang hiện + số lệnh, để đối chiếu được cả hai.
  const tongPhanIn = useMemo(
    () => new Set(filtered.flatMap((r) => codesCuaLenh(r))).size,
    [filtered]
  );
  const activeCount = Object.values(filters).filter(Boolean).length;

  // Xuất Excel: lấy `filtered` = TOÀN BỘ lệnh sau bộ lọc (trang tải-hết rồi phân trang client
  // ⇒ không bị giới hạn ở trang đang xem).
  const doExcel = () => exportCheckpointExcel({
    cols: [...COT_LENH,
      { header: 'Số lần test', width: 11, num: true, value: (r) => r.so_lan_test },
      { header: 'Chờ kỹ thuật', width: 13, center: true, value: (r) => (r.cho_ky_thuat ? 'Chờ KT làm lại' : ''),
        red: (r) => !!r.cho_ky_thuat }],
    rows: filtered,
    title: 'Test Run - QA',
    fileName: 'test-run',
    moTaLoc: moTaBoLoc({
      'tìm kiếm': search,
      'ngày SX kế hoạch': [ngayKH.from, ngayKH.to].filter(Boolean).join(' → '),
      khu: nhanChip(loai), ...filters,
    }),
  });

  // ⚠⚠ TẢI HẾT MỌI TRANG — `getPaging` CAP CỨNG limit ở 200, xin 500 cũng chỉ nhận 200 và backend
  //   KHÔNG báo gì. Lỗi đã lộ thật trên prod 19/08/2026: 658 lệnh chờ test mà màn chỉ tải 200 ⇒
  //   **458 lệnh biến mất khỏi màn QA** (bảng sắp `created_date DESC` nên mất hết lệnh cũ hơn 13/08),
  //   ô tìm + panel lọc cũng chỉ soi trong 200 dòng đó, và dải "Theo dõi" (đọc thẳng DB) báo 787
  //   phần in trong khi chip "Tất cả" chỉ 195 — hai con số trên cùng một màn đá nhau.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { items, total, thieu } = await taiHetTrang((p) => listTestRunCandidates({ search, ...p }), { limit: LIMIT_TAI_LON });
      setRows(items);
      // ⚠ Chạm trần an toàn mà vẫn chưa gom đủ thì PHẢI báo — hiển thị thiếu trong im lặng đúng là
      //   thứ vừa gây ra sự cố này.
      if (thieu) show(`Chỉ tải được ${items.length}/${total} lệnh — hãy thu hẹp bằng ô tìm kiếm`, 'error');
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

  // Chỉ chọn được lệnh KHÔNG đang chờ kỹ thuật làm lại (đã bị trả về READY).
  // ⚠ Vẫn giữ `!r.qa_done` làm lưới an toàn: backend đã lọc, nhưng nếu về sau ai đó nới điều kiện ở
  //   đó thì chỗ này không được phép cho QA xác nhận đạt lần hai.
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
    { key: 'ten_chuyen', header: 'Chuyền', className: 'whitespace-nowrap font-medium text-ink', merge: true,
      render: (r) => r.ten_chuyen || r.ma_chuyen || '—' },
    // ⚠ GomBadge + badge "chờ kỹ thuật" là thông tin MỨC LỆNH ⇒ phải nằm trong cột `merge`. Để ở cột
    //   theo phần in thì nó lặp lại ở mọi dòng con, người đọc tưởng mỗi phần in là một lệnh riêng.
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', merge: true, render: (r) => (
      <div className="space-y-1">
        <Badge tone="info">{r.ma_lenh_san_xuat}</Badge>
        {r.so_dot_vai > 1 && <div><GomBadge soDotVai={r.so_dot_vai} soPhanIn={r.so_phan_in} /></div>}
        {/* Test không đạt → đã trả về Kỹ thuật; lệnh GIỮ NGUYÊN, chờ QC xác nhận READY để tự về Test Run. */}
        {r.cho_ky_thuat && (
          <div><TraVeBadge data={r.tra_ve} label="Chờ kỹ thuật làm lại" nguon="Test Run (QA)" /></div>
        )}
      </div>
    ) },
    // ↓ Các cột THEO PHẦN IN — dòng con ghi đè giá trị nên mỗi phần in hiện đúng dữ liệu của nó.
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    // Code phần là trường ĐANG ĐƯỢC LỌC/QUÉT, và là thứ duy nhất phân biệt các dòng con của gom set.
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    // ↓ Từ đây là mức LỆNH → hợp nhất ô.
    // ⚠ `phuong_an_in`/`loai_dot_vai`/`nha_gia_cong`/`han_giao_hang` lấy từ ĐỢT VẢI ĐẠI DIỆN
    //   (`PHAN_INFO_LATERAL` `LIMIT 1`) nên chỉ có MỘT giá trị — hợp nhất ô là cách trung thực nhất;
    //   lặp ở từng dòng con sẽ khiến người đọc tưởng mọi phần in đều đúng như vậy.
    { key: 'phuong_an_in', header: 'Phương án in', merge: true, render: (r) => <PhuongAnInBadge value={r.phuong_an_in} /> },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', merge: true, render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'nha_gia_cong', header: 'Nhà gia công', merge: true, render: (r) => r.nha_gia_cong || '—' },
    { key: 'han_giao_hang', header: 'Hạn giao', merge: true, render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
    // Hiện luôn cột đang được lọc — lọc theo một giá trị không nhìn thấy thì không đối chiếu được.
    { key: 'ngay_ke_hoach', header: 'Ngày SX KH', className: 'whitespace-nowrap', merge: true, render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'so_lan_test', header: 'Lần test', className: 'text-right tabular-nums', merge: true, render: (r) => r.so_lan_test },
    // ⚠ ĐÃ BỎ cột "QA" (20/08/2026): backend chỉ trả lệnh CHƯA QA đạt nên cột này luôn hiện "Chờ" —
    //   một cột chỉ có duy nhất một giá trị thì chỉ tốn bề ngang.
  ];

  // Lệnh GOM SET → tách 1 dòng / PHẦN IN. Lệnh thường trả `null` ⇒ render y như cũ.
  const subRows = (r) => (r.phan_in_list ? r.phan_in_list.map((p) => ({ ...p, __sub: true })) : null);

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
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="secondary" icon="download" onClick={doExcel} disabled={!filtered.length}>
          Excel ({filtered.length})
        </Button>
        <NghenButton rows={rows} trangThai={(r) => statusLenh(r.id)} onClick={() => setNghenOpen(true)} />
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        {/* ⚠ PHẦN IN đứng TRƯỚC vì đó là đơn vị của màn này (và của dải "Theo dõi"); số lệnh để trong
            ngoặc cho ai cần đối chiếu. Hai số lệch nhau là ĐÚNG khi có lệnh gom set. */}
        <Badge tone="info">{tongPhanIn} phần in{tongPhanIn !== filtered.length ? ` · ${filtered.length} lệnh` : ''}</Badge>
      </Toolbar>

      {/* Chip LOẠI CHUYỀN + KHU BÀN — cùng bộ với màn "Theo dõi chuyền".
          ⚠ Số trên chip đếm PHẦN IN (`soPhanIn`), không đếm lệnh — khớp badge + bảng + dải Theo dõi. */}
      <ChipTabs tabs={LOAI_TABS} value={loai} counts={countChip} onChange={setLoai} />

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      {/* Khối gom set: tách dòng theo phần in + VIỀN TRÁI xanh như màn Release 1 / Lập kế hoạch lại.
          ⚠ Dùng `border-l`, KHÔNG đổi nền — nền đang dành cho màu cảnh báo SLA nghẽn. */}
      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={(r) => setSel(r.id)} sttStart={0}
        subRows={subRows}
        rowClassName={(r) => `${slaRowClass(statusLenh(r.id))} ${laGomSet(r) ? 'border-l-[3px] border-l-primary' : ''}`}
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
        getCodes={codesCuaLenh}
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

      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="Test Run - QA" rows={rows} trangThai={(r) => statusLenh(r.id)} tenFile="nghen-test-run" />
      <Toast toast={toast} />
    </div>
  );
}
