import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Modal from '../../../components/common/Modal';
import SearchableSelect from '../../../components/common/SearchableSelect';
import OwnerHint from '../../../components/common/OwnerHint';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import TraVeBadge from '../../../components/common/TraVeBadge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import QrScanner from '../../../components/common/QrScanner';
import DateRangePicker from '../../../components/common/DateRangePicker';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel, { COT_EXCEL_GIO_HT } from '../../../components/common/DonePanel';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import HanGiaoCell from '../../../components/common/HanGiaoCell';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import usePermissions from '../../../hooks/usePermissions';
import { listSuaCandidates, recordSua, suaHistory, suaDone, luuNguoiSua } from '../../../services/qualityService';
import { getTemLabel } from '../../../services/productionService';
import { listUserOptions } from '../../../services/userService';
import { printSuaOqcTem } from '../../production/utils/printTemLabel';
import { fmtNum, baseMaTem, temCode } from '../../../utils/format';

const empty = { soLuongHuyThang: '', soLuongSua: '', soLuongSuaDat: '', soLuongSuaHuy: '' };

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'mauVai', label: 'Màu vải' },
  { key: 'kichVai', label: 'Kích vải' },
  { key: 'kichPhim', label: 'Kích phim' },
];
const FIELD_LABEL = { ...Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, f.label])) };

