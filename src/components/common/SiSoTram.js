import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Badge from './Badge';
import Icon from './Icon';
import Spinner from './Spinner';
import Pagination from './Pagination';
import DateRangePicker from './DateRangePicker';
import Toast from './Toast';
import { Field, Input, Select } from './controls';
import useToast from '../../hooks/useToast';
import useSocketReload from '../../hooks/useSocketReload';
import { fmtNum, fmtDate, ngayLocalISO } from '../../utils/format';
import { laySiSo, laySiSoChiTiet } from '../../services/siSoService';
import { useSiSoLocHienTai } from '../../hooks/useSiSoLoc';
import PhuongAnInBadge from './PhuongAnInBadge';

// ─────────────────────────────────────────────────────────────────────────────
// "SĨ SỐ" CHECKPOINT — dải 1 HÀNG nằm THẲNG HÀNG với breadcrumb, mép phải màn xác nhận:
//   Tồn đầu kỳ · Nhận trong kỳ · Làm được trong kỳ · Tồn cuối kỳ
// Bấm 1 ô → modal danh sách chi tiết (bảng đầy đủ như "Danh sách release") + bộ lọc + xuất Excel.
//
// ⚠⚠ NƠI RENDER LÀ `components/layout/ModuleLayout.js` (hàng breadcrumb), KHÔNG phải trong trang.
//   Trang khai mã màn bằng khóa `siSo` ở `constants/modules.js` — thêm màn mới chỉ sửa 1 chỗ đó.
//   Vì nằm ở hàng breadcrumb (cao ~20px) nên dải này phải **1 HÀNG, cao ~28px**: đừng thêm dòng
//   nhãn phía trên như bản cũ, sẽ đội breadcrumb lên và lệch hàng.
//
// ⚠ 4 số LUÔN CÂN: Tồn đầu + Nhận − Làm được = Tồn cuối (mô hình khoảng [tg_vào, tg_ra) ở backend).
//   Nếu backend trả `can=false` thì hiện dấu cảnh báo thay vì im lặng cho số sai.
//
// ⚠ 2 TRỤC NGÀY: "kỳ" (ô ngày ở đầu modal) là mốc VÀO/RA trạm — trục của 4 con số;
//   "lọc thêm theo ngày" là ngày NGHIỆP VỤ khác (nhận vải · lên MES · hạn giao …), chỉ thu hẹp tập
//   đang xét. Đừng gộp 2 thứ này.
//
// ⚠⚠ TỰ NHẢY KHI CÓ NGƯỜI XÁC NHẬN (18/08/2026): 4 số này là ẢNH CHỤP hàng đợi, mà mỗi trạm do
//   NHIỀU MÁY thao tác ⇒ tải 1 lần lúc mở trang là ôm số cũ cả buổi. Nay nghe socket, gộp trong
//   `DELAY_SOCKET` ms thành ĐÚNG 1 lần tải.
// ⚠ Dùng MỘT bộ sự kiện chung cho cả 12 màn thay vì map theo `maTrang`: thiếu 1 sự kiện là số
//   "đứng im" — đúng lỗi đang phải sửa — trong khi thừa chỉ tốn 1 query đếm (đo prod 41–493ms).
// ⚠ CỐ Ý BỎ `dashboard:refresh`: job phơi khô bắn kèm sự kiện đó, mà 2 sự kiện kia (`drying:updated`,
//   `quality:updated`) đã phủ; nghe thêm chỉ nhân đôi số lần tải.
// ⚠ Tải lại phải NGẦM (`tai(true)` — không bật spinner): dải nằm ngay hàng breadcrumb, nháy spinner
//   mỗi lần đồng nghiệp xác nhận là rất chối mắt.
// ─────────────────────────────────────────────────────────────────────────────

const SU_KIEN = ['ready:confirmed', 'workflow:updated', 'production:updated',
  'quality:updated', 'delivery:updated', 'drying:updated'];
const DELAY_SOCKET = 800;

// Bộ lọc của TRANG gửi lên với tiền tố `t_` để KHÔNG đụng bộ lọc riêng trong modal — backend AND
// 2 tầng với nhau (`dungLocKep`). Trộn chung 1 tên khóa thì tầng này đè mất tầng kia.
const thamSoTrang = (goiLoc) => {
  let loc = {};
  try { loc = JSON.parse(goiLoc || '{}') || {}; } catch (e) { loc = {}; }
  return Object.entries(loc).reduce((a, [k, v]) => (
    v === undefined || v === null || v === '' ? a : { ...a, [`t_${k}`]: v }
  ), {});
};

