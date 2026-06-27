import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import { listReadyCandidates } from '../../../services/readyService';
import ReadyPanel from '../components/ReadyPanel';

const STATUS = {
  CHUA: { tone: 'default', label: 'Chưa làm' },
  DANG: { tone: 'warning', label: 'Đang chuẩn bị' },
  CHO_QC: { tone: 'info', label: 'Chờ QC' },
};

export default function ReadyPage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listReadyCandidates({ search, page, limit: 20 });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const columns = [
    { key: 'ma_phan', header: 'Code phần', render: (r) => <Badge tone="info">{r.ma_phan}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink' },
    { key: 'ma_don_hang', header: 'Đơn hàng' },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'mau_vai', header: 'Màu vải' },
    { key: 'kich_vai', header: 'Kích vải' },
    { key: 'trang_thai_ready', header: 'Trạng thái', render: (r) => {
      const s = STATUS[r.trang_thai_ready] || STATUS.CHUA;
      return <Badge tone={s.tone}>{s.label}</Badge>;
    } },
  ];

  return (
    <div>
      <Toolbar title="Chuẩn bị kỹ thuật — READY" subtitle="Xác nhận khuôn / film / mực / HSKT trước khi Release"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, khách...">
        <Badge tone="warning">{meta.total} chưa READY</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => setSel(r.id)}
        emptyText="Tất cả phần in đã READY 🎉" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      {sel && (
        <ReadyPanel
          phanInId={sel}
          onClose={() => setSel(null)}
          onChanged={load}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
