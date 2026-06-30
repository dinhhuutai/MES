import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listCongNo, getCongNo, saveCongNo, confirmCongNo, congNoHistory } from '../../../services/financeService';
import { fmtNum, fmtCurrency } from '../../../utils/format';

const LIMIT = 20;
const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');
const STATUS = [
  { key: '', label: 'Tất cả' },
  { key: 'CHUA', label: 'Chưa đóng' },
  { key: 'CLOSED_FINANCE', label: 'Đã đóng' },
];

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export default function CongNoPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('FINANCE_MANAGE');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [histOpen, setHistOpen] = useState(false);

  // Side panel chi tiết
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ tongTien: '', daThu: '', ghiChu: '' });
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCongNo({ search, status, page, limit: LIMIT });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, status, page, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const open = async (r) => {
    setConfirming(false);
    setDetail({ don_hang_id: r.don_hang_id, loading: true });
    try {
      const res = await getCongNo(r.don_hang_id);
      setDetail(res.data);
      setForm({
        tongTien: res.data.tong_tien ?? '',
        daThu: res.data.da_thu ?? '',
        ghiChu: res.data.ghi_chu ?? '',
      });
    } catch (e) {
      show(e.message || 'Lỗi tải chi tiết', 'error');
      setDetail(null);
    }
  };

  const closed = detail && detail.trang_thai_cong_no === 'CLOSED_FINANCE';

  const save = async () => {
    setSaving(true);
    try {
      await saveCongNo(detail.don_hang_id, {
        tongTien: form.tongTien === '' ? null : Number(form.tongTien),
        daThu: form.daThu === '' ? 0 : Number(form.daThu),
        ghiChu: form.ghiChu || null,
      });
      show('Đã lưu công nợ');
      await open({ don_hang_id: detail.don_hang_id });
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    setSaving(true);
    try {
      await confirmCongNo(detail.don_hang_id);
      show('Đã đóng tài chính đơn hàng');
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  const conLai = (r) => {
    if (r.tong_tien == null) return null;
    return Number(r.tong_tien) - Number(r.da_thu || 0);
  };

  const columns = [
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink' },
    { key: 'ma_don_hang', header: 'Đơn hàng',
      render: (r) => <div><div className="text-ink">{r.ma_don_hang}</div><div className="text-xs text-ink-soft">{r.so_po}</div></div> },
    { key: 'so_phan_in', header: 'Phần in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_phan_in) },
    { key: 'tong_sl', header: 'Tổng SL', className: 'text-right tabular-nums', render: (r) => fmtNum(r.tong_sl) },
    { key: 'tong_tien', header: 'Tổng công nợ', className: 'text-right',
      render: (r) => r.tong_tien == null ? <Badge tone="warning">Chưa nhập</Badge> : fmtCurrency(r.tong_tien) },
    { key: 'da_thu', header: 'Đã thu', className: 'text-right tabular-nums', render: (r) => r.tong_tien == null ? '—' : fmtCurrency(r.da_thu) },
    { key: 'con_lai', header: 'Còn lại', className: 'text-right',
      render: (r) => { const c = conLai(r); return c == null ? '—' : <span className={c > 0 ? 'font-medium text-danger' : 'font-medium text-emerald-600'}>{fmtCurrency(c)}</span>; } },
    { key: 'trang_thai_cong_no', header: 'Trạng thái',
      render: (r) => r.trang_thai_cong_no === 'CLOSED_FINANCE'
        ? <Badge tone="success">Đã đóng TC</Badge>
        : <Badge tone="default">Chưa đóng</Badge> },
  ];

  return (
    <div>
      <Toolbar title="Công nợ" subtitle="Nhập công nợ & đóng tài chính theo đơn hàng (CLOSED_FINANCE)"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm khách hàng, đơn hàng, mã hàng...">
        <div className="flex rounded-control border border-line p-0.5">
          {STATUS.map((s) => (
            <button key={s.key} onClick={() => { setStatus(s.key); setPage(1); }}
              className={`rounded-[10px] px-3 py-1.5 text-sm transition ${status === s.key ? 'bg-primary text-white' : 'text-ink-soft hover:bg-surface-muted'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="default">Tổng {meta.total}</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="don_hang_id"
        sttStart={(meta.page - 1) * LIMIT} onRowClick={open} emptyText="Không có đơn hàng" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.ma_don_hang ? `Công nợ — ${detail.ma_don_hang}` : 'Công nợ'}
        subtitle={detail?.ten_khach_hang}
      >
        {!detail?.ma_don_hang ? (
          <div className="py-10 text-center text-ink-soft">Đang tải...</div>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Đơn hàng</h3>
              <Row label="Khách hàng" value={detail.ten_khach_hang} />
              <Row label="Đơn hàng" value={`${detail.ma_don_hang} · ${detail.so_po || '—'}`} />
              {detail.ten_don_hang && <Row label="Tên đơn" value={detail.ten_don_hang} />}
            </section>

            {closed ? (
              <section className="rounded-control border border-emerald-200 bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Badge tone="success">Đã đóng tài chính</Badge>
                </div>
                <Row label="Tổng công nợ" value={fmtCurrency(detail.tong_tien)} />
                <Row label="Đã thu" value={fmtCurrency(detail.da_thu)} />
                <Row label="Còn lại" value={fmtCurrency(Number(detail.tong_tien) - Number(detail.da_thu || 0))} />
                <Row label="Ghi chú" value={detail.ghi_chu || '—'} />
                <Row label="Người xác nhận" value={detail.nguoi_xac_nhan || '—'} />
                <Row label="Thời gian" value={fmtDt(detail.ngay_xac_nhan)} />
              </section>
            ) : (
              <section className="space-y-3 border-t border-line pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Nhập công nợ</h3>
                <Field label="Tổng công nợ (₫)">
                  <Input type="number" min="0" value={form.tongTien} disabled={!canManage}
                    onChange={(e) => setForm((f) => ({ ...f, tongTien: e.target.value }))} placeholder="Nhập tổng công nợ" />
                </Field>
                <Field label="Đã thu (₫)">
                  <Input type="number" min="0" value={form.daThu} disabled={!canManage}
                    onChange={(e) => setForm((f) => ({ ...f, daThu: e.target.value }))} placeholder="0" />
                </Field>
                <Field label="Ghi chú">
                  <Input value={form.ghiChu} disabled={!canManage}
                    onChange={(e) => setForm((f) => ({ ...f, ghiChu: e.target.value }))} placeholder="Ghi chú công nợ" />
                </Field>

                {canManage && (
                  <div className="flex flex-col gap-2 pt-2">
                    <Button variant="secondary" onClick={save} loading={saving}
                      disabled={form.tongTien !== '' && Number(form.tongTien) < 0}>Lưu công nợ</Button>

                    {!confirming ? (
                      <Button onClick={() => setConfirming(true)} disabled={form.tongTien === '' || detail.tong_tien == null}>
                        Xác nhận đóng tài chính
                      </Button>
                    ) : (
                      <div className="rounded-control border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/30">
                        <p className="mb-2 text-sm text-ink">Đóng tài chính đơn này? Sau khi đóng sẽ <b>không sửa được</b> và đơn hoàn tất (CLOSED_FINANCE).</p>
                        <div className="flex gap-2">
                          <Button variant="ghost" onClick={() => setConfirming(false)}>Hủy</Button>
                          <Button onClick={confirm} loading={saving}>Xác nhận đóng</Button>
                        </div>
                      </div>
                    )}
                    {detail.tong_tien == null && (
                      <p className="text-xs text-ink-soft">* Lưu tổng công nợ trước khi đóng tài chính.</p>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </SidePanel>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử đóng tài chính" fetcher={congNoHistory} />

      <Toast toast={toast} />
    </div>
  );
}
