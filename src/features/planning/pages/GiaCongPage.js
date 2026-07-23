import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import GiaCongHistoryPanel from '../components/GiaCongHistoryPanel';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listGiaCong, giaCongToOqc } from '../../../services/planningService';
import { printGiaCongVeTem } from '../../production/utils/printTemLabel';
import { fmtNum, fmtDate } from '../../../utils/format';

// Chuẩn hóa 1 dòng (lệnh gia công hoặc dòng lịch sử) → dữ liệu nhãn "TH VỀ" (đầu 13).
const buildVeLabel = (r) => ({
  ma_tem: r.ma_tem || r.ma_lenh_san_xuat,
  so_luong: r.so_luong_release,
  so_luong_don_hang: r.so_luong_don_hang,
  ten_khach_hang: r.ten_khach_hang,
  ma_don_hang: r.ma_don_hang,
  ma_hang: r.ma_hang,
  mau_vai: r.mau_vai,
  kich_vai: r.kich_vai,
  kich_phim: r.kich_phim,
  ten_chuyen: r.ten_chuyen,
  ma_chuyen: r.ma_chuyen,
  created_date: r.created_date,
});

// Màn "Gia công" (Kế hoạch): lệnh đã Release 1 lên chuyền gia công đang chờ nhận lại → bấm "Chuyển OQC".
export default function GiaCongPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canDo = can('RELEASE1') || can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null); // { ids:[], label } — đang hỏi xác nhận chuyển OQC
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);

  const printVe = async (r) => {
    try { await printGiaCongVeTem(buildVeLabel(r)); }
    catch (e) { show(e.message || 'In tem thất bại', 'error'); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listGiaCong({ search, limit: 500 });
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

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(rows.map((r) => r.id))));

  const doConfirm = async () => {
    if (!confirm) return;
    setSaving(true);
    let okCount = 0; let failCount = 0;
    for (const id of confirm.ids) {
      try { await giaCongToOqc(id); okCount += 1; } catch (_) { failCount += 1; }
    }
    setSaving(false);
    setConfirm(null);
    show(failCount ? `Đã chuyển ${okCount} lệnh sang OQC, ${failCount} lỗi` : `Đã chuyển ${okCount} lệnh sang OQC`,
      failCount ? 'error' : 'success');
    load();
  };

  const columns = [
    ...(canDo ? [{ key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()} onChange={() => toggleOne(r.id)} aria-label="Chọn lệnh" />
      ) }] : []),
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'ten_chuyen', header: 'Chuyền gia công', render: (r) => r.ten_chuyen || '—' },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_release) },
    { key: 'nguoi_release', header: 'Người release', render: (r) => r.nguoi_release || '—' },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'ngay_ke_hoach', header: 'Ngày SX kế hoạch', render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'act', header: '', className: 'text-right whitespace-nowrap', render: (r) => (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="secondary" icon="printer" onClick={(e) => { e.stopPropagation(); printVe(r); }}>
          In tem
        </Button>
        {canDo && (
          <Button size="sm" icon="arrow-right" onClick={(e) => { e.stopPropagation(); setConfirm({ ids: [r.id], label: r.ma_lenh_san_xuat }); }}>
            Chuyển OQC
          </Button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Gia công" subtitle="Lệnh đã release lên chuyền gia công — Kế hoạch nhận lại hàng rồi bấm 'Chuyển OQC' để đưa sang kiểm OQC"
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {canDo && selected.size > 0 && (
          <Button onClick={() => setConfirm({ ids: [...selected], label: `${selected.size} lệnh` })}>
            Chuyển OQC ({selected.size})
          </Button>
        )}
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử chuyển</Button>
        <Badge tone="info">{meta.total || rows.length} lệnh</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} sttStart={0}
        emptyText="Không có lệnh gia công nào đang chờ chuyển OQC" />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        loading={saving}
        title="Chuyển gia công sang OQC"
        confirmText="Chuyển OQC"
        message={confirm ? `Xác nhận đã nhận lại hàng gia công (${confirm.label}) và chuyển sang kiểm OQC? Hệ thống sẽ tạo tem coi như đã KCS đạt.` : ''}
      />

      <GiaCongHistoryPanel open={histOpen} onClose={() => setHistOpen(false)} onPrint={printVe} />

      <Toast toast={toast} />
    </div>
  );
}
