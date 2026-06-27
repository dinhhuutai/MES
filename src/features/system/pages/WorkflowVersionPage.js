import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listVersions, createVersion, updateVersion, setHienHanh } from '../../../services/wfconfigService';
import { fmtDate } from '../../../utils/format';

const empty = { maVersion: '', tenVersion: '', ngayHieuLuc: '', ngayHetHieuLuc: '', trangThai: 'DRAFT' };

export default function WorkflowVersionPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('WORKFLOW_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await listVersions()).data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      maVersion: r.ma_version, tenVersion: r.ten_version,
      ngayHieuLuc: r.ngay_hieu_luc ? r.ngay_hieu_luc.slice(0, 10) : '',
      ngayHetHieuLuc: r.ngay_het_hieu_luc ? r.ngay_het_hieu_luc.slice(0, 10) : '',
      trangThai: r.trang_thai || 'DRAFT',
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) { await updateVersion(editing.id, form); show('Đã cập nhật'); }
      else { await createVersion(form); show('Đã tạo phiên bản'); }
      setOpen(false); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const doSetHienHanh = async () => {
    try { await setHienHanh(confirm.id); show(`Đã đặt ${confirm.ma_version} là hiện hành`); setConfirm(null); load(); }
    catch (e) { show(e.message || 'Thất bại', 'error'); }
  };

  const columns = [
    { key: 'ma_version', header: 'Mã', render: (r) => <Badge tone="info">{r.ma_version}</Badge> },
    { key: 'ten_version', header: 'Tên', className: 'font-medium text-ink' },
    { key: 'ngay_hieu_luc', header: 'Hiệu lực', render: (r) => fmtDate(r.ngay_hieu_luc) },
    { key: 'so_tram', header: 'Số trạm', className: 'text-right', render: (r) => r.so_tram },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) => r.trang_thai || '—' },
    { key: 'la_hien_hanh', header: 'Hiện hành', render: (r) => r.la_hien_hanh ? <Badge tone="success">Hiện hành</Badge> : <Badge tone="default">—</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => canManage && (
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => openEdit(r)}>Sửa</Button>
        {!r.la_hien_hanh && <Button variant="secondary" className="px-3 py-1.5" onClick={() => setConfirm(r)}>Đặt hiện hành</Button>}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Workflow version" subtitle="Phiên bản dòng chảy — chỉ một phiên bản hiện hành">
        {canManage && <Button icon="settings" onClick={openCreate}>Thêm phiên bản</Button>}
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có phiên bản" />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Sửa phiên bản' : 'Thêm phiên bản'}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={save} loading={saving} disabled={!form.maVersion || !form.tenVersion}>Lưu</Button>
        </>}>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Mã phiên bản" required>
            <Input value={form.maVersion} disabled={!!editing} onChange={(e) => setForm({ ...form, maVersion: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Trạng thái">
            <Input value={form.trangThai} onChange={(e) => setForm({ ...form, trangThai: e.target.value.toUpperCase() })} />
          </Field>
        </div>
        <Field label="Tên phiên bản" required>
          <Input value={form.tenVersion} onChange={(e) => setForm({ ...form, tenVersion: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Ngày hiệu lực">
            <Input type="date" value={form.ngayHieuLuc} onChange={(e) => setForm({ ...form, ngayHieuLuc: e.target.value })} />
          </Field>
          <Field label="Ngày hết hiệu lực">
            <Input type="date" value={form.ngayHetHieuLuc} onChange={(e) => setForm({ ...form, ngayHetHieuLuc: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={doSetHienHanh}
        title="Đặt phiên bản hiện hành"
        message={confirm ? `Đặt ${confirm.ma_version} làm phiên bản hiện hành? Các phiên bản khác sẽ bị bỏ hiện hành.` : ''}
        confirmText="Đặt hiện hành" />
      <Toast toast={toast} />
    </div>
  );
}
