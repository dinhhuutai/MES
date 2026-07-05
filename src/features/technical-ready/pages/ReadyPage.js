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
import { Field, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import {
  listReadyCandidates, getReadyConfig, confirmReadyBulk, readyHistory, readyDone,
} from '../../../services/readyService';
import ReadyPanel from '../components/ReadyPanel';

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

  const permItems = ITEMS.filter((it) => can(it.perm));
  const viewRows = onlyReturned ? rows.filter((r) => r.tra_ve_ly_do) : rows;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listReadyCandidates({ search, page, limit: 20 });
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
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => (
      <div>
        <div>{r.ten_khach_hang}</div>
        {r.gom_set_list && <Badge tone="info" className="mt-1"><Icon name="git-branch" size={12} className="mr-1" />Gom set {r.gom_set_list}</Badge>}
        {r.tra_ve_ly_do && <Badge tone="danger" className="mt-1" title={r.tra_ve_ly_do}>Bị QC trả về</Badge>}
      </div>
    ) },
    { key: 'ma_don_hang', header: 'Đơn hàng' },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'mau_vai', header: 'Màu vải' },
    { key: 'kich_vai', header: 'Kích vải' },
    { key: 'kich_phim', header: 'Kích phim' },
    { key: 'film_done', header: 'Film', className: 'text-center', render: (r) => DoneCell(r.film_done) },
    { key: 'khuon_done', header: 'Khuôn', className: 'text-center', render: (r) => DoneCell(r.khuon_done) },
    { key: 'muc_done', header: 'Mực', className: 'text-center', render: (r) => DoneCell(r.muc_done) },
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
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{meta.total} chưa READY</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={viewRows} loading={loading} onRowClick={(r) => setSel(r.id)} sttStart={(meta.page - 1) * 20}
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
