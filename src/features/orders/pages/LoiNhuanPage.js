import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listPhanIn, setLoiNhuan } from '../../../services/orderService';
import { fmtNum } from '../../../utils/format';

export default function LoiNhuanPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('PROFIT_MANAGE');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPhanIn({ search, page, limit: 20, missing_profit: 1 });
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

  const openInput = (row) => {
    setEditing(row);
    setValue('');
  };

  const save = async () => {
    setSaving(true);
    try {
      await setLoiNhuan(editing.id, Number(value));
      show(`Đã lưu lợi nhuận cho ${editing.ma_phan}`);
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'ma_phan', header: 'Code phần', render: (r) => <Badge tone="info">{r.ma_phan}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink' },
    { key: 'ma_don_hang', header: 'Đơn hàng' },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'mau_vai', header: 'Màu vải' },
    { key: 'so_luong_don_hang', header: 'SL đơn', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_don_hang) },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canManage && <Button className="px-3 py-1.5" onClick={() => openInput(r)}>Nhập lợi nhuận</Button> },
  ];

  return (
    <div>
      <Toolbar title="Tính lợi nhuận" subtitle="Phần in chưa nhập lợi nhuận"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, khách...">
        <Badge tone="warning">{meta.total} chưa có</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading}
        emptyText="Tất cả phần in đã có lợi nhuận 🎉" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Nhập lợi nhuận — ${editing?.ma_phan || ''}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving} disabled={value === '' || Number(value) < 0}>Lưu</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {editing?.ten_khach_hang} · {editing?.ma_don_hang} · {editing?.mau_vai} · SL {fmtNum(editing?.so_luong_don_hang)}
        </div>
        <Field label="Lợi nhuận (₫)" required>
          <Input type="number" min="0" value={value} autoFocus
            onChange={(e) => setValue(e.target.value)} placeholder="Nhập số tiền lợi nhuận" />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
