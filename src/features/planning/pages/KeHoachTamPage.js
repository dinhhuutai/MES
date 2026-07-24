import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import SidePanel from '../../../components/common/SidePanel';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import { Field, Input } from '../../../components/common/controls';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listKeHoachTam, confirmKeHoachTam, updateKeHoachTam, deleteKeHoachTam, listChuyen } from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

// timestamptz → 'YYYY-MM-DD' cho ô <input type="date"> (ngày local).
const toDateInput = (t) => {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const hhmm = (t) => {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Màn "Kế hoạch tạm": bản nháp chuyền/giờ/ngày cho phần in CHƯA Ready. Khi phần in Ready xong (QA xác nhận)
// → bấm "Xác nhận Release 1" (dùng lại chuyền/giờ/ngày đã lưu, không chọn lại).
export default function KeHoachTamPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canDo = can('RELEASE1') || can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [scanOpen, setScanOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { ids:[], label } — xác nhận Release 1 (1 hoặc nhiều)
  const [del, setDel] = useState(null); // { id, label }
  const [saving, setSaving] = useState(false);
  const [chuyen, setChuyen] = useState([]);
  const [edit, setEdit] = useState(null); // dòng đang sửa
  const [editForm, setEditForm] = useState({ chuyenId: '', soLuongRelease: '', ngayKeHoach: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listKeHoachTam({ search, limit: 500 });
      setRows(res.data.items);
      setMeta(res.data.meta || { total: res.data.items.length });
      setSelected(new Set());
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);

  const openEdit = (r) => {
    setEdit(r);
    setEditForm({
      chuyenId: r.chuyen_id || '',
      soLuongRelease: r.so_luong != null ? String(r.so_luong) : '',
      ngayKeHoach: toDateInput(r.ngay_ke_hoach),
    });
  };

  const doSaveEdit = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await updateKeHoachTam(edit.id, {
        chuyenId: editForm.chuyenId || null,
        soLuong: editForm.soLuongRelease ? Number(editForm.soLuongRelease) : null,
        ngayKeHoach: editForm.ngayKeHoach || null,
      });
      show(`Đã cập nhật kế hoạch tạm ${edit.ma_phan || ''}`);
      setEdit(null);
      load();
    } catch (e) {
      show(e.message || 'Cập nhật thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Chỉ phần in ĐÃ Ready (qc_done) mới xác nhận Release 1 được → chỉ những dòng này chọn được.
  const readyRows = rows.filter((r) => r.qc_done);
  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = readyRows.length > 0 && readyRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(readyRows.map((r) => r.id))));

  const doConfirm = async () => {
    if (!confirm) return;
    setSaving(true);
    let okCount = 0; let failCount = 0;
    for (const id of confirm.ids) {
      try { await confirmKeHoachTam(id); okCount += 1; } catch (_) { failCount += 1; }
    }
    setSaving(false);
    setConfirm(null);
    show(failCount ? `Đã xác nhận Release 1 ${okCount} phần in, ${failCount} lỗi` : `Đã xác nhận Release 1 ${okCount} phần in`,
      failCount ? 'error' : 'success');
    load();
  };

  const doDelete = async () => {
    if (!del) return;
    setSaving(true);
    try {
      await deleteKeHoachTam(del.id);
      show(`Đã xóa kế hoạch tạm ${del.label}`);
      setDel(null);
      load();
    } catch (e) {
      show(e.message || 'Xóa thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    ...(canDo ? [{ key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)} disabled={!r.qc_done}
          onClick={(e) => e.stopPropagation()} onChange={() => toggleOne(r.id)}
          aria-label="Chọn phần in" title={r.qc_done ? '' : 'Chưa Ready — chưa xác nhận Release 1 được'} />
      ) }] : []),
    { key: 'trang_thai', header: 'Tình trạng', render: (r) => (
      r.qc_done ? <Badge tone="success">Đã Ready</Badge> : <Badge tone="warning">Chờ Ready</Badge>
    ) },
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => r.ma_phan || '—' },
    { key: 'ten_khach_hang', header: 'Khách hàng', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'so_luong', header: 'SL', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'ten_chuyen', header: 'Chuyền (dự kiến)', render: (r) => r.ten_chuyen || '—' },
    { key: 'ngay_ke_hoach', header: 'Ngày KH', render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'gio', header: 'Giờ BD–KT', render: (r) => (r.tg_bd_kh || r.tg_kt_kh ? `${hhmm(r.tg_bd_kh) || '—'}–${hhmm(r.tg_kt_kh) || '—'}` : '—') },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    ...(canDo ? [{ key: 'act', header: '', className: 'text-right whitespace-nowrap', render: (r) => (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" icon="check" disabled={!r.qc_done}
          onClick={(e) => { e.stopPropagation(); setConfirm({ ids: [r.id], label: r.ma_phan }); }}>
          Xác nhận Release 1
        </Button>
        <Button size="sm" variant="ghost" icon="trash-2"
          onClick={(e) => { e.stopPropagation(); setDel({ id: r.id, label: r.ma_phan }); }} aria-label="Xóa"
          title="Xóa kế hoạch tạm — đợt vải quay lại Release 1" />
      </div>
    ) }] : []),
  ];

  return (
    <div>
      <Toolbar title="Kế hoạch tạm" subtitle="Bản kế hoạch sớm cho phần in CHƯA Ready. Khi phần in Ready xong (QA xác nhận) → bấm 'Xác nhận Release 1' (dùng lại chuyền/giờ/ngày đã lưu)"
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm code phần, mã hàng, màu, khách...">
        {canDo && (
          <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR code phần</Button>
        )}
        {canDo && selected.size > 0 && (
          <Button onClick={() => setConfirm({ ids: [...selected], label: `${selected.size} phần in` })}>
            Xác nhận Release 1 ({selected.size})
          </Button>
        )}
        <Badge tone="info">{meta.total || rows.length} bản</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} sttStart={0}
        onRowClick={(r) => openEdit(r)}
        emptyText="Chưa có kế hoạch tạm nào" />

      <ScanCollectModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Quét QR code phần — Kế hoạch tạm"
        help="Quét QR code phần (hoặc mã vạch) để chọn các bản kế hoạch tạm ĐÃ Ready của phần in đó. Quét nhiều rồi bấm Xác nhận Release 1 cùng lúc."
        rows={readyRows}
        getId={(r) => r.id}
        getCodes={(r) => [r.ma_phan]}
        getBarcodes={(r) => [r.barcode]}
        matchMultiple
        isSelected={(r) => selected.has(r.id)}
        onToggle={(r) => toggleOne(r.id)}
        primaryLabel={(r) => r.ma_phan || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.mau_vai, r.ma_hang].filter(Boolean).join(' · ')}
        onConfirm={() => { setScanOpen(false); setConfirm({ ids: [...selected], label: `${selected.size} phần in` }); }}
        confirmLabel="Xác nhận Release 1"
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        loading={saving}
        title="Xác nhận Release 1"
        confirmText="Xác nhận Release 1"
        message={confirm ? `Xác nhận Release 1 cho ${confirm.label} theo chuyền/giờ/ngày đã lập kế hoạch tạm?` : ''}
      />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={doDelete}
        loading={saving}
        variant="danger"
        title="Xóa kế hoạch tạm"
        confirmText="Xóa"
        message={del ? `Xóa bản kế hoạch tạm của ${del.label}?` : ''}
      />

      {/* SidePanel chỉnh sửa kế hoạch tạm (chuyền / SL release / ngày kế hoạch) — như bên Release 1 */}
      <SidePanel
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `Sửa kế hoạch tạm — ${edit.ma_phan || ''}` : 'Chỉnh sửa kế hoạch tạm'}
        subtitle={edit ? `${edit.ten_khach_hang || ''} · ${edit.mau_vai || ''}` : ''}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>Đóng</Button>
            <Button onClick={doSaveEdit} loading={saving} disabled={!editForm.chuyenId}>Lưu</Button>
          </>
        )}
      >
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="Khách hàng" value={edit.ten_khach_hang} />
              <Info label="Đơn hàng" value={edit.ma_don_hang} />
              <Info label="Mã hàng" value={edit.ma_hang} />
              <Info label="Code phần" value={edit.ma_phan} />
              <Info label="Màu vải" value={edit.mau_vai} />
              <Info label="Đợt vải" value={edit.ma_dot_vai} />
              <Info label="SL nhận vải" value={fmtNum(edit.so_luong_vai_ve)} />
              <Info label="Hạn giao" value={fmtDate(edit.han_giao_hang)} />
            </div>
            <div className="space-y-3 border-t border-line pt-4">
              <Field label="Chuyền in" required>
                <ChuyenPicker chuyen={chuyen} value={editForm.chuyenId} onChange={(id) => setEditForm((f) => ({ ...f, chuyenId: id }))} />
              </Field>
              <div className="grid grid-cols-2 gap-x-4">
                <Field label="Số lượng release" hint={edit.so_luong_vai_ve != null ? `SL nhận vải ${fmtNum(edit.so_luong_vai_ve)}` : undefined}>
                  <Input type="number" min="1" max={edit.so_luong_vai_ve || undefined}
                    value={editForm.soLuongRelease} onChange={(e) => setEditForm((f) => ({ ...f, soLuongRelease: e.target.value }))} />
                </Field>
                <Field label="Ngày kế hoạch">
                  <Input type="date" value={editForm.ngayKeHoach} onChange={(e) => setEditForm((f) => ({ ...f, ngayKeHoach: e.target.value }))} />
                </Field>
              </div>
              <p className="text-xs text-ink-soft">Giờ bắt đầu/kết thúc kế hoạch giữ nguyên như đã lập.</p>
            </div>
          </div>
        )}
      </SidePanel>

      <Toast toast={toast} />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{value || '—'}</div>
    </div>
  );
}
