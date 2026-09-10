import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '@headlessui/react';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import TemGrid, { tenCot } from './TemGrid';
import TemToolbar from './TemToolbar';
import OPanel from './TemOPanel';
import { khoPhieu, tongCaoKhoi } from '../../delivery/utils/renderMauPhieu';
import { htmlXemTruocPhieu, inThuMauPhieu } from '../../delivery/utils/printPhieuGiao';
import {
  themHangNhieu, xoaHangVung, themCotNhieu, xoaCotVung, chiaLaiLuoi,
  gopVung, tachVung, datO, datONhieu, datVienVung, xoaNoiDungO, xoaDinhDangO, layDinhDang,
  datRongCot, datCaoHang, oGoc, oTrongVung, chuanVung, moRongVung, moiODeu,
  tongRongCung, khoaO, tachKhoa, SO_COT_MAX, SO_HANG_MAX,
} from '../utils/temLuoi';

// ─────────────────────────────────────────────────────────────────────────────
// TRÌNH THIẾT KẾ PHIẾU — MODAL TOÀN MÀN HÌNH, cùng khuôn với trình Thiết kế tem.
//
// ⚠⚠ KHÁC TEM Ở 2 ĐIỂM (và chỉ 2 điểm này):
//   1. Bố cục chia 3 KHỐI: `dau` (lưới ô) · `lap` (VÙNG LẶP DÒNG — 2 hàng: tiêu đề + mẫu 1 dòng,
//      được nhân theo số tem lúc in) · `cuoi` (lưới ô). Chọn khối bằng 3 nút ở header.
//   2. Chọn được KHỔ GIẤY / HƯỚNG / LỀ (tem thì khổ cố định).
//   Mọi thứ còn lại — thao tác lưới, thanh công cụ, panel nội dung ô — DÙNG CHUNG với tem
//   (`TemGrid` / `TemToolbar` / `TemOPanel` + `utils/temLuoi`). Đừng chép ra bản thứ hai: sửa luật
//   định dạng một bên rồi quên bên kia là 2 trình thiết kế lệch nhau.
//
// ⚠ Dialog KHÔNG đóng bằng Esc / bấm nền: đang thiết kế dở mà lỡ tay là mất công.
// ─────────────────────────────────────────────────────────────────────────────

const ZOOM_MIN = 2;
const ZOOM_MAX = 8;
const PX_MM = 96 / 25.4;

const KHOI = [
  { ma: 'dau', ten: 'Đầu phiếu', mo_ta: 'Logo, tiêu đề, khách hàng, số phiếu…' },
  { ma: 'lap', ten: 'Vùng lặp dòng', mo_ta: 'Hàng 1 = tiêu đề cột · hàng 2 = mẫu 1 dòng dữ liệu' },
  { ma: 'cuoi', ten: 'Cuối phiếu', mo_ta: 'Tổng cộng, ô ký…' },
];

// DỮ LIỆU MẪU để canh bố cục — KHÔNG đụng dữ liệu thật, KHÔNG tiêu số phiếu nào của ERP.
const PHIEU_MAU = {
  ma_phieu_giao: 'PG0123',
  ngay_giao: new Date().toISOString(),
  created_date: new Date().toISOString(),
  ghi_chu: 'Giao trong ngày, gọi trước khi tới',
  ten_khach_hang: 'CÔNG TY TNHH MAY MẶC ABC',
  ma_don_hang: 'DH-2609-018',
  tems: [
    { ma_tem: '152608057689', nguon: 'KCS', phan_list: 'SL-2609-001-A01-F01-C01', ma_hang: 'SP-1120',
      mau_vai: 'Trắng', kich_vai: '1.6m', kich_phim: '60x90', ma_lenh_san_xuat: 'LSX1902', so_luong_giao: 420 },
    { ma_tem: '172608057712', nguon: 'SUA', la_tem_sua: true, phan_list: 'SL-2609-001-A01-F01-C01', ma_hang: 'SP-1120',
      mau_vai: 'Trắng', kich_vai: '1.6m', kich_phim: '60x90', ma_lenh_san_xuat: 'LSX1902', so_luong_giao: 35 },
    { ma_tem: '152608057903', nguon: 'KCS', phan_list: 'SL-2609-001-A02-F03-C02', ma_hang: 'SP-1121',
      mau_vai: 'Đen', kich_vai: '1.5m', kich_phim: '55x80', ma_lenh_san_xuat: 'LSX1907', so_luong_giao: 260 },
  ],
};