const O_LIST = [
  { ma: 'ton_dau', ten: 'Tồn đầu kỳ', ngan: 'Đầu', mau: 'text-ink-soft' },
  { ma: 'nhan', ten: 'Nhận trong kỳ', ngan: 'Nhận', mau: 'text-primary' },
  { ma: 'lam_duoc', ten: 'Làm được trong kỳ', ngan: 'Xong', mau: 'text-emerald-600' },
  { ma: 'ton_cuoi', ten: 'Tồn cuối kỳ', ngan: 'Cuối', mau: 'text-ink' },
];

const LOAI_NGAY = [
  { ma: '', ten: '— Không lọc theo ngày khác —' },
  { ma: 'NGAY_VAI_VE', ten: 'Ngày nhận vải' },
  { ma: 'TG_LEN_MES', ten: 'Ngày ERP lên MES' },
  { ma: 'HAN_GIAO', ten: 'Hạn giao hàng' },
  { ma: 'NGAY_KE_HOACH', ten: 'Ngày KH sản xuất' },
  { ma: 'NGAY_RELEASE', ten: 'Ngày release' },
];

const F_TRONG = {
  timKiem: '', khach: '', don: '', maHang: '', codePhan: '', mauVai: '', kichVai: '',
  kichPhim: '', chuyen: '', nhaGiaCong: '', loaiNgay: '', ngayTu: '', ngayDen: '',
};

// Các ô nằm TRONG panel "Bộ lọc" (dùng để đếm badge). `timKiem` + bộ 3 ngày phụ ở NGOÀI panel.
const PANEL_KEYS = ['khach', 'don', 'maHang', 'codePhan', 'mauVai', 'kichVai', 'kichPhim',
  'chuyen', 'nhaGiaCong'];

const COT = [
  { key: 'ten_khach_hang', ten: 'Khách hàng' },
  { key: 'ma_don_hang', ten: 'Đơn hàng' },
  { key: 'ma_hang', ten: 'Mã hàng' },
  { key: 'ma_phan', ten: 'Code phần' },
  { key: 'mau_vai', ten: 'Màu vải' },
  { key: 'kich_vai', ten: 'Kích vải' },
  { key: 'kich_phim', ten: 'Kích phim' },
  { key: 'tinh_chat_in', ten: 'Tính chất in' },
  { key: 'ten_loai_dot_vai', ten: 'Loại đợt vải' },
  { key: 'phuong_an_in', ten: 'Phương án in' },
  { key: 'nha_gia_cong', ten: 'Nhà gia công' },
  // ⚠ CỐ Ý KHÔNG có cột "Mã đợt vải" (bỏ theo yêu cầu 16/08/2026) — bảng đã rất nhiều cột.
  // Backend vẫn trả `ma_dot_vai` và ô "Tìm nhanh" vẫn quét trường này; file Excel vẫn giữ cột đó.
  { key: 'ma_lenh_san_xuat', ten: 'Mã đợt SX' },
  { key: 'ma_tem', ten: 'Mã tem' },
  { key: 'ten_chuyen', ten: 'Chuyền' },
  { key: 'so_luong_don_hang', ten: 'SLĐH', so: true },
  { key: 'so_luong_vai_ve', ten: 'SLNV', so: true },
  { key: 'ngay_vai_ve', ten: 'Ngày nhận vải', ngay: true },
  { key: 'tg_len_mes', ten: 'Ngày lên MES', ngay: true },
  { key: 'ngay_ke_hoach', ten: 'Ngày KH SX', ngay: true },
  { key: 'han_giao_hang', ten: 'Hạn giao', ngay: true },
  { key: 'tg_vao', ten: 'Vào trạm', ngay: true, gio: true },
  { key: 'tg_ra', ten: 'Rời trạm', ngay: true, gio: true },
];

