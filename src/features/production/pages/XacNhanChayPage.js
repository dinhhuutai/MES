import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  listProductionCandidates, startProduction, getMonitor, listChuyen,
} from '../../../services/productionService';
import { fmtNum, fmtDate } from '../../../utils/format';
import RunPanel from '../components/RunPanel';

export default function XacNhanChayPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRun = can('PROD_RUN');

  const [candidates, setCandidates] = useState([]);
  const [running, setRunning] = useState([]);
  const [chuyen, setChuyen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState(null);
  const [confirmRun, setConfirmRun] = useState(null); // lệnh đang xác nhận chạy
  const [runChuyenId, setRunChuyenId] = useState('');
  const [busy, setBusy] = useState(false);

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

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Mở hộp xác nhận: kế thừa chuyền kế hoạch, cho đổi chuyền thực tế.
  const openConfirm = (lenh) => { setConfirmRun(lenh); setRunChuyenId(lenh.chuyen_id || ''); };

  const doStart = async () => {
    setBusy(true);
    try {
      await startProduction(confirmRun.id, runChuyenId || null);
      show('Đã xác nhận chạy — bắt đầu in & tạo tem');
      const startedId = confirmRun.id;
      setConfirmRun(null);
      setSel(startedId);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const candCols = [
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => (
      <div>
        <div className="text-ink">{r.ma_hang || '—'}</div>
        {r.so_dot_vai > 1 && <Badge tone="warning">Gom set ({r.so_dot_vai} đợt)</Badge>}
      </div>
    ) },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'ma_chuyen', header: 'Chuyền KH', render: (r) => `${r.ma_chuyen || '—'} ${r.ten_chuyen || ''}` },
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_release) },
    { key: 'ngay_ke_hoach', header: 'Ngày SX KH', render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      canRun && <Button className="px-2.5 py-1 text-xs" onClick={() => openConfirm(r)}>Xác nhận chạy</Button> },
  ];

  const runCols = [
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
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
      <Toolbar title="Xác nhận chạy" subtitle="Lệnh đã Release 2 — chọn chuyền thực tế & bắt đầu in"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, mã hàng, màu/kích, đơn hàng..." />

      <h3 className="mb-2 mt-1 text-sm font-semibold text-ink">Đang chạy ({running.length})</h3>
      <DataTable columns={runCols} rows={running} loading={loading} rowKey="phieu_id" sttStart={0}
        onRowClick={(r) => setSel(r.lenh_id)} emptyText="Không có lệnh đang chạy" />

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink">Chờ chạy ({candidates.length})</h3>
      <DataTable columns={candCols} rows={candidates} loading={loading} sttStart={0}
        emptyText="Không có lệnh nào chờ chạy" />

      {/* Xác nhận thông tin chạy + chọn chuyền thực tế */}
      <Modal open={!!confirmRun} onClose={() => setConfirmRun(null)} title="Xác nhận thông tin chạy"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmRun(null)}>Hủy</Button>
          <Button onClick={doStart} loading={busy} disabled={!runChuyenId}>Bắt đầu chạy</Button>
        </>}>
        {confirmRun && (
          <div className="space-y-3">
            <div className="rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
              <div><b className="text-ink">{confirmRun.ten_khach_hang}</b> · {confirmRun.ma_don_hang}</div>
              <div>{confirmRun.ma_hang} · {confirmRun.mau_vai} · {confirmRun.kich_vai}/{confirmRun.kich_phim}</div>
              <div>Code phần: {confirmRun.ma_phan || '—'} · SL release: <b className="text-ink">{fmtNum(confirmRun.so_luong_release)}</b></div>
            </div>
            <Field label="Chuyền thực tế" required hint="Kế thừa chuyền kế hoạch — đổi nếu chạy chuyền khác">
              <Select value={runChuyenId} onChange={(e) => setRunChuyenId(e.target.value)}>
                <option value="">— Chọn chuyền —</option>
                {chuyen.map((c) => <option key={c.id} value={c.id}>{c.ma_chuyen} — {c.ten_chuyen}{c.loai_chuyen ? ` (${c.loai_chuyen})` : ''}</option>)}
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      {sel && <RunPanel lenhId={sel} onClose={() => setSel(null)} onChanged={load} />}
      <Toast toast={toast} />
    </div>
  );
}
