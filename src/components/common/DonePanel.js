import { useEffect, useState, useCallback, useRef } from 'react';
import SidePanel from './SidePanel';
import DataTable from './DataTable';
import Badge from './Badge';
import Button from './Button';
import Toast from './Toast';
import TinhChatInCell from './TinhChatInCell';
import HanGiaoCell from './HanGiaoCell';
import exportPanelExcel from './exportPanelExcel';
import useToast from '../../hooks/useToast';
import { fmtNum } from '../../utils/format';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN') : '');

// Panel "đã hoàn thành ở checkpoint" theo ngày, MỞ BÊN TRÁI (đối xứng với HistoryPanel bên phải).
// fetcher(dateStr) -> { data: [{ ma, ten_khach_hang, ma_don_hang, ma_hang, mau_vai, kich_vai,
//                                kich_phim, so_luong, tg, nguoi }] }.
// maHeader: nhãn cột mã (Tem / Phần in / Lệnh / Set...). columns: override toàn bộ cột nếu cần.
// showChuyen: chèn thêm cột "Chuyền" NGAY SAU "Tính chất in" (cả bảng lẫn Excel) — cần fetcher trả `ten_chuyen`.
export default function DonePanel({
  open, onClose, title = 'Đã hoàn thành', maHeader = 'Mã', fetcher, columns, excelColumns, showChuyen = false,
}) {
  const { toast, show } = useToast();
  const [date, setDate] = useState(todayStr);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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
    { header: 'Người', value: (r) => r.nguoi || '' },
  ];

  const doExport = async () => {
    setExporting(true);
    try {
      await exportPanelExcel({
        cols: excelColumns || defaultExcelCols,
        rows,
        title: title.toUpperCase(),
        subtitle: `Ngày ${date} · ${rows.length} dòng`,
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
      subtitle={`${rows.length} đã hoàn thành trong ngày`} width="max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium text-ink">Ngày</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-input border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        <Button variant="secondary" icon="file-spreadsheet" className="ml-auto" loading={exporting}
          disabled={!rows.length} onClick={doExport}>Xuất Excel</Button>
      </div>
      <DataTable columns={columns || defaultColumns} rows={rows} loading={loading} rowKey="_k" sttStart={0}
        emptyText="Chưa có mục nào hoàn thành trong ngày" />
      <Toast toast={toast} />
    </SidePanel>
  );
}