const gioVN = (v) => (v
  ? new Date(v).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

// ─── 4 ô sĩ số (đặt ở góc trên bên phải màn) ─────────────────────────────────
export default function SiSoTram({ maTrang, tuDong = true }) {
  const { toast, show } = useToast();
  const homNay = ngayLocalISO(new Date());
  const [ky, setKy] = useState({ tu: homNay, den: homNay });
  const [so, setSo] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [oDangMo, setODangMo] = useState(null);

  // `ngam = true` (socket bắn) → KHÔNG bật spinner và KHÔNG xóa số đang hiện khi lỗi: dải này nằm
  // ngay hàng breadcrumb, nháy mỗi lần đồng nghiệp xác nhận là chối mắt.
  // Bộ lọc ĐANG BẬT TRÊN TRANG (ô tìm + panel lọc + dải chip) — trang công bố qua `useSiSoLoc`.
  // `null` = trang chưa nối ⇒ đếm TOÀN TRẠM y như trước.
  const locTrang = useSiSoLocHienTai();
  // ⚠ Chuỗi hóa để đưa vào deps: object mới mỗi render sẽ làm `tai` đổi mỗi render ⇒ effect bắn
  //   request không ngừng (bẫy deps §9). Chuỗi này cũng là thứ so sánh "bộ lọc có đổi không".
  const goiLoc = JSON.stringify(locTrang || {});
  const coLocTrang = !!locTrang && Object.keys(locTrang).length > 0;

  const tai = useCallback(async (ngam = false) => {
    if (!ngam) setDangTai(true);
    try {
      const r = await laySiSo(maTrang, { tu: ky.tu, den: ky.den, ...thamSoTrang(goiLoc) });
      setSo(r.data);
    } catch (e) {
      // Không chặn màn thao tác — sĩ số chỉ là số liệu phụ.
      if (!ngam) setSo(null);
    } finally { if (!ngam) setDangTai(false); }
  }, [maTrang, ky.tu, ky.den, goiLoc]);

  useEffect(() => { if (tuDong) tai(); }, [tai, tuDong]);

  // Có người xác nhận ở BẤT KỲ máy nào → 4 số tự nhảy (tải ngầm, gộp nhiều sự kiện thành 1 lần).
  useSocketReload(SU_KIEN, () => { if (tuDong) tai(true); }, DELAY_SOCKET);

  if (!so && !dangTai) return null;

  const nhanKy = ky.tu === ky.den ? fmtDate(ky.tu) : `${fmtDate(ky.tu)} → ${fmtDate(ky.den)}`;

  return (
    <>
      {/* 1 HÀNG, cao ~28px để nằm ngang hàng breadcrumb. Nhãn dài ẩn dần ở màn hẹp. */}
      <div className="flex items-center gap-1 rounded-control border border-line bg-surface px-2 py-1">
        <Icon name="list" size={13} className="shrink-0 text-ink-soft" />
        <span className="hidden whitespace-nowrap text-[11px] text-ink-soft xl:inline">
          Theo dõi {so?.don_vi_nhan || ''}
        </span>
        <span className="hidden whitespace-nowrap text-[11px] font-medium text-ink sm:inline">{nhanKy}</span>
        {/* ⚠ PHẢI có dấu hiệu khi 4 số đang bị bộ lọc trang thu hẹp: không có thì người dùng thấy
            số tụt xuống mà tưởng hệ thống đếm sai / mất hàng. */}
        {coLocTrang && (
          <span
            className="whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            title="4 số đang tính theo đúng bộ lọc / ô tìm / chip của trang. Xóa lọc để xem toàn trạm."
          >
            đang lọc
          </span>
        )}
        {so && !so.can && (
          <span title="4 số không cân — có dữ liệu mốc thời gian bất thường">
            <Icon name="alert-triangle" size={13} className="text-amber-500" />
          </span>
        )}
        {dangTai && <Spinner size={12} />}
        <span className="mx-0.5 h-4 w-px shrink-0 bg-line" />
        {O_LIST.map((o) => (
          <button
            key={o.ma}
            type="button"
            onClick={() => setODangMo(o.ma)}
            className="flex items-baseline gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 transition hover:bg-surface-muted"
            title={`${o.ten} (${nhanKy}) — bấm để xem danh sách`}
          >
            <span className={`text-sm font-bold leading-none ${o.mau}`}>
              {so ? fmtNum(so[o.ma]) : '—'}
            </span>
            <span className="text-[10px] leading-none text-ink-soft">{o.ngan}</span>
          </button>
        ))}
      </div>

      {oDangMo && (
        <SiSoModal
          maTrang={maTrang}
          o={oDangMo}
          ky={ky}
          onDoiKy={setKy}
          so={so}
          tenMan={so?.ten_man}
          donViNhan={so?.don_vi_nhan}
          onClose={() => setODangMo(null)}
          onShow={show}
          goiLoc={goiLoc}
        />
      )}
      <Toast toast={toast} />
    </>
  );
}

// ─── Modal danh sách chi tiết ────────────────────────────────────────────────
function SiSoModal({ maTrang, o, ky, onDoiKy, so, tenMan, donViNhan, onClose, onShow, goiLoc }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [oHienTai, setOHienTai] = useState(o);
  const [f, setF] = useState(F_TRONG);
  const [moLoc, setMoLoc] = useState(false);
  const [xuat, setXuat] = useState(false);
  const LIMIT = 20;

  // ⚠ Modal PHẢI mang theo bộ lọc của TRANG (`t_*`), nếu không: bấm ô "Tồn cuối" đang hiện 12 mà
  //   danh sách mở ra 300 dòng — số trên ô và số dòng trong modal đá nhau ngay trước mắt người dùng.
  const params = useMemo(() => {
    const p = { tu: ky.tu, den: ky.den, ...thamSoTrang(goiLoc) };
    Object.entries(f).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [ky.tu, ky.den, f, goiLoc]);

  const tai = useCallback(async (ngam = false) => {
    if (!ngam) setLoading(true);
    try {
      const r = await laySiSoChiTiet(maTrang, oHienTai, { ...params, page, limit: LIMIT });
      setRows(r.data.items || []);
      setTotal(r.data.meta?.total || 0);
    } catch (e) {
      // Lỗi ở lượt tải NGẦM thì im lặng giữ danh sách cũ — đừng bắn toast đỏ khi người dùng
      // không hề bấm gì (socket có thể bắn lúc mạng chớp).
      if (ngam) return;
      onShow(e.message || 'Không tải được danh sách', 'error');
      setRows([]); setTotal(0);
    } finally { if (!ngam) setLoading(false); }
  }, [maTrang, oHienTai, params, page, onShow]);

  useEffect(() => { tai(); }, [tai]);

  // Modal đang mở mà có người xác nhận → danh sách tự cập nhật cho khớp 4 số ở dải ngoài.
  useSocketReload(SU_KIEN, () => tai(true), DELAY_SOCKET);
  useEffect(() => { setPage(1); }, [oHienTai, params]);

  // ⚠ Badge "Bộ lọc (N)" CHỈ đếm các ô NẰM TRONG panel — ô "Tìm nhanh" và "lọc thêm theo ngày" đã
  //   được đưa RA NGOÀI (thao tác hằng ngày, mở panel mới gõ được thì chậm), đếm vào đây là người
  //   dùng mở panel ra thấy trống mà badge vẫn báo có lọc.
  const soLoc = PANEL_KEYS.filter((k) => f[k]).length;
  const tenO = (O_LIST.find((x) => x.ma === oHienTai) || {}).ten;

  const doXuat = async () => {
    setXuat(true);
    try {
      // `limit: 0` = lấy HẾT theo đúng bộ lọc đang xem (không chỉ trang hiện tại).
      const r = await laySiSoChiTiet(maTrang, oHienTai, { ...params, limit: 0 });
      const { xuatSiSoExcel } = await import('../../utils/exportSiSoExcel');
      await xuatSiSoExcel(r.data.items || [], {
        tenMan, tenO, ky, donViNhan, moTaLoc: moTaBoLoc(f),
      });
    } catch (e) {
      onShow(e.message || 'Xuất Excel thất bại', 'error');
    } finally { setXuat(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      lapDay
      title={`${tenMan || 'Checkpoint'} — ${tenO}`}
      footer={<Button variant="ghost" onClick={onClose}>Đóng</Button>}
    >
      <div className="flex h-full flex-col">
        {/* ⚠⚠ `relative` để panel "Bộ lọc" neo NỔI vào đây — xem ghi chú ở chỗ render panel. */}
        <div className="relative shrink-0 space-y-2 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* ⚠ DateRangePicker nhận `value={{from,to}}` và trả `onChange({from,to})` — KHÔNG phải
                (tu, den). `to` rỗng nghĩa là mới chọn ngày đầu ⇒ coi như 1 ngày. */}
            <DateRangePicker
              value={{ from: ky.tu, to: ky.den }}
              onChange={({ from, to }) => onDoiKy({ tu: from || ky.tu, den: to || from || ky.tu })}
            />
            {/* ⚠⚠ HIỆN LUÔN 4 CON SỐ TRÊN CHIP (21/08/2026): đổi ngày ngay trong modal thì dải ở
                hàng breadcrumb có cập nhật thật, nhưng nó **nằm dưới modal** ⇒ người dùng phải đóng
                modal mới thấy. Nay số đi kèm tên ô, khỏi phải thoát ra vào. `so` do component cha
                truyền xuống và tự tải lại mỗi khi `ky` đổi (cùng một nguồn với dải ngoài, không có
                truy vấn thêm nào). */}
            <div className="flex flex-wrap gap-1">
              {O_LIST.map((x) => (
                <button
                  key={x.ma}
                  type="button"
                  onClick={() => setOHienTai(x.ma)}
                  className={`flex items-baseline gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition
                    ${oHienTai === x.ma ? 'bg-primary text-white' : 'bg-surface-muted text-ink-soft hover:text-ink'}`}
                >
                  <span>{x.ten}</span>
                  <span className={`text-sm font-bold leading-none ${oHienTai === x.ma ? 'text-white' : x.mau}`}>
                    {so ? fmtNum(so[x.ma]) : '—'}
                  </span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" icon="filter" onClick={() => setMoLoc((v) => !v)}>
                Bộ lọc{soLoc ? ` (${soLoc})` : ''}
              </Button>
              <Button variant="secondary" icon="download" loading={xuat} onClick={doXuat} disabled={!total}>
                Excel
              </Button>
            </div>
          </div>

          {/* ⚠ Ô TÌM NHANH + LỌC THÊM THEO NGÀY đặt NGOÀI panel (16/08/2026): đây là 2 thứ dùng
              thường xuyên nhất, bắt bấm "Bộ lọc" mới gõ được thì chậm. Khoảng ngày dùng
              DateRangePicker nên lọc được NHIỀU NGÀY, không chỉ 1 ngày. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[16rem] flex-1">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                value={f.timKiem}
                onChange={(e) => setF({ ...f, timKiem: e.target.value })}
                placeholder="Tìm nhanh: khách, đơn, mã hàng, code phần, mã đợt SX, mã tem, mã đợt vải..."
                className="h-10 w-full rounded-control border border-line pl-9 pr-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 md:text-sm"
              />
            </div>
            <div className="w-52 shrink-0">
              <Select value={f.loaiNgay} onChange={(e) => setF({ ...f, loaiNgay: e.target.value })}>
                {LOAI_NGAY.map((x) => <option key={x.ma} value={x.ma}>{x.ten}</option>)}
              </Select>
            </div>
            {f.loaiNgay && (
              <DateRangePicker
                value={{ from: f.ngayTu, to: f.ngayDen }}
                onChange={({ from, to }) => setF({ ...f, ngayTu: from || '', ngayDen: to || from || '' })}
              />
            )}
            {(f.timKiem || f.loaiNgay || soLoc > 0) && (
              <Button variant="ghost" onClick={() => setF(F_TRONG)}>Xóa lọc</Button>
            )}
          </div>

          <div className="text-xs text-ink-soft">
            <b className="text-ink">{fmtNum(total)}</b> {donViNhan || 'mục'}
            {(soLoc || f.timKiem || f.loaiNgay) ? ' (đang lọc)' : ''}
            <span className="ml-2">· Kỳ tính theo <b>mốc vào/rời trạm</b>; "lọc thêm theo ngày" là ngày nghiệp vụ khác.</span>
          </div>

          {/* ⚠⚠ PANEL NỔI (absolute), KHÔNG chiếm chỗ trong luồng (fix 16/08/2026 "mở bộ lọc là mất
              bảng"): modal bật `lapDay` nên thân KHÔNG cuộn — khối đầu `shrink-0` phình ra bao nhiêu
              thì vùng bảng (`flex-1 min-h-0`) co lại bấy nhiêu, trên laptop màn thấp là co về ~0 và
              bảng biến mất. Cho panel nổi đè lên bảng thì bảng giữ nguyên chiều cao.
              ⚠ `max-h` + `overflow-auto` để panel không tràn khỏi đáy modal (`overflow-hidden` sẽ cắt). */}
          {moLoc && (
            <div className="absolute right-0 top-full z-30 grid w-full max-w-3xl grid-cols-2 gap-2 rounded-control border border-line bg-surface p-3 shadow-card-hover md:grid-cols-4"
              style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              <Field label="Khách hàng"><Input value={f.khach} onChange={(e) => setF({ ...f, khach: e.target.value })} /></Field>
              <Field label="Đơn hàng"><Input value={f.don} onChange={(e) => setF({ ...f, don: e.target.value })} /></Field>
              <Field label="Mã hàng"><Input value={f.maHang} onChange={(e) => setF({ ...f, maHang: e.target.value })} /></Field>
              <Field label="Code phần"><Input value={f.codePhan} onChange={(e) => setF({ ...f, codePhan: e.target.value })} /></Field>
              <Field label="Màu vải"><Input value={f.mauVai} onChange={(e) => setF({ ...f, mauVai: e.target.value })} /></Field>
              <Field label="Kích vải"><Input value={f.kichVai} onChange={(e) => setF({ ...f, kichVai: e.target.value })} /></Field>
              <Field label="Kích phim"><Input value={f.kichPhim} onChange={(e) => setF({ ...f, kichPhim: e.target.value })} /></Field>
              <Field label="Chuyền"><Input value={f.chuyen} onChange={(e) => setF({ ...f, chuyen: e.target.value })} /></Field>
              <Field label="Nhà gia công"><Input value={f.nhaGiaCong} onChange={(e) => setF({ ...f, nhaGiaCong: e.target.value })} /></Field>
              <div className="col-span-2 flex items-end md:col-span-4">
                <Button variant="ghost" onClick={() => setF({ ...F_TRONG, timKiem: f.timKiem, loaiNgay: f.loaiNgay, ngayTu: f.ngayTu, ngayDen: f.ngayDen })}>
                  Xóa lọc trong panel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* `min-h-[10rem]`: lưới an toàn — dù khối đầu có phình thì bảng vẫn luôn thấy được. */}
        <div className="min-h-[10rem] flex-1 overflow-auto rounded-control border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted">
              <tr>
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-ink-soft">STT</th>
                {COT.map((c) => (
                  <th key={c.key} className={`whitespace-nowrap px-2 py-2 text-xs font-semibold text-ink-soft ${c.so ? 'text-right' : 'text-left'}`}>
                    {c.ten}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={COT.length + 1} className="py-10 text-center"><Spinner size={22} /></td></tr>
              )}
              {!loading && !rows.length && (
                <tr><td colSpan={COT.length + 1} className="py-10 text-center text-sm text-ink-soft">Không có dữ liệu</td></tr>
              )}
              {!loading && rows.map((r, i) => (
                <tr key={r.id} className="border-t border-line/70 align-top hover:bg-surface-muted/40">
                  <td className="px-2 py-1.5 text-xs text-ink-soft">{(page - 1) * LIMIT + i + 1}</td>
                  {COT.map((c) => (
                    <td key={c.key} className={`px-2 py-1.5 ${c.so ? 'whitespace-nowrap text-right' : ''}`}>
                      {oCell(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > LIMIT && (
          <div className="shrink-0 pt-2">
            {/* ⚠ Pagination nhận `totalPages` + `onPage` (KHÔNG phải limit/onChange). */}
            <Pagination page={page} total={total} totalPages={Math.ceil(total / LIMIT)} onPage={setPage} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function oCell(r, c) {
  const v = r[c.key];
  if (c.key === 'phuong_an_in') return <PhuongAnInBadge value={v} />;
  if (c.key === 'ma_phan') {
    return (
      <div className="max-w-[13rem] whitespace-normal break-words">
        {v || '—'}
        {Number(r.so_phan_in) > 1 && (
          <Badge tone="info" className="ml-1 whitespace-nowrap">gom set {r.so_phan_in}</Badge>
        )}
      </div>
    );
  }
  if (v == null || v === '') return <span className="text-ink-soft">—</span>;
  if (c.gio) return <span className="whitespace-nowrap text-xs">{gioVN(v)}</span>;
  if (c.ngay) return <span className="whitespace-nowrap text-xs">{fmtDate(v)}</span>;
  if (c.so) return fmtNum(v);
  return <div className="max-w-[13rem] whitespace-normal break-words">{String(v)}</div>;
}

// Mô tả bộ lọc đang bật — đưa vào phụ đề file Excel để biết file lọc theo gì.
function moTaBoLoc(f) {
  const nhan = {
    timKiem: 'Tìm', khach: 'Khách', don: 'Đơn', maHang: 'Mã hàng', codePhan: 'Code phần',
    mauVai: 'Màu vải', kichVai: 'Kích vải', kichPhim: 'Kích phim', chuyen: 'Chuyền',
    nhaGiaCong: 'Nhà gia công',
  };
  const ds = Object.entries(nhan).filter(([k]) => f[k]).map(([k, t]) => `${t}: ${f[k]}`);
  if (f.loaiNgay && (f.ngayTu || f.ngayDen)) {
    const t = (LOAI_NGAY.find((x) => x.ma === f.loaiNgay) || {}).ten || f.loaiNgay;
    ds.push(`${t}: ${f.ngayTu || '…'} → ${f.ngayDen || '…'}`);
  }
  return ds.join(' · ');
}
