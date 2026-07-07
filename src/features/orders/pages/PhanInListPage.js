import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import DateRangePicker from '../../../components/common/DateRangePicker';
import useToast from '../../../hooks/useToast';
import { listVaiVe, getPhanIn, setChoKho } from '../../../services/orderService';
import { fmtNum, fmtDate, fmtDateTime, fmtCurrency } from '../../../utils/format';

const LIMIT = 20;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const TH = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft';
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

// Từ CHỜ KHÔ trở đi: quản lý theo tem → hiện mỗi tem 1 hàng + cột chất lượng.
const TEM_ROW_STAGES = ['CHO_KHO', 'KCS', 'SUA', 'OQC', 'GIAO', 'DA_GIAO'];

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

  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [choKhoMin, setChoKhoMin] = useState('');
  const [savingChoKho, setSavingChoKho] = useState(false);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const activeFilters = useMemo(() => Object.entries(filters).filter(([, v]) => v), [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVaiVe({ search, stage, ...filters, page, limit: LIMIT });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, stage, filtersKey, page, show]);

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
  const COLS = 11 + (showTemRows ? 4 : 0) + (showPcsCol ? 1 : 0);

  return (
    <div>
      <Toolbar title="Danh sách phần in vải về" subtitle="Từ khách hàng → đơn hàng → mã hàng → phần in → đợt vải về"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm nhanh: code phần, mã hàng, màu/kích vải, kích phim, mã đợt vải...">
        <Button variant={showFilters || activeFilters.length ? 'secondary' : 'ghost'} icon="filter"
          onClick={() => setShowFilters((s) => !s)}>
          Bộ lọc{activeFilters.length ? ` (${activeFilters.length})` : ''}
        </Button>
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
      <div className="hidden card overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-left">
                <th className={`${TH} w-12 text-right`}>STT</th>
                <th className={TH}>Khách hàng</th>
                <th className={TH}>Đơn hàng</th>
                <th className={TH}>Mã hàng</th>
                <th className={TH}>Màu vải</th>
                <th className={TH}>Kích vải</th>
                <th className={TH}>Kích phim</th>
                <th className={`${TH} text-right border-r border-line/60`}>SL đơn hàng</th>
                <th className={`${TH} text-right`}>SL vải về</th>
                <th className={TH}>Ngày vải về</th>
                <th className={TH}>Hạn giao</th>
                {showTemRows && (
                  <>
                    <th className={`${TH} border-l border-line/60`}>Mã tem</th>
                    <th className={`${TH} text-right`}>SL pcs</th>
                    <th className={TH}>Trạng thái</th>
                    <th className={TH}>Chất lượng</th>
                  </>
                )}
                {showPcsCol && <th className={`${TH} text-right border-l border-line/60`}>SL đã in</th>}
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

                  // Chế độ THEO TEM (từ chờ khô): STT → Hạn giao hợp nhất, mỗi tem 1 hàng.
                  if (showTemRows) {
                    const tems = g.tems && g.tems.length ? g.tems : [null];
                    const n = tems.length;
                    const agg = aggDotVai(g.dot_vai);
                    return tems.map((tm, ti) => (
                      <tr key={`${g.phan_in_id}-${tm?.tem_id || 'none'}`}
                        onClick={() => openDetail(g.phan_in_id)}
                        className={`cursor-pointer transition hover:bg-surface-muted/40 ${ti === n - 1 ? 'border-b border-line/70' : ''}`}>
                        {ti === 0 && (
                          <>
                            {headCells(n)}
                            <td rowSpan={n} className={`${TD} text-right tabular-nums`}>{fmtNum(agg.total)}</td>
                            <td rowSpan={n} className={TD}>{fmtDate(agg.ngay)}</td>
                            <td rowSpan={n} className={TD}>{fmtDate(agg.han)}</td>
                          </>
                        )}
                        <td className={`${TD} border-l border-line/60 font-medium text-ink`}>{tm?.ma_tem || <span className="text-xs italic text-ink-soft">Chưa in tem</span>}</td>
                        <td className={`${TD} text-right tabular-nums`}>{tm ? `${fmtNum(tm.so_luong)} pcs` : '—'}</td>
                        <td className={TD}>{tm ? <Badge tone={(TEM_STATUS[tm.trang_thai] || {}).tone || 'default'}>{(TEM_STATUS[tm.trang_thai] || {}).label || tm.trang_thai}</Badge> : '—'}</td>
                        <td className={TD}>{tm ? <TemQuality tm={tm} /> : '—'}</td>
                      </tr>
                    ));
                  }

                  // Chế độ mặc định: mỗi đợt vải 1 hàng.
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
                Hành trình qua các checkpoint
              </h3>
              {detail.timeline?.length ? (
                <ol>
                  {detail.timeline.map((t, i) => (
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
                      </div>

                      {i < detail.timeline.length - 1 && (
                        <div className="flex justify-center py-1 text-ink-soft">
                          <Icon name="arrow-down" size={16} />
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-ink-soft">Phần in chưa đi qua checkpoint nào có xác nhận.</p>
              )}
            </section>
          </div>
        )}
      </SidePanel>

      <Toast toast={toast} />
    </div>
  );
}
