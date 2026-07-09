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
import {
  listChuyen, createChuyen, updateChuyen, setChuyenActive, listLoaiChuyen, createLoaiChuyen,
} from '../../../services/chuyenService';

const empty = { maChuyen: '', tenChuyen: '', loaiChuyenId: '', dinhMucGio: '', soPass: '' };

export default function ChuyenPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('WORKFLOW_MANAGE');

  const [rows, setRows] = useState([]);
  const [loai, setLoai] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loaiModal, setLoaiModal] = useState(false);
  const [loaiForm, setLoaiForm] = useState({ maLoai: '', tenLoai: '' });

  const loadLoai = useCallback(() => { listLoaiChuyen().then((r) => setLoai(r.data)).catch(() => {}); }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await listChuyen({ search })).data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [search, show]);

  useEffect(() => { loadLoai(); }, [loadLoai]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ maChuyen: r.ma_chuyen, tenChuyen: r.ten_chuyen, loaiChuyenId: r.loai_chuyen_id || '', dinhMucGio: r.dinh_muc_gio ?? '', soPass: r.so_pass ?? '' });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, dinhMucGio: form.dinhMucGio === '' ? null : Number(form.dinhMucGio), soPass: form.soPass === '' ? null : Number(form.soPass) };
      if (editing) { await updateChuyen(editing.id, body); show('Đã cập nhật chuyền'); }
      else { await createChuyen(body); show('Đã thêm chuyền'); }
      setOpen(false); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const saveLoai = async () => {
    if (!loaiForm.maLoai || !loaiForm.tenLoai) { show('Nhập mã + tên loại', 'error'); return; }
    try {
      await createLoaiChuyen({ maLoai: loaiForm.maLoai.toUpperCase(), tenLoai: loaiForm.tenLoai });
      show('Đã thêm loại chuyền'); setLoaiModal(false); setLoaiForm({ maLoai: '', tenLoai: '' }); loadLoai();
    } catch (e) { show(e.message || 'Thất bại (cần migration 031 để cấp quyền)', 'error'); }
  };

  const toggle = async (r) => {
    try { await setChuyenActive(r.id, !r.dang_hoat_dong); show('Đã cập nhật'); load(); }
    catch (e) { show(e.message || 'Thất bại', 'error'); }
  };

  const columns = [
    { key: 'ma_chuyen', header: 'Mã chuyền', render: (r) => <Badge tone="info">{r.ma_chuyen}</Badge> },
    { key: 'ten_chuyen', header: 'Tên chuyền', className: 'font-medium text-ink' },
    { key: 'loai_ten', header: 'Loại', render: (r) => r.loai_ten ? <Badge tone="default">{r.loai_ten}</Badge> : '—' },
    { key: 'dinh_muc_gio', header: 'Định mức (cái/giờ)', className: 'text-right tabular-nums', render: (r) => r.dinh_muc_gio ?? '—' },
    { key: 'so_pass', header: 'Số pass', className: 'text-right tabular-nums', render: (r) => r.so_pass ?? '—' },
    { key: 'dang_hoat_dong', header: 'Trạng thái', render: (r) => r.dang_hoat_dong ? <Badge tone="success">Bật</Badge> : <Badge tone="danger">Tắt</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => canManage && (
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => openEdit(r)}>Sửa</Button>
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => toggle(r)}>{r.dang_hoat_dong ? 'Tắt' : 'Bật'}</Button>
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Chuyền sản xuất" subtitle="Quản lý chuyền in & loại chuyền (máy tự động, bàn, robot, logo, ép...)"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã/tên chuyền, loại...">
        {canManage && <Button variant="ghost" onClick={() => setLoaiModal(true)}>+ Loại chuyền</Button>}
        {canManage && <Button icon="settings" onClick={openCreate}>Thêm chuyền</Button>}
        <Badge tone="default">{rows.length} chuyền</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} sttStart={0} emptyText="Chưa có chuyền nào" />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Sửa chuyền' : 'Thêm chuyền'}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={save} loading={saving} disabled={!form.maChuyen || !form.tenChuyen}>Lưu</Button>
        </>}>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Mã chuyền" required>
            <Input value={form.maChuyen} disabled={!!editing} onChange={(e) => setForm({ ...form, maChuyen: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Loại chuyền">
            <Select value={form.loaiChuyenId} onChange={(e) => setForm({ ...form, loaiChuyenId: e.target.value })}>
              <option value="">— Chọn loại —</option>
              {loai.map((l) => <option key={l.id} value={l.id}>{l.ten_loai}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Tên chuyền" required>
          <Input value={form.tenChuyen} onChange={(e) => setForm({ ...form, tenChuyen: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Định mức (cái/giờ)" hint="Dùng tính tốc độ/OEE ở màn Theo dõi chuyền">
            <Input type="number" min="0" value={form.dinhMucGio} onChange={(e) => setForm({ ...form, dinhMucGio: e.target.value })} />
          </Field>
          <Field label="Số pass" hint="Số lần in/vòng — tính năng suất kế hoạch tự động">
            <Input type="number" min="1" value={form.soPass} onChange={(e) => setForm({ ...form, soPass: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal open={loaiModal} onClose={() => setLoaiModal(false)} title="Thêm loại chuyền" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setLoaiModal(false)}>Hủy</Button>
          <Button onClick={saveLoai}>Thêm</Button>
        </>}>
        <Field label="Mã loại" required>
          <Input value={loaiForm.maLoai} onChange={(e) => setLoaiForm({ ...loaiForm, maLoai: e.target.value.toUpperCase() })} placeholder="VD: LOGO, EP" />
        </Field>
        <Field label="Tên loại" required>
          <Input value={loaiForm.tenLoai} onChange={(e) => setLoaiForm({ ...loaiForm, tenLoai: e.target.value })} placeholder="VD: Logo, Ép" />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
