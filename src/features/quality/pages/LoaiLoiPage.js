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
  listLoaiLoi, createLoaiLoi, updateLoaiLoi, toggleLoaiLoi,
} from '../../../services/qualityService';

export default function LoaiLoiPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('LOI_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null); // null | {} (mới) | row (sửa)
  const [form, setForm] = useState({ maLoi: '', tenLoi: '', nhomLoi: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listLoaiLoi({ search });
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

  const openNew = () => { setForm({ maLoi: '', tenLoi: '', nhomLoi: '' }); setEditing({}); };
  const openEdit = (r) => { setForm({ maLoi: r.ma_loi, tenLoi: r.ten_loi, nhomLoi: r.nhom_loi || '' }); setEditing(r); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing.id) {
        await updateLoaiLoi(editing.id, { tenLoi: form.tenLoi, nhomLoi: form.nhomLoi });
        show('Đã cập nhật loại lỗi');
      } else {
        await createLoaiLoi({ maLoi: form.maLoi, tenLoi: form.tenLoi, nhomLoi: form.nhomLoi });
        show('Đã thêm loại lỗi');
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
      await toggleLoaiLoi(r.id, !r.dang_hoat_dong);
      show(r.dang_hoat_dong ? 'Đã tắt loại lỗi' : 'Đã bật loại lỗi');
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    }
  };

  const columns = [
    { key: 'ma_loi', header: 'Mã lỗi', render: (r) => <Badge tone="default">{r.ma_loi}</Badge> },
    { key: 'ten_loi', header: 'Tên lỗi', className: 'font-medium text-ink' },
    { key: 'nhom_loi', header: 'Nhóm', render: (r) => r.nhom_loi || '—' },
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
      <Toolbar title="Danh mục lỗi" subtitle="Quản lý loại lỗi cho QC (in-line, KCS, OQC)"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lỗi, tên lỗi, nhóm...">
        {canManage && <Button icon="plus" onClick={openNew}>Thêm loại lỗi</Button>}
        <Badge tone="info">{rows.length}</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có loại lỗi nào" />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Sửa loại lỗi' : 'Thêm loại lỗi'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving}
              disabled={!form.tenLoi || (!editing?.id && !form.maLoi)}>Lưu</Button>
          </>
        }
      >
        {!editing?.id && (
          <Field label="Mã lỗi" required>
            <Input value={form.maLoi} onChange={(e) => setForm({ ...form, maLoi: e.target.value.toUpperCase() })}
              placeholder="vd: LECH_MAU" />
          </Field>
        )}
        <Field label="Tên lỗi" required>
          <Input value={form.tenLoi} onChange={(e) => setForm({ ...form, tenLoi: e.target.value })}
            placeholder="vd: Lệch màu" />
        </Field>
        <Field label="Nhóm lỗi" hint="vd: IN / VAI / KHAC">
          <Input value={form.nhomLoi} onChange={(e) => setForm({ ...form, nhomLoi: e.target.value })} />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
