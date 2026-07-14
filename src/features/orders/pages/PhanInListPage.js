import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import DateRangePicker from '../../../components/common/DateRangePicker';
import KcsBreakdown from '../../../components/common/KcsBreakdown';
import useToast from '../../../hooks/useToast';
import { listVaiVe, getPhanIn, setChoKho } from '../../../services/orderService';
import exportPhanInVaiVeExcel from '../utils/exportPhanInVaiVeExcel';
import { fmtNum, fmtDate, fmtDateTime, fmtCurrency } from '../../../utils/format';

const LIMIT = 20;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const TH = 'sticky top-0 z-20 bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft';
const TD = 'px-4 py-3 align-top';

// Giai đoạn dòng chảy (khớp stageCondition ở backend). 'ALL' = tất cả (backend coi mã lạ = không lọc giai đoạn).
const STAGES = [
  { code: 'ALL', label: 'Tất cả' },
  { code: 'READY', label: 'READY' },
  { code: 'RELEASE_1', label: 'Release 1' },
  { code: 'TEST_RUN', label: 'Test Run' },
  { code: 'RELEASE_2', label: 'Release 2' },
  { code: 'CHO_SAN_XUAT', label: 'Chờ sản xuất' },
  { code: 'SAN_XUAT', label: 'Đang sản xuất' },
  { code: 'CHO_KHO', label: 'Chờ khô' },
  { code: 'KCS', label: 'KCS' },
  { code: 'SUA', label: 'Sửa' },
  { code: 'OQC', label: 'OQC' },
  { code: 'GIAO', label: 'Đang giao' },
  { code: 'DA_GIAO', label: 'Đã giao' },
];

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'codePhan', label: 'Code phần' },
  { key: 'mauVai', label: 'Màu vải' },
  { key: 'kichVai', label: 'Kích vải' },
  { key: 'kichPhim', label: 'Kích phim' },
];
const FIELD_LABEL = {
  ...Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, f.label])),
  ngayVaiTu: 'Ngày vải từ', ngayVaiDen: 'Ngày vải đến',
};

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

// SL pcs hiển thị tại từng node hành trình (Release 1 / Sản xuất / OQC). null = trạm không có số.
function StagePcsNote({ maTram, sp }) {
  if (!sp) return null;
  if (maTram === 'RELEASE_1' && sp.sl_release > 0)
    return <div className="mt-1 pl-8 text-xs font-medium text-primary">SL release: {fmtNum(sp.sl_release)}</div>;
  if (maTram === 'SAN_XUAT' && sp.sl_in_xong > 0)
    return <div className="mt-1 pl-8 text-xs font-medium text-primary">SL in xong: {fmtNum(sp.sl_in_xong)} pcs</div>;
  if (maTram === 'OQC' && (sp.oqc_dat > 0 || sp.sua_dat > 0))
    return (
      <div className="mt-1 pl-8 text-xs">
        <span className="font-medium text-emerald-600">OQC đạt: {fmtNum(sp.oqc_dat)}</span>
        {(sp.kcs_dat > 0 || sp.sua_dat > 0) && (
          <span className="text-ink-soft"> · nguồn vào: đạt thẳng {fmtNum(sp.kcs_dat)}
            {sp.sua_dat > 0 && <> · <span className="text-amber-600">qua sửa {fmtNum(sp.sua_dat)}</span></>}
          </span>
        )}
      </div>
    );
  return null;
}

// Từ CHỜ KHÔ trở đi: quản lý theo tem → hiện mỗi tem 1 hàng + cột chất lượng.
const TEM_ROW_STAGES = ['CHO_KHO', 'KCS', 'SUA', 'OQC', 'GIAO', 'DA_GIAO'];

// Nhãn cột "SL" theo GIAI ĐOẠN (chip). OQC/Giao tách 2 dòng theo nguồn (tem 15-/17-).
const STAGE_QTY_LABEL = {
  CHO_KHO: 'SL in', KCS: 'SL in', SUA: 'Số lượng sửa',
  OQC: 'SL đạt (KCS/Sửa)', GIAO: 'SL giao', DA_GIAO: 'SL giao',
};
// Trạng thái tem tương ứng từng chip — CHỈ hiện tem đang thực sự ở giai đoạn đó (khớp bộ lọc backend stageCond).
const STAGE_TEM_STATUS = {
  CHO_KHO: ['IN', 'DANG_PHOI'], KCS: ['DA_KHO'], SUA: ['CHO_SUA'],
  OQC: ['CHO_OQC'], GIAO: ['OQC_DAT'], DA_GIAO: ['DA_GIAO'],
};
const N0 = (v) => Number(v) || 0;

