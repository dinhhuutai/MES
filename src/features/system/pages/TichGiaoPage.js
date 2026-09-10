import { useCallback, useEffect, useMemo, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import DateRangePicker from '../../../components/common/DateRangePicker';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import { fmtNum, fmtDateTime, temCode, laMaTemRieng } from '../../../utils/format';
import {
  listTemChoTich, tichTemGiao, boTichTemGiao, traCuuTemTich,
} from '../../../services/deliveryService';

// ─────────────────────────────────────────────────────────────────────────────
// TÍCH TEM GIAO HÀNG (mig 092) — chốt chặn giữa OQC và màn *Giao hàng*.
// Bán hàng soát rồi TÍCH những tem thực sự xuất chuyến này; tem chưa tích KHÔNG hiện ở màn Giao.
//
// ⚠ Trang đặt ở module **Hệ thống** theo yêu cầu người dùng (bán hàng không thuộc tổ giao hàng).
// ⚠ Quyền: `TICH_GIAO` (mới, mig 092) HOẶC `DELIVERY_MANAGE` — xem ghi chú ở `delivery.routes.js`.
// ─────────────────────────────────────────────────────────────────────────────

const FILTER_FIELDS = [
  { key: 'tem', label: 'Mã tem' },
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'mauVai', label: 'Màu vải' },
  { key: 'kichVai', label: 'Kích vải' },
  { key: 'kichPhim', label: 'Kích phim' },
];

// ⚠⚠ NHÃN GIẤY MANG TIỀN TỐ CÔNG ĐOẠN, DB LƯU MÃ GỐC: người quét cầm nhãn `16…`/`17…` trong khi
//   `tem.ma_tem` của tem gốc là `15…`. Khai ĐỦ biến thể để `ScanCollectModal` khớp exact ngay lượt
//   đầu, khỏi rơi xuống lượt khớp lỏng.
// ⚠⚠⚠ CHỈ SINH BIẾN THỂ CHO TEM GỐC (mã dãy `15`). Từ 06/09/2026 tem 17 (tem con) và tem 13 (gia
//   công về) mang mã RIÊNG do ERP cấp — sinh biến thể `15…` từ chúng là bịa ra một mã của DÃY KHÁC,
//   có thể va vào tem thật của lô khác rồi tích nhầm hàng đi giao. Mã của chúng đã đúng nhãn giấy.
const maQuetCuaTem = (r) => {
  if (!r || !r.ma_tem) return [];
  const ma = String(r.ma_tem);
  if (r.la_tem_sua || laMaTemRieng(ma)) return [ma];
  return [...new Set([ma, ...[13, 15, 16, 17].map((p) => temCode(ma, p))].filter(Boolean))];
};

