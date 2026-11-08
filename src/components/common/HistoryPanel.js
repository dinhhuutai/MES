import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import SidePanel from './SidePanel';
import DataTable from './DataTable';
import Button from './Button';
import Icon from './Icon';
import Toast from './Toast';
import exportPanelExcel from './exportPanelExcel';
import useToast from '../../hooks/useToast';
import { ngayLocalISO } from '../../utils/format';
import { khopTungTu } from '../../utils/timKiem';
import NgayInput from './NgayInput';

const todayStr = () => ngayLocalISO(new Date());
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN') : '');
const fmtNgayGio = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');
// Không chọn ngày ⇒ tìm MỌI NGÀY ở server theo ô tìm (code phần / mã) — 01/11/2026, người dùng: "clear ngày thì không
// thấy gì, đáng lẽ không có ngày thì tìm theo code phần". Backend `utils/lichSuTim.js` (≥ 3 ký tự, ≤ 500 lượt mới nhất).
const TU_KHOA_TOI_THIEU = 3;
const TOI_DA_TIM = 500;

// BỘ LỌC (27/10/2026, người dùng: "các modal chỗ lịch sử cho thêm bộ lọc") — lọc CLIENT-SIDE trên 1 ngày đã tải:
//   ô tìm (không dấu, khớp từng từ, quét mọi trường chữ của dòng — kể cả trường phụ như code phần nếu fetcher trả) ·
//   ô chọn Hành động · panel lọc Người / Đối tượng / Chi tiết (AND). Excel xuất đúng danh sách đang lọc.
const TRUONG_LOC = [
  { key: 'nguoi', label: 'Người' },
  { key: 'doi_tuong', label: 'Đối tượng' },
  { key: 'chi_tiet', label: 'Chi tiết' },
];
// THÔNG TIN PHẦN IN của dòng (08/11/2026, người dùng: "trong các modal lịch sử cho thêm thông tin từ khách hàng đến
//   kích film") — backend `utils/thongTinLichSu.js` gắn theo `ma_phan`. Fetcher nào trả ⇒ hiện cột (+ ô lọc + Excel)
//   ngay sau Thời gian; fetcher không trả (Gom set · Gộp đợt vải · báo cáo) ⇒ bảng như cũ.
const COT_PHAN_IN = [
  { key: 'ten_khach_hang', label: 'Khách hàng' },
  { key: 'ma_don_hang', label: 'Đơn hàng' },
  { key: 'ma_hang', label: 'Mã hàng' },
  { key: 'ma_phan', label: 'Code phần' },
  { key: 'mau_vai', label: 'Màu vải' },
  { key: 'kich_vai', label: 'Kích vải' },
  { key: 'kich_phim', label: 'Kích phim' },
];
const coThongTinPin = (r) => COT_PHAN_IN.some((c) => c.key !== 'ma_phan' && r[c.key] != null && String(r[c.key]).trim() !== '');
const chuoiDong = (r) => Object.entries(r)
  .filter(([k, v]) => !k.startsWith('_') && (typeof v === 'string' || typeof v === 'number'))
  .map(([, v]) => String(v)).join(' ');

