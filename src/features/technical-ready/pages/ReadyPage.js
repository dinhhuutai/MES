import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import { Field, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import TraVeBadge from '../../../components/common/TraVeBadge';
import {
  listReadyCandidates, getReadyConfig, confirmReadyBulk, readyHistory, readyDone, getReadyItemCounts,
} from '../../../services/readyService';
import ReadyPanel from '../components/ReadyPanel';
import LoaiDotVaiBadge from '../../planning/components/LoaiDotVaiBadge';

const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' }, { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' }, { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' }, { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];

const STATUS = {
  CHUA: { tone: 'default', label: 'Chưa làm' },
  DANG: { tone: 'warning', label: 'Đang chuẩn bị' },
  CHO_QC: { tone: 'info', label: 'Chờ QC' },
  DONE: { tone: 'success', label: 'Hoàn thành' },
};

// Thứ tự hiển thị/thao tác: FILM → KHUÔN → MỰC (HSKT đã bỏ khỏi checklist READY).
const ITEMS = [
  { ma: 'FILM', label: 'Film', perm: 'READY_FILM', hasOptions: true },
  { ma: 'KHUON', label: 'Khuôn', perm: 'READY_KHUON', hasOptions: true },
  { ma: 'MUC', label: 'Mực', perm: 'READY_MUC', hasOptions: true },
];

const DoneCell = (done) =>
  done ? <Badge tone="success">✓</Badge> : <span className="text-ink-soft">–</span>;

export default function ReadyPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState(null);

  const [selected, setSelected] = useState(() => new Set());
  const [optionsByMa, setOptionsByMa] = useState({});
  const [bulk, setBulk] = useState(null); // { ma, value }
  const [bulkSaving, setBulkSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [onlyReturned, setOnlyReturned] = useState(false); // lọc phần bị QC trả về
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [counts, setCounts] = useState({ khuon: 0, film: 0, muc: 0 }); // chưa xác nhận từng mục (toàn hệ thống)

  const permItems = ITEMS.filter((it) => can(it.perm));
  const activeCount = Object.values(filters).filter(Boolean).length;
  const viewRows = filterRows(onlyReturned ? rows.filter((r) => r.tra_ve_ly_do) : rows, filters, FILTER_FIELDS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // limit cao để lọc client-side trọn vẹn (dữ liệu READY nhỏ); phân trang tự ẩn khi 1 trang.
      const res = await listReadyCandidates({ search, page, limit: 200 });
      setRows(res.data.items);
      setMeta(res.data.meta);
      setSelected(new Set());
      // Số chưa xác nhận từng mục — TOÀN HỆ THỐNG (không theo trang/lọc hiện tại).
      getReadyItemCounts().then((c) => setCounts(c.data)).catch(() => {});
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

  // Nạp options cho Khuôn/Film/Mực (1 lần) để bulk chọn giá trị.
  useEffect(() => {
    getReadyConfig().then((r) => {
      const m = {};
      (r.data.checkpoints || []).forEach((c) => { m[c.ma_checkpoint] = c.options || []; });
      setOptionsByMa(m);
    }).catch(() => {});
  }, []);

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(rows.map((r) => r.id))));

  const openBulk = () => setBulk({ ma: permItems[0]?.ma || '', value: '' });
  const bulkItem = ITEMS.find((it) => it.ma === bulk?.ma);

  const doBulk = async () => {
    setBulkSaving(true);
    try {
      const res = await confirmReadyBulk({ phanInIds: [...selected], ma: bulk.ma, value: bulk.value || undefined });
      const { okCount, skippedCount } = res.data;
      show(`Đã xác nhận ${okCount} phần in${skippedCount ? `, bỏ qua ${skippedCount}` : ''}`);
      setBulk(null);
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  const columns = [
    ...(permItems.length ? [{
      key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()} onChange={() => toggleOne(r.id)} aria-label="Chọn" />
      ),
    }] : []),
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => (
      <div>
        <div>{r.ma_phan || '—'}</div>
        {r.gom_set_list && <Badge tone="info" className="mt-1" title="Gom set: phần in này được gom in chung với các phần in KHÁC (cùng màu). ≠ Gộp đợt (cùng phần in, khác đợt)."><Icon name="git-branch" size={12} className="mr-1" />Gom set {r.gom_set_list}</Badge>}
        {(r.tra_ve || r.tra_ve_ly_do) && <div className="mt-1"><TraVeBadge data={r.tra_ve || r.tra_ve_ly_do} label="Bị QC trả về" nguon="QC" /></div>}
      </div>
    ) },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'film_done', header: `Film${counts.film ? ` (${counts.film})` : ''}`, className: 'text-center', render: (r) => DoneCell(r.film_done) },
    { key: 'khuon_done', header: `Khuôn${counts.khuon ? ` (${counts.khuon})` : ''}`, className: 'text-center', render: (r) => DoneCell(r.khuon_done) },
    { key: 'muc_done', header: `Mực${counts.muc ? ` (${counts.muc})` : ''}`, className: 'text-center', render: (r) => DoneCell(r.muc_done) },
    { key: 'trang_thai_ready', header: 'Trạng thái', render: (r) => {
      const s = STATUS[r.trang_thai_ready] || STATUS.CHUA;
      return <Badge tone={s.tone}>{s.label}</Badge>;
    } },
  ];

  return (
    <div>
      <Toolbar title="Chuẩn bị kỹ thuật — READY" subtitle="Xác nhận film / khuôn / mực trước khi Release"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, mã hàng, màu/kích vải, kích phim...">
        {permItems.length > 0 && selected.size > 0 && (
          <Button onClick={openBulk}>Xác nhận hàng loạt ({selected.size})</Button>
        )}
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={onlyReturned} onChange={(e) => setOnlyReturned(e.target.checked)} />
          Chỉ hiện phần bị trả về
        </label>
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{activeCount ? `${viewRows.length}/` : ''}{meta.total} chưa READY</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      <DataTable columns={columns} rows={viewRows} loading={loading} onRowClick={(r) => setSel(r.id)} sttStart={(meta.page - 1) * 200}
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Tất cả phần in đã READY 🎉" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      {sel && (
        <ReadyPanel phanInId={sel} onClose={() => setSel(null)} onChanged={load} />
      )}

      <Modal
        open={!!bulk}
        onClose={() => setBulk(null)}
        title={`Xác nhận hàng loạt — ${selected.size} phần in`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulk(null)}>Hủy</Button>
            <Button onClick={doBulk} loading={bulkSaving}
              disabled={!bulk?.ma || (bulkItem?.hasOptions && !bulk?.value)}>
              Xác nhận
            </Button>
          </>
        }
      >
        <Field label="Mục cần xác nhận" required>
          <Select value={bulk?.ma || ''} onChange={(e) => setBulk({ ma: e.target.value, value: '' })}>
            {permItems.map((it) => <option key={it.ma} value={it.ma}>{it.label}</option>)}
          </Select>
        </Field>
        {bulkItem?.hasOptions && (
          <Field label="Giá trị" required>
            <Select value={bulk?.value || ''} onChange={(e) => setBulk({ ...bulk, value: e.target.value })}>
              <option value="">— Chọn —</option>
              {(optionsByMa[bulk.ma] || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
        )}
        <p className="text-xs text-ink-soft">
          Áp cho {selected.size} phần in đã chọn. Phần in đã xác nhận mục này (hoặc đã QC) sẽ được bỏ qua.
        </p>
      </Modal>

      <HistoryPanel
        open={histOpen}
        onClose={() => setHistOpen(false)}
        title="Lịch sử xác nhận kỹ thuật"
        fetcher={(date) => readyHistory(date, 'tech')}
      />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Phần in đã hoàn tất kỹ thuật (3 mục)" maHeader="Phần in"
        fetcher={(date) => readyDone(date, 'tech')} />

      <Toast toast={toast} />
    </div>
  );
}