// Dựng danh sách dòng hiển thị của 1 tem theo giai đoạn: {key, prefix, ma, qty, tm}.
//  - KCS/Chờ khô: SL in (so_luong), không tiền tố.
//  - Sửa: tem 16-, SL = số lượng quyết định sửa.
//  - OQC: tách nguồn 15- (đạt từ KCS) / 17- (đạt qua sửa), SL = phần chờ OQC của nguồn.
//  - Giao/Đã giao: 15-/17- theo nguồn OQC đã qua, SL giao.
function temDisplayRows(tm, stage) {
  if (!tm) return [{ key: 'none', prefix: '', ma: null, qty: null, tm: null }];
  const b = { tm };
  if (stage === 'SUA') return [{ ...b, key: tm.tem_id, prefix: '16-', ma: `16-${tm.ma_tem}`, qty: N0(tm.sl_sua) }];
  if (stage === 'OQC' || stage === 'GIAO' || stage === 'DA_GIAO') {
    const kcsQty = stage === 'OQC' ? N0(tm.con_oqc_kcs) : N0(tm.giao_kcs);
    const suaQty = stage === 'OQC' ? N0(tm.con_oqc_sua) : N0(tm.giao_sua);
    const out = [];
    if (kcsQty > 0) out.push({ ...b, key: `${tm.tem_id}-15`, prefix: '15-', ma: `15-${tm.ma_tem}`, qty: kcsQty });
    if (suaQty > 0) out.push({ ...b, key: `${tm.tem_id}-17`, prefix: '17-', ma: `17-${tm.ma_tem}`, qty: suaQty });
    if (out.length) return out;
    return [{ ...b, key: tm.tem_id, prefix: '', ma: tm.ma_tem, qty: 0 }];
  }
  return [{ ...b, key: tm.tem_id, prefix: '', ma: tm.ma_tem, qty: N0(tm.so_luong) }];
}

// Số lượng theo tem, HỢP NHẤT theo phần in (dùng ở thẻ mobile).
function TemSummary({ g }) {
  if (!g.pcs_in) return <span className="text-xs text-ink-soft">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      <Badge tone="default">{fmtNum(g.pcs_in)} pcs · {fmtNum(g.so_tem)} tem</Badge>
      {g.sl_dat > 0 && <Badge tone="success">Đạt {fmtNum(g.sl_dat)}</Badge>}
      {g.sl_sua > 0 && <Badge tone="warning">Sửa {fmtNum(g.sl_sua)}</Badge>}
      {g.sl_sua_dat > 0 && <Badge tone="info">Sửa đạt {fmtNum(g.sl_sua_dat)}</Badge>}
    </div>
  );
}

const TEM_STATUS = {
  IN: { label: 'Đã in', tone: 'default' },
  DANG_PHOI: { label: 'Đang phơi', tone: 'info' },
  DA_KHO: { label: 'Đã khô', tone: 'info' },
  CHO_SUA: { label: 'Chờ sửa', tone: 'warning' },
  CHO_OQC: { label: 'Chờ OQC', tone: 'info' },
  OQC_DAT: { label: 'OQC đạt', tone: 'success' },
  DA_GIAO: { label: 'Đã giao', tone: 'success' },
  LOAI: { label: 'Loại/hủy', tone: 'danger' },
};

function TemQuality({ tm }) {
  const parts = [];
  if (tm.kcs_dat != null || tm.kcs_loi != null) {
    parts.push(`KCS: đạt ${fmtNum(tm.kcs_dat || 0)}${tm.kcs_loi ? ` · lỗi ${fmtNum(tm.kcs_loi)}` : ''}`);
  }
  if (tm.sua_dat != null) parts.push(`Sửa đạt ${fmtNum(tm.sua_dat)}`);
  if (tm.oqc_ket_qua) parts.push(`OQC: ${tm.oqc_ket_qua === 'DAT' ? 'đạt' : 'không đạt'}`);
  return <span className="text-xs text-ink-soft">{parts.length ? parts.join(' · ') : '—'}</span>;
}

// Giá trị đợt vải gộp (khi hiển thị theo tem, cột đợt vải hợp nhất theo phần in).
function aggDotVai(dotVai = []) {
  const total = dotVai.reduce((s, d) => s + (d.so_luong_vai_ve || 0), 0);
  const ngay = dotVai.map((d) => d.ngay_vai_ve).filter(Boolean).sort();
  const han = dotVai.map((d) => d.han_giao_hang).filter(Boolean).sort();
  return { total, ngay: ngay[0] || null, han: han[0] || null };
}

