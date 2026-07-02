import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import { Field, Input, Select, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  listCheckpoints, createCheckpoint, updateCheckpoint, setCheckpointActive, listLoaiCheckpoint,
} from '../../../services/wfconfigService';

const empty = { maCheckpoint: '', tenCheckpoint: '', loaiCheckpointId: '', batBuoc: false, thuTu: '', cauHinhJson: '', moTa: '', thoiGianQuyDinhPhut: '', canhBaoTruocPhut: '' };

export default function CheckpointPanel({ tram, onClose }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('WORKFLOW_MANAGE');

  const [rows, setRows] = useState([]);
  const [loai, setLoai] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await listCheckpoints(tram.id)).data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [tram.id, show]);

  useEffect(() => { load(); listLoaiCheckpoint().then((r) => setLoai(r.data)).catch(() => {}); }, [load]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      maCheckpoint: c.ma_checkpoint, tenCheckpoint: c.ten_checkpoint, loaiCheckpointId: c.loai_checkpoint_id || '',
      batBuoc: c.bat_buoc, thuTu: c.thu_tu ?? '', moTa: c.mo_ta || '',
      thoiGianQuyDinhPhut: c.thoi_gian_quy_dinh_phut ?? '', canhBaoTruocPhut: c.canh_bao_truoc_phut ?? '',
      cauHinhJson: c.cau_hinh_json ? (typeof c.cau_hinh_json === 'string' ? c.cau_hinh_json : JSON.stringify(c.cau_hinh_json)) : '',
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form, tramId: tram.id,
        thuTu: form.thuTu === '' ? null : Number(form.thuTu),
        thoiGianQuyDinhPhut: form.thoiGianQuyDinhPhut === '' ? null : Number(form.thoiGianQuyDinhPhut),
        canhBaoTruocPhut: form.canhBaoTruocPhut === '' ? null : Number(form.canhBaoTruocPhut),
      };
      if (editing) { await updateCheckpoint(editing.id, body); show('Đã cập nhật checklist'); }
      else { await createCheckpoint(body); show('Đã tạo checklist'); }
      setOpen(false); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const toggle = async (c) => {
    try { await setCheckpointActive(c.id, !c.dang_hoat_dong); show('Đã cập nhật'); load(); }
    catch (e) { show(e.message || 'Thất bại', 'error'); }
  };

  return (
    <SidePanel open onClose={onClose} title={`Checklist — ${tram.ma_tram}`} subtitle={tram.ten_tram} width="max-w-xl"
      footer={canManage && <Button icon="settings" onClick={openCreate}>Thêm checklist</Button>}>
      {loading ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-ink-soft">Chưa có checklist.</p>}
          {rows.map((c) => (
            <div key={c.id} className="rounded-control border border-line p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-ink">{c.ma_checkpoint}</span>
                  {c.loai_checkpoint && <Badge tone="info">{c.loai_checkpoint}</Badge>}
                  {c.bat_buoc && <Badge tone="warning">Bắt buộc</Badge>}
                  {!c.dang_hoat_dong && <Badge tone="danger">Tắt</Badge>}
                </div>
                <span className="text-xs text-ink-soft">#{c.thu_tu ?? '—'}</span>
              </div>
              <div className="mt-0.5 text-sm text-ink">{c.ten_checkpoint}</div>
              {c.thoi_gian_quy_dinh_phut != null && (
                <div className="mt-0.5 text-xs text-ink-soft">
                  SLA {c.thoi_gian_quy_dinh_phut}′{c.canh_bao_truoc_phut != null ? ` · cảnh báo trước ${c.canh_bao_truoc_phut}′` : ''}
                </div>
              )}
              {canManage && (
                <div className="mt-2 flex gap-1.5">
                  <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => openEdit(c)}>Sửa</Button>
                  <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => toggle(c)}>{c.dang_hoat_dong ? 'Tắt' : 'Bật'}</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Sửa checklist' : 'Thêm checklist'}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={save} loading={saving} disabled={!form.maCheckpoint || !form.tenCheckpoint}>Lưu</Button>
        </>}>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Mã checklist" required>
            <Input value={form.maCheckpoint} disabled={!!editing} onChange={(e) => setForm({ ...form, maCheckpoint: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Loại">
            <Select value={form.loaiCheckpointId} onChange={(e) => setForm({ ...form, loaiCheckpointId: e.target.value })}>
              <option value="">— Chọn —</option>
              {loai.map((l) => <option key={l.id} value={l.id}>{l.ma_loai}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Tên checklist" required>
          <Input value={form.tenCheckpoint} onChange={(e) => setForm({ ...form, tenCheckpoint: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Thứ tự">
            <Input type="number" value={form.thuTu} onChange={(e) => setForm({ ...form, thuTu: e.target.value })} />
          </Field>
          <Field label="Bắt buộc">
            <button type="button" onClick={() => setForm({ ...form, batBuoc: !form.batBuoc })}
              className={`h-11 w-full rounded-input border text-sm font-medium ${form.batBuoc ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft'}`}>
              {form.batBuoc ? 'Bắt buộc' : 'Không bắt buộc'}
            </button>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="SLA (phút)">
            <Input type="number" value={form.thoiGianQuyDinhPhut} onChange={(e) => setForm({ ...form, thoiGianQuyDinhPhut: e.target.value })} />
          </Field>
          <Field label="Cảnh báo trước (phút)">
            <Input type="number" value={form.canhBaoTruocPhut} onChange={(e) => setForm({ ...form, canhBaoTruocPhut: e.target.value })} />
          </Field>
        </div>
        <Field label="Cấu hình JSON" hint='vd: {"options":["A","B"]}'>
          <Textarea rows={2} value={form.cauHinhJson} onChange={(e) => setForm({ ...form, cauHinhJson: e.target.value })} />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </SidePanel>
  );
}
