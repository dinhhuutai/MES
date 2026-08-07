import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import SidePanel from './SidePanel';
import DataTable from './DataTable';
import Badge from './Badge';
import Button from './Button';
import Icon from './Icon';
import Toast from './Toast';
import TinhChatInCell from './TinhChatInCell';
import HanGiaoCell from './HanGiaoCell';
import exportPanelExcel from './exportPanelExcel';
import useToast from '../../hooks/useToast';
import { fmtNum } from '../../utils/format';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN') : '');

// Cột Excel "Giờ HT" (giờ hoàn thành) — ĐỨNG NGAY SAU cột "Hạn giao".
// Export để 4 màn khai `excelColumns` RIÊNG (KCS · Sửa · OQC · Gom set) dùng CHUNG 1 định nghĩa,
// khỏi mỗi nơi tự format một kiểu. `exportPanelExcel` không có type 'time' nên xuất thẳng chuỗi
// giống hệt thứ đang hiện trên bảng.
export const COT_EXCEL_GIO_HT = { header: 'Giờ HT', value: (r) => fmtTime(r.tg), center: true, width: 12 };

// Bỏ dấu tiếng Việt + hạ chữ thường (gõ "do" ra "đỏ", "xanh la" ra "xanh lá").
const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().trim();

// Các trường lọc của panel "Đã hoàn thành" — dùng chung cho ô tìm kiếm 1-ô và panel lọc nhiều trường.
// ⚠ "Code phần" đọc `ma_phan` TRƯỚC, thiếu mới lùi về `ma`: panel READY/QC dùng chính `ma_phan` làm cột
// mã (`pin.ma_phan AS ma`), còn panel theo TEM/LỆNH thì `ma` là mã tem/mã lệnh và code phần nằm ở
// `ma_phan` (backend `DONE_INFO` / `TEM_INFO_LATERAL` đã trả cột này).
const FILTER_FIELDS = [
  { key: 'ma_phan', label: 'Code phần', get: (r) => r.ma_phan || r.ma },
  { key: 'ten_khach_hang', label: 'Khách hàng', get: (r) => r.ten_khach_hang },
  { key: 'ma_don_hang', label: 'Đơn hàng', get: (r) => r.ma_don_hang },
  { key: 'ma_hang', label: 'Mã hàng', get: (r) => r.ma_hang },
  { key: 'mau_vai', label: 'Màu vải', get: (r) => r.mau_vai },
  { key: 'kich_vai', label: 'Kích vải', get: (r) => r.kich_vai },
  { key: 'kich_phim', label: 'Kích phim', get: (r) => r.kich_phim },
];

