import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import OwnerHint from '../../../components/common/OwnerHint';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import TraVeBadge from '../../../components/common/TraVeBadge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import TemJourneyPanel from '../../../components/common/TemJourneyPanel';
import QrScanner from '../../../components/common/QrScanner';
import DateRangePicker from '../../../components/common/DateRangePicker';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import HanGiaoCell from '../../../components/common/HanGiaoCell';
import Icon from '../../../components/common/Icon';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listKcsCandidates, recordKcs, gopTem, kcsHistory, kcsDone, getTemHanhTrinh } from '../../../services/qualityService';
import { redryTem, getTemLabel } from '../../../services/productionService';
import { printKcsGiaoTem } from '../../production/utils/printTemLabel';
import { fmtNum, fmtDateTime, baseMaTem } from '../../../utils/format';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';

const empty = { soLuongDat: '', soLuongHu: '', soLuongSua: '', soLuongHuy: '', soLuongThieu: '', soLuongDu: '', soLuongMau: '' };

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'mauVai', label: 'Màu vải' },
  { key: 'kichVai', label: 'Kích vải' },
  { key: 'kichPhim', label: 'Kích phim' },
];
const FIELD_LABEL = { ...Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, f.label])) };

export default function KcsPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canKcs = can('KCS');
  const now = useNow(1000);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [range, setRange] = useState(() => ({ from: '', to: '' }));
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [redry, setRedry] = useState(null); // tem đang phơi lại
  const [redryMin, setRedryMin] = useState('30');
  const [redrying, setRedrying] = useState(false);
  const [onlyReturned, setOnlyReturned] = useState(false); // lọc tem bị OQC trả về
  const [journey, setJourney] = useState(null); // { temId, maTem } — panel hành trình
  const [scanOpen, setScanOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // tem_id đã chọn để GỘP
  const [gopOpen, setGopOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [gopping, setGopping] = useState(false);

  const viewRows = onlyReturned ? rows.filter((r) => r.tra_ve_ly_do) : rows;
  const toggleOne = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = viewRows.length > 0 && viewRows.every((r) => selected.has(r.tem_id));
  const toggleAll = () => setSelected(() => (allSelected ? new Set() : new Set(viewRows.map((r) => r.tem_id))));
  const selectedRows = viewRows.filter((r) => selected.has(r.tem_id));
  const gopMixedPhanIn = selectedRows.length > 1 && new Set(selectedRows.map((r) => r.ma_phan)).size > 1;

  const openGop = () => {
    setTargetId(selectedRows[0]?.tem_id || '');
    setGopOpen(true);
  };
  const doGop = async () => {
    const sources = selectedRows.filter((r) => r.tem_id !== targetId).map((r) => r.tem_id);
    setGopping(true);
    try {
      const r = await gopTem({ targetTemId: targetId, sourceTemIds: sources });
      show(`Đã gộp ${r.data.so_tem_gop} tem vào ${r.data.ma_tem} · +${fmtNum(r.data.sl_gop_them)} pcs → SL mới ${fmtNum(r.data.so_luong_moi)}`);
      setGopOpen(false); setSelected(new Set()); load();
    } catch (e) {
      show(e.message || 'Gộp tem thất bại', 'error');
    } finally {
      setGopping(false);
    }
  };

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const rangeKey = useMemo(() => `${range.from || ''}|${range.to || ''}`, [range]);
  const activeFilters = useMemo(() => Object.entries(filters).filter(([, v]) => v), [filters]);
  const setField = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await listKcsCandidates({ search, ...filters, ngayTu: range.from || undefined, ngayDen: range.to || undefined });
      setRows(res.data);
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filtersKey, rangeKey, show]);

  // In tem GIAO (KCS đã hoàn thành) — cấu trúc tem 1, SL IN = số lượng đã kiểm.
  const printKcsGiao = async (row) => {
    try {
      const res = await getTemLabel(row.tem_id);
      await printKcsGiaoTem({ ...res.data, so_luong: row.so_luong_kiem });
    } catch (e) { show(e.message || 'Không in được tem', 'error'); }
  };

  const doneColumns = [
    { key: 'ma', header: 'Tem', className: 'whitespace-nowrap', render: (r) => <Badge tone="info">{r.ma || '—'}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    { key: 'so_luong_kiem', header: 'SL kiểm', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_kiem) },
    { key: 'so_luong', header: 'SL đạt', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
    { key: 'tg', header: 'Giờ', className: 'whitespace-nowrap tabular-nums', render: (r) => (r.tg ? new Date(r.tg).toLocaleTimeString('vi-VN') : '') },
    { key: 'in_tem', header: '', className: 'text-right', render: (r) => (
      r.tem_id ? <Button variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={() => printKcsGiao(r)}>In tem</Button> : null
    ) },
  ];

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Tự làm mới ngầm mỗi 30s: tem phơi xong (BE tự chuyển sang chờ KCS) sẽ hiện lên mà không cần bấm.
  useEffect(() => {
    const id = setInterval(() => load(true), 30000);
    return () => clearInterval(id);
  }, [load]);

  // Prefill SL đạt = SL còn cần kiểm (con_kcs). Kiểm từng phần nhiều lần.
  const open = (row) => { setEditing(row); setForm({ ...empty, soLuongDat: String(row.con_kcs ?? row.so_luong ?? '') }); };

  // Quét QR (ma_tem) → tra tem đang chờ KCS → mở modal nhập.
  const onScan = async (maTem) => {
    setScanOpen(false);
    const code = baseMaTem(maTem); // QR có thể mã hóa '15-TEM...'; tách lấy mã gốc
    if (!code) return;
    try {
      const res = await listKcsCandidates({ search: code });
      const row = (res.data || []).find((r) => (r.ma_tem || '').toLowerCase() === code.toLowerCase());
      if (row) open(row);
      else show(`Tem ${code} không có phần chờ KCS`, 'error');
    } catch (e) { show(e.message || 'Không tra được tem', 'error'); }
  };

  const doRedry = async () => {
    setRedrying(true);
    try {
      await redryTem(redry.tem_id, Number(redryMin) || 0);
      show(`Đã đưa tem ${redry.ma_tem} phơi lại ${redryMin} phút — hết giờ tự quay lại KCS`);
      setRedry(null);
      setJourney(null);
      load();
    } catch (e) {
      show(e.message || 'Phơi lại thất bại', 'error');
    } finally {
      setRedrying(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await recordKcs(editing.tem_id, form);
      const d = r.data;
      const conLai = Number(d.con_kcs) || 0;
      show(`KCS ${editing.ma_tem}: Đạt ${fmtNum(d.so_luong_dat)}→OQC · Sửa ${fmtNum(d.so_luong_sua)} · Hủy ${fmtNum(d.so_luong_huy)}`
        + (conLai > 0 ? ` · còn ${fmtNum(conLai)} chờ kiểm` : ' · đã kiểm hết'));
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'sel', selection: true,
      header: <input type="checkbox" aria-label="Chọn tất cả" checked={allSelected} onChange={toggleAll} />,
      render: (r) => (
        <input type="checkbox" aria-label="Chọn tem" checked={selected.has(r.tem_id)}
          onClick={(e) => e.stopPropagation()} onChange={() => toggleOne(r.tem_id)} />
      ) },
    { key: 'ma_tem', header: 'Tem', render: (r) => (
      <div>
        <Badge tone="info">{r.ma_tem}</Badge>
        {(r.tra_ve || r.tra_ve_ly_do) && <div className="mt-1"><TraVeBadge data={r.tra_ve || r.tra_ve_ly_do} label="Bị OQC trả về" nguon="OQC" /></div>}
      </div>
    ) },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'ten_chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
    { key: 'nguoi_gio', header: 'Người XN · Giờ in tem', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.nguoi_truoc || '—'}</div>
        <div className="whitespace-nowrap text-[10px] tabular-nums text-ink-soft">{fmtDateTime(r.ngay_in_tem)}</div>
      </div>
    ) },
    { key: 'con_sl', header: 'Còn kiểm · SL in', className: 'text-right tabular-nums', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-primary">{fmtNum(r.con_kcs)}</div>
        <div className="text-[10px] text-ink-soft">SL in {fmtNum(r.so_luong)}</div>
      </div>
    ) },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canKcs && (
        <Button className="px-3 py-1.5" onClick={(e) => { e.stopPropagation(); open(r); }}>Kiểm KCS</Button>
      ) },
  ];

  const N = (k) => (
    <Field label={k.label} key={k.f}>
      <Input type="number" min="0" value={form[k.f]}
        onChange={k.onChange || ((e) => setForm((prev) => ({ ...prev, [k.f]: e.target.value })))} />
    </Field>
  );

  // Nhập "SL hư" → kế thừa sang "Quyết định sửa" (vẫn sửa lại được; không đổi ngược lại SL hư).
  const onChangeHu = (e) => {
    const v = e.target.value;
    setForm((prev) => ({ ...prev, soLuongHu: v, soLuongSua: v }));
  };

  return (
    <div>
      <Toolbar title="KCS — Kiểm tra chất lượng" subtitle="Kiểm theo tem (tem đã khô)"
        search={search} onSearch={setSearch} searchPlaceholder="Quét/nhập mã tem...">
        {canKcs && <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR</Button>}
        {canKcs && selected.size >= 2 && (
          <Button variant="secondary" icon="git-branch" onClick={openGop}>Gộp tem ({selected.size})</Button>
        )}
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span>Ngày in tem</span>
          <div className="w-60"><DateRangePicker value={range} onChange={setRange} placeholder="Chọn khoảng ngày in tem" /></div>
          {(range.from || range.to) && <button type="button" onClick={() => setRange({ from: '', to: '' })} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>}
        </div>
        <Button variant={showFilters || activeFilters.length ? 'secondary' : 'ghost'} icon="filter"
          onClick={() => setShowFilters((v) => !v)}>Bộ lọc{activeFilters.length ? ` (${activeFilters.length})` : ''}</Button>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={onlyReturned} onChange={(e) => setOnlyReturned(e.target.checked)} />
          Chỉ hiện tem bị trả về
        </label>
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{rows.length} tem chờ kiểm</Badge>
      </Toolbar>

      {showFilters && (
        <div className="mb-3 card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={clearFilters}
              disabled={!activeFilters.length}>Xóa lọc</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {FILTER_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</label>
                <input value={filters[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={`Lọc ${f.label.toLowerCase()}...`}
                  className="h-10 w-full rounded-input border border-line bg-surface px-3 text-sm focus:border-primary focus:outline-none" />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {activeFilters.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-3 py-1 text-xs font-medium text-primary">
              {FIELD_LABEL[k]}: {v}
              <button onClick={() => setField(k, '')} className="ml-0.5 hover:text-danger" aria-label="Xóa">
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          <button onClick={clearFilters} className="text-xs font-medium text-ink-soft underline hover:text-danger">Xóa tất cả</button>
        </div>
      )}

      <OwnerHint tram="KIEM" className="mb-3" />

      <DataTable columns={columns} rows={viewRows} loading={loading} rowKey="tem_id"
        onRowClick={(r) => setJourney({ temId: r.tem_id, maTem: r.ma_tem, row: r })}
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có tem nào chờ KCS" />

      <SidePanel
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`KCS — ${editing?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving}>Xác nhận KCS</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {editing?.ma_lenh_san_xuat} · {editing?.phan_list} · SL in {fmtNum(editing?.so_luong)}
          <span className="ml-1 font-semibold text-primary">· còn cần kiểm {fmtNum(editing?.con_kcs)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          {N({ f: 'soLuongDat', label: 'Số lượng đạt' })}
          {N({ f: 'soLuongHu', label: 'Số lượng hư', onChange: onChangeHu })}
          {N({ f: 'soLuongSua', label: 'Quyết định sửa (≤ hư)' })}
          {N({ f: 'soLuongHuy', label: 'Số lượng hủy' })}
          {N({ f: 'soLuongThieu', label: 'Số lượng thiếu' })}
          {N({ f: 'soLuongDu', label: 'Số lượng dư' })}
          {N({ f: 'soLuongMau', label: 'Số lượng mẫu (không tính)' })}
        </div>
        <p className="text-xs text-ink-soft">
          SL kiểm lần này = <b>đạt + hư + hủy</b> ≤ còn cần kiểm. <b>Quyết định sửa</b> (≤ hư, mặc định = hư) → phần hư không sửa sẽ <b>hủy</b>.
          <b>Dư (+) / thiếu (−)</b> điều chỉnh tổng cần kiểm; <b>mẫu không tính</b>. Đạt → chờ <b>OQC</b> · Sửa → <b>Sửa</b> (xong lại qua OQC) · (hư không sửa + hủy) → loại. Phần chưa kiểm giữ lại kiểm lần sau.
        </p>
      </SidePanel>

      <Modal
        open={!!redry}
        onClose={() => setRedry(null)}
        title={`Phơi lại — ${redry?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRedry(null)}>Hủy</Button>
            <Button onClick={doRedry} loading={redrying} disabled={!redryMin || Number(redryMin) <= 0}>Phơi lại</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-soft">
          Đưa tem về <b>đang phơi</b> với thời gian nhập vào. Hết giờ tem <b>tự động quay lại KCS</b>.
        </p>
        <Field label="Thời gian phơi lại (phút)" required>
          <Input type="number" min="1" value={redryMin} onChange={(e) => setRedryMin(e.target.value)} />
        </Field>
      </Modal>

      <Modal
        open={gopOpen}
        onClose={() => setGopOpen(false)}
        title="Gộp tem"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGopOpen(false)}>Hủy</Button>
            <Button onClick={doGop} loading={gopping} disabled={!targetId || selectedRows.length < 2 || gopMixedPhanIn}>Gộp về tem đã chọn</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-soft">
          Chọn <b>tem đích</b> (giữ lại) — số lượng các tem còn lại sẽ dồn về tem này, các tem kia bị <b>hủy</b>. Dùng khi in dư tem do nhập thiếu số lượng.
        </p>
        {gopMixedPhanIn && (
          <div className="mb-3 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
            Các tem đang chọn KHÔNG cùng một phần in — chỉ gộp được tem cùng phần in.
          </div>
        )}
        <div className="space-y-2">
          {selectedRows.map((r) => (
            <label key={r.tem_id}
              className={`flex cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-sm ${targetId === r.tem_id ? 'border-primary bg-primary-wash' : 'border-line'}`}>
              <input type="radio" name="gop-target" checked={targetId === r.tem_id} onChange={() => setTargetId(r.tem_id)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-ink">{r.ma_tem}</span>
                  {targetId === r.tem_id && <Badge tone="info">Tem đích (nhận SL)</Badge>}
                </div>
                <div className="text-xs text-ink-soft">{r.ma_phan || r.ma_hang} · SL in {fmtNum(r.so_luong)} · còn kiểm {fmtNum(r.con_kcs)}</div>
              </div>
            </label>
          ))}
        </div>
        {targetId && !gopMixedPhanIn && (
          <div className="mt-3 rounded-control bg-surface-muted px-3 py-2 text-sm">
            Tem đích <b>{selectedRows.find((r) => r.tem_id === targetId)?.ma_tem}</b> sẽ có SL mới ={' '}
            <b className="text-primary">{fmtNum(selectedRows.reduce((s, r) => s + (Number(r.so_luong) || 0), 0))}</b> pcs
            {' '}(gộp {selectedRows.length - 1} tem).
          </div>
        )}
      </Modal>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử KCS" fetcher={kcsHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Tem đã KCS" maHeader="Tem" fetcher={kcsDone} columns={doneColumns}
        excelColumns={[
          { header: 'Tem', value: (r) => r.ma || '' },
          { header: 'Khách hàng', value: (r) => r.ten_khach_hang || '' },
          { header: 'Mã hàng', value: (r) => r.ma_hang || '' },
          { header: 'Màu vải', value: (r) => r.mau_vai || '' },
          { header: 'Tính chất in', value: (r) => r.tinh_chat_in || '' },
          { header: 'SL kiểm', value: (r) => Number(r.so_luong_kiem) || 0, num: true },
          { header: 'SL đạt', value: (r) => Number(r.so_luong) || 0, num: true },
          { header: 'Hạn giao', value: (r) => r.han_giao_hang || '', type: 'date' },
          { header: 'Người', value: (r) => r.nguoi || '' },
        ]} />
      {journey && (
        <TemJourneyPanel temId={journey.temId} maTem={journey.maTem}
          fetcher={getTemHanhTrinh} onClose={() => setJourney(null)} side="left"
          footer={
            <>
              {canKcs && (
                <Button variant="secondary" icon="clock"
                  onClick={() => { setRedry(journey.row); setRedryMin('30'); }}>Phơi lại</Button>
              )}
              {canKcs && (
                <Button onClick={() => { open(journey.row); setJourney(null); }}>Kiểm KCS</Button>
              )}
            </>
          } />
      )}

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={onScan} />

      <Toast toast={toast} />
    </div>
  );
}
