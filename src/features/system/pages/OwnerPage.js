import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useVersions from '../../../hooks/useVersions';
import {
  tramOptions, listCheckpoints,
  listTramOwners, addTramOwner, removeTramOwner,
  listCheckpointOwners, addCheckpointOwner, removeCheckpointOwner,
} from '../../../services/wfconfigService';
import { listPhongBan, listRoleOptions } from '../../../services/systemService';

function OwnerList({ title, owners, onAdd, onRemove, canManage }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {canManage && onAdd && <Button className="px-3 py-1.5" onClick={onAdd}>+ Thêm owner</Button>}
      </div>
      <div className="space-y-2">
        {owners.length === 0 && <p className="text-sm text-ink-soft">Chưa gán owner.</p>}
        {owners.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-control border border-line px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              {o.ten_phong_ban && <Badge tone="info">PB: {o.ten_phong_ban}</Badge>}
              {o.ten_role && <Badge tone="default">Role: {o.ten_role}</Badge>}
              {o.ho_ten && <Badge tone="default">{o.ho_ten}</Badge>}
              {o.bat_buoc && <Badge tone="warning">Bắt buộc</Badge>}
            </div>
            {canManage && <button onClick={() => onRemove(o)} className="text-xs font-medium text-danger hover:underline">Xóa</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OwnerPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('WORKFLOW_MANAGE');
  const { versions, versionId, setVersionId } = useVersions();

  const [trams, setTrams] = useState([]);
  const [tramId, setTramId] = useState('');
  const [checkpoints, setCheckpoints] = useState([]);
  const [checkpointId, setCheckpointId] = useState('');
  const [tramOwners, setTramOwners] = useState([]);
  const [cpOwners, setCpOwners] = useState([]);

  const [phongBan, setPhongBan] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState(null); // { type: 'tram'|'checkpoint' }
  const [form, setForm] = useState({ phongBanId: '', roleId: '', batBuoc: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listPhongBan().then((r) => setPhongBan(r.data)).catch(() => {});
    listRoleOptions().then((r) => setRoles(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!versionId) return;
    tramOptions(versionId).then((r) => { setTrams(r.data); setTramId(r.data[0]?.id || ''); }).catch(() => {});
  }, [versionId]);

  const loadTramOwners = useCallback(async () => {
    if (!tramId) { setTramOwners([]); setCheckpoints([]); return; }
    try {
      const [o, cps] = await Promise.all([listTramOwners(tramId), listCheckpoints(tramId)]);
      setTramOwners(o.data); setCheckpoints(cps.data); setCheckpointId(cps.data[0]?.id || '');
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); }
  }, [tramId, show]);

  useEffect(() => { loadTramOwners(); }, [loadTramOwners]);

  const loadCpOwners = useCallback(async () => {
    if (!checkpointId) { setCpOwners([]); return; }
    try { setCpOwners((await listCheckpointOwners(checkpointId)).data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
  }, [checkpointId, show]);

  useEffect(() => { loadCpOwners(); }, [loadCpOwners]);

  const openAdd = (type) => { setForm({ phongBanId: '', roleId: '', batBuoc: false }); setModal({ type }); };

  const save = async () => {
    if (!form.phongBanId && !form.roleId) { show('Chọn phòng ban hoặc vai trò', 'error'); return; }
    setSaving(true);
    try {
      if (modal.type === 'tram') {
        await addTramOwner({ tramId, phongBanId: form.phongBanId || null, roleId: form.roleId || null });
        loadTramOwners();
      } else {
        await addCheckpointOwner({ checkpointId, phongBanId: form.phongBanId || null, roleId: form.roleId || null, batBuoc: form.batBuoc });
        loadCpOwners();
      }
      show('Đã thêm owner'); setModal(null);
    } catch (e) { show(e.message || 'Thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const removeTO = async (o) => {
    try { await removeTramOwner(o.id); show('Đã xóa'); loadTramOwners(); }
    catch (e) { show(e.message || 'Xóa thất bại (cần grant DELETE — migration 011)', 'error'); }
  };
  const removeCO = async (o) => {
    try { await removeCheckpointOwner(o.id); show('Đã xóa'); loadCpOwners(); }
    catch (e) { show(e.message || 'Xóa thất bại (cần grant DELETE — migration 011)', 'error'); }
  };

  return (
    <div>
      <Toolbar title="Owner trạm / checkpoint" subtitle="Gán phòng ban / vai trò xử lý cho trạm và checkpoint" />

      <div className="mb-4 grid max-w-2xl grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Phiên bản</label>
          <Select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.ma_version}{v.la_hien_hanh ? ' (hiện hành)' : ''}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Trạm</label>
          <Select value={tramId} onChange={(e) => setTramId(e.target.value)}>
            {trams.map((t) => <option key={t.id} value={t.id}>{t.ma_tram} — {t.ten_tram}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OwnerList title="Owner của trạm" owners={tramOwners} canManage={canManage}
          onAdd={() => openAdd('tram')} onRemove={removeTO} />

        <div>
          <div className="mb-2">
            <label className="mb-1 block text-xs font-medium text-ink-soft">Checkpoint</label>
            <Select value={checkpointId} onChange={(e) => setCheckpointId(e.target.value)}>
              {checkpoints.length === 0 && <option value="">— Trạm chưa có checkpoint —</option>}
              {checkpoints.map((c) => <option key={c.id} value={c.id}>{c.ma_checkpoint} — {c.ten_checkpoint}</option>)}
            </Select>
          </div>
          <OwnerList title="Owner của checkpoint" owners={cpOwners} canManage={canManage && !!checkpointId}
            onAdd={checkpointId ? () => openAdd('checkpoint') : null} onRemove={removeCO} />
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title="Thêm owner" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(null)}>Hủy</Button>
          <Button onClick={save} loading={saving}>Thêm</Button>
        </>}>
        <Field label="Phòng ban">
          <Select value={form.phongBanId} onChange={(e) => setForm({ ...form, phongBanId: e.target.value })}>
            <option value="">— Không —</option>
            {phongBan.map((p) => <option key={p.id} value={p.id}>{p.ten_phong_ban}</option>)}
          </Select>
        </Field>
        <Field label="Vai trò">
          <Select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
            <option value="">— Không —</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.ten_role}</option>)}
          </Select>
        </Field>
        {modal?.type === 'checkpoint' && (
          <Field label="Bắt buộc xác nhận">
            <button type="button" onClick={() => setForm({ ...form, batBuoc: !form.batBuoc })}
              className={`h-11 w-full rounded-input border text-sm font-medium ${form.batBuoc ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft'}`}>
              {form.batBuoc ? 'Bắt buộc' : 'Không bắt buộc'}
            </button>
          </Field>
        )}
        <p className="text-xs text-ink-soft">Chọn ít nhất phòng ban hoặc vai trò.</p>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
