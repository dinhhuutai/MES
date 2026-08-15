import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Pagination from '../../../components/common/Pagination';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import Badge from '../../../components/common/Badge';
import TraVeBadge from '../../../components/common/TraVeBadge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import Spinner from '../../../components/common/Spinner';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Field, Input, Textarea } from '../../../components/common/controls';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import TimeSelect from '../../../components/common/TimeSelect';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import ReleaseListModal from '../components/ReleaseListModal';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import PhuongAnInBadge from '../../../components/common/PhuongAnInBadge';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import {
  listRelease1Candidates, createRelease1, listChuyen, release1History,
  release1Done, release1TraVeKyThuat,
} from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';
import exportCheckpointExcel, { COT_DOT_VAI, moTaBoLoc } from '../../../utils/exportCheckpointExcel';
// Chip lọc theo PHƯƠNG ÁN IN — nhãn dựng từ `PHUONG_AN_IN` nên không bao giờ lệch với badge.
import { PAIN_TABS, hopChipPain, nhanChipPain, demChipPain } from '../../../components/common/PhuongAnInBadge';
import ChipTabs from '../../../components/common/ChipTabs';

const dateOffsetStr = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function SelectAllCheckbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
  );
}

const TH = 'sticky top-0 z-20 bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft';
const TD = 'px-4 py-3 align-middle';

