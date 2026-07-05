import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  listGiaoDacBiet, createGiaoDacBiet, updateGiaoDacBiet, toggleGiaoDacBiet,
} from '../../../services/qualityService';

// Danh mục "trường hợp giao đặc biệt" cho OQD (Ban giám đốc ký, Trễ hạn khách hàng...).
export default function GiaoDacBietPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('GIAODB_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null); // null | {} (mới) | row (sửa)
  const [form, setForm] = useState({ ma: '', ten: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listGiaoDacBiet({ search });
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openNew = () => { setForm({ ma: '', ten: '' }); setEditing({}); };
  const openEdit = (r) => { setForm({ ma: r.ma, ten: r.ten }); setEditing(r); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing.id) {
        await updateGiaoDacBiet(editing.id, { ten: form.ten });
        show('Đã cập nhật trường hợp');
      } else {
        await createGiaoDacBiet({ ma: form.ma, ten: form.ten });
        show('Đã thêm trường hợp');
      }
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doToggle = async (r) => {
    try {
      await toggleGiaoDacBiet(r.id, !r.dang_hoat_dong);
      show(r.dang_hoat_dong ? 'Đã tắt trường hợp' : 'Đã bật trường hợp');
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    }
  };

  const columns = [
    { key: 'ma', header: 'Mã', render: (r) => <Badge tone="default">{r.ma}</Badge> },
    { key: 'ten', header: 'Trường hợp', className: 'font-medium text-ink' },
    { key: 'dang_hoat_dong', header: 'Trạng thái', render: (r) =>
      r.dang_hoat_dong ? <Badge tone="success">Đang dùng</Badge> : <Badge tone="default">Tắt</Badge> },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      canManage && (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => openEdit(r)}>Sửa</Button>
          <Button variant={r.dang_hoat_dong ? 'ghost' : 'secondary'} className="px-2.5 py-1 text-xs" onClick={() => doToggle(r)}>
            {r.dang_hoat_dong ? 'Tắt' : 'Bật'}
          </Button>
        </div>
      ) },
  ];

  return (
    <div>
      <Toolbar title="Trường hợp giao đặc biệt" subtitle="Danh mục trường hợp cho giao ngoại lệ ở OQC"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã, tên trường hợp...">
        {canManage && <Button icon="plus" onClick={openNew}>Thêm trường hợp</Button>}
        <Badge tone="info">{rows.length}</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có trường hợp nào" />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Sửa trường hợp' : 'Thêm trường hợp'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving}
              disabled={!form.ten || (!editing?.id && !form.ma)}>Lưu</Button>
          </>
        }
      >
        {!editing?.id && (
          <Field label="Mã" required>
            <Input value={form.ma} onChange={(e) => setForm({ ...form, ma: e.target.value.toUpperCase() })}
              placeholder="vd: BGD_KY" />
          </Field>
        )}
        <Field label="Tên trường hợp" required>
          <Input value={form.ten} onChange={(e) => setForm({ ...form, ten: e.target.value })}
            placeholder="vd: Ban giám đốc ký" />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
