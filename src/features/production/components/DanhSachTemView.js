import { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import DataTable from '../../../components/common/DataTable';
import SidePanel from '../../../components/common/SidePanel';
import Pagination from '../../../components/common/Pagination';
import Spinner from '../../../components/common/Spinner';
import Toast from '../../../components/common/Toast';
import { Input, Select, Field, Textarea } from '../../../components/common/controls';
import Modal from '../../../components/common/Modal';
import TimeSelect from '../../../components/common/TimeSelect';
import { listChuyen, getVaiTem, suaVaiTem, suaTem, reprintTem, getTemLabel } from '../../../services/productionService';
import FieldFilters, { FilterToggle } from '../../../components/common/FieldFilters';
import DateRangePicker from '../../../components/common/DateRangePicker';
import useToast from '../../../hooks/useToast';
import useHuyLichSu from '../../../hooks/useHuyLichSu';
import { fmtNum, fmtDateTime, temCode } from '../../../utils/format';
import exportCheckpointExcel, { cotTemChung, moTaBoLoc } from '../../../utils/exportCheckpointExcel';
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';
import HuyLyDoModal from '../../../components/common/HuyLyDoModal';
import TemInPreview from './TemInPreview';
import printTemLabel, { toTemSanXuat, toTemGiaCongVe, moSanCuaSoIn, dongCuaSoIn } from '../utils/printTemLabel';

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DANH SÁCH TEM ĐÃ IN — view DÙNG CHUNG cho 2 trang (nhiệm vụ #8, phiên 04-05/09/2026):
//   · *Sản xuất › Danh sách tem in*        → tem sản xuất (nhãn 15/16), quyền PROD_RUN/PROD_MONITOR
//   · *Kế hoạch › Danh sách tem gia công*  → tem 13 "TH VỀ",            quyền RELEASE1/RELEASE2
// Mục đích: XEM thông tin tem mà KHÔNG phải in ra giấy.
//
// ⚠ 2 trang chỉ khác NGUỒN (route + quyền) và vài cột ⇒ viết 1 lần ở đây, đừng chép ra 2 bản: sửa
//   bộ lọc/cột một bên rồi quên bên kia là 2 màn lệch nhau (đúng họ lỗi đã ghi ở §8 CLAUDE.md).
// ⚠ `laGiaCong` KHÔNG gửi lên server — nó do ROUTE quyết định (mỗi module 1 route + 1 quyền riêng),
//   ở đây chỉ dùng để chọn BỘ CỘT. Xem `production.service.listTemDaIn`.
// ══════════════════════════════════════════════════════════════════════════════════════════════

const LIMIT = 20;

// Ô lọc dạng CHỮ — khớp đúng tên khóa backend nhận (`production.controller.dsTemDaIn`).
// ⚠ Lọc chạy Ở SERVER (danh sách tem rất lớn, phân trang server) ⇒ đừng đổi sang `filterRows`
//   client-side: nó chỉ lọc được TRANG ĐANG XEM.
const FIELDS_CHUNG = [
  { key: 'maTem', label: 'Mã tem' },
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'codePhan', label: 'Code phần' },
];
const FIELD_CHUYEN = { key: 'chuyen', label: 'Chuyền' };
// Mã ngày ca (14/10/2026) — gõ 1 phần cũng được: `261013` (cả ngày) · `261013D2` (đúng ca) · `D2` (mọi ngày ca D2).
const FIELD_MA_NGAY_CA = { key: 'maNgayCa', label: 'Mã ngày ca' };

// Tem còn HỦY được: chưa qua kiểm (gương guard backend `production.service.cancelPrintTem` — cùng luật nút Hủy ở
// "Tem đã in" của RunPanel). `da_kiem` + `mo_lai_duoc` do backend `listTemDaIn` tính.
const TEM_CHUA_KIEM = ['IN', 'DANG_PHOI', 'DA_KHO'];
const temHuyDuoc = (r) => TEM_CHUA_KIEM.includes(r.trang_thai) && !r.da_kiem;
// HỦY NHIỀU TEM (21/10/2026, người dùng yêu cầu): tối đa mỗi lượt — mỗi tem 1 lần gọi route hủy (transaction riêng +
//   báo ERP riêng), chạy tuần tự.
const TOI_DA_HUY = 100;
const MA_HIEN_TOI_DA = 12; // số mã tem liệt kê trong hộp xác nhận, dư thì "… và N tem khác"

// Trạng thái tem: IN → DANG_PHOI → DA_KHO → CHO_SUA/CHO_OQC/LOAI → OQC_DAT → DA_GIAO; HUY.
const TT = {
  IN: ['Đã in', 'default'],
  DANG_PHOI: ['Đang phơi', 'info'],
  DA_KHO: ['Đã khô', 'info'],
  CHO_SUA: ['Chờ sửa', 'warning'],
  CHO_OQC: ['Chờ OQC', 'warning'],
  LOAI: ['Loại', 'danger'],
  OQC_DAT: ['OQC đạt', 'success'],
  DA_GIAO: ['Đã giao', 'success'],
  HUY: ['Đã hủy', 'danger'],
};
const ttBadge = (v) => {
  const [ten, tone] = TT[v] || [v || '—', 'default'];
  return <Badge tone={tone}>{ten}</Badge>;
};

const chu = (v) => (v == null || v === '' ? '—' : v);

// ⚠⚠ MÃ TEM HIỆN THEO ĐÚNG NHÃN NGƯỜI DÙNG ĐANG CẦM, không phải mã thô trong DB (cùng luật đã áp ở
// trang *Phân loại lỗi* — ở đó hiện tiền tố `16` vì người phân loại cầm nhãn túi sửa).
//   · tem GIA CÔNG: từ 06/09/2026 mã `13…` do ERP cấp riêng (`/barcode-tem-13`) và lưu THẲNG vào DB
//     ⇒ `temCode(ma,13)` thành no-op, hiện đúng mã. Tem CŨ lưu mã gốc `15…` mà nhãn "TH VỀ" in ra
//     `13…` ⇒ vẫn phải ghép tiền tố, nếu không người soi nhãn `13` thấy bảng hiện `15` sẽ tưởng mất
//     tem (SidePanel hiện thêm dòng "Mã gốc (DB)" đúng cho nhóm cũ này).
//   · tem SẢN XUẤT: nhãn TRÁI (phiếu giao hàng) đã đúng `15…` = mã gốc ⇒ hiện thẳng. Nhãn PHẢI là
//     `16…`; gõ mã đó vào ô lọc vẫn ra vì backend `timTem()` bỏ 2 số đầu rồi mới khớp.
const maHienThi = (r, laGiaCong) => (laGiaCong ? temCode(r.ma_tem, 13) : r.ma_tem);
// 2 dòng trong 1 ô (khuôn chung của các màn tem/lệnh: gộp Khách·Đơn, Màu·Kích).
const HaiDong = ({ tren, duoi }) => (
  <div className="min-w-0">
    <div className="truncate font-medium text-ink">{chu(tren)}</div>
    <div className="truncate text-xs text-ink-soft">{chu(duoi)}</div>
  </div>
);

// Một ô thông tin trong SidePanel.
const O = ({ nhan, children }) => (
  <div className="min-w-0">
    <div className="text-xs text-ink-soft">{nhan}</div>
    <div className="truncate text-sm font-medium text-ink">{children}</div>
  </div>
);

// ─── DỮ LIỆU NHÃN CHO KHUNG XEM TRƯỚC ─────────────────────────────────────────
// Nguồn TỐT NHẤT là `GET /production/tem/:id/label` (`layNhan`) — CHÍNH nguồn mà nút In dùng. Trang
// gia công không gọi được route đó (quyền `PROD_RUN`), nên lùi về dựng từ chính hàng của bảng.
// ⚠ Hàng của bảng đã mang gần đủ trường nhãn (khách/đơn/mã hàng/màu/kích/SLĐH/chuyền/SL in) — chỗ
//   thiếu là mấy trường chỉ có lúc IN THẬT (giờ phơi, phân công, và 5 trường nhóm "Gia công" ghép ở
//   `GiaCongPage.buildVeLabel`). Khung xem trước để trống chúng, KHÔNG bịa số.
const nhanTuHang = (t) => ({
  ma_tem: t.ma_tem,
  so_luong: t.so_luong,
  created_date: t.created_date,
  ma_lenh_san_xuat: t.ma_lenh_san_xuat,
  ten_khach_hang: t.ten_khach_hang,
  ma_don_hang: t.ma_don_hang,
  ma_hang: t.ma_hang,
  ma_phan: t.ma_phan,
  mau_vai: t.mau_vai,
  kich_vai: t.kich_vai,
  kich_phim: t.kich_phim,
  so_luong_don_hang: t.so_luong_don_hang,
  ma_chuyen: t.ma_chuyen,
  ten_chuyen: t.ten_chuyen,
  nha_gia_cong: t.nha_gia_cong,
  gc_mau_vai: t.gc_mau_vai,
  ma_ngay_ca: t.ma_ngay_ca,
  ma_lo: t.ma_lo,
  gio_sx_bd: t.gio_sx_bd,
  gio_sx_kt: t.gio_sx_kt,
  nguoi_in: t.nguoi_in,
  trang_thai: t.trang_thai,
  // Tem 13 dựng từ dữ liệu LỆNH lúc nhận hàng về; ở đây chỉ suy được 2 mốc chắc chắn đúng.
  tg_nhan: t.created_date,
  nguoi_nhan: t.nguoi_in,
});

// Sổ cái số lượng của tem (§11.4 DATABASE.md) — 1 tem kiểm/giao NHIỀU LẦN TỪNG PHẦN nên các cột
// này mới là số thật, `trang_thai` chỉ là công đoạn kém tiến độ nhất.
const SO_CAI = [
  ['KCS đạt', 'sl_kcs_dat'], ['KCS chuyển sửa', 'sl_kcs_sua'], ['KCS hủy', 'sl_kcs_huy'],
  ['Sửa đạt', 'sl_sua_dat'], ['Sửa hủy', 'sl_sua_huy'],
  ['OQC đạt', 'sl_oqc_dat'], ['Đã giao', 'sl_da_giao'], ['Chênh lệch', 'sl_chenh_lech'],
];

// `huyTem(temId, lyDo)` / `moLaiTem(temId, lyDo)` (14/10/2026, chỉ trang Sản xuất truyền, kèm `coQuyenHuy`): nút
//   "Hủy" ở dòng tem chưa kiểm · "Mở lại" ở tem đã hủy mở lại được — lý do bắt buộc; backend hủy rồi báo ERP theo IDMES.
export default function DanhSachTemView({
  title, subtitle, fetcher, laGiaCong = false, layNhan = null, huyTem = null, moLaiTem = null, coQuyenHuy = false,
}) {
  const { toast, show } = useToast();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});   // mặc định KHÔNG lọc ngày (xem ghi chú ở DateRangePicker)
  const [showFilter, setShowFilter] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tem, setTem] = useState(null);         // hàng đang mở SidePanel
  const [dangXuat, setDangXuat] = useState(false);
  const [suaTemDong, setSuaTemDong] = useState(null); // tem đang mở hộp Sửa (25/10/2026)
  const [inLaiDong, setInLaiDong] = useState(null);   // tem đang mở hộp In lại
  // Ô CHỌN CHUYỀN (21/10/2026) — lọc đúng chuyền chạy phiếu (`chuyenId`, khớp chính xác). Chỉ trang Sản xuất.
  const [dsChuyen, setDsChuyen] = useState([]);
  useEffect(() => {
    if (laGiaCong) return;
    listChuyen().then((r) => setDsChuyen((r.data || []).filter((c) => c.ma_loai_chuyen !== 'GIA_CONG'))).catch(() => setDsChuyen([]));
  }, [laGiaCong]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetcher({ search, page, limit: LIMIT, ...filters });
      setRows(res.data.items);
      setMeta(res.data.meta || { page: 1, totalPages: 1, total: res.data.items.length });
    } catch (e) { show(e.message || 'Lỗi tải danh sách tem', 'error'); }
    finally { setLoading(false); }
  }, [fetcher, search, page, filters, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // NÚT HỦY / MỞ LẠI Ở TỪNG DÒNG (14/10/2026) — cùng hộp lý do + cùng route với "Tem đã in" của màn Xác nhận chạy.
  const huy = useHuyLichSu({
    goiHuy: (t, ly) => huyTem(t.id, ly),
    show,
    coQuyen: !!(huyTem && coQuyenHuy),
    tieuDe: 'Hủy tem đã in',
    moTa: (t) => <>Tem <b>{t.ma_tem}</b> · {fmtNum(t.so_luong)} pcs · {t.ma_lenh_san_xuat || ''}</>,
    hauQua: 'Tem bị hủy và gỡ khỏi xe phơi; số lượng trả lại cho lệnh để in lại.',
    nhanNut: 'Hủy tem',
    baoXong: (t) => `Đã hủy tem ${t.ma_tem}`,
    sauKhiHuy: () => load(),
  });
  const moLai = useHuyLichSu({
    goiHuy: (t, ly) => moLaiTem(t.id, ly),
    show,
    coQuyen: !!(moLaiTem && coQuyenHuy),
    tieuDe: 'Mở lại tem đã hủy',
    moTa: (t) => <>Tem <b>{t.ma_tem}</b> · {fmtNum(t.so_luong)} pcs · {t.ma_lenh_san_xuat || ''}</>,
    hauQua: 'Tem về lại trạng thái trước khi hủy; số lượng tính lại vào "đã in" của lệnh (không vượt 110% SL release).',
    nhanNut: 'Mở lại tem',
    baoXong: (t) => `Đã mở lại tem ${t.ma_tem}`,
    sauKhiHuy: () => load(),
    modalProps: {
      nhanLyDo: 'Lý do mở lại', kieuNut: 'primary', goiY: 'Vì sao mở lại (vd: hủy nhầm tem)...',
      ghiChuErp: 'Mở xong hệ thống tự gửi lại phiếu in tem sang ERP (cùng IDMES của lượt in).',
    },
  });
  const coNutHuy = !laGiaCong && !!huyTem && coQuyenHuy;

  // ─── HỦY NHIỀU TEM (21/10/2026) ─────────────────────────────────────────────
  // Ô tích chỉ ở tem còn hủy được (`temHuyDuoc`). Danh sách tích GIỮ khi sang trang khác (Map id → dòng), bỏ khi bấm
  //   "Bỏ chọn" hoặc hủy xong. Hủy = gọi `huyTem` (cùng route nút Hủy từng dòng) TUẦN TỰ từng tem với CÙNG 1 lý do ⇒
  //   mọi guard + báo ERP theo IDMES giữ nguyên từng tem; tem lỗi (vd vừa bị kiểm ở máy khác ⇒ 409) không chặn tem
  //   sau, vẫn được tích lại để xem.
  const [chon, setChon] = useState(() => new Map());
  const [hopHuyNhieu, setHopHuyNhieu] = useState(null); // { ds: [dòng] } khi hộp lý do đang mở
  const [dangHuyNhieu, setDangHuyNhieu] = useState(null); // { xong, tong } trong lúc chạy
  const chonDuocTrang = coNutHuy ? rows.filter(temHuyDuoc) : [];
  const tatCaTrang = chonDuocTrang.length > 0 && chonDuocTrang.every((r) => chon.has(r.id));
  const doiChon = (r) => setChon((m) => {
    const n = new Map(m);
    if (n.has(r.id)) n.delete(r.id);
    else if (n.size < TOI_DA_HUY) n.set(r.id, r);
    return n;
  });
  const chonCaTrang = () => setChon((m) => {
    const n = new Map(m);
    if (tatCaTrang) chonDuocTrang.forEach((r) => n.delete(r.id));
    else chonDuocTrang.forEach((r) => { if (n.size < TOI_DA_HUY) n.set(r.id, r); });
    return n;
  });
  const dsChon = [...chon.values()];

  const huyNhieu = async ({ ds }, lyDo) => {
    const loi = [];
    setDangHuyNhieu({ xong: 0, tong: ds.length });
    for (let i = 0; i < ds.length; i += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await huyTem(ds[i].id, lyDo);
      } catch (e) {
        loi.push({ r: ds[i], loi: e.message || 'lỗi' });
      }
      setDangHuyNhieu({ xong: i + 1, tong: ds.length });
    }
    setDangHuyNhieu(null);
    setHopHuyNhieu(null);
    const ok = ds.length - loi.length;
    setChon(new Map(loi.map((x) => [x.r.id, x.r])));
    if (!loi.length) show(`Đã hủy ${ok} tem`);
    else {
      show(`Đã hủy ${ok}/${ds.length} tem — ${loi.length} tem chưa hủy được (vẫn đang tích): `
        + `${loi.slice(0, 3).map((x) => `${x.r.ma_tem}: ${x.loi}`).join(' · ')}${loi.length > 3 ? ' …' : ''}`, 'error');
    }
    load();
  };

  // Đổi ô lọc / ô tìm → về trang 1 (đang ở trang 5 mà lọc còn 2 trang thì bảng ra rỗng).
  const setField = (k, v) => { setFilters((s) => ({ ...s, [k]: v })); setPage(1); };
  const setNgay = ({ from, to }) => {
    setFilters((s) => ({ ...s, ngayTu: from || '', ngayDen: to || '' })); setPage(1);
  };
  // NGÀY CA (14/10/2026) = `tem.ngay_ca` — ngày sản xuất nhập lúc in (ca đêm / in bù khác ngày in tem).
  const setNgayCa = ({ from, to }) => {
    setFilters((s) => ({ ...s, ngayCaTu: from || '', ngayCaDen: to || '' })); setPage(1);
  };
  const clearFilters = () => { setFilters({}); setPage(1); };
  // Bỏ `ngayDen` / `ngayCaDen` khi đếm: khoảng ngày là MỘT bộ lọc, không phải hai. Ô chọn chuyền nằm ngoài panel.
  const filterCount = Object.entries(filters).filter(([k, v]) => v && !['ngayDen', 'ngayCaDen', 'chuyenId'].includes(k)).length;

  const fields = laGiaCong ? FIELDS_CHUNG : [...FIELDS_CHUNG, FIELD_CHUYEN, FIELD_MA_NGAY_CA];
  const textFilters = Object.fromEntries(fields.map((f) => [f.key, filters[f.key] || '']));

  // ⚠⚠ Phân trang Ở SERVER (20 dòng/trang) ⇒ tải hết mọi trang rồi mới xuất; lấy `rows` là chỉ ra
  //   ĐÚNG TRANG ĐANG XEM. Endpoint này đã nới trần `TRAN_TAI_HET` nên xin `LIMIT_TAI_LON` là đủ 1 lượt.
  // ⚠ Bộ cột bám đúng bảng của từng trang: tem gia công không có ngày ca / giờ SX (không ai đứng
  //   chuyền in nó) nên thay bằng cột "Giờ nhận về" + nhà gia công ở phần chung.
  const doExcel = async () => {
    setDangXuat(true);
    try {
      const { items, thieu, total } = await taiHetTrang(
        (p) => fetcher({ search, ...filters, ...p }), { limit: LIMIT_TAI_LON }
      );
      if (thieu) show(`Chỉ tải được ${items.length}/${total} tem — hãy thu hẹp bằng bộ lọc`, 'error');
      await exportCheckpointExcel({
        cols: [
          ...cotTemChung((r) => maHienThi(r, laGiaCong)),
          { header: 'Trạng thái', width: 14, value: (r) => (TT[r.trang_thai] || [r.trang_thai || ''])[0] },
          { header: laGiaCong ? 'Giờ nhận về' : 'Giờ in tem', width: 18, center: true,
            value: (r) => (r.created_date ? new Date(r.created_date).toLocaleString('vi-VN') : '') },
          ...(laGiaCong ? [] : [
            { header: 'Ngày ca', width: 14, value: (r) => (r.ma_ngay_ca == null ? '' : String(r.ma_ngay_ca)) },
            { header: 'Mã lô', width: 22, value: (r) => (r.ma_lo == null ? '' : String(r.ma_lo)) },
            { header: 'Giờ SX', width: 16, center: true,
              value: (r) => [r.gio_sx_bd, r.gio_sx_kt].filter(Boolean).join(' → ') },
          ]),
          { header: 'SL in', width: 12, num: true, value: (r) => (r.so_luong == null ? null : Number(r.so_luong)) },
          ...(laGiaCong ? [] : [
            { header: 'Vải hủy', width: 10, num: true, value: (r) => Number(r.sl_vai_huy_tem) || null },
            { header: 'Vải thiếu', width: 10, num: true, value: (r) => Number(r.sl_vai_thieu_tem) || null },
          ]),
        ],
        rows: items,
        title,
        fileName: laGiaCong ? 'danh-sach-tem-gia-cong' : 'danh-sach-tem-in',
        moTaLoc: moTaBoLoc({
          'tìm kiếm': search,
          [laGiaCong ? 'ngày nhận về' : 'ngày in tem']: [filters.ngayTu, filters.ngayDen].filter(Boolean).join(' → '),
          'ngày ca': [filters.ngayCaTu, filters.ngayCaDen].filter(Boolean).join(' → '),
          ...Object.fromEntries(fields.map((f) => [f.label.toLowerCase(), filters[f.key] || ''])),
        }),
      });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setDangXuat(false);
    }
  };

  const cols = [
    // Ô chọn để hủy nhiều tem (21/10/2026) — chỉ tem còn hủy được mới tích được; ô đầu bảng = cả trang.
    ...(coNutHuy ? [{ key: '_chon', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={tatCaTrang} disabled={!chonDuocTrang.length}
        onChange={chonCaTrang} aria-label="Chọn mọi tem hủy được của trang" />,
      render: (r) => {
        if (!temHuyDuoc(r)) return null;
        const tick = chon.has(r.id);
        const khoa = !tick && chon.size >= TOI_DA_HUY;
        return (
          <input type="checkbox" checked={tick} disabled={khoa}
            title={khoa ? `Mỗi lần hủy tối đa ${TOI_DA_HUY} tem` : undefined}
            onClick={(e) => e.stopPropagation()} onChange={() => doiChon(r)} aria-label="Chọn tem để hủy" />
        );
      } }] : []),
    { key: 'ma_tem', header: 'Mã tem', render: (r) => <span className="font-medium text-ink">{chu(maHienThi(r, laGiaCong))}</span> },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) => ttBadge(r.trang_thai) },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', headerClassName: 'text-right', render: (r) => fmtNum(r.so_luong) },
    // Vải hủy / thiếu CỦA TEM (21/10/2026 — hủy/thiếu theo tem). Không có ⇒ để trống.
    ...(laGiaCong ? [] : [{ key: 'sl_vai_huy_tem', header: 'Hủy / Thiếu', className: 'text-right tabular-nums whitespace-nowrap', headerClassName: 'text-right',
      render: (r) => (Number(r.sl_vai_huy_tem) || Number(r.sl_vai_thieu_tem)
        ? <span><span className="text-danger">{fmtNum(r.sl_vai_huy_tem)}</span> / <span className="text-warning">{fmtNum(r.sl_vai_thieu_tem)}</span></span>
        : <span className="text-ink-soft">—</span>) }]),
    { key: 'created_date', header: laGiaCong ? 'Giờ nhận về' : 'Giờ in tem', render: (r) => <span className="whitespace-nowrap text-ink-soft">{fmtDateTime(r.created_date)}</span> },
    ...(laGiaCong
      // Tem 13 do `confirmGiaCongToOqc` tạo lúc Kế hoạch nhận hàng về ⇒ KHÔNG có ngày ca / giờ SX
      // (không ai đứng chuyền in nó) — hiện nhà gia công thay vào chỗ đó.
      ? [{ key: 'nha_gia_cong', header: 'Nhà gia công', render: (r) => chu(r.nha_gia_cong) }]
      : [
        { key: 'ma_ngay_ca', header: 'Ngày ca / Giờ SX', render: (r) => <HaiDong tren={r.ma_ngay_ca} duoi={r.gio_sx_bd || r.gio_sx_kt ? `${chu(r.gio_sx_bd)} → ${chu(r.gio_sx_kt)}` : null} /> },
        { key: 'ma_chuyen', header: 'Chuyền', render: (r) => <HaiDong tren={r.ten_chuyen} duoi={r.ma_chuyen} /> },
      ]),
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', render: (r) => chu(r.ma_lenh_san_xuat) },
    { key: 'ten_khach_hang', header: 'Khách · Đơn', render: (r) => <HaiDong tren={r.ten_khach_hang} duoi={r.ma_don_hang} /> },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => chu(r.ma_hang) },
    { key: 'ma_phan', header: 'Code phần', render: (r) => chu(r.ma_phan) },
    { key: 'mau_vai', header: 'Màu · Kích (vải/phim)', render: (r) => <HaiDong tren={r.mau_vai} duoi={`${chu(r.kich_vai)} / ${chu(r.kich_phim)}`} /> },
    // Cột thao tác (header rỗng ⇒ DataTable ghim phải). `stopPropagation` để bấm nút không mở SidePanel của dòng.
    ...(coNutHuy ? [{
      key: '_thao_tac', header: '', className: 'text-right whitespace-nowrap',
      render: (r) => {
        if (r.trang_thai === 'HUY') {
          return r.mo_lai_duoc ? (
            <Button className="px-2.5 py-1 text-xs" title="Mở lại tem đã hủy — gửi lại phiếu in tem sang ERP"
              onClick={(e) => { e.stopPropagation(); moLai.moHuy(r); }}>Mở lại</Button>
          ) : null;
        }
        // Sửa (SL / giờ / ca — gửi lại ERP) + In lại (25/10/2026) ở mọi tem sản xuất chưa hủy.
        return (
          <span className="inline-flex items-center gap-1.5">
            <Button variant="secondary" className="px-2.5 py-1 text-xs" title="Sửa số lượng / giờ / ca — gửi lại ERP cùng IDMES"
              onClick={(e) => { e.stopPropagation(); setSuaTemDong(r); }}>Sửa</Button>
            <Button variant="secondary" className="px-2.5 py-1 text-xs" title="In lại tờ tem (giữ nguyên mã)"
              onClick={(e) => { e.stopPropagation(); setInLaiDong(r); }}>In lại</Button>
            {temHuyDuoc(r) && (
              <Button variant="danger" className="px-2.5 py-1 text-xs" title="Hủy tem (nhập lý do) — báo ERP hủy phiếu in tem"
                onClick={(e) => { e.stopPropagation(); huy.moHuy(r); }}>Hủy</Button>
            )}
          </span>
        );
      },
    }] : []),
  ];

  return (
    <div>
      <Toolbar title={title} subtitle={subtitle} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Tìm mã tem / mã đợt SX / code phần..." className="max-w-xs" />
        {/* Ngày IN TEM (`tem.created_date`, giờ VN). Mặc định KHÔNG lọc — đây là màn TRA CỨU, lọc sẵn
            hôm nay sẽ giấu tem của ngày khác mà người dùng không biết vì sao. */}
        <DateRangePicker value={{ from: filters.ngayTu || '', to: filters.ngayDen || '' }}
          onChange={setNgay} placeholder={laGiaCong ? 'Ngày nhận về' : 'Ngày in tem'} />
        {/* NGÀY CA (14/10/2026) — tem gia công không có ngày ca nên chỉ trang Sản xuất. */}
        {!laGiaCong && (
          <DateRangePicker value={{ from: filters.ngayCaTu || '', to: filters.ngayCaDen || '' }}
            onChange={setNgayCa} placeholder="Ngày ca" />
        )}
        {!laGiaCong && (
          <div className="w-44">
            <Select value={filters.chuyenId || ''} onChange={(e) => setField('chuyenId', e.target.value)} aria-label="Lọc theo chuyền">
              <option value="">Tất cả chuyền</option>
              {dsChuyen.map((c) => <option key={c.id} value={c.id}>{c.ma_chuyen}{c.ten_chuyen && c.ten_chuyen !== c.ma_chuyen ? ` · ${c.ten_chuyen}` : ''}</option>)}
            </Select>
          </div>
        )}
        <FilterToggle open={showFilter} count={filterCount} onClick={() => setShowFilter((v) => !v)} />
        <Button chiXemOk variant="secondary" icon="download" onClick={doExcel}
          loading={dangXuat} disabled={!meta.total}>Excel ({fmtNum(meta.total)})</Button>
        <Badge tone="info">{fmtNum(meta.total)} tem</Badge>
      </div>

      <FieldFilters fields={fields} values={textFilters} onField={setField}
        onClear={clearFilters} open={showFilter} />

      {coNutHuy && chon.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-sm">
          <span className="font-medium text-rose-800">
            Đã chọn {fmtNum(chon.size)} tem · {fmtNum(dsChon.reduce((s, r) => s + (Number(r.so_luong) || 0), 0))} pcs
          </span>
          <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setChon(new Map())}>Bỏ chọn</Button>
          <Button variant="danger" className="ml-auto px-3 py-1.5" onClick={() => setHopHuyNhieu({ ds: dsChon })}>
            Hủy {fmtNum(chon.size)} tem
          </Button>
        </div>
      )}

      <DataTable
        columns={cols}
        rows={rows}
        loading={loading}
        onRowClick={setTem}
        sttStart={(meta.page - 1) * LIMIT}
        pageSize={0}
        emptyText={filterCount || search ? 'Không có tem khớp bộ lọc' : 'Chưa có tem'}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <TemPanel tem={tem} onClose={() => setTem(null)} laGiaCong={laGiaCong} layNhan={layNhan}
        coSuaVai={coNutHuy} show={show}
        onDaLuuVai={(kq) => {
          setTem((t) => (t ? { ...t, sl_vai_huy_tem: kq.huy, sl_vai_thieu_tem: kq.thieu } : t));
          load();
        }} />
      {huy.modal}
      {moLai.modal}
      <SuaTemModal tem={suaTemDong} onClose={() => setSuaTemDong(null)} onDaLuu={() => { setTem(null); load(); }} show={show} />
      <InLaiTemModal tem={inLaiDong} onClose={() => setInLaiDong(null)} onDaIn={load} show={show} />
      <HuyLyDoModal muc={hopHuyNhieu} onClose={() => { if (!dangHuyNhieu) setHopHuyNhieu(null); }} onXacNhan={huyNhieu}
        tieuDe={`Hủy ${hopHuyNhieu ? hopHuyNhieu.ds.length : 0} tem đã in`} nhanNut="Hủy các tem đã chọn"
        moTa={({ ds }) => (
          <>
            <div className="font-medium">{ds.length} tem · {fmtNum(ds.reduce((s, r) => s + (Number(r.so_luong) || 0), 0))} pcs</div>
            <div className="mt-1 break-all font-mono text-xs text-ink-soft">
              {ds.slice(0, MA_HIEN_TOI_DA).map((r) => r.ma_tem).join(', ')}
              {ds.length > MA_HIEN_TOI_DA ? ` … và ${ds.length - MA_HIEN_TOI_DA} tem khác` : ''}
            </div>
          </>
        )}
        hauQua={dangHuyNhieu
          ? `Đang hủy ${dangHuyNhieu.xong}/${dangHuyNhieu.tong} tem — đừng đóng trang.`
          : 'Cùng 1 lý do cho mọi tem. Mỗi tem bị hủy và gỡ khỏi xe phơi; số lượng trả lại cho lệnh để in lại.'}
        ghiChuErp="Hủy xong hệ thống tự báo ERP hủy phiếu in tem của từng tem." />

      <Toast toast={toast} />
    </div>
  );
}

