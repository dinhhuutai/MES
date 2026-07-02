import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import { Field, Input, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listConditions, createCondition, deleteCondition } from '../../../services/wfconfigService';

const empty = { tenDieuKien: '', loaiDieuKien: '', nguonDuLieu: '', phepSoSanh: '=', giaTriDieuKien: '', batBuoc: true, thuTu: '' };

export default function ConditionPanel({ rule, onClose }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('WORKFLOW_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await listConditions(rule.id)).data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [rule.id, show]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await createCondition({ ...form, ruleId: rule.id, thuTu: form.thuTu === '' ? null : Number(form.thuTu) });
      show('Đã thêm điều kiện'); setOpen(false); setForm(empty); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    try { await deleteCondition(del.id); show('Đã xóa điều kiện'); setDel(null); load(); }
    catch (e) { show(e.message || 'Xóa thất bại (cần grant DELETE — migration 011)', 'error'); setDel(null); }
  };

  return (
    <SidePanel open onClose={onClose} title={`Điều kiện — ${rule.tu_tram} → ${rule.den_tram}`} width="max-w-xl"
      footer={canManage && <Button icon="settings" onClick={() => { setForm(empty); setOpen(true); }}>Thêm điều kiện</Button>}>
      {loading ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-ink-soft">Chưa có điều kiện. Checkpoint này chuyển không ràng buộc.</p>}
          {rows.map((c) => (
            <div key={c.id} className="rounded-control border border-line p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">{c.ten_dieu_kien}</span>
                {c.bat_buoc && <Badge tone="warning">Bắt buộc</Badge>}
              </div>
              <div className="mt-1 font-mono text-xs text-ink-soft">
                {c.nguon_du_lieu || '?'} {c.phep_so_sanh || ''} {c.gia_tri_dieu_kien || ''}
              </div>
              {canManage && (
                <Button variant="ghost" className="mt-2 px-2.5 py-1 text-xs text-danger" onClick={() => setDel(c)}>Xóa</Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm điều kiện"
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={save} loading={saving} disabled={!form.tenDieuKien}>Lưu</Button>
        </>}>
        <Field label="Tên điều kiện" required>
          <Input value={form.tenDieuKien} onChange={(e) => setForm({ ...form, tenDieuKien: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Loại điều kiện">
            <Input value={form.loaiDieuKien} onChange={(e) => setForm({ ...form, loaiDieuKien: e.target.value })} />
          </Field>
          <Field label="Nguồn dữ liệu" hint="vd: checkpoint.QC_XAC_NHAN">
            <Input value={form.nguonDuLieu} onChange={(e) => setForm({ ...form, nguonDuLieu: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Phép so sánh">
            <Select value={form.phepSoSanh} onChange={(e) => setForm({ ...form, phepSoSanh: e.target.value })}>
              {['=', '!=', '>', '>=', '<', '<=', 'IN'].map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Giá trị">
            <Input value={form.giaTriDieuKien} onChange={(e) => setForm({ ...form, giaTriDieuKien: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={doDelete} variant="danger"
        title="Xóa điều kiện" message={del ? `Xóa điều kiện "${del.ten_dieu_kien}"?` : ''} confirmText="Xóa" />
      <Toast toast={toast} />
    </SidePanel>
  );
}
