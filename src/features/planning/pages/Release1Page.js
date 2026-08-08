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
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import PhuongAnInBadge from '../../../components/common/PhuongAnInBadge';
import useToast from '../../../hooks/useToast';
import useSocketEvent from '../../../hooks/useSocketEvent';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import {
  listRelease1Candidates, createRelease1, listChuyen, release1History,
  listReleaseSets, releaseSet, release1Done, release1TraVeKyThuat, keHoachTamSet,
} from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';
import exportCheckpointExcel, { COT_DOT_VAI, moTaBoLoc } from '../../../utils/exportCheckpointExcel';

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
        <div className="mt-1">
          {r.qc_done ? <Badge tone="success">Đã Ready</Badge> : <Badge tone="warning">Chờ Ready → KH tạm</Badge>}
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
  const [sets, setSets] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { statusDot } = useNghenMap();
  const [selected, setSelected] = useState({});      // dot_vai_id -> row (lẻ)
  const [selectedSets, setSelectedSets] = useState(() => new Set()); // set id
  const [chuyen, setChuyen] = useState([]);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [onlyReturned, setOnlyReturned] = useState(false); // lọc đợt vải bị QC trả về
  const [showReady, setShowReady] = useState(false); // lọc: hiện đợt "Đã Ready" (qc_done) — mặc định KHÔNG tick (hiện tất cả)
  const [showWait, setShowWait] = useState(false);   // lọc: hiện đợt "Chờ Ready" (chưa QC) — mặc định KHÔNG tick (hiện tất cả)
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [cpage, setCpage] = useState(1);             // phân trang CLIENT (chọn-tất-cả vẫn spanning mọi trang)

  const [detail, setDetail] = useState(null);        // row lẻ đang xem
  const [form, setForm] = useState({ chuyenId: '', soLuongRelease: '', ngayKeHoach: '' });
  const [releaseOpen, setReleaseOpen] = useState(false); // modal release gộp
  const [relForm, setRelForm] = useState({ chuyenId: '', ngayKeHoach: '' });
  const [saving, setSaving] = useState(false);
  const [traVeOpen, setTraVeOpen] = useState(false);     // modal "Trả về Kỹ thuật" (lý do bắt buộc)
  const [traVeReason, setTraVeReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, setRes] = await Promise.all([
        // Tải-hết (limit cao) để quét/tích khớp mọi đợt vải + lọc client trọn vẹn (mirror Release 2).
        listRelease1Candidates({ search, page, limit: 500 }),
        listReleaseSets({ search }),
      ]);
      setRows(res.data.items);
      setMeta(res.data.meta);
      setSets(setRes.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  // Tự tải lại khi trạm trước xác nhận (tránh màn để lâu → dữ liệu cũ).
  useSocketEvent('ready:confirmed', () => load());
  useSocketEvent('workflow:updated', () => load());

  // Lọc "chỉ hiện phần bị trả về": ẩn set (đợt vải bị trả về nằm ở pool lẻ), chỉ hiện đợt vải lẻ bị trả về.
  const activeCount = Object.values(filters).filter(Boolean).length;
  // Lọc theo tình trạng Ready: cả 2 tick (hoặc cùng bỏ) = hiện tất cả; chỉ 1 tick = lọc theo tick đó.
  const readyPass = (isReady) => (showReady === showWait) || (showReady ? isReady : !isReady);
  // ⚠⚠ BỘ LỌC PHẢI SOI XUỐNG THÀNH VIÊN SET, ĐỪNG ẨN SẠCH SET (fix 2026-08-08).
  // Bản cũ: `activeCount > 0 ? [] : …` ⇒ chỉ cần nhập 1 ô bất kỳ trong panel Bộ lọc là MỌI dòng gom set
  // biến mất ⇒ người dùng lọc theo code phần rồi kết luận "phần in không có ở Release 1" (ca thật:
  // GL-2607-011-A006-F03-C05/C06 trong SET0165, cả 2 đã Ready và hoàn toàn hợp lệ).
  // Nay: set HIỆN khi có ÍT NHẤT 1 thành viên khớp bộ lọc — cùng cách hiểu với đường đợt vải lẻ.
  // (`onlyReturned` vẫn ẩn set: đợt vải bị trả về nằm ở pool LẺ, không nằm trong set.)
  const viewSets = useMemo(() => {
    if (onlyReturned) return [];
    const base = sets.filter((s) => readyPass(!!s.san_sang));
    if (!activeCount) return base;
    return base.filter((s) => filterRows(s.members || [], filters, FILTER_FIELDS).length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyReturned, activeCount, filters, sets, showReady, showWait]);
  const viewRows = useMemo(
    () => filterRows(onlyReturned ? rows.filter((r) => r.tra_ve_ly_do) : rows, filters, FILTER_FIELDS)
      .filter((r) => readyPass(!!r.qc_done)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onlyReturned, rows, filters, showReady, showWait],
  );

  // Xuất Excel: gộp đợt vải LẺ + đợt vải trong các SET đang hiện, lấy TOÀN BỘ sau bộ lọc
  // (trang phân trang client nên `viewRows`/`viewSets` đã là "hết mọi trang").
  const doExcel = () => {
    const setRows = viewSets.flatMap((s) => (s.members || []).map((m) => ({ ...m, _ma_set: s.ma_set })));
    exportCheckpointExcel({
      cols: [{ header: 'Gom set', width: 12, value: (r) => r._ma_set || '' }, ...COT_DOT_VAI],
      rows: [...setRows, ...viewRows],
      title: 'Release 1 — chờ release',
      fileName: 'release-1',
      moTaLoc: moTaBoLoc({
        'tìm kiếm': search, 'chỉ bị trả về': onlyReturned ? 'có' : '',
        'đã Ready': showReady ? 'có' : '', 'chờ Ready': showWait ? 'có' : '', ...filters,
      }),
    });
  };

  // Phân trang CLIENT trên danh sách gộp (set + đợt vải lẻ) — mỗi SET/đợt lẻ = 1 "mục".
  // Chọn-tất-cả (toggleAll) vẫn thao tác trên TOÀN BỘ viewRows/selectableSets nên chọn được mọi trang.
  const PAGE_SIZE = 20;
  const combined = useMemo(() => [
    ...viewSets.map((s) => ({ kind: 'set', key: `set-${s.id}`, s })),
    ...viewRows.map((r) => ({ kind: 'row', key: r.dot_vai_id, r })),
  ], [viewSets, viewRows]);
  const totalCPages = Math.max(1, Math.ceil(combined.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(cpage, 1), totalCPages);
  useEffect(() => { setCpage(1); }, [combined.length]);
  const pageItems = combined.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const sttBase = (safePage - 1) * PAGE_SIZE;

  const looseList = useMemo(() => Object.values(selected), [selected]);
  const selectedSetList = useMemo(() => sets.filter((s) => selectedSets.has(s.id)), [sets, selectedSets]);
  const tongVai = useMemo(() => looseList.reduce((s, r) => s + (Number(r.so_luong_vai_ve) || 0), 0), [looseList]);
  const totalSel = looseList.length + selectedSetList.length;

  const toggle = (row) => setSelected((s) => {
    const next = { ...s };
    if (next[row.dot_vai_id]) delete next[row.dot_vai_id]; else next[row.dot_vai_id] = row;
    return next;
  });
  // Chọn tất cả ở header = chọn MỌI đợt vải lẻ + set ĐANG HIỂN THỊ (sau lọc), spanning tất cả trang phân trang
  // — không chỉ trang hiện tại. (chỉ set đủ QC mới chọn được.)
  // Mọi set đang hiển thị đều chọn được: đủ QC → release thật · chưa đủ → lưu Kế hoạch tạm cho cả set.
  const selectableSets = viewSets;
  const looseAll = viewRows.length === 0 || viewRows.every((r) => selected[r.dot_vai_id]);
  const setsAll = selectableSets.length === 0 || selectableSets.every((s) => selectedSets.has(s.id));
  const allChecked = (viewRows.length > 0 || selectableSets.length > 0) && looseAll && setsAll;
  const someChecked = viewRows.some((r) => selected[r.dot_vai_id]) || selectableSets.some((s) => selectedSets.has(s.id));
  const toggleAll = () => {
    if (allChecked) {
      setSelected((s) => { const n = { ...s }; viewRows.forEach((r) => delete n[r.dot_vai_id]); return n; });
      setSelectedSets((prev) => { const n = new Set(prev); selectableSets.forEach((s) => n.delete(s.id)); return n; });
    } else {
      setSelected((s) => { const n = { ...s }; viewRows.forEach((r) => { n[r.dot_vai_id] = r; }); return n; });
      setSelectedSets((prev) => { const n = new Set(prev); selectableSets.forEach((s) => n.add(s.id)); return n; });
    }
  };
  const toggleSet = (id) => setSelectedSets((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // `set` != null ⇒ đợt vải thuộc gom set: panel chỉ xem, release phải làm cho CẢ SET.
  const openDetail = (row, set = null) => {
    setDetail(set ? {
      ...row, _setMa: set.ma_set, _setSanSang: set.san_sang, _setChuaReady: set.so_chua_ready,
      _setSoDot: set.so_dot_vai,
      // Có ít nhất 1 đợt trong set ĐÃ Ready ⇒ trả về Kỹ thuật có nghĩa (backend trả CẢ SET),
      // kể cả khi đúng dòng đang xem lại chưa Ready.
      _setDaReady: (set.so_dot_vai || 0) - (set.so_chua_ready || 0) > 0,
    } : row);
    // Mặc định release phần CÒN LẠI (SL vải về − đã release); release theo số lượng, giữ phần còn.
    setForm({ chuyenId: chuyen[0]?.id || '', soLuongRelease: String(row.con_release ?? row.so_luong_vai_ve ?? ''), ngayKeHoach: dateOffsetStr(1) });
  };

  // Release 1 phần in lẻ (từ side panel chi tiết)
  const submitRelease = async (dotVaiIds) => {
    setSaving(true);
    try {
      const res = await createRelease1({
        dotVaiIds, chuyenId: form.chuyenId,
        soLuongRelease: form.soLuongRelease ? Number(form.soLuongRelease) : null,
        ngayKeHoach: form.ngayKeHoach || null,
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
      const res = await release1TraVeKyThuat({ dotVaiId: detail.dot_vai_id, lyDo });
      const n = res?.data?.so_phan_in || 1;
      const maSet = res?.data?.ma_set;
      show(maSet
        ? `Đã trả cả set ${maSet} về Kỹ thuật — ${n} phần in quay lại READY`
        : 'Đã trả về Kỹ thuật — phần in quay lại READY');
      setTraVeOpen(false); setTraVeReason('');
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Trả về Kỹ thuật thất bại', 'error');
    } finally { setSaving(false); }
  };

  const openReleaseAll = () => {
    setRelForm({ chuyenId: chuyen[0]?.id || '', ngayKeHoach: dateOffsetStr(1) });
    setReleaseOpen(true);
  };

  // Release gộp: set → 1 lệnh chung mỗi set; đợt vải lẻ → mỗi đợt 1 lệnh.
  const doReleaseAll = async () => {
    setSaving(true);
    try {
      let okSets = 0; let tamSets = 0; const errs = [];
      for (const s of selectedSetList) {
        try {
          // Set đủ QC → release thật (1 lệnh chung). Set CHƯA đủ Ready → lưu KẾ HOẠCH TẠM cho cả set
          // (không tạo lệnh, không tách lẻ) — khi cả set Ready xong mới release chung ở màn Kế hoạch tạm.
          if (s.san_sang) {
            await releaseSet(s.id, { chuyenId: relForm.chuyenId, ngayKeHoach: relForm.ngayKeHoach || null });
            okSets += 1;
          } else {
            await keHoachTamSet(s.id, { chuyenId: relForm.chuyenId, ngayKeHoach: relForm.ngayKeHoach || null });
            tamSets += 1;
          }
        } catch (e) { errs.push(`${s.ma_set}: ${e.message}`); }
      }
      let looseMsg = '';
      if (looseList.length) {
        const res = await createRelease1({
          dotVaiIds: looseList.map((r) => r.dot_vai_id),
          chuyenId: relForm.chuyenId, soLuongRelease: null, ngayKeHoach: relForm.ngayKeHoach || null,
        });
        const tam = res?.data?.ke_hoach_tam_count || 0;
        looseMsg = ` · ${res?.data?.created_count || 0} lệnh lẻ${tam > 0 ? ` · ${tam} → Kế hoạch tạm` : ''}`;
      }
      const setMsg = [okSets ? `${okSets} set` : '', tamSets ? `${tamSets} set chưa Ready → Kế hoạch tạm` : '']
        .filter(Boolean).join(' · ') || '0 set';
      show(errs.length
        ? `Release set lỗi: ${errs.join('; ')}`
        : `Đã xử lý ${setMsg}${looseMsg}`, errs.length ? 'error' : 'success');
      setSelected({}); setSelectedSets(new Set()); setReleaseOpen(false);
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
        <Button variant="secondary" icon="download" onClick={doExcel}
          disabled={!viewRows.length && !viewSets.length}>Excel</Button>
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{activeCount ? `${viewRows.length}/` : ''}{meta.total} đợt vải · {sets.length} set</Badge>
      </Toolbar>

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
              ) : combined.length === 0 ? (
                <tr><td colSpan={colCount} className="px-4 py-12 text-center text-ink-soft">Không có đợt vải nào sẵn sàng Release 1</td></tr>
              ) : (
                pageItems.map((item, idx) => {
                  const stt = sttBase + idx + 1;
                  // SET — gộp nhóm như 1 khối, 1 checkbox hợp nhất (mỗi set = 1 mục phân trang)
                  if (item.kind === 'set') {
                    const s = item.s;
                    const on = selectedSets.has(s.id);
                    return s.members.map((m, i) => {
                      const first = i === 0;
                      const last = i === s.members.length - 1;
                      return (
                        // Bấm vào HÀNG (không phải ô chọn) → mở SidePanel xem chi tiết đợt vải, như hàng lẻ.
                        // Đợt thuộc set thì panel CHỈ XEM (không có nút Release lẻ — set phải release chung).
                        <tr key={m.dot_vai_id} onClick={() => openDetail(m, s)}
                          className={`cursor-pointer bg-primary-wash/30 ${last ? 'border-b border-line' : ''} ${on ? 'bg-primary-wash/70' : ''}`}>
                          {first && (
                            // Ô CHỌN của set: chặn nổi bọt → bấm vào cột này (checkbox, mã set, badge)
                            // chỉ tick/bỏ tick, KHÔNG mở SidePanel.
                            <td rowSpan={s.members.length} onClick={(e) => e.stopPropagation()}
                              className={`w-28 border-l-[3px] px-2 py-3 align-middle text-center transition
                                ${on ? 'border-primary bg-primary-wash' : 'border-primary/50'}`}>
                              {/* Set CHƯA đủ Ready vẫn CHỌN được — xác nhận sẽ lưu Kế hoạch tạm cho cả set
                                  (trước đây bị khóa nên không lập kế hoạch sớm cho set được). */}
                              <label className="flex cursor-pointer flex-col items-center gap-1.5">
                                <input type="checkbox" checked={on} onChange={() => toggleSet(s.id)}
                                  className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
                                <span className="flex items-center gap-1 text-xs font-bold text-primary">
                                  <Icon name="package" size={13} /> {s.ma_set}
                                </span>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                  {s.so_dot_vai} đợt · in chung
                                </span>
                                {s.khac_mau && <span className="text-[10px] font-medium text-amber-600">⚠ khác màu</span>}
                                {!s.san_sang && (
                                  <span className="text-[10px] font-medium text-amber-600">{s.so_chua_ready} chưa QC → KH tạm</span>
                                )}
                              </label>
                            </td>
                          )}
                          {first && (
                            <td rowSpan={s.members.length} className={`${TD} text-right tabular-nums text-ink-soft`}>{stt}</td>
                          )}
                          <DataCells r={m} />
                        </tr>
                      );
                    });
                  }
                  // Đợt vải lẻ
                  const r = item.r;
                  return (
                    <tr key={r.dot_vai_id} onClick={() => openDetail(r)}
                      className={`cursor-pointer border-b border-line/70 transition hover:bg-surface-muted/40 ${slaRowClass(statusDot(r.dot_vai_id))}`}>
                      {/* Ô CHỌN: chặn ở cấp <td> (không chỉ trên <input>) — bấm vào phần đệm quanh
                          checkbox trước đây vẫn mở SidePanel. */}
                      <td className={TD} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={!!selected[r.dot_vai_id]}
                          onChange={() => toggle(r)}
                          className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
                      </td>
                      <td className={`${TD} text-right tabular-nums text-ink-soft`}>{stt}</td>
                      <DataCells r={r} />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={safePage} totalPages={totalCPages} total={combined.length} onPage={setCpage} />

      {/* Thanh "Đã chọn" GHIM CỐ ĐỊNH (fixed) ở đáy màn hình — luôn thấy dù bảng dài hay đang cuộn.
          · desktop: cách đáy 5px · dưới lg: nâng lên trên BottomNav (nav fixed z-40, lg:hidden)
          · z-30 để KHÔNG đè Modal/SidePanel (Headless UI z-50) và không che BottomNav
          · căn giữa + rộng theo nội dung ⇒ không phủ lên Sidebar bên trái */}
      {totalSel > 0 && (
        <>
          <div className="h-20 lg:h-16" aria-hidden="true" />{/* chừa chỗ để thanh không che phân trang */}
          <div className="fixed bottom-[4.75rem] left-1/2 z-30 flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card border border-line bg-surface px-5 py-3 shadow-card-hover lg:bottom-[5px]">
            <span className="text-sm text-ink">
              {selectedSetList.length > 0 && <>Đã chọn <b>{selectedSetList.length}</b> set</>}
              {selectedSetList.length > 0 && looseList.length > 0 && ' · '}
              {looseList.length > 0 && <>Đã chọn <b>{looseList.length}</b> đợt vải lẻ (SL {fmtNum(tongVai)})</>}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setSelected({}); setSelectedSets(new Set()); }}>Bỏ chọn</Button>
              <Button onClick={openReleaseAll}>Release ({totalSel})</Button>
            </div>
          </div>
        </>
      )}

      {/* Modal release gộp (set + lẻ) */}
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
          {selectedSetList.length > 0 && <div>{selectedSetList.length} set → mỗi set 1 lệnh chung</div>}
          {looseList.length > 0 && <div>{looseList.length} đợt vải lẻ → mỗi đợt 1 lệnh</div>}
        </div>
        <Field label="Chuyền in" required>
          <ChuyenPicker chuyen={chuyen} value={relForm.chuyenId} onChange={(id) => setRelForm({ ...relForm, chuyenId: id })} />
        </Field>
        <Field label="Ngày kế hoạch">
          <Input type="date" value={relForm.ngayKeHoach} onChange={(e) => setRelForm({ ...relForm, ngayKeHoach: e.target.value })} />
        </Field>
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
                Đợt thuộc gom set: chỉ cần set có phần in đã Ready (trả về là trả CẢ SET). */}
            {(detail?.qc_done || detail?._setDaReady) && (
              <Button variant="danger" icon="chevron-left"
                onClick={() => { setTraVeReason(''); setTraVeOpen(true); }}>Trả về Kỹ thuật</Button>
            )}
            {!detail?._setMa && (
              <Button onClick={() => submitRelease([detail.dot_vai_id])} loading={saving} disabled={!form.chuyenId}>Xác nhận Release 1</Button>
            )}
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            {detail._setMa && (
              <div className="rounded-control border border-primary/30 bg-primary-wash px-3 py-2 text-sm text-primary">
                Đợt vải thuộc <b>{detail._setMa}</b> — gom set phải <b>release chung cả set</b>, không release lẻ từng đợt.
                {detail._setSanSang
                  ? ' Chọn ô set ở bảng rồi bấm Release.'
                  : ` Còn ${detail._setChuaReady || 0} đợt trong set chưa Ready — chọn set để lưu Kế hoạch tạm.`}
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
            {/* Đợt thuộc gom set: ẩn form release lẻ (release chung ở cấp set). */}
            <div className={`space-y-3 border-t border-line pt-4 ${detail._setMa ? 'hidden' : ''}`}>
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
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Trả về Kỹ thuật — lý do bắt buộc (hiện lại ở màn READY / QC READY) */}
      <Modal
        open={traVeOpen}
        onClose={() => setTraVeOpen(false)}
        title={`Trả về Kỹ thuật — ${detail?._setMa || detail?.ma_phan || ''}`}
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
          {detail?._setMa ? (
            <>
              Đợt vải thuộc <b>{detail._setMa}</b> — gom set in chung nên sẽ trả về <b>CẢ SET</b>:
              toàn bộ {detail._setSoDot || ''} đợt vải trong set quay lại <b>READY</b> (hủy xác nhận
              Khuôn/Film/Mực + QC của mọi phần in trong set), kỹ thuật phải làm lại. Lý do sẽ hiện ở
              màn Chuẩn bị kỹ thuật.
            </>
          ) : (
            <>
              Phần in sẽ quay lại <b>READY</b>: hủy xác nhận Khuôn/Film/Mực + QC, kỹ thuật phải làm lại.
              Lý do sẽ hiện ở màn Chuẩn bị kỹ thuật.
            </>
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
