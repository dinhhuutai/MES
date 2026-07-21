import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
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
import DonePanel from '../../../components/common/DonePanel';
import { Field, Textarea } from '../../../components/common/controls';
import { listReadyQcCandidates, getReadyDetail, confirmReadyQC, confirmReadyQcBatch, readyHistory, readyDone, returnReadyToTech } from '../../../services/readyService';
import LoaiDotVaiBadge from '../../planning/components/LoaiDotVaiBadge';
import HanGiaoCell from '../../../components/common/HanGiaoCell';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import exportReadyQcExcel from '../utils/exportReadyQcExcel';

// Thứ tự hiển thị: FILM → KHUÔN → MỰC (HSKT đã bỏ khỏi checklist READY).
const TECH_ITEMS = [
  { ma: 'FILM', label: 'Film' },
  { ma: 'KHUON', label: 'Khuôn' },
  { ma: 'MUC', label: 'Mực' },
];

const fmt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' }, { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' }, { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' }, { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];

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
  const [doneOpen, setDoneOpen] = useState(false);
  // Trả về kỹ thuật (chọn checklist rớt + lý do)
  const [returnMode, setReturnMode] = useState(false);
  const [returnChecklists, setReturnChecklists] = useState(() => new Set());
  const [returnReason, setReturnReason] = useState('');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;
  const filtered = useMemo(() => filterRows(rows, filters, FILTER_FIELDS), [rows, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // load-all để lọc client trọn vẹn; DataTable tự phân trang 20/trang (dữ liệu nhỏ).
      const res = await listReadyQcCandidates({ search, page, limit: 500 });
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

  const open = async (row, asReturn = false) => {
    setEditing(row);
    setDetail(null);
    setLoadingDetail(true);
    setReturnMode(asReturn);
    setReturnChecklists(new Set());
    setReturnReason('');
    try {
      const res = await getReadyDetail(row.id);
      setDetail(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải chi tiết', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleReturnItem = (ma) => setReturnChecklists((s) => {
    const next = new Set(s);
    if (next.has(ma)) next.delete(ma); else next.add(ma);
    return next;
  });

  const doReturn = async () => {
    if (returnChecklists.size === 0) { show('Chọn ít nhất 1 mục không đạt', 'error'); return; }
    if (!returnReason.trim()) { show('Nhập lý do trả về', 'error'); return; }
    setSaving(true);
    try {
      await returnReadyToTech(editing.id, { checklists: [...returnChecklists], lyDo: returnReason.trim() });
      show(`Đã trả ${editing.ma_phan} về kỹ thuật`);
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Trả về thất bại', 'error');
    } finally {
      setSaving(false);
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

  // QC chỉ xác nhận được khi kỹ thuật đã đủ 3 mục.
  const isReady = (r) => (r.n_tech_done || 0) >= 3;
  const readyRows = rows.filter(isReady);

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = readyRows.length > 0 && readyRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(readyRows.map((r) => r.id))));

  const [exporting, setExporting] = useState(false);
  const doExport = async () => {
    if (filtered.length === 0) { show('Không có dòng nào để xuất', 'error'); return; }
    setExporting(true);
    try { await exportReadyQcExcel(filtered); }
    catch (e) { show(e.message || 'Xuất Excel thất bại', 'error'); }
    finally { setExporting(false); }
  };

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
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => r.ma_phan || '—' },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
        {r.gom_set_list && <Badge tone="info" className="mt-1" title="Gom set: phần in này được gom in chung với các phần in KHÁC (cùng màu). ≠ Gộp đợt (cùng phần in, khác đợt)."><Icon name="git-branch" size={12} className="mr-1" />Gom set {r.gom_set_list}</Badge>}
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
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
      <Toolbar title="QC chuẩn bị kỹ thuật" subtitle="Toàn bộ phần in ở READY — QC xác nhận khi đủ Khuôn/Film/Mực (SLA nghẽn QC chỉ tính sau khi kỹ thuật đủ 3 mục)"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, mã hàng, màu/kích vải, kích phim...">
        {canQC && <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét / tích mã</Button>}
        {canQC && selected.size > 0 && (
          <Button loading={batching} onClick={doBatch}>QC xác nhận ({selected.size})</Button>
        )}
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="secondary" icon="file-spreadsheet" loading={exporting} onClick={doExport}>Excel ({filtered.length})</Button>
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{readyRows.length} đủ 3 mục · {meta.total} ở READY</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={(r) => open(r)} sttStart={0}
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có phần in nào ở READY" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <SidePanel
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`QC READY — ${editing?.ma_phan || ''}`}
        subtitle={editing ? [editing.ten_khach_hang, editing.ma_don_hang, editing.ma_hang, editing.mau_vai].filter(Boolean).join(' · ') : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Đóng</Button>
            {returnMode ? (
              <Button variant="danger" onClick={doReturn} loading={saving}
                disabled={!canQC || loadingDetail || returnChecklists.size === 0 || !returnReason.trim()}>
                Trả về kỹ thuật ({returnChecklists.size})
              </Button>
            ) : (
              <Button onClick={doConfirm} loading={saving} disabled={!canQC || loadingDetail || !techDone}>
                QC xác nhận
              </Button>
            )}
          </>
        }
      >
        {loadingDetail ? (
          <div className="py-6 text-center text-ink-soft">Đang tải...</div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Kết quả kỹ thuật</h3>
              {canQC && (
                <button type="button" onClick={() => { setReturnMode((v) => !v); setReturnChecklists(new Set()); setReturnReason(''); }}
                  className={`text-xs font-medium ${returnMode ? 'text-ink-soft hover:underline' : 'text-danger hover:underline'}`}>
                  {returnMode ? '← QC xác nhận' : 'Trả về kỹ thuật'}
                </button>
              )}
            </div>
            {returnMode && (
              <p className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                Tick các mục <b>không đạt</b> để trả về cho bộ phận kỹ thuật làm lại (kèm lý do bắt buộc).
              </p>
            )}
            {TECH_ITEMS.map((it) => {
              const cp = byMa[it.ma];
              const done = cp?.trang_thai === 'DAT';
              return (
                <div key={it.ma} className="rounded-control border border-line px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      {returnMode && (
                        <input type="checkbox" checked={returnChecklists.has(it.ma)}
                          onChange={() => toggleReturnItem(it.ma)} aria-label={`Trả về ${it.label}`} />
                      )}
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
                  {!returnMode && !done && <OwnerHint checkpoint={it.ma} className="mt-1.5" />}
                </div>
              );
            })}
            {returnMode ? (
              <Field label="Lý do trả về" required>
                <Textarea rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Vì sao trả về kỹ thuật (vd: film mờ, sai khuôn...)" />
              </Field>
            ) : (
              <>
                {techDone && <OwnerHint checkpoint="QC_XAC_NHAN" className="pt-1" />}
                {techDone
                  ? <p className="pt-1 text-xs text-ink-soft">QC xác nhận → READY hoàn thành, cho phép Release 1.</p>
                  : <p className="pt-1 text-xs font-medium text-warning">Kỹ thuật chưa xác nhận đủ 3 mục — QC chưa thể xác nhận.</p>}
              </>
            )}
          </div>
        )}
      </SidePanel>

      <ScanCollectModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Quét / tích phần in — QC READY"
        help="Máy tính: tích barcode. Điện thoại/pad: quét QR code phần. Chỉ chọn được phần in đã đủ 3 mục kỹ thuật. Quét nhiều rồi bấm QC xác nhận cùng lúc; mỗi dòng có nút Trả về nếu cần trả kỹ thuật."
        rows={readyRows}
        getId={(r) => r.id}
        getCodes={(r) => [r.ma_phan]}
        getBarcodes={(r) => [r.barcode]}
        matchMultiple={false}
        isSelected={(r) => selected.has(r.id)}
        onToggle={(r) => toggleOne(r.id)}
        primaryLabel={(r) => r.ma_phan || r.barcode || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.ma_hang, r.mau_vai].filter(Boolean).join(' · ')}
        rowAction={{ label: 'Trả về', icon: 'log-out', onClick: (r) => { setScanOpen(false); open(r, true); } }}
        onConfirm={() => { setScanOpen(false); doBatch(); }}
        confirmLabel="QC xác nhận"
      />

      <HistoryPanel
        open={histOpen}
        onClose={() => setHistOpen(false)}
        title="Lịch sử QC chuẩn bị kỹ thuật"
        fetcher={(date) => readyHistory(date, 'qc')}
      />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Phần in đã QC (READY hoàn thành)" maHeader="Phần in"
        fetcher={(date) => readyDone(date, 'qc')} />

      <Toast toast={toast} />
    </div>
  );
}
