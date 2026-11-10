import { useCallback, useEffect, useMemo, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useChiXem from '../../../hooks/useChiXem';
import { fmtNum, fmtDateTime } from '../../../utils/format';
import { khopTungTu } from '../../../utils/timKiem';
import { listLoaiKieng, addLoaiKieng, saveLoaiKieng } from '../../../services/loaiKiengService';

// ─────────────────────────────────────────────────────────────────────────────
// HỆ THỐNG › DANH MỤC KIẾNG (mig 126, 09/11/2026) — loại kiếng chọn ở ô "Loại kiếng" khi in tem in kiếng (Sản xuất).
//   Mã hàng hóa = mã ERP (gửi kèm phiếu in tem sang ERP). Nạp sẵn 12 mã người dùng gửi. Không xóa — "Ngưng dùng" để ẩn
//   khỏi ô chọn (tem đã in vẫn giữ loại cũ). Xem: WORKFLOW_VIEW · sửa: WORKFLOW_MANAGE (như Tính chất in).
// ─────────────────────────────────────────────────────────────────────────────
const TRONG = { ma_hang_hoa: '', ten: '', dvt: '', ghi_chu: '', dang_hoat_dong: true };

export default function DanhMucKiengPage() {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const chiXem = useChiXem();
  const canEdit = can('WORKFLOW_MANAGE') && !chiXem;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null); // null = đóng · { id?, ... }
  const [dangLuu, setDangLuu] = useState(false);

  const tai = useCallback(async () => {
    try {
      const r = await listLoaiKieng({ ca: true });
      setRows(r.data || []);
    } catch (e) {
      show(e.message || 'Lỗi tải danh mục kiếng', 'error');
    } finally { setLoading(false); }
  }, [show]);
  useEffect(() => { tai(); }, [tai]);

  const hien = useMemo(() => rows.filter((r) => khopTungTu(`${r.ma_hang_hoa} ${r.ten} ${r.dvt || ''} ${r.ghi_chu || ''}`, q)), [rows, q]);

  const luu = async () => {
    if (!form.ma_hang_hoa.trim() || !form.ten.trim()) { show('Nhập mã hàng hóa và tên kiếng', 'error'); return; }
    setDangLuu(true);
    try {
      const body = { ma_hang_hoa: form.ma_hang_hoa.trim(), ten: form.ten.trim(), dvt: form.dvt.trim(), ghi_chu: form.ghi_chu.trim(), dang_hoat_dong: form.dang_hoat_dong };
      const r = form.id ? await saveLoaiKieng(form.id, body) : await addLoaiKieng(body);
      setRows(r.data || []);
      setForm(null);
      show(form.id ? 'Đã lưu loại kiếng' : 'Đã thêm loại kiếng');
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally { setDangLuu(false); }
  };

  const cols = [
    { key: 'ma_hang_hoa', header: 'Mã hàng hóa', render: (r) => <span className="font-medium tabular-nums text-ink">{r.ma_hang_hoa}</span> },
    { key: 'ten', header: 'Tên kiếng' },
    { key: 'dvt', header: 'ĐVT', render: (r) => r.dvt || '—' },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) => (r.dang_hoat_dong ? <Badge tone="success">Đang dùng</Badge> : <Badge>Ngưng dùng</Badge>) },
    { key: 'so_tem', header: 'Tem đã in', render: (r) => <span className="tabular-nums">{fmtNum(r.so_tem)}</span> },
    { key: 'ghi_chu', header: 'Ghi chú', render: (r) => r.ghi_chu || '—' },
    { key: 'sua', header: 'Sửa gần nhất', render: (r) => <span className="text-xs text-ink-soft">{[r.nguoi_sua, r.updated_date ? fmtDateTime(r.updated_date) : null].filter(Boolean).join(' · ') || '—'}</span> },
    ...(canEdit ? [{
      key: 'tt', header: '',
      render: (r) => <Button variant="ghost" icon="pencil" onClick={() => setForm({ ...TRONG, ...r, dvt: r.dvt || '', ghi_chu: r.ghi_chu || '' })}>Sửa</Button>,
    }] : []),
  ];

  return (
    <div>
      <Toolbar title="Danh mục kiếng" search={q} onSearch={setQ} searchPlaceholder="Tìm mã hàng hóa, tên kiếng...">
        {canEdit && <Button icon="plus" onClick={() => setForm({ ...TRONG })}>Thêm loại kiếng</Button>}
        <Badge tone="info">{fmtNum(hien.length)} loại</Badge>
      </Toolbar>
      <DataTable columns={cols} rows={hien} loading={loading} rowKey="id" pageSize={0}
        emptyText="Chưa có loại kiếng nào — chạy migration 126 để nạp sẵn 12 mã" />

      <Modal open={!!form} onClose={() => setForm(null)} size="sm"
        title={form?.id ? `Sửa loại kiếng ${form.ma_hang_hoa}` : 'Thêm loại kiếng'}
        footer={<>
          <Button chiXemOk variant="ghost" onClick={() => setForm(null)}>Hủy</Button>
          <Button loading={dangLuu} onClick={luu}>Lưu</Button>
        </>}>
        {form && (
          <div className="space-y-3">
            <Field label="Mã hàng hóa (ERP)" required>
              <Input value={form.ma_hang_hoa} onChange={(e) => setForm({ ...form, ma_hang_hoa: e.target.value })} placeholder="vd: 200000076" />
            </Field>
            <Field label="Tên kiếng" required>
              <Input value={form.ten} onChange={(e) => setForm({ ...form, ten: e.target.value })} placeholder="vd: Kiếng in chuyển (64*48cm)" />
            </Field>
            <Field label="Đơn vị tính">
              <Input value={form.dvt} onChange={(e) => setForm({ ...form, dvt: e.target.value })} placeholder="tấm · mét · cuộn · cái" />
            </Field>
            <Field label="Ghi chú">
              <Input value={form.ghi_chu} onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })} />
            </Field>
            {form.id && (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.dang_hoat_dong}
                  onChange={(e) => setForm({ ...form, dang_hoat_dong: e.target.checked })} />
                Đang dùng (bỏ tích = ẩn khỏi ô chọn lúc in tem, tem đã in giữ nguyên)
              </label>
            )}
          </div>
        )}
      </Modal>
      <Toast toast={toast} />
    </div>
  );
}