// Panel "đã hoàn thành ở checkpoint" theo ngày, MỞ BÊN TRÁI (đối xứng với HistoryPanel bên phải).
// fetcher(dateStr) -> { data: [{ ma, ten_khach_hang, ma_don_hang, ma_hang, mau_vai, kich_vai,
//                                kich_phim, so_luong, tg, nguoi }] }.
// maHeader: nhãn cột mã (Tem / Phần in / Lệnh / Set...). columns: override toàn bộ cột nếu cần.
// showChuyen: chèn thêm cột "Chuyền" NGAY SAU "Tính chất in" (cả bảng lẫn Excel) — cần fetcher trả `ten_chuyen`.
// extraColumns / extraExcelColumns: cột PHỤ nối vào CUỐI bộ cột mặc định. Nhận mảng HOẶC hàm (rows)=>mảng
// (dùng khi số cột phụ thuộc dữ liệu — vd "Lần test 1..N" ở Test Run).
export default function DonePanel({
  open, onClose, title = 'Đã hoàn thành', maHeader = 'Mã', fetcher, columns, excelColumns, showChuyen = false,
  extraColumns, extraExcelColumns,
}) {
  const { toast, show } = useToast();
  const [date, setDate] = useState(todayStr);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState('');            // ô tìm kiếm 1-ô (quét mọi trường ở FILTER_FIELDS + mã)
  const [filters, setFilters] = useState({}); // panel lọc từng trường (kết hợp AND)
  const [showFilters, setShowFilters] = useState(false);

  // Giữ fetcher trong ref (prop thường là arrow-function nội tuyến) để không refetch mỗi giây
  // khi màn cha dùng useNow(1000) — tránh panel nháy. Chỉ nạp lại khi mở panel hoặc đổi ngày.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    if (!open || !fetcherRef.current) return;
    setLoading(true);
    try {
      const res = await fetcherRef.current(date);
      setRows((res.data || []).map((r, i) => ({ ...r, _k: i })));
    } catch (e) {
      show(e.message || 'Lỗi tải danh sách', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [open, date, show]);

  useEffect(() => { load(); }, [load]);

  // Lọc CLIENT-SIDE (panel tải trọn 1 ngày nên lọc tại chỗ là đủ, không cần gọi lại API).
  // Ô tìm kiếm quét MỌI trường ở FILTER_FIELDS + cột mã (mã tem / mã lệnh / mã set) — không dấu.
  const viewRows = useMemo(() => {
    const tuKhoa = norm(q);
    const dangLoc = FILTER_FIELDS.filter((f) => (filters[f.key] || '').trim());
    if (!tuKhoa && !dangLoc.length) return rows;
    return rows.filter((r) => {
      if (dangLoc.some((f) => !norm(f.get(r)).includes(norm(filters[f.key])))) return false;
      if (!tuKhoa) return true;
      return FILTER_FIELDS.some((f) => norm(f.get(r)).includes(tuKhoa)) || norm(r.ma).includes(tuKhoa);
    });
  }, [rows, q, filters]);

  const soLoc = Object.values(filters).filter((v) => (v || '').trim()).length + (q.trim() ? 1 : 0);
  const xoaLoc = () => { setFilters({}); setQ(''); };

  const defaultColumns = [
    { key: 'ma', header: maHeader, className: 'whitespace-nowrap', render: (r) => <Badge tone="info">{r.ma || '—'}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    ...(showChuyen ? [{ key: 'ten_chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' }] : []),
    { key: 'so_luong', header: 'SL', className: 'text-right tabular-nums', render: (r) => (r.so_luong != null ? fmtNum(r.so_luong) : '—') },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
    { key: 'tg', header: 'Giờ HT', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtTime(r.tg) },
    { key: 'nguoi', header: 'Người', render: (r) => r.nguoi || '—' },
  ];

  // Cột Excel mặc định (khớp defaultColumns + STT tự thêm). Panel dùng override columns có thể truyền excelColumns.
  const defaultExcelCols = [
    { header: maHeader, value: (r) => r.ma || '' },
    { header: 'Khách hàng', value: (r) => r.ten_khach_hang || '' },
    { header: 'Đơn hàng', value: (r) => r.ma_don_hang || '' },
    { header: 'Mã hàng', value: (r) => r.ma_hang || '' },
    { header: 'Màu vải', value: (r) => r.mau_vai || '' },
    { header: 'Kích vải', value: (r) => r.kich_vai || '' },
    { header: 'Kích phim', value: (r) => r.kich_phim || '' },
    { header: 'Tính chất in', value: (r) => r.tinh_chat_in || '' },
    ...(showChuyen ? [{ header: 'Chuyền', value: (r) => r.ten_chuyen || '' }] : []),
    { header: 'SL', value: (r) => (r.so_luong != null ? Number(r.so_luong) : ''), num: true },
    { header: 'Hạn giao', value: (r) => r.han_giao_hang || '', type: 'date' },
    COT_EXCEL_GIO_HT,
    { header: 'Người', value: (r) => r.nguoi || '' },
  ];

  const resolveExtra = (x) => (typeof x === 'function' ? x(rows) : x) || [];
  const tableCols = columns || [...defaultColumns, ...resolveExtra(extraColumns)];
  const xlsCols = excelColumns || [...defaultExcelCols, ...resolveExtra(extraExcelColumns)];

  const doExport = async () => {
    setExporting(true);
    try {
      // Xuất ĐÚNG danh sách đang lọc (không phải toàn bộ ngày) + ghi bộ lọc vào phụ đề để biết file lọc gì.
      const moTa = [
        q.trim() ? `tìm "${q.trim()}"` : '',
        ...FILTER_FIELDS.filter((f) => (filters[f.key] || '').trim())
          .map((f) => `${f.label.toLowerCase()}: ${filters[f.key].trim()}`),
      ].filter(Boolean).join(' · ');
      await exportPanelExcel({
        cols: xlsCols,
        rows: viewRows,
        title: title.toUpperCase(),
        subtitle: `Ngày ${date} · ${viewRows.length} dòng${moTa ? ` · Lọc: ${moTa}` : ''}`,
        fileName: 'da-hoan-thanh',
      });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SidePanel open={open} onClose={onClose} side="left" title={title}
      subtitle={soLoc
        ? `${viewRows.length}/${rows.length} đã hoàn thành trong ngày (đang lọc)`
        : `${rows.length} đã hoàn thành trong ngày`}
      width="max-w-3xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-ink">Ngày</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-input border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        {/* 1 ô tìm: code phần · khách hàng · đơn hàng · mã hàng · màu vải · kích vải · kích phim (+ cột mã) */}
        <div className="relative min-w-[13rem] flex-1">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm code phần, khách, đơn, mã hàng, màu, kích..."
            className="h-10 w-full rounded-input border border-line bg-surface pl-9 pr-8 text-base md:text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          {q && (
            <button onClick={() => setQ('')} aria-label="Xóa tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-danger">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <Button variant={showFilters || soLoc ? 'secondary' : 'ghost'} icon="filter"
          onClick={() => setShowFilters((v) => !v)}>Bộ lọc{soLoc ? ` (${soLoc})` : ''}</Button>
        <Button variant="secondary" icon="file-spreadsheet" loading={exporting}
          disabled={!viewRows.length} onClick={doExport}>Xuất Excel</Button>
      </div>

      {/* Panel lọc từng trường (kết hợp AND với nhau và với ô tìm kiếm) */}
      {showFilters && (
        <div className="mb-3 rounded-card border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={xoaLoc} disabled={!soLoc}>Xóa lọc</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FILTER_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</label>
                <input value={filters[f.key] || ''}
                  onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={`Lọc ${f.label.toLowerCase()}...`}
                  className="h-9 w-full rounded-input border border-line bg-surface px-2.5 text-base md:text-sm outline-none focus:border-primary" />
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable columns={tableCols} rows={viewRows} loading={loading} rowKey="_k" sttStart={0}
        emptyText={soLoc ? 'Không có dòng nào khớp bộ lọc' : 'Chưa có mục nào hoàn thành trong ngày'} />
      <Toast toast={toast} />
    </SidePanel>
  );
}