// Dữ liệu mẫu để LƯỚI THIẾT KẾ hiện ra chữ thật thay vì ô trống (khung xem trước dựng từ `PHIEU_MAU`).
// ⚠ 2 phạm vi tách bạch — khối `lap` dùng trường DÒNG, `dau`/`cuoi` dùng trường PHIẾU.
const MAU_O_PHIEU = {
  ma_phieu_giao: 'PG0123', ngay_giao: new Date().toISOString(), ngay_lap: new Date().toISOString(),
  ngay_in: new Date().toISOString(), ghi_chu: 'Giao trong ngày', kieu_in: 'Bản CHI TIẾT theo từng tem',
  ten_khach_hang: 'CÔNG TY TNHH MAY MẶC ABC', ma_don_hang: 'DH-2609-018',
  so_tem: 3, so_dong: 3, tong_sl: 715,
};
const MAU_O_DONG = {
  stt: 1, ma_tem: '152608057689', nguon: 'KCS', phan_list: 'SL-2609-001-A01-F01-C01',
  ma_hang: 'SP-1120', mau_vai: 'Trắng', kich_vai: '1.6m', kich_phim: '60x90',
  kich_vai_phim: '1.6m / 60x90', ma_lenh_san_xuat: 'LSX1902', so_luong_giao: 420,
  so_tem_gop: 2, co_sua: ' *',
};

// Kẹp vùng chọn vào trong lưới hiện tại — sau khi xóa hàng/cột, vùng cũ có thể trỏ ra ngoài.
function kepVung(khung, v) {
  const hMax = khung.hang.length - 1;
  const cMax = khung.so_cot - 1;
  if (v.r1 > hMax || v.c1 > cMax) return null;
  return {
    r1: Math.max(0, Math.min(v.r1, hMax)), r2: Math.max(0, Math.min(v.r2, hMax)),
    c1: Math.max(0, Math.min(v.c1, cMax)), c2: Math.max(0, Math.min(v.c2, cMax)),
  };
}

// Khung rỗng cho khối chưa có (mẫu cũ / mẫu tự tạo).
const khungRongPhieu = (soHang, soCot) => ({
  so_cot: soCot,
  cot: Array.from({ length: soCot }, () => ({ rong_mm: null })),
  hang: Array.from({ length: soHang }, () => ({ cao_mm: 6 })),
  o: {},
});

