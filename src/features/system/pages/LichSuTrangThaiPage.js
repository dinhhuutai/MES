import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import { Field, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listConfirmHistory, cancelReadyItem } from '../../../services/readyService';
import { listCancelableLenh, cancelLenh } from '../../../services/planningService';
import { listCancelableTem, cancelPrintTem, listCloseCandidates, closeProduction, listReopenCandidates, reopenProduction, listUndoStartCandidates, undoStartProduction } from '../../../services/productionService';
import { listCancelKcs, cancelKcs, listCancelSua, cancelSua, listCancelOqc, cancelOqc } from '../../../services/qualityService';
import { fmtNum } from '../../../utils/format';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');

// ─── Tab 1: Hủy (xóa mềm) xác nhận READY đã thực hiện ───────────────────────
function ReadyCancelSection({ show }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null); // row cần xóa mềm
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listConfirmHistory({ date, search });
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [date, search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const doCancel = async () => {
    setBusy(true);
    try {
      await cancelReadyItem(confirm.phan_in_id, confirm.ma_checkpoint);
      show(`Đã hủy xác nhận ${confirm.muc_label} — ${confirm.ma_phan}. Người phụ trách có thể xác nhận lại.`);
      setConfirm(null);
      load();
    } catch (e) {
      show(e.message || 'Hủy thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'tg_xac_nhan', header: 'Giờ xác nhận', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtTime(r.tg_xac_nhan) },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu · Kích', render: (r) => [r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—' },
    { key: 'muc_label', header: 'Mục xác nhận', render: (r) => (
      <div className="flex items-center gap-1.5">
        <Badge tone="info">{r.muc_label}</Badge>
        {r.gia_tri_text ? <span className="text-xs text-ink-soft">{r.gia_tri_text}</span> : null}
      </div>
    ) },
    { key: 'nguoi_xac_nhan', header: 'Người xác nhận', render: (r) => r.nguoi_xac_nhan || '—' },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      <Button variant="danger" className="px-3 py-1.5" onClick={(e) => { e.stopPropagation(); setConfirm(r); }}>
        Hủy xác nhận
      </Button> },
  ];

  return (
    <div>
      <Toolbar title="Hủy xác nhận READY"
        subtitle="Các xác nhận READY (Khuôn/Film/Mực/HSKT/QC) đã thực hiện — bấm nhầm thì hủy để người phụ trách xác nhận lại"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, mã hàng, màu/kích...">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-input border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
        <Badge tone="default">{rows.length} lượt</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="ket_qua_id"
        emptyText="Không có xác nhận nào trong ngày" />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doCancel}
        loading={busy}
        title="Hủy xác nhận READY"
        message={confirm
          ? `Hủy xác nhận "${confirm.muc_label}" của phần in ${confirm.ma_phan} (do ${confirm.nguoi_xac_nhan || '—'} xác nhận)? Mục này sẽ trở lại trạng thái CHƯA xác nhận để người phụ trách làm lại.`
          : ''}
        confirmText="Hủy xác nhận"
        variant="danger"
      />
    </div>
  );
}

// ─── Tab 2: Hủy lệnh sản xuất (hoàn tác chuyển trạm, pre-production) ─────────
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

function LenhCancelSection({ show }) {
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
      show(`Đã hủy lệnh ${target.ma_lenh_san_xuat} — ${map[res.data.target] || res.data.target}`
        + (res.data.tu_set ? ' (set đã mở lại)' : ''));
      setTargetRow(null); setLyDo('');
      load();
    } catch (e) {
      show(e.message || 'Hủy lệnh thất bại', 'error');
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
      <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => openRow(r)}>Hủy lệnh</Button> },
  ];

  const options = target ? targetsFor(target.trang_thai) : [];

  return (
    <div>
      <Toolbar title="Hủy lệnh sản xuất"
        subtitle="Lỡ release/chuyển qua Test Run hoặc Release 2 — hủy lệnh để đưa về checkpoint mong muốn (chỉ khi CHƯA in tem)"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        <Badge tone="info">{meta.total} lệnh hủy được</Badge>
      </Toolbar>

      <div className="mb-3 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
        Hủy lệnh an toàn cho các bước <b>trước sản xuất</b> (READY · Release 1 · Test Run · Release 2). Sau khi <b>đã in tem</b>
        (Sản xuất → Giao hàng) chưa hỗ trợ hủy tự động vì liên quan tách tem/giao hàng.
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} sttStart={(meta.page - 1) * 50}
        emptyText="Không có lệnh nào hủy được (chỉ lệnh chưa in tem)" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <Modal
        open={!!target}
        onClose={() => setTargetRow(null)}
        title={`Hủy lệnh ${target?.ma_lenh_san_xuat || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTargetRow(null)}>Đóng</Button>
            <Button variant="danger" onClick={doRollback} loading={busy}>Xác nhận hủy lệnh</Button>
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
    </div>
  );
}

// ─── Tab 3: Hủy lệnh in tem (xóa tem CHƯA kiểm + gỡ xe phơi, trả SL về) ──────
const TEM_TT = {
  IN: { tone: 'info', label: 'Đã in (chờ phơi)' },
  DANG_PHOI: { tone: 'warning', label: 'Đang phơi' },
  DA_KHO: { tone: 'success', label: 'Đã khô (chờ kiểm)' },
};

function TemCancelSection({ show }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTargetRow] = useState(null); // tem đang hủy
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCancelableTem({ search, page, limit: 50 });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openRow = (r) => { setTargetRow(r); setLyDo(''); };

  const doCancel = async () => {
    setBusy(true);
    try {
      const res = await cancelPrintTem(target.id, lyDo.trim() || null);
      show(`Đã hủy lệnh in tem ${res.data.ma_tem} (${fmtNum(res.data.so_luong)} cái) — đã gỡ khỏi xe phơi, trả SL về lệnh ${res.data.ma_lenh_san_xuat}.`);
      setTargetRow(null); setLyDo('');
      load();
    } catch (e) {
      show(e.message || 'Hủy lệnh in tem thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'ma_tem', header: 'Mã tem', render: (r) => <Badge tone="info">{r.ma_tem}</Badge> },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) => {
      const s = TEM_TT[r.trang_thai] || { tone: 'default', label: r.trang_thai };
      return <Badge tone={s.tone}>{s.label}</Badge>;
    } },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => r.ma_lenh_san_xuat || '—' },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu · Kích', render: (r) => [r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—' },
    { key: 'nguoi_in', header: 'Người in', render: (r) => r.nguoi_in || '—' },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => openRow(r)}>Hủy lệnh in tem</Button> },
  ];

  return (
    <div>
      <Toolbar title="Hủy lệnh in tem"
        subtitle="In nhầm tem — hủy để xóa tem đó, gỡ khỏi xe phơi và trả SL về lệnh (chỉ tem CHƯA kiểm)"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm mã tem, mã lệnh, code phần, mã hàng, màu/kích...">
        <Badge tone="info">{meta.total} tem hủy được</Badge>
      </Toolbar>

      <div className="mb-3 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
        Chỉ hủy được tem <b>chưa kiểm</b> (đang chờ phơi / đang phơi / đã khô). Tem đã KCS/OQC/giao sẽ không hiện ở đây
        để tránh hỏng sổ cái số lượng. Hủy xong tem bị loại khỏi tổng đã in ⇒ <b>SL release được trả về</b> để in lại.
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="id" sttStart={(meta.page - 1) * 50}
        emptyText="Không có tem nào hủy được (chỉ tem chưa kiểm)" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <Modal
        open={!!target}
        onClose={() => setTargetRow(null)}
        title={`Hủy lệnh in tem ${target?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTargetRow(null)}>Đóng</Button>
            <Button variant="danger" onClick={doCancel} loading={busy}>Xác nhận hủy in tem</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Tem <b>{target?.ma_tem}</b> ({fmtNum(target?.so_luong)} cái) sẽ bị <b>hủy</b> và <b>gỡ khỏi xe phơi</b>.
          Số lượng này được trả về lệnh <b>{target?.ma_lenh_san_xuat}</b> để có thể in lại. Thao tác không tự phục hồi tem đã hủy.
        </div>
        <Field label="Lý do (khuyến nghị)">
          <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)}
            placeholder="Vd: in nhầm số lượng, sai phần in..." />
        </Field>
      </Modal>
    </div>
  );
}

