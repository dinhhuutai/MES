import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listCancelableLenh, cancelLenh } from '../../../services/planningService';
import { fmtNum } from '../../../utils/format';

const TT = {
  RELEASE_1: { tone: 'info', label: 'Test Run (Release 1)' },
  RELEASE_2: { tone: 'warning', label: 'Release 2 (chờ sản xuất)' },
};

// Các checkpoint đích có thể đưa về, tùy trạng thái hiện tại của lệnh.
function targetsFor(trangThai) {
  const READY = { v: 'READY', label: 'Về READY kỹ thuật', desc: 'Hủy lệnh + hủy QC → phần in làm lại từ kỹ thuật/QC' };
  const REL1 = { v: 'RELEASE_1', label: 'Về "chờ release" (Release 1)', desc: 'Hủy lệnh, giữ QC → sẵn sàng release lại' };
  const TEST = { v: 'TEST_RUN', label: 'Về Test Run', desc: 'Bỏ duyệt Release 2, giữ lệnh → quay lại Test Run' };
  if (trangThai === 'RELEASE_2') return [TEST, REL1, READY];
  return [REL1, READY]; // RELEASE_1 (đang ở Test Run)
}

// Trang hoàn tác chuyển trạm (pre-production): đưa lệnh lỡ chuyển về checkpoint mong muốn.
export default function HuyLenhPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canCancel = can('RELEASE1') || can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTargetRow] = useState(null); // lệnh đang hoàn tác
  const [chon, setChon] = useState('RELEASE_1');
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCancelableLenh({ search, page, limit: 50 });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openRow = (r) => {
    const opts = targetsFor(r.trang_thai);
    setTargetRow(r);
    setChon(opts[0].v);
    setLyDo('');
  };

  const doRollback = async () => {
    setBusy(true);
    try {
      const res = await cancelLenh(target.id, { target: chon, lyDo: lyDo.trim() || null });
      const map = { READY: 'về READY kỹ thuật', RELEASE_1: 'về chờ release (Release 1)', TEST_RUN: 'về Test Run' };
      show(`Đã hoàn tác lệnh ${target.ma_lenh_san_xuat} — ${map[res.data.target] || res.data.target}`
        + (res.data.tu_set ? ' (set đã mở lại)' : ''));
      setTargetRow(null); setLyDo('');
      load();
    } catch (e) {
      show(e.message || 'Hoàn tác thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'trang_thai', header: 'Đang ở', render: (r) => {
      const s = TT[r.trang_thai] || { tone: 'default', label: r.trang_thai };
      return (
        <div className="flex flex-col gap-1">
          <Badge tone={s.tone}>{s.label}</Badge>
          {r.co_test && <span className="text-xs text-amber-600">Đã có xác nhận test</span>}
        </div>
      );
    } },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => (
      <div>{r.ma_hang || '—'}{r.so_dot_vai > 1 && <div className="mt-0.5"><Badge tone="warning">Gom set ({r.so_dot_vai} đợt)</Badge></div>}</div>
    ) },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_release) },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      canCancel && <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => openRow(r)}>Hoàn tác</Button> },
  ];

  const options = target ? targetsFor(target.trang_thai) : [];

  return (
    <div>
      <Toolbar title="Hoàn tác chuyển trạm"
        subtitle="Lỡ release/chuyển qua Test Run hoặc Release 2 — đưa lệnh về checkpoint mong muốn (chỉ khi CHƯA in tem)"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        <Badge tone="info">{meta.total} lệnh hoàn tác được</Badge>
      </Toolbar>

      <div className="mb-3 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
        Hoàn tác an toàn cho các bước <b>trước sản xuất</b> (READY · Release 1 · Test Run · Release 2). Sau khi <b>đã in tem</b>
        (Sản xuất → Giao hàng) chưa hỗ trợ hoàn tác tự động vì liên quan tách tem/giao hàng.
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} sttStart={(meta.page - 1) * 50}
        emptyText="Không có lệnh nào hoàn tác được (chỉ lệnh chưa in tem)" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <Modal
        open={!!target}
        onClose={() => setTargetRow(null)}
        title={`Hoàn tác lệnh ${target?.ma_lenh_san_xuat || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTargetRow(null)}>Đóng</Button>
            <Button variant="danger" onClick={doRollback} loading={busy}>Xác nhận hoàn tác</Button>
          </>
        }
      >
        <Field label="Đưa về checkpoint">
          <div className="space-y-2">
            {options.map((o) => (
              <label key={o.v} className={`flex cursor-pointer items-start gap-2 rounded-control border p-2.5 ${chon === o.v ? 'border-primary bg-primary-wash/40' : 'border-line'}`}>
                <input type="radio" name="target" checked={chon === o.v} onChange={() => setChon(o.v)} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium text-ink">{o.label}</span>
                  <span className="block text-xs text-ink-soft">{o.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </Field>
        <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {chon === 'TEST_RUN'
            ? 'Chỉ bỏ duyệt Release 2 — lệnh quay lại Test Run, vẫn giữ đợt vải & xác nhận test.'
            : chon === 'READY'
              ? 'Hủy lệnh + hủy xác nhận QC → phần in về màn READY (làm lại kỹ thuật/QC). Xác nhận test (nếu có) bị hủy.'
              : 'Hủy lệnh → đợt vải về "chờ release" (giữ QC), có thể release lại.'}
          {target?.so_dot_vai > 1 && ' Set gom sẽ được mở lại.'}
        </div>
        <Field label="Lý do (khuyến nghị)">
          <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)}
            placeholder="Vd: bấm nhầm qua Test Run, cần điều chỉnh..." />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
