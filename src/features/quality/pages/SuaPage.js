import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import TraVeListModal, { TraVeListButton, TRA_VE_THEO_MAN } from '../../../components/common/TraVeListModal';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import Toolbar from '../../../components/common/Toolbar';
import MenuNut from '../../../components/common/MenuNut';
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
import useLyDoNghen from '../../../hooks/useLyDoNghen';
import { trangThaiSla } from '../../../utils/nghen';
import usePermissions from '../../../hooks/usePermissions';
import useHuyLichSu from '../../../hooks/useHuyLichSu';
import useOTimKiem from '../../../hooks/useOTimKiem';
import { listSuaCandidates, recordSua, suaHistory, suaDone, luuNguoiSua, guiLaiErpSua, huySuaLichSu } from '../../../services/qualityService';
import { getTemLabel } from '../../../services/productionService';
import { listUserOptions } from '../../../services/userService';
import { printSuaOqcTem, moSanCuaSoIn, dongCuaSoIn } from '../../production/utils/printTemLabel';
import exportCheckpointExcel, { cotTemChung, moTaBoLoc } from '../../../utils/exportCheckpointExcel';
import { fmtNum, timTheoMaTem, temCode } from '../../../utils/format';
import VuaQuet from '../../../components/common/VuaQuet';
import SuaNhieuModal, { danhGiaSua, formMoi as formSuaMoi, O_SO as O_SO_SUA } from '../components/SuaNhieuModal';
import TichTemNhapModal from '../../../components/common/TichTemNhapModal';

const empty = { soLuongHuyThang: '', soLuongSua: '', soLuongSuaDat: '', soLuongSuaHuy: '' };
// Tối đa số tem tích để xác nhận sửa 1 lượt (27/10/2026, như KCS) — mỗi tem 1 lần gọi recordSua tuần tự.
const TOI_DA_TICH = 100;
// Ô nhập của bảng "Tích tem" (29/10/2026) — cùng bộ ô với modal xác nhận nhiều tem.
const TRUONG_SUA = O_SO_SUA.map(([k, label]) => ({ k, label }));

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'mauVai', label: 'Màu vải' },
  { key: 'kichVai', label: 'Kích vải' },
  { key: 'kichPhim', label: 'Kích phim' },
];
const FIELD_LABEL = { ...Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, f.label])) };

// ⚠⚠ MÃ TEM 17 LẤY TỪ BACKEND (`ma_tem_17` = `ma_tem` của TEM CON), **KHÔNG suy bằng
//   `temCode(ma_goc, 17)`**: từ 06/09/2026 tem 17 xin mã RIÊNG của ERP (`/barcode-tem-17`) nên nó
//   KHÔNG còn chung 10 số đuôi với tem gốc. Liên kết về tem 15 nằm ở `tem.tem_goc_id` (mig 091).
// ⚠ Lùi về cách suy cũ cho dữ liệu CŨ (lượt sửa trước mig 091 chưa có tem con ⇒ `ma_tem_17` NULL).
const ma17 = (r) => r.ma_tem_17 || temCode(r.ma, 17);