export default function SuaPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const canSua = can('SUA');

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
  const [scanOpen, setScanOpen] = useState(false);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const rangeKey = useMemo(() => `${range.from || ''}|${range.to || ''}`, [range]);
  const activeFilters = useMemo(() => Object.entries(filters).filter(([, v]) => v), [filters]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await listSuaCandidates({ search, ...filters, ngayTu: range.from || undefined, ngayDen: range.to || undefined });
      setRows(res.data);
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filtersKey, rangeKey, show]);

  const setField = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({});

  const openRow = (row) => { setEditing(row); setForm({ ...empty, soLuongSuaDat: String(row.con_sua || '') }); };

  // ── IN TEM 17 (Sửa đã hoàn thành → OQC) ────────────────────────────────────
  // ⚠⚠ ĐÃ BỎ nút "In tem" ở TỪNG DÒNG (đổi 12/08/2026). Nay: tích 1–2 dòng ở sidebar "Đã hoàn thành"
  //   → nút "In tem" ở CHÂN panel → modal nhập TÊN NGƯỜI SỬA từng dòng → in.
  //   Vì sao: tờ decal vốn là 2-up (2 tem/tờ) — in 1 tem mỗi lần thì tem bên cạnh bỏ trắng, tốn nửa
  //   tờ; và tem 17 dán lô đi giao cần biết AI ĐÃ SỬA, trước đây không có chỗ nào nhập.
  //   Tối đa 2 vì 1 tờ chỉ có 2 khung; tối thiểu 1.
  const [inOpen, setInOpen] = useState(false);
  const [inRows, setInRows] = useState([]);   // dòng đang chuẩn bị in (kèm ô nhập người sửa)
  const [inBusy, setInBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const clearChonRef = useRef(null);           // hàm bỏ tích của DonePanel (nhận qua footerChon)

  useEffect(() => {
    listUserOptions({ limit: 200 })
      .then((r) => setUsers(r.data || []))
      .catch(() => { /* không chặn in tem — ô người sửa vẫn gõ tay được */ });
  }, []);

  const moModalIn = (rows, clear) => {
    clearChonRef.current = clear;
    setInRows(rows.map((r) => ({
      ...r,
      nguoiSua: r.nguoi_sua || '',      // đã in lần trước → điền lại tên cũ
      nguoiSuaId: r.nguoi_sua_id || '',
    })));
    setInOpen(true);
  };

  // Lưu người sửa (mig 080) rồi IN — 1 lần bấm = 1 cửa sổ in cho cả 1–2 tem (popup blocker chỉ cho
  // mở 1 cửa sổ / 1 lượt bấm, xem ghi chú ở `printSuaOqcTem`).
  const doInTem = async () => {
    if (!inRows.length) return;
    if (inRows.some((r) => !String(r.nguoiSua || '').trim())) {
      show('Nhập tên người sửa cho mọi dòng trước khi in', 'error');
      return;
    }
    setInBusy(true);
    try {
      await luuNguoiSua(inRows.map((r) => ({
        suaId: r.sua_id, nguoiSuaId: r.nguoiSuaId || null, nguoiSua: r.nguoiSua,
      })));
      const labels = await Promise.all(inRows.map(async (r) => {
        const res = await getTemLabel(r.tem_id);
        // ⚠ SỐ LIỆU CỦA LƯỢT SỬA ghép ở đây, KHÔNG có trong `getTemLabelData` (backend chỉ biết tem,
        //   không biết đang in lượt sửa nào — 1 tem sửa nhiều lần từng phần). Đây là nguồn của nhóm
        //   trường "Sửa" trong trình Thiết kế tem; thêm trường mới ở `TRUONG_TEM` thì PHẢI thêm ở đây.
        const slSua = Number(r.so_luong_kiem) || 0;
        const slDat = Number(r.so_luong) || 0;
        return {
          ...res.data,
          so_luong: r.so_luong,            // dòng "IN" của nhãn = SL sửa đạt (→ OQC), giữ như cũ
          nguoi_sua: r.nguoiSua,           // NHẬP TAY lúc in
          sl_sua: slSua,
          sl_sua_dat: slDat,
          sl_sua_huy: Number(r.so_luong_sua_huy) || 0,
          ty_le_sua_dat: slSua > 0 ? `${Math.round((slDat / slSua) * 100)}%` : '',
          nguoi_xn_sua: r.nguoi || '',     // người bấm xác nhận sửa trong hệ thống (khác người sửa)
          tg_sua: r.tg || null,
        };
      }));
      await printSuaOqcTem(labels);
      show(`Đã in ${labels.length} tem 17 (sửa đạt → OQC)`);
      setInOpen(false);
      clearChonRef.current?.();
    } catch (e) {
      show(e.message || 'Không in được tem', 'error');
    } finally { setInBusy(false); }
  };

  const doneColumns = [
    { key: 'ma', header: 'Tem', className: 'whitespace-nowrap', render: (r) => <Badge tone="info">{r.ma || '—'}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    { key: 'so_luong_kiem', header: 'SL sửa', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_kiem) },
    { key: 'so_luong', header: 'Sửa đạt', className: 'text-right tabular-nums text-emerald-600', render: (r) => fmtNum(r.so_luong) },
    { key: 'so_luong_sua_huy', header: 'Sửa hủy', className: 'text-right tabular-nums text-rose-600', render: (r) => fmtNum(r.so_luong_sua_huy) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
    { key: 'tg', header: 'Giờ', className: 'whitespace-nowrap tabular-nums', render: (r) => (r.tg ? new Date(r.tg).toLocaleTimeString('vi-VN') : '') },
    // Người sửa đã ghi ở lần in trước (mig 080) — thấy ngay dòng nào đã in, ai sửa.
    { key: 'nguoi_sua', header: 'Người sửa', render: (r) => r.nguoi_sua || '—' },
  ];

  // Quét QR (ma_tem) → tra tem đang chờ sửa → mở modal nhập.
  const onScan = async (maTem) => {
    setScanOpen(false);
    const code = baseMaTem(maTem); // QR có thể mã hóa '16-TEM...'; tách lấy mã gốc
    if (!code) return;
    try {
      const res = await listSuaCandidates({ search: code });
      const row = (res.data || []).find((r) => (r.ma_tem || '').toLowerCase() === code.toLowerCase());
      if (row) openRow(row);
      else show(`Tem ${code} không có phần chờ sửa`, 'error');
    } catch (e) { show(e.message || 'Không tra được tem', 'error'); }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Tự tải lại khi trạm khác xác nhận (tránh màn để lâu → dữ liệu cũ).
  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua `setLoading(true)` (bảng không bị
  // thay bằng spinner) và KHÔNG xóa dòng đang tích. Nhiều sự kiện trong 400ms gộp thành 1 lần tải.
  useSocketReload(['quality:updated'], () => load(true));

  const save = async () => {
    setSaving(true);
    try {
      const r = await recordSua(editing.tem_id, form);
      const conLai = Number(r.data.con_sua) || 0;
      show(`Sửa ${editing.ma_tem}: đạt ${fmtNum(r.data.so_luong_sua_dat)} → OQC`
        + (conLai > 0 ? ` · còn ${fmtNum(conLai)} chờ sửa` : ' · đã sửa hết'));
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'ma_tem', header: 'Tem', render: (r) => (
      <div>
        <Badge tone="info">{r.ma_tem}</Badge>
        {(r.tra_ve || r.tra_ve_ly_do) && <div className="mt-1"><TraVeBadge data={r.tra_ve || r.tra_ve_ly_do} label="Bị OQC trả về" nguon="OQC" /></div>}
      </div>
    ) },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'ten_chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
    { key: 'nha_gia_cong', header: 'Nhà gia công', render: (r) => r.nha_gia_cong || '—' },
    { key: 'ca', header: 'Ca SX', render: (r) => (r.ca ? <Badge tone="default">{r.ca}</Badge> : '—') },
    { key: 'nguoi_truoc', header: 'Người XN trạm trước', render: (r) => r.nguoi_truoc || '—' },
    { key: 'con_sua', header: 'SL cần sửa', className: 'text-right tabular-nums font-semibold',
      render: (r) => <span className="text-amber-600">{fmtNum(r.con_sua)}</span> },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canSua && <Button className="px-3 py-1.5" onClick={() => openRow(r)}>Sửa</Button> },
  ];

  const N = (f, label) => (
    <Field label={label}>
      <Input type="number" min="0" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
    </Field>
  );

  return (
    <div>
      <Toolbar title="Sửa hàng lỗi" subtitle="Xử lý tem lỗi từ KCS / OQC"
        search={search} onSearch={setSearch} searchPlaceholder="Quét/nhập mã tem...">
        {canSua && <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR</Button>}
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span>Ngày in tem</span>
          <div className="w-60"><DateRangePicker value={range} onChange={setRange} placeholder="Chọn khoảng ngày in tem" /></div>
          {(range.from || range.to) && <button type="button" onClick={() => setRange({ from: '', to: '' })} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>}
        </div>
        <Button variant={showFilters || activeFilters.length ? 'secondary' : 'ghost'} icon="filter"
          onClick={() => setShowFilters((v) => !v)}>Bộ lọc{activeFilters.length ? ` (${activeFilters.length})` : ''}</Button>
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{rows.length} tem chờ sửa</Badge>
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

      <OwnerHint tram="SUA" className="mb-3" />

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="tem_id"
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có tem nào chờ sửa" />

      <SidePanel
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Sửa — ${editing?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving}>Xác nhận sửa</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {editing?.ma_lenh_san_xuat} · {editing?.phan_list} · <b className="text-amber-600">SL cần sửa {fmtNum(editing?.con_sua)}</b> (kế thừa từ KCS)
        </div>
        {(editing?.tra_ve || editing?.tra_ve_ly_do) && (
          <div className="mb-3 rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            <b>Bị OQC trả về:</b> {editing.tra_ve?.ly_do || editing.tra_ve_ly_do}
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-4">
          {N('soLuongSuaDat', 'Sửa đạt')}
          {N('soLuongSuaHuy', 'Sửa hủy')}
          {N('soLuongHuyThang', 'Hủy thẳng')}
        </div>
        <p className="text-xs text-ink-soft">Xử lý <b>từng phần</b> (sửa đạt + sửa hủy + hủy thẳng ≤ SL cần sửa). Sửa đạt → quay lại <b>OQC</b>; phần chưa xử lý giữ lại cho lần sau.</p>
      </SidePanel>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử Sửa" fetcher={suaHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Tem đã sửa" maHeader="Tem" fetcher={suaDone} columns={doneColumns}
        chonNhieu toiDaChon={2}
        chonDuoc={(r) => (r.tem_id ? (r.sua_id ? true : 'Thiếu migration 080 — chưa in được tem có tên người sửa') : 'Dòng này không có tem')}
        footerChon={({ rows: sel, clear }) => (
          <>
            <span className="mr-auto text-xs text-ink-soft">
              {sel.length === 0
                ? 'Tích 1–2 dòng để in tem (1 tờ = 2 tem: dòng 1 → tem trái, dòng 2 → tem phải)'
                : `Đã chọn ${sel.length}/2 dòng`}
            </span>
            {sel.length > 0 && <Button variant="ghost" onClick={clear}>Bỏ chọn</Button>}
            <Button icon="printer" disabled={!sel.length} onClick={() => moModalIn(sel, clear)}>
              In tem{sel.length ? ` (${sel.length})` : ''}
            </Button>
          </>
        )}
        excelColumns={[
          { header: 'Tem', value: (r) => r.ma || '' },
          { header: 'Khách hàng', value: (r) => r.ten_khach_hang || '' },
          { header: 'Mã hàng', value: (r) => r.ma_hang || '' },
          { header: 'Màu vải', value: (r) => r.mau_vai || '' },
          { header: 'Tính chất in', value: (r) => r.tinh_chat_in || '' },
          { header: 'SL sửa', value: (r) => Number(r.so_luong_kiem) || 0, num: true },
          { header: 'Sửa đạt', value: (r) => Number(r.so_luong) || 0, num: true },
          { header: 'Sửa hủy', value: (r) => Number(r.so_luong_sua_huy) || 0, num: true },
          { header: 'Hạn giao', value: (r) => r.han_giao_hang || '', type: 'date' },
          COT_EXCEL_GIO_HT,
          { header: 'Người', value: (r) => r.nguoi || '' },
          { header: 'Người sửa', value: (r) => r.nguoi_sua || '' },
        ]} />

      {/* MODAL IN TEM 17 — bảng thông tin các tem sắp in + ô nhập TÊN NGƯỜI SỬA từng dòng.
          Ô nhập dùng `SearchableSelect` (chọn từ tài khoản, tìm không dấu) giống ô Ca trưởng bên
          màn Sản xuất; giá trị lưu là TÊN nên người chưa có tài khoản vẫn in được — gõ tên rồi Enter
          (`chapNhanTuDo`), CHỈ 1 ô nhập cho mỗi dòng. */}
      <Modal open={inOpen} onClose={() => setInOpen(false)} size="xl"
        title={`In tem 17 — ${inRows.length} tem trên 1 tờ`}
        footer={
          <>
            <span className="mr-auto text-xs text-ink-soft">
              {inRows.length === 1
                ? 'In 2 nhãn GIỐNG NHAU trên tờ decal'
                : 'Dòng 1 → tem bên trái · dòng 2 → tem bên phải'}
            </span>
            <Button variant="ghost" onClick={() => setInOpen(false)}>Hủy</Button>
            <Button icon="printer" loading={inBusy} onClick={doInTem}>In tem</Button>
          </>
        }>
        <div className="overflow-auto rounded-card border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-2 py-2 w-8">#</th>
                <th className="px-2 py-2" style={{ minWidth: 210 }}>Người sửa <span className="text-danger">*</span></th>
                <th className="px-2 py-2">Tem (in ra)</th>
                <th className="px-2 py-2">Khách hàng</th>
                <th className="px-2 py-2">Mã hàng</th>
                <th className="px-2 py-2">Code phần</th>
                <th className="px-2 py-2">Màu · Kích</th>
                <th className="px-2 py-2 text-right">SL sửa</th>
                <th className="px-2 py-2 text-right">Sửa đạt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {inRows.map((r, i) => (
                <tr key={r.sua_id || r._k} className="align-top">
                  <td className="px-2 py-2 text-ink-soft">{i + 1}</td>
                  {/* ⚠ CHỈ 1 Ô NHẬP: `chapNhanTuDo` cho gõ tên người chưa có tài khoản (Enter là nhận)
                      nên KHÔNG cần thêm input "hoặc gõ tay" — 2 ô nhập tên cạnh nhau trông như lỗi. */}
                  <td className="px-2 py-2">
                    <SearchableSelect
                      chapNhanTuDo
                      value={r.nguoiSua}
                      onChange={(v) => setInRows((ds) => ds.map((x, j) => (j === i
                        ? { ...x, nguoiSua: v, nguoiSuaId: (users.find((u) => (u.ho_ten || u.ten_dang_nhap) === v) || {}).id || '' }
                        : x)))}
                      options={users}
                      getValue={(u) => u.ho_ten || u.ten_dang_nhap || ''}
                      getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''}
                      getSearch={(u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`}
                      placeholder="Chọn hoặc gõ tên người sửa..."
                    />
                  </td>
                  {/* Mã in ra mang tiền tố 17 (sửa đạt → giao) — đúng cái sẽ hiện trên nhãn giấy. */}
                  <td className="px-2 py-2"><Badge tone="info">{temCode(r.ma, 17)}</Badge></td>
                  <td className="px-2 py-2">{r.ten_khach_hang || '—'}</td>
                  <td className="px-2 py-2">{r.ma_hang || '—'}</td>
                  <td className="px-2 py-2">{r.ma_phan || '—'}</td>
                  <td className="px-2 py-2">
                    <div>{r.mau_vai || '—'}</div>
                    <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtNum(r.so_luong_kiem)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-emerald-600">{fmtNum(r.so_luong)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={onScan} />

      <Toast toast={toast} />
    </div>
  );
}