// Panel lịch sử theo ngày dùng chung. fetcher(dateStr, q) -> [{ tg, nguoi, hanh_dong, doi_tuong, chi_tiet }].
//   dateStr rỗng + q ⇒ backend tìm mọi ngày. `timMoiNgay={false}` cho API chưa hỗ trợ (không ngày ⇒ báo chọn ngày).
// `extraColumns`: cột PHỤ nối vào CUỐI bảng (vd nút "In lại phiếu" ở màn Giao hàng). Nhận mảng HOẶC
// hàm (rows)=>mảng. Mặc định KHÔNG có ⇒ mọi màn đang dùng panel này giữ nguyên như cũ.
// ⚠ Cột phụ CỐ Ý không vào Excel: nó thường là NÚT, xuất ra file chỉ được một ô trống.
// `taiLai` (14/10/2026): số đếm do trang cha tăng lên để panel TẢI LẠI (vd sau khi bấm "Hủy" ở 1 dòng).
export default function HistoryPanel({ open, onClose, title = 'Lịch sử', fetcher, extraColumns, taiLai = 0, timMoiNgay = true }) {
  const { toast, show } = useToast();
  const [date, setDate] = useState(todayStr);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState('');
  const [hanhDong, setHanhDong] = useState('');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  // Chế độ "mọi ngày": không chọn ngày. Từ khóa gửi server sau khi ngừng gõ 400 ms (tránh gọi mỗi phím).
  const moiNgay = !date;
  const [qTre, setQTre] = useState('');
  useEffect(() => {
    if (!moiNgay) { setQTre(''); return undefined; }
    const h = setTimeout(() => setQTre(q.trim()), 400);
    return () => clearTimeout(h);
  }, [q, moiNgay]);
  const qServer = moiNgay && timMoiNgay && qTre.length >= TU_KHOA_TOI_THIEU ? qTre : '';
  const choTuKhoa = moiNgay && !qServer;

  const dsHanhDong = useMemo(() => [...new Set(rows.map((r) => r.hanh_dong).filter(Boolean))].sort(), [rows]);
  const coPin = useMemo(() => rows.some(coThongTinPin), [rows]);
  const truongLoc = useMemo(() => (coPin ? [...COT_PHAN_IN, ...TRUONG_LOC] : TRUONG_LOC), [coPin]);
  const viewRows = useMemo(() => rows.filter((r) => {
    if (hanhDong && r.hanh_dong !== hanhDong) return false;
    if (truongLoc.some((f) => (filters[f.key] || '').trim() && !khopTungTu(r[f.key], filters[f.key]))) return false;
    // Mọi ngày: server đã lọc theo từ khóa (khớp code phần / mã của bản ghi kể cả khi dòng không ghi ra chữ đó).
    return moiNgay || !q.trim() || khopTungTu(chuoiDong(r), q);
  }), [rows, q, hanhDong, filters, moiNgay, truongLoc]);
  const soLoc = truongLoc.filter((f) => (filters[f.key] || '').trim()).length + (q.trim() ? 1 : 0) + (hanhDong ? 1 : 0);
  const xoaLoc = () => { setFilters({}); setQ(''); setHanhDong(''); };

  // Giữ fetcher trong ref: prop này thường là arrow-function nội tuyến (đổi identity mỗi lần
  // component cha re-render — vd cha dùng useNow(1000) chạy mỗi giây). Nếu đưa vào deps sẽ
  // refetch mỗi giây → panel NHÁY. Chỉ nạp lại khi mở panel hoặc đổi ngày.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    if (!open || !fetcherRef.current) return;
    // Không ngày mà chưa đủ từ khóa ⇒ KHÔNG gọi (server sẽ trả hôm nay — dễ hiểu nhầm là kết quả tìm).
    if (!date && !qServer) { setRows([]); return; }
    setLoading(true);
    try {
      const res = await fetcherRef.current(date, qServer || undefined);
      setRows((res.data || []).map((r, i) => ({ ...r, _k: i })));
    } catch (e) {
      show(e.message || 'Lỗi tải lịch sử', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [open, date, qServer, show]);

  useEffect(() => { load(); }, [load, taiLai]);

  const them = typeof extraColumns === 'function' ? (extraColumns(rows) || []) : (extraColumns || []);
  const columns = [
    { key: 'tg', header: moiNgay ? 'Thời gian' : 'Giờ', className: 'whitespace-nowrap tabular-nums',
      render: (r) => (moiNgay ? fmtNgayGio(r.tg) : fmtTime(r.tg)) },
    // Bảng: Màu vải + Kích vải · Kích phim gộp 1 ô 2 dòng (như sidebar Gia công) để cột Hành động / Chi tiết không bị
    //   đẩy khỏi màn; Excel + ô lọc vẫn tách từng trường.
    ...(coPin
      ? [
        ...COT_PHAN_IN.filter((c) => !['mau_vai', 'kich_vai', 'kich_phim'].includes(c.key)).map((c) => ({
          key: c.key, header: c.label,
          className: c.key === 'ma_phan' ? 'whitespace-nowrap font-medium text-ink' : 'max-w-[12rem]',
          render: (r) => r[c.key] || '—' })),
        { key: 'mau_kich', header: 'Màu · Kích vải · Kích phim', className: 'max-w-[12rem]', render: (r) => (
          <div className="leading-tight">
            <div className="text-ink">{r.mau_vai || '—'}</div>
            <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
          </div>
        ) },
      ]
      : rows.some((r) => r.ma_phan) && moiNgay
        ? [{ key: 'ma_phan', header: 'Code phần', className: 'whitespace-nowrap', render: (r) => r.ma_phan || '—' }] : []),
    { key: 'nguoi', header: 'Người', className: 'font-medium text-ink' },
    { key: 'hanh_dong', header: 'Hành động' },
    { key: 'doi_tuong', header: 'Đối tượng' },
    { key: 'chi_tiet', header: 'Chi tiết', render: (r) => r.chi_tiet || '—' },
    ...them,
  ];

  const doExport = async () => {
    setExporting(true);
    try {
      await exportPanelExcel({
        cols: [
          { header: moiNgay ? 'Thời gian' : 'Giờ', value: (r) => (moiNgay ? fmtNgayGio(r.tg) : fmtTime(r.tg)) },
          ...(coPin
            ? COT_PHAN_IN.map((c) => ({ header: c.label, value: (r) => r[c.key] || '' }))
            : moiNgay ? [{ header: 'Code phần', value: (r) => r.ma_phan || '' }] : []),
          { header: 'Người', value: (r) => r.nguoi || '' },
          { header: 'Hành động', value: (r) => r.hanh_dong || '' },
          { header: 'Đối tượng', value: (r) => r.doi_tuong || '' },
          { header: 'Chi tiết', value: (r) => r.chi_tiet || '' },
        ],
        rows: viewRows,
        title: title.toUpperCase(),
        subtitle: `${moiNgay ? `Mọi ngày · tìm "${qServer}"` : `Ngày ${date}`} · ${viewRows.length} lượt${soLoc ? ' (đang lọc)' : ''}`,
        fileName: 'lich-su',
      });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SidePanel open={open} onClose={onClose} title={title} width="md:max-w-[75vw]"
      subtitle={moiNgay
        ? (qServer ? `${viewRows.length} lượt ở mọi ngày${rows.length >= TOI_DA_TIM ? ` (hiện ${TOI_DA_TIM} lượt mới nhất)` : ''}` : 'Mọi ngày — nhập code phần để tìm')
        : (soLoc ? `${viewRows.length}/${rows.length} lượt trong ngày (đang lọc)` : `${rows.length} lượt trong ngày`)}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-ink">Ngày</label>
        <div className="relative">
          <NgayInput value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-input border border-line px-3 pr-8 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          {date && timMoiNgay && (
            <button onClick={() => setDate('')} aria-label="Bỏ ngày — tìm mọi ngày" title="Bỏ ngày — tìm theo code phần ở mọi ngày"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-danger">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <div className="relative min-w-[12rem] flex-1">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={moiNgay ? 'Nhập code phần / mã để tìm ở mọi ngày...' : 'Tìm người, mã, code phần, chi tiết...'}
            className="h-10 w-full rounded-input border border-line bg-surface pl-9 pr-8 text-base md:text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
          {q && (
            <button onClick={() => setQ('')} aria-label="Xóa tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-danger">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        {dsHanhDong.length > 1 && (
          <select value={hanhDong} onChange={(e) => setHanhDong(e.target.value)} aria-label="Lọc theo hành động"
            className="h-10 max-w-[12rem] rounded-input border border-line bg-surface px-2 text-base md:text-sm outline-none focus:border-primary">
            <option value="">Mọi hành động</option>
            {dsHanhDong.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        )}
        <Button variant={showFilters || soLoc ? 'secondary' : 'ghost'} icon="filter" chiXemOk
          onClick={() => setShowFilters((v) => !v)}>Bộ lọc{soLoc ? ` (${soLoc})` : ''}</Button>
        <Button variant="secondary" icon="file-spreadsheet" chiXemOk loading={exporting}
          disabled={!viewRows.length} onClick={doExport}>Xuất Excel</Button>
      </div>
      {showFilters && (
        <div className="mb-3 rounded-card border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
            <Button variant="ghost" chiXemOk className="px-2.5 py-1 text-xs" onClick={xoaLoc} disabled={!soLoc}>Xóa lọc</Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {truongLoc.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</label>
                <input value={filters[f.key] || ''} onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={`Lọc ${f.label.toLowerCase()}...`}
                  className="h-9 w-full rounded-input border border-line bg-surface px-2.5 text-base md:text-sm outline-none focus:border-primary" />
              </div>
            ))}
          </div>
        </div>
      )}
      <DataTable columns={columns} rows={viewRows} loading={loading} rowKey="_k" sttStart={0}
        emptyText={choTuKhoa
          ? (timMoiNgay
            ? `Chưa chọn ngày — nhập code phần (từ ${TU_KHOA_TOI_THIEU} ký tự) để tìm ở mọi ngày`
            : 'Chọn ngày để xem lịch sử')
          : moiNgay ? `Không có lượt nào khớp "${qServer}" ở mọi ngày`
            : soLoc ? 'Không có lượt nào khớp bộ lọc' : 'Không có lượt xác nhận nào trong ngày'} />
      <Toast toast={toast} />
    </SidePanel>
  );
}