export default function SuaPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const canSua = can('SUA');

  const [rows, setRows] = useState([]);
  const [nghenOpen, setNghenOpen] = useState(false); // modal "Danh sách nghẽn"
  const { hoiLyDoNghen, lyDoNghenModal } = useLyDoNghen({ maTrang: 'SX_SUA', trangThai: trangThaiSla });
  const [traVeOpen, setTraVeOpen] = useState(false); // modal "Danh sách trả về" (25/09/2026)
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Vào trang con trỏ nằm sẵn ở ô tìm; xác nhận sửa xong thì xóa ô + đặt con trỏ lại (quét tem kế).
  const oTim = useOTimKiem();
  const [filters, setFilters] = useState({});

  // Dải "Theo dõi" (sĩ số) bám ĐÚNG ô tìm + panel lọc của màn này — xem hooks/useSiSoLoc.js.
  useSiSoLoc({ timKiem: search, ...filters });
  const [range, setRange] = useState(() => ({ from: '', to: '' }));
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  // TEM ĐÃ TÍCH (27/10/2026, như KCS): giữ bản dòng lúc tích ⇒ dòng tích ghim đầu bảng kể cả khi ô tìm / bộ lọc loại nó.
  const [chon, setChon] = useState([]);
  const daChon = useMemo(() => new Set(chon.map((r) => r.tem_id)), [chon]);
  const [nhieuOpen, setNhieuOpen] = useState(false);
  const [tichTemOpen, setTichTemOpen] = useState(false); // bảng "Tích tem" — quét + nhập nhiều tem theo dòng
  const [vuaQuet, setVuaQuet] = useState(null);

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
  // Hộp Sửa vừa mở ⇒ con trỏ ở ô "Sửa đạt" + bôi đen (SidePanel Headless UI tự đặt focus lúc mở ⇒ đợi vài nhịp) — như KCS.
  const temDangMo = editing ? editing.tem_id : null;
  useEffect(() => {
    if (!temDangMo) return undefined;
    const hen = [80, 250].map((ms) => setTimeout(() => {
      const el = document.getElementById('sua-o-dat');
      if (el && document.activeElement !== el) { el.focus(); el.select(); }
    }, ms));
    return () => hen.forEach(clearTimeout);
  }, [temDangMo]);

  // Dòng đã tích lấy bản MỚI từ danh sách (còn cần sửa đổi theo socket), không còn thì giữ bản lúc tích.
  const rowById = useMemo(() => new Map(rows.map((r) => [r.tem_id, r])), [rows]);
  const chonRows = useMemo(() => chon.map((c) => rowById.get(c.tem_id) || c), [chon, rowById]);
  const viewRows = [...chonRows, ...rows.filter((r) => !daChon.has(r.tem_id))];
  const doiChon = (r) => {
    if (daChon.has(r.tem_id)) { setChon((c) => c.filter((x) => x.tem_id !== r.tem_id)); return; }
    if (chon.length >= TOI_DA_TICH) { show(`Tối đa ${TOI_DA_TICH} tem một lượt`, 'error'); return; }
    setChon((c) => [...c, r]);
  };
  // Ô tích tiêu đề: đang có dòng tích ⇒ BỎ TÍCH HẾT; chưa tích ⇒ tích các dòng đang hiện (tối đa TOI_DA_TICH).
  const tichHet = viewRows.length > 0 && viewRows.every((r) => daChon.has(r.tem_id));
  const doiChonHet = () => setChon(() => (chon.length ? [] : viewRows.slice(0, TOI_DA_TICH)));

  // QUÉT LIÊN TỤC (27/10/2026, như KCS): con trỏ ở ô tìm → quét mã tem + Enter ⇒ ô tìm xóa + MỞ NGAY hộp Sửa của tem
  //   (con trỏ ở ô "Sửa đạt", điền sẵn = cần sửa) → Enter ⇒ lưu, hộp đóng, con trỏ về ô tìm quét tem kế.
  const quetSua = async (giaTri) => {
    const code = String(giaTri || '').trim();
    setSearch('');
    if (!code) { oTim.datConTro(); return; }
    try {
      const res = await listSuaCandidates({ search: code });
      const row = timTheoMaTem(res.data || [], code);
      if (!row) {
        setVuaQuet({ ma: code, tone: 'loi', chu: 'Không có tem chờ sửa khớp mã này' });
        show(`Tem ${code} không có phần chờ sửa`, 'error');
        oTim.datConTro();
        return;
      }
      setVuaQuet({ ma: code, tone: 'ok', chu: `Mở Sửa ${row.ma_tem} · ${row.ma_phan || row.ma_hang || ''} · cần sửa ${fmtNum(row.con_sua)}` });
      openRow(row);
    } catch (e) {
      setVuaQuet({ ma: code, tone: 'loi', chu: e.message || 'Không tra được tem' });
      oTim.datConTro();
    }
  };
  const sauSuaNhieu = (okIds, loi) => {
    setChon((c) => c.filter((x) => !okIds.includes(x.tem_id)));
    load(true);
    if (!loi.length) {
      show(`Đã xác nhận sửa ${okIds.length} tem — in tem 17 ở "Đã hoàn thành"`);
      setNhieuOpen(false);
      oTim.datConTro();
    } else {
      show(`Đã lưu ${okIds.length}/${okIds.length + loi.length} tem — lỗi: ${loi.join(', ')}`, 'error');
    }
  };

  // BẢNG "TÍCH TEM" (29/10/2026, như KCS): mỗi dòng quét 1 tem, nhập số rồi xác nhận sửa cùng lúc.
  const traTemSua = async (code) => {
    const res = await listSuaCandidates({ search: code });
    const row = timTheoMaTem(res.data || [], code);
    return row ? { row } : { loi: 'Không có tem chờ sửa khớp mã này' };
  };
  const sauTichTem = (so, loi) => {
    load(true);
    if (!loi.length) {
      show(`Đã xác nhận sửa ${so} tem — in tem 17 ở "Đã hoàn thành"`);
      setTichTemOpen(false);
      oTim.datConTro();
    } else {
      show(`Đã lưu ${so}/${so + loi.length} tem — lỗi: ${loi.join(', ')}`, 'error');
    }
  };

  // ── IN TEM 17 (Sửa đã hoàn thành → OQC) ────────────────────────────────────
  // ⚠⚠ ĐÃ BỎ nút "In tem" ở TỪNG DÒNG (đổi 12/08/2026). Nay: tích dòng ở sidebar "Đã hoàn thành"
  //   → nút "In tem" ở CHÂN panel → modal nhập TÊN NGƯỜI SỬA từng dòng → in.
  //   Vì sao: tờ decal vốn là 2-up (2 tem/tờ) — in 1 tem mỗi lần thì tem bên cạnh bỏ trắng, tốn nửa
  //   tờ; và tem 17 dán lô đi giao cần biết AI ĐÃ SỬA, trước đây không có chỗ nào nhập.
  //   07/10/2026: BỎ trần 2 dòng — tích bao nhiêu cũng được; mỗi tờ vẫn 2 tem (dòng 1–2 tờ 1, dòng 3–4 tờ 2…),
  //   mọi tờ trong 1 cửa sổ in.
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

  // Lưu người sửa (mig 080) rồi IN — 1 lần bấm = 1 cửa sổ in cho mọi tem (popup blocker chỉ cho mở 1 cửa
  // sổ / 1 lượt bấm). Cửa sổ MỞ SẴN ngay trong cú bấm: N dòng phải lưu người sửa + lấy N nhãn, mở sau là bị chặn.
  const doInTem = async () => {
    if (!inRows.length) return;
    if (inRows.some((r) => !String(r.nguoiSua || '').trim())) {
      show('Nhập tên người sửa cho mọi dòng trước khi in', 'error');
      return;
    }
    let w;
    try { w = moSanCuaSoIn(); } catch (e) { show(e.message, 'error'); return; }
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
          // ⚠⚠ ĐÈ `ma_tem` BẰNG MÃ CỦA TEM CON: `getTemLabel(r.tem_id)` trả nhãn của TEM GỐC (bảng
          //   `sua` khóa theo tem gốc). Từ 06/09/2026 tem 17 có mã RIÊNG của ERP nên KHÔNG suy được
          //   từ mã gốc — thiếu dòng này thì QR + số in trên nhãn 17 là của tem 15, quét ra sai tem.
          ma_tem: ma17(r),
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
      await printSuaOqcTem(labels, w);
      show(`Đã in ${labels.length} tem 17 (sửa đạt → OQC) · ${Math.ceil(labels.length / 2)} tờ`);
      setInOpen(false);
      clearChonRef.current?.();
    } catch (e) {
      dongCuaSoIn(w);
      show(e.message || 'Không in được tem', 'error');
    } finally { setInBusy(false); }
  };

  // GỬI SỬA ĐẠT SANG ERP (proc MES_spr_MES2SK6, 21/09/2026) — backend tự gửi NGẦM 1 lần/lượt ngay khi
  // xác nhận sửa; cột này chỉ để thấy lượt nào TRƯỢT và gửi lại. Ghi đè tại chỗ sau khi bấm (DonePanel
  // không tự tải lại) để khỏi bấm 2 lần.
  const [erpGui, setErpGui] = useState({});   // { [suaId]: 'DANG' | 'OK' | 'LOI' }
  const doGuiLaiErp = async (r) => {
    setErpGui((m) => ({ ...m, [r.sua_id]: 'DANG' }));
    try {
      await guiLaiErpSua(r.sua_id);
      setErpGui((m) => ({ ...m, [r.sua_id]: 'OK' }));
      show(`Đã gửi sửa đạt tem ${ma17(r)} sang ERP`);
    } catch (e) {
      // 409 DA_GUI = lượt này thực ra đã gửi được rồi ⇒ hiện đúng trạng thái thay vì báo lỗi đỏ.
      const daGui = e?.response?.data?.errorCode === 'DA_GUI' || e?.errorCode === 'DA_GUI';
      setErpGui((m) => ({ ...m, [r.sua_id]: daGui ? 'OK' : 'LOI' }));
      show(e.message || 'Gửi ERP thất bại', daGui ? undefined : 'error');
    }
  };
  const oErp = (r) => {
    if (!r.sua_id || !(Number(r.so_luong) > 0)) return <span className="text-ink-soft">—</span>;
    const tt = erpGui[r.sua_id] || r.erp_sua_dat;
    if (tt === 'OK') return <Badge tone="success">Đã gửi</Badge>;
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {tt === 'LOI' ? <Badge tone="danger">Lỗi</Badge> : <Badge tone="warning">Chưa gửi</Badge>}
        <Button variant="secondary" className="px-2 py-0.5 text-xs" icon="wifi"
          loading={tt === 'DANG'} onClick={() => doGuiLaiErp(r)}>Gửi lại</Button>
      </div>
    );
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
    { key: 'erp_sua_dat', header: 'ERP', className: 'whitespace-nowrap', render: oErp },
  ];

  // Quét QR (ma_tem) → tra tem đang chờ sửa → mở modal nhập.
  const onScan = async (maTem) => {
    setScanOpen(false);
    // ⚠ Xem ghi chú ở `KcsPage.onScan`: tìm bằng mã NGUYÊN VĂN, đối chiếu bằng `timTheoMaTem`.
    //   Người quét ở đây thường cầm nhãn `16…` (hàng lỗi) — nhãn đó vẫn suy về tem gốc như cũ.
    const code = String(maTem || '').trim();
    if (!code) return;
    try {
      const res = await listSuaCandidates({ search: code });
      const row = timTheoMaTem(res.data || [], code);
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
  // NÚT "HỦY" Ở TỪNG DÒNG LỊCH SỬ (14/10/2026): nhập lý do ⇒ backend đảo sổ cái lượt đó rồi báo ERP hủy chứng từ
  // theo IDMES. Chỉ cần quyền công đoạn của màn này (người dùng chốt).
  const huyLs = useHuyLichSu({
    goiHuy: (r, ly) => huySuaLichSu(r.id, ly),
    show,
    coQuyen: canSua,
    tieuDe: 'Hủy xác nhận Sửa',
    moTa: (r) => <>Tem <b>{r.doi_tuong}</b> · {r.chi_tiet}</>,
    nhanNut: 'Hủy xác nhận',
    hauQua: 'Số lượng của lượt này quay về chờ sửa; tem 17 của lượt (nếu có) bị gỡ.',
    baoXong: (r) => `Đã hủy lượt Sửa của tem ${r.doi_tuong || ''}`,
    sauKhiHuy: () => load(true),
  });

  const save = async () => {
    const dg = danhGiaSua(Number(editing?.con_sua) || 0, form);
    if (!dg.ok) { show(dg.chu, 'error'); return; } // backend vẫn chặn (422 EMPTY / OVER)
    if (!(await hoiLyDoNghen([editing]))) return; // tem quá SLA ⇒ nhập lý do nghẽn (mig 106)
    setSaving(true);
    try {
      const r = await recordSua(editing.tem_id, form);
      const conLai = Number(r.data.con_sua) || 0;
      show(`Sửa ${editing.ma_tem}: đạt ${fmtNum(r.data.so_luong_sua_dat)} → OQC`
        + (conLai > 0 ? ` · còn ${fmtNum(conLai)} chờ sửa` : ' · đã sửa hết'));
      setEditing(null);
      // Ô tìm đang rỗng thì `load` không đổi ⇒ phải tự tải; có mã thì xóa ô cũng kéo `load` chạy lại.
      if (search) setSearch(''); else load();
      oTim.datConTro();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    ...(canSua ? [{ key: 'sel', selection: true,
      header: <input type="checkbox" aria-label="Chọn tất cả / bỏ tích tất cả" checked={tichHet}
        ref={(el) => { if (el) el.indeterminate = chon.length > 0 && !tichHet; }} onChange={doiChonHet} />,
      render: (r) => (
        <input type="checkbox" aria-label="Chọn tem" checked={daChon.has(r.tem_id)}
          onClick={(e) => e.stopPropagation()} onChange={() => doiChon(r)} />
      ) }] : []),
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

  // Enter ở ô số = Xác nhận sửa (như KCS).
  const N = (f, label) => (
    <Field label={label}>
      <Input type="number" min="0" value={form[f]} id={f === 'soLuongSuaDat' ? 'sua-o-dat' : undefined}
        onKeyDown={(e) => { if (e.key === 'Enter' && !saving) { e.preventDefault(); save(); } }}
        onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
    </Field>
  );

  // Xuất Excel ĐÚNG danh sách đang hiện. ⚠ Màn này lọc Ở SERVER (ô tìm + 6 trường + khoảng ngày in
  // tem đều gửi lên `listSuaCandidates`) nên `rows` CHÍNH LÀ tập sau bộ lọc — không có bước lọc client.
  const doExcel = () => exportCheckpointExcel({
    cols: [
      ...cotTemChung(),
      { header: 'Ca SX', width: 12, value: (r) => (r.ca == null ? '' : String(r.ca)) },
      { header: 'Người XN trạm trước', width: 20, value: (r) => (r.nguoi_truoc == null ? '' : String(r.nguoi_truoc)) },
      { header: 'SL in', width: 12, num: true, value: (r) => (r.so_luong == null ? null : Number(r.so_luong)) },
      { header: 'SL cần sửa', width: 12, num: true, value: (r) => (r.con_sua == null ? null : Number(r.con_sua)) },
      { header: 'Bị OQC trả về', width: 14, value: (r) => ((r.tra_ve || r.tra_ve_ly_do) ? 'Có' : '') },
    ],
    rows,
    title: 'Sửa hàng lỗi — tem chờ sửa',
    fileName: 'sua-cho-sua',
    moTaLoc: moTaBoLoc({
      'tìm kiếm': search,
      'ngày in tem': [range.from, range.to].filter(Boolean).join(' → '),
      ...filters,
    }),
  });

  return (
    <div>
      <Toolbar title="Sửa hàng lỗi" subtitle="Xử lý tem lỗi từ KCS / OQC"
        search={search} onSearch={setSearch} searchPlaceholder="Quét mã tem rồi Enter để mở Sửa — gõ để tìm..." searchRef={oTim.ref}
        onSearchEnter={canSua ? quetSua : undefined}>
        {canSua && <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR</Button>}
        {canSua && <Button icon="barcode" onClick={() => setTichTemOpen(true)}>Tích tem</Button>}
        {canSua && chon.length > 0 && (
          <Button icon="check-circle" onClick={() => setNhieuOpen(true)}>Xác nhận sửa ({chon.length})</Button>
        )}
        {chon.length > 0 && <Button chiXemOk variant="ghost" icon="x" onClick={() => setChon([])}>Bỏ tích</Button>}
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span>Ngày in tem</span>
          <div className="w-60"><DateRangePicker value={range} onChange={setRange} placeholder="Chọn khoảng ngày in tem" /></div>
          {(range.from || range.to) && <button type="button" onClick={() => setRange({ from: '', to: '' })} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>}
        </div>
        <Button chiXemOk variant={showFilters || activeFilters.length ? 'secondary' : 'ghost'} icon="filter"
          onClick={() => setShowFilters((v) => !v)}>Bộ lọc{activeFilters.length ? ` (${activeFilters.length})` : ''}</Button>
        <NghenButton rows={rows} trangThai={(r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status} onClick={() => setNghenOpen(true)} />
        {/* Laptop/PC (từ `md`) giữ NGUYÊN dãy nút cũ (29/10/2026, người dùng chốt); điện thoại gom vào menu "Thêm". */}
        <span className="hidden md:contents">
          <TraVeListButton onClick={() => setTraVeOpen(true)} />
          <Button chiXemOk variant="secondary" icon="download" onClick={doExcel} disabled={!rows.length}>
            Excel ({rows.length})
          </Button>
          <Button chiXemOk variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
          <Button chiXemOk variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        </span>
        <MenuNut className="md:hidden" nhom={[
          { muc: [
            { ten: 'Danh sách trả về', icon: 'undo', chiXemOk: true, onClick: () => setTraVeOpen(true) },
            { ten: 'Đã hoàn thành', icon: 'check-circle', chiXemOk: true, onClick: () => setDoneOpen(true) },
            { ten: 'Lịch sử', icon: 'history', chiXemOk: true, onClick: () => setHistOpen(true) },
          ] },
          { muc: [{ ten: 'Xuất Excel', icon: 'download', chiXemOk: true, ghi: rows.length, disabled: !rows.length, onClick: doExcel }] },
        ]} />
        <Badge tone="warning">{rows.length} tem chờ sửa</Badge>
      </Toolbar>
      <VuaQuet ket={vuaQuet} className="mb-3" />

      {showFilters && (
        <div className="mb-3 card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Lọc nhiều trường (kết hợp AND)</h3>
            <Button chiXemOk variant="ghost" className="px-2.5 py-1 text-xs" onClick={clearFilters}
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

      <DataTable columns={columns} rows={viewRows} loading={loading} rowKey="tem_id"
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có tem nào chờ sửa" />

      <SuaNhieuModal open={nhieuOpen} rows={chonRows} onClose={() => { setNhieuOpen(false); oTim.datConTro(); }}
        onXong={sauSuaNhieu} truocXacNhan={(rs) => hoiLyDoNghen(rs)} show={show} />
      <TichTemNhapModal open={tichTemOpen} onClose={() => { setTichTemOpen(false); oTim.datConTro(); }}
        title="Tích tem — xác nhận sửa nhiều tem" nhanXacNhan="Xác nhận sửa" show={show}
        traMa={traTemSua} khoaDong={(r) => r.tem_id} maHien={(r) => r.ma_tem}
        soCan={(r) => r.con_sua} nhanSoCan="Cần sửa" truong={TRUONG_SUA} formMoi={formSuaMoi}
        danhGia={(r, f) => danhGiaSua(Number(r.con_sua) || 0, f)}
        luu={(r, f) => recordSua(r.tem_id, { ...f })}
        truocXacNhan={(rs) => hoiLyDoNghen(rs)} onXong={sauTichTem}
        phuTro={({ apMoiDong, dangLuu, coDong }) => (
          <Button variant="secondary" icon="check" disabled={dangLuu || !coDong}
            onClick={() => apMoiDong((r, f) => ({ ...f, soLuongSuaDat: String(r.con_sua ?? ''), soLuongSuaHuy: '', soLuongHuyThang: '' }))}>
            Đạt hết
          </Button>
        )} />

      <SidePanel
        open={!!editing}
        onClose={() => { setEditing(null); oTim.datConTro(); }}
        title={`Sửa — ${editing?.ma_tem || ''}`}
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
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
        title="Lịch sử Sửa" fetcher={suaHistory} extraColumns={huyLs.cotHuy} taiLai={huyLs.taiLai} />
      {huyLs.modal}
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Tem đã sửa" maHeader="Tem" fetcher={suaDone} columns={doneColumns}
        chonNhieu
        chonDuoc={(r) => (r.tem_id ? (r.sua_id ? true : 'Thiếu migration 080 — chưa in được tem có tên người sửa') : 'Dòng này không có tem')}
        footerChon={({ rows: sel, clear }) => (
          <>
            <span className="mr-auto text-xs text-ink-soft">
              {sel.length === 0
                ? 'Tích các dòng để in tem (mỗi tờ 2 tem: dòng 1 → trái, dòng 2 → phải, dòng 3–4 sang tờ sau…)'
                : `Đã chọn ${sel.length} dòng · ${Math.ceil(sel.length / 2)} tờ`}
            </span>
            {sel.length > 0 && <Button chiXemOk variant="ghost" onClick={clear}>Bỏ chọn</Button>}
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
          { header: 'ERP', value: (r) => {
            const tt = erpGui[r.sua_id] || r.erp_sua_dat;
            if (!(Number(r.so_luong) > 0)) return '';
            return tt === 'OK' ? 'Đã gửi' : tt === 'LOI' ? 'Lỗi' : 'Chưa gửi';
          } },
        ]} />

      {/* MODAL IN TEM 17 — bảng thông tin các tem sắp in + ô nhập TÊN NGƯỜI SỬA từng dòng.
          Ô nhập dùng `SearchableSelect` (chọn từ tài khoản, tìm không dấu) giống ô Ca trưởng bên
          màn Sản xuất; giá trị lưu là TÊN nên người chưa có tài khoản vẫn in được — gõ tên rồi Enter
          (`chapNhanTuDo`), CHỈ 1 ô nhập cho mỗi dòng. */}
      <Modal open={inOpen} onClose={() => setInOpen(false)} size="xl"
        title={`In tem 17 — ${inRows.length} tem trên ${Math.ceil(inRows.length / 2)} tờ`}
        footer={
          <>
            <span className="mr-auto text-xs text-ink-soft">
              {inRows.length === 1
                ? 'In 2 nhãn GIỐNG NHAU trên tờ decal'
                : `Mỗi tờ 2 tem: dòng lẻ → trái · dòng chẵn → phải${inRows.length % 2 ? ' · tờ cuối 2 nhãn giống nhau' : ''}`}
            </span>
            <Button chiXemOk variant="ghost" onClick={() => setInOpen(false)}>Hủy</Button>
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
                  {/* Mã tem 17 (sửa đạt → giao) — đúng cái sẽ hiện trên nhãn giấy. */}
                  <td className="px-2 py-2"><Badge tone="info">{ma17(r)}</Badge></td>
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

      <TraVeListModal open={traVeOpen} onClose={() => setTraVeOpen(false)}
        tenMan="Sửa" loais={TRA_VE_THEO_MAN.SX_SUA} tenFile="tra-ve-sua" />
      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="Sửa" rows={rows} trangThai={(r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status} tenFile="nghen-sua"
        maTrang="SX_SUA" />
      {lyDoNghenModal}
      <Toast toast={toast} />
    </div>
  );
}
