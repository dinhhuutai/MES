import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import OwnerHint from '../../../components/common/OwnerHint';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import HistoryPanel from '../../../components/common/HistoryPanel';
import { listReadyQcCandidates, getReadyDetail, confirmReadyQC, confirmReadyQcBatch, readyHistory } from '../../../services/readyService';

const TECH_ITEMS = [
  { ma: 'KHUON', label: 'Khuôn' },
  { ma: 'FILM', label: 'Film' },
  { ma: 'MUC', label: 'Mực' },
  { ma: 'HSKT', label: 'HSKT' },
];

const fmt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

export default function ReadyQcPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canQC = can('READY_QC');
  const now = useNow(1000);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(null); // phần in row
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // id phần in đã tích
  const [batching, setBatching] = useState(false);
  const [histOpen, setHistOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listReadyQcCandidates({ search, page, limit: 20 });
      setRows(res.data.items);
      setMeta(res.data.meta);
      setSelected(new Set());
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const open = async (row) => {
    setEditing(row);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await getReadyDetail(row.id);
      setDetail(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải chi tiết', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const doConfirm = async () => {
    setSaving(true);
    try {
      await confirmReadyQC(editing.id);
      show(`QC xác nhận ${editing.ma_phan} — READY hoàn thành 🎉`);
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const byMa = (detail?.checkpoints || []).reduce((acc, c) => ({ ...acc, [c.ma_checkpoint]: c }), {});
  const techDone = detail?.state?.tech_done === true;

  // QC chỉ xác nhận được khi kỹ thuật đã đủ 4 mục.
  const isReady = (r) => (r.n_tech_done || 0) >= 4;
  const readyRows = rows.filter(isReady);

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = readyRows.length > 0 && readyRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(readyRows.map((r) => r.id))));

  const doBatch = async () => {
    setBatching(true);
    try {
      const res = await confirmReadyQcBatch([...selected]);
      const { okCount, failedCount } = res.data;
      show(failedCount ? `QC xác nhận ${okCount} phần in, ${failedCount} lỗi` : `Đã QC xác nhận ${okCount} phần in 🎉`,
        failedCount ? 'error' : 'success');
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setBatching(false);
    }
  };

  const columns = [
    { key: 'sel', className: 'w-10', selection: true,
      header: canQC ? (
        <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả (đủ kỹ thuật)" />
      ) : '',
      render: (r) => canQC && isReady(r) && (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)} aria-label="Chọn phần in" />
      ) },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => (
      <div>
        <div>{r.ten_khach_hang}</div>
        {r.gom_set_list && <Badge tone="info" className="mt-1"><Icon name="git-branch" size={12} className="mr-1" />Gom set {r.gom_set_list}</Badge>}
      </div>
    ) },
    { key: 'ma_don_hang', header: 'Đơn hàng' },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'mau_vai', header: 'Màu vải' },
    { key: 'kich_vai', header: 'Kích vải' },
    { key: 'kich_phim', header: 'Kích phim' },
    { key: 'tech', header: 'Kỹ thuật', render: (r) => (
      <div className="flex flex-wrap items-center gap-1">
        {TECH_ITEMS.map((it) => {
          const done = r[`${it.ma.toLowerCase()}_done`];
          return <Badge key={it.ma} tone={done ? 'success' : 'default'}>{it.label}</Badge>;
        })}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="QC chuẩn bị kỹ thuật" subtitle="Phần in đã đủ 4 mục kỹ thuật — chờ QC xác nhận"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, mã hàng, màu/kích vải, kích phim...">
        {canQC && selected.size > 0 && (
          <Button loading={batching} onClick={doBatch}>QC xác nhận ({selected.size})</Button>
        )}
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{meta.total} chờ QC</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => open(r)} sttStart={(meta.page - 1) * 20}
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có phần in nào chờ QC" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <SidePanel
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`QC READY — ${editing?.ma_phan || ''}`}
        subtitle={editing ? [editing.ten_khach_hang, editing.ma_don_hang, editing.ma_hang, editing.mau_vai].filter(Boolean).join(' · ') : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={doConfirm} loading={saving} disabled={!canQC || loadingDetail || !techDone}>
              QC xác nhận
            </Button>
          </>
        }
      >
        {loadingDetail ? (
          <div className="py-6 text-center text-ink-soft">Đang tải...</div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Kết quả kỹ thuật</h3>
            {TECH_ITEMS.map((it) => {
              const cp = byMa[it.ma];
              const done = cp?.trang_thai === 'DAT';
              return (
                <div key={it.ma} className="rounded-control border border-line px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">
                      {it.label}
                      {cp?.gia_tri_text ? <span className="ml-2 font-normal text-ink-soft">({cp.gia_tri_text})</span> : null}
                    </span>
                    <div className="flex items-center gap-2">
                      {done && (cp?.nguoi_xac_nhan_ten || cp?.tg_xac_nhan) ? (
                        <span className="text-right text-xs text-ink-soft">
                          {cp.nguoi_xac_nhan_ten ? <span className="block font-medium text-ink">{cp.nguoi_xac_nhan_ten}</span> : null}
                          {cp.tg_xac_nhan ? <span className="block">{fmt(cp.tg_xac_nhan)}</span> : null}
                        </span>
                      ) : null}
                      <Badge tone={done ? 'success' : 'default'}>{done ? 'Đã xác nhận' : 'Chưa'}</Badge>
                    </div>
                  </div>
                  {!done && <OwnerHint checkpoint={it.ma} className="mt-1.5" />}
                </div>
              );
            })}
            {techDone && <OwnerHint checkpoint="QC_XAC_NHAN" className="pt-1" />}
            {techDone
              ? <p className="pt-1 text-xs text-ink-soft">QC xác nhận → READY hoàn thành, cho phép Release 1.</p>
              : <p className="pt-1 text-xs font-medium text-warning">Kỹ thuật chưa xác nhận đủ 4 mục — QC chưa thể xác nhận.</p>}
          </div>
        )}
      </SidePanel>

      <HistoryPanel
        open={histOpen}
        onClose={() => setHistOpen(false)}
        title="Lịch sử QC chuẩn bị kỹ thuật"
        fetcher={(date) => readyHistory(date, 'qc')}
      />

      <Toast toast={toast} />
    </div>
  );
}
