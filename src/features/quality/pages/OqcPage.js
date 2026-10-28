import { useEffect, useState, useCallback, useMemo } from 'react';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import Toolbar from '../../../components/common/Toolbar';
import MenuNut from '../../../components/common/MenuNut';
import OwnerHint from '../../../components/common/OwnerHint';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import exportDanhSachOqc from '../utils/exportDanhSachOqc';
import { Field, Input, Textarea } from '../../../components/common/controls';
import SearchableSelect from '../../../components/common/SearchableSelect';
import QrScanner from '../../../components/common/QrScanner';
import DateRangePicker from '../../../components/common/DateRangePicker';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import HanGiaoCell from '../../../components/common/HanGiaoCell';
import FieldFilters, { FilterToggle } from '../../../components/common/FieldFilters';
import Icon from '../../../components/common/Icon';
import FinishListModal from '../components/FinishListModal';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import useLyDoNghen from '../../../hooks/useLyDoNghen';
import { trangThaiSla } from '../../../utils/nghen';
import usePermissions from '../../../hooks/usePermissions';
import useHuyLichSu from '../../../hooks/useHuyLichSu';
import useOTimKiem from '../../../hooks/useOTimKiem';
import { listOqcCandidates, recordOqc, oqcHistory, oqcDone, returnOqcToKcs, huyOqcLichSu } from '../../../services/qualityService';
import { listUserOptions } from '../../../services/userService';
import Modal from '../../../components/common/Modal';
import { fmtNum, timTheoMaTem, maTemNhan, trongKhoangNgay } from '../../../utils/format';

const FORM_MOI = () => ({ soLuongKiem: '', soLuongDat: '', ketQua: 'DAT', ownerChoGiaoId: '', lyDoChoGiao: '' });
// "Ngày kiểm" theo NGUỒN của dòng (18/10/2026, BE `tgKiemByTems`): nguồn Sửa (dữ liệu cũ) = lượt sửa gần nhất; còn lại
// = lượt KCS gần nhất / lượt sửa sinh ra tem 17 / lúc nhận hàng gia công.
const tgKiem = (r, nguon) => (nguon === 'SUA' ? (r.tg_kiem_sua || r.tg_kiem_kcs) : r.tg_kiem_kcs) || null;
const fmtNgayGio = (t) => (t ? new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

// ⚠⚠ MÃ TEM HIỆN ĐÚNG NHÃN GIẤY (mig 091 — tem 17 nay là DÒNG TEM THẬT):
//   · TEM CON (`la_tem_sua`) mang sẵn `ma_tem` `17…` ⇒ hiện THẲNG, không ghép gì.
//   · TEM 13 GIA CÔNG cũng mang sẵn mã riêng `13…` (từ 06/09/2026) và đi vào OQC ở nguồn **KCS**
//     ⇒ nếu cứ ghép `15` thì `13…` biến thành `15…` — mã KHÔNG có thật. `maTemNhan` chặn ca này.
//   · Tem gốc / dữ liệu CŨ chưa tách (parent còn `con_oqc_sua`) ⇒ vẫn ghép tiền tố theo nguồn.
// ⚠ Dùng `maTemNhan()`/`temCode()` chứ KHÔNG nối chuỗi `'15-' + ma_tem` như bản cũ: mã ERP 12 số
//   phải THAY 2 số đầu, nối chuỗi cho ra `15-152608057689` — sai hẳn so với mã in trên tem.
const maHien = (r, nguon) => maTemNhan(r.ma_tem, nguon === 'SUA' ? 17 : 15, null, r.la_tem_sua);
// Bảng Lịch sử / Đã hoàn thành: hàng lấy từ bảng `oqc` nên mã nằm ở `r.ma`, nguồn ở `r.nguon`.
const laSuaDone = (r) => !!r.la_tem_sua || r.nguon === 'SUA';
const maHienDone = (r) => maTemNhan(r.ma || '', r.nguon === 'SUA' ? 17 : 15, null, r.la_tem_sua);

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng' }, { key: 'don', label: 'Đơn hàng' }, { key: 'maHang', label: 'Mã hàng' },
  { key: 'mauVai', label: 'Màu vải' }, { key: 'kichVai', label: 'Kích vải' }, { key: 'kichPhim', label: 'Kích phim' },
];