// ─── Tab 4: Đóng lệnh sản xuất (= Chạy hoàn tất khi lệch SL không bấm được) ──
function CloseProductionSection({ show }) {
  const [rows, setRows] = useState([]);
  const [reopenRows, setReopenRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [target, setTargetRow] = useState(null); // phiếu đang đóng
  const [reopen, setReopen] = useState(null);     // phiếu đang mở lại
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, resReopen] = await Promise.all([listCloseCandidates(), listReopenCandidates()]);
      setRows(res.data);
      setReopenRows(resReopen.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const kw = search.trim().toLowerCase();
  const view = kw
    ? rows.filter((r) => [r.ma_lenh_san_xuat, r.ma_phan, r.ma_hang, r.mau_vai, r.kich_vai, r.kich_phim, r.ten_khach_hang]
        .some((v) => (v || '').toLowerCase().includes(kw)))
    : rows;

  const doClose = async () => {
    setBusy(true);
    try {
      const res = await closeProduction(target.phieu_id, lyDo.trim() || null);
      show(`Đã đóng lệnh sản xuất ${res.data.ma_lenh_san_xuat || ''} (đã in ${fmtNum(res.data.printed)}) — chuyển sang Chờ khô.`);
      setTargetRow(null); setLyDo('');
      load();
    } catch (e) {
      show(e.message || 'Đóng lệnh thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doReopen = async () => {
    setBusy(true);
    try {
      const res = await reopenProduction(reopen.phieu_id);
      show(`Đã mở lại lệnh sản xuất ${res.data.ma_lenh_san_xuat || ''} — tiếp tục in, giữ nguyên số lượng đã có.`);
      setReopen(null);
      load();
    } catch (e) {
      show(e.message || 'Mở lại lệnh thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const pct = (r) => (r.target > 0 ? Math.round((Number(r.printed) / Number(r.target)) * 100) : null);

  const columns = [
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu · Kích', render: (r) => [r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—' },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || r.ma_chuyen || '—' },
    { key: 'printed', header: 'Đã in / SL', className: 'text-right tabular-nums', render: (r) => {
      const p = pct(r);
      const low = p != null && p < 90;
      return (
        <span className={low ? 'font-semibold text-amber-600' : ''}>
          {fmtNum(r.printed)} / {fmtNum(r.target)}{p != null ? ` (${p}%)` : ''}
        </span>
      );
    } },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => { setTargetRow(r); setLyDo(''); }}>Đóng lệnh</Button> },
  ];

  const reopenCols = [
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'tg_kt', header: 'Đóng lúc', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtTime(r.tg_kt) },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu · Kích', render: (r) => [r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—' },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || r.ma_chuyen || '—' },
    { key: 'printed', header: 'Đã in / SL', className: 'text-right tabular-nums', render: (r) =>
      `${fmtNum(r.printed)} / ${fmtNum(r.target)}` },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      <Button className="px-2.5 py-1 text-xs" onClick={() => setReopen(r)}>Mở lại</Button> },
  ];
  const reopenView = kw
    ? reopenRows.filter((r) => [r.ma_lenh_san_xuat, r.ma_phan, r.ma_hang, r.mau_vai, r.kich_vai, r.kich_phim, r.ten_khach_hang]
        .some((v) => (v || '').toLowerCase().includes(kw)))
    : reopenRows;

  return (
    <div>
      <Toolbar title="Đóng lệnh sản xuất"
        subtitle="Lệnh đang chạy nhưng lệch SL nên không bấm được 'Chạy hoàn tất' — đóng tại đây (tương đương Chạy hoàn tất) để chuyển sang Chờ khô/kiểm"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        <Badge tone="info">{view.length} lệnh đang chạy</Badge>
      </Toolbar>

      <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Đóng lệnh = <b>Chạy hoàn tất</b> cho phiếu đang chạy (không cần đủ 90% SL release). Sau khi đóng, tem đã in đi tiếp
        <b> Chờ khô → KCS</b> bình thường. Thao tác được ghi <b>audit</b> (người, giờ, SL đã in, lý do).
      </div>

      <DataTable columns={columns} rows={view} loading={loading} rowKey="phieu_id" sttStart={0}
        emptyText="Không có lệnh nào đang chạy" />

      {/* Mở lại lệnh sản xuất đã đóng/hoàn tất (trong 2 ngày) */}
      <div className="mt-8 mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">Mở lại lệnh sản xuất</h3>
        <Badge tone="default">{reopenView.length} lệnh (2 ngày gần nhất)</Badge>
      </div>
      <div className="mb-3 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
        Lệnh đã <b>đóng / chạy hoàn tất</b> trong <b>2 ngày</b> gần nhất — mở lại để <b>in tiếp</b> (đóng nhầm hoặc cần in thêm).
        Mở lại <b>giữ nguyên số lượng đã in</b>; phiếu quay lại <b>đang chạy</b> để in tiếp trên màn Sản xuất.
      </div>
      <DataTable columns={reopenCols} rows={reopenView} loading={loading} rowKey="phieu_id" sttStart={0}
        emptyText="Không có lệnh nào đóng trong 2 ngày gần nhất" />

      <ConfirmDialog
        open={!!reopen}
        onClose={() => setReopen(null)}
        onConfirm={doReopen}
        loading={busy}
        title="Mở lại lệnh sản xuất"
        message={reopen
          ? `Mở lại lệnh ${reopen.ma_lenh_san_xuat} (đã in ${fmtNum(reopen.printed)}/${fmtNum(reopen.target)}, đóng lúc ${fmtTime(reopen.tg_kt)})? Phiếu quay lại "đang chạy" để in tiếp — số lượng đã in được giữ nguyên.`
          : ''}
        confirmText="Mở lại lệnh"
      />

      <Modal
        open={!!target}
        onClose={() => setTargetRow(null)}
        title={`Đóng lệnh sản xuất ${target?.ma_lenh_san_xuat || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTargetRow(null)}>Đóng</Button>
            <Button variant="danger" onClick={doClose} loading={busy}>Xác nhận đóng lệnh</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Lệnh <b>{target?.ma_lenh_san_xuat}</b> đã in <b>{fmtNum(target?.printed)}</b> / {fmtNum(target?.target)}
          {target && pct(target) != null ? ` (${pct(target)}%)` : ''}. Xác nhận <b>đóng lệnh</b> (= Chạy hoàn tất) —
          phiếu chuyển sang hoàn tất, tem đi tiếp Chờ khô/kiểm. Không tự hoàn tác.
        </div>
        <Field label="Lý do (khuyến nghị)">
          <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)}
            placeholder="Vd: lệch số lượng do vải hủy, không đủ 90% nhưng đã chạy xong..." />
        </Field>
      </Modal>
    </div>
  );
}

// ─── Tab 5: Hủy lệnh ĐANG CHẠY (bấm nhầm Xác nhận chạy) → về chờ chạy ────────
function UndoStartSection({ show }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null); // lệnh đang hủy chạy
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUndoStartCandidates();
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const kw = search.trim().toLowerCase();
  const view = kw
    ? rows.filter((r) => [r.ma_lenh_san_xuat, r.ma_phan, r.ma_hang, r.mau_vai, r.kich_vai, r.kich_phim, r.ten_khach_hang]
        .some((v) => (v || '').toLowerCase().includes(kw)))
    : rows;

  const doUndo = async () => {
    setBusy(true);
    try {
      const res = await undoStartProduction(confirm.phieu_id);
      show(`Đã hủy lệnh đang chạy ${res.data.ma_lenh_san_xuat || ''} — quay về danh sách chờ chạy.`);
      setConfirm(null);
      load();
    } catch (e) {
      show(e.message || 'Hủy lệnh chạy thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu · Kích', render: (r) => [r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—' },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || r.ma_chuyen || '—' },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => setConfirm(r)}>Hủy lệnh chạy</Button> },
  ];

  return (
    <div>
      <Toolbar title="Hủy lệnh đang chạy"
        subtitle="Lỡ bấm nhầm 'Xác nhận chạy' (chưa in tem) — hủy để lệnh quay lại danh sách chờ chạy"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        <Badge tone="info">{view.length} lệnh (chưa in tem)</Badge>
      </Toolbar>

      <div className="mb-3 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
        Chỉ hủy được lệnh <b>chưa in tem nào</b>. Sau khi hủy, lệnh trở lại <b>chờ chạy</b> để bấm Xác nhận chạy lại.
        Lệnh đã in tem thì dùng <b>Hủy lệnh in tem</b> hoặc <b>Đóng lệnh sản xuất</b>.
      </div>

      <DataTable columns={columns} rows={view} loading={loading} rowKey="phieu_id" sttStart={0}
        emptyText="Không có lệnh đang chạy nào (chưa in tem)" />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doUndo}
        loading={busy}
        title="Hủy lệnh đang chạy"
        message={confirm
          ? `Hủy xác nhận chạy lệnh ${confirm.ma_lenh_san_xuat} (chuyền ${confirm.ten_chuyen || confirm.ma_chuyen || '—'})? Lệnh sẽ quay lại danh sách chờ chạy để bấm Xác nhận chạy lại.`
          : ''}
        confirmText="Hủy lệnh chạy"
        variant="danger"
      />
    </div>
  );
}

// ─── Tab 6-8: Hủy xác nhận KCS / Sửa / OQC (đảo sổ cái tem, đánh dấu audit) ──
const QC_CANCEL_CFG = {
  kcs: {
    short: 'KCS', title: 'Hủy xác nhận KCS',
    subtitle: 'Lỡ xác nhận KCS lộn / nhập sai số — hủy để đảo sổ cái về trước, tem quay lại chờ KCS',
    list: listCancelKcs, cancel: cancelKcs, ketQua: true,
    detail: (r) => `Đạt ${fmtNum(r.so_luong_dat)} · Hư ${fmtNum(r.so_luong_loi)} · Hủy ${fmtNum(r.so_luong_huy)}`
      + (r.so_luong_chenh_lech ? ` · Chênh ${r.so_luong_chenh_lech > 0 ? '+' : ''}${r.so_luong_chenh_lech}` : ''),
    hint: 'Chỉ hủy được khi phần ĐẠT của lần đó chưa đi tiếp OQC và phần SỬA chưa xử lý ở màn Sửa. Tem quay lại chờ KCS.',
  },
  sua: {
    short: 'Sửa', title: 'Hủy xác nhận Sửa',
    subtitle: 'Lỡ xác nhận Sửa lộn / nhập sai số — hủy để đảo sổ cái về trước, phần quay lại chờ sửa',
    list: listCancelSua, cancel: cancelSua,
    detail: (r) => `Sửa ${fmtNum(r.so_luong_sua)} · Đạt ${fmtNum(r.so_luong_sua_dat)} · Hủy ${fmtNum(r.so_luong_sua_huy)}`,
    hint: 'Chỉ hủy được khi phần SỬA ĐẠT của lần đó chưa đi tiếp OQC. Phần này quay lại chờ sửa.',
  },
  oqc: {
    short: 'OQC', title: 'Hủy xác nhận OQC',
    subtitle: 'Lỡ xác nhận OQC lộn / nhập sai số — hủy để đảo sổ cái về trước, tem quay lại chờ OQC',
    list: listCancelOqc, cancel: cancelOqc, ketQua: true, choGiao: true,
    detail: (r) => `Kiểm ${fmtNum(r.so_luong_kiem)} · Đạt ${fmtNum(r.so_luong_dat)} · Lỗi ${fmtNum(r.so_luong_loi)}`,
    hint: 'Chỉ hủy được khi phần OQC ĐẠT của lần đó chưa được GIAO. Tem quay lại chờ OQC.',
  },
};

function QcCancelSection({ show, kind }) {
  const cfg = QC_CANCEL_CFG[kind];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [target, setTargetRow] = useState(null);
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cfg.list(date);
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [date, show, cfg]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const kw = search.trim().toLowerCase();
  const view = kw
    ? rows.filter((r) => [r.ma_tem, r.ma_hang, r.mau_vai, r.kich_vai, r.kich_phim, r.ten_khach_hang]
        .some((v) => (v || '').toLowerCase().includes(kw)))
    : rows;

  const doCancel = async () => {
    setBusy(true);
    try {
      await cfg.cancel(target.id, lyDo.trim() || null);
      show(`Đã hủy xác nhận ${cfg.short} — tem ${target.ma_tem} đã đảo về trước lần xác nhận.`);
      setTargetRow(null); setLyDo('');
      load();
    } catch (e) {
      show(e.message || 'Hủy xác nhận thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'tg', header: 'Giờ', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtTime(r.tg) },
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone="info">{r.ma_tem}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu · Kích', render: (r) => [r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—' },
    ...(cfg.ketQua ? [{ key: 'ket_qua', header: 'Kết quả', render: (r) => (
      <div className="flex items-center gap-1">
        <Badge tone={r.ket_qua === 'DAT' ? 'success' : 'danger'}>{r.ket_qua === 'DAT' ? 'Đạt' : (r.ket_qua === 'KHONG_DAT' ? 'Không đạt' : (r.ket_qua || '—'))}</Badge>
        {cfg.choGiao && r.cho_giao ? <Badge tone="warning">Cho giao</Badge> : null}
      </div>
    ) }] : []),
    { key: 'detail', header: 'Số lượng', render: (r) => <span className="text-xs text-ink-soft">{cfg.detail(r)}</span> },
    { key: 'nguoi', header: 'Người xác nhận', render: (r) => r.nguoi || '—' },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', render: (r) =>
      <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => { setTargetRow(r); setLyDo(''); }}>Hủy xác nhận</Button> },
  ];

  return (
    <div>
      <Toolbar title={cfg.title} subtitle={cfg.subtitle}
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã tem, mã hàng, màu/kích, khách...">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-input border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
        <Badge tone="info">{view.length} lượt</Badge>
      </Toolbar>

      <div className="mb-3 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
        {cfg.hint} Thao tác được ghi <b>audit</b> (người, giờ, lý do) và loại bản ghi khỏi lịch sử/hành trình.
      </div>

      <DataTable columns={columns} rows={view} loading={loading} rowKey="id" sttStart={0}
        emptyText="Không có lượt xác nhận nào trong ngày" />

      <Modal
        open={!!target}
        onClose={() => setTargetRow(null)}
        title={`Hủy xác nhận ${cfg.short} — ${target?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTargetRow(null)}>Đóng</Button>
            <Button variant="danger" onClick={doCancel} loading={busy}>Xác nhận hủy</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Hủy lần xác nhận {cfg.short} của tem <b>{target?.ma_tem}</b> ({target ? cfg.detail(target) : ''}).
          Sổ cái số lượng của tem sẽ <b>đảo về trước</b> lần này. {cfg.hint}
        </div>
        <Field label="Lý do (khuyến nghị)">
          <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)}
            placeholder="Vd: nhập sai số lượng, xác nhận nhầm tem..." />
        </Field>
      </Modal>
    </div>
  );
}

