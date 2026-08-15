import React, { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import { listToIn, createToIn, updateToIn, toggleToIn } from '../../../services/productionService';

// Danh mục TỔ IN (mig 084) — ô chọn ở khối "Phân công" trong sidebar màn Xác nhận chạy.
// Cùng khuôn với `LyDoNgungChuyenPage` / `BienPhapXuLyPage` để các trang danh mục thao tác giống hệt nhau.
//
// ⚠⚠ `ma_to` được GỬI THẲNG lên ERP qua tham số `@pToin NVARCHAR(20)` của proc `MES_spr_MES2SF0`
//    (chiều đẩy mỗi lần in tem, mig 082) ⇒ giới hạn 20 ký tự là RÀNG BUỘC CỦA ERP, không phải cho
//    đẹp: dài hơn thì ERP ném "String or binary data would be truncated" và lượt báo in tem hỏng.
//    Mã cũng phải khớp mã tổ bên ERP thì đối soát 2 bên mới ăn khớp.
// ⚠ `ma_to` KHÔNG đổi được sau khi tạo — các phiếu sản xuất cũ tham chiếu theo id, nhưng mã là thứ
//   ERP nhận nên đổi mã sẽ làm lệch dữ liệu đã đẩy sang bên đó.
export default function ToInPage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);   // null = đóng; {id?, maTo, tenTo, moTa}
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listToIn({ search, all: '1' });
      setRows(res.data || []);
    } catch (e) { show(e.message || 'Không tải được danh mục', 'error'); }
    setLoading(false);
    // ⚠ deps là `show` (ổn định nhờ useCallback([]) trong useToast) — KHÔNG để cả object `useToast()`
    // vào đây: nó là object mới mỗi render ⇒ useEffect chạy lại vô hạn, bắn request không ngừng.
  }, [search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const doSave = async () => {
    setSaving(true);
    try {
      if (form.id) await updateToIn(form.id, { tenTo: form.tenTo, moTa: form.moTa });
      else await createToIn({ maTo: form.maTo, tenTo: form.tenTo, moTa: form.moTa });
      show(form.id ? 'Đã cập nhật' : 'Đã thêm tổ in');
      setForm(null); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    setSaving(false);
  };

  const doToggle = async (r) => {
    try { await toggleToIn(r.id, !r.dang_hoat_dong); load(); }
    catch (e) { show(e.message || 'Cập nhật thất bại', 'error'); }
  };

  // ⚠⚠ `DataTable` đọc **`c.key`** để lấy giá trị ô (`row[c.key]`) — KHÔNG có `col`, cũng KHÔNG có
  //   `center`. Khai `col:` thì cột hiện RỖNG mà không báo lỗi gì. Căn giữa dùng `className`.
  const columns = [
    { key: 'ma_to', header: 'Mã tổ', render: (r) => <span className="font-mono text-xs">{r.ma_to}</span> },
    { key: 'ten_to', header: 'Tên tổ in', className: 'font-medium text-ink' },
    { key: 'mo_ta', header: 'Mô tả', render: (r) => <span className="text-xs text-ink-soft">{r.mo_ta || '—'}</span> },
    {
      key: 'dang_hoat_dong',
      header: 'Trạng thái',
      className: 'text-center',
      headerClassName: 'text-center',
      render: (r) => (r.dang_hoat_dong
        ? <Badge tone="success">Đang dùng</Badge> : <Badge tone="default">Ngừng dùng</Badge>),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" icon="pencil" className="px-2.5 py-1 text-xs"
            onClick={(e) => { e.stopPropagation(); setForm({ id: r.id, maTo: r.ma_to, tenTo: r.ten_to, moTa: r.mo_ta || '' }); }}>
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
      <Toolbar title="Danh mục tổ in"
        subtitle="Hiện trong ô chọn “Tổ in” ở khối Phân công (sidebar màn Xác nhận chạy) và gửi lên ERP mỗi lần in tem"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã hoặc tên tổ...">
        <Button icon="plus" onClick={() => setForm({ maTo: '', tenTo: '', moTa: '' })}>Thêm tổ in</Button>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có tổ in nào" />

      <p className="mt-3 text-xs text-ink-soft">
        Tổ đặt <b>Ngừng dùng</b> sẽ không còn hiện trong ô chọn ở màn Sản xuất, nhưng các phiếu đã gán
        tổ đó trước đây vẫn giữ nguyên. <b>Mã tổ</b> được gửi thẳng sang ERP (tối đa 20 ký tự) — nên
        đặt đúng bằng mã tổ bên ERP để hai bên đối soát được.
      </p>

      <Modal open={!!form} onClose={() => setForm(null)}
        title={form?.id ? 'Sửa tổ in' : 'Thêm tổ in'}
        footer={<>
          <Button variant="ghost" onClick={() => setForm(null)}>Hủy</Button>
          <Button loading={saving} onClick={doSave}
            disabled={!form?.tenTo?.trim() || (!form?.id && !form?.maTo?.trim())}>Lưu</Button>
        </>}>
        {form && (
          <>
            <Field label="Mã tổ" required={!form.id}
              hint={form.id ? 'Không đổi được mã sau khi tạo (ERP đã nhận mã này)' : 'Tối đa 20 ký tự, gửi thẳng lên ERP — vd C1'}>
              <Input value={form.maTo} disabled={!!form.id} maxLength={20}
                onChange={(e) => setForm({ ...form, maTo: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Tên tổ" required>
              <Input value={form.tenTo} onChange={(e) => setForm({ ...form, tenTo: e.target.value })} />
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