export default function OqcPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const canOqc = can('OQC');

  const [rows, setRows] = useState([]);
  const [nghenOpen, setNghenOpen] = useState(false); // modal "Danh sách nghẽn"
  const { hoiLyDoNghen, lyDoNghenModal } = useLyDoNghen({ maTrang: 'CL_OQC', trangThai: trangThaiSla });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Vào trang con trỏ nằm sẵn ở ô tìm; xác nhận / trả về xong thì xóa ô + đặt con trỏ lại (quét tem kế).
  const oTim = useOTimKiem();
  const [range, setRange] = useState(() => ({ from: '', to: '' }));
  const [filters, setFilters] = useState({});

  // Dải "Theo dõi" (sĩ số) bám ĐÚNG ô tìm + panel lọc của màn này — xem hooks/useSiSoLoc.js.
  useSiSoLoc({ timKiem: search, ...filters });
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ soLuongKiem: '', soLuongDat: '', ketQua: 'DAT', ownerChoGiaoId: '', lyDoChoGiao: '' });
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false); // modal "Danh sách finish"
  const [users, setUsers] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnMode, setReturnMode] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  // Lọc "Ngày kiểm" (lọc tại chỗ — danh sách OQC tải trọn) + XÁC NHẬN NHANH nhiều dòng cùng 1 bộ thông tin (18/10/2026).
  const [rangeKiem, setRangeKiem] = useState(() => ({ from: '', to: '' }));
  const [chon, setChon] = useState(() => new Set()); // `_key` các dòng đang tích
  const [nhanhOpen, setNhanhOpen] = useState(false);
  const [nhanhForm, setNhanhForm] = useState(FORM_MOI);
  const [nhanhSaving, setNhanhSaving] = useState(false);

  // Danh sách người để chọn owner. Dùng /users/options (chỉ cần đăng nhập) — endpoint /users cũ đòi
  // quyền USER_VIEW mà role QA/OQC không có ⇒ 403 → combobox rỗng, gõ tên không ra ai.
  // Lỗi tải phải BÁO, không nuốt im lặng như trước.
  useEffect(() => {
    listUserOptions({ limit: 500 })
      .then((r) => setUsers(r.data || []))
      .catch((e) => show(e.message || 'Không tải được danh sách người dùng', 'error'));
  }, [show]);

  const rangeKey = useMemo(() => `${range.from || ''}|${range.to || ''}`, [range]);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const activeCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);
  const setField = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const clearFilters = () => setFilters({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await listOqcCandidates({ search, ...filters, ngayTu: range.from || undefined, ngayDen: range.to || undefined });
      setRows(res.data);
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filtersKey, rangeKey, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Tự tải lại khi trạm khác xác nhận (tránh màn để lâu → dữ liệu cũ).
  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua `setLoading(true)` (bảng không bị
  // thay bằng spinner) và KHÔNG xóa dòng đang tích. Nhiều sự kiện trong 400ms gộp thành 1 lần tải.
  useSocketReload(['quality:updated'], () => load(true));
  // NÚT "HỦY" Ở TỪNG DÒNG LỊCH SỬ (14/10/2026): nhập lý do ⇒ backend đảo sổ cái lượt đó rồi báo ERP hủy chứng từ
  // theo IDMES. Chỉ cần quyền công đoạn của màn này (người dùng chốt).
  const huyLs = useHuyLichSu({
    goiHuy: (r, ly) => huyOqcLichSu(r.id, ly),
    show,
    coQuyen: canOqc,
    tieuDe: 'Hủy xác nhận OQC',
    moTa: (r) => <>Tem <b>{r.doi_tuong}</b> · {r.chi_tiet}</>,
    nhanNut: 'Hủy xác nhận',
    hauQua: 'Số lượng của lượt này quay về chờ OQC.',
    baoXong: (r) => `Đã hủy lượt OQC của tem ${r.doi_tuong || ''}`,
    sauKhiHuy: () => load(true),
  });

  // row = display-row đã tách nguồn (có nguon + con_src + ma_tem_display).
  const open = (row) => {
    setEditing(row);
    setReturnMode(false);
    setReturnReason('');
    // ⚠ Ô SL = SỐ BỐC MẪU người kiểm tự nhập (30/09/2026) — KHÔNG điền sẵn cả lô như trước.
    setForm(FORM_MOI());
  };

  // ⚠⚠ LUẬT OQC (người dùng chốt 30/09/2026): chỉ nhập SL BỐC MẪU; "Đạt" = ĐẠT HẾT mẫu (SL đạt = SL
  //   bốc mẫu). Nhập SL đạt NHỎ HƠN mẫu (vd bốc 50 đạt 20) ⇒ TỰ nhảy sang "Không đạt"; nhập lại bằng mẫu
  //   ⇒ về "Đạt". Backend chặn "Đạt" khi đạt < mẫu (422 `DAT_THIEU`).
  // Cùng luật cho form lẻ (SidePanel) và form "Xác nhận nhanh" — truyền setter tương ứng.
  const doiBocMauCua = (setF) => (v) => setF((f) => ({ ...f, soLuongKiem: v, soLuongDat: f.ketQua === 'DAT' ? v : f.soLuongDat }));
  const doiSlDatCua = (setF) => (v) => setF((f) => {
    const mau = f.soLuongKiem;
    let ketQua = f.ketQua;
    if (v !== '' && mau !== '') ketQua = Number(v) < Number(mau) ? 'KHONG_DAT' : 'DAT';
    return { ...f, soLuongDat: v, ketQua };
  });
  const chonDatCua = (setF) => () => setF((f) => ({ ...f, ketQua: 'DAT', soLuongDat: f.soLuongKiem }));
  const doiBocMau = doiBocMauCua(setForm);
  const doiSlDat = doiSlDatCua(setForm);
  const chonDat = chonDatCua(setForm);

  // Tách mỗi tem thành tối đa 2 dòng theo NGUỒN: KCS-đạt (tem 15-) & Sửa-đạt (tem 17-).
  const displayRows = rows.flatMap((r) => {
    const out = [];
    const kcs = Number(r.con_oqc_kcs) || 0;
    const sua = Number(r.con_oqc_sua) || 0;
    if (kcs > 0) out.push({ ...r, _key: `${r.tem_id}-KCS`, nguon: 'KCS', con_src: kcs, ma_tem_display: maHien(r, 'KCS'), la_sua: !!r.la_tem_sua, tg_kiem: tgKiem(r, 'KCS') });
    if (sua > 0) out.push({ ...r, _key: `${r.tem_id}-SUA`, nguon: 'SUA', con_src: sua, ma_tem_display: maHien(r, 'SUA'), la_sua: true, tg_kiem: tgKiem(r, 'SUA') });
    // Dữ liệu cũ (chưa chạy mig 047 → 2 cột null): fallback 1 dòng gộp coi như nguồn KCS.
    if (out.length === 0 && (Number(r.con_oqc) || 0) > 0) {
      out.push({ ...r, _key: `${r.tem_id}-KCS`, nguon: 'KCS', con_src: Number(r.con_oqc), ma_tem_display: maHien(r, 'KCS'), la_sua: !!r.la_tem_sua, tg_kiem: tgKiem(r, 'KCS') });
    }
    return out;
  }).filter((r) => trongKhoangNgay(r.tg_kiem, rangeKiem.from, rangeKiem.to));

  // ── XÁC NHẬN NHANH (ô tích đầu dòng) ──────────────────────────────────────
  // Dòng đã tích nhưng rời danh sách (tải lại / lọc) thì không còn tính — chỉ xét dòng ĐANG HIỆN.
  const dsChon = displayRows.filter((r) => chon.has(r._key));
  const doiChon = (k) => setChon((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const tatCaDaChon = displayRows.length > 0 && displayRows.every((r) => chon.has(r._key));
  const chonTatCa = () => setChon(tatCaDaChon ? new Set() : new Set(displayRows.map((r) => r._key)));
  const moNhanh = () => { setNhanhForm(FORM_MOI()); setNhanhOpen(true); };

  // Áp CÙNG 1 bộ thông tin (SL bốc mẫu · SL đạt · kết quả · owner/lý do cho giao) cho mọi dòng đã tích — gọi
  // `recordOqc` TUẦN TỰ từng dòng (backend giữ nguyên mọi luật của lượt lẻ). Mẫu vượt lô của dòng nào ⇒ chặn, báo tên.
  const saveNhanh = async () => {
    const f = nhanhForm;
    const mau = Number(f.soLuongKiem);
    if (!f.soLuongKiem || !(mau > 0)) { show('Nhập SL bốc mẫu', 'error'); return; }
    const vuot = dsChon.filter((r) => mau > (Number(r.con_src ?? r.con_oqc) || 0));
    if (vuot.length) {
      show(`SL bốc mẫu (${mau}) vượt SL chờ OQC của: ${vuot.map((r) => `${r.ma_tem_display} (${fmtNum(r.con_src)})`).join(', ')} — bỏ tích các tem này hoặc giảm SL mẫu`, 'error');
      return;
    }
    if (f.ketQua === 'KHONG_DAT' && (f.soLuongDat === '' || Number(f.soLuongDat) > mau)) {
      show('Nhập SL đạt trong mẫu (không vượt SL bốc mẫu)', 'error'); return;
    }
    if (f.ketQua === 'KHONG_DAT' && f.ownerChoGiaoId && !f.lyDoChoGiao.trim()) { show('Cho giao ngoại lệ cần nhập lý do', 'error'); return; }
    if (!(await hoiLyDoNghen(dsChon))) return; // tem quá SLA ⇒ nhập lý do nghẽn (mig 106)
    setNhanhSaving(true);
    const loi = [];
    let ok = 0;
    for (const r of dsChon) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await recordOqc(r.tem_id, { ...f, nguon: r.nguon });
        ok += 1;
      } catch (e) {
        loi.push(`${r.ma_tem_display || r.ma_tem}: ${e.message || 'lỗi'}`);
      }
    }
    setNhanhSaving(false);
    const kq = f.ketQua === 'DAT' ? 'đạt' : (f.ownerChoGiaoId ? 'cho giao ngoại lệ' : 'không đạt (nằm lại OQC)');
    show(`Đã xác nhận OQC ${kq} ${ok}/${dsChon.length} tem${loi.length ? ` · LỖI: ${loi.join(' · ')}` : ''}`, loi.length ? 'error' : 'success');
    // Dòng lỗi giữ tích để xem lại; dòng thành công tự rời danh sách khi tải lại.
    setChon(new Set(dsChon.filter((r) => loi.some((x) => x.startsWith(`${r.ma_tem_display || r.ma_tem}:`))).map((r) => r._key)));
    if (!loi.length) setNhanhOpen(false);
    lamMoiSauXacNhan();
  };

  // Quét QR (ma_tem) → tra tem đang chờ OQC → mở modal nhập (ưu tiên nguồn KCS nếu còn).
  const onScan = async (maTem) => {
    setScanOpen(false);
    // ⚠⚠ QUAN TRỌNG NHẤT Ở MÀN NÀY: tem 17 (sửa đạt) là DÒNG TEM RIÊNG với mã RIÊNG của ERP từ
    //   06/09/2026 ⇒ quét nhãn 17 phải ra ĐÚNG tem con đó. `baseMaTem` một mình sẽ đổi `17…` thành
    //   `15…` và mở nhầm tem gốc (hoặc không thấy gì) — `timTheoMaTem` ưu tiên mã nguyên văn.
    const code = String(maTem || '').trim();
    if (!code) return;
    try {
      const res = await listOqcCandidates({ search: code });
      const r = timTheoMaTem(res.data || [], code);
      if (!r) { show(`Tem ${code} không có phần chờ OQC`, 'error'); return; }
      const kcs = Number(r.con_oqc_kcs) || 0;
      const sua = Number(r.con_oqc_sua) || 0;
      if (kcs > 0) open({ ...r, nguon: 'KCS', con_src: kcs, ma_tem_display: maHien(r, 'KCS'), la_sua: !!r.la_tem_sua });
      else if (sua > 0) open({ ...r, nguon: 'SUA', con_src: sua, ma_tem_display: maHien(r, 'SUA'), la_sua: true });
      else open({ ...r, nguon: 'KCS', con_src: Number(r.con_oqc) || 0, ma_tem_display: maHien(r, 'KCS'), la_sua: !!r.la_tem_sua });
    } catch (e) { show(e.message || 'Không tra được tem', 'error'); }
  };

  // Trạm nhận tem trả về = trạm trước của nguồn đang mở.
  const returnTram = editing?.nguon === 'SUA' ? 'Sửa' : 'KCS';

  // Sau khi xác nhận / trả về: xóa ô tìm + đặt con trỏ lại. Ô đang rỗng thì `load` không đổi ⇒ tự tải.
  const lamMoiSauXacNhan = () => {
    if (search) setSearch(''); else load();
    oTim.datConTro();
  };

  // Trả về ĐÚNG trạm trước theo nguồn: tem 15- (KCS) → KCS · tem 17- (đã sửa) → Sửa.
  const doReturn = async () => {
    if (!returnReason.trim()) { show(`Nhập lý do trả về ${returnTram}`, 'error'); return; }
    setSaving(true);
    try {
      await returnOqcToKcs(editing.tem_id, { lyDo: returnReason.trim(), nguon: editing.nguon });
      show(`Đã trả tem ${editing.ma_tem_display || editing.ma_tem} về ${returnTram}`);
      setEditing(null);
      lamMoiSauXacNhan();
    } catch (e) {
      show(e.message || 'Trả về thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const mau = Number(form.soLuongKiem);
    const lo = Number(editing?.con_src ?? editing?.con_oqc) || 0;
    if (!form.soLuongKiem || !(mau > 0)) { show('Nhập SL bốc mẫu', 'error'); return; }
    if (lo && mau > lo) { show(`SL bốc mẫu (${mau}) vượt SL chờ OQC của lô (${lo})`, 'error'); return; }
    if (form.ketQua === 'KHONG_DAT' && (form.soLuongDat === '' || Number(form.soLuongDat) > mau)) {
      show('Nhập SL đạt trong mẫu (không vượt SL bốc mẫu)', 'error'); return;
    }
    if (!(await hoiLyDoNghen([editing]))) return; // tem quá SLA ⇒ nhập lý do nghẽn (mig 106)
    setSaving(true);
    try {
      const r = await recordOqc(editing.tem_id, { ...form, nguon: editing.nguon });
      const map = {
        OQC_DAT: 'OQC đạt ✓ → TOÀN BỘ lô qua giao',
        CHO_GIAO_NGOAI_LE: 'không đạt → CHO GIAO NGOẠI LỆ toàn bộ (có owner)',
        GIU_OQC: 'không đạt → cả lô nằm lại OQC (chưa có owner cho giao)',
      };
      show(`OQC ${editing.ma_tem_display || editing.ma_tem}: ${map[r.data.next] || r.data.next}`, r.data.next === 'GIU_OQC' ? 'warning' : 'success');
      setEditing(null);
      lamMoiSauXacNhan();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const colChon = {
    key: '_chon',
    selection: true,
    header: (
      <input type="checkbox" checked={tatCaDaChon} onChange={chonTatCa} title="Chọn mọi dòng đang hiện"
        className="h-4 w-4 rounded border-line text-primary focus:ring-primary/30" />
    ),
    render: (r) => (
      <input type="checkbox" checked={chon.has(r._key)} onChange={() => doiChon(r._key)}
        className="h-4 w-4 rounded border-line text-primary focus:ring-primary/30" />
    ),
  };
  const columns = [
    ...(canOqc ? [colChon] : []),
    { key: 'ma_tem', header: 'Tem', render: (r) => (
      <div className="flex items-center gap-1.5">
        {/* ⚠ `la_sua` = tem 17 THẬT (tem con, mig 091) HOẶC dòng nguồn SỬA của dữ liệu cũ. Tem con
            mang số lượng ở `sl_kcs_dat` nên `nguon` gửi lên backend vẫn là 'KCS' (đúng sổ cái) —
            chỉ NHÃN hiển thị mới theo `la_sua`. Đừng gộp 2 khái niệm này làm một. */}
        <Badge tone={r.la_gia_cong ? 'success' : r.la_sua ? 'warning' : 'info'}>{r.ma_tem_display || r.ma_tem}</Badge>
        <span className="text-[11px] text-ink-soft">{r.la_gia_cong ? 'gia công' : r.la_sua ? 'đã sửa' : 'từ KCS'}</span>
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
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
    { key: 'nha_gia_cong', header: 'Nhà gia công', render: (r) => r.nha_gia_cong || '—' },
    { key: 'nguoi_truoc', header: 'Người XN trạm trước', render: (r) => r.nguoi_truoc || '—' },
    { key: 'tg_kiem', header: 'Ngày kiểm', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtNgayGio(r.tg_kiem) },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'con_src', header: 'Còn OQC', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.con_src ?? r.con_oqc) },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canOqc && <Button className="px-3 py-1.5" onClick={() => open(r)}>Kiểm OQC</Button> },
  ];

  return (
    <div>
      <Toolbar title="OQC — Kiểm cuối" subtitle="Kiểm cuối theo tem trước giao hàng"
        search={search} onSearch={setSearch} searchPlaceholder="Quét/nhập mã tem..." searchRef={oTim.ref}>
        {canOqc && <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR</Button>}
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span>Ngày in tem</span>
          <div className="w-60"><DateRangePicker value={range} onChange={setRange} placeholder="Chọn khoảng ngày in tem" /></div>
          {(range.from || range.to) && <button type="button" onClick={() => setRange({ from: '', to: '' })} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span>Ngày kiểm</span>
          <div className="w-60"><DateRangePicker value={rangeKiem} onChange={setRangeKiem} placeholder="Chọn khoảng ngày kiểm" /></div>
          {(rangeKiem.from || rangeKiem.to) && <button type="button" onClick={() => setRangeKiem({ from: '', to: '' })} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày kiểm"><Icon name="x" size={14} /></button>}
        </div>
        {canOqc && dsChon.length > 0 && (
          <Button icon="check-circle" onClick={moNhanh}>Xác nhận nhanh ({dsChon.length})</Button>
        )}
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <NghenButton rows={rows} trangThai={(r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status} onClick={() => setNghenOpen(true)} />
        {/* Laptop/PC (từ `md`) giữ NGUYÊN dãy nút cũ (29/10/2026, người dùng chốt); điện thoại gom vào menu "Thêm". */}
        <span className="hidden md:contents">
          <Button chiXemOk variant="ghost" icon="file-spreadsheet" onClick={() => setFinishOpen(true)}>Danh sách finish</Button>
          <Button chiXemOk variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
          <Button chiXemOk variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        </span>
        <MenuNut className="md:hidden" nhom={[{ muc: [
          { ten: 'Danh sách finish', icon: 'file-spreadsheet', chiXemOk: true, onClick: () => setFinishOpen(true) },
          { ten: 'Đã hoàn thành', icon: 'check-circle', chiXemOk: true, onClick: () => setDoneOpen(true) },
          { ten: 'Lịch sử', icon: 'history', chiXemOk: true, onClick: () => setHistOpen(true) },
        ] }]} />
        <Badge tone="warning">{displayRows.length} dòng chờ OQC</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={setField} onClear={clearFilters} open={showFilters} />

      <OwnerHint tram="OQC" className="mb-3" />

      <DataTable columns={columns} rows={displayRows} loading={loading} rowKey="_key"
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có tem nào chờ OQC" />

      <SidePanel
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`OQC — ${editing?.ma_tem_display || editing?.ma_tem || ''}`}
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving} variant={form.ketQua === 'DAT' ? 'primary' : 'danger'}>
              {form.ketQua === 'DAT'
                ? 'Xác nhận đạt'
                : form.ownerChoGiaoId ? 'Xác nhận cho giao' : 'Xác nhận (nằm lại OQC)'}
            </Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {editing?.ma_lenh_san_xuat} · {editing?.phan_list} · SL in {fmtNum(editing?.so_luong)}
          <span className="ml-1 font-semibold text-primary">· cả lô chờ OQC {fmtNum(editing?.con_src ?? editing?.con_oqc)}</span>
          <span className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${editing?.la_sua ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
            {editing?.la_sua ? 'Nguồn đã sửa (tem 17)' : 'Nguồn từ KCS (tem 15)'}
          </span>
        </div>
        <div className="mb-1 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
          Kiểm <b>bốc mẫu</b>: chọn <b>Đạt</b> → <b>toàn bộ {fmtNum(editing?.con_src ?? editing?.con_oqc)} pcs</b> của lô qua giao. Chọn <b>Không đạt</b> → cả lô không đạt.
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="SL bốc mẫu" required hint="Số lấy mẫu ra kiểm">
            <Input type="number" min="1" value={form.soLuongKiem} autoFocus
              onChange={(e) => doiBocMau(e.target.value)} />
          </Field>
          <Field label="SL đạt trong mẫu" hint="Đạt = đạt hết mẫu; nhỏ hơn mẫu ⇒ tự chuyển Không đạt">
            <Input type="number" min="0" value={form.soLuongDat} onChange={(e) => doiSlDat(e.target.value)} />
          </Field>
        </div>
        <Field label="Kết quả">
          <div className="flex gap-2">
            <button type="button" onClick={chonDat}
              className={`flex-1 rounded-control border px-4 py-2.5 text-sm font-semibold transition ${
                form.ketQua === 'DAT' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-line text-ink-soft'
              }`}>Đạt</button>
            <button type="button" onClick={() => setForm({ ...form, ketQua: 'KHONG_DAT' })}
              className={`flex-1 rounded-control border px-4 py-2.5 text-sm font-semibold transition ${
                form.ketQua === 'KHONG_DAT' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-line text-ink-soft'
              }`}>Không đạt</button>
          </div>
        </Field>

        {form.ketQua === 'KHONG_DAT' && (
          <div className="rounded-control border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
            <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              Không đạt: muốn <b>vẫn cho giao</b> (giao đặc biệt) thì chọn <b>owner chịu trách nhiệm</b> + nhập <b>lý do</b>.
              Bỏ trống owner → tem <b>nằm lại OQC</b>.
            </p>
            <Field label="Owner cho giao (chịu trách nhiệm)" required>
              <SearchableSelect
                value={form.ownerChoGiaoId}
                onChange={(v) => setForm({ ...form, ownerChoGiaoId: v })}
                options={users}
                getValue={(u) => u.id}
                getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''}
                getSearch={(u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`}
                placeholder="Gõ tên hoặc tên đăng nhập để tìm..."
              />
            </Field>
            <Field label="Lý do cho giao" required>
              <Textarea rows={2} value={form.lyDoChoGiao} onChange={(e) => setForm({ ...form, lyDoChoGiao: e.target.value })}
                placeholder="Vì sao cho giao dù không đạt..." />
            </Field>
          </div>
        )}

        <p className="text-xs text-ink-soft">Đạt → toàn bộ lô qua giao. Không đạt: có <b>owner + lý do</b> → cho giao ngoại lệ toàn bộ; không có → cả lô nằm lại OQC.</p>

        {/* Trả về trạm trước theo nguồn — tem 15- về KCS, tem 17- về Sửa (kèm lý do) */}
        <div className="mt-3 border-t border-line pt-3">
          {!returnMode ? (
            <button type="button" onClick={() => setReturnMode(true)}
              className="text-xs font-medium text-danger hover:underline">↩ Trả về {returnTram}</button>
          ) : (
            <div className="rounded-control border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/40">
              <p className="mb-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                Trả <b>toàn bộ {fmtNum(editing?.con_src ?? editing?.con_oqc)} pcs</b> của lô{' '}
                {editing?.nguon === 'SUA' ? <>đã sửa (tem 17-) về <b>Sửa</b> để sửa lại</> : <>từ KCS (tem 15-) về <b>KCS</b> để kiểm lại</>} (kèm lý do bắt buộc).
              </p>
              <Field label={`Lý do trả về ${returnTram}`} required>
                <Textarea rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                  placeholder={`Vì sao trả về ${returnTram}...`} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button chiXemOk variant="ghost" className="px-3 py-1.5" onClick={() => { setReturnMode(false); setReturnReason(''); }}>Hủy</Button>
                <Button variant="danger" className="px-3 py-1.5" onClick={doReturn} loading={saving} disabled={!returnReason.trim()}>Trả về {returnTram}</Button>
              </div>
            </div>
          )}
        </div>
      </SidePanel>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử OQC" fetcher={oqcHistory} extraColumns={huyLs.cotHuy} taiLai={huyLs.taiLai} />
      {huyLs.modal}
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Tem đã OQC" maHeader="Tem" fetcher={oqcDone}
        columns={[
          { key: 'ma', header: 'Tem', className: 'whitespace-nowrap', render: (r) => <Badge tone={laSuaDone(r) ? 'warning' : 'info'}>{maHienDone(r)}</Badge> },
          { key: 'nguon', header: 'Nguồn', render: (r) => (r.nguon === 'SUA' ? 'Sửa' : 'KCS') },
          { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
          { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
          { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
          { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
          { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
          { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
          { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
          { key: 'so_luong', header: 'SL đạt', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
          { key: 'sl_qua_giao', header: 'SL qua giao', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.sl_qua_giao) },
          { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
          { key: 'tg', header: 'Giờ HT', className: 'whitespace-nowrap tabular-nums', render: (r) => (r.tg ? new Date(r.tg).toLocaleTimeString('vi-VN') : '') },
          { key: 'nguoi', header: 'Người', render: (r) => r.nguoi || '—' },
        ]}
        // Excel theo ĐÚNG khuôn tờ "DANH SÁCH KIỂM TRA CHẤT LƯỢNG ĐẦU RA QCO" (14/10/2026) — `utils/exportDanhSachOqc.js`.
        xuatExcel={({ rows: ds, date }) => exportDanhSachOqc(ds, { tuNgay: date, maTem: maHienDone })} />

      {/* OQC quét MÃ VẠCH trên tem là chính ⇒ mở ra đã ở chế độ mã vạch (vẫn bấm đổi sang QR được). */}
      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={onScan} cheDoMacDinh="barcode" />

      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="OQC" rows={rows} trangThai={(r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status} tenFile="nghen-oqc"
        maTrang="CL_OQC" />
      {lyDoNghenModal}
      <FinishListModal open={finishOpen} onClose={() => setFinishOpen(false)} />

      {/* XÁC NHẬN NHANH — 1 bộ thông tin cho mọi tem đã tích (18/10/2026). */}
      <Modal open={nhanhOpen} onClose={() => (nhanhSaving ? null : setNhanhOpen(false))}
        title={`Xác nhận nhanh OQC — ${dsChon.length} dòng`}
        footer={(
          <>
            <Button chiXemOk variant="ghost" onClick={() => setNhanhOpen(false)} disabled={nhanhSaving}>Hủy</Button>
            <Button onClick={saveNhanh} loading={nhanhSaving} disabled={!dsChon.length}
              variant={nhanhForm.ketQua === 'DAT' ? 'primary' : 'danger'}>
              {nhanhForm.ketQua === 'DAT' ? `Xác nhận đạt (${dsChon.length})`
                : nhanhForm.ownerChoGiaoId ? `Xác nhận cho giao (${dsChon.length})` : `Xác nhận nằm lại OQC (${dsChon.length})`}
            </Button>
          </>
        )}>
        <div className="space-y-3">
          <div className="max-h-40 overflow-auto rounded-control border border-line">
            <table className="w-full text-xs">
              <thead className="bg-surface-muted text-ink-soft">
                <tr><th className="px-2 py-1 text-left">Tem</th><th className="px-2 py-1 text-left">Code phần</th><th className="px-2 py-1 text-right">Chờ OQC</th></tr>
              </thead>
              <tbody>
                {dsChon.map((r) => (
                  <tr key={r._key} className="border-t border-line">
                    <td className="px-2 py-1 font-medium text-ink">{r.ma_tem_display || r.ma_tem} <span className="text-ink-soft">({r.la_gia_cong ? 'gia công' : r.la_sua ? 'đã sửa' : 'KCS'})</span></td>
                    <td className="px-2 py-1">{r.phan_list || '—'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(r.con_src ?? r.con_oqc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
            Cùng 1 thông tin cho <b>mọi tem đã tích</b> — mỗi tem ghi 1 lượt OQC riêng. <b>Đạt</b> → toàn bộ lô của từng tem qua giao.
          </p>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="SL bốc mẫu (mỗi tem)" required>
              <Input type="number" min="1" value={nhanhForm.soLuongKiem} autoFocus
                onChange={(e) => doiBocMauCua(setNhanhForm)(e.target.value)} />
            </Field>
            <Field label="SL đạt trong mẫu">
              <Input type="number" min="0" value={nhanhForm.soLuongDat} onChange={(e) => doiSlDatCua(setNhanhForm)(e.target.value)} />
            </Field>
          </div>
          <Field label="Kết quả">
            <div className="flex gap-2">
              <button type="button" onClick={chonDatCua(setNhanhForm)}
                className={`flex-1 rounded-control border px-4 py-2.5 text-sm font-semibold transition ${
                  nhanhForm.ketQua === 'DAT' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-line text-ink-soft'
                }`}>Đạt</button>
              <button type="button" onClick={() => setNhanhForm((f) => ({ ...f, ketQua: 'KHONG_DAT' }))}
                className={`flex-1 rounded-control border px-4 py-2.5 text-sm font-semibold transition ${
                  nhanhForm.ketQua === 'KHONG_DAT' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-line text-ink-soft'
                }`}>Không đạt</button>
            </div>
          </Field>
          {nhanhForm.ketQua === 'KHONG_DAT' && (
            <div className="rounded-control border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
              <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                Muốn <b>vẫn cho giao</b> thì chọn owner + lý do. Bỏ trống owner → các tem <b>nằm lại OQC</b>.
              </p>
              <Field label="Owner cho giao (chịu trách nhiệm)">
                <SearchableSelect value={nhanhForm.ownerChoGiaoId}
                  onChange={(v) => setNhanhForm((f) => ({ ...f, ownerChoGiaoId: v }))}
                  options={users} getValue={(u) => u.id} getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''}
                  getSearch={(u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`} placeholder="Gõ tên hoặc tên đăng nhập để tìm..." />
              </Field>
              <Field label="Lý do cho giao">
                <Textarea rows={2} value={nhanhForm.lyDoChoGiao} onChange={(e) => setNhanhForm((f) => ({ ...f, lyDoChoGiao: e.target.value }))}
                  placeholder="Vì sao cho giao dù không đạt..." />
              </Field>
            </div>
          )}
        </div>
      </Modal>
      <Toast toast={toast} />
    </div>
  );
}
