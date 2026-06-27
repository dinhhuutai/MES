import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useVersions from '../../../hooks/useVersions';
import { listTrams, createTram, updateTram, setTramActive } from '../../../services/wfconfigService';
import CheckpointPanel from '../components/CheckpointPanel';

const empty = { maTram: '', tenTram: '', thuTu: '', thoiGianQuyDinhPhut: '', canhBaoTruocPhut: '' };

export default function TramCheckpointPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('WORKFLOW_MANAGE');
  const { versions, versionId, setVersionId } = useVersions();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [cpTram, setCpTram] = useState(null);

  const load = useCallback(async () => {
    if (!versionId) return;
    setLoading(true);
    try { setRows((await listTrams(versionId)).data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [versionId, show]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ maTram: r.ma_tram, tenTram: r.ten_tram, thuTu: r.thu_tu ?? '', thoiGianQuyDinhPhut: r.thoi_gian_quy_dinh_phut ?? '', canhBaoTruocPhut: r.canh_bao_truoc_phut ?? '' });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form, versionId,
        thuTu: form.thuTu === '' ? null : Number(form.thuTu),
        thoiGianQuyDinhPhut: form.thoiGianQuyDinhPhut === '' ? null : Number(form.thoiGianQuyDinhPhut),
        canhBaoTruocPhut: form.canhBaoTruocPhut === '' ? null : Number(form.canhBaoTruocPhut),
      };
      if (editing) { await updateTram(editing.id, body); show('Đã cập nhật trạm'); }
      else { await createTram(body); show('Đã tạo trạm'); }
      setOpen(false); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const toggle = async (r) => {
    try { await setTramActive(r.id, !r.dang_hoat_dong); show('Đã cập nhật'); load(); }
    catch (e) { show(e.message || 'Thất bại', 'error'); }
  };

  const columns = [
    { key: 'thu_tu', header: '#', className: 'w-10 text-ink-soft', render: (r) => r.thu_tu ?? '—' },
    { key: 'ma_tram', header: 'Mã trạm', render: (r) => <Badge tone="info">{r.ma_tram}</Badge> },
    { key: 'ten_tram', header: 'Tên trạm', className: 'font-medium text-ink' },
    { key: 'thoi_gian_quy_dinh_phut', header: 'SLA (phút)', render: (r) => r.thoi_gian_quy_dinh_phut ?? '—' },
    { key: 'so_checkpoint', header: 'Checkpoint', render: (r) => <Badge tone="default">{r.so_checkpoint}</Badge> },
    { key: 'dang_hoat_dong', header: 'Trạng thái', render: (r) => r.dang_hoat_dong ? <Badge tone="success">Bật</Badge> : <Badge tone="danger">Tắt</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <Button variant="secondary" className="px-3 py-1.5" onClick={() => setCpTram(r)}>Checkpoint</Button>
        {canManage && <Button variant="ghost" className="px-3 py-1.5" onClick={() => openEdit(r)}>Sửa</Button>}
        {canManage && <Button variant="ghost" className="px-3 py-1.5" onClick={() => toggle(r)}>{r.dang_hoat_dong ? 'Tắt' : 'Bật'}</Button>}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Trạm & Checkpoint" subtitle="Cấu hình trạm và checkpoint theo phiên bản workflow">
        {canManage && <Button icon="settings" onClick={openCreate} disabled={!versionId}>Thêm trạm</Button>}
      </Toolbar>

      <div className="mb-4 max-w-xs">
        <Select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
          {versions.map((v) => <option key={v.id} value={v.id}>{v.ma_version} — {v.ten_version}{v.la_hien_hanh ? ' (hiện hành)' : ''}</option>)}
        </Select>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Phiên bản chưa có trạm" />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Sửa trạm' : 'Thêm trạm'}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={save} loading={saving} disabled={!form.maTram || !form.tenTram}>Lưu</Button>
        </>}>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Mã trạm" required>
            <Input value={form.maTram} disabled={!!editing} onChange={(e) => setForm({ ...form, maTram: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Thứ tự">
            <Input type="number" value={form.thuTu} onChange={(e) => setForm({ ...form, thuTu: e.target.value })} />
          </Field>
        </div>
        <Field label="Tên trạm" required>
          <Input value={form.tenTram} onChange={(e) => setForm({ ...form, tenTram: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="SLA (phút)">
            <Input type="number" value={form.thoiGianQuyDinhPhut} onChange={(e) => setForm({ ...form, thoiGianQuyDinhPhut: e.target.value })} />
          </Field>
          <Field label="Cảnh báo trước (phút)">
            <Input type="number" value={form.canhBaoTruocPhut} onChange={(e) => setForm({ ...form, canhBaoTruocPhut: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {cpTram && <CheckpointPanel tram={cpTram} onClose={() => { setCpTram(null); load(); }} />}
      <Toast toast={toast} />
    </div>
  );
}
