import React, { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import {
  listBienPhap, createBienPhap, updateBienPhap, toggleBienPhap,
} from '../../../services/phanLoaiLoiService';

// Danh mục BIỆN PHÁP XỬ LÝ (mig 075) — dropdown trong bảng nhập của trang Phân loại lỗi.
// Cùng khuôn với `LoaiLoiPage` (danh mục lỗi) để 2 trang thao tác giống nhau.
export default function BienPhapXuLyPage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);   // null = đóng; {id?, maBienPhap, tenBienPhap, moTa}
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listBienPhap({ search, all: '1' });
      setRows(res.data || []);
    } catch (e) { show(e.message || 'Không tải được danh mục', 'error'); }
    setLoading(false);
  }, [search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const doSave = async () => {
    setSaving(true);
    try {
      if (form.id) await updateBienPhap(form.id, { tenBienPhap: form.tenBienPhap, moTa: form.moTa });
      else await createBienPhap({ maBienPhap: form.maBienPhap, tenBienPhap: form.tenBienPhap, moTa: form.moTa });
      show(form.id ? 'Đã cập nhật' : 'Đã thêm biện pháp');
      setForm(null); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    setSaving(false);
  };

  const doToggle = async (r) => {
    try { await toggleBienPhap(r.id, !r.dang_hoat_dong); load(); }
    catch (e) { show(e.message || 'Cập nhật thất bại', 'error'); }
  };

  const columns = [
    { header: 'Mã', render: (r) => <span className="font-mono text-xs">{r.ma_bien_phap}</span> },
    { header: 'Tên biện pháp', col: 'ten_bien_phap' },
    { header: 'Mô tả', render: (r) => <span className="text-xs text-ink-soft">{r.mo_ta || '—'}</span> },
    {
      header: 'Trạng thái',
      render: (r) => (r.dang_hoat_dong
        ? <Badge tone="success">Đang dùng</Badge> : <Badge tone="default">Ngừng dùng</Badge>),
      center: true,
    },
    {
      header: '',
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" icon="pencil" className="px-2.5 py-1 text-xs"
            onClick={(e) => { e.stopPropagation(); setForm({ id: r.id, maBienPhap: r.ma_bien_phap, tenBienPhap: r.ten_bien_phap, moTa: r.mo_ta || '' }); }}>
            Sửa
          </Button>
          <Button variant="ghost" className="px-2.5 py-1 text-xs"
            onClick={(e) => { e.stopPropagation(); doToggle(r); }}>
            {r.dang_hoat_dong ? 'Ngừng' : 'Dùng lại'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Toolbar title="Danh mục biện pháp xử lý"
        subtitle="Dùng cho cột “Biện pháp xử lý” ở trang Phân loại lỗi"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã hoặc tên biện pháp...">
        <Button icon="plus" onClick={() => setForm({ maBienPhap: '', tenBienPhap: '', moTa: '' })}>Thêm biện pháp</Button>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có biện pháp nào" />

      <Modal open={!!form} onClose={() => setForm(null)}
        title={form?.id ? 'Sửa biện pháp xử lý' : 'Thêm biện pháp xử lý'}
        footer={<>
          <Button variant="ghost" onClick={() => setForm(null)}>Hủy</Button>
          <Button loading={saving} onClick={doSave}
            disabled={!form?.tenBienPhap?.trim() || (!form?.id && !form?.maBienPhap?.trim())}>Lưu</Button>
        </>}>
        {form && (
          <>
            <Field label="Mã biện pháp" required={!form.id} hint={form.id ? 'Không đổi được mã sau khi tạo' : 'Chữ HOA, số và gạch dưới — vd IN_LAI'}>
              <Input value={form.maBienPhap} disabled={!!form.id}
                onChange={(e) => setForm({ ...form, maBienPhap: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Tên biện pháp" required>
              <Input value={form.tenBienPhap} onChange={(e) => setForm({ ...form, tenBienPhap: e.target.value })} />
            </Field>
            <Field label="Mô tả">
              <Textarea rows={2} value={form.moTa} onChange={(e) => setForm({ ...form, moTa: e.target.value })} />
            </Field>
          </>
        )}
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