export default function TichGiaoPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canTich = can('TICH_GIAO') || can('DELIVERY_MANAGE');

  const [tab, setTab] = useState('cho');           // 'cho' = chờ tích · 'da' = đã tích (để bỏ tích)
  const [rows, setRows] = useState([]);
  const [coCot, setCoCot] = useState(true);        // đã chạy mig 092 chưa
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [scanOpen, setScanOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState(() => ({ from: '', to: '' }));
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const daTich = tab === 'da';
  const rangeKey = useMemo(() => `${range.from || ''}|${range.to || ''}`, [range]);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const activeFilters = useMemo(() => Object.entries(filters).filter(([, v]) => v), [filters]);
  const setField = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await listTemChoTich({
        ...filters,
        search: search || undefined,
        ngayTu: range.from || undefined,
        ngayDen: range.to || undefined,
        daTich: daTich ? 1 : undefined,
      });
      setRows(res.data.items || []);
      setCoCot(res.data.co_cot !== false);
      if (!silent) setSel(new Set());
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải danh sách', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, filtersKey, search, daTich, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  // Tải NGẦM khi trạm khác xác nhận (OQC đạt thêm hàng / tổ giao lập phiếu) — không xóa dòng đang tích.
  useSocketReload(['delivery:updated', 'quality:updated'], () => load(true));

  const toggle = (r) => setSel((s) => {
    const n = new Set(s);
    if (n.has(r.tem_id)) n.delete(r.tem_id); else n.add(r.tem_id);
    return n;
  });
  const allChecked = rows.length > 0 && rows.every((r) => sel.has(r.tem_id));
  const toggleAll = () => setSel(() => (allChecked ? new Set() : new Set(rows.map((r) => r.tem_id))));

  const doTich = async () => {
    const ids = [...sel];
    if (!ids.length) return;
    setSaving(true);
    try {
      const res = await tichTemGiao(ids);
      const d = res.data || {};
      show(d.bo_qua
        ? `Đã tích ${d.da_tich} tem · bỏ qua ${d.bo_qua} (đã tích trước đó hoặc không còn chờ giao)`
        : `Đã tích ${d.da_tich} tem — sang màn Giao hàng để lập phiếu`);
      setSel(new Set());
      load();
    } catch (e) { show(e.message || 'Tích tem thất bại', 'error'); } finally { setSaving(false); }
  };

  const doBoTich = async () => {
    const ids = [...sel];
    if (!ids.length) return;
    setSaving(true);
    try {
      const res = await boTichTemGiao(ids);
      const d = res.data || {};
      // ⚠ Tem đã vào phiếu giao thì KHÔNG bỏ tích được — phải nói RÕ vướng phiếu nào, im lặng bỏ qua
      //   thì người dùng bấm mãi không thấy gì xảy ra.
      if (d.vuong_phieu && d.vuong_phieu.length) {
        show(`Bỏ tích ${d.da_bo} tem. ${d.vuong_phieu.length} tem đã nằm trong phiếu giao (${
          d.vuong_phieu.slice(0, 3).map((x) => x.phieu).join(', ')}) — xử lý ở phiếu đó`, 'error');
      } else {
        show(`Đã bỏ tích ${d.da_bo} tem`);
      }
      setSel(new Set());
      load();
    } catch (e) { show(e.message || 'Bỏ tích thất bại', 'error'); } finally { setSaving(false); }
  };

  // Quét trượt hẳn → hỏi backend VÌ SAO (chưa OQC / đã tích rồi / đã giao hết / dữ liệu cũ).
  const giaiThichQuetTruot = async (raw) => {
    try { return (await traCuuTemTich(raw)).data.mo_ta || null; } catch { return null; }
  };

  const cols = [
    { key: 'sel', header: (
      <input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={!canTich || !rows.length}
        className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
    ), className: 'w-10', selection: true, render: (r) => (
      <input type="checkbox" checked={sel.has(r.tem_id)} onChange={() => toggle(r)} disabled={!canTich}
        className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
    ) },
    { key: 'ma_tem', header: 'Tem', render: (r) => (
      <Badge tone={r.la_tem_sua ? 'warning' : 'info'}>{r.ma_tem}</Badge>
    ) },
    { key: 'nguon', header: 'Loại', render: (r) => (r.la_tem_sua ? 'Hàng sửa (tem 17)' : 'KCS đạt (tem 15)') },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.khach_list || '—'}</div>
        <div className="text-xs text-ink-soft">{r.don_list || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'phan_list', header: 'Code phần', render: (r) => r.phan_list || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'nha_gia_cong', header: 'Nhà gia công', render: (r) => r.nha_gia_cong || '—' },
    { key: 'nguoi_truoc', header: 'Người XN OQC', render: (r) => r.nguoi_truoc || '—' },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'con_giao', header: 'Chờ giao', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.con_giao) },
    ...(daTich ? [
      { key: 'nguoi_tich_giao', header: 'Người tích', render: (r) => r.nguoi_tich_giao || '—' },
      { key: 'tg_tich_giao', header: 'Giờ tích', render: (r) => fmtDateTime(r.tg_tich_giao) },
    ] : []),
  ];

  const tongCho = rows.reduce((s, r) => s + (Number(r.con_giao) || 0), 0);

  return (
    <div>
      <Toolbar
        title="Chờ GN tích"
        subtitle="Hàng đợi tem OQC đạt — bán hàng/giao nhận soát rồi tích; tích xong tem sang Giao hàng › Danh sách tem giao"
        search={search} onSearch={setSearch} searchPlaceholder="Mã tem / mã đợt SX / code phần..."
      >
        {canTich && !daTich && (
          <Button variant="secondary" icon="scan" onClick={() => setScanOpen(true)} disabled={!coCot}>
            Quét / tích mã
          </Button>
        )}
      </Toolbar>

      {!coCot && (
        <div className="mb-4 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <b>Chưa chạy migration 092.</b> Chức năng tích tem chưa dùng được, và màn <i>Giao hàng</i> đang
          chạy như cũ (tem OQC đạt hiện thẳng, không có chốt chặn). Chạy
          <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900/60">database/migrations/092_tich_giao_hang.sql</code>
          bằng user <code>postgres</code> rồi tải lại trang.
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-control bg-surface-muted p-1">
        {[['cho', `Chờ tích (${daTich ? '…' : rows.length})`], ['da', `Đã tích (${daTich ? rows.length : '…'})`]].map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSel(new Set()); }}
            className={`flex-1 rounded-[10px] px-4 py-2 text-sm font-semibold transition ${
              tab === k ? 'bg-surface text-primary shadow-card' : 'text-ink-soft'
            }`}>{label}</button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span>Ngày in tem</span>
          <div className="w-64"><DateRangePicker value={range} onChange={setRange} placeholder="Chọn khoảng ngày in tem" /></div>
          {(range.from || range.to) && (
            <button type="button" onClick={() => setRange({ from: '', to: '' })}
              className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>
          )}
        </div>
        <Button chiXemOk variant={showFilters || activeFilters.length ? 'secondary' : 'ghost'} icon="filter"
          onClick={() => setShowFilters((v) => !v)}>
          Bộ lọc{activeFilters.length ? ` (${activeFilters.length})` : ''}
        </Button>
        <span className="ml-auto text-xs text-ink-soft">
          {rows.length} tem · tổng chờ giao <b className="text-ink">{fmtNum(tongCho)}</b>
        </span>
      </div>

      {showFilters && (
        <div className="mb-3 card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
            <Button chiXemOk variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setFilters({})}
              disabled={!activeFilters.length}>Xóa lọc</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

      <DataTable columns={cols} rows={rows} loading={loading} rowKey="tem_id"
        emptyText={daTich ? 'Chưa tích tem nào' : 'Không có tem OQC đạt nào chờ tích'} />

      {sel.size > 0 && canTich && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-card border border-line bg-surface px-5 py-3 shadow-card-hover">
          <span className="text-sm text-ink">Đã chọn <b>{sel.size}</b> tem</span>
          <div className="flex gap-2">
            <Button chiXemOk variant="ghost" onClick={() => setSel(new Set())}>Bỏ chọn</Button>
            {daTich
              ? <Button variant="danger" icon="x" onClick={doBoTich} loading={saving}>Bỏ tích ({sel.size})</Button>
              : <Button icon="check" onClick={doTich} loading={saving}>Xác nhận tích ({sel.size})</Button>}
          </div>
        </div>
      )}

      {/* Modal quét — gần full màn hình. Dồn mã đã quét rồi bấm Xác nhận một lần (chế độ COLLECT).
          `logTuTatMs` + `nhayKhiQuet` là 2 prop opt-in thêm cho màn này: quét trúng thì nháy xanh,
          quét trượt thì dòng chữ đỏ tự mất sau 5 giây (yêu cầu người dùng). */}
      <ScanCollectModal
        open={scanOpen} onClose={() => setScanOpen(false)}
        title="Quét / tích tem cho chuyến giao" size="full" logTuTatMs={5000} nhayKhiQuet
        // ⚠⚠ MÁY TÍNH DÙNG ĐẦU ĐỌC MÃ VẠCH, ĐIỆN THOẠI MỚI MỞ CAMERA (chốt 09/09/2026):
        //   `usbBarcode` + chế độ mặc định 'barcode' ⇒ trên laptop KHÔNG dựng thẻ <video> (khỏi xin
        //   quyền camera, khỏi chờ mở ống kính), chỉ có vạch quét động + ô nhập; trên điện thoại/pad
        //   (`IS_TOUCH`) thì cùng chế độ đó lại là CAMERA đọc mã vạch 1D. Bấm "QR" đổi lại được.
        // ⚠ `tuFocusONhap`: mở modal là con trỏ nằm sẵn trong ô, quét xong tự về ô để quét tem kế —
        //   người soạn chuyến cầm đầu đọc, không rảnh tay bấm chuột.
        usbBarcode cheDoMacDinh="barcode" tuFocusONhap thuTuQuet
        help="Máy tính: quét bằng đầu đọc mã vạch (con trỏ đã nằm sẵn trong ô, quét xong tự về ô). Điện thoại: dùng camera. Nhãn 13/15/16/17 đều được. Quét xong bấm “Tích tem” để chốt."
        rows={rows}
        getId={(r) => r.tem_id}
        getCodes={maQuetCuaTem}
        onNotFound={giaiThichQuetTruot}
        isSelected={(r) => sel.has(r.tem_id)}
        onToggle={toggle}
        primaryLabel={(r) => r.ma_tem}
        secondaryLabel={(r) => [r.khach_list, r.ma_hang, r.mau_vai].filter(Boolean).join(' · ')}
        confirmLabel="Xác nhận"
        onConfirm={async () => { await doTich(); setScanOpen(false); }}
      />

      <Toast toast={toast} />
    </div>
  );
}
