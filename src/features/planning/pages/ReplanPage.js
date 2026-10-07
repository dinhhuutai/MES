import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Field, Input, Textarea } from '../../../components/common/controls';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import TimeSelect from '../../../components/common/TimeSelect';
import NhieuNguoiSelect from '../../../components/common/NhieuNguoiSelect';
import { listUserOptions } from '../../../services/userService';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import PhuongAnInBadge from '../../../components/common/PhuongAnInBadge';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import FieldFilters, { FilterToggle } from '../../../components/common/FieldFilters';
import Pagination from '../../../components/common/Pagination';
import DateRangePicker from '../../../components/common/DateRangePicker';
import { laGomSet } from '../utils/phanInLenh';
import { listReplanCandidates, listReplanIds, listReplanMaQuet, replan, getReplanDetail, replanBatch, listChuyen, planHistory, replanDone } from '../../../services/planningService';
import { fmtNum, fmtDate, ngayLocalISO } from '../../../utils/format';

// ⚠⚠ LỌC + PHÂN TRANG Ở SERVER (30/09/2026): prod có ~6.000 lệnh ở màn này (xưởng chưa bấm Xác nhận chạy
//   nên lệnh RELEASE_2 dồn lại) — bản cũ tải HẾT về trình duyệt (3 lượt × ~2 MB) nên xoay rất lâu.
//   Nay mỗi lần chỉ lấy 1 trang `PAGE` lệnh; bộ lọc từng trường gửi lên server dạng `f_<key>`
//   (khóa phải khớp `REPLAN_LOC` ở `planning.controller` + `replanWhere` ở repository).
// ⚠ Mặc định chỉ hiện lệnh có NGÀY SX KẾ HOẠCH TỪ HÔM QUA trở đi (người dùng chốt "1 ngày"); bấm "Xóa"
//   ở ô ngày để xem mọi lệnh. Lệnh chưa có ngày kế hoạch luôn hiện.
const PAGE = 20;
const homQua = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ngayLocalISO(d); };
const FILTER_FIELDS = [
  { key: 'maLenh', label: 'Mã đợt SX', col: 'ma_lenh_san_xuat' },
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' },
  { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' },
  { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
  { key: 'chuyen', label: 'Chuyền hiện tại', col: 'ten_chuyen' },
  { key: 'nhaGiaCong', label: 'Nhà gia công', col: 'nha_gia_cong' },
];

// Màu badge theo TRẠM ĐANG Ở (mã stage của backend — `utils/stage.js STAGE_ORDER`).
// Thiếu mã ⇒ tone 'info', không mất dòng nào; nhãn chữ luôn lấy từ `giai_doan_ten` do backend gửi.
const TONE_GIAI_DOAN = {
  READY_KT: 'default', READY_QA: 'default',
  TESTRUN_CNSP: 'warning', TESTRUN_QA: 'warning',
  RELEASE_2: 'success', CHO_SAN_XUAT: 'success',
  GIA_CONG: 'info',
};

// Ngày (Date/ISO) → 'YYYY-MM-DD' theo giờ địa phương cho input[type=date] (tránh lệch ngày do slice ISO/UTC).
const dateStr = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Giờ trong ngày ('HH:MM') của `tg_bd_kh`/`tg_kt_kh` đã lưu → đổ sẵn vào ô TimeSelect.
const gioStr = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Ghép ngày kế hoạch + giờ thành mốc gửi lên backend — GIỐNG HỆT màn Release 1.
// Thiếu ngày hoặc thiếu giờ ⇒ null: backend sẽ tự DỜI giờ cũ sang ngày mới, không mất giờ đã đặt.
const mkTs = (ngay, gio) => (ngay && gio ? `${ngay}T${gio}:00` : null);

export default function ReplanPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const { statusLenh } = useNghenMap();
  const canReplan = can('RELEASE2') || can('RELEASE1');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chuyen, setChuyen] = useState([]);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;
  const [page, setPage] = useState(1);
  const [ngay, setNgay] = useState(() => ({ from: homQua(), to: '' }));
  // Chuỗi khóa ổn định của bộ lọc (đưa vào deps thay cho object — tránh vòng tải lại vô hạn).
  const locKey = JSON.stringify(filters);

  const [detail, setDetail] = useState(null);
  // `dsDot` = đợt vải của lệnh đang mở + SL release đang giữ + trần được nâng (tải khi mở panel).
  const [dsDot, setDsDot] = useState([]);
  const [form, setForm] = useState({ chuyenId: '', ngayKeHoach: '', gioBd: '', gioKt: '', lyDo: '', slRelease: {}, thoIn: '' });
  const [saving, setSaving] = useState(false);
  // Danh sách người cho ô THỢ IN KẾ HOẠCH (mig 111, cùng ô ở Release 1) — lỗi tải thì vẫn gõ tên tay được.
  const [users, setUsers] = useState([]);
  useEffect(() => {
    listUserOptions({ limit: 500 }).then((r) => setUsers(r.data || [])).catch(() => {});
  }, []);
  // Tổng SL release đang nhập + cờ chặn Lưu. Ô để TRỐNG cũng tính là sai: SL release là số bắt buộc,
  // để trống rồi lưu thì người dùng tưởng đã xóa số mà thật ra backend giữ nguyên giá trị cũ.
  const tongSlMoi = useMemo(
    () => dsDot.reduce((a, d) => a + (Number(form.slRelease[d.dot_vai_id]) || 0), 0),
    [dsDot, form.slRelease]
  );
  const vuotSl = useMemo(() => dsDot.some((d) => {
    const v = form.slRelease[d.dot_vai_id];
    const n = Number(v);
    return v === '' || v === undefined || !Number.isInteger(n) || n <= 0 || n > d.toi_da;
  }), [dsDot, form.slRelease]);

  const [selected, setSelected] = useState(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({ chuyenId: '', ngayKeHoach: '', gioBd: '', gioKt: '', lyDo: '', thoIn: '' });
  const [scanOpen, setScanOpen] = useState(false);
  const [scanRows, setScanRows] = useState([]);
  const [chonHetBusy, setChonHetBusy] = useState(false);

  // Tham số lọc gửi server — dùng chung cho trang dữ liệu + "Chọn tất cả N lệnh".
  const locParams = useCallback(() => ({
    search,
    tuNgay: ngay.from || undefined,
    denNgay: ngay.to || undefined,
    ...Object.fromEntries(Object.entries(JSON.parse(locKey)).filter(([, v]) => v).map(([k, v]) => [`f_${k}`, v])),
  }), [search, ngay.from, ngay.to, locKey]);

  // Đổi tìm kiếm / bộ lọc / ngày ⇒ về trang 1 và BỎ lựa chọn (lệnh đã chọn có thể không còn trong tập lọc).
  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, ngay.from, ngay.to, locKey]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await listReplanCandidates({ ...locParams(), page, limit: PAGE });
      setRows(res.data.items || []);
      setMeta(res.data.meta || { page, totalPages: 1, total: 0 });
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [locParams, page, show]);

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);
  // Gõ tìm / lọc ⇒ chờ 300ms mới gọi (không bắn 1 request mỗi phím).
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  // Modal quét: tải danh sách GỌN mọi lệnh trong khoảng ngày đang lọc (quét được cả lệnh ở trang khác).
  const moQuet = async () => {
    setScanOpen(true);
    try { setScanRows((await listReplanMaQuet({ tuNgay: ngay.from || undefined, denNgay: ngay.to || undefined })).data || []); }
    catch (e) { show(e.message || 'Không tải được danh sách để quét', 'error'); }
  };

  // Tự tải lại khi trạm khác xác nhận (tránh màn để lâu → dữ liệu cũ).
  // Bỏ qua khi đang tick dở để không mất lựa chọn — `load` xóa danh sách đã chọn.
  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua `setLoading(true)` (bảng không bị
  // thay bằng spinner) và KHÔNG xóa dòng đang tích. Nhiều sự kiện trong 400ms gộp thành 1 lần tải.
  useSocketReload(['workflow:updated'], () => load(true));

  // Đổ sẵn chuyền / ngày / GIỜ / SL RELEASE hiện tại của lệnh ⇒ không đụng gì thì giữ nguyên kế
  // hoạch cũ; sửa 1 thứ thì không phải nhập lại những thứ còn nguyên.
  // ⚠ SL release nằm ở mức (lệnh × ĐỢT VẢI) nên phải gọi thêm `GET /planning/replan/:id` — hàng trong
  //   bảng chỉ có tổng `so_luong_release`, không tách được theo đợt (198/1296 lệnh gộp nhiều đợt vải).
  // ⚠ Lỗi tải danh sách đợt vải bị NUỐT: đó là phần thêm, không được chặn việc dời ngày/chuyền.
  const openDetail = async (row) => {
    setDetail(row);
    setDsDot([]);
    setForm({
      chuyenId: row.chuyen_id || '',
      ngayKeHoach: dateStr(row.ngay_ke_hoach),
      gioBd: gioStr(row.tg_bd_kh),
      gioKt: gioStr(row.tg_kt_kh),
      lyDo: '',
      slRelease: {},
      thoIn: row.tho_in_kh || '',
    });
    try {
      const r = await getReplanDetail(row.id);
      const ds = r.data.dot_vai || [];
      setDsDot(ds);
      // Gắn thêm SL đã nhận về (lệnh gia công nhận hàng nhiều lần) để panel cảnh báo đúng con số.
      setDetail((d) => (d && d.id === row.id
        ? { ...d, da_nhan: r.data.da_nhan, so_luong_release: r.data.so_luong_release ?? d.so_luong_release } : d));
      setForm((f) => ({ ...f, slRelease: Object.fromEntries(ds.map((d) => [d.dot_vai_id, String(d.so_luong)])) }));
    } catch (e) { /* im lặng — vẫn dời được ngày/chuyền/giờ */ }
  };

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Ô tích đầu bảng = chọn/bỏ các lệnh của TRANG ĐANG XEM (giữ lựa chọn ở trang khác).
  // Muốn chọn MỌI lệnh khớp bộ lọc thì bấm "Chọn tất cả N lệnh" (lấy ID từ server) — không bao giờ
  // chọn lệnh NGOÀI bộ lọc, để người dùng biết mình đang lập lại kế hoạch cho những lệnh nào.
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((s) => {
    const next = new Set(s);
    rows.forEach((r) => (allChecked ? next.delete(r.id) : next.add(r.id)));
    return next;
  });
  const chonHet = async () => {
    setChonHetBusy(true);
    try { setSelected(new Set((await listReplanIds(locParams())).data || [])); }
    catch (e) { show(e.message || 'Không lấy được danh sách lệnh', 'error'); }
    finally { setChonHetBusy(false); }
  };

  const openBatch = () => {
    setBatchForm({ chuyenId: '', ngayKeHoach: '', gioBd: '', gioKt: '', lyDo: '', thoIn: '' });
    setBatchOpen(true);
  };
  // Backend chưa có cột thợ in kế hoạch (mig 111 chưa chạy) ⇒ lập lại kế hoạch vẫn xong, chỉ báo thêm.
  const canhBaoThoIn = (res) => (res?.data?.tho_in_chua_luu ? ' · CHƯA lưu thợ in (hệ thống chưa cập nhật cơ sở dữ liệu)' : '');

  const submitBatch = async () => {
    if (!batchForm.ngayKeHoach) { show('Chọn ngày sản xuất kế hoạch', 'error'); return; }
    setSaving(true);
    try {
      const res = await replanBatch({
        lenhIds: [...selected],
        chuyenId: batchForm.chuyenId || null,
        ngayKeHoach: batchForm.ngayKeHoach,
        tgBdKh: mkTs(batchForm.ngayKeHoach, batchForm.gioBd),
        tgKtKh: mkTs(batchForm.ngayKeHoach, batchForm.gioKt),
        lyDo: batchForm.lyDo.trim(),
        // Trống = GIỮ thợ in kế hoạch riêng của từng lệnh (không gửi khóa ⇒ backend không đụng).
        ...(batchForm.thoIn.trim() ? { thoIn: batchForm.thoIn } : {}),
      });
      const { okCount, failedCount } = res.data;
      show((failedCount ? `Đã lập lại ${okCount} lệnh, ${failedCount} lỗi` : `Đã lập lại kế hoạch ${okCount} lệnh`) + canhBaoThoIn(res),
        failedCount ? 'error' : 'success');
      setBatchOpen(false);
      setSelected(new Set());
      load();
    } catch (e) {
      show(e.message || 'Lập lại kế hoạch thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!form.ngayKeHoach) { show('Chọn ngày sản xuất kế hoạch', 'error'); return; }
    if (vuotSl) { show('Số lượng release không hợp lệ — kiểm tra lại các ô SL', 'error'); return; }
    setSaving(true);
    try {
      const res = await replan(detail.id, {
        chuyenId: form.chuyenId || null,
        ngayKeHoach: form.ngayKeHoach,
        tgBdKh: mkTs(form.ngayKeHoach, form.gioBd),
        tgKtKh: mkTs(form.ngayKeHoach, form.gioKt),
        lyDo: form.lyDo.trim(),
        // Chỉ gửi ô THỰC SỰ ĐỔI — gửi cả bộ thì audit ghi "đổi SL" cho cả lần chỉ dời ngày.
        slRelease: Object.fromEntries(dsDot
          .filter((d) => String(form.slRelease[d.dot_vai_id] ?? '') !== String(d.so_luong))
          .map((d) => [d.dot_vai_id, form.slRelease[d.dot_vai_id]])),
        // Thợ in kế hoạch: chỉ gửi khi đổi (xóa hết = gửi chuỗi rỗng ⇒ backend xóa).
        ...((form.thoIn || '') !== (detail.tho_in_kh || '') ? { thoIn: form.thoIn || '' } : {}),
      });
      show(`Đã lập lại kế hoạch cho ${detail.ma_lenh_san_xuat}${canhBaoThoIn(res)}`);
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Lập lại kế hoạch thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    ...(canReplan ? [{ key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)} aria-label="Chọn lệnh" />
      ) }] : []),
    // LỆNH GOM SET hiện GIỐNG MÀN RELEASE 1: mỗi phần in 1 DÒNG, các ô ở mức LỆNH hợp nhất bằng
    // `rowSpan` (prop `subRows` + cột `merge` của DataTable — cùng cơ chế màn Xác nhận chạy).
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', merge: true, render: (r) => (
      <div className="space-y-1">
        <Badge tone="info">{r.ma_lenh_san_xuat}</Badge>
        {laGomSet(r) && (
          <div className="text-xs text-primary">gom set · {r.so_phan_in} phần in · in chung</div>
        )}
      </div>
    ) },
    // ⚠⚠ GIAI ĐOẠN = TRẠM ĐANG Ở, do BACKEND tính (`lenhStageCase`, cùng nguồn luật với dashboard).
    //   Bản cũ suy từ mỗi `trang_thai` nên hiện **trạm đã đi qua gần nhất**: lệnh `RELEASE_1` luôn ghi
    //   "Test Run" kể cả khi đã test xong (thực tế đang chờ duyệt Release 2) hoặc khi bị QA trả về
    //   Kỹ thuật (thực tế đang ở READY). Nhãn lấy nguyên `giai_doan_ten` — đừng map lại ở FE.
    { key: 'giai_doan', header: 'Giai đoạn', merge: true, render: (r) => (
      <div className="space-y-1">
        <Badge tone={TONE_GIAI_DOAN[r.giai_doan_hien_tai] || 'info'}
          className="max-w-[8.5rem] whitespace-normal break-words">
          {r.giai_doan_ten || '—'}
        </Badge>
        {/* Lệnh gia công ĐÃ nhận về một phần: vẫn lập lại kế hoạch được (dời ngày / đổi nhà gia công)
            nhưng KHÔNG đưa về chuyền in trong xưởng được nữa — backend chặn 409 `DA_NHAN_HANG`. */}
        {r.co_phieu && (
          <Badge tone="warning" title="Đã nhận một phần hàng về — chỉ đổi được sang chuyền gia công khác">
            Đã nhận hàng
          </Badge>
        )}
      </div>
    ) },
    // ↓ Các cột THEO PHẦN IN — dòng con ghi đè giá trị nên mỗi phần in hiện đúng dữ liệu của nó.
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    // ↓ Từ đây là mức LỆNH → hợp nhất ô.
    // ⚠ `phuong_an_in`/`loai_dot_vai`/`SLNV`/`Hạn giao` lấy từ ĐỢT VẢI ĐẠI DIỆN (`PHAN_INFO_LATERAL`
    //   `LIMIT 1`) nên với lệnh gom set chỉ có MỘT giá trị — hợp nhất ô là cách trung thực nhất,
    //   lặp lại ở từng dòng con sẽ khiến người đọc tưởng mọi phần in đều đúng như vậy.
    { key: 'phuong_an_in', header: 'Phương án in', merge: true, render: (r) => <PhuongAnInBadge value={r.phuong_an_in} /> },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', merge: true, render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'nha_gia_cong', header: 'Nhà gia công', merge: true, render: (r) => r.nha_gia_cong || '—' },
    { key: 'so_luong_vai_ve', header: 'SLNV', className: 'text-right tabular-nums', merge: true, render: (r) => fmtNum(r.so_luong_vai_ve) },
    { key: 'han_giao_hang', header: 'Hạn giao', merge: true, render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'chuyen', header: 'Chuyền hiện tại', merge: true, render: (r) => r.ten_chuyen || '—' },
    { key: 'tho_in_kh', header: 'Thợ in', merge: true, render: (r) => r.tho_in_kh || '—' },
    { key: 'ngay_ke_hoach', header: 'Ngày SX kế hoạch', merge: true, render: (r) => fmtDate(r.ngay_ke_hoach) },
  ];

  // Lệnh GOM SET → tách 1 dòng / PHẦN IN. Lệnh thường trả `null` ⇒ render y như cũ.
  const subRows = (r) => (r.phan_in_list ? r.phan_in_list.map((p) => ({ ...p, __sub: true })) : null);

  return (
    <div>
      <Toolbar title="Lập kế hoạch lại" subtitle="Lệnh đang Test Run hoặc đã Release 2 (chưa bắt đầu sản xuất) — đổi chuyền / ngày sản xuất kèm lý do"
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        <div title="Ngày SX kế hoạch — mặc định từ hôm qua; bấm Xóa để xem mọi lệnh">
          <DateRangePicker value={ngay} onChange={setNgay} placeholder="Mọi ngày SX kế hoạch" />
        </div>
        {canReplan && (
          <Button variant="secondary" icon="scan-line" onClick={moQuet}>Quét QR code phần</Button>
        )}
        {canReplan && selected.size > 0 && (
          <Button onClick={openBatch}>Lập lại kế hoạch ({selected.size})</Button>
        )}
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button chiXemOk variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button chiXemOk variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{meta.total} lệnh</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters}
        onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => setFilters({})} open={showFilters} />

      {/* Khối gom set: tách dòng theo phần in + VIỀN TRÁI xanh như màn Release 1.
          ⚠ Dùng `border-l`, KHÔNG đổi nền — nền đang dành cho màu cảnh báo SLA nghẽn. */}
      {canReplan && allChecked && meta.total > rows.length && selected.size < meta.total && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-control bg-primary-wash px-3 py-2 text-sm text-primary">
          <span>Đã chọn {selected.size} lệnh.</span>
          <Button variant="ghost" className="px-2 py-1" loading={chonHetBusy} onClick={chonHet}>
            Chọn tất cả {meta.total} lệnh khớp bộ lọc
          </Button>
        </div>
      )}
      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openDetail}
        sttStart={(page - 1) * PAGE} pageSize={0}
        subRows={subRows}
        rowClassName={(r) => `${slaRowClass(statusLenh(r.id))} ${laGomSet(r) ? 'border-l-[3px] border-l-primary' : ''}`}
        emptyText={ngay.from || ngay.to
          ? 'Không có lệnh nào trong khoảng ngày SX kế hoạch này — bấm ô ngày › Xóa để xem mọi lệnh'
          : 'Không có lệnh nào để lập lại kế hoạch'} />
      <Pagination page={page} totalPages={meta.totalPages || 1} total={meta.total} onPage={setPage} />

      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Lập lại kế hoạch — ${detail.ma_lenh_san_xuat}` : 'Lập lại kế hoạch'}
        subtitle={detail ? `${detail.ten_khach_hang || ''} · ${detail.mau_vai || ''}` : ''}
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setDetail(null)}>Đóng</Button>
            <Button onClick={submit} loading={saving} disabled={!canReplan}>Lập lại kế hoạch</Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            {detail.co_phieu && (
              <div className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                Lệnh gia công đã nhận về <b>{fmtNum(detail.da_nhan)}/{fmtNum(detail.so_luong_release)}</b>.
                Vẫn dời được ngày/giờ và đổi sang <b>chuyền gia công khác</b>; muốn đưa về chuyền in
                trong xưởng thì phải hủy tem gia công đã nhận trước.
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="Code phần" value={detail.ma_phan} />
              <Info label="Đơn hàng" value={detail.ma_don_hang} />
              <Info label="Mã hàng" value={detail.ma_hang} />
              <Info label="Màu vải" value={detail.mau_vai} />
              <Info label="Kích vải" value={detail.kich_vai} />
              <Info label="Kích phim" value={detail.kich_phim} />
              <Info label="SL nhận vải" value={fmtNum(detail.so_luong_vai_ve)} />
              <Info label="Hạn giao" value={fmtDate(detail.han_giao_hang)} />
            </div>
            <div className="space-y-3 border-t border-line pt-4">
              {/* Chọn chuyền GIỐNG MÀN RELEASE 1: `ChuyenPicker` có chip lọc theo loại + ô tìm mã/tên
                  (danh sách chuyền đã dài, `Select` trơn phải cuộn tìm rất lâu). */}
              <Field label="Chuyền in" hint="Mặc định kế thừa chuyền của kế hoạch cũ">
                <ChuyenPicker chuyen={chuyen} value={form.chuyenId}
                  onChange={(id) => setForm({ ...form, chuyenId: id })} />
              </Field>
              <Field label="Ngày sản xuất kế hoạch" required>
                <Input type="date" value={form.ngayKeHoach}
                  onChange={(e) => setForm({ ...form, ngayKeHoach: e.target.value })} />
              </Field>
              {/* SỐ LƯỢNG RELEASE — đổ sẵn đúng số đã nhập lúc Release 1, sửa được ngay tại đây.
                  ⚠ Ở mức (lệnh × ĐỢT VẢI): lệnh gộp nhiều đợt thì mỗi đợt một ô, tổng là SL của lệnh.
                  ⚠ `toi_da` = SL vải về − phần các lệnh KHÁC đang giữ (1 đợt vải release được nhiều lệnh). */}
              {dsDot.length > 0 && (
                <div className="space-y-2 rounded-control border border-line bg-surface-muted/40 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
                    <span>Số lượng release{dsDot.length > 1 ? ` (${dsDot.length} đợt vải)` : ''}</span>
                    <span className="tabular-nums">Tổng: {fmtNum(tongSlMoi)}</span>
                  </div>
                  {dsDot.map((d) => (
                    <div key={d.dot_vai_id} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="truncate text-ink">{d.ma_dot_vai}</div>
                        <div className="truncate text-ink-soft">
                          {dsDot.length > 1 ? `${d.ma_phan} · ` : ''}vải về {fmtNum(d.so_luong_vai_ve)}
                          {d.da_release_khac > 0 ? ` · lệnh khác giữ ${fmtNum(d.da_release_khac)}` : ''}
                          {` · tối đa ${fmtNum(d.toi_da)}`}
                        </div>
                      </div>
                      <div className="w-28 shrink-0">
                        <Input type="number" min={1} max={d.toi_da}
                          value={form.slRelease[d.dot_vai_id] ?? ''}
                          onChange={(e) => setForm((f) => ({
                            ...f, slRelease: { ...f.slRelease, [d.dot_vai_id]: e.target.value },
                          }))} />
                      </div>
                    </div>
                  ))}
                  {vuotSl && (
                    <div className="text-xs font-medium text-danger">
                      Có đợt vượt mức tối đa hoặc để trống — sửa lại trước khi lưu.
                    </div>
                  )}
                </div>
              )}
              {/* Giờ BD/KT — ghép với ngày kế hoạch thành `tg_bd_kh`/`tg_kt_kh`, y như Release 1.
                  Đổ sẵn giờ đang lưu của lệnh; xóa trắng thì backend DỜI giờ cũ sang ngày mới.
                  Dùng `TimeSelect` (24h) chứ KHÔNG `<input type="time">` — ô đó hiện AM/PM theo locale máy. */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giờ bắt đầu">
                  <TimeSelect value={form.gioBd} onChange={(v) => setForm({ ...form, gioBd: v })} minuteStep={5} />
                </Field>
                <Field label="Giờ kết thúc">
                  <TimeSelect value={form.gioKt} onChange={(v) => setForm({ ...form, gioKt: v })} minuteStep={5} />
                </Field>
              </div>
              {/* THỢ IN KẾ HOẠCH (mig 111) — đổ sẵn thợ in đã chọn lúc Release 1; gõ tên ngoài danh sách rồi Enter được. */}
              <Field label="Thợ in">
                <NhieuNguoiSelect value={form.thoIn} options={users}
                  onChange={(v) => setForm((f) => ({ ...f, thoIn: v }))}
                  placeholder="Gõ tên hoặc MSNV để tìm rồi chọn / Enter..." />
              </Field>
              <Field label="Lý do lập lại" hint="Không bắt buộc — có nhập thì hiện ở sidebar Lịch sử">
                <Textarea rows={3} value={form.lyDo}
                  onChange={(e) => setForm({ ...form, lyDo: e.target.value })}
                  placeholder="Vd: không kịp tiến độ, dời ngày sản xuất..." />
              </Field>
            </div>
          </div>
        )}
      </SidePanel>

      <Modal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        title="Lập lại kế hoạch hàng loạt"
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setBatchOpen(false)}>Hủy</Button>
            <Button onClick={submitBatch} loading={saving}>Lập lại {selected.size} lệnh</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          Áp dụng cùng chuyền / ngày / lý do cho <b>{selected.size}</b> lệnh đã chọn.
        </div>
        <Field label="Chuyền in" hint="Để trống = giữ chuyền hiện tại của từng lệnh">
          <ChuyenPicker chuyen={chuyen} value={batchForm.chuyenId}
            onChange={(id) => setBatchForm({ ...batchForm, chuyenId: id })}
            placeholder="— Giữ chuyền hiện tại —" />
        </Field>
        <Field label="Ngày sản xuất kế hoạch" required>
          <Input type="date" value={batchForm.ngayKeHoach}
            onChange={(e) => setBatchForm({ ...batchForm, ngayKeHoach: e.target.value })} />
        </Field>
        {/* Áp CÙNG giờ cho mọi lệnh đã chọn. Để trống = giữ giờ riêng của từng lệnh (backend dời
            sang ngày mới) — cố ý không xóa trắng, vì mỗi lệnh có thể đã đặt giờ khác nhau. */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giờ bắt đầu" hint="Trống = giữ giờ từng lệnh">
            <TimeSelect value={batchForm.gioBd} onChange={(v) => setBatchForm({ ...batchForm, gioBd: v })} minuteStep={5} />
          </Field>
          <Field label="Giờ kết thúc" hint="Trống = giữ giờ từng lệnh">
            <TimeSelect value={batchForm.gioKt} onChange={(v) => setBatchForm({ ...batchForm, gioKt: v })} minuteStep={5} />
          </Field>
        </div>
        <Field label="Thợ in" hint="Trống = giữ thợ in kế hoạch của từng lệnh">
          <NhieuNguoiSelect value={batchForm.thoIn} options={users}
            onChange={(v) => setBatchForm((f) => ({ ...f, thoIn: v }))}
            placeholder="Gõ tên hoặc MSNV để tìm rồi chọn / Enter..." />
        </Field>
        <Field label="Lý do lập lại" hint="Không bắt buộc — có nhập thì hiện ở sidebar Lịch sử">
          <Textarea rows={3} value={batchForm.lyDo}
            onChange={(e) => setBatchForm({ ...batchForm, lyDo: e.target.value })}
            placeholder="Vd: không kịp tiến độ, dời ngày sản xuất..." />
        </Field>
      </Modal>

      <ScanCollectModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Quét QR code phần — Lập lại kế hoạch"
        help="Quét QR code phần để chọn các lệnh của phần in đó. Quét nhiều rồi bấm Lập lại kế hoạch cho tất cả cùng lúc."
        rows={scanRows}
        getId={(r) => r.id}
        getCodes={(r) => (r.ma_phan_ds && r.ma_phan_ds.length ? r.ma_phan_ds : [r.ma_phan]).filter(Boolean)}
        onNotFound={() => (ngay.from || ngay.to ? 'Chỉ tìm trong khoảng ngày SX kế hoạch đang lọc — bỏ lọc ngày để quét mọi lệnh' : null)}
        matchMultiple
        isSelected={(r) => selected.has(r.id)}
        onToggle={(r) => toggleOne(r.id)}
        primaryLabel={(r) => r.ma_phan || r.ma_lenh_san_xuat || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.mau_vai, r.ma_lenh_san_xuat].filter(Boolean).join(' · ')}
        onConfirm={() => { setScanOpen(false); openBatch(); }}
        confirmLabel="Lập lại kế hoạch"
      />

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử kế hoạch (Release 2 + lập lại)" fetcher={planHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã lập lại kế hoạch" maHeader="Lệnh" fetcher={replanDone} />

      <Toast toast={toast} />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{value || '—'}</div>
    </div>
  );
}