export default function PhieuDesignerModal({ open, mau, dm, onLuu, onClose }) {
  const [boCuc, setBoCuc] = useState(null);
  const [xemTruoc, setXemTruoc] = useState(false);
  const [htmlXem, setHtmlXem] = useState('');
  const [dangDung, setDangDung] = useState(false);
  const [loiInThu, setLoiInThu] = useState(null);
  const [khoi, setKhoi] = useState('dau');
  const [sel, setSel] = useState(null);
  const [lanChon, setLanChon] = useState(0);
  const [tiLe, setTiLe] = useState(3.2);
  const [luu, setLuu] = useState(false);
  const [dinhDangChep, setDinhDangChep] = useState(null);
  const [hoiDong, setHoiDong] = useState(false);
  const [lichSu, setLichSu] = useState([]);
  const [lamLai, setLamLai] = useState([]);
  const [banDau, setBanDau] = useState('');

  // Nạp lại bố cục mỗi khi mở mẫu khác. Khối thiếu thì dựng khung rỗng để mẫu tự tạo vẫn thiết kế được.
  useEffect(() => {
    if (!mau) { setBoCuc(null); return; }
    const bc = JSON.parse(JSON.stringify(mau.bo_cuc_json || {}));
    bc.v = bc.v || 1;
    bc.kho = bc.kho || 'A4';
    bc.huong = bc.huong || 'doc';
    bc.le = { ...(dm?.le_mac_dinh || { tren: 12, phai: 10, duoi: 12, trai: 10 }), ...(bc.le || {}) };
    if (!bc.dau) bc.dau = khungRongPhieu(4, 12);
    // ⚠ Vùng lặp BẮT BUỘC đúng 2 hàng (backend `kiemBoCucPhieu` chặn) — dựng sẵn đúng dạng.
    if (!bc.lap) bc.lap = khungRongPhieu(2, 6);
    if (!bc.cuoi) bc.cuoi = khungRongPhieu(3, 12);
    setBoCuc(bc); setBanDau(JSON.stringify(bc));
    setKhoi('dau'); setSel(null); setLichSu([]); setLamLai([]); setDinhDangChep(null);
    setXemTruoc(false); setLoiInThu(null);
  }, [mau, dm]);

  // Kiểu in của mẫu này khi in THẬT — lấy từ nút in đang gắn mẫu (chi tiết / gộp).
  const gop = useMemo(() => {
    const vt = (dm?.vi_tri_in || []).find((v) => mau && v.mau_phieu_id === mau.id);
    return vt ? vt.kieu === 'GOP' : false;
  }, [dm, mau]);

  const khung = boCuc ? boCuc[khoi] : null;
  const laLap = khoi === 'lap';
  // Dữ liệu mẫu ĐÚNG PHẠM VI của khối đang mở — để lưới thiết kế hiện chữ thật, khỏi toàn ô trống.
  const dataMau = laLap ? MAU_O_DONG : MAU_O_PHIEU;

  const boCucRef = useRef(null); boCucRef.current = boCuc;
  const lichSuRef = useRef([]); lichSuRef.current = lichSu;
  const lamLaiRef = useRef([]); lamLaiRef.current = lamLai;
  const khoiRef = useRef('dau'); khoiRef.current = khoi;

  // ⚠⚠ ĐỌC TRẠNG THÁI QUA REF, KHÔNG lồng setState trong updater của setState khác (React 18
  //   StrictMode gọi updater 2 LẦN ở dev ⇒ lịch sử ghi đôi, bấm Hoàn tác 1 lần như không tác dụng).
  const capNhat = useCallback((fn) => {
    const truoc = boCucRef.current;
    if (!truoc) return;
    setLichSu((h) => [...h.slice(-49), JSON.stringify(truoc)]);
    setLamLai([]);
    setBoCuc(fn(truoc));
  }, []);

  const datKhung = useCallback((k) => {
    if (!k) return;
    capNhat((b) => ({ ...b, [khoiRef.current]: k }));
  }, [capNhat]);

  const hoanTac = useCallback(() => {
    const h = lichSuRef.current;
    if (!h.length || !boCucRef.current) return;
    setLamLai((r) => [...r, JSON.stringify(boCucRef.current)]);
    setBoCuc(JSON.parse(h[h.length - 1]));
    setLichSu(h.slice(0, -1));
  }, []);

  const lamLaiFn = useCallback(() => {
    const r = lamLaiRef.current;
    if (!r.length || !boCucRef.current) return;
    setLichSu((h) => [...h, JSON.stringify(boCucRef.current)]);
    setBoCuc(JSON.parse(r[r.length - 1]));
    setLamLai(r.slice(0, -1));
  }, []);

  const vung = useMemo(() => {
    if (!khung || !sel) return null;
    const v = kepVung(khung, sel);
    return v ? moRongVung(khung, v) : null;
  }, [khung, sel]);

  const khoas = useMemo(() => (khung && vung ? oTrongVung(khung, vung) : []), [khung, vung]);

  const neo = useMemo(() => {
    if (!khung || !vung) return null;
    const ung = sel?.neo;
    if (ung && khoas.includes(ung)) return ung;
    return oGoc(khung, vung.r1, vung.c1);
  }, [khung, vung, khoas, sel]);

  const oNeo = khung && neo ? (khung.o[neo] || {}) : null;
  const deu = useCallback((dk) => moiODeu(khung || { o: {} }, khoas, dk), [khung, khoas]);

  const chonVung = useCallback((benBam, tu, den, opts) => {
    const b = boCucRef.current;
    const k = b && b[khoiRef.current];
    if (!k) return;
    if (!opts?.giuNeo) setLanChon((n) => n + 1);
    const v = moRongVung(k, chuanVung(tu, den));
    setSel((cu) => ({ ...v, neo: (opts?.giuNeo && cu?.neo) ? cu.neo : oGoc(k, tu.r, tu.c) }));
  }, []);

  const chonHet = useCallback(() => {
    const b = boCucRef.current;
    const k = b && b[khoiRef.current];
    if (!k) return;
    setLanChon((n) => n + 1);
    setSel({ r1: 0, c1: 0, r2: k.hang.length - 1, c2: k.so_cot - 1, neo: '0,0' });
  }, []);

  // ── Kích thước vùng thiết kế của khối đang mở ─────────────────────────────
  const kho = useMemo(() => khoPhieu(boCuc || {}), [boCuc]);
  const caoKhoi = khung ? tongCaoKhoi(khung) : 0;

  // ── Thao tác trên vùng ────────────────────────────────────────────────────
  const apDinhDang = useCallback((thayDoi) => {
    if (!khung || !khoas.length) return;
    datKhung(datONhieu(khung, khoas, thayDoi));
  }, [khung, khoas, datKhung]);

  const apVien = (kieu) => { if (khung && vung) datKhung(datVienVung(khung, vung, kieu)); };

  const doGop = () => {
    if (!khung || !vung) return;
    datKhung(gopVung(khung, vung));
    setSel({ ...vung, neo: khoaO(vung.r1, vung.c1) });
  };
  const doTach = () => { if (khung && vung) datKhung(tachVung(khung, vung)); };

  // ⚠⚠ VÙNG LẶP KHÓA SỐ HÀNG = 2: hàng 0 là tiêu đề (lặp mỗi trang), hàng 1 là MẪU được nhân ra.
  //   Thêm/xóa hàng ở đó thì backend `kiemBoCucPhieu` chặn lúc lưu — chặn ngay ở nút cho khỏi mất công.
  const doThemHang = (phia) => {
    if (!khung || !vung || laLap) return;
    const n = vung.r2 - vung.r1 + 1;
    datKhung(themHangNhieu(khung, phia === 'tren' ? vung.r1 : vung.r2 + 1, n));
  };
  const doXoaHang = () => {
    if (!khung || !vung || laLap) return;
    datKhung(xoaHangVung(khung, vung.r1, vung.r2));
    setSel(null);
  };
  const doThemCot = (phia) => {
    if (!khung || !vung) return;
    const n = vung.c2 - vung.c1 + 1;
    datKhung(themCotNhieu(khung, phia === 'trai' ? vung.c1 : vung.c2 + 1, n));
  };
  const doXoaCot = () => {
    if (!khung || !vung) return;
    datKhung(xoaCotVung(khung, vung.c1, vung.c2));
    setSel(null);
  };

  const doXoaNoiDung = useCallback(() => {
    if (khung && khoas.length) datKhung(xoaNoiDungO(khung, khoas));
  }, [khung, khoas, datKhung]);

  // Danh mục TRƯỜNG theo PHẠM VI của khối đang mở — vùng lặp dùng trường DÒNG, đầu/cuối dùng trường
  // PHIẾU. Đặt nhầm phạm vi thì ô in ra RỖNG, nên chỉ bày đúng nhóm được phép.
  const dmKhoi = useMemo(() => ({
    truong: laLap ? (dm?.truong_dong || []) : (dm?.truong || []),
    dinh_dang_ngay: dm?.dinh_dang_ngay || [],
  }), [dm, laLap]);

  const doChenTruong = (ma) => {
    if (!khung || !neo) return;
    const t = (dmKhoi.truong || []).find((x) => x.ma === ma);
    const phan = Array.isArray(oNeo?.phan) ? oNeo.phan : [];
    // ⚠ `kieu` LƯU THẲNG vào mảnh trường ⇒ bộ render tự đủ, không phải tra danh mục lúc in.
    datKhung(datO(khung, neo, {
      phan: [...phan, {
        loai: 'truong', ma, kieu: t?.kieu || 'chu',
        ...(t?.kieu === 'ngay' ? { dinh_dang: 'DD/MM/YYYY' } : {}),
      }],
    }));
  };

  const doDoiKieuO = (kieu) => { if (khung && khoas.length && !laLap) datKhung(datONhieu(khung, khoas, { kieu })); };

  const [hoiChiaLai, setHoiChiaLai] = useState(null);
  const xinChiaLaiLuoi = (h, c) => {
    if (!khung) return;
    // Vùng lặp luôn 2 hàng — chỉ cho đổi SỐ CỘT.
    const soHang = laLap ? 2 : h;
    const mat = Object.keys(khung.o || {}).filter((k) => {
      const [r, cc] = tachKhoa(k);
      return r >= soHang || cc >= c;
    }).length;
    if (!mat) { datKhung(chiaLaiLuoi(khung, soHang, c)); setSel(null); return; }
    setHoiChiaLai({ h: soHang, c, mat });
  };

  const doDoiRongCot = useCallback((c, mm) => {
    capNhat((x) => ({ ...x, [khoiRef.current]: datRongCot(x[khoiRef.current], c, mm, khoPhieu(x).rong) }));
  }, [capNhat]);

  const doDoiCaoHang = useCallback((r, mm) => {
    capNhat((x) => ({ ...x, [khoiRef.current]: datCaoHang(x[khoiRef.current], r, mm, khoPhieu(x).cao) }));
  }, [capNhat]);

  const doiGiay = (thayDoi) => capNhat((b) => ({ ...b, ...thayDoi }));
  const doiLe = (canh, mm) => capNhat((b) => ({ ...b, le: { ...b.le, [canh]: Math.max(0, Number(mm) || 0) } }));

  // ── Phím tắt (giống trình Thiết kế tem — xem ghi chú ở TemDesignerModal) ───
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (xemTruoc) return;
      const t = e.target || {};
      const tag = (t.tagName || '').toUpperCase();
      const oNhapTrong = tag === 'INPUT' && t.dataset && t.dataset.oNhap === '1' && !t.value;
      if (!oNhapTrong
        && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable)) return;
      const k = (e.key || '').toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); hoanTac(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); lamLaiFn(); }
        else if (k === 'a') { e.preventDefault(); chonHet(); }
        return;
      }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); doXoaNoiDung(); return; }
      const buoc = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] }[k];
      if (buoc && khung && sel) {
        e.preventDefault();
        const [nr, nc] = tachKhoa(neo || '0,0');
        if (e.shiftKey) {
          const r = Math.max(0, Math.min(khung.hang.length - 1, (buoc[0] < 0 ? sel.r1 : sel.r2) + buoc[0]));
          const c = Math.max(0, Math.min(khung.so_cot - 1, (buoc[1] < 0 ? sel.c1 : sel.c2) + buoc[1]));
          chonVung(khoi, { r: nr, c: nc }, { r, c }, { giuNeo: true });
        } else {
          const r = Math.max(0, Math.min(khung.hang.length - 1, nr + buoc[0]));
          const c = Math.max(0, Math.min(khung.so_cot - 1, nc + buoc[1]));
          chonVung(khoi, { r, c }, { r, c });
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, xemTruoc, hoanTac, lamLaiFn, chonHet, doXoaNoiDung, chonVung, khoi, khung, sel, neo]);

  // ── Xem trước: dựng bằng CHÍNH đường in thật ──────────────────────────────
  useEffect(() => {
    if (!xemTruoc || !boCuc) return undefined;
    let huy = false;
    setDangDung(true);
    htmlXemTruocPhieu(boCuc, PHIEU_MAU, gop)
      .then((h) => { if (!huy) setHtmlXem(h); })
      .catch((e) => { if (!huy) setLoiInThu(e.message || 'Không dựng được bản xem trước'); })
      .finally(() => { if (!huy) setDangDung(false); });
    return () => { huy = true; };
  }, [xemTruoc, boCuc, gop]);

  const doInThu = async () => {
    try { setLoiInThu(null); await inThuMauPhieu(boCuc, PHIEU_MAU, gop); }
    catch (e) { setLoiInThu(e.message || 'Không mở được cửa sổ in'); }
  };

  const chuaLuu = !!boCuc && JSON.stringify(boCuc) !== banDau;

  const doLuu = async () => {
    setLuu(true);
    const ok = await onLuu(boCuc);
    if (ok) setBanDau(JSON.stringify(boCuc));
    setLuu(false);
  };

  const dong = () => { if (chuaLuu) setHoiDong(true); else onClose(); };

  if (!open || !mau || !boCuc || !khung) return null;

  const rongCung = tongRongCung(khung);
  const traoRong = rongCung > kho.rong + 0.01;

  return (
    <>
      {/* onClose rỗng: KHÔNG cho Esc / bấm nền đóng — xem ghi chú đầu file */}
      <Dialog open={open} onClose={() => {}} className="relative z-50">
        <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        <div className="fixed inset-0">
          <Dialog.Panel className="flex h-full w-full flex-col bg-surface">
            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
              <Icon name="layout" size={18} className="text-primary" />
              <div className="min-w-0">
                <Dialog.Title className="truncate text-sm font-semibold text-ink">
                  {mau.ten_mau}
                  {chuaLuu && <span className="ml-2 text-xs font-normal text-warning">• chưa lưu</span>}
                </Dialog.Title>
                <p className="text-[11px] text-ink-soft">
                  {boCuc.kho} {boCuc.huong === 'ngang' ? 'ngang' : 'dọc'} · tờ {kho.rongGiay}×{kho.caoGiay}mm
                  {' '}· vùng nội dung {kho.rong}×{kho.cao}mm
                </p>
              </div>

              <div className="ml-2 flex overflow-hidden rounded-control border border-line">
                {[['Thiết kế', false, 'layout'], ['Xem trước', true, 'eye']].map(([ten, gt, ic]) => (
                  <button key={ten} type="button" onClick={() => setXemTruoc(gt)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${
                      xemTruoc === gt ? 'bg-primary text-white' : 'bg-surface text-ink-soft hover:text-ink'}`}>
                    <Icon name={ic} size={13} />{ten}
                  </button>
                ))}
              </div>

              {!xemTruoc && (
                <div className="flex overflow-hidden rounded-control border border-line">
                  {KHOI.map((k) => (
                    <button key={k.ma} type="button" title={k.mo_ta}
                      onClick={() => { setKhoi(k.ma); setSel(null); }}
                      className={`px-3 py-1.5 text-xs font-medium ${
                        khoi === k.ma ? 'bg-primary-wash text-primary' : 'bg-surface text-ink-soft hover:text-ink'}`}>
                      {k.ten}
                    </button>
                  ))}
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                <Button onClick={doLuu} loading={luu} icon="save" disabled={!chuaLuu}>Lưu mẫu</Button>
                <Button chiXemOk variant="ghost" icon="x" onClick={dong}>Đóng</Button>
              </div>
            </div>

            {/* ── KHỔ GIẤY / LỀ ──────────────────────────────────────────── */}
            {!xemTruoc && (
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface-muted/60 px-4 py-1.5 text-[11px] text-ink-soft">
                <span className="font-medium text-ink">Khổ giấy</span>
                <select value={boCuc.kho} onChange={(e) => doiGiay({ kho: e.target.value })}
                  className="h-7 rounded-control border border-line bg-surface px-1.5 text-base md:text-xs">
                  {(dm?.kho_giay || []).map((k) => <option key={k.ma} value={k.ma}>{k.ten}</option>)}
                </select>
                <select value={boCuc.huong} onChange={(e) => doiGiay({ huong: e.target.value })}
                  className="h-7 rounded-control border border-line bg-surface px-1.5 text-base md:text-xs">
                  {(dm?.huong || []).map((h) => <option key={h.ma} value={h.ma}>{h.ten}</option>)}
                </select>
                <span className="ml-2 font-medium text-ink">Lề (mm)</span>
                {[['tren', 'Trên'], ['phai', 'Phải'], ['duoi', 'Dưới'], ['trai', 'Trái']].map(([c, ten]) => (
                  <label key={c} className="flex items-center gap-1">
                    {ten}
                    <input type="number" min="0" max="40" value={boCuc.le[c]}
                      onChange={(e) => doiLe(c, e.target.value)}
                      className="h-7 w-14 rounded-control border border-line bg-surface px-1.5 text-base md:text-xs" />
                  </label>
                ))}
                <span className="ml-auto">{KHOI.find((k) => k.ma === khoi)?.mo_ta}</span>
              </div>
            )}

            {/* ── THANH CÔNG CỤ ──────────────────────────────────────────── */}
            <div className={`shrink-0 ${xemTruoc ? 'hidden' : ''}`}>
              <TemToolbar
                dm={dmKhoi} khung={khung} vung={vung} khoas={khoas} oNeo={oNeo} deu={deu}
                rongVungMm={kho.rong} caoVungMm={kho.cao}
                // Vùng lặp dòng chưa hỗ trợ ô QR/mã vạch (mỗi dòng cần ảnh riêng) — ẩn hẳn nút.
                choPhepMa={!laLap}
                onDinhDang={apDinhDang} onVien={apVien} onGop={doGop} onTach={doTach}
                onThemHang={doThemHang} onXoaHang={doXoaHang} onThemCot={doThemCot} onXoaCot={doXoaCot}
                onXoaNoiDung={doXoaNoiDung}
                onXoaDinhDang={() => khung && khoas.length && datKhung(xoaDinhDangO(khung, khoas))}
                onChepDinhDang={() => setDinhDangChep(layDinhDang(oNeo || {}))}
                onDanDinhDang={() => dinhDangChep && apDinhDang(dinhDangChep)}
                daChepDinhDang={!!dinhDangChep}
                onHoanTac={hoanTac} onLamLai={lamLaiFn}
                coHoanTac={!!lichSu.length} coLamLai={!!lamLai.length}
                onChenTruong={doChenTruong} onDoiKieuO={doDoiKieuO} onChiaLaiLuoi={xinChiaLaiLuoi}
                tiLe={tiLe * 2.5}
                onZoom={(d) => setTiLe((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + d * 0.4)))}
              />
            </div>

            {/* ── THÂN ───────────────────────────────────────────────────── */}
            {xemTruoc ? (
              <div className="min-h-0 flex-1 overflow-auto bg-surface-muted p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-soft">
                    Tờ {boCuc.kho} {boCuc.huong === 'ngang' ? 'ngang' : 'dọc'} — đúng những gì máy in nhận.
                    Dữ liệu là <b>phiếu mẫu</b> (3 dòng) để canh bố cục.
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" title="Thu nhỏ" disabled={tiLe <= ZOOM_MIN}
                      className="rounded-control border border-line p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                      onClick={() => setTiLe((z) => Math.max(ZOOM_MIN, z - 0.4))}><Icon name="zoom-out" size={14} /></button>
                    <span className="w-12 text-center text-xs text-ink-soft">{Math.round((tiLe / PX_MM) * 100)}%</span>
                    <button type="button" title="Phóng to" disabled={tiLe >= ZOOM_MAX}
                      className="rounded-control border border-line p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                      onClick={() => setTiLe((z) => Math.min(ZOOM_MAX, z + 0.4))}><Icon name="zoom-in" size={14} /></button>
                    <Button chiXemOk variant="secondary" icon="printer" onClick={doInThu} className="ml-1 px-3 py-1.5">In thử</Button>
                  </div>
                </div>
                {loiInThu && (
                  <div className="mb-3 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
                    {loiInThu}
                  </div>
                )}
                {/* ⚠ <iframe srcDoc> chứ KHÔNG nhúng thẳng: CSS của app (Tailwind preflight) sẽ đè lên
                    bố cục phiếu ⇒ xem một kiểu in một kiểu — đúng thứ màn này sinh ra để tránh. */}
                <div className="relative inline-block bg-white shadow-sm ring-1 ring-line"
                  style={{ width: kho.rongGiay * tiLe, height: kho.caoGiay * tiLe }}>
                  {dangDung && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70"><Spinner size={24} /></div>
                  )}
                  <iframe title="Xem trước phiếu" srcDoc={htmlXem} scrolling="no"
                    style={{
                      width: `${kho.rongGiay}mm`, height: `${kho.caoGiay}mm`, border: 0,
                      transform: `scale(${tiLe / PX_MM})`, transformOrigin: 'top left',
                    }} />
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1">
                <div className="flex-1 overflow-auto bg-surface-muted p-5">
                  <div className="inline-block rounded-card bg-white p-2 ring-2 ring-primary">
                    <TemGrid
                      ben={khoi}
                      nhan={KHOI.find((k) => k.ma === khoi)?.ten}
                      khung={khung} data={dataMau} tiLe={tiLe}
                      rongVungMm={kho.rong} caoVungMm={Math.max(10, caoKhoi)}
                      vung={vung} neo={neo} dangSua
                      onChon={chonVung} onChonHet={chonHet}
                      onDoiRongCot={doDoiRongCot} onDoiCaoHang={doDoiCaoHang}
                    />
                  </div>
                  <p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-ink-soft">
                    {laLap ? (
                      <>
                        <b>Vùng lặp dòng</b>: hàng <b>1</b> là tiêu đề cột (tự lặp lại ở mỗi trang khi phiếu
                        dài), hàng <b>2</b> là mẫu của MỘT dòng dữ liệu — lúc in sẽ nhân ra theo số tem.
                        Vì vậy khối này <b>luôn 2 hàng</b> và không gộp ô theo chiều dọc được.
                      </>
                    ) : (
                      <>Bấm 1 ô là <b>gõ nội dung được ngay</b> · kéo chuột để chọn nhiều ô · Shift+bấm để nới
                        vùng · kéo mép header để đổi bề rộng cột / chiều cao hàng · <b>Delete</b> xóa nội dung,
                        <b> Ctrl+Z</b> hoàn tác.</>
                    )}
                  </p>
                </div>

                <aside className="w-[21rem] shrink-0 overflow-y-auto border-l border-line p-3">
                  {neo ? (
                    <OPanel
                      khoa={neo} o={oNeo} dm={dmKhoi} vung={vung} soO={khoas.length} tinHieuChon={lanChon}
                      data={dataMau}
                      hang={khung.hang[tachKhoa(neo)[0]]}
                      cot={(khung.cot || [])[tachKhoa(neo)[1]]}
                      onDoiO={(v) => datKhung(datO(khung, neo, v))}
                      onDoiHang={(mm) => doDoiCaoHang(tachKhoa(neo)[0], mm)}
                      onDoiCot={(mm) => doDoiRongCot(tachKhoa(neo)[1], mm)}
                    />
                  ) : (
                    <div className="rounded-control border border-dashed border-line p-4 text-center text-sm text-ink-soft">
                      Bấm (hoặc kéo chọn) trên lưới để sửa ô.
                    </div>
                  )}
                </aside>
              </div>
            )}

            {/* ── THANH TRẠNG THÁI ───────────────────────────────────────── */}
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line px-4 py-1.5 text-[11px] text-ink-soft">
              <span>
                {xemTruoc ? `Xem trước — kiểu in ${gop ? 'GỘP' : 'CHI TIẾT'}`
                  : (vung
                    ? `Đang chọn ${tenCot(vung.c1)}${vung.r1 + 1}${khoas.length > 1 ? `:${tenCot(vung.c2)}${vung.r2 + 1} (${khoas.length} ô)` : ''}`
                    : 'Chưa chọn ô nào')}
              </span>
              <span>·</span>
              <span>{KHOI.find((k) => k.ma === khoi)?.ten}: {khung.hang.length}/{SO_HANG_MAX} hàng × {khung.so_cot}/{SO_COT_MAX} cột</span>
              <span>·</span>
              <span className={traoRong ? 'font-semibold text-danger' : ''}>
                Bề rộng đặt cứng {rongCung.toFixed(1)}/{kho.rong}mm
              </span>
              <span>· Cao khối {caoKhoi.toFixed(1)}mm</span>
              {traoRong && <Badge tone="danger">Vượt bề ngang trang — bản in sẽ bị cắt</Badge>}
              <span className="ml-auto">{lichSu.length} bước có thể hoàn tác</span>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!hoiChiaLai} onClose={() => setHoiChiaLai(null)}
        onConfirm={() => {
          datKhung(chiaLaiLuoi(khung, hoiChiaLai.h, hoiChiaLai.c));
          setSel(null); setHoiChiaLai(null);
        }}
        title="Chia lại lưới?" variant="danger" confirmText="Chia lại"
        message={hoiChiaLai
          ? `Chia lại thành ${hoiChiaLai.h} hàng × ${hoiChiaLai.c} cột. ${hoiChiaLai.mat} ô nằm ngoài `
            + 'lưới mới sẽ bị xóa, ô gộp tràn ra ngoài sẽ co lại. Bấm Ctrl+Z để hoàn tác nếu không ưng.'
          : ''}
      />

      <ConfirmDialog
        open={hoiDong} onClose={() => setHoiDong(false)}
        onConfirm={() => { setHoiDong(false); onClose(); }}
        title="Đóng mà không lưu?" variant="danger" confirmText="Đóng, bỏ thay đổi"
        message="Bố cục đang có thay đổi chưa lưu. Đóng bây giờ sẽ mất các thay đổi đó."
      />
    </>
  );
}
