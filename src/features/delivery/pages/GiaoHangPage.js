import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import Modal from '../../../components/common/Modal';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import {
  listTemSanSang, createGiaoHang, listGiaoHang, getGiaoHang,
  listTemChoTich, tichTemGiao, traCuuTemTich, historyGiao, doneGiao,
} from '../../../services/deliveryService';
import { Input, Select, Field, Textarea } from '../../../components/common/controls';
import DateRangePicker from '../../../components/common/DateRangePicker';
import { fmtNum, fmtDate, fmtDateTime, temCode, maTemNhan, laMaTemRieng } from '../../../utils/format';
import GiaoHangPanel from '../components/GiaoHangPanel';
import { printPhieuGiao } from '../utils/printPhieuGiao';
import TemJourneyPanel from '../../../components/common/TemJourneyPanel';
import Icon from '../../../components/common/Icon';
import { getTemHanhTrinh } from '../../../services/qualityService';

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DANH SÁCH TEM GIAO (module Giao hàng) — luồng chốt 08/09/2026:
//
//   OQC đạt → *Hệ thống › Chờ GN tích* (hàng đợi) → BẤM "Tích tem" ở ĐÂY (quét, chỉ nhận tem đang
//   chờ tích) → tem vào bảng dưới → chọn tem → **IN PHIẾU = XÁC NHẬN GIAO LUÔN** → tem rời bảng,
//   sang sidebar "Đã hoàn thành". Lấy lại: *Hệ thống › Hủy lệnh xác nhận › Hủy phiếu giao*.
//
// ⚠⚠ IN = XÁC NHẬN GIAO (người dùng chốt): `createGiaoHang({ xacNhan: true })` cộng sổ cái
//   `sl_da_giao`, đẩy tem sang DONE_DELIVERY và bắn phiếu sang ERP trong CÙNG một lần bấm. Đừng
//   tách lại thành 2 bước — tem sẽ không rời bảng và người dùng tưởng bấm hụt.
// ⚠⚠ LUÔN TẠO PHIẾU TRƯỚC KHI IN, không in thẳng từ danh sách tem: phiếu mang SỐ PHIẾU (ERP cấp)
//   và là thứ dùng đối soát về sau — tờ giấy không số thì kho cầm ra cổng mà hệ thống không biết gì.
// ══════════════════════════════════════════════════════════════════════════════════════════════

// ⚠ Giống màn OQC (mig 091): TEM CON đã mang sẵn mã `17…` ⇒ hiện THẲNG; tem gốc / dữ liệu cũ mới
//   ghép tiền tố theo nguồn. Dùng `temCode()` chứ không nối chuỗi — mã ERP 12 số phải THAY 2 số đầu.
// ⚠⚠ TEM 13 GIA CÔNG cũng mang mã riêng `13…` (06/09/2026) và đi ở nguồn KCS ⇒ ghép `15` sẽ
//   biến nó thành mã KHÔNG có thật, in lên phiếu giao là quét không ra. `maTemNhan` chặn ca đó.
const maHien = (r, nguon) => maTemNhan(r.ma_tem, nguon === 'SUA' ? 17 : 15, null, r.la_tem_sua);

// Mã quét được của 1 tem — khai ĐỦ biến thể tiền tố để `ScanCollectModal` khớp exact ngay lượt đầu.
// ⚠⚠ CHỈ sinh biến thể cho TEM GỐC (dãy `15`). Tem 17 (sửa đạt) và tem 13 (gia công về) mang mã
//   RIÊNG do ERP cấp — bịa biến thể `15…` từ chúng là tạo ra mã của DÃY KHÁC, có thể va vào tem thật
//   của lô khác rồi đưa nhầm hàng đi giao. (Cùng luật với `TichGiaoPage.maQuetCuaTem`.)
const maQuetCuaTem = (r) => {
  if (!r || !r.ma_tem) return [];
  const ma = String(r.ma_tem);
  if (r.la_tem_sua || laMaTemRieng(ma)) return [ma];
  return [...new Set([ma, ...[13, 15, 16, 17].map((p) => temCode(ma, p))].filter(Boolean))];
};

const FILTER_FIELDS = [
  { key: 'tem', label: 'Mã tem' },
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'mauVai', label: 'Màu vải' },
  { key: 'kichVai', label: 'Kích vải' },
  { key: 'kichPhim', label: 'Kích phim' },
];
const FIELD_LABEL = { ...Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, f.label])), ngayTu: 'Từ ngày', ngayDen: 'Đến ngày' };

