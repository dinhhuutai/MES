import { useEffect, useState, useCallback, useRef } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import DataTable from '../../../components/common/DataTable';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import { giaCongHistory } from '../../../services/planningService';
import { fmtNum } from '../../../utils/format';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN') : '');

// Lịch sử "hàng về" gia công đã chuyển OQC theo ngày. Mỗi dòng có nút "In tem" (tem TH VỀ, đầu 13).
export default function GiaCongHistoryPanel({ open, onClose, onPrint }) {
  const { toast, show } = useToast();
  const [date, setDate] = useState(todayStr);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const onPrintRef = useRef(onPrint);
  onPrintRef.current = onPrint;

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await giaCongHistory(date);
      setRows((res.data || []).map((r, i) => ({ ...r, _k: i })));
    } catch (e) {
      show(e.message || 'Lỗi tải lịch sử', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [open, date, show]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'tg', header: 'Giờ', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtTime(r.tg) },
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => r.ma_phan || '—' },
    { key: 'ten_khach_hang', header: 'Khách hàng', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_kich', header: 'Màu · Kích', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'so_luong_release', header: 'SL', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_release) },
    { key: 'nguoi', header: 'Người chuyển', render: (r) => r.nguoi || '—' },
    { key: 'act', header: '', className: 'text-right whitespace-nowrap', render: (r) => (
      <Button size="sm" variant="secondary" icon="printer"
        onClick={(e) => { e.stopPropagation(); onPrintRef.current && onPrintRef.current(r); }}>
        In tem
      </Button>
    ) },
  ];

  return (
    <SidePanel open={open} onClose={onClose} title="Lịch sử chuyển gia công (hàng về)"
      subtitle={`${rows.length} lượt trong ngày`} width="max-w-4xl" side="left">
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium text-ink">Ngày</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-input border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} rowKey="_k" sttStart={0}
        emptyText="Không có lượt chuyển gia công nào trong ngày" />
      <Toast toast={toast} />
    </SidePanel>
  );
}
