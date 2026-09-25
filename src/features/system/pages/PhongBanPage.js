import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { khop } from '../../../utils/timKiem';
import { listPhongBan, updatePhongBan, updateToPhongBan } from '../../../services/phongBanService';

// PHÒNG BAN & TỔ (mig 104) — sửa TÊN phòng / tổ. Mã do nhân sự đặt, nạp bằng script, KHÔNG sửa ở đây.
// Bảng phẳng: dòng PHÒNG (in đậm) rồi các dòng TỔ thụt vào ngay dưới.
// ⚠ `DataTable` đọc `c.key` (không có `col`) — xem CLAUDE.md §8.
export default function PhongBanPage() {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const coSua = can('USER_MANAGE');
  const [data, setData] = useState({ items: [], co_bang_to: true });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);   // {loai:'PHONG'|'TO', id, ma, ten, ghiChu}
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPhongBan();
      setData(res.data || { items: [], co_bang_to: true });
    } catch (e) { show(e.message || 'Không tải được danh sách', 'error'); }
    setLoading(false);
  }, [show]);

  useEffect(() => { load(); }, [load]);

  // Dòng phòng + dòng tổ. Tìm theo mã/tên phòng HOẶC tổ: tổ khớp thì kéo luôn dòng phòng của nó.
  const rows = useMemo(() => {
    const out = [];
    (data.items || []).forEach((p) => {
      const khopPhong = !search || khop(`${p.ma_phong_ban} ${p.ten_phong_ban}`, search);
      const toKhop = (p.to_list || []).filter((t) => khopPhong || khop(`${t.ma_to} ${t.ten_to}`, search));
      if (!khopPhong && !toKhop.length) return;
      out.push({ ...p, _key: p.id, loai: 'PHONG', ma: p.ma_phong_ban, ten: p.ten_phong_ban, so_to: (p.to_list || []).length });
      toKhop.forEach((t) => out.push({ ...t, _key: t.id, loai: 'TO', ma: t.ma_to, ten: t.ten_to }));
    });
    return out;
  }, [data, search]);

  const doSave = async () => {
    setSaving(true);
    try {
      const body = { ten: form.ten, ghiChu: form.ghiChu };
      if (form.loai === 'PHONG') await updatePhongBan(form.id, body);
      else await updateToPhongBan(form.id, body);
      show('Đã lưu');
      setForm(null); load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); }
    setSaving(false);
  };

  const columns = [
    {
      key: 'ma', header: 'Mã',
      render: (r) => (r.loai === 'PHONG'
        ? <span className="font-mono text-sm font-semibold text-ink">{r.ma}</span>
        : <span className="pl-6 font-mono text-xs text-ink-soft">↳ {r.ma}</span>),
    },
    {
      key: 'ten', header: 'Tên',
      render: (r) => (
        <div className={r.loai === 'PHONG' ? 'font-semibold text-ink' : 'pl-6 text-ink'}>
          {r.ten}
          {r.ten === r.ma && <span className="ml-2 text-xs font-normal text-warning">(chưa đặt tên)</span>}
          {r.ghi_chu && <div className="text-xs font-normal text-ink-soft">{r.ghi_chu}</div>}
        </div>
      ),
    },
    {
      key: 'loai', header: 'Loại',
      render: (r) => (r.loai === 'PHONG'
        ? <Badge tone="info">Phòng · {r.so_to} tổ</Badge> : <Badge tone="default">Tổ</Badge>),
    },
    { key: 'so_nguoi', header: 'Số người', className: 'text-right', headerClassName: 'text-right' },
    {
      key: 'dang_hoat_dong', header: 'Trạng thái',
      render: (r) => (r.dang_hoat_dong ? <Badge tone="success">Đang dùng</Badge> : <Badge tone="default">Ngừng</Badge>),
    },
    {
      key: 'actions', header: '',
      render: (r) => (coSua ? (
        <div className="flex justify-end">
          <Button variant="ghost" icon="pencil" className="px-2.5 py-1 text-xs"
            onClick={(e) => { e.stopPropagation(); setForm({ loai: r.loai, id: r.id, ma: r.ma, ten: r.ten, ghiChu: r.ghi_chu || '' }); }}>
            Sửa tên
          </Button>
        </div>
      ) : null),
    },
  ];

  return (
    <div>
      <Toolbar title="Phòng ban & tổ"
        subtitle="Đặt tên cho phòng ban và các tổ trong phòng. Mã do nhân sự quy định (nạp bằng script), không đổi ở đây."
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã hoặc tên phòng / tổ..." />

      {!data.co_bang_to && (
        <div className="mb-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-ink">
          Chưa chạy migration <b>104_to_phong_ban.sql</b> — chưa có danh mục tổ. Vẫn sửa được tên phòng ban.
        </div>
      )}

      <DataTable columns={columns} rows={rows} rowKey="_key" loading={loading} pageSize={0}
        rowClassName={(r) => (r.loai === 'PHONG' ? 'bg-surface-muted/60' : '')}
        emptyText="Chưa có phòng ban nào" />

      <Modal open={!!form} onClose={() => setForm(null)}
        title={form ? `Sửa tên ${form.loai === 'PHONG' ? 'phòng ban' : 'tổ'} — ${form.ma}` : ''}
        footer={<>
          <Button chiXemOk variant="ghost" onClick={() => setForm(null)}>Hủy</Button>
          <Button loading={saving} onClick={doSave} disabled={!form?.ten?.trim()}>Lưu</Button>
        </>}>
        {form && (
          <>
            <Field label="Mã" hint="Mã do nhân sự quy định — không đổi được ở đây">
              <Input value={form.ma} disabled />
            </Field>
            <Field label={form.loai === 'PHONG' ? 'Tên phòng ban' : 'Tên tổ'} required>
              <Input value={form.ten} maxLength={255} onChange={(e) => setForm({ ...form, ten: e.target.value })} />
            </Field>
            <Field label="Ghi chú">
              <Textarea rows={2} value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} />
            </Field>
          </>
        )}
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
