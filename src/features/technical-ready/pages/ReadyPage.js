import { useEffect, useState, useCallback, useRef } from 'react';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import { useLocation } from 'react-router-dom';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import { Field, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNow from '../../../hooks/useNow';
import useSocketReload from '../../../hooks/useSocketReload';
import taiHetTrang from '../../../utils/taiHetTrang';
import { evalSla, slaRowClass } from '../../../utils/sla';
import TraVeBadge from '../../../components/common/TraVeBadge';
import TraVeFilter from '../../../components/common/TraVeFilter';
import { locTraVe, demTraVe } from '../../../utils/traVeNgay';
import {
  listReadyCandidates, confirmReadyBulk, readyHistory, readyDone, getReadyItemCounts,
  confirmReadyItemsBatch, uncheckReadyItem, traCuuMaQuet,
} from '../../../services/readyService';
import ReadyPanel from '../components/ReadyPanel';
import LoaiDotVaiBadge from '../../planning/components/LoaiDotVaiBadge';
import HanGiaoCell from '../../../components/common/HanGiaoCell';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import PhuongAnInCell from '../../../components/common/PhuongAnInCell';
import { fmtDateTime } from '../../../utils/format';
import { khuonRequired } from '../constants';
import exportReadyExcel from '../utils/exportReadyExcel';

const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' }, { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' }, { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' }, { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];

const STATUS = {
  CHUA: { tone: 'default', label: 'Chưa làm' },
  DANG: { tone: 'warning', label: 'Đang chuẩn bị' },
  CHO_QC: { tone: 'info', label: 'Chờ QC' },
  DONE: { tone: 'success', label: 'Hoàn thành' },
};

// Thứ tự hiển thị/thao tác: FILM → KHUÔN → MỰC (HSKT đã bỏ khỏi checklist READY).
const ITEMS = [
  { ma: 'FILM', label: 'Film', perm: 'READY_FILM', hasOptions: true },
  { ma: 'KHUON', label: 'Khuôn', perm: 'READY_KHUON', hasOptions: true },
  { ma: 'MUC', label: 'Mực', perm: 'READY_MUC', hasOptions: true },
];

const DoneCell = (done) =>
  done ? <Badge tone="success">✓</Badge> : <span className="text-ink-soft">–</span>;

// Ô "Film-Khuôn" — 3 trạng thái. Bám theo KHUÔN vì đó là mục quyết định "đủ mục kỹ thuật"
// (`utils/tech.js` CỐ Ý không xét Film). Ca "mới có Film, chưa Khuôn" hiện VÀNG chứ không hiện ✓ —
// nếu hiện ✓ thì người dùng tưởng xong trong khi backend vẫn coi là chưa.
const FilmKhuonCell = (r) => {
  if (r.khuon_done) return <Badge tone="success">✓</Badge>;
  if (r.film_done) return <Badge tone="warning" title="Đã xác nhận Film, còn chờ Khuôn">Film</Badge>;
  return <span className="text-ink-soft">–</span>;
};

export default function ReadyPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  // ⚠ Bấm thông báo "phần in bị trả về" (mig 085) dẫn tới `/ky-thuat/ready?q=<code phần>` ⇒ ô tìm
  //   phải ĐIỀN SẴN mã đó. Đọc lúc dựng để lần tải ĐẦU đã đúng, khỏi tải 2 lượt.
  const location = useLocation();
  const [rows, setRows] = useState([]);
  const [nghenOpen, setNghenOpen] = useState(false); // modal "Danh sách nghẽn"
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get('q') || '');
  // ⚠ ĐÃ BỎ state `page` + thanh `Pagination` phân trang SERVER: trang tải-hết rồi để `DataTable` tự
  //   phân trang 20/trang ở CLIENT. Giữ cả hai là 2 thanh phân trang chồng nhau trên cùng một bảng.
  const [sel, setSel] = useState(null);

  const [selected, setSelected] = useState(() => new Set());
  const [bulk, setBulk] = useState(null); // { ma, value }
  const [bulkSaving, setBulkSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [onlyReturned, setOnlyReturned] = useState(false); // lọc phần bị QC trả về
  // Khoảng NGÀY TRẢ VỀ (chỉ dùng khi `onlyReturned`) — rỗng = mọi ngày. Luật ở `utils/traVeNgay`.
  const [traVeRange, setTraVeRange] = useState({ from: '', to: '' });
  const [filters, setFilters] = useState({});

  // Dải "Theo dõi" (sĩ số) bám ĐÚNG ô tìm + panel lọc của màn này — xem hooks/useSiSoLoc.js.
  // ⚠ Gửi cả ô tích "Chỉ hiện phần bị trả về" + khoảng NGÀY TRẢ VỀ ⇒ 4 số khớp đúng bảng bên dưới.
  //   Backend hiểu `biTraVe` (bool) và tái dùng luôn `loaiNgay=NGAY_TRA_VE` cho khoảng ngày.
  useSiSoLoc({
    timKiem: search,
    ...filters,
    biTraVe: onlyReturned ? '1' : '',
    ...(onlyReturned && (traVeRange.from || traVeRange.to)
      ? { loaiNgay: 'NGAY_TRA_VE', ngayTu: traVeRange.from, ngayDen: traVeRange.to } : {}),
  });
  const [showFilters, setShowFilters] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [counts, setCounts] = useState({ khuon: 0, film: 0, muc: 0 }); // chưa xác nhận từng mục (toàn hệ thống)

  // ⚠⚠ ĐANG Ở SẴN TRANG NÀY MÀ BẤM THÔNG BÁO thì component KHÔNG mount lại (cùng route, chỉ đổi
  //   query) ⇒ lazy initializer của `useState` ở trên KHÔNG chạy lần nữa và ô tìm đứng im. Phải có
  //   effect này mới áp được mã mới. (Lỗi thật, người dùng bắt được 18/08/2026.)
  // ⚠ Phụ thuộc CẢ OBJECT `location` chứ KHÔNG phải `location.search`: bấm LẠI cùng một thông báo
  //   cho ra URL y hệt ⇒ `search` không đổi, nhưng `useLocation()` vẫn trả OBJECT MỚI cho mỗi lần
  //   điều hướng. Bám `search` thì lần bấm thứ hai (sau khi người dùng đã gõ tay thứ khác) sẽ không
  //   có tác dụng. Object này CHỈ đổi khi điều hướng ⇒ gõ tay trong ô tìm không bị URL ghi đè.
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q') || '';
    if (!q) return; // vào trang không kèm `?q` → giữ nguyên thứ đang gõ
    setSearch(q);
  }, [location]);

  const permItems = ITEMS.filter((it) => can(it.perm));
  // Đổi phương án in ngay tại cột — khớp đúng rbac của `PATCH /hskt/:id/phuong-an-in`
  // (`READY_KHUON | READY_FILM | READY_MUC`), tức bằng `permItems.length > 0`.
  const canDoiPain = permItems.length > 0;
  // Mục sẽ xác nhận khi quét/tích (mặc định = tất cả mục mình có quyền). Người phụ trách 1 mục → tự khóa mục đó.
  const [scanSel, setScanSel] = useState(() => new Set());
  const scanItemsRef = useRef({}); // rowId -> mảng mục đã xác nhận (để Hủy đúng)
  const labelOf = (ma) => ITEMS.find((i) => i.ma === ma)?.label || ma;
  useEffect(() => {
    if (scanOpen) setScanSel(new Set(permItems.map((it) => it.ma)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen]);
  const toggleScanItem = (ma) => setScanSel((s) => {
    const n = new Set(s); if (n.has(ma)) n.delete(ma); else n.add(ma); return n;
  });
  const activeCount = Object.values(filters).filter(Boolean).length;
  // "Chỉ hiện phần bị trả về" gộp CẢ 3 nguồn: QC READY · Kế hoạch (Release 1) · Test Run (QA),
  // kèm lọc theo NGÀY TRẢ VỀ khi người dùng chọn khoảng ngày (`locTraVe` — utils/traVeNgay).
  // ⚠ Khớp khi CÓ ÍT NHẤT MỘT lần trả về rơi trong khoảng, không phải lần mới nhất.
  const viewRows = filterRows(
    onlyReturned ? locTraVe(rows, traVeRange) : rows,
    filters, FILTER_FIELDS,
  );
  // Số phần in bị trả về TRƯỚC khi lọc ngày — để badge nói rõ "đang lọc N/M", tránh cảnh tick ô
  // rồi thấy bảng trống mà không hiểu là do khoảng ngày.
  const tongTraVe = onlyReturned ? demTraVe(rows) : 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Tải-hết để lọc client-side + quét mã khớp trọn vẹn; DataTable tự phân trang 20/trang.
      // ⚠⚠ `limit: 200` cũ ĐÚNG BẰNG trần của `getPaging` ⇒ vượt 200 phần in là mất dòng ÂM THẦM.
      //   Đo prod 19/08/2026: READY đang 164 — chỉ cách trần 36 dòng. Đây là màn quét mã nhiều nhất,
      //   thiếu dòng thì kỹ thuật quét ra "không thấy" mà không hiểu vì sao (xem sự cố Test Run - QA).
      const { items, total, thieu } = await taiHetTrang((p) => listReadyCandidates({ search, ...p }));
      setRows(items);
      setMeta({ total });
      if (thieu) show(`Chỉ tải được ${items.length}/${total} phần in — hãy thu hẹp bằng ô tìm kiếm`, 'error');
      setSelected(new Set());
      // Số chưa xác nhận từng mục — TOÀN HỆ THỐNG (không theo trang/lọc hiện tại).
      getReadyItemCounts().then((c) => setCounts(c.data)).catch(() => {});
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

  // Bộ phận Khuôn/Film/Mực làm trên MÁY KHÁC NHAU ⇒ phải tải lại ngầm khi có ai xác nhận,
  // nếu không mỗi máy giữ dữ liệu lúc mở trang (xem ghi chú cùng vấn đề ở `ReadyQcPage`).
  // KHÔNG dùng `load` vì nó xóa các dòng đang tick.
  const refresh = useCallback(async () => {
    try {
      // ⚠ Lượt tải NGẦM: cờ `thieu` CỐ Ý không báo — người dùng không bấm gì, toast đỏ ở đây là quấy rầy.
      const { items, total } = await taiHetTrang((p) => listReadyCandidates({ search, ...p }));
      setRows(items);
      setMeta({ total });
      getReadyItemCounts().then((c) => setCounts(c.data)).catch(() => {});
    } catch (e) { /* nền: giữ dữ liệu cũ khi lỗi mạng */ }
  }, [search]);
  useSocketReload(['ready:confirmed'], refresh);

  // Quét mã không khớp dòng nào → tra tiếp toàn hệ thống để nói RÕ vì sao (đã QC xong / đã release /
  // đã hủy) thay vì chỉ "Không thấy".
  const giaiThichQuetTruot = useCallback(async (code) => {
    try {
      const res = await traCuuMaQuet(code);
      return res.data?.mo_ta || null;
    } catch (e) { return null; }
  }, []);

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(rows.map((r) => r.id))));

  const openBulk = () => setBulk({ ma: permItems[0]?.ma || '' });

  // Xuất Excel ĐÚNG danh sách đang lọc trên màn (viewRows) — kèm người + giờ xác nhận từng mục.
  const [exporting, setExporting] = useState(false);
  const doExport = async () => {
    if (viewRows.length === 0) { show('Không có dòng nào để xuất', 'error'); return; }
    setExporting(true);
    try { await exportReadyExcel(viewRows); }
    catch (e) { show(e.message || 'Xuất Excel thất bại', 'error'); }
    finally { setExporting(false); }
  };

  const doBulk = async () => {
    setBulkSaving(true);
    try {
      const res = await confirmReadyBulk({ phanInIds: [...selected], ma: bulk.ma, value: bulk.value || undefined });
      const { okCount, skippedCount } = res.data;
      show(`Đã xác nhận ${okCount} phần in${skippedCount ? `, bỏ qua ${skippedCount}` : ''}`);
      setBulk(null);
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  const columns = [
    ...(permItems.length ? [{
      key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()} onChange={() => toggleOne(r.id)} aria-label="Chọn" />
      ),
    }] : []),
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => (
      <div>
        <div>{r.ma_phan || '—'}</div>
        {r.gom_set_list && <Badge tone="info" className="mt-1" title="Gom set: phần in này được gom in chung với các phần in KHÁC (cùng màu). ≠ Gộp đợt (cùng phần in, khác đợt)."><Icon name="git-branch" size={12} className="mr-1" />Gom set {r.gom_set_list}</Badge>}
        {(r.tra_ve || r.tra_ve_ly_do) && <div className="mt-1"><TraVeBadge data={r.tra_ve || r.tra_ve_ly_do} label="Bị QC trả về" nguon="QC" /></div>}
        {r.tra_ve_kh && <div className="mt-1"><TraVeBadge data={r.tra_ve_kh} label="Kế hoạch trả về" nguon="Kế hoạch (Release 1)" /></div>}
        {/* Test Run không đạt → QA trả về; modal hiện MỤC RỚT (Khuôn/Film/Mực) + lý do. */}
        {r.tra_ve_test && <div className="mt-1"><TraVeBadge data={r.tra_ve_test} label="Test Run trả về" nguon="Test Run (QA)" /></div>}
      </div>
    ) },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    // Phương án in (ERP `Pain`, lấy từ HSKT đang hoạt động): 1 Bàn · 2 Máy · 3 Robot.
    // Đổi được ngay tại chỗ: ⟳ xoay Bàn → Robot → Máy, ✓ mới ghi (kèm đổi số cuối mã vạch HSKT).
    { key: 'phuong_an_in', header: 'Phương án in', render: (r) => (
      <PhuongAnInCell value={r.phuong_an_in} hsktId={r.hskt_id} barcode={r.barcode_hskt}
        disabled={!canDoiPain} show={show} onChanged={refresh} />
    ) },
    // ⚠ 1 CỘT "Film-Khuôn" (gộp 16/08/2026): xác nhận Khuôn thì backend TỰ đặt Film = ĐẠT nên 2 cột
    // riêng gần như luôn giống nhau, chỉ tốn bề ngang. Ô này bám theo KHUÔN (đó là mục quyết định
    // "đủ mục KT"); trường hợp lẻ chỉ mới có Film mà chưa Khuôn thì hiện vàng để không giấu mất.
    // ⚠ Backend/quyền/checkpoint GIỮ NGUYÊN — Film vẫn là mục thật, vẫn bấm riêng được trong panel.
    // Hàng GIA CÔNG (II/AD) không làm khuôn lẫn film ⇒ ô này để trống.
    { key: 'khuon_done', header: `Film-Khuôn${counts.khuon ? ` (${counts.khuon})` : ''}`, className: 'text-center',
      render: (r) => (khuonRequired(r.ten_khach_hang)
        ? FilmKhuonCell(r)
        : <span className="text-ink-soft" title="Hàng gia công — không cần xác nhận Film/Khuôn">—</span>) },
    { key: 'muc_done', header: `Mực${counts.muc ? ` (${counts.muc})` : ''}`, className: 'text-center', render: (r) => DoneCell(r.muc_done) },
    { key: 'trang_thai_ready', header: 'Trạng thái', render: (r) => {
      const s = STATUS[r.trang_thai_ready] || STATUS.CHUA;
      return <Badge tone={s.tone}>{s.label}</Badge>;
    } },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
    { key: 'tg_qua_ready', header: 'Thời gian ERP lên MES', className: 'whitespace-nowrap', render: (r) => (
      <span className="text-ink-soft">{fmtDateTime(r.tg_qua_ready)}</span>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Chuẩn bị kỹ thuật — READY" subtitle="Xác nhận film / khuôn / mực trước khi Release"
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm code phần, mã hàng, màu/kích vải, kích phim...">
        {permItems.length > 0 && (
          <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét / tích mã</Button>
        )}
        {permItems.length > 0 && selected.size > 0 && (
          <Button onClick={openBulk}>Xác nhận hàng loạt ({selected.size})</Button>
        )}
        <TraVeFilter checked={onlyReturned} onChecked={setOnlyReturned}
          range={traVeRange} onRange={setTraVeRange} label="Chỉ hiện phần bị trả về" />
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="secondary" icon="file-spreadsheet" loading={exporting} onClick={doExport}>Excel ({viewRows.length})</Button>
        <NghenButton rows={rows} trangThai={(r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status} onClick={() => setNghenOpen(true)} />
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        {/* Đang lọc ngày trả về → nói rõ đang thấy bao nhiêu trên tổng số phần bị trả về. */}
        {onlyReturned
          ? <Badge tone="danger">{viewRows.length}/{tongTraVe} bị trả về</Badge>
          : <Badge tone="warning">{activeCount ? `${viewRows.length}/` : ''}{meta.total} chưa READY</Badge>}
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      <DataTable columns={columns} rows={viewRows} loading={loading} onRowClick={(r) => setSel(r.id)} sttStart={0}
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Tất cả phần in đã READY 🎉" />

      {sel && (
        <ReadyPanel phanInId={sel} onClose={() => setSel(null)} onChanged={load} />
      )}

      <Modal
        open={!!bulk}
        onClose={() => setBulk(null)}
        title={`Xác nhận hàng loạt — ${selected.size} phần in`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulk(null)}>Hủy</Button>
            <Button onClick={doBulk} loading={bulkSaving} disabled={!bulk?.ma}>
              Xác nhận
            </Button>
          </>
        }
      >
        <Field label="Mục cần xác nhận" required>
          <Select value={bulk?.ma || ''} onChange={(e) => setBulk({ ma: e.target.value })}>
            {permItems.map((it) => <option key={it.ma} value={it.ma}>{it.label}</option>)}
          </Select>
        </Field>
        <p className="text-xs text-ink-soft">
          Áp cho {selected.size} phần in đã chọn — chỉ cần xác nhận (không chọn mới/cũ/gia công). Phần in đã xác nhận mục này (hoặc đã QC) sẽ được bỏ qua.
        </p>
      </Modal>

      <ScanCollectModal
        open={scanOpen}
        onClose={() => { setScanOpen(false); load(); }}
        title="Quét / tích phần in — READY"
        rows={rows}
        immediate
        usbBarcode
        // Rộng ra để phiên quét hiện được dạng BẢNG (8 cột). Các màn khác giữ 'md' mặc định.
        size="xl"
        // Neo cách mép trên 100px thay vì canh giữa: danh sách "Đã xác nhận phiên này" dài dần ra
        // theo số mã quét, canh giữa thì mỗi lần quét cả hộp lại nhích lên.
        canhTren={100}
        getId={(r) => r.id}
        getCodes={(r) => [r.ma_phan]}
        getBarcodes={(r) => String(r.barcode || '').split(',').map((s) => s.trim()).filter(Boolean)}
        matchMultiple={false}
        // TẮT HẲN gom set ở màn này: quét mã nào thì xác nhận ĐÚNG phần in đó, không kéo theo các phần
        // cùng set. Lý do: READY quét là XÁC NHẬN NGAY, mà Khuôn/Film/Mực xác nhận độc lập theo từng
        // phần in ⇒ kéo cả set = xác nhận hộ những phần in người ta chưa hề quét.
        khongGomSet
        onNotFound={giaiThichQuetTruot}
        primaryLabel={(r) => r.ma_phan || r.barcode || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.ma_hang, r.mau_vai].filter(Boolean).join(' · ')}
        disabledScan={scanSel.size === 0}
        renderHeader={(
          <div className="rounded-control border border-line bg-surface-muted px-3 py-2">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Mục xác nhận khi quét</div>
            {permItems.length === 0 ? (
              <div className="text-xs text-danger">Bạn không có quyền xác nhận mục nào.</div>
            ) : permItems.length === 1 ? (
              <Badge tone="info">{permItems[0].label}</Badge>
            ) : (
              <div className="flex flex-wrap gap-3">
                {permItems.map((it) => (
                  <label key={it.ma} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink">
                    <input type="checkbox" checked={scanSel.has(it.ma)} onChange={() => toggleScanItem(it.ma)} />
                    {it.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        actionLabel={(r) => `${r.ma_phan || r.barcode} — ${[...scanSel].map(labelOf).join(' + ')}`}
        // Phiên quét hiện dạng BẢNG. Cố ý BỎ cột "Code phần" để nhường chỗ cho Khách hàng → Kích phim.
        // ⚠ `row` là ẢNH CHỤP lúc quét (không tự làm mới) — nên ô Phương án in tự giữ state riêng.
        sessionColumns={[
          { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium', render: (r) => r.ten_khach_hang || '—' },
          { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
          { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
          { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
          { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
          { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
          { key: 'phuong_an_in', header: 'Phương án in', render: (r) => (
            <PhuongAnInCell value={r.phuong_an_in} hsktId={r.hskt_id} barcode={r.barcode_hskt}
              disabled={!canDoiPain} show={show} onChanged={refresh} />
          ) },
          { key: 'da_xac_nhan', header: 'Đã xác nhận', render: (r) => (
            <span className="text-ink-soft">{(scanItemsRef.current[r.id] || []).map(labelOf).join(' + ') || '—'}</span>
          ) },
        ]}
        onScanAction={async (r) => {
          const items = [...scanSel];
          if (items.length === 0) throw new Error('Chọn mục cần xác nhận');
          await confirmReadyItemsBatch(r.id, items.map((ma) => ({ ma })));
          scanItemsRef.current[r.id] = items;
        }}
        onUndo={async (r) => {
          const items = scanItemsRef.current[r.id] || [...scanSel];
          for (const ma of items) { try { await uncheckReadyItem(r.id, ma); } catch { /* đã bỏ hoặc chưa có */ } }
          delete scanItemsRef.current[r.id];
        }}
      />

      <HistoryPanel
        open={histOpen}
        onClose={() => setHistOpen(false)}
        title="Lịch sử xác nhận kỹ thuật"
        fetcher={(date) => readyHistory(date, 'tech')}
      />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Phần in đã hoàn tất kỹ thuật (3 mục)" maHeader="Phần in"
        fetcher={(date) => readyDone(date, 'tech')} />

      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="Chuẩn bị kỹ thuật — READY" rows={rows} trangThai={(r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status} tenFile="nghen-ready" />
      <Toast toast={toast} />
    </div>
  );
}
