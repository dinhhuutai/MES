import { useEffect, useState, useCallback } from 'react';
import SidePanel from './SidePanel';
import DataTable from './DataTable';
import Toast from './Toast';
import useToast from '../../hooks/useToast';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN') : '');

// Panel lịch sử theo ngày dùng chung. fetcher(dateStr) -> [{ tg, nguoi, hanh_dong, doi_tuong, chi_tiet }].
export default function HistoryPanel({ open, onClose, title = 'Lịch sử', fetcher }) {
  const { toast, show } = useToast();
  const [date, setDate] = useState(todayStr);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!open || !fetcher) return;
    setLoading(true);
    try {
      const res = await fetcher(date);
      setRows((res.data || []).map((r, i) => ({ ...r, _k: i })));
    } catch (e) {
      show(e.message || 'Lỗi tải lịch sử', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [open, fetcher, date, show]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'tg', header: 'Giờ', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtTime(r.tg) },
    { key: 'nguoi', header: 'Người', className: 'font-medium text-ink' },
    { key: 'hanh_dong', header: 'Hành động' },
    { key: 'doi_tuong', header: 'Đối tượng' },
    { key: 'chi_tiet', header: 'Chi tiết', render: (r) => r.chi_tiet || '—' },
  ];

  return (
    <SidePanel open={open} onClose={onClose} title={title} subtitle={`${rows.length} lượt trong ngày`} width="max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium text-ink">Ngày</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-input border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} rowKey="_k"
        emptyText="Không có lượt xác nhận nào trong ngày" />
      <Toast toast={toast} />
    </SidePanel>
  );
}