const TT_PHIEU = {
  TAO: ['Chờ giao', 'warning'],
  DA_GIAO: ['Đã giao', 'success'],
  HUY: ['Đã hủy', 'danger'],
};
const badgePhieu = (v) => {
  const [ten, tone] = TT_PHIEU[v] || ['Chờ giao', 'warning'];
  return <Badge tone={tone}>{ten}</Badge>;
};

export default function GiaoHangPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const canManage = can('DELIVERY_MANAGE');
  // Người BẤM IN (in lại phiếu của người khác thì đây mới là người cầm tờ giấy) — trường `nguoi_in`
  // của mẫu phiếu. ⚠ Lấy ở TRANG rồi truyền xuống: `printPhieuGiao` là util, không đọc redux store.
  const nguoiIn = useSelector((s) => s.auth.user?.ho_ten || s.auth.user?.ten_dang_nhap || '');

  const [tab, setTab] = useState('tem');           // 'tem' = tem chờ giao · 'phieu' = danh sách phiếu
  const [nghenOpen, setNghenOpen] = useState(false);
  const [tems, setTems] = useState([]);
  const [choTich, setChoTich] = useState([]);      // tem đang ở *Chờ GN tích* — nguồn của modal quét
  const [phieus, setPhieus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [sel, setSel] = useState(null);            // phiếu đang mở panel
  const [creating, setCreating] = useState(false);
  // Modal nhập "Giao hàng tại" trước khi in — `{ gop }` = kiểu in đang chờ, null = đóng.
  // ⚠ Địa điểm này lưu vào PHIẾU (mig 099) nên in lại vẫn ra đúng; bỏ trống vẫn in được bình thường.
  const [inForm, setInForm] = useState(null);
  const [giaoTai, setGiaoTai] = useState('');
  const [journey, setJourney] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [selTich, setSelTich] = useState(() => new Set());
  const [tichBusy, setTichBusy] = useState(false);
  const [hisOpen, setHisOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [range, setRange] = useState(() => ({ from: '', to: '' }));
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  // Bộ lọc riêng của tab "Phiếu giao".
  const [pSearch, setPSearch] = useState('');
  const [pTrangThai, setPTrangThai] = useState('');
  const [pRange, setPRange] = useState(() => ({ from: '', to: '' }));

  // Dải "Theo dõi" (sĩ số) bám ô tìm + panel lọc của màn này.
  useSiSoLoc({ ...filters });

  const rangeKey = useMemo(() => `${range.from || ''}|${range.to || ''}`, [range]);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const activeFilters = useMemo(() => Object.entries(filters).filter(([, v]) => v), [filters]);
  const setField = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({});

  const pKey = useMemo(
    () => `${pSearch}|${pTrangThai}|${pRange.from || ''}|${pRange.to || ''}`, [pSearch, pTrangThai, pRange]
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { ...filters, ngayTu: range.from || undefined, ngayDen: range.to || undefined };
      // ⚠ Danh sách "chờ tích" tải KÈM để modal quét khớp được ngay — nó là tập KHÁC (tem chưa tích),
      //   không phải bảng đang hiện. Lỗi ở nhánh này KHÔNG được chặn màn Giao ⇒ nuốt riêng.
      const [t, p] = await Promise.all([
        listTemSanSang(params),
        listGiaoHang({
          search: pSearch || undefined, trangThai: pTrangThai || undefined,
          ngayTu: pRange.from || undefined, ngayDen: pRange.to || undefined,
        }),
      ]);
      setTems(t.data);
      setPhieus(p.data);
      try {
        const ct = await listTemChoTich({});
        setChoTich((ct.data && ct.data.items) || []);
      } catch { setChoTich([]); }
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, filtersKey, pKey, show]);

  useEffect(() => { load(); }, [load]);

  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua spinner và KHÔNG xóa dòng đang tích.
  useSocketReload(['delivery:updated', 'quality:updated'], () => load(true));

  const selectedList = useMemo(() => Object.values(selected), [selected]);

  // TÁCH mỗi tem theo NGUỒN: KCS (15-) + Sửa (17-) — như màn OQC, KHÔNG gộp 1 dòng.
  // _key = tem_id + nguồn; con_src = SL còn giao của đúng nguồn đó.
  const displayRows = useMemo(() => {
    const out = [];
    (tems || []).forEach((r) => {
      const kcs = Number(r.con_giao_kcs);
      const sua = Number(r.con_giao_sua);
      if (r.con_giao_kcs == null && r.con_giao_sua == null) { // backend cũ chưa tách → 1 dòng tổng
        out.push({ ...r, _key: `${r.tem_id}-KCS`, nguon: 'KCS', con_src: Number(r.con_giao) || 0, ma_tem_display: r.ma_tem });
        return;
      }
      if (kcs > 0) out.push({ ...r, _key: `${r.tem_id}-KCS`, nguon: 'KCS', con_src: kcs, ma_tem_display: maHien(r, 'KCS'), la_sua: !!r.la_tem_sua });
      if (sua > 0) out.push({ ...r, _key: `${r.tem_id}-SUA`, nguon: 'SUA', con_src: sua, ma_tem_display: maHien(r, 'SUA'), la_sua: true });
    });
    return out;
  }, [tems]);

  // Mỗi dòng chọn = { row, qty } — qty = SL giao lần này (mặc định = còn giao nguồn đó).
  const toggle = (row) =>
    setSelected((s) => {
      const n = { ...s };
      if (n[row._key]) delete n[row._key]; else n[row._key] = { row, qty: Number(row.con_src) || 0 };
      return n;
    });
  const setQty = (key, v) => setSelected((s) => (s[key] ? { ...s, [key]: { ...s[key], qty: v } } : s));

  // ─── IN PHIẾU = TẠO PHIẾU + XÁC NHẬN GIAO + IN ────────────────────────────────────────────
  // `gop`: false = in CHI TIẾT (1 dòng/tem) · true = in GỘP theo code phần.
  const doInPhieu = async (gop, giaoHangTai = '') => {
    setCreating(true);
    try {
      const items = selectedList.map((x) => ({ temId: x.row.tem_id, nguon: x.row.nguon, soLuong: Number(x.qty) || null }));
      // `giaoHangTai` lưu vào CHÍNH phiếu (mig 099) ⇒ in lại từ sidebar vẫn ra đúng địa điểm.
      // ⚠ Thiếu migration thì backend tự bỏ qua trường này, phiếu vẫn lập bình thường.
      const r = await createGiaoHang({ items, xacNhan: true, giaoHangTai });
      show(`Đã tạo & xác nhận giao phiếu ${r.data.ma_phieu_giao}`);
      setSelected({});
      load();
      // In sau khi chốt — popup bị chặn thì báo Toast, KHÔNG được nuốt (phiếu đã chốt rồi, người dùng
      // phải biết là chỉ thiếu bước in để còn vào "Đã hoàn thành" bấm In lại).
      // ⚠ `printPhieuGiao` là ASYNC (phải hỏi mẫu đã gắn) ⇒ BẮT BUỘC `await`, thiếu thì lỗi rơi vào
      //   promise và khối catch đồng bộ không bắt được.
      try { await printPhieuGiao(r.data, { gop, nguoiIn }); }
      catch (e) { show(`${e.message} — phiếu ${r.data.ma_phieu_giao} đã chốt, vào "Đã hoàn thành" để in lại`, 'error'); }
    } catch (e) {
      show(e.message || 'Tạo phiếu thất bại', 'error');
    } finally {
      setCreating(false);
    }
  };

  // IN LẠI phiếu đã có (sidebar Lịch sử / Đã hoàn thành / tab Phiếu giao).
  // ⚠ Phải tải lại chi tiết phiếu: bảng chỉ có dòng tóm tắt, không có danh sách tem để dựng phiếu.
  const inLaiPhieu = async (id, gop) => {
    try {
      const r = await getGiaoHang(id);
      await printPhieuGiao(r.data, { gop, nguoiIn });
    } catch (e) {
      show(e.message || 'Không in lại được phiếu', 'error');
    }
  };

  // ⚠ GỌI BẰNG HÀM (`{nutInLai(id)}`), KHÔNG khai component lồng rồi dùng `<NutInLai/>`: màn này chạy
  //   `useNow(1000)` nên re-render MỖI GIÂY — component lồng có TYPE mới mỗi lần ⇒ React unmount +
  //   mount lại toàn bộ nút (bẫy "Flicker" đã ghi ở CLAUDE.md §9).
  const nutInLai = (id) => (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => inLaiPhieu(id, false)}>In chi tiết</Button>
      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => inLaiPhieu(id, true)}>In gộp</Button>
    </div>
  );

  // ─── TÍCH TEM (modal quét) ────────────────────────────────────────────────────────────────
  const toggleTich = (r) => setSelTich((s) => {
    const n = new Set(s);
    if (n.has(r.tem_id)) n.delete(r.tem_id); else n.add(r.tem_id);
    return n;
  });

  const doTich = async () => {
    const ids = [...selTich];
    if (!ids.length) return;
    setTichBusy(true);
    try {
      const res = await tichTemGiao(ids);
      const d = res.data || {};
      show(d.bo_qua
        ? `Đã tích ${d.da_tich} tem · bỏ qua ${d.bo_qua} (đã tích trước đó hoặc không còn chờ giao)`
        : `Đã tích ${d.da_tich} tem — đã vào danh sách tem giao`);
      setSelTich(new Set());
      setScanOpen(false);
      load();
    } catch (e) { show(e.message || 'Tích tem thất bại', 'error'); } finally { setTichBusy(false); }
  };

  // Quét trượt hẳn → hỏi backend VÌ SAO (chưa OQC / đã tích rồi / đã giao hết / dữ liệu cũ) thay vì
  // để người quét đoán là máy hỏng.
  const giaiThichQuetTruot = async (raw) => {
    try { return (await traCuuTemTich(raw)).data.mo_ta || null; } catch { return null; }
  };

  const temCols = [
    { key: 'sel', header: '', className: 'w-10', selection: true, render: (r) => (
      <input type="checkbox" checked={!!selected[r._key]} onChange={() => toggle(r)}
        className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
    ) },
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone={r.nguon === 'SUA' ? 'warning' : 'info'}>{r.ma_tem_display || r.ma_tem}</Badge> },
    { key: 'nguon', header: 'Nguồn', render: (r) => (r.la_sua ? 'Sửa (tem 17)' : 'KCS (tem 15)') },
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
    // Nhà gia công (ERP NGC, mig 072) — theo đợt nhận vải, BE gộp DISTINCT theo lệnh của tem.
    { key: 'nha_gia_cong', header: 'Nhà gia công', render: (r) => r.nha_gia_cong || '—' },
    { key: 'nguoi_tich_giao', header: 'Người tích', render: (r) => r.nguoi_tich_giao || '—' },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'con_src', header: 'Còn giao', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.con_src) },
    { key: 'giao_qty', header: 'SL giao lần này', className: 'w-32', render: (r) => (
      selected[r._key] ? (
        <Input type="number" min="1" max={r.con_src} value={selected[r._key].qty}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setQty(r._key, e.target.value)} className="py-1 text-right" />
      ) : <span className="text-ink-soft">—</span>
    ) },
    { key: 'ht', header: '', className: 'text-right', render: (r) => (
      <Button chiXemOk variant="ghost" className="px-3 py-1.5"
        onClick={(e) => { e.stopPropagation(); setJourney({ temId: r.tem_id, maTem: r.ma_tem }); }}>Hành trình</Button>
    ) },
  ];

  const phieuCols = [
    { key: 'ma_phieu_giao', header: 'Mã phiếu', render: (r) => <Badge tone="info">{r.ma_phieu_giao}</Badge> },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) => badgePhieu(r.trang_thai) },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'so_tem', header: 'Số tem', className: 'text-right' },
    { key: 'tong_sl', header: 'Tổng SL', className: 'text-right tabular-nums', render: (r) => fmtNum(r.tong_sl) },
    { key: 'created_date', header: 'Giờ lập', render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.created_date)}</span> },
    { key: 'nguoi_tao', header: 'Người lập', render: (r) => r.nguoi_tao || '—' },
    { key: 'ngay_giao', header: 'Ngày giao', render: (r) => fmtDate(r.ngay_giao) },
    { key: 'in', header: '', className: 'text-right', render: (r) => (
      <div onClick={(e) => e.stopPropagation()}>{nutInLai(r.id)}</div>
    ) },
  ];

  // Cột "Đã hoàn thành" (1 dòng = 1 PHIẾU đã xác nhận giao trong ngày).
  const doneCols = [
    { key: 'ma', header: 'Mã phiếu', render: (r) => <Badge tone="info">{r.ma}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'so_tem', header: 'Số tem', className: 'text-right tabular-nums' },
    { key: 'so_luong', header: 'Tổng SL giao', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'tg', header: 'Giờ giao', className: 'whitespace-nowrap', render: (r) => (r.tg ? new Date(r.tg).toLocaleTimeString('vi-VN') : '—') },
    { key: 'nguoi', header: 'Người xác nhận', render: (r) => r.nguoi || '—' },
    { key: 'in', header: '', className: 'text-right', render: (r) => nutInLai(r.id) },
  ];
  const doneExcelCols = [
    { header: 'Mã phiếu', value: (r) => r.ma || '' },
    { header: 'Khách hàng', value: (r) => r.ten_khach_hang || '' },
    { header: 'Đơn hàng', value: (r) => r.ma_don_hang || '' },
    { header: 'Số tem', value: (r) => Number(r.so_tem) || 0, num: true },
    { header: 'Tổng SL giao', value: (r) => Number(r.so_luong) || 0, num: true },
    { header: 'Giờ giao', value: (r) => (r.tg ? new Date(r.tg).toLocaleTimeString('vi-VN') : ''), center: true },
    { header: 'Người xác nhận', value: (r) => r.nguoi || '' },
  ];

  return (
    <div>
      <Toolbar title="Danh sách tem giao"
        subtitle="Tem đã được bán hàng tích ở Hệ thống › Chờ GN tích — chọn tem rồi IN PHIẾU (in = xác nhận giao)">
        {/* ⚠ Màn này dùng `displayRows` (1 tem TÁCH 2 dòng theo nguồn KCS/Sửa), không phải `tems` —
            phải đúng tập đang hiện trên bảng thì số trên nút mới khớp số hàng đỏ. */}
        <NghenButton rows={displayRows} trangThai={(r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status}
          onClick={() => setNghenOpen(true)} />
        {canManage && (
          <Button variant="secondary" icon="scan" onClick={() => { setSelTich(new Set()); setScanOpen(true); }}>
            Tích tem ({choTich.length})
          </Button>
        )}
        <Button chiXemOk variant="ghost" icon="history" onClick={() => setHisOpen(true)}>Lịch sử</Button>
        <Button chiXemOk variant="ghost" icon="check" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
      </Toolbar>

      <div className="mb-4 flex gap-1 rounded-control bg-surface-muted p-1">
        {[['tem', `Tem chờ giao (${displayRows.length})`], ['phieu', `Phiếu giao (${phieus.length})`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-[10px] px-4 py-2 text-sm font-semibold transition ${
              tab === k ? 'bg-surface text-primary shadow-card' : 'text-ink-soft'
            }`}>{label}</button>
        ))}
      </div>

      {tab === 'tem' ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {/* ⚠⚠ Ô MÃ TEM ĐƯA HẲN RA NGOÀI TRANG (09/09/2026) — tra theo mã tem là thao tác thường
                xuyên nhất ở màn này; trước đây nó nằm trong panel "Bộ lọc" gập lại nên mỗi lần tìm
                phải mở panel. Vẫn ghi vào CHÍNH `filters.tem` nên backend + chip + "Xóa lọc" không
                phải sửa gì; panel bên dưới ẩn ô này đi để không có 2 ô cùng sửa một giá trị. */}
            <div className="flex items-center gap-1.5">
              <Icon name="scan" size={15} className="text-ink-soft" />
              <input value={filters.tem || ''} onChange={(e) => setField('tem', e.target.value)}
                placeholder="Mã tem (quét hoặc gõ)..." aria-label="Lọc theo mã tem"
                className="h-9 w-56 rounded-input border border-line bg-surface px-3 text-sm focus:border-primary focus:outline-none" />
              {filters.tem && (
                <button type="button" onClick={() => setField('tem', '')}
                  className="text-ink-soft hover:text-danger" aria-label="Xóa mã tem">
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span>Ngày in tem</span>
              <div className="w-64"><DateRangePicker value={range} onChange={setRange} placeholder="Chọn khoảng ngày in tem" /></div>
              {(range.from || range.to) && <button type="button" onClick={() => setRange({ from: '', to: '' })} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>}
            </div>
            <Button chiXemOk variant={showFilters || activeFilters.length ? 'secondary' : 'ghost'} icon="filter"
              onClick={() => setShowFilters((v) => !v)}>Bộ lọc{activeFilters.length ? ` (${activeFilters.length})` : ''}</Button>
          </div>

          {showFilters && (
            <div className="mb-3 card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
                <Button chiXemOk variant="ghost" className="px-2.5 py-1 text-xs" onClick={clearFilters} disabled={!activeFilters.length}>Xóa lọc</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {/* ⚠ Bỏ 'tem' khỏi panel — ô đó đã nằm NGOÀI trang. Vẫn GIỮ nó trong `FILTER_FIELDS`
                    vì `FIELD_LABEL` lấy nhãn từ đó cho chip "Mã tem: …"; xóa khỏi mảng là chip hiện
                    `undefined`. */}
                {FILTER_FIELDS.filter((f) => f.key !== 'tem').map((f) => (
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
                  <button onClick={() => setField(k, '')} className="ml-0.5 hover:text-danger" aria-label="Xóa"><Icon name="x" size={12} /></button>
                </span>
              ))}
              <button onClick={clearFilters} className="text-xs font-medium text-ink-soft underline hover:text-danger">Xóa tất cả</button>
            </div>
          )}
          <DataTable columns={temCols} rows={displayRows} loading={loading} rowKey="_key" sttStart={0}
            rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
            emptyText="Chưa có tem nào — bấm “Tích tem” để quét tem đang chờ ở Hệ thống › Chờ GN tích" />
          {selectedList.length > 0 && (
            <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-card border border-line bg-surface px-5 py-3 shadow-card-hover">
              <span className="text-sm text-ink">Đã chọn <b>{selectedList.length}</b> tem · Tổng giao <b>{fmtNum(selectedList.reduce((s, x) => s + (Number(x.qty) || 0), 0))}</b></span>
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-ink-soft sm:inline">In phiếu = xác nhận giao</span>
                <Button chiXemOk variant="ghost" onClick={() => setSelected({})}>Bỏ chọn</Button>
                {canManage && <>
                  {/* 2 kiểu in (người dùng chốt): chi tiết từng tem · gộp theo code phần.
                      Bấm ra modal nhập "Giao hàng tại" rồi mới tạo phiếu — xem `inForm`. */}
                  <Button variant="secondary" icon="printer" onClick={() => { setGiaoTai(''); setInForm({ gop: false }); }} loading={creating}>In phiếu (chi tiết)</Button>
                  <Button icon="printer" onClick={() => { setGiaoTai(''); setInForm({ gop: true }); }} loading={creating}>In phiếu (gộp theo phần in)</Button>
                </>}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input value={pSearch} onChange={(e) => setPSearch(e.target.value)}
              placeholder="Tìm mã phiếu / khách / đơn / mã tem / code phần..." className="max-w-xs" />
            <div className="w-40">
              <Select value={pTrangThai} onChange={(e) => setPTrangThai(e.target.value)}>
                <option value="">Mọi trạng thái</option>
                <option value="TAO">Chờ giao</option>
                <option value="DA_GIAO">Đã giao</option>
                <option value="HUY">Đã hủy</option>
              </Select>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span>Ngày lập phiếu</span>
              <div className="w-64"><DateRangePicker value={pRange} onChange={setPRange} placeholder="Chọn khoảng ngày lập" /></div>
              {(pRange.from || pRange.to) && <button type="button" onClick={() => setPRange({ from: '', to: '' })} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>}
            </div>
          </div>
          <DataTable columns={phieuCols} rows={phieus} loading={loading} onRowClick={(r) => setSel(r.id)}
            emptyText="Chưa có phiếu giao nào" />
        </>
      )}

      {sel && <GiaoHangPanel giaoHangId={sel} onClose={() => setSel(null)} onChanged={load} />}
      {journey && (
        <TemJourneyPanel temId={journey.temId} maTem={journey.maTem}
          fetcher={getTemHanhTrinh} onClose={() => setJourney(null)} />
      )}

      {/* Modal quét/tích — nguồn là danh sách CHỜ TÍCH (tem chưa được bán hàng tích), không phải bảng
          đang hiện. Quét trúng thì nháy xanh, quét trượt thì dòng chữ đỏ tự mất sau 5 giây. */}
      <ScanCollectModal
        open={scanOpen} onClose={() => setScanOpen(false)}
        title="Quét / tích tem cho chuyến giao" size="full" logTuTatMs={5000} nhayKhiQuet
        // ⚠⚠ CÙNG BỘ PROP với modal tích tem ở *Hệ thống › Chờ GN tích* — HAI màn có nút "Tích tem"
        //   và người dùng mở màn nào cũng phải quét y như nhau. Sửa một bên mà quên bên kia là đúng
        //   lỗi đã mắc 09/09/2026 (chỉ sửa TichGiaoPage nên màn này vẫn đòi mở camera).
        //   Máy tính → đầu đọc mã vạch (không dựng camera) · điện thoại → camera · mặc định mã vạch ·
        //   con trỏ nằm sẵn trong ô và tự về ô sau mỗi lần quét (giống quét mã vạch ở READY kỹ thuật).
        usbBarcode cheDoMacDinh="barcode" tuFocusONhap thuTuQuet
        help="Máy tính: quét bằng đầu đọc mã vạch (con trỏ đã nằm sẵn trong ô, quét xong tự về ô). Điện thoại: dùng camera. Nhãn 13/15/16/17 đều được. Tem phải đang ở Hệ thống › Chờ GN tích thì mới hiện lên. Quét xong bấm “Tích tem”."
        rows={choTich}
        getId={(r) => r.tem_id}
        getCodes={maQuetCuaTem}
        onNotFound={giaiThichQuetTruot}
        isSelected={(r) => selTich.has(r.tem_id)}
        onToggle={toggleTich}
        primaryLabel={(r) => r.ma_tem}
        secondaryLabel={(r) => [r.khach_list, r.ma_hang, r.mau_vai].filter(Boolean).join(' · ')}
        // ⚠ `ScanCollectModal` TỰ nối `(số dòng đã chọn)` vào sau nhãn ⇒ ĐỪNG tự ghép số vào đây,
        //   bản cũ ghép nên nút hiện "Tích tem (3) (3)".
        confirmLabel={tichBusy ? 'Đang xác nhận...' : 'Xác nhận'}
        onConfirm={doTich}
      />

      <HistoryPanel open={hisOpen} onClose={() => setHisOpen(false)} title="Lịch sử phiếu giao"
        fetcher={historyGiao}
        extraColumns={[{ key: 'in', header: '', className: 'text-right', render: (r) => (r.id ? nutInLai(r.id) : null) }]} />

      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)} title="Phiếu giao đã hoàn thành"
        maHeader="Mã phiếu" fetcher={doneGiao} columns={doneCols} excelColumns={doneExcelCols} />

      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="Giao hàng" rows={displayRows} tenFile="nghen-giao-hang"
        trangThai={(r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status} />
      {/* ⚠⚠ Bấm "In phiếu" KHÔNG in ngay mà hỏi "Giao hàng tại" trước — địa điểm này được LƯU VÀO
          PHIẾU (mig 099) nên phải nhập TRƯỚC khi tạo, không vá vào sau được.
          Bỏ trống vẫn in bình thường (ô trên phiếu để trống) — đây là thông tin thêm, không chặn
          việc giao hàng. */}
      <Modal
        open={!!inForm}
        onClose={() => setInForm(null)}
        title={inForm?.gop ? 'In phiếu giao (gộp theo phần in)' : 'In phiếu giao (chi tiết)'}
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setInForm(null)}>Đóng</Button>
            <Button icon="printer" loading={creating}
              onClick={async () => { const g = inForm.gop; setInForm(null); await doInPhieu(g, giaoTai); }}>
              Tạo phiếu &amp; in
            </Button>
          </>
        }
      >
        <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Bấm <b>Tạo phiếu &amp; in</b> là <b>xác nhận giao luôn</b>: {selectedList.length} tem
          (tổng <b>{fmtNum(selectedList.reduce((s, x) => s + (Number(x.qty) || 0), 0))}</b>) sẽ rời
          danh sách này. Lấy lại ở <i>Hệ thống › Hủy lệnh xác nhận › Hủy phiếu giao</i>.
        </div>
        <Field label="Giao hàng tại">
          <Textarea rows={2} value={giaoTai} onChange={(e) => setGiaoTai(e.target.value)}
            placeholder="Vd: Kho B — Lô A1, KCN Long An (để trống nếu không cần in địa điểm)" />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
