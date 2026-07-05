import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Field, Input, Select, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listReplanCandidates, replan, replanBatch, listChuyen, planHistory, replanDone } from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

// Ngày (Date/ISO) → 'YYYY-MM-DD' theo giờ địa phương cho input[type=date] (tránh lệch ngày do slice ISO/UTC).
const dateStr = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function ReplanPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canReplan = can('RELEASE2') || can('RELEASE1');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [chuyen, setChuyen] = useState([]);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);

  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ chuyenId: '', ngayKeHoach: '', lyDo: '' });
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({ chuyenId: '', ngayKeHoach: '', lyDo: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listReplanCandidates({ search, page, limit: 50 });
      setRows(res.data.items);
      setMeta(res.data.meta);
      setSelected(new Set());
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = (row) => {
    setDetail(row);
    setForm({ chuyenId: row.chuyen_id || '', ngayKeHoach: dateStr(row.ngay_ke_hoach), lyDo: '' });
  };

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(rows.map((r) => r.id))));

  const openBatch = () => {
    setBatchForm({ chuyenId: '', ngayKeHoach: '', lyDo: '' });
    setBatchOpen(true);
  };

  const submitBatch = async () => {
    if (!batchForm.ngayKeHoach) { show('Chọn ngày sản xuất kế hoạch', 'error'); return; }
    if (!batchForm.lyDo.trim()) { show('Nhập lý do lập kế hoạch lại', 'error'); return; }
    setSaving(true);
    try {
      const res = await replanBatch({
        lenhIds: [...selected],
        chuyenId: batchForm.chuyenId || null,
        ngayKeHoach: batchForm.ngayKeHoach,
        lyDo: batchForm.lyDo.trim(),
      });
      const { okCount, failedCount } = res.data;
      show(failedCount ? `Đã lập lại ${okCount} lệnh, ${failedCount} lỗi` : `Đã lập lại kế hoạch ${okCount} lệnh`,
        failedCount ? 'error' : 'success');
      setBatchOpen(false);
      load();
    } catch (e) {
      show(e.message || 'Lập lại kế hoạch thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!form.ngayKeHoach) { show('Chọn ngày sản xuất kế hoạch', 'error'); return; }
    if (!form.lyDo.trim()) { show('Nhập lý do lập kế hoạch lại', 'error'); return; }
    setSaving(true);
    try {
      await replan(detail.id, {
        chuyenId: form.chuyenId || null,
        ngayKeHoach: form.ngayKeHoach,
        lyDo: form.lyDo.trim(),
      });
      show(`Đã lập lại kế hoạch cho ${detail.ma_lenh_san_xuat}`);
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Lập lại kế hoạch thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    ...(canReplan ? [{ key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)} aria-label="Chọn lệnh" />
      ) }] : []),
    { key: 'ma_lenh_san_xuat', header: 'Mã lệnh', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'giai_doan', header: 'Giai đoạn', render: (r) => (
      r.trang_thai === 'RELEASE_1'
        ? <Badge tone="warning">Test Run</Badge>
        : <Badge tone="success">Release 2</Badge>
    ) },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'so_luong_vai_ve', header: 'SLNV', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_vai_ve) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'chuyen', header: 'Chuyền hiện tại', render: (r) => r.ten_chuyen || '—' },
    { key: 'ngay_ke_hoach', header: 'Ngày SX kế hoạch', render: (r) => fmtDate(r.ngay_ke_hoach) },
  ];

  return (
    <div>
      <Toolbar title="Lập kế hoạch lại" subtitle="Lệnh đang Test Run hoặc đã Release 2 (chưa bắt đầu sản xuất) — đổi chuyền / ngày sản xuất kèm lý do"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {canReplan && selected.size > 0 && (
          <Button onClick={openBatch}>Lập lại kế hoạch ({selected.size})</Button>
        )}
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{meta.total} lệnh</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openDetail} sttStart={(meta.page - 1) * 50}
        emptyText="Không có lệnh nào để lập lại kế hoạch" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Lập lại kế hoạch — ${detail.ma_lenh_san_xuat}` : 'Lập lại kế hoạch'}
        subtitle={detail ? `${detail.ten_khach_hang || ''} · ${detail.mau_vai || ''}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>Đóng</Button>
            <Button onClick={submit} loading={saving} disabled={!canReplan}>Lập lại kế hoạch</Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="Code phần" value={detail.ma_phan} />
              <Info label="Đơn hàng" value={detail.ma_don_hang} />
              <Info label="Mã hàng" value={detail.ma_hang} />
              <Info label="Màu vải" value={detail.mau_vai} />
              <Info label="Kích vải" value={detail.kich_vai} />
              <Info label="Kích phim" value={detail.kich_phim} />
              <Info label="SL nhận vải" value={fmtNum(detail.so_luong_vai_ve)} />
              <Info label="Hạn giao" value={fmtDate(detail.han_giao_hang)} />
            </div>
            <div className="space-y-3 border-t border-line pt-4">
              <Field label="Chuyền in" hint="Mặc định kế thừa chuyền của kế hoạch cũ">
                <Select value={form.chuyenId} onChange={(e) => setForm({ ...form, chuyenId: e.target.value })}>
                  <option value="">— Chọn chuyền —</option>
                  {chuyen.map((c) => <option key={c.id} value={c.id}>{c.ma_chuyen} — {c.ten_chuyen}</option>)}
                </Select>
              </Field>
              <Field label="Ngày sản xuất kế hoạch" required>
                <Input type="date" value={form.ngayKeHoach}
                  onChange={(e) => setForm({ ...form, ngayKeHoach: e.target.value })} />
              </Field>
              <Field label="Lý do lập lại" required>
                <Textarea rows={3} value={form.lyDo}
                  onChange={(e) => setForm({ ...form, lyDo: e.target.value })}
                  placeholder="Vd: không kịp tiến độ, dời ngày sản xuất..." />
              </Field>
            </div>
          </div>
        )}
      </SidePanel>

      <Modal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        title="Lập lại kế hoạch hàng loạt"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBatchOpen(false)}>Hủy</Button>
            <Button onClick={submitBatch} loading={saving}>Lập lại {selected.size} lệnh</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          Áp dụng cùng chuyền / ngày / lý do cho <b>{selected.size}</b> lệnh đã chọn.
        </div>
        <Field label="Chuyền in" hint="Để trống = giữ chuyền hiện tại của từng lệnh">
          <Select value={batchForm.chuyenId} onChange={(e) => setBatchForm({ ...batchForm, chuyenId: e.target.value })}>
            <option value="">— Giữ chuyền hiện tại —</option>
            {chuyen.map((c) => <option key={c.id} value={c.id}>{c.ma_chuyen} — {c.ten_chuyen}</option>)}
          </Select>
        </Field>
        <Field label="Ngày sản xuất kế hoạch" required>
          <Input type="date" value={batchForm.ngayKeHoach}
            onChange={(e) => setBatchForm({ ...batchForm, ngayKeHoach: e.target.value })} />
        </Field>
        <Field label="Lý do lập lại" required>
          <Textarea rows={3} value={batchForm.lyDo}
            onChange={(e) => setBatchForm({ ...batchForm, lyDo: e.target.value })}
            placeholder="Vd: không kịp tiến độ, dời ngày sản xuất..." />
        </Field>
      </Modal>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử kế hoạch (Release 2 + lập lại)" fetcher={planHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã lập lại kế hoạch" maHeader="Lệnh" fetcher={replanDone} />

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