export default function PhanInListPage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('READY');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: '', dir: '' }); // sắp xếp cột (màn "Tất cả")
  const [menuKey, setMenuKey] = useState(null); // header đang mở menu sắp xếp
  const [exporting, setExporting] = useState(false);

  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [choKhoMin, setChoKhoMin] = useState('');
  const [savingChoKho, setSavingChoKho] = useState(false);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const activeFilters = useMemo(() => Object.entries(filters).filter(([, v]) => v), [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVaiVe({ search, stage, ...filters, page, limit: LIMIT, sortKey: sort.key, sortDir: sort.dir });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, stage, filtersKey, page, sort.key, sort.dir, show]);

  // Chọn kiểu sắp xếp cho 1 cột: '' = mặc định, 'asc' = tăng, 'desc' = giảm.
  const applySort = (key, dir) => { setSort(dir ? { key, dir } : { key: '', dir: '' }); setPage(1); setMenuKey(null); };

  // Xuất Excel: tải TOÀN BỘ danh sách đang lọc (mọi trang) + đúng thứ tự sắp xếp, dựng workbook giống bảng.
  const doExport = async () => {
    setExporting(true);
    try {
      const res = await listVaiVe({ search, stage, ...filters, page: 1, limit: 100000, sortKey: sort.key, sortDir: sort.dir });
      const items = res.data.items || [];
      if (!items.length) { show('Không có dữ liệu để xuất', 'error'); return; }
      await exportPhanInVaiVeExcel(items);
      show(`Đã xuất ${items.length} phần in ra Excel`);
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Header có icon sắp xếp + menu 3 lựa chọn (double-click để mở). key null = cột không sắp xếp được.
  const sortTh = (label, key, cls = '') => {
    if (!key) return <th className={`${TH} ${cls}`}>{label}</th>;
    const curDir = sort.key === key ? sort.dir : '';
    const icon = curDir === 'asc' ? 'chevron-up' : curDir === 'desc' ? 'chevron-down' : 'chevrons-up-down';
    return (
      <th className={`${TH} ${cls} relative select-none`} onDoubleClick={() => setMenuKey(menuKey === key ? null : key)}
        title="Double-click để sắp xếp">
        <div className="flex cursor-pointer items-center gap-1" onClick={() => setMenuKey(menuKey === key ? null : key)}>
          <span>{label}</span>
          <Icon name={icon} size={13} className={curDir ? 'text-primary' : 'text-ink-soft/50'} />
        </div>
        {menuKey === key && (
          <div className="absolute left-0 top-full z-30 mt-1 w-36 rounded-control border border-line bg-surface py-1 text-xs font-normal shadow-lg">
            {[['', 'Mặc định'], ['asc', 'Tăng dần'], ['desc', 'Giảm dần']].map(([d, lb]) => (
              <button key={d || 'def'} onClick={() => applySort(key, d)}
                className={`block w-full px-3 py-1.5 text-left hover:bg-surface-muted ${curDir === d ? 'font-semibold text-primary' : 'text-ink'}`}>
                {lb}
              </button>
            ))}
          </div>
        )}
      </th>
    );
  };

  const setField = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const clearFilters = () => { setFilters({}); setPage(1); };
  // Vào "Tất cả" → mặc định lọc ngày = HÔM NAY; rời "Tất cả" → bỏ lọc ngày.
  const pickStage = (code) => {
    setStage(code);
    setPage(1);
    if (code === 'ALL') { const t = todayISO(); setFilters((f) => ({ ...f, ngayVaiTu: t, ngayVaiDen: t })); }
    else setFilters(({ ngayVaiTu, ngayVaiDen, ...rest }) => rest);
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = async (phanInId) => {
    setLoadingDetail(true);
    setDetail({ id: phanInId });
    try {
      const res = await getPhanIn(phanInId);
      setDetail(res.data);
      setChoKhoMin(res.data.thoi_gian_cho_kho_phut ?? '');
    } catch (e) {
      show(e.message || 'Lỗi tải chi tiết', 'error');
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const saveChoKho = async () => {
    setSavingChoKho(true);
    try {
      const r = await setChoKho(detail.id, choKhoMin === '' ? '' : Number(choKhoMin));
      setDetail(r.data);
      show('Đã cập nhật thời gian chờ khô');
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSavingChoKho(false);
    }
  };

  const sttStart = (meta.page - 1) * LIMIT;
  const showTemRows = TEM_ROW_STAGES.includes(stage); // tem/hàng + chất lượng
  const showPcsCol = stage === 'SAN_XUAT';             // chỉ thêm cột "SL đã in"
  const showSxCols = !stage || stage === 'ALL';        // "Tất cả": thêm khối cột theo ĐỢT SẢN XUẤT
  const showTemQuality = showTemRows && !['KCS', 'CHO_KHO'].includes(stage); // KCS/Chờ khô chưa có chất lượng → ẩn cột
  const COLS = showTemRows ? (10 + (showTemQuality ? 1 : 0)) : (11 + (showPcsCol ? 1 : 0) + (showSxCols ? 8 : 0));

  return (
    <div>
      <Toolbar title="Danh sách phần in vải về" subtitle="Từ khách hàng → đơn hàng → mã hàng → phần in → đợt vải về"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm nhanh: code phần, mã hàng, màu/kích vải, kích phim, mã đợt vải...">
        <Button variant={showFilters || activeFilters.length ? 'secondary' : 'ghost'} icon="filter"
          onClick={() => setShowFilters((s) => !s)}>
          Bộ lọc{activeFilters.length ? ` (${activeFilters.length})` : ''}
        </Button>
        {stage === 'ALL' && (
          <Button variant="ghost" icon="file-spreadsheet" loading={exporting} onClick={doExport}>
            Xuất Excel
          </Button>
        )}
        <Badge tone="default">Tổng {meta.total}</Badge>
      </Toolbar>

      {/* Lọc theo giai đoạn dòng chảy */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {STAGES.map((s) => (
          <button key={s.code || 'all'} onClick={() => pickStage(s.code)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              stage === s.code
                ? 'border-primary bg-primary text-white'
                : 'border-line text-ink-soft hover:bg-surface-muted'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Lọc theo ngày vải về — CHỈ hiện ở chế độ "Tất cả"; 1 ô chọn cả khoảng bắt đầu → kết thúc */}
      {stage === 'ALL' && (
        <div className="mb-3 flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Ngày vải về</label>
            <DateRangePicker value={{ from: filters.ngayVaiTu, to: filters.ngayVaiDen }}
              onChange={(r) => { setFilters((f) => ({ ...f, ngayVaiTu: r.from || '', ngayVaiDen: r.to || '' })); setPage(1); }} />
          </div>
        </div>
      )}

      {/* Bộ lọc nhiều trường cùng lúc */}
      {showFilters && (
        <div className="mb-3 card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={clearFilters}
              disabled={!activeFilters.length}>Xóa lọc</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {FILTER_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</label>
                <input value={filters[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={`Lọc ${f.label.toLowerCase()}...`}
                  className="h-10 w-full rounded-input border border-line bg-surface px-3 text-sm focus:border-primary focus:outline-none" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Lọc theo <b>ngày vải về</b> nằm ở chế độ chip <b>“Tất cả”</b>.</p>
        </div>
      )}

      {/* Chip các bộ lọc đang áp dụng */}
      {activeFilters.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {activeFilters.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-3 py-1 text-xs font-medium text-primary">
              {FIELD_LABEL[k]}: {v}
              <button onClick={() => setField(k, '')} className="ml-0.5 hover:text-danger" aria-label="Xóa">
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          <button onClick={clearFilters} className="text-xs font-medium text-ink-soft underline hover:text-danger">Xóa tất cả</button>
        </div>
      )}

      {/* Bảng (md trở lên) */}
      {menuKey && <div className="fixed inset-0 z-20" onClick={() => setMenuKey(null)} />}
      <div className="hidden card overflow-hidden md:block">
        <div className="overflow-auto max-h-[calc(100vh-13rem)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-left">
                <th className={`${TH} w-12 text-right`}>STT</th>
                {showTemRows ? (
                  <>
                    <th className={TH}>Khách hàng · Đơn hàng</th>
                    <th className={TH}>Mã hàng</th>
                    <th className={TH}>Màu · Kích (vải/phim)</th>
                    <th className={`${TH} text-right border-r border-line/60`}>SL vải về / đơn</th>
                    <th className={TH}>Ngày vải về</th>
                    <th className={TH}>Hạn giao</th>
                    <th className={`${TH} border-l border-line/60`}>Mã tem</th>
                    <th className={`${TH} text-right`}>{STAGE_QTY_LABEL[stage] || 'SL'}</th>
                    <th className={TH}>Trạng thái</th>
                    {showTemQuality && <th className={TH}>Chất lượng</th>}
                  </>
                ) : (
                  <>
                    {sortTh('Khách hàng', 'khach')}
                    {sortTh('Đơn hàng', 'don')}
                    {sortTh('Mã hàng', 'maHang')}
                    {sortTh('Màu vải', 'mauVai')}
                    {sortTh('Kích vải', 'kichVai')}
                    {sortTh('Kích phim', 'kichPhim')}
                    {sortTh('SL đơn hàng', 'slDon', 'text-right border-r border-line/60')}
                    {sortTh('SL vải về', 'slVai', 'text-right')}
                    {sortTh('Ngày vải về', 'ngayVai')}
                    {sortTh('Hạn giao', 'hanGiao')}
                    {showPcsCol && <th className={`${TH} text-right border-l border-line/60`}>SL đã in</th>}
                    {showSxCols && (
                      <>
                        <th className={`${TH} border-l border-line/60`}>Đợt SX</th>
                        {sortTh('SL in', 'slIn', 'text-right')}
                        {sortTh('Kiểm đạt', 'kiemDat', 'text-right')}
                        {sortTh('Sửa', 'sua', 'text-right')}
                        {sortTh('Sửa đạt', 'suaDat', 'text-right')}
                        <th className={TH}>OQC xác nhận</th>
                        <th className={TH}>TT OQC</th>
                        <th className={`${TH} text-right`}>SL giao</th>
                      </>
                    )}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLS} className="px-4 py-12 text-center text-ink-soft">
                  <Icon name="loader" size={22} className="mx-auto animate-spin" />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLS} className="px-4 py-12 text-center text-ink-soft">Chưa có phần in / đợt vải về</td></tr>
              ) : (
                rows.map((g, gi) => {
                  const stt = sttStart + gi + 1;
                  // Cột phần in (STT → SL đơn hàng) hợp nhất ô — dùng chung cho cả 2 chế độ.
                  const headCells = (n) => (
                    <>
                      <td rowSpan={n} className={`${TD} text-right tabular-nums text-ink-soft`}>{stt}</td>
                      <td rowSpan={n} className={`${TD} font-medium text-ink`}>{g.ten_khach_hang}</td>
                      <td rowSpan={n} className={TD}>
                        <div className="text-ink">{g.ma_don_hang}</div>
                        <div className="text-xs text-ink-soft">{g.so_po}</div>
                      </td>
                      <td rowSpan={n} className={TD}>
                        <div className="text-ink">{g.ma_hang}</div>
                        {g.so_dot > 1 && <div className="mt-1"><Badge tone="warning">{g.so_dot} đợt vải</Badge></div>}
                      </td>
                      <td rowSpan={n} className={TD}>{g.mau_vai || '—'}</td>
                      <td rowSpan={n} className={TD}>{g.kich_vai || '—'}</td>
                      <td rowSpan={n} className={TD}>{g.kich_phim || '—'}</td>
                      <td rowSpan={n} className={`${TD} text-right tabular-nums border-r border-line/60`}>{fmtNum(g.so_luong_don_hang)}</td>
                    </>
                  );

                  // Chế độ THEO TEM (từ chờ khô): cột trái GỘP + hợp nhất ô; mỗi tem tách 1-2 dòng theo nguồn.
                  if (showTemRows) {
                    // CHỈ hiện tem đang thực sự ở giai đoạn của chip (vd KCS chỉ tem 'DA_KHO', bỏ tem đã qua OQC).
                    const stTems = (g.tems || []).filter((tm) => !STAGE_TEM_STATUS[stage] || STAGE_TEM_STATUS[stage].includes(tm.trang_thai));
                    const srcTems = stTems.length ? stTems : [null];
                    const drows = srcTems.flatMap((tm) => temDisplayRows(tm, stage));
                    const n = drows.length || 1;
                    const agg = aggDotVai(g.dot_vai);
                    return drows.map((dr, ti) => {
                      const tm = dr.tm;
                      return (
                        <tr key={`${g.phan_in_id}-${dr.key}`}
                          onClick={() => openDetail(g.phan_in_id)}
                          className={`cursor-pointer transition hover:bg-surface-muted/40 ${ti === n - 1 ? 'border-b border-line/70' : ''}`}>
                          {ti === 0 && (
                            <>
                              <td rowSpan={n} className={`${TD} text-right tabular-nums text-ink-soft`}>{stt}</td>
                              <td rowSpan={n} className={TD}>
                                <div className="font-medium text-ink">{g.ten_khach_hang}</div>
                                <div className="text-xs text-ink-soft">{g.ma_don_hang}{g.so_po ? ` · ${g.so_po}` : ''}</div>
                              </td>
                              <td rowSpan={n} className={TD}>
                                <div className="text-ink">{g.ma_hang}</div>
                                {g.so_dot > 1 && <div className="mt-1"><Badge tone="warning">{g.so_dot} đợt vải</Badge></div>}
                              </td>
                              <td rowSpan={n} className={TD}>
                                <div className="text-ink">{g.mau_vai || '—'}</div>
                                <div className="text-xs text-ink-soft">{[g.kich_vai, g.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
                              </td>
                              <td rowSpan={n} className={`${TD} text-right tabular-nums border-r border-line/60`}>
                                <div className="font-medium text-ink">{fmtNum(agg.total)}</div>
                                <div className="text-[10px] text-ink-soft">đơn {fmtNum(g.so_luong_don_hang)}</div>
                              </td>
                              <td rowSpan={n} className={TD}>{fmtDate(agg.ngay)}</td>
                              <td rowSpan={n} className={TD}>{fmtDate(agg.han)}</td>
                            </>
                          )}
                          <td className={`${TD} border-l border-line/60 font-medium text-ink`}>
                            {dr.ma
                              ? <span className={dr.prefix ? (dr.prefix === '17-' ? 'text-amber-600' : 'text-primary') : ''}>{dr.ma}</span>
                              : <span className="text-xs italic text-ink-soft">Chưa in tem</span>}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>{dr.qty != null ? fmtNum(dr.qty) : '—'}</td>
                          <td className={TD}>{tm ? <Badge tone={(TEM_STATUS[tm.trang_thai] || {}).tone || 'default'}>{(TEM_STATUS[tm.trang_thai] || {}).label || tm.trang_thai}</Badge> : '—'}</td>
                          {showTemQuality && <td className={TD}>{tm ? <TemQuality tm={tm} /> : '—'}</td>}
                        </tr>
                      );
                    });
                  }

                  // Chế độ "Tất cả": HÀNG = max(số đợt vải, số đợt SX). Khối trái tách theo TỪNG ĐỢT VẢI
                  // (SL/ngày/hạn riêng), khối phải tách theo TỪNG ĐỢT SX — hai danh sách độc lập cạnh nhau.
                  if (showSxCols) {
                    const dvList = g.dot_vai && g.dot_vai.length ? g.dot_vai : [];
                    const sxList = g.dot_san_xuat && g.dot_san_xuat.length ? g.dot_san_xuat : [];
                    const R = Math.max(dvList.length, sxList.length, 1);
                    const lines = Array.from({ length: R }, (_, i) => ({ d: dvList[i] || null, s: sxList[i] || null }));
                    return lines.map((ln, si) => {
                      const s = ln.s; const d = ln.d;
                      return (
                        <tr key={`${g.phan_in_id}-r${si}`}
                          onClick={() => openDetail(g.phan_in_id)}
                          className={`cursor-pointer transition hover:bg-surface-muted/40 ${si === R - 1 ? 'border-b border-line/70' : ''}`}>
                          {si === 0 && headCells(R)}
                          {/* Khối đợt vải — mỗi đợt vải một hàng */}
                          <td className={`${TD} text-right tabular-nums`}>
                            {d ? fmtNum(d.so_luong_vai_ve)
                              : (si === 0 && dvList.length === 0 ? <span className="text-xs italic text-ink-soft">Chưa có vải về</span> : '')}
                          </td>
                          <td className={TD}>{d ? fmtDate(d.ngay_vai_ve) : ''}</td>
                          <td className={TD}>{d ? fmtDate(d.han_giao_hang) : ''}</td>
                          {/* Khối đợt sản xuất — mỗi đợt SX một hàng */}
                          <td className={`${TD} border-l border-line/60 font-medium text-ink`}>
                            {s ? <span>{s.ma_lenh_san_xuat}{s.giai_doan === 'EP_UI' && <Badge tone="info">Ép ủi</Badge>}</span>
                              : (si === 0 && sxList.length === 0 ? <span className="text-xs italic text-ink-soft">Chưa có đợt SX</span> : '')}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>{s ? fmtNum(s.sl_in) : '—'}</td>
                          <td className={`${TD} text-right tabular-nums`}>{s ? fmtNum(s.sl_kcs_dat) : '—'}</td>
                          <td className={`${TD} text-right tabular-nums`}>{s ? fmtNum(s.sl_sua) : '—'}</td>
                          <td className={`${TD} text-right tabular-nums`}>{s ? fmtNum(s.sl_sua_dat) : '—'}</td>
                          <td className={TD}>{s?.tg_oqc ? fmtDateTime(s.tg_oqc) : '—'}</td>
                          <td className={TD}>{s?.tt_oqc ? <Badge tone={s.tt_oqc === 'DAT' ? 'success' : 'danger'}>{s.tt_oqc === 'DAT' ? 'Đạt' : 'Không đạt'}</Badge> : '—'}</td>
                          <td className={`${TD} text-right tabular-nums`}>{s ? fmtNum(s.sl_giao) : '—'}</td>
                        </tr>
                      );
                    });
                  }

                  // Chế độ mặc định (các chip non-tem khác): mỗi đợt vải 1 hàng.
                  const dots = g.dot_vai && g.dot_vai.length ? g.dot_vai : [null];
                  const n = dots.length;
                  return dots.map((dv, di) => (
                    <tr
                      key={`${g.phan_in_id}-${dv?.dot_vai_id || 'none'}`}
                      onClick={() => openDetail(g.phan_in_id)}
                      className={`cursor-pointer transition hover:bg-surface-muted/40 ${di === n - 1 ? 'border-b border-line/70' : ''}`}
                    >
                      {di === 0 && headCells(n)}
                      <td className={`${TD} text-right tabular-nums`}>
                        {dv ? fmtNum(dv.so_luong_vai_ve) : <span className="text-xs italic text-ink-soft">Chưa có vải về</span>}
                      </td>
                      <td className={TD}>{dv ? fmtDate(dv.ngay_vai_ve) : '—'}</td>
                      <td className={TD}>{dv ? fmtDate(dv.han_giao_hang) : '—'}</td>
                      {di === 0 && showPcsCol && (
                        <td rowSpan={n} className={`${TD} text-right tabular-nums border-l border-line/60 font-medium text-ink`}>
                          {g.pcs_in ? `${fmtNum(g.pcs_in)} pcs` : '—'}
                        </td>
                      )}
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thẻ (mobile/tablet) */}
      <div className="space-y-2.5 md:hidden">
        {loading ? (
          <div className="card p-8 text-center text-ink-soft"><Icon name="loader" size={22} className="mx-auto animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="card p-8 text-center text-ink-soft">Chưa có phần in / đợt vải về</div>
        ) : (
          rows.map((g, gi) => (
            <div key={g.phan_in_id} onClick={() => openDetail(g.phan_in_id)}
              className="card cursor-pointer p-3.5 active:bg-surface-muted/60">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{g.ten_khach_hang}</div>
                  <div className="truncate text-xs text-ink-soft">{g.ma_don_hang}{g.so_po ? ` · ${g.so_po}` : ''} · {g.ma_hang}</div>
                </div>
                <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">#{sttStart + gi + 1}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {g.mau_vai && <Badge tone="default">{g.mau_vai}</Badge>}
                {g.kich_vai && <Badge tone="default">Vải {g.kich_vai}</Badge>}
                {g.kich_phim && <Badge tone="default">Phim {g.kich_phim}</Badge>}
                {g.so_dot > 1 && <Badge tone="warning">{g.so_dot} đợt vải</Badge>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-line/60 pt-2 text-xs text-ink-soft">
                <span>SL đơn: <b className="text-ink">{fmtNum(g.so_luong_don_hang)}</b></span>
                <span>SL vải về: <b className="text-ink">{fmtNum(g.dot_vai?.reduce((s, d) => s + (d.so_luong_vai_ve || 0), 0))}</b></span>
                <span>Ngày vải: <b className="text-ink">{g.dot_vai?.length ? fmtDate(g.dot_vai[0].ngay_vai_ve) : '—'}</b></span>
                <span>Hạn giao: <b className="text-ink">{g.dot_vai?.length ? fmtDate(g.dot_vai[0].han_giao_hang) : '—'}</b></span>
              </div>
              {(showTemRows || showPcsCol) && g.pcs_in > 0 && (
                <div className="mt-2 border-t border-line/60 pt-2"><TemSummary g={g} /></div>
              )}
            </div>
          ))
        )}
      </div>

      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.ma_phan ? `Phần in ${detail.ma_phan}` : 'Chi tiết phần in'}
        subtitle={detail?.ten_khach_hang}
      >
        {loadingDetail || !detail?.ma_phan ? (
          <div className="py-10 text-center text-ink-soft">Đang tải...</div>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Đơn hàng</h3>
              <Row label="Khách hàng" value={detail.ten_khach_hang} />
              <Row label="Đơn hàng" value={`${detail.ma_don_hang} · ${detail.so_po || '—'}`} />
              <Row label="Mã hàng" value={`${detail.ma_hang} — ${detail.ten_ma_hang || ''}`} />
            </section>
            <section className="border-t border-line pt-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Thông số phần in</h3>
              <Row label="Code phần" value={detail.ma_phan} />
              <Row label="Màu vải" value={detail.mau_vai || '—'} />
              <Row label="Kích vải" value={detail.kich_vai || '—'} />
              <Row label="Kích phim" value={detail.kich_phim || '—'} />
              <Row label="Tính chất in" value={detail.tinh_chat_in || '—'} />
              <Row label="Độ in / Màu in" value={`${detail.do_in || '—'} / ${detail.mau_in || '—'}`} />
              <Row label="SL đơn hàng" value={fmtNum(detail.so_luong_don_hang)} />
              <Row label="Lợi nhuận" value={detail.loi_nhuan == null ? 'Chưa có' : fmtCurrency(detail.loi_nhuan)} />
            </section>

            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Thời gian chờ khô</h3>
              <div className="flex items-center gap-2">
                <input type="number" min="0" value={choKhoMin} onChange={(e) => setChoKhoMin(e.target.value)} placeholder="60"
                  className="h-10 w-28 rounded-input border border-line bg-surface px-3 text-sm focus:border-primary focus:outline-none" />
                <span className="text-sm text-ink-soft">phút</span>
                <Button className="px-3 py-1.5" onClick={saveChoKho} loading={savingChoKho}>Lưu</Button>
              </div>
              <p className="mt-1 text-xs text-ink-soft">Thời gian phơi mặc định khi in tem cho phần in này (bỏ trống = 60 phút).</p>
            </section>
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                Đợt vải về ({detail.dot_vai?.length || 0})
              </h3>
              {detail.dot_vai?.length ? (
                <div className="space-y-2">
                  {detail.dot_vai.map((dv) => (
                    <div key={dv.id} className="rounded-control border border-line p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">{dv.ma_dot_vai}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-ink-soft">
                        <span>SL vải về: <b className="text-ink">{fmtNum(dv.so_luong_vai_ve)}</b></span>
                        <span>Loại: {dv.loai_dot_vai || '—'}</span>
                        <span>Ngày về: {fmtDate(dv.ngay_vai_ve)}</span>
                        <span>Hạn giao: {fmtDate(dv.han_giao_hang)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-soft">Chưa có đợt vải về.</p>
              )}
            </section>

            {detail.tem_summary?.pcs_in > 0 && (
              <section className="border-t border-line pt-4">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Sản xuất &amp; chất lượng (hợp nhất theo phần in)
                </h3>
                <Row label="Đã in (pcs tem)" value={`${fmtNum(detail.tem_summary.pcs_in)} pcs · ${fmtNum(detail.tem_summary.so_tem)} tem`} />
                {(detail.tem_summary.sl_dat > 0 || detail.tem_summary.sl_sua > 0) && (
                  <>
                    <Row label="SL đạt (KCS)" value={fmtNum(detail.tem_summary.sl_dat)} />
                    <Row label="SL chuyển sửa" value={fmtNum(detail.tem_summary.sl_sua)} />
                  </>
                )}
                {detail.tem_summary.sl_sua_dat > 0 && (
                  <Row label="SL sửa đạt" value={fmtNum(detail.tem_summary.sl_sua_dat)} />
                )}
              </section>
            )}

            <section className="border-t border-line pt-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
                Hành trình theo đợt sản xuất
              </h3>
              {(() => {
                const tl = detail.timeline || {};
                const ready = tl.ready;
                const journeys = tl.journeys || [];
                const single = journeys.length === 1; // pcs mức phần in chỉ khớp khi có đúng 1 đợt SX
                if (!ready && journeys.length === 0) {
                  return <p className="text-sm text-ink-soft">Phần in chưa đi qua checkpoint nào có xác nhận.</p>;
                }
                const renderNode = (t, i, arr, withPcs) => (
                  <li key={t.ma_tram}>
                    <div className="rounded-control border border-line p-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-wash text-[11px] font-bold text-primary">{i + 1}</span>
                        <span className="text-sm font-semibold text-ink">{t.ten_tram}</span>
                      </div>
                      {t.checklists.length > 0 && (
                        <div className="mt-2 space-y-1.5 pl-8">
                          {t.checklists.map((c) => (
                            <div key={c.ma_checkpoint} className="text-xs">
                              <div className="flex flex-wrap items-center gap-x-1.5">
                                <span className="font-medium text-ink">{c.ten_checkpoint}</span>
                                {c.gia_tri_text && <span className="text-ink-soft">· {c.gia_tri_text}</span>}
                              </div>
                              <div className="text-ink-soft">{fmtDateTime(c.tg)} · {c.nguoi || '—'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {t.moc && (
                        <div className="mt-2 pl-8 text-xs text-ink-soft">
                          {fmtDateTime(t.moc.tg)} · {t.moc.nguoi || '—'}
                          {t.moc.so_luong > 1 ? ` · ${t.moc.so_luong} lần` : ''}
                        </div>
                      )}
                      {withPcs && <StagePcsNote maTram={t.ma_tram} sp={detail.stage_pcs} />}
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex justify-center py-1 text-ink-soft"><Icon name="arrow-down" size={16} /></div>
                    )}
                  </li>
                );
                return (
                  <div className="space-y-4">
                    {ready && (
                      <div>
                        <div className="mb-1 text-xs font-semibold text-ink-soft">Chuẩn bị kỹ thuật (READY) — dùng chung mọi đợt SX</div>
                        <ol>{renderNode(ready, 0, [ready], single)}</ol>
                      </div>
                    )}
                    {journeys.length === 0 ? (
                      <p className="text-sm text-ink-soft">Chưa có đợt sản xuất nào (phần in đang ở READY/chờ release).</p>
                    ) : journeys.map((j, ji) => (
                      <div key={j.lenh_id} className="rounded-control border border-line/70 bg-surface-muted/30 p-2.5">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge tone="info">Đợt SX {ji + 1}/{journeys.length}</Badge>
                          <span className="text-sm font-semibold text-ink">{j.ma_lenh_san_xuat}</span>
                          {j.giai_doan === 'EP_UI' && <Badge tone="warning">Ép ủi</Badge>}
                          {j.dot_vai?.length > 0 && (
                            <span className="text-xs text-ink-soft">vải: {j.dot_vai.map((d) => d.ma_dot_vai).join(', ')}</span>
                          )}
                        </div>
                        {j.trams.length ? (
                          <ol>{j.trams.map((t, i) => renderNode(t, i, j.trams, single))}</ol>
                        ) : (
                          <p className="pl-1 text-xs text-ink-soft">Đợt SX vừa tạo — chưa đi qua checkpoint nào.</p>
                        )}
                      </div>
                    ))}
                    {detail.kcs_by_dot?.dot?.length > 0 && (
                      <div className="rounded-control border border-line p-3">
                        <div className="mb-1 text-xs font-semibold text-ink-soft">KCS theo đợt vải (tổng hợp phần in)</div>
                        <KcsBreakdown data={detail.kcs_by_dot} />
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>
          </div>
        )}
      </SidePanel>

      <Toast toast={toast} />
    </div>
  );
}