// ─── SidePanel: thông tin 1 tem ────────────────────────────────────────────────────────────────
// Phần lớn dữ liệu ĐÃ CÓ SẴN trong hàng (backend trả đủ) ⇒ mở panel là thấy ngay, không chờ API.
// Riêng khối "phân công + giờ phơi" phải gọi `GET /production/tem/:temId/label` — đó là NGUỒN DUY
// NHẤT của dữ liệu nhãn (⚠ KHÔNG dựng lại ở FE, xem kế hoạch #8).
// ⚠⚠ Route đó gác `PROD_RUN`/`PROD_MONITOR` ⇒ trang GIA CÔNG (quyền RELEASE1/RELEASE2) gọi vào sẽ
//    403 ⇒ chỉ trang Sản xuất truyền `layNhan`. Ngoài ra tem 13 vốn được in từ dữ liệu LỆNH
//    (`printGiaCongVeTem`), không phải từ bản ghi tem, nên khối này cũng không đúng nguồn cho nó.
function TemPanel({ tem, onClose, laGiaCong, layNhan, coSuaVai = false, show, onDaLuuVai }) {
  const [nhan, setNhan] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const temId = tem?.id;

  // ⚠⚠ `dungTo` phải ỔN ĐỊNH giữa các lần render (nó nằm trong deps `useEffect` của `TemInPreview`):
  //   hàm mới mỗi render ⇒ dựng lại tem liên tục, mỗi lần đều gọi `mauChoViTri` + sinh QR (bẫy deps
  //   đã ghi ở CLAUDE.md §9).
  // ⚠ Chờ `layNhan` xong mới dựng (`dangTai`) — dựng bằng hàng rồi lại dựng bằng nhãn là nháy 2 lần.
  const dungTo = useCallback(async () => {
    if (!tem) return null;
    const label = (!laGiaCong && nhan) ? { ...nhanTuHang(tem), ...nhan } : nhanTuHang(tem);
    return laGiaCong ? toTemGiaCongVe(label) : toTemSanXuat(label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temId, laGiaCong, nhan]);

  useEffect(() => {
    if (!temId || !layNhan) { setNhan(null); return; }
    let huy = false;
    setDangTai(true); setNhan(null);
    layNhan(temId)
      .then((res) => { if (!huy) setNhan(res.data); })
      // Nuốt lỗi: đây là khối THÔNG TIN THÊM, hỏng nó không được chặn việc xem tem.
      .catch(() => { if (!huy) setNhan(null); })
      .finally(() => { if (!huy) setDangTai(false); });
    return () => { huy = true; };
  }, [temId, layNhan]);

  if (!tem) return null;
  const t = tem;

  return (
    <SidePanel open={!!tem} onClose={onClose} title={`Tem ${maHienThi(t, laGiaCong) || ''}`}
      subtitle={`${t.ma_lenh_san_xuat || '—'} · SL in ${fmtNum(t.so_luong)}`} width="max-w-2xl">
      <div className="space-y-4">
        {/* ═══ TỜ TEM ĐÚNG NHƯ LÚC IN ═══════════════════════════════════════════════════════════
            Dựng bằng CHÍNH đường in (`toTemSanXuat`/`toTemGiaCongVe`): đã gắn mẫu ở *Hệ thống →
            Thiết kế tem* thì ra mẫu, chưa gắn thì ra bố cục mặc định — y hệt tờ giấy sẽ in ra.
            ⚠ Chờ `layNhan` xong mới dựng (trang Sản xuất) để nhãn có đủ giờ phơi + phân công. */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Tem như lúc in</h4>
          {dangTai ? (
            <div className="flex items-center gap-2 py-4 text-sm text-ink-soft">
              <Spinner size={18} /><span>Đang tải dữ liệu nhãn...</span>
            </div>
          ) : (
            <TemInPreview dungTo={dungTo} tieuDe={maHienThi(t, laGiaCong) || 'Tem'} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3">
          <O nhan="Mã tem">{chu(maHienThi(t, laGiaCong))}</O>
          {/* Mã GỐC trong DB — hiện khi khác mã trên nhãn, để đối chiếu khi tra cứu/hỗ trợ. */}
          {laGiaCong && t.ma_tem !== maHienThi(t, laGiaCong) && <O nhan="Mã gốc (DB)">{chu(t.ma_tem)}</O>}
          <div><div className="text-xs text-ink-soft">Trạng thái</div><div className="mt-1">{ttBadge(t.trang_thai)}</div></div>
          <O nhan="Số lượng in">{fmtNum(t.so_luong)}</O>
          <O nhan={laGiaCong ? 'Giờ nhận về' : 'Giờ in tem'}>{fmtDateTime(t.created_date)}</O>
          <O nhan="Mã đợt SX">{chu(t.ma_lenh_san_xuat)}</O>
          <O nhan="Chuyền">{t.ten_chuyen ? `${t.ten_chuyen}${t.ma_chuyen ? ` (${t.ma_chuyen})` : ''}` : '—'}</O>
          <O nhan="Số lần in">{fmtNum(t.so_lan_in)}</O>
          <O nhan="Người in">{chu(t.nguoi_in)}</O>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Phần in</h4>
          <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3">
            <O nhan="Khách hàng">{chu(t.ten_khach_hang)}</O>
            <O nhan="Đơn hàng">{chu(t.ma_don_hang)}</O>
            <O nhan="Mã hàng">{chu(t.ma_hang)}</O>
            <O nhan="Code phần">{chu(t.ma_phan)}</O>
            <O nhan="Màu vải">{chu(t.mau_vai)}</O>
            <O nhan="Kích vải / phim">{`${chu(t.kich_vai)} / ${chu(t.kich_phim)}`}</O>
            <O nhan="Tính chất in">{chu(t.tinh_chat_in)}</O>
            <O nhan="SL đơn hàng">{fmtNum(t.so_luong_don_hang)}</O>
            <O nhan="Nhà gia công">{chu(t.nha_gia_cong)}</O>
            <O nhan="Hạn giao">{t.han_giao_hang ? new Date(t.han_giao_hang).toLocaleDateString('vi-VN') : '—'}</O>
          </div>
        </div>

        {/* Ngày ca / giờ SX / BTP / GC màu vải — nhập theo LƯỢT IN, lưu vào từng tem (mig 066/068).
            Tem gia công không có các trường này nên bỏ hẳn khối. */}
        {!laGiaCong && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-ink">Lượt in</h4>
            <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3">
              <O nhan="Mã ngày ca">{chu(t.ma_ngay_ca)}</O>
              <O nhan="Mã lô">{chu(t.ma_lo)}</O>
              <O nhan="Giờ sản xuất">{t.gio_sx_bd || t.gio_sx_kt ? `${chu(t.gio_sx_bd)} → ${chu(t.gio_sx_kt)}` : '—'}</O>
              <O nhan="GC màu vải">{chu(t.gc_mau_vai)}</O>
              {/* Vải hủy / thiếu ĐI KÈM TEM (21/10/2026) — số đã gửi ERP cùng tem. Trang Sản xuất có khối nhập riêng bên dưới. */}
              {!layNhan && (
                <>
                  <O nhan="Vải hủy (kèm tem)"><span className={Number(t.sl_vai_huy_tem) ? 'text-danger' : ''}>{fmtNum(t.sl_vai_huy_tem)}</span></O>
                  <O nhan="Vải thiếu (kèm tem)"><span className={Number(t.sl_vai_thieu_tem) ? 'text-warning' : ''}>{fmtNum(t.sl_vai_thieu_tem)}</span></O>
                </>
              )}
              <div>
                <div className="text-xs text-ink-soft">BTP</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.btp_truoc && <Badge tone="info">BTP trước</Badge>}
                  {t.btp_cuoi && <Badge tone="info">BTP cuối</Badge>}
                  {!t.btp_truoc && !t.btp_cuoi && <span className="text-sm text-ink-soft">—</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {!laGiaCong && layNhan && (
          <KhoiVaiTem key={t.id} tem={t} choSua={coSuaVai && t.trang_thai !== 'HUY'} show={show} onDaLuu={onDaLuuVai} />
        )}

        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Sổ cái số lượng</h4>
          {/* 1 tem kiểm/giao NHIỀU LẦN TỪNG PHẦN ⇒ đây mới là số thật (DATABASE.md §11.4). */}
          <div className="grid grid-cols-4 gap-3 rounded-control border border-line p-3">
            {SO_CAI.map(([nhan, k]) => (
              <O key={k} nhan={nhan}>{fmtNum(t[k])}</O>
            ))}
          </div>
        </div>

        {/* Chỉ trang Sản xuất — xem ghi chú ở đầu component. */}
        {layNhan && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-ink">Phân công &amp; phơi khô</h4>
            {dangTai ? (
              <div className="flex items-center gap-2 py-4 text-sm text-ink-soft">
                <Spinner size={18} /><span>Đang tải dữ liệu nhãn...</span>
              </div>
            ) : !nhan ? (
              <div className="text-sm text-ink-soft">Không lấy được dữ liệu nhãn tem.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3">
                <O nhan="Ca trưởng">{chu(nhan.ca_truong)}</O>
                <O nhan="Chuyền trưởng">{chu(nhan.chuyen_truong)}</O>
                <O nhan="Thợ in">{chu(nhan.tho_in)}</O>
                <O nhan="Bắt đầu in (phiếu)">{fmtDateTime(nhan.tg_bd_in)}</O>
                <O nhan="Bắt đầu phơi">{fmtDateTime(nhan.tg_bd_phoi)}</O>
                <O nhan="Kết thúc phơi">{fmtDateTime(nhan.tg_kt_phoi)}</O>
              </div>
            )}
          </div>
        )}
      </div>
    </SidePanel>
  );
}

// ─── SỬA TEM (25/10/2026, người dùng yêu cầu) ──────────────────────────────────────────────────────────────────
// Sửa SL in (chỉ khi tem CHƯA kiểm) · giờ SX · mã ngày ca; lý do bắt buộc. Backend `PUT /production/tem/:id/sua`
// (`production.service suaTem`) kiểm lại trong transaction (chưa kiểm · trần 110%) rồi gửi lại phiếu in tem sang ERP
// CÙNG IDMES (ERP ghi đè phiếu, không thêm phiếu).
const NGAY_CA_RE = /^\d{6}(C1|C2|C3|D1|D2|HC)$/;
function SuaTemModal({ tem, onClose, onDaLuu, show }) {
  const [sl, setSl] = useState('');
  const [gioBd, setGioBd] = useState('');
  const [gioKt, setGioKt] = useState('');
  const [maCa, setMaCa] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState('');
  useEffect(() => {
    if (!tem) return;
    setSl(String(tem.so_luong ?? '')); setGioBd(tem.gio_sx_bd || ''); setGioKt(tem.gio_sx_kt || '');
    setMaCa(tem.ma_ngay_ca || ''); setLyDo(''); setLoi('');
  }, [tem]);
  if (!tem) return null;
  const khoaSl = !!tem.da_kiem;
  const slSai = !khoaSl && (!/^\d+$/.test(String(sl).trim()) || Number(sl) <= 0);
  const caSai = !!maCa && !NGAY_CA_RE.test(maCa);
  const body = {};
  if (!khoaSl && Number(sl) !== Number(tem.so_luong)) body.soLuong = Number(sl);
  if ((gioBd || '') !== (tem.gio_sx_bd || '')) body.gioBd = gioBd || null;
  if ((gioKt || '') !== (tem.gio_sx_kt || '')) body.gioKt = gioKt || null;
  if (maCa && maCa !== (tem.ma_ngay_ca || '')) body.maNgayCa = maCa;
  const coDoi = Object.keys(body).length > 0;

  const luu = async () => {
    setDangLuu(true); setLoi('');
    try {
      const res = await suaTem(tem.id, { ...body, lyDo: lyDo.trim() });
      show(res.data?.gui_erp ? `Đã sửa tem ${tem.ma_tem} — đang gửi lại ERP (cùng IDMES)` : `Đã sửa tem ${tem.ma_tem}`);
      onDaLuu?.();
      onClose();
    } catch (e) { setLoi(e.message || 'Sửa tem thất bại'); }
    finally { setDangLuu(false); }
  };

  return (
    <Modal open={!!tem} onClose={() => (dangLuu ? null : onClose())} size="md" title={`Sửa tem ${tem.ma_tem}`}
      footer={(
        <>
          <Button chiXemOk variant="ghost" onClick={onClose} disabled={dangLuu}>Hủy</Button>
          <Button onClick={luu} loading={dangLuu} disabled={!coDoi || slSai || caSai || !lyDo.trim()}>Lưu &amp; gửi ERP</Button>
        </>
      )}>
      <div className="space-y-3">
        <div className="text-sm text-ink-soft">{tem.ma_lenh_san_xuat} · {tem.ma_phan} · {tem.ten_chuyen || tem.ma_chuyen || ''}</div>
        <Field label="Số lượng in (pcs)">
          <Input type="number" min="1" inputMode="numeric" value={sl} disabled={khoaSl} onChange={(e) => setSl(e.target.value)} />
        </Field>
        {khoaSl && <p className="-mt-2 text-xs text-amber-700 dark:text-amber-400">Tem đã kiểm (KCS) — không sửa số lượng được.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Từ giờ"><TimeSelect value={gioBd} onChange={setGioBd} minuteStep={1} /></Field>
          <Field label="Đến giờ"><TimeSelect value={gioKt} onChange={setGioKt} minuteStep={1} /></Field>
        </div>
        <Field label="Mã ngày ca (vd 261025C1)">
          <Input value={maCa} onChange={(e) => setMaCa(e.target.value.toUpperCase().replace(/\s+/g, ''))}
            className={caSai ? 'border-danger' : ''} placeholder="YYMMDD + C1/C2/C3/D1/D2/HC" />
        </Field>
        {caSai && <p className="-mt-2 text-xs text-danger">Mã ngày ca phải đúng 8 ký tự: YYMMDD + C1·C2·C3·D1·D2·HC</p>}
        <Field label="Lý do sửa" required>
          <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Vì sao sửa tem (vd: nhập nhầm số lượng / ca)..." />
        </Field>
        <p className="text-xs text-ink-soft">Lưu xong hệ thống gửi lại phiếu in tem sang ERP cùng IDMES — ERP cập nhật phiếu cũ, không tạo phiếu mới.</p>
        {loi && <p className="text-sm text-danger">{loi}</p>}
      </div>
    </Modal>
  );
}

// ─── IN LẠI TEM (25/10/2026) — giữ nguyên mã tem, ghi `log_tem` (lý do bắt buộc), in đúng đường in thật. ─────────
function InLaiTemModal({ tem, onClose, onDaIn, show }) {
  const [lyDo, setLyDo] = useState('');
  const [dangIn, setDangIn] = useState(false);
  useEffect(() => { if (tem) setLyDo(''); }, [tem]);
  if (!tem) return null;
  const inLai = async () => {
    // ⚠ Mở SẴN cửa sổ in trong cú bấm (trước mọi await) — mở sau await là trình duyệt chặn popup.
    let w;
    try { w = moSanCuaSoIn(); } catch (e) { show(e.message, 'error'); return; }
    setDangIn(true);
    try {
      await reprintTem(tem.id, lyDo.trim());
      const nhan = (await getTemLabel(tem.id)).data;
      await printTemLabel(nhan, w);
      show(`Đã in lại tem ${tem.ma_tem} (giữ nguyên mã)`);
      onDaIn?.();
      onClose();
    } catch (e) {
      dongCuaSoIn(w);
      show(e.message || 'In lại thất bại', 'error');
    } finally { setDangIn(false); }
  };
  return (
    <Modal open={!!tem} onClose={() => (dangIn ? null : onClose())} size="sm" title={`In lại tem ${tem.ma_tem}`}
      footer={(
        <>
          <Button chiXemOk variant="ghost" onClick={onClose} disabled={dangIn}>Hủy</Button>
          <Button onClick={inLai} loading={dangIn} disabled={!lyDo.trim()}>In lại tem</Button>
        </>
      )}>
      <p className="mb-3 text-sm text-ink-soft">In lại nhãn — <b>giữ nguyên mã tem</b>, không đổi số lượng / sổ cái, không gửi ERP.</p>
      <Field label="Lý do in lại" required>
        <Textarea rows={3} value={lyDo} autoFocus onChange={(e) => setLyDo(e.target.value)} placeholder="vd: tem rách, mờ..." />
      </Field>
    </Modal>
  );
}

// ─── KHỐI VẢI HỦY / THIẾU CỦA TEM (21/10/2026) ──────────────────────────────────────────────────
// Hủy / thiếu vẫn là số của ĐỢT VẢI của phần in; tem chỉ là TEM ĐẠI DIỆN mang số đó sang ERP (thường là tem
//   cuối — in xong mới biết thiếu / hủy bao nhiêu). Nhập ở đây = ĐẶT số của tem này (backend ghi phần chênh vào sổ
//   đợt, gắn tem) rồi tự gửi lại phiếu in tem sang ERP cùng IDMES. Tem in trước mig 118 (`nguon: 'ERP'`): số đang
//   hiện là số đã gửi ERP lúc in — lưu thì backend chuyển số đó sang sổ của tem (tổng của đợt vẫn đúng).
function KhoiVaiTem({ tem, choSua, show, onDaLuu }) {
  const [du, setDu] = useState(null);       // dữ liệu từ `GET /production/tem/:id/vai`
  const [loi, setLoi] = useState('');
  const [huy, setHuy] = useState('');
  const [thieu, setThieu] = useState('');
  const [dot, setDot] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [dangLuu, setDangLuu] = useState(false);
  const temId = tem.id;

  const nap = useCallback(async () => {
    try {
      const res = await getVaiTem(temId);
      const d = res.data;
      setDu(d); setLoi('');
      setHuy(String(d.huy ?? 0)); setThieu(String(d.thieu ?? 0));
      setDot(d.dot_vai_ve_id || ''); setLyDo('');
    } catch (e) { setDu(null); setLoi(e.message || 'Không tải được số vải hủy / thiếu'); }
  }, [temId]);

  useEffect(() => { nap(); }, [nap]);

  const soHopLe = (v) => v !== '' && /^\d+$/.test(String(v).trim());
  const doi = !!du && (Number(huy) !== Number(du.huy) || Number(thieu) !== Number(du.thieu));
  const daCoSo = !!du && (Number(du.huy) > 0 || Number(du.thieu) > 0);
  const nhieuDot = !!du && (du.dot_vai || []).length > 1;
  const thieuLyDo = daCoSo && doi && !lyDo.trim();
  const sai = !soHopLe(huy) || !soHopLe(thieu);

  const luu = async () => {
    if (sai) { show('Vải hủy / vải thiếu phải là số nguyên ≥ 0', 'error'); return; }
    if (thieuLyDo) { show('Tem đã có số vải hủy / thiếu — nhập lý do sửa', 'error'); return; }
    setDangLuu(true);
    try {
      const res = await suaVaiTem(temId, {
        huy: Number(huy), thieu: Number(thieu), dotVaiId: dot || null, lyDo: lyDo.trim() || null,
      });
      const kq = res.data;
      show(kq.gui_erp
        ? `Đã lưu hủy ${fmtNum(kq.huy)} · thiếu ${fmtNum(kq.thieu)} cho tem ${tem.ma_tem} — đang gửi lại ERP`
        : `Đã lưu hủy ${fmtNum(kq.huy)} · thiếu ${fmtNum(kq.thieu)} cho tem ${tem.ma_tem}`);
      if (onDaLuu) onDaLuu(kq);
      await nap();
    } catch (e) { show(e.message || 'Lưu vải hủy / thiếu thất bại', 'error'); }
    finally { setDangLuu(false); }
  };

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-ink">Vải hủy / thiếu (theo đợt vải · tem đại diện)</h4>
      <div className="rounded-control border border-line p-3">
        {loi ? (
          <div className="text-sm text-danger">{loi}</div>
        ) : !du ? (
          <div className="flex items-center gap-2 py-2 text-sm text-ink-soft"><Spinner size={18} /><span>Đang tải...</span></div>
        ) : !du.co_cot ? (
          <div className="grid grid-cols-2 gap-3">
            <O nhan="Vải hủy (kèm tem)">{fmtNum(tem.sl_vai_huy_tem)}</O>
            <O nhan="Vải thiếu (kèm tem)">{fmtNum(tem.sl_vai_thieu_tem)}</O>
            <div className="col-span-2 text-xs text-ink-soft">Chưa chạy migration 118 — chưa nhập được số theo tem.</div>
          </div>
        ) : !choSua ? (
          <div className="grid grid-cols-2 gap-3">
            <O nhan="Vải hủy"><span className={Number(du.huy) ? 'text-danger' : ''}>{fmtNum(du.huy)}</span></O>
            <O nhan="Vải thiếu"><span className={Number(du.thieu) ? 'text-warning' : ''}>{fmtNum(du.thieu)}</span></O>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-ink-soft">Vải hủy (pcs)</span>
                <Input type="number" min="0" inputMode="numeric" value={huy} onChange={(e) => setHuy(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs text-ink-soft">Vải thiếu (pcs)</span>
                <Input type="number" min="0" inputMode="numeric" value={thieu} onChange={(e) => setThieu(e.target.value)} />
              </label>
            </div>
            {nhieuDot && (
              <label className="block">
                <span className="text-xs text-ink-soft">Đợt vải của phần in</span>
                <Select value={dot} onChange={(e) => setDot(e.target.value)}>
                  <option value="">— Chọn đợt vải —</option>
                  {du.dot_vai.map((d) => (
                    <option key={d.dot_vai_ve_id} value={d.dot_vai_ve_id}>
                      {[d.ma_phan, d.ma_dot_vai, d.mau_vai].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {daCoSo && doi && (
              <label className="block">
                <span className="text-xs text-ink-soft">Lý do sửa <span className="text-danger">*</span></span>
                <Input value={lyDo} maxLength={200} placeholder="Vì sao sửa số (vd: nhập nhầm, kiểm lại vải)..."
                  onChange={(e) => setLyDo(e.target.value)} />
              </label>
            )}
            <div className="text-xs text-ink-soft">
              {du.nguon === 'ERP'
                ? 'Số đang hiện là số đã gửi ERP lúc in tem. Lưu sẽ chuyển số này sang tem (tổng của đợt vải vẫn đúng).'
                : 'Số thuộc đợt vải của phần in; tem này là tem đại diện mang số sang ERP. Lưu xong tự gửi lại phiếu in tem sang ERP.'}
            </div>
            <div className="flex justify-end">
              <Button onClick={luu} loading={dangLuu} disabled={!doi || sai || thieuLyDo || (nhieuDot && !dot)}>
                Lưu hủy / thiếu
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
