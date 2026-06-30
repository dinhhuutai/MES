import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  listProductionCandidates, startProduction, getMonitor,
} from '../../../services/productionService';
import { fmtNum, fmtDate } from '../../../utils/format';
import RunPanel from '../components/RunPanel';

export default function XacNhanChayPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRun = can('PROD_RUN');

  const [candidates, setCandidates] = useState([]);
  const [running, setRunning] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([listProductionCandidates({ search, limit: 50 }), getMonitor()]);
      setCandidates(c.data.items);
      setRunning(m.data.running);
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

  const doStart = async (lenh) => {
    setBusy(lenh.id);
    try {
      await startProduction(lenh.id);
      show(`Đã xác nhận chạy ${lenh.ma_lenh_san_xuat}`);
      setSel(lenh.id);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(null);
    }
  };

  const candCols = [
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'ma_chuyen', header: 'Chuyền', render: (r) => `${r.ma_chuyen || '—'} ${r.ten_chuyen || ''}` },
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_release) },
    { key: 'ngay_ke_hoach', header: 'Ngày SX KH', render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      canRun && <Button className="px-2.5 py-1 text-xs" loading={busy === r.id} onClick={() => doStart(r)}>Xác nhận chạy</Button> },
  ];

  const runCols = [
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'ma_chuyen', header: 'Chuyền' },
    { key: 'printed', header: 'Đã in', className: 'text-right tabular-nums', render: (r) => `${fmtNum(r.printed)} / ${fmtNum(r.target)}` },
    { key: 'so_tem', header: 'Tem', className: 'text-right' },
    { key: 'tt', header: 'Trạng thái', render: (r) =>
      r.dang_ngung ? <Badge tone="danger">Đang ngừng</Badge> : <Badge tone="success">Đang chạy</Badge> },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setSel(r.lenh_id)}>Mở</Button> },
  ];

  return (
    <div>
      <Toolbar title="Xác nhận chạy" subtitle="Lệnh đã Release 2 — bắt đầu in & tạo tem"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, mã hàng, màu/kích, mã lệnh..." />

      <h3 className="mb-2 mt-1 text-sm font-semibold text-ink">Đang chạy ({running.length})</h3>
      <DataTable columns={runCols} rows={running} loading={loading} rowKey="phieu_id"
        onRowClick={(r) => setSel(r.lenh_id)} emptyText="Không có lệnh đang chạy" />

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink">Chờ chạy ({candidates.length})</h3>
      <DataTable columns={candCols} rows={candidates} loading={loading}
        emptyText="Không có lệnh nào chờ chạy" />

      {sel && <RunPanel lenhId={sel} onClose={() => setSel(null)} onChanged={load} />}
      <Toast toast={toast} />
    </div>
  );
}
