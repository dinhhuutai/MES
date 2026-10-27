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

const todayStr = () => ngayLocalISO(new Date());
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN') : '');

// BỘ LỌC (27/10/2026, người dùng: "các modal chỗ lịch sử cho thêm bộ lọc") — lọc CLIENT-SIDE trên 1 ngày đã tải:
//   ô tìm (không dấu, khớp từng từ, quét mọi trường chữ của dòng — kể cả trường phụ như code phần nếu fetcher trả) ·
//   ô chọn Hành động · panel lọc Người / Đối tượng / Chi tiết (AND). Excel xuất đúng danh sách đang lọc.
const TRUONG_LOC = [
  { key: 'nguoi', label: 'Người' },
  { key: 'doi_tuong', label: 'Đối tượng' },
  { key: 'chi_tiet', label: 'Chi tiết' },
];
const chuoiDong = (r) => Object.entries(r)
  .filter(([k, v]) => !k.startsWith('_') && (typeof v === 'string' || typeof v === 'number'))
  .map(([, v]) => String(v)).join(' ');

// Panel lịch sử theo ngày dùng chung. fetcher(dateStr) -> [{ tg, nguoi, hanh_dong, doi_tuong, chi_tiet }].
// `extraColumns`: cột PHỤ nối vào CUỐI bảng (vd nút "In lại phiếu" ở màn Giao hàng). Nhận mảng HOẶC
// hàm (rows)=>mảng. Mặc định KHÔNG có ⇒ mọi màn đang dùng panel này giữ nguyên như cũ.
// ⚠ Cột phụ CỐ Ý không vào Excel: nó thường là NÚT, xuất ra file chỉ được một ô trống.
// `taiLai` (14/10/2026): số đếm do trang cha tăng lên để panel TẢI LẠI (vd sau khi bấm "Hủy" ở 1 dòng).
export default function HistoryPanel({ open, onClose, title = 'Lịch sử', fetcher, extraColumns, taiLai = 0 }) {
  const { toast, show } = useToast();
  const [date, setDate] = useState(todayStr);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState('');
  const [hanhDong, setHanhDong] = useState('');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const dsHanhDong = useMemo(() => [...new Set(rows.map((r) => r.hanh_dong).filter(Boolean))].sort(), [rows]);
  const viewRows = useMemo(() => rows.filter((r) => {
    if (hanhDong && r.hanh_dong !== hanhDong) return false;
    if (TRUONG_LOC.some((f) => (filters[f.key] || '').trim() && !khopTungTu(r[f.key], filters[f.key]))) return false;
    return !q.trim() || khopTungTu(chuoiDong(r), q);
  }), [rows, q, hanhDong, filters]);
  const soLoc = TRUONG_LOC.filter((f) => (filters[f.key] || '').trim()).length + (q.trim() ? 1 : 0) + (hanhDong ? 1 : 0);
  const xoaLoc = () => { setFilters({}); setQ(''); setHanhDong(''); };

  // Giữ fetcher trong ref: prop này thường là arrow-function nội tuyến (đổi identity mỗi lần
  // component cha re-render — vd cha dùng useNow(1000) chạy mỗi giây). Nếu đưa vào deps sẽ
  // refetch mỗi giây → panel NHÁY. Chỉ nạp lại khi mở panel hoặc đổi ngày.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    if (!open || !fetcherRef.current) return;
    setLoading(true);
    try {
      const res = await fetcherRef.current(date);
      setRows((res.data || []).map((r, i) => ({ ...r, _k: i })));
    } catch (e) {
      show(e.message || 'Lỗi tải lịch sử', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [open, date, show]);

  useEffect(() => { load(); }, [load, taiLai]);

  const them = typeof extraColumns === 'function' ? (extraColumns(rows) || []) : (extraColumns || []);
  const columns = [
    { key: 'tg', header: 'Giờ', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtTime(r.tg) },
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
          { header: 'Giờ', value: (r) => fmtTime(r.tg) },
          { header: 'Người', value: (r) => r.nguoi || '' },
          { header: 'Hành động', value: (r) => r.hanh_dong || '' },
          { header: 'Đối tượng', value: (r) => r.doi_tuong || '' },
          { header: 'Chi tiết', value: (r) => r.chi_tiet || '' },
        ],
        rows: viewRows,
        title: title.toUpperCase(),
        subtitle: `Ngày ${date} · ${viewRows.length} lượt${soLoc ? ' (đang lọc)' : ''}`,
        fileName: 'lich-su',
      });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SidePanel open={open} onClose={onClose} title={title} width="max-w-2xl"
      subtitle={soLoc ? `${viewRows.length}/${rows.length} lượt trong ngày (đang lọc)` : `${rows.length} lượt trong ngày`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-ink">Ngày</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-input border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        <div className="relative min-w-[12rem] flex-1">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm người, mã, code phần, chi tiết..."
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
            {TRUONG_LOC.map((f) => (
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
        emptyText={soLoc ? 'Không có lượt nào khớp bộ lọc' : 'Không có lượt xác nhận nào trong ngày'} />
      <Toast toast={toast} />
    </SidePanel>
  );
}
