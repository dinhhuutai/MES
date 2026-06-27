import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listModules, updateModule, setModuleActive } from '../../../services/systemService';

export default function ModulesPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('MODULE_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ tenModule: '', icon: '', route: '', thuTu: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listModules();
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (m) => {
    setEditing(m);
    setForm({ tenModule: m.ten_module, icon: m.icon || '', route: m.route || '', thuTu: m.thu_tu || 0 });
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateModule(editing.id, { ...form, thuTu: Number(form.thuTu) });
      show('Đã cập nhật module');
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m) => {
    try {
      await setModuleActive(m.id, !m.dang_hoat_dong);
      show('Đã cập nhật');
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    }
  };

  const columns = [
    { key: 'thu_tu', header: '#', className: 'w-12 text-ink-soft' },
    { key: 'ten_module', header: 'Module', render: (r) => (
      <div className="flex items-center gap-2">
        <Icon name={r.icon} size={18} className="text-primary" />
        <span className="font-medium text-ink">{r.ten_module}</span>
      </div>
    ) },
    { key: 'ma_module', header: 'Mã', className: 'font-mono text-xs' },
    { key: 'route', header: 'Route', render: (r) => <span className="font-mono text-xs text-ink-soft">{r.route}</span> },
    { key: 'dang_hoat_dong', header: 'Trạng thái', render: (r) =>
      r.dang_hoat_dong ? <Badge tone="success">Bật</Badge> : <Badge tone="danger">Tắt</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => canManage && (
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => openEdit(r)}>Sửa</Button>
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => toggleActive(r)}>
          {r.dang_hoat_dong ? 'Tắt' : 'Bật'}
        </Button>
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Quản lý module" subtitle="Module hiển thị trên Home Portal" />
      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có module" />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Sửa module: ${editing?.ten_module || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving} disabled={!form.tenModule}>Lưu</Button>
          </>
        }
      >
        <Field label="Tên module" required>
          <Input value={form.tenModule} onChange={(e) => setForm({ ...form, tenModule: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Icon (Lucide)" hint="vd: package, factory, settings">
            <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </Field>
          <Field label="Thứ tự">
            <Input type="number" value={form.thuTu} onChange={(e) => setForm({ ...form, thuTu: e.target.value })} />
          </Field>
        </div>
        <Field label="Route">
          <Input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