// ─── Trang gộp: Hủy lệnh xác nhận ───────────────────────────────────────────
export default function LichSuTrangThaiPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();

  const tabs = [
    can('READY_CANCEL') && { key: 'ready', label: 'Hủy xác nhận READY' },
    (can('RELEASE1') || can('RELEASE2')) && { key: 'lenh', label: 'Hủy lệnh sản xuất' },
    can('PROD_RUN') && { key: 'tem', label: 'Hủy lệnh in tem' },
    can('PROD_RUN') && { key: 'dong', label: 'Đóng lệnh sản xuất' },
    can('PROD_RUN') && { key: 'huychay', label: 'Hủy lệnh đang chạy' },
    can('KCS') && { key: 'huykcs', label: 'Hủy xác nhận KCS' },
    can('SUA') && { key: 'huysua', label: 'Hủy xác nhận Sửa' },
    can('OQC') && { key: 'huyoqc', label: 'Hủy xác nhận OQC' },
  ].filter(Boolean);

  const [tab, setTab] = useState(tabs[0]?.key);

  return (
    <div>
      {tabs.length > 1 && (
        <div className="mb-4 inline-flex rounded-control border border-line bg-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-control px-4 py-1.5 text-sm font-medium transition ${
                tab === t.key ? 'bg-primary-wash text-primary' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'ready' && <ReadyCancelSection show={show} />}
      {tab === 'lenh' && <LenhCancelSection show={show} />}
      {tab === 'tem' && <TemCancelSection show={show} />}
      {tab === 'dong' && <CloseProductionSection show={show} />}
      {tab === 'huychay' && <UndoStartSection show={show} />}
      {tab === 'huykcs' && <QcCancelSection show={show} kind="kcs" />}
      {tab === 'huysua' && <QcCancelSection show={show} kind="sua" />}
      {tab === 'huyoqc' && <QcCancelSection show={show} kind="oqc" />}

      <Toast toast={toast} />
    </div>
  );
}
