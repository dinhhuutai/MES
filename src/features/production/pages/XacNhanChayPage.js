import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import GomBadge from '../../../components/common/GomBadge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import { Field, Input } from '../../../components/common/controls';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import {
  listProductionCandidates, startProduction, getMonitor, listChuyen,
} from '../../../services/productionService';
import { fmtNum, fmtDate } from '../../../utils/format';
import RunPanel from '../components/RunPanel';

export default function XacNhanChayPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const { statusLenh } = useNghenMap();
  const canRun = can('PROD_RUN');

  const [candidates, setCandidates] = useState([]);
  const [running, setRunning] = useState([]);
  const [chuyen, setChuyen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ khach: '', don: '', maHang: '', mauVai: '', kichVai: '', kichPhim: '', chuyenId: '' });
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

  // Lọc client-side theo từng trường (kết hợp AND) + chuyền. Áp cho cả "Đang chạy" & "Chờ chạy".
  const selChuyen = useMemo(() => (chuyen || []).find((x) => x.id === filters.chuyenId) || null, [chuyen, filters.chuyenId]);
  const hasFilter = Object.values(filters).some(Boolean);
  const applyFilters = useCallback((rows) => {
    if (!hasFilter) return rows;
    const like = (v, q) => !q || String(v || '').toLowerCase().includes(q.toLowerCase());
    const matchChuyen = (r) => {
      if (!filters.chuyenId || !selChuyen) return true;
      const names = [selChuyen.ten_chuyen, selChuyen.ma_chuyen].filter(Boolean).map((s) => s.toLowerCase());
      const rowVals = [r.ten_chuyen, r.ma_chuyen].filter(Boolean).map((s) => s.toLowerCase());
      return rowVals.some((rv) => names.includes(rv));
    };
    return (rows || []).filter((r) =>
      like(r.ten_khach_hang, filters.khach) && like(r.ma_don_hang, filters.don)
      && like(r.ma_hang, filters.maHang) && like(r.mau_vai, filters.mauVai)
      && like(r.kich_vai, filters.kichVai) && like(r.kich_phim, filters.kichPhim)
      && matchChuyen(r));
  }, [filters, hasFilter, selChuyen]);
  const candFiltered = useMemo(() => applyFilters(candidates), [applyFilters, candidates]);
  const runFiltered = useMemo(() => applyFilters(running), [applyFilters, running]);
  const clearFilters = () => setFilters({ khach: '', don: '', maHang: '', mauVai: '', kichVai: '', kichPhim: '', chuyenId: '' });

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
        {r.giai_doan === 'EP_UI' && <Badge tone="info">Ép ủi (in kiếng)</Badge>}
        <GomBadge soDotVai={r.so_dot_vai} soPhanIn={r.so_phan_in} />
        {Number(r.da_in_truoc) > 0 && (
          <div className="mt-0.5">
            <Badge tone="warning">
              Đã in {fmtNum(r.da_in_truoc)}{r.tg_ngung ? ` · ngừng ${new Date(r.tg_ngung).toLocaleString('vi-VN')}` : ''} → in tiếp
            </Badge>
          </div>
        )}
      </div>
    ) },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'ma_chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
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
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, mã hàng, màu/kích, đơn hàng...">
        <Button variant={showFilter || hasFilter ? 'secondary' : 'ghost'} icon="filter" onClick={() => setShowFilter((v) => !v)}>
          Bộ lọc{hasFilter ? ' ●' : ''}
        </Button>
      </Toolbar>

      {showFilter && (
        <div className="mb-4 rounded-card border border-line bg-surface p-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Khách hàng"><Input value={filters.khach} onChange={(e) => setFilters({ ...filters, khach: e.target.value })} placeholder="Lọc khách..." /></Field>
            <Field label="Đơn hàng"><Input value={filters.don} onChange={(e) => setFilters({ ...filters, don: e.target.value })} placeholder="Lọc đơn..." /></Field>
            <Field label="Mã hàng"><Input value={filters.maHang} onChange={(e) => setFilters({ ...filters, maHang: e.target.value })} placeholder="Lọc mã hàng..." /></Field>
            <Field label="Màu vải"><Input value={filters.mauVai} onChange={(e) => setFilters({ ...filters, mauVai: e.target.value })} placeholder="Lọc màu..." /></Field>
            <Field label="Kích vải"><Input value={filters.kichVai} onChange={(e) => setFilters({ ...filters, kichVai: e.target.value })} placeholder="Lọc kích vải..." /></Field>
            <Field label="Kích phim"><Input value={filters.kichPhim} onChange={(e) => setFilters({ ...filters, kichPhim: e.target.value })} placeholder="Lọc kích phim..." /></Field>
            <Field label="Chuyền">
              <select value={filters.chuyenId} onChange={(e) => setFilters({ ...filters, chuyenId: e.target.value })}
                className="h-9 w-full rounded-input border border-line bg-surface px-2 text-sm">
                <option value="">Tất cả chuyền</option>
                {(chuyen || []).map((c) => <option key={c.id} value={c.id}>{c.ten_chuyen || c.ma_chuyen}</option>)}
              </select>
            </Field>
          </div>
          {hasFilter && (
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-danger">
                <Icon name="x" size={14} /> Xóa lọc
              </button>
            </div>
          )}
        </div>
      )}

      <h3 className="mb-2 mt-1 text-sm font-semibold text-ink">Đang chạy ({runFiltered.length}{hasFilter ? `/${running.length}` : ''})</h3>
      <DataTable columns={runCols} rows={runFiltered} loading={loading} rowKey="phieu_id" sttStart={0}
        rowClassName={(r) => slaRowClass(statusLenh(r.lenh_id))}
        onRowClick={(r) => setSel(r.lenh_id)} emptyText="Không có lệnh đang chạy" />

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink">Chờ chạy ({candFiltered.length}{hasFilter ? `/${candidates.length}` : ''})</h3>
      <DataTable columns={candCols} rows={candFiltered} loading={loading} sttStart={0}
        rowClassName={(r) => slaRowClass(statusLenh(r.id))}
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
              <ChuyenPicker chuyen={chuyen} value={runChuyenId} onChange={setRunChuyenId} />
            </Field>
          </div>
        )}
      </Modal>

      {sel && <RunPanel lenhId={sel} onClose={() => setSel(null)} onChanged={load} />}
      <Toast toast={toast} />
    </div>
  );
}