const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' }, { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' }, { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' }, { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];

// Các ô dữ liệu chung cho cả row lẻ lẫn member của set.
function DataCells({ r }) {
  return (
    <>
      <td className={`${TD} font-medium text-ink`}>
        <div className="leading-tight">
          <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
          <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {r.qc_done ? <Badge tone="success">Đã Ready</Badge> : <Badge tone="warning">Chờ Ready → KH tạm</Badge>}
          {/* Badge nhóm gom set — chỉ để BIẾT, KHÔNG còn ràng buộc release chung (chốt 15/08/2026). */}
          {r.ma_set && (
            <Badge tone="info" title="Thuộc gom set — vẫn release riêng từng phần in được">
              {r.ma_set}
            </Badge>
          )}
        </div>
        {(r.tra_ve || r.tra_ve_ly_do) && <div className="mt-1"><TraVeBadge data={r.tra_ve || r.tra_ve_ly_do} label="Bị Test Run trả về" nguon="Test Run (QA)" /></div>}
      </td>
      <td className={TD}>{r.ma_hang || '—'}</td>
      <td className={TD}>
        <div className="leading-tight">
          <div className="text-ink">{r.mau_vai || '—'}</div>
          <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
        </div>
      </td>
      <td className={TD}><TinhChatInCell value={r.tinh_chat_in} /></td>
      <td className={TD}><PhuongAnInBadge value={r.phuong_an_in} /></td>
      <td className={TD}><LoaiDotVaiBadge value={r.loai_dot_vai} /></td>
      <td className={TD}>{r.nha_gia_cong || '—'}</td>
      <td className={`${TD} text-right tabular-nums whitespace-nowrap`}>
        <b className="text-ink">{fmtNum(r.so_luong_vai_ve)}</b><span className="text-ink-soft"> / {fmtNum(r.so_luong_don_hang)}</span>
      </td>
      <td className={`${TD} text-right tabular-nums font-medium text-primary`}>{fmtNum(r.con_release ?? r.so_luong_vai_ve)}</td>
      <td className={TD}>{fmtDate(r.ngay_vai_ve)}</td>
      <td className={TD}>{fmtDate(r.han_giao_hang)}</td>
    </>
  );
}

export default function Release1Page() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { statusDot } = useNghenMap();
  const [selected, setSelected] = useState({});      // dot_vai_id -> row
  const [loaiPain, setLoaiPain] = useState('');      // chip lọc theo phương án in ('' = tất cả)
  const [chuyen, setChuyen] = useState([]);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [releaseListOpen, setReleaseListOpen] = useState(false); // modal "Danh sách release" (dùng chung với Tạo đợt SX)
  const [onlyReturned, setOnlyReturned] = useState(false); // lọc đợt vải bị QC trả về
  const [showReady, setShowReady] = useState(false); // lọc: hiện đợt "Đã Ready" (qc_done) — mặc định KHÔNG tick (hiện tất cả)
  const [showWait, setShowWait] = useState(false);   // lọc: hiện đợt "Chờ Ready" (chưa QC) — mặc định KHÔNG tick (hiện tất cả)
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [cpage, setCpage] = useState(1);             // phân trang CLIENT (chọn-tất-cả vẫn spanning mọi trang)

  const [detail, setDetail] = useState(null);        // row lẻ đang xem
  const [form, setForm] = useState({ chuyenId: '', soLuongRelease: '', ngayKeHoach: '', gioBd: '', gioKt: '' });
  const [releaseOpen, setReleaseOpen] = useState(false); // modal release gộp
  const [relForm, setRelForm] = useState({ chuyenId: '', ngayKeHoach: '', gioBd: '', gioKt: '' });
  const [saving, setSaving] = useState(false);
  const [traVeOpen, setTraVeOpen] = useState(false);     // modal "Trả về Kỹ thuật" (lý do bắt buộc)
  const [traVeReason, setTraVeReason] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Tải-hết (limit cao) để quét/tích khớp mọi đợt vải + lọc client trọn vẹn (mirror Release 2).
      // ⚠ ĐÃ BỎ `listReleaseSets`: đợt vải trong gom set nay hiện thành DÒNG LẺ ngay trong danh sách
      //   này (backend bỏ điều kiện loại chúng ra) ⇒ gọi thêm API set sẽ làm hàng hiện ĐÚP.
      const res = await listRelease1Candidates({ search, page, limit: 500 });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  // Tự tải lại khi trạm trước xác nhận (tránh màn để lâu → dữ liệu cũ).
  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua `setLoading(true)` (bảng không bị
  // thay bằng spinner) và KHÔNG xóa dòng đang tích. Nhiều sự kiện trong 400ms gộp thành 1 lần tải.
  useSocketReload(['ready:confirmed', 'workflow:updated'], () => load(true));

  const activeCount = Object.values(filters).filter(Boolean).length;
  // Lọc theo tình trạng Ready: cả 2 tick (hoặc cùng bỏ) = hiện tất cả; chỉ 1 tick = lọc theo tick đó.
  const readyPass = (isReady) => (showReady === showWait) || (showReady ? isReady : !isReady);

  // ⚠⚠ ĐÃ BỎ HẲN `viewSets` — không còn 2 đường hiển thị (đợt lẻ ↔ dòng SET) nữa, chỉ còn MỘT danh
  // sách đợt vải. Nhờ vậy hết luôn cả họ lỗi cũ "sửa bộ lọc/tìm kiếm/cột một bên thì bên kia lệch"
  // (fix 2026-08-08 từng phải vá riêng cho set).
  const viewRows = useMemo(() => {
    let base = onlyReturned ? rows.filter((r) => r.tra_ve_ly_do) : rows;
    if (loaiPain) base = base.filter((r) => hopChipPain(r, loaiPain));
    return filterRows(base, filters, FILTER_FIELDS).filter((r) => readyPass(!!r.qc_done));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyReturned, rows, filters, showReady, showWait, loaiPain]);

  // ⚠ Đếm chip tính trên tập TRƯỚC khi lọc chip (nhưng SAU các bộ lọc khác) — bấm 1 chip mà các chip
  //   còn lại về 0 thì không còn biết chỗ khác có bao nhiêu hàng.
  const countPain = useMemo(() => {
    const base = onlyReturned ? rows.filter((r) => r.tra_ve_ly_do) : rows;
    return demChipPain(filterRows(base, filters, FILTER_FIELDS).filter((r) => readyPass(!!r.qc_done)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyReturned, rows, filters, showReady, showWait]);

  // GOM TẠI CHỖ các đợt vải cùng gom set: giữ NGUYÊN vị trí của thành viên đầu tiên rồi kéo các
  // thành viên còn lại xuống ngay dưới ⇒ nhìn thành 1 khối liền mạch mà KHÔNG đẩy set lên đầu bảng.
  // ⚠ Cố ý không sort theo `ma_set`: bài học 2026-07-29 ở màn QC READY — đẩy set lên đầu làm trang 1
  //   toàn hàng chưa đủ điều kiện, người dùng tưởng mất cột checkbox.
  const viewRowsGom = useMemo(() => {
    const daRa = new Set();
    const out = [];
    viewRows.forEach((r) => {
      if (daRa.has(r.dot_vai_id)) return;
      out.push(r); daRa.add(r.dot_vai_id);
      if (!r.ma_set) return;
      viewRows.forEach((x) => {
        if (!daRa.has(x.dot_vai_id) && x.ma_set === r.ma_set) { out.push(x); daRa.add(x.dot_vai_id); }
      });
    });
    return out;
  }, [viewRows]);

  // Xuất Excel: TOÀN BỘ đợt vải sau bộ lọc (trang phân trang client nên `viewRowsGom` đã là
  // "hết mọi trang"). Cột "Gom set" giữ lại để vẫn biết đợt nào vốn định in chung.
  const doExcel = () => exportCheckpointExcel({
    cols: [{ header: 'Gom set', width: 12, value: (r) => r.ma_set || '' }, ...COT_DOT_VAI],
    rows: viewRowsGom,
    title: 'Release 1 — chờ release',
    fileName: 'release-1',
    moTaLoc: moTaBoLoc({
      'tìm kiếm': search, 'chỉ bị trả về': onlyReturned ? 'có' : '',
      'đã Ready': showReady ? 'có' : '', 'chờ Ready': showWait ? 'có' : '',
      'phương án in': nhanChipPain(loaiPain), ...filters,
    }),
  });

  // Phân trang CLIENT — mỗi đợt vải = 1 "mục" (không còn khối SET gộp nhiều dòng).
  // Chọn-tất-cả (toggleAll) vẫn thao tác trên TOÀN BỘ viewRowsGom nên chọn được mọi trang.
  const PAGE_SIZE = 20;
  const totalCPages = Math.max(1, Math.ceil(viewRowsGom.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(cpage, 1), totalCPages);
  useEffect(() => { setCpage(1); }, [viewRowsGom.length]);
  const pageItems = viewRowsGom.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const sttBase = (safePage - 1) * PAGE_SIZE;

  const looseList = useMemo(() => Object.values(selected), [selected]);
  const tongVai = useMemo(() => looseList.reduce((s, r) => s + (Number(r.so_luong_vai_ve) || 0), 0), [looseList]);
  const totalSel = looseList.length;

  const toggle = (row) => setSelected((s) => {
    const next = { ...s };
    if (next[row.dot_vai_id]) delete next[row.dot_vai_id]; else next[row.dot_vai_id] = row;
    return next;
  });
  // Chọn tất cả ở header = chọn MỌI đợt vải ĐANG HIỂN THỊ (sau lọc), spanning tất cả trang phân trang
  // — không chỉ trang hiện tại.
  const allChecked = viewRowsGom.length > 0 && viewRowsGom.every((r) => selected[r.dot_vai_id]);
  const someChecked = viewRowsGom.some((r) => selected[r.dot_vai_id]);
  const toggleAll = () => {
    if (allChecked) setSelected((s) => { const n = { ...s }; viewRowsGom.forEach((r) => delete n[r.dot_vai_id]); return n; });
    else setSelected((s) => { const n = { ...s }; viewRowsGom.forEach((r) => { n[r.dot_vai_id] = r; }); return n; });
  };

  // ⚠ Panel nay LUÔN là panel thao tác đầy đủ (có nút Release + form chuyền/SL/ngày), kể cả với đợt
  //   vải thuộc gom set — trước đây đợt trong set mở ra panel CHỈ XEM vì phải release chung cả set.
  const openDetail = (row) => {
    setDetail(row);
    // Mặc định release phần CÒN LẠI (SL vải về − đã release); release theo số lượng, giữ phần còn.
    setForm({ chuyenId: chuyen[0]?.id || '', soLuongRelease: String(row.con_release ?? row.so_luong_vai_ve ?? ''), ngayKeHoach: dateOffsetStr(1), gioBd: '', gioKt: '' });
  };

  // Release 1 phần in lẻ (từ side panel chi tiết)
  const submitRelease = async (dotVaiIds) => {
    setSaving(true);
    try {
      // Giờ BD/KT (HH:MM) ghép với ngày kế hoạch → timestamp, y hệt màn Tạo đợt sản xuất.
      const mkTs = (gio) => (form.ngayKeHoach && gio ? `${form.ngayKeHoach}T${gio}:00` : null);
      const res = await createRelease1({
        dotVaiIds, chuyenId: form.chuyenId,
        soLuongRelease: form.soLuongRelease ? Number(form.soLuongRelease) : null,
        ngayKeHoach: form.ngayKeHoach || null,
        tgBdKh: mkTs(form.gioBd), tgKtKh: mkTs(form.gioKt),
      });
      const skipped = res?.data?.skipped_test_count || 0;
      const tam = res?.data?.ke_hoach_tam_count || 0;
      const tamMsg = tam > 0 ? ` · ${tam} phần chưa Ready → lưu Kế hoạch tạm` : '';
      if (res?.data?.chi_tam) show(`${tam} phần chưa Ready → đã lưu Kế hoạch tạm (xác nhận lại khi Ready xong)`, 'success');
      else show((skipped > 0 ? `Đã tạo lệnh — ${skipped} đợt vải vào thẳng Release 2` : 'Đã Release 1 — tạo lệnh sản xuất') + tamMsg);
      setSelected((s) => { const n = { ...s }; dotVaiIds.forEach((id) => delete n[id]); return n; });
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Release thất bại', 'error');
    } finally { setSaving(false); }
  };

  // Trả đợt vải ở Release 1 ngược về Kỹ thuật (mở lại READY) — lý do BẮT BUỘC, nhập trong modal
  // (không dùng window.prompt) và hiện lại ở màn READY để kỹ thuật biết vì sao phải làm lại.
  const doTraVeKyThuat = async () => {
    if (!detail) return;
    const lyDo = traVeReason.trim();
    if (!lyDo) { show('Nhập lý do trả về Kỹ thuật', 'error'); return; }
    setSaving(true);
    try {
      await release1TraVeKyThuat({ dotVaiId: detail.dot_vai_id, lyDo });
      show('Đã trả về Kỹ thuật — phần in quay lại READY');
      setTraVeOpen(false); setTraVeReason('');
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Trả về Kỹ thuật thất bại', 'error');
    } finally { setSaving(false); }
  };

  const openReleaseAll = () => {
    setRelForm({ chuyenId: chuyen[0]?.id || '', ngayKeHoach: dateOffsetStr(1), gioBd: '', gioKt: '' });
    setReleaseOpen(true);
  };

  // Release gộp: MỖI ĐỢT VẢI → 1 lệnh riêng (kể cả đợt thuộc gom set — chốt 15/08/2026).
  // Đợt chưa Ready thì backend tự lưu Kế hoạch tạm thay vì tạo lệnh (`createRelease1` tách 2 nhánh).
  const doReleaseAll = async () => {
    setSaving(true);
    try {
      const mkTsR = (gio) => (relForm.ngayKeHoach && gio ? `${relForm.ngayKeHoach}T${gio}:00` : null);
      const res = await createRelease1({
        dotVaiIds: looseList.map((r) => r.dot_vai_id),
        chuyenId: relForm.chuyenId, soLuongRelease: null, ngayKeHoach: relForm.ngayKeHoach || null,
        tgBdKh: mkTsR(relForm.gioBd), tgKtKh: mkTsR(relForm.gioKt),
      });
      const tam = res?.data?.ke_hoach_tam_count || 0;
      const daTao = res?.data?.created_count || 0;
      show(`Đã tạo ${daTao} lệnh${tam > 0 ? ` · ${tam} đợt chưa Ready → lưu Kế hoạch tạm` : ''}`);
      setSelected({}); setReleaseOpen(false);
      load();
    } catch (e) {
      show(e.message || 'Release thất bại', 'error');
    } finally { setSaving(false); }
  };

  const colCount = 13; // +1 "Tính chất in", +1 "Phương án in", +1 "Nhà gia công" (mig 072)

  return (
    <div>
      <Toolbar title="Release 1" subtitle="Phần in đã READY — chọn đợt vải/set & chuyền để release"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, mã hàng, màu, kích...">
        <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR code phần</Button>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={onlyReturned} onChange={(e) => setOnlyReturned(e.target.checked)} />
          Chỉ hiện phần bị trả về
        </label>
        <span className="flex items-center gap-2 rounded-control border border-line px-2 py-1 text-xs text-ink-soft">
          <span className="font-medium">Tình trạng:</span>
          <label className="flex items-center gap-1"><input type="checkbox" checked={showReady} onChange={(e) => setShowReady(e.target.checked)} />Đã Ready</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={showWait} onChange={(e) => setShowWait(e.target.checked)} />Chờ Ready</label>
        </span>
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        {/* Cùng modal với màn "Tạo đợt sản xuất" — người lập kế hoạch ở Release 1 cũng cần in/xuất
            danh sách release cho chuyền mà không phải nhảy sang màn khác. */}
        <Button variant="secondary" icon="list" onClick={() => setReleaseListOpen(true)}>Danh sách release</Button>
        <Button variant="secondary" icon="download" onClick={doExcel}
          disabled={!viewRowsGom.length}>Excel</Button>
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{activeCount || loaiPain ? `${viewRowsGom.length}/` : ''}{meta.total} đợt vải</Badge>
      </Toolbar>

      <ChipTabs tabs={PAIN_TABS} value={loaiPain} counts={countPain} onChange={setLoaiPain} />

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-13rem)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-left">
                <th className={`${TH} w-10`}>
                  <SelectAllCheckbox checked={allChecked} indeterminate={!allChecked && someChecked} onChange={toggleAll} />
                </th>
                <th className={`${TH} w-12 text-right`}>STT</th>
                <th className={TH}>Khách hàng · Đơn hàng</th>
                <th className={TH}>Mã hàng</th>
                <th className={TH}>Màu · Kích (vải/phim)</th>
                <th className={TH}>Tính chất in</th>
                <th className={TH}>Phương án in</th>
                <th className={TH}>Loại đợt vải</th>
                {/* Nhà gia công (ERP NGC, mig 072) — theo ĐỢT NHẬN VẢI. */}
                <th className={TH}>Nhà gia công</th>
                <th className={`${TH} text-right`}>SL vải về / đơn</th>
                <th className={`${TH} text-right`}>Còn release</th>
                <th className={TH}>Ngày nhận vải</th>
                <th className={TH}>Hạn giao</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colCount} className="px-4 py-12 text-center text-ink-soft"><Spinner size={22} className="mx-auto" /></td></tr>
              ) : viewRowsGom.length === 0 ? (
                <tr><td colSpan={colCount} className="px-4 py-12 text-center text-ink-soft">
                  {loaiPain
                    ? `Không có đợt vải nào thuộc phương án in "${nhanChipPain(loaiPain)}"`
                    : 'Không có đợt vải nào sẵn sàng Release 1'}
                </td></tr>
              ) : (
                pageItems.map((r, idx) => {
                  const stt = sttBase + idx + 1;
                  // Các đợt cùng gom set nằm liền nhau (gom tại chỗ) ⇒ kẻ VIỀN TRÁI xanh cho cả khối
                  // để nhìn ra nhóm. ⚠ Dùng `border-l`, KHÔNG đổi nền — nền dành cho màu cảnh báo SLA.
                  const truoc = pageItems[idx - 1];
                  const sau = pageItems[idx + 1];
                  const dauKhoi = r.ma_set && truoc?.ma_set !== r.ma_set;
                  const cuoiKhoi = r.ma_set && sau?.ma_set !== r.ma_set;
                  return (
                    <tr key={r.dot_vai_id} onClick={() => openDetail(r)}
                      className={`cursor-pointer border-b transition hover:bg-surface-muted/40
                        ${cuoiKhoi || !r.ma_set ? 'border-line/70' : 'border-transparent'}
                        ${r.ma_set ? 'border-l-[3px] border-l-primary/60' : ''}
                        ${slaRowClass(statusDot(r.dot_vai_id))}`}>
                      {/* Ô CHỌN: chặn ở cấp <td> (không chỉ trên <input>) — bấm vào phần đệm quanh
                          checkbox trước đây vẫn mở SidePanel. */}
                      <td className={TD} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={!!selected[r.dot_vai_id]}
                          onChange={() => toggle(r)}
                          className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
                      </td>
                      <td className={`${TD} text-right tabular-nums text-ink-soft`}>
                        {stt}
                        {dauKhoi && (
                          <span className="mt-1 flex items-center justify-end gap-0.5 text-[10px] font-medium text-primary">
                            <Icon name="package" size={11} /> set
                          </span>
                        )}
                      </td>
                      <DataCells r={r} />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={safePage} totalPages={totalCPages} total={viewRowsGom.length} onPage={setCpage} />

      {/* Thanh "Đã chọn" GHIM CỐ ĐỊNH (fixed) ở đáy màn hình — luôn thấy dù bảng dài hay đang cuộn.
          · desktop: cách đáy 5px · dưới lg: nâng lên trên BottomNav (nav fixed z-40, lg:hidden)
          · z-30 để KHÔNG đè Modal/SidePanel (Headless UI z-50) và không che BottomNav
          · căn giữa + rộng theo nội dung ⇒ không phủ lên Sidebar bên trái */}
      {totalSel > 0 && (
        <>
          <div className="h-20 lg:h-16" aria-hidden="true" />{/* chừa chỗ để thanh không che phân trang */}
          <div className="fixed bottom-[4.75rem] left-1/2 z-30 flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card border border-line bg-surface px-5 py-3 shadow-card-hover lg:bottom-[5px]">
            <span className="text-sm text-ink">
              Đã chọn <b>{looseList.length}</b> đợt vải (SL {fmtNum(tongVai)})
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelected({})}>Bỏ chọn</Button>
              <Button onClick={openReleaseAll}>Release ({totalSel})</Button>
            </div>
          </div>
        </>
      )}

      {/* Modal release nhiều đợt — MỖI ĐỢT 1 LỆNH RIÊNG (kể cả đợt thuộc gom set). */}
      <Modal
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        title="Release 1"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReleaseOpen(false)}>Hủy</Button>
            <Button onClick={doReleaseAll} loading={saving} disabled={!relForm.chuyenId}>Xác nhận Release</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          <div>{looseList.length} đợt vải → <b>mỗi đợt 1 lệnh riêng</b></div>
          {looseList.some((r) => r.ma_set) && (
            <div className="mt-1 text-xs">
              Trong đó có đợt thuộc gom set — vẫn tách thành lệnh riêng, không gom chung.
            </div>
          )}
          {looseList.some((r) => !r.qc_done) && (
            <div className="mt-1 text-xs text-amber-600">
              Đợt chưa Ready sẽ được lưu <b>Kế hoạch tạm</b> thay vì tạo lệnh.
            </div>
          )}
        </div>
        <Field label="Chuyền in" required>
          <ChuyenPicker chuyen={chuyen} value={relForm.chuyenId} onChange={(id) => setRelForm({ ...relForm, chuyenId: id })} />
        </Field>
        <Field label="Ngày kế hoạch">
          <Input type="date" value={relForm.ngayKeHoach} onChange={(e) => setRelForm({ ...relForm, ngayKeHoach: e.target.value })} />
        </Field>
        {/* Giờ BD/KT — ghép với ngày kế hoạch thành `tg_bd_kh`/`tg_kt_kh`; bỏ trống thì không ghi giờ.
            Dùng `TimeSelect` (24h) chứ KHÔNG `<input type="time">` — ô đó hiện AM/PM theo locale máy. */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giờ bắt đầu">
            <TimeSelect value={relForm.gioBd} onChange={(v) => setRelForm({ ...relForm, gioBd: v })} minuteStep={5} />
          </Field>
          <Field label="Giờ kết thúc">
            <TimeSelect value={relForm.gioKt} onChange={(v) => setRelForm({ ...relForm, gioKt: v })} minuteStep={5} />
          </Field>
        </div>
      </Modal>

      {/* Chi tiết / release 1 đợt vải lẻ */}
      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Release 1 — ${detail.ma_phan || ''}` : 'Chi tiết phần in'}
        subtitle={detail ? `${detail.ten_khach_hang || ''} · ${detail.mau_vai || ''}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>Đóng</Button>
            {/* Chỉ phần in ĐÃ READY (QC xác nhận) mới trả về Kỹ thuật được — phần "Chờ Ready" vẫn đang ở READY.
                ⚠ Từ 15/08/2026 trả về LẺ đúng 1 phần in, kể cả đợt thuộc gom set. */}
            {detail?.qc_done && (
              <Button variant="danger" icon="chevron-left"
                onClick={() => { setTraVeReason(''); setTraVeOpen(true); }}>Trả về Kỹ thuật</Button>
            )}
            <Button onClick={() => submitRelease([detail.dot_vai_id])} loading={saving} disabled={!form.chuyenId}>Xác nhận Release 1</Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            {detail.ma_set && (
              <div className="rounded-control border border-primary/30 bg-primary-wash px-3 py-2 text-sm text-primary">
                Đợt vải thuộc <b>{detail.ma_set}</b> (gom set). Từ nay <b>vẫn release riêng đợt này</b> —
                các phần in khác trong set không bị ảnh hưởng.
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="Khách hàng" value={detail.ten_khach_hang} />
              <Info label="Đơn hàng" value={detail.ma_don_hang} />
              <Info label="Mã hàng" value={detail.ma_hang} />
              <Info label="Code phần" value={detail.ma_phan} />
              <Info label="Màu vải" value={detail.mau_vai} />
              <Info label="Đợt vải" value={detail.ma_dot_vai} />
              <Info label="Kích vải" value={detail.kich_vai} />
              <Info label="Kích phim" value={detail.kich_phim} />
              <Info label="SL đơn hàng" value={fmtNum(detail.so_luong_don_hang)} />
              <Info label="SL nhận vải" value={fmtNum(detail.so_luong_vai_ve)} />
              <Info label="Đã release" value={fmtNum(detail.da_release || 0)} />
              <Info label="Còn release" value={fmtNum(detail.con_release ?? detail.so_luong_vai_ve)} />
              <Info label="Ngày nhận vải" value={fmtDate(detail.ngay_vai_ve)} />
              <Info label="Hạn giao" value={fmtDate(detail.han_giao_hang)} />
            </div>
            {/* Form release LUÔN hiện — đợt thuộc gom set nay cũng release riêng được. */}
            <div className="space-y-3 border-t border-line pt-4">
              <Field label="Chuyền in" required>
                <ChuyenPicker chuyen={chuyen} value={form.chuyenId} onChange={(id) => setForm({ ...form, chuyenId: id })} />
              </Field>
              <div className="grid grid-cols-2 gap-x-4">
                <Field label="Số lượng release" hint={`Còn lại ${fmtNum(detail.con_release ?? detail.so_luong_vai_ve)} — release ít hơn thì đợt vẫn ở lại kế hoạch với phần còn`}>
                  <Input type="number" min="1" max={detail.con_release ?? detail.so_luong_vai_ve}
                    value={form.soLuongRelease} onChange={(e) => setForm({ ...form, soLuongRelease: e.target.value })} />
                </Field>
                <Field label="Ngày kế hoạch">
                  <Input type="date" value={form.ngayKeHoach} onChange={(e) => setForm({ ...form, ngayKeHoach: e.target.value })} />
                </Field>
                <Field label="Giờ bắt đầu">
                  <TimeSelect value={form.gioBd} onChange={(v) => setForm({ ...form, gioBd: v })} minuteStep={5} />
                </Field>
                <Field label="Giờ kết thúc">
                  <TimeSelect value={form.gioKt} onChange={(v) => setForm({ ...form, gioKt: v })} minuteStep={5} />
                </Field>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Trả về Kỹ thuật — lý do bắt buộc (hiện lại ở màn READY / QC READY) */}
      <Modal
        open={traVeOpen}
        onClose={() => setTraVeOpen(false)}
        title={`Trả về Kỹ thuật — ${detail?.ma_phan || ''}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTraVeOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={doTraVeKyThuat} loading={saving} disabled={!traVeReason.trim()}>
              Xác nhận trả về
            </Button>
          </>
        }
      >
        <p className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Phần in sẽ quay lại <b>READY</b>: hủy xác nhận Khuôn/Film/Mực + QC, kỹ thuật phải làm lại.
          Lý do sẽ hiện ở màn Chuẩn bị kỹ thuật.
          {detail?.ma_set && (
            <> Đợt thuộc <b>{detail.ma_set}</b> nhưng <b>chỉ trả về đúng phần in này</b> — các phần in
            khác trong set giữ nguyên.</>
          )}
        </p>
        <Field label="Lý do trả về" required>
          <Textarea rows={3} value={traVeReason} onChange={(e) => setTraVeReason(e.target.value)}
            placeholder="Vì sao trả về kỹ thuật (vd: sai film, khuôn chưa đạt...)" />
        </Field>
      </Modal>

      <ScanCollectModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Quét QR code phần — Release 1"
        help="Quét QR code phần để chọn đợt vải lẻ (mọi đợt chưa release của phần in đó). Quét nhiều rồi bấm Release để release tất cả cùng lúc."
        rows={rows}
        getId={(r) => r.dot_vai_id}
        getCodes={(r) => [r.ma_phan]}
        matchMultiple
        isSelected={(r) => !!selected[r.dot_vai_id]}
        onToggle={(r) => toggle(r)}
        primaryLabel={(r) => r.ma_phan || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.mau_vai, r.kich_vai].filter(Boolean).join(' · ')}
        onConfirm={() => { setScanOpen(false); openReleaseAll(); }}
        confirmLabel="Release"
      />

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)} title="Lịch sử Release 1" fetcher={release1History} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã Release 1" maHeader="Lệnh" fetcher={release1Done} />
      <ReleaseListModal open={releaseListOpen} onClose={() => setReleaseListOpen(false)} />
      <Toast toast={toast} />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{value || '—'}</div>
    </div>
  );
}
