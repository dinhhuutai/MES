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
  listLyDoNgung, createLyDoNgung, updateLyDoNgung, toggleLyDoNgung,
} from '../../../services/productionService';

// Danh mục LÝ DO NGỪNG CHUYỀN (mig 076) — dropdown ở khối "Ngừng chuyền" trong sidebar màn Xác nhận chạy.
// Cùng khuôn với `BienPhapXuLyPage` / `LoaiLoiPage` để các trang danh mục thao tác giống hệt nhau.
// ⚠ `ma_ly_do` KHÔNG đổi được sau khi tạo — bản ghi ngừng chuyền cũ tham chiếu theo id, nhưng mã là thứ
//   người dùng đọc trong báo cáo nên đổi mã sẽ làm lệch cách hiểu số liệu cũ.
export default function LyDoNgungChuyenPage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);   // null = đóng; {id?, maLyDo, tenLyDo, moTa}
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listLyDoNgung({ search, all: '1' });
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
      if (form.id) await updateLyDoNgung(form.id, { tenLyDo: form.tenLyDo, moTa: form.moTa });
      else await createLyDoNgung({ maLyDo: form.maLyDo, tenLyDo: form.tenLyDo, moTa: form.moTa });
      show(form.id ? 'Đã cập nhật' : 'Đã thêm lý do');
      setForm(null); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    setSaving(false);
  };

  const doToggle = async (r) => {
    try { await toggleLyDoNgung(r.id, !r.dang_hoat_dong); load(); }
    catch (e) { show(e.message || 'Cập nhật thất bại', 'error'); }
  };

  // ⚠⚠ `DataTable` đọc **`c.key`** để lấy giá trị ô (`row[c.key]`) — KHÔNG có `col`, cũng KHÔNG có
  //   `center`. Khai `col:` thì cột hiện RỖNG mà không báo lỗi gì (đã mắc thật ở trang này +
  //   `BienPhapXuLyPage` + 4 cột của `PhanLoaiLoiPage`). Căn giữa thì dùng `className`/`headerClassName`.
  //   Mọi cột PHẢI có `key` — nó cũng là React key của `<th>/<td>`.
  const columns = [
    { key: 'ma_ly_do', header: 'Mã', render: (r) => <span className="font-mono text-xs">{r.ma_ly_do}</span> },
    { key: 'ten_ly_do', header: 'Lý do ngừng chuyền', className: 'font-medium text-ink' },
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
            onClick={(e) => { e.stopPropagation(); setForm({ id: r.id, maLyDo: r.ma_ly_do, tenLyDo: r.ten_ly_do, moTa: r.mo_ta || '' }); }}>
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
      <Toolbar title="Danh mục lý do ngừng chuyền"
        subtitle="Hiện trong ô chọn “Lý do ngừng” ở sidebar màn Xác nhận chạy"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã hoặc tên lý do...">
        <Button icon="plus" onClick={() => setForm({ maLyDo: '', tenLyDo: '', moTa: '' })}>Thêm lý do</Button>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyText="Chưa có lý do nào" />

      <p className="mt-3 text-xs text-ink-soft">
        Lý do đặt <b>Ngừng dùng</b> sẽ không còn hiện trong ô chọn ở màn Sản xuất, nhưng các lần ngừng
        chuyền đã ghi trước đó vẫn giữ nguyên lý do cũ.
      </p>

      <Modal open={!!form} onClose={() => setForm(null)}
        title={form?.id ? 'Sửa lý do ngừng chuyền' : 'Thêm lý do ngừng chuyền'}
        footer={<>
          <Button variant="ghost" onClick={() => setForm(null)}>Hủy</Button>
          <Button loading={saving} onClick={doSave}
            disabled={!form?.tenLyDo?.trim() || (!form?.id && !form?.maLyDo?.trim())}>Lưu</Button>
        </>}>
        {form && (
          <>
            <Field label="Mã lý do" required={!form.id} hint={form.id ? 'Không đổi được mã sau khi tạo' : 'Chữ HOA, số và gạch dưới — vd HET_MUC'}>
              <Input value={form.maLyDo} disabled={!!form.id}
                onChange={(e) => setForm({ ...form, maLyDo: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Tên lý do" required>
              <Input value={form.tenLyDo} onChange={(e) => setForm({ ...form, tenLyDo: e.target.value })} />
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
