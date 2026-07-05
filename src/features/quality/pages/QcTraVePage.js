import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import { Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import { qcTraVeHistory } from '../../../services/qualityService';

const LOAI = [
  { key: 'READY', label: 'QC chuẩn bị KT → Ready KT' },
  { key: 'TEST_RUN', label: 'Test Run → Release 1' },
  { key: 'OQC', label: 'OQC → KCS' },
];

const todayStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const fmt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

export default function QcTraVePage() {
  const { toast, show } = useToast();
  const [loai, setLoai] = useState('READY');
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await qcTraVeHistory(loai, date);
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [loai, date, show]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'tg', header: 'Thời gian', render: (r) => fmt(r.tg) },
    { key: 'nguoi', header: 'Người trả về', render: (r) => r.nguoi || '—' },
    { key: 'doi_tuong', header: 'Đối tượng', render: (r) => (
      <div>
        {r.ma_phan && <div className="font-medium text-ink">{r.ma_phan}</div>}
        {r.ma_tem && <Badge tone="info">{r.ma_tem}</Badge>}
        <div className="text-xs text-ink-soft">
          {[r.ten_khach_hang, r.ma_hang, r.ma_lenh_san_xuat, r.ma_dot_vai].filter(Boolean).join(' · ')}
        </div>
      </div>
    ) },
    ...(loai === 'READY' ? [{ key: 'checklist_list', header: 'Checklist rớt', render: (r) =>
      (r.checklist_list || '').split(',').filter(Boolean).map((c) => <Badge key={c} tone="warning" className="mr-1">{c}</Badge>) }] : []),
    { key: 'ly_do', header: 'Lý do', className: 'text-danger', render: (r) => r.ly_do || '—' },
    { key: 'da_xu_ly', header: 'Trạng thái', render: (r) =>
      r.da_xu_ly ? <Badge tone="success">Đã làm lại</Badge> : <Badge tone="warning">Chờ xử lý</Badge> },
  ];

  return (
    <div>
      <Toolbar title="Lịch sử QC trả về" subtitle="Các lần QC trả phần in/tem về checkpoint trước (kèm lý do)">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        <Badge tone="info">{rows.length}</Badge>
      </Toolbar>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {LOAI.map((l) => (
          <button key={l.key} onClick={() => setLoai(l.key)}
            className={`rounded-control px-3 py-1.5 text-xs font-medium ${loai === l.key ? 'bg-primary text-white' : 'border border-line text-ink-soft hover:bg-surface-muted'}`}>
            {l.label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Không có lần trả về nào trong ngày" />

      <Toast toast={toast} />
    </div>
  );
}
