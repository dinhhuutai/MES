import { useEffect, useState, useCallback, useMemo } from 'react';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import TraVeListModal, { TraVeListButton, TRA_VE_THEO_MAN } from '../../../components/common/TraVeListModal';
import useNghenMap from '../../../hooks/useNghenMap';
import useLyDoNghen from '../../../hooks/useLyDoNghen';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import Modal from '../../../components/common/Modal';
import { Input } from '../../../components/common/controls';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import GiaCongHistoryPanel from '../components/GiaCongHistoryPanel';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import TraVeBadge from '../../../components/common/TraVeBadge';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import { laGomSet } from '../utils/phanInLenh';
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';
import { listGiaCong, giaCongNhanTheoPhan, giaCongTraLai } from '../../../services/planningService';
import { printGiaCongVeTem } from '../../production/utils/printTemLabel';
import { fmtNum, fmtDate } from '../../../utils/format';

// Lọc nhiều trường (client-side, kết hợp AND) — trang tải-hết (limit 500) nên lọc đủ mọi dòng.
// `col` = tên thuộc tính trên hàng do `listGiaCong` trả về.
const FILTER_FIELDS = [
  { key: 'maLenh', label: 'Mã đợt SX', col: 'ma_lenh_san_xuat' },
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' },
  { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' },
  { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
  { key: 'nhaGiaCong', label: 'Nhà gia công', col: 'nha_gia_cong' },
  { key: 'chuyen', label: 'Chuyền gia công', col: 'ten_chuyen' },
];

// Chuẩn hóa 1 dòng (lệnh gia công hoặc dòng lịch sử) → dữ liệu nhãn "TH VỀ" (đầu 13).
// SL trên tem = SL của ĐÚNG lần nhận (`so_luong_lan_nay`, hàng gia công về nhiều lần); dòng lịch sử cũ
// không có khóa này → lùi về SL release của cả lệnh như trước.
//
// ⚠⚠ ĐÂY LÀ NGUỒN DUY NHẤT của mọi trường trên tem 13 — tem này KHÔNG dựng từ bản ghi `tem` nên
//   `getTemLabelData` của backend không đụng tới nó. Thêm trường vào `TRUONG_TEM` nhóm "Gia công"
//   (backend `utils/mauTem.js`) mà quên thêm ở đây thì ô trên tem ra RỖNG, KHÔNG báo lỗi gì.
// ⚠ Dòng LỆNH (bấm "In tem" ngoài bảng, hàng chưa nhận) không có `tg`/`nguoi` ⇒ 2 trường
//   `tg_nhan`/`nguoi_nhan` để trống — đúng, vì lúc đó chưa có lượt nhận nào. Dòng LỊCH SỬ thì đủ.
const buildVeLabel = (r) => ({
  ma_tem: r.ma_tem || r.ma_lenh_san_xuat,
  ma_lenh_san_xuat: r.ma_lenh_san_xuat,
  so_luong: r.so_luong_lan_nay != null ? r.so_luong_lan_nay : r.so_luong_release,
  so_luong_don_hang: r.so_luong_don_hang,
  ten_khach_hang: r.ten_khach_hang,
  ma_don_hang: r.ma_don_hang,
  ma_hang: r.ma_hang,
  ma_phan: r.ma_phan,
  mau_vai: r.mau_vai,
  kich_vai: r.kich_vai,
  kich_phim: r.kich_phim,
  ten_chuyen: r.ten_chuyen,
  ma_chuyen: r.ma_chuyen,
  created_date: r.created_date,
  // ─ nhóm "Gia công" của trình Thiết kế tem ─
  nha_gia_cong: r.nha_gia_cong,
  so_luong_vai_ve: r.so_luong_vai_ve,
  so_luong_release: r.so_luong_release,
  // Dòng LỊCH SỬ chỉ có `con_lai` (chụp trong payload audit) ⇒ suy ngược `da_chuyen`; dòng LỆNH thì
  // backend trả sẵn cả hai. Thiếu dữ kiện thì để `null` chứ không bịa số 0.
  da_chuyen: r.da_chuyen != null ? r.da_chuyen
    : (r.so_luong_release != null && r.con_lai != null ? Number(r.so_luong_release) - Number(r.con_lai) : null),
  con_lai: r.con_lai,
  tg_nhan: r.tg || null,
  nguoi_nhan: r.nguoi || '',
});

// Tối đa số CODE PHẦN in được trong 1 lượt — tờ decal 110×80mm chỉ có 2 khung tem.
const TOI_DA_PHAN = 2;

// Khóa lý do nghẽn (mig 106): hàng lệnh (`id`) hoặc hàng code phần đã làm phẳng (`lenh_id`).
const KHOA_GIA_CONG = (r) => ({
  lenh_san_xuat_id: r.lenh_id || r.id, phan_in_id: r.phan_in_id || null,
  dot_vai_ve_id: r.dot_vai_ve_id || null, ma: r.ma_phan || r.ma_lenh_san_xuat || null,
});

// Màn "Gia công" (Kế hoạch): lệnh đã Release 1 lên chuyền gia công đang chờ nhận lại → bấm "Chuyển OQC".
export default function GiaCongPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canDo = can('RELEASE1') || can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [nghenOpen, setNghenOpen] = useState(false); // modal "Danh sách nghẽn"
  const [traVeOpen, setTraVeOpen] = useState(false); // modal "Danh sách trả về" (25/09/2026)
  // Nguồn nghẽn dùng CHUNG với các màn Kế hoạch khác (dashboard `flowRows`).
  // ⚠ Hàng gia công KHÔNG tính SLA ở OQC (§5) nhưng vẫn có SLA ở chặng gia công — bản đồ này lo đúng.
  const { statusLenh, tgLenh } = useNghenMap();
  const { hoiLyDoNghen, lyDoNghenModal } = useLyDoNghen({
    maTrang: 'KH_GIA_CONG', trangThai: (r) => statusLenh(r.lenh_id || r.id), khoa: KHOA_GIA_CONG,
    thoiGian: (r) => tgLenh(r.lenh_id || r.id),
  });
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  // { ds: [dòng code phần đã tick, kèm ô nhập `qty` (đạt) + `huy`] } — IN TEM = nhận hàng
  const [inTem, setInTem] = useState(null);
  const [traLai, setTraLai] = useState(null); // { row, ghiChu } — trả hàng bị OQC trả về cho nhà gia công
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [filters, setFilters] = useState({});

  // Dải "Theo dõi" (sĩ số) bám ĐÚNG ô tìm + panel lọc của màn này — xem hooks/useSiSoLoc.js.
  useSiSoLoc({ timKiem: search, ...filters });
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;

  // ⚠⚠ LÀM PHẲNG THÀNH 1 DÒNG / CODE PHẦN (chốt 09/09/2026 — người dùng: "tách ra theo hàng code
  //   phần chứ đừng gộp hàng theo gom set"). Trước đây lệnh gom set là MỘT hàng có `subRows`, nên ô
  //   chọn + nút thao tác bị hợp nhất ⇒ không tích được từng code phần.
  // ⚠ `_key` BẮT BUỘC (dùng làm `rowKey`): nhiều dòng cùng `id` lệnh, để `rowKey="id"` là React trùng
  //   key và chọn 1 dòng thì cả nhóm sáng lên.
  // ⚠ `_dauLenh` để các thao tác MỨC LỆNH (Trả lại nhà gia công) chỉ vẽ ở DÒNG ĐẦU của lệnh — không
  //   thì lệnh 6 code phần hiện 6 nút giống hệt nhau, bấm cái nào cũng ra cùng một việc.
  const rowsPhan = useMemo(() => {
    const ra = [];
    for (const r of rows) {
      const ds = (r.phan_in_list && r.phan_in_list.length) ? r.phan_in_list : [r];
      ds.forEach((p, i) => ra.push({
        ...r, ...p, lenh_id: r.id, _key: `${r.id}|${p.dot_vai_ve_id || p.ma_phan || i}`, _dauLenh: i === 0,
      }));
    }
    return ra;
  }, [rows]);
  const filtered = useMemo(() => filterRows(rowsPhan, filters, FILTER_FIELDS), [rowsPhan, filters]);

  const printVe = async (r) => {
    try { await printGiaCongVeTem(buildVeLabel(r)); }
    catch (e) { show(e.message || 'In tem thất bại', 'error'); }
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // TẢI HẾT MỌI TRANG — bộ lọc chạy ở client nên phải có đủ dòng mới lọc đúng.
      // ⚠ `getPaging` cắt `limit` còn 200; danh sách ≤200 dòng thì vòng lặp chỉ tốn 1 lời gọi.
      const { items, total, thieu } = await taiHetTrang((p) => listGiaCong({ search, ...p }), { limit: LIMIT_TAI_LON });
      setRows(items);
      setMeta({ total });
      if (thieu && !silent) show(`Mới tải được ${items.length}/${total} lệnh — hãy thu hẹp tìm kiếm`, 'error');
      if (!silent) setSelected(new Set());
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Tự tải lại khi trạm khác xác nhận (tránh màn để lâu → dữ liệu cũ).
  // Bỏ qua khi đang tick dở để không mất lựa chọn — `load` xóa danh sách đã chọn.
  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua `setLoading(true)` (bảng không bị
  // thay bằng spinner) và KHÔNG xóa dòng đang tích. Nhiều sự kiện trong 400ms gộp thành 1 lần tải.
  useSocketReload(['workflow:updated', 'quality:updated'], () => load(true));

  // Ô CHỌN nay để CHỌN CODE PHẦN CẦN IN TEM — tối đa `TOI_DA_PHAN` (tờ decal 2 khung).
  // ⚠ Không có "chọn tất cả": trần 2 dòng nên nút đó vô nghĩa.
  const chonDuoc = (r) => !r.cho_tra_lai && Number(r.con_lai) > 0;
  const toggleOne = (r) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(r._key)) next.delete(r._key);
    else {
      if (next.size >= TOI_DA_PHAN) return s; // chạm trần: ô còn lại đã bị khóa sẵn
      next.add(r._key);
    }
    return next;
  });

  // Còn lại của 1 lệnh = SL release − SL đã chuyển (BE trả sẵn `con_lai`; fallback tự tính cho dữ liệu cũ).
  const conLaiCua = (r) => (r?.con_lai != null
    ? Number(r.con_lai)
    : (Number(r?.so_luong_release) || 0) - (Number(r?.da_chuyen) || 0));

  // ─── IN TEM = NHẬN HÀNG, THEO TỪNG CODE PHẦN (09/09/2026) ────────────────────────────────────
  // Tick ≤2 dòng code phần trên bảng rồi bấm "In tem (N)" → modal nhập **SL đạt + SL hủy** từng dòng.
  // ⚠ TỐI ĐA 2 vì tờ decal chỉ có 2 khung tem — cùng ràng buộc với modal In tem của trang Sửa.
  const openInTem = () => {
    const ds = filtered.filter((r) => selected.has(r._key))
      .map((p) => ({ ...p, qty: String(Number(p.con_lai) || 0), huy: '' }));
    if (!ds.length) { show('Tích ít nhất 1 code phần để in tem', 'error'); return; }
    setInTem({ ds });
  };

  const datO = (p, khoa, v) => setInTem((s) => (s
    ? { ...s, ds: s.ds.map((x) => (x._key === p._key ? { ...x, [khoa]: v } : x)) }
    : s));

  // Nhận + IN. Chưa nhận đủ thì code phần đó VẪN ở màn này; code phần về 0 mới rời đi.
  const doInTemNhan = async () => {
    if (!inTem) return;
    const chon = inTem.ds;
    // Kiểm SL TRƯỚC KHI GỌI: sai thì báo ngay tại chỗ, khỏi tốn một lượt xin mã tem của ERP.
    for (const p of chon) {
      const dat = Math.trunc(Number(p.qty || 0));
      const huy = Math.trunc(Number(p.huy || 0));
      if (!Number.isFinite(dat) || dat < 0 || !Number.isFinite(huy) || huy < 0) {
        show(`Số lượng của ${p.ma_phan} không hợp lệ`, 'error'); return;
      }
      if (dat + huy <= 0) { show(`Nhập số lượng nhận của ${p.ma_phan} (đạt hoặc hủy) lớn hơn 0`, 'error'); return; }
      if (dat + huy > Number(p.con_lai)) {
        show(`${p.ma_phan}: đạt ${dat} + hủy ${huy} vượt phần còn lại (${fmtNum(p.con_lai)})`, 'error'); return;
      }
    }
    // Lệnh quá SLA ⇒ nhập lý do nghẽn trước khi nhận hàng (mig 106).
    if (!(await hoiLyDoNghen(chon))) return;
    setSaving(true);
    try {
      // ⚠⚠ Tick được 2 dòng của 2 LỆNH KHÁC NHAU ⇒ phải gom theo lệnh và gọi service TỪNG LỆNH
      //   (`confirmGiaCongToOqc` làm việc ở mức lệnh). Gom xong mới in MỘT lần.
      const theoLenh = new Map();
      for (const p of chon) {
        const ds = theoLenh.get(p.lenh_id) || [];
        ds.push(p);
        theoLenh.set(p.lenh_id, ds);
      }
      const nhan = [];
      const loi = [];
      for (const [lenhId, ds] of theoLenh) {
        try {
          const res = await giaCongNhanTheoPhan(lenhId, ds.map((p) => ({
            dot_vai_ve_id: p.dot_vai_ve_id,
            so_luong: Math.trunc(Number(p.qty || 0)),
            so_luong_huy: Math.trunc(Number(p.huy || 0)),
          })));
          // ⚠ Mã tem lấy từ PHẢN HỒI (ERP cấp), KHÔNG tự suy — mỗi tem 13 là một mã riêng.
          for (const t of (res.data?.tems || [])) {
            const p = ds.find((x) => x.ma_phan === t.ma_phan) || {};
            nhan.push(buildVeLabel({
              ...p, ma_tem: t.ma_tem, so_luong_lan_nay: t.so_luong, so_luong_huy: t.so_luong_huy,
            }));
          }
        } catch (e) {
          loi.push(`${ds[0].ma_lenh_san_xuat}: ${e.message || 'lỗi'}`);
        }
      }
      setInTem(null);
      setSelected(new Set());
      if (loi.length) show(`Nhận hàng lỗi — ${loi.join(' · ')}`, 'error');
      else show(`Đã nhận ${nhan.length} code phần`);
      // In SAU khi đã báo kết quả: popup bị chặn thì hàng vẫn được ghi nhận, chỉ thiếu bước in
      // (in lại được ở "Lịch sử chuyển") — đừng để lỗi in che mất việc nhận hàng đã thành công.
      // ⚠⚠ MỘT LẦN BẤM = MỘT CỬA SỔ IN: gom cả 2 tem vào 1 lượt gọi, kể cả khi chúng khác lệnh.
      //   Gọi in 2 lần liên tiếp thì trình duyệt CHẶN POPUP từ cửa sổ thứ 2 (bài học modal gom set).
      if (nhan.length) {
        try { await printGiaCongVeTem(nhan); }
        catch (e) { show(`Đã nhận hàng nhưng CHƯA in được tem: ${e.message || ''} — in lại ở "Lịch sử chuyển"`, 'error'); }
      }
      load();
    } catch (e) {
      show(e.message || 'Nhận hàng thất bại', 'error');
    } finally { setSaving(false); }
  };

  const doTraLai = async () => {
    if (!traLai) return;
    setSaving(true);
    try {
      await giaCongTraLai(traLai.row.id, traLai.ghiChu);
      show(`Đã ghi nhận trả lại nhà gia công (${traLai.row.ma_lenh_san_xuat})`);
      setTraLai(null);
      load();
    } catch (e) {
      show(e.message || 'Ghi nhận trả lại thất bại', 'error');
    } finally { setSaving(false); }
  };

  const columns = [
    // Ô chọn theo TỪNG CODE PHẦN (tối đa 2 — tờ tem 2 khung). Không có "chọn tất cả": trần 2 dòng.
    ...(canDo ? [{ key: 'sel', className: 'w-10', selection: true, header: '',
      render: (r) => {
        const tick = selected.has(r._key);
        const khoa = !tick && (!chonDuoc(r) || selected.size >= TOI_DA_PHAN);
        const vi = r.cho_tra_lai ? 'Đang chờ trả lại nhà gia công'
          : !(Number(r.con_lai) > 0) ? 'Code phần này đã nhận đủ'
            : khoa ? `Mỗi lần in tối đa ${TOI_DA_PHAN} code phần (tờ tem có 2 khung)` : undefined;
        return (
          <input type="checkbox" checked={tick} disabled={khoa} title={vi}
            onClick={(e) => e.stopPropagation()} onChange={() => toggleOne(r)} aria-label="Chọn code phần" />
        );
      } }] : []),
    // ⚠⚠ LỆNH GOM SET TÁCH 1 DÒNG / PHẦN IN — giống màn Release 1 & Lập kế hoạch lại (18/08/2026).
    //   Trước đây chỉ riêng ô "Code phần" gộp đủ mã (`PhanInLenhCell`), còn Khách/Đơn/Mã hàng/Màu/Kích
    //   vẫn là phần in ĐẠI DIỆN (`PHAN_INFO_LATERAL` `LIMIT 1`) ⇒ 3 mã trong 1 ô nhưng chỉ 1 bộ thông
    //   tin, không biết mã nào ứng với màu nào. Đo prod 18/08: **88/278 lệnh (32%)** ở màn này là gom set.
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', render: (r) => (
      <div className="space-y-1">
        <Badge tone="info">{r.ma_lenh_san_xuat}</Badge>
        {laGomSet(r) && <div className="text-xs text-primary">gom set · {r.so_phan_in} phần in · in chung</div>}
      </div>
    ) },
    // Hàng bị OQC kiểm không đạt → trả về Kế hoạch; badge đỏ bấm ra lý do/người/giờ.
    { key: 'tra_ve', header: 'Tình trạng', render: (r) => (r.cho_tra_lai
      ? <TraVeBadge data={r.tra_ve} label="OQC trả về" nguon="OQC" />
      : <span className="text-xs text-ink-soft">Đang gia công</span>) },
    { key: 'ten_chuyen', header: 'Chuyền gia công', render: (r) => r.ten_chuyen || '—' },
    // ↓ Các cột THEO PHẦN IN — dòng con ghi đè giá trị nên mỗi phần in hiện đúng dữ liệu của nó.
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    // Hiện Code phần vì đây là trường được lọc — lọc theo giá trị không nhìn thấy thì không đối chiếu được.
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    // ↓ Từ đây là mức LỆNH → hợp nhất ô. ⚠ SL release / đã chuyển / còn lại là số của CẢ LỆNH — lặp ở
    //   từng dòng con sẽ khiến người đọc cộng dồn thành số sai.
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'nha_gia_cong', header: 'Nhà gia công', render: (r) => r.nha_gia_cong || '—' },
    // ⚠⚠ 3 CỘT SỐ LƯỢNG NAY THEO **TỪNG CODE PHẦN**, KHÔNG `merge` nữa (09/09/2026): nhà gia công trả
    //   hàng theo từng màu/kích nên mỗi code phần có phần còn lại RIÊNG. Backend gắn số này vào
    //   `phan_in_list` trùng tên khóa mức lệnh nên dòng con tự đè đúng giá trị của nó.
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_release) },
    // Hàng gia công về nhiều lần → theo dõi phần đã nhận / còn phải nhận.
    { key: 'da_chuyen', header: 'Đã chuyển OQC', className: 'text-right tabular-nums', render: (r) => fmtNum(r.da_chuyen || 0) },
    { key: 'con_lai', header: 'Còn lại', className: 'text-right tabular-nums',
      render: (r) => {
        const c = conLaiCua(r);
        return c > 0 ? <span className="font-medium text-warning">{fmtNum(c)}</span> : fmtNum(0);
      } },
    { key: 'nguoi_release', header: 'Người release', render: (r) => r.nguoi_release || '—' },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'ngay_ke_hoach', header: 'Ngày SX kế hoạch', render: (r) => fmtDate(r.ngay_ke_hoach) },
    // ⚠⚠ BẢNG NAY 1 DÒNG / CODE PHẦN ⇒ thao tác MỨC LỆNH ("Trả lại nhà gia công") chỉ vẽ ở DÒNG ĐẦU
    //   của lệnh (`_dauLenh`). Bỏ điều kiện đó thì lệnh gom set 6 code phần hiện 6 nút giống hệt nhau,
    //   bấm cái nào cũng ra cùng một việc — đúng vấn đề mà `merge` từng lo trước đây.
    // ⚠ KHÔNG còn nút "In tem" ở từng dòng: in tem nay đi qua Ô CHỌN + nút "In tem (N)" trên Toolbar,
    //   vì một lượt in gom được tới 2 code phần (kể cả của 2 lệnh khác nhau) lên cùng một tờ decal.
    { key: 'act', header: '', className: 'text-right whitespace-nowrap', render: (r) => (
      <div className="flex items-center justify-end gap-1">
        {/* Bị OQC trả về → phải ghi nhận ĐÃ TRẢ LẠI nhà gia công trước, rồi mới nhận hàng về lượt sau. */}
        {canDo && r.cho_tra_lai && r._dauLenh && (
          <Button size="sm" variant="danger" icon="undo-2"
            onClick={(e) => { e.stopPropagation(); setTraLai({ row: r, ghiChu: '' }); }}>
            Trả lại nhà gia công
          </Button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Gia công" subtitle="Lệnh đã release lên chuyền gia công — nhận lại hàng (có thể NHIỀU LẦN) rồi chuyển sang kiểm OQC; đủ số lượng thì lệnh mới rời màn này"
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {/* ⚠ IN TEM = NHẬN HÀNG: tick ≤2 code phần trên bảng rồi bấm đây để nhập SL đạt/hủy và in. */}
        {canDo && selected.size > 0 && (
          <Button icon="printer" onClick={openInTem}>In tem ({selected.size})</Button>
        )}
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button chiXemOk variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử chuyển</Button>
        <Badge tone="info">
          {activeCount ? `${filtered.length}/` : ''}{rowsPhan.length} code phần · {meta.total || rows.length} lệnh
        </Badge>
        <NghenButton rows={rows} trangThai={(r) => statusLenh(r.id)} onClick={() => setNghenOpen(true)} />
        <TraVeListButton onClick={() => setTraVeOpen(true)} />
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters}
        onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => setFilters({})} open={showFilters} />

      {/* ⚠ 1 DÒNG / CODE PHẦN (KHÔNG `subRows`) — `rowKey="_key"` vì nhiều dòng chung `id` lệnh.
          Dòng của lệnh gom set vẫn có VIỀN TRÁI xanh để nhìn ra chúng cùng một đợt SX. */}
      <DataTable columns={columns} rows={filtered} loading={loading} sttStart={0} rowKey="_key"
        rowClassName={(r) => (laGomSet(r) ? 'border-l-[3px] border-l-primary' : '')}
        emptyText={activeCount ? 'Không có code phần nào khớp bộ lọc' : 'Không có hàng gia công nào đang chờ nhận về'} />

      {/* IN TEM = NHẬN HÀNG, theo TỪNG CODE PHẦN — tick tối đa 2 dòng + nhập SL rồi in tờ 2 tem. */}
      <Modal open={!!inTem} onClose={() => setInTem(null)} title="In tem hàng về — nhận theo từng code phần" size="lg">
        {inTem && (
          <div className="space-y-4">
            <div className="overflow-auto rounded-control border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted">
                  <tr>
                    <th className="px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft">Code phần</th>
                    <th className="px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft">Màu · Kích</th>
                    <th className="px-2.5 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-ink-soft">Còn lại</th>
                    <th className="w-28 px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft">SL đạt</th>
                    <th className="w-28 px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft">SL hủy</th>
                    <th className="px-2.5 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-ink-soft">Tổng nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {inTem.ds.map((p) => {
                    const dat = Math.trunc(Number(p.qty || 0)) || 0;
                    const huy = Math.trunc(Number(p.huy || 0)) || 0;
                    const tong = dat + huy;
                    const vuot = tong > Number(p.con_lai);
                    return (
                      <tr key={p._key}>
                        <td className="px-2.5 py-2">
                          <div className="font-medium text-ink">{p.ma_phan || '—'}</div>
                          <div className="text-xs text-ink-soft">{p.ma_lenh_san_xuat}</div>
                        </td>
                        <td className="px-2.5 py-2 text-ink-soft">
                          {[p.mau_vai, p.kich_vai, p.kich_phim].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums font-medium text-warning">{fmtNum(p.con_lai)}</td>
                        <td className="px-2.5 py-2">
                          <Input type="number" min={0} max={p.con_lai} value={p.qty}
                            onChange={(e) => datO(p, 'qty', e.target.value)} />
                        </td>
                        <td className="px-2.5 py-2">
                          <Input type="number" min={0} max={p.con_lai} value={p.huy}
                            placeholder="0" onChange={(e) => datO(p, 'huy', e.target.value)} />
                        </td>
                        <td className={`px-2.5 py-2 text-right tabular-nums font-medium ${vuot ? 'text-danger' : 'text-ink'}`}>
                          {fmtNum(tong)}{vuot ? ' ⚠' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-soft">
              <b>SL đạt</b> = phần dùng được, đi tiếp sang OQC. <b>SL hủy</b> = hàng hỏng nhà gia công trả
              về, loại hẳn (không sang OQC). Cả hai đều là vải đã nhận nên <b>tổng đạt + hủy</b> mới là
              phần trừ vào "còn lại". Bấm <b>In tem</b> là NHẬN HÀNG luôn; code phần nào <b>còn lại về 0</b>
              thì mới rời khỏi màn Gia công.
            </p>

            <div className="flex justify-end gap-2">
              <Button chiXemOk variant="ghost" onClick={() => setInTem(null)} disabled={saving}>Hủy</Button>
              <Button icon="printer" onClick={doInTemNhan} loading={saving}>
                In tem ({inTem.ds.length})
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Ghi nhận đã mang hàng bị OQC trả về giao lại cho nhà gia công (người + giờ vào lịch sử). */}
      <Modal open={!!traLai} onClose={() => setTraLai(null)} title="Trả lại nhà gia công" size="sm">
        {traLai && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/30">
              <div className="font-medium text-ink">{traLai.row.ma_lenh_san_xuat} — OQC kiểm không đạt</div>
              <div className="mt-1 text-ink-soft">Lý do OQC: {traLai.row.tra_ve?.ly_do || '—'}</div>
              <div className="mt-1 text-ink-soft">
                Số lượng chờ gia công lại: <b className="text-ink">{fmtNum(conLaiCua(traLai.row))}</b>
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-ink">Ghi chú (không bắt buộc)</div>
              <Input value={traLai.ghiChu}
                onChange={(e) => setTraLai((s) => ({ ...s, ghiChu: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') doTraLai(); }}
                placeholder="Vd: đã giao lại cho nhà gia công X ngày..." autoFocus />
              <div className="mt-1 text-xs text-ink-soft">
                Ghi nhận xong, lệnh trở lại trạng thái đang gia công và nhận hàng về bằng nút "Nhận hàng → OQC".
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button chiXemOk variant="ghost" onClick={() => setTraLai(null)} disabled={saving}>Hủy</Button>
              <Button onClick={doTraLai} loading={saving}>Xác nhận đã trả lại</Button>
            </div>
          </div>
        )}
      </Modal>

      <GiaCongHistoryPanel open={histOpen} onClose={() => setHistOpen(false)} onPrint={printVe} />

      <TraVeListModal open={traVeOpen} onClose={() => setTraVeOpen(false)}
        tenMan="Gia công" loais={TRA_VE_THEO_MAN.KH_GIA_CONG} tenFile="tra-ve-gia-cong" />
      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="Gia công" rows={rows} trangThai={(r) => statusLenh(r.id)} tenFile="nghen-gia-cong"
        maTrang="KH_GIA_CONG" khoa={KHOA_GIA_CONG} thoiGian={(r) => tgLenh(r.id)} />
      {lyDoNghenModal}
      <Toast toast={toast} />
    </div>
  );
}
