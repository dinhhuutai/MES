import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useVersions from '../../../hooks/useVersions';
import { listRules, createRule, updateRule, setRuleActive, tramOptions } from '../../../services/wfconfigService';
import ConditionPanel from '../components/ConditionPanel';

const empty = { tuTramId: '', denTramId: '', choPhepOverride: false, batBuocDatHetDk: true, moTa: '' };

export default function DieuKienPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('WORKFLOW_MANAGE');
  const { versions, versionId, setVersionId } = useVersions();

  const [rows, setRows] = useState([]);
  const [trams, setTrams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [condRule, setCondRule] = useState(null);

  const load = useCallback(async () => {
    if (!versionId) return;
    setLoading(true);
    try {
      const [r, t] = await Promise.all([listRules(versionId), tramOptions(versionId)]);
      setRows(r.data); setTrams(t.data);
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [versionId, show]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ tuTramId: r.tu_tram_id || '', denTramId: r.den_tram_id || '', choPhepOverride: r.cho_phep_override, batBuocDatHetDk: r.bat_buoc_dat_het_dk, moTa: r.mo_ta || '' });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) { await updateRule(editing.id, form); show('Đã cập nhật luật'); }
      else { await createRule({ ...form, versionId }); show('Đã tạo luật chuyển trạm'); }
      setOpen(false); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const toggle = async (r) => {
    try { await setRuleActive(r.id, !r.dang_hoat_dong); show('Đã cập nhật'); load(); }
    catch (e) { show(e.message || 'Thất bại', 'error'); }
  };

  const columns = [
    { key: 'chuyen', header: 'Chuyển trạm', render: (r) => <span className="font-medium text-ink">{r.tu_tram || '?'} → {r.den_tram || '?'}</span> },
    { key: 'cho_phep_override', header: 'Override', render: (r) => r.cho_phep_override ? <Badge tone="warning">Cho phép</Badge> : <Badge tone="default">Không</Badge> },
    { key: 'bat_buoc_dat_het_dk', header: 'Đạt hết ĐK', render: (r) => r.bat_buoc_dat_het_dk ? <Badge tone="info">Bắt buộc</Badge> : '—' },
    { key: 'so_dieu_kien', header: 'Điều kiện', render: (r) => <Badge tone="default">{r.so_dieu_kien}</Badge> },
    { key: 'dang_hoat_dong', header: 'Trạng thái', render: (r) => r.dang_hoat_dong ? <Badge tone="success">Bật</Badge> : <Badge tone="danger">Tắt</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <Button variant="secondary" className="px-3 py-1.5" onClick={() => setCondRule(r)}>Điều kiện</Button>
        {canManage && <Button variant="ghost" className="px-3 py-1.5" onClick={() => openEdit(r)}>Sửa</Button>}
        {canManage && <Button variant="ghost" className="px-3 py-1.5" onClick={() => toggle(r)}>{r.dang_hoat_dong ? 'Tắt' : 'Bật'}</Button>}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Điều kiện chuyển trạm" subtitle="Luật chuyển trạm và điều kiện qua trạm">
        {canManage && <Button icon="settings" onClick={openCreate} disabled={!versionId}>Thêm luật</Button>}
      </Toolbar>

      <div className="mb-4 max-w-xs">
        <Select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
          {versions.map((v) => <option key={v.id} value={v.id}>{v.ma_version} — {v.ten_version}{v.la_hien_hanh ? ' (hiện hành)' : ''}</option>)}
        </Select>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có luật chuyển trạm" />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Sửa luật chuyển trạm' : 'Thêm luật chuyển trạm'}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={save} loading={saving} disabled={!form.tuTramId || !form.denTramId}>Lưu</Button>
        </>}>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Từ trạm" required>
            <Select value={form.tuTramId} disabled={!!editing} onChange={(e) => setForm({ ...form, tuTramId: e.target.value })}>
              <option value="">— Chọn —</option>
              {trams.map((t) => <option key={t.id} value={t.id}>{t.ma_tram}</option>)}
            </Select>
          </Field>
          <Field label="Đến trạm" required>
            <Select value={form.denTramId} disabled={!!editing} onChange={(e) => setForm({ ...form, denTramId: e.target.value })}>
              <option value="">— Chọn —</option>
              {trams.map((t) => <option key={t.id} value={t.id}>{t.ma_tram}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Cho phép override">
          <button type="button" onClick={() => setForm({ ...form, choPhepOverride: !form.choPhepOverride })}
            className={`h-11 w-full rounded-input border text-sm font-medium ${form.choPhepOverride ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft'}`}>
            {form.choPhepOverride ? 'Cho phép override' : 'Không cho phép'}
          </button>
        </Field>
        <Field label="Bắt buộc đạt hết điều kiện">
          <button type="button" onClick={() => setForm({ ...form, batBuocDatHetDk: !form.batBuocDatHetDk })}
            className={`h-11 w-full rounded-input border text-sm font-medium ${form.batBuocDatHetDk ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft'}`}>
            {form.batBuocDatHetDk ? 'Bắt buộc' : 'Không bắt buộc'}
          </button>
        </Field>
      </Modal>

      {condRule && <ConditionPanel rule={condRule} onClose={() => { setCondRule(null); load(); }} />}
      <Toast toast={toast} />
    </div>
  );
}
