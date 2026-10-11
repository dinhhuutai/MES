import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Spinner from '../../../components/common/Spinner';
import useSocketReload from '../../../hooks/useSocketReload';
import { getBaoCaoSanXuat } from '../../../services/productionService';
import { ngayLocalISO } from '../../../utils/format';
import {
  NHOM_CA, OSo, TieuDe, BangTong, ChonBang, ChonNgay, NhanLoaiCa, hienNgay,
} from '../components/BangBaoCaoSanXuat';
import ChonChuyenNhieu from '../components/ChonChuyenNhieu';
import {
  CHIEU, dsChuyen, locChuyen, gomSanXuat, gomSanXuatTheoNhom, tongSanXuat,
} from '../utils/gomBaoCao';

// ─────────────────────────────────────────────────────────────────────────────
// BÁO CÁO SẢN XUẤT NGÀY (Sản xuất › Báo cáo sản xuất, 02/10/2026)
// 2 bảng từ CÙNG một lượt API (`GET /production/bao-cao-ngay`) ⇒ bấm chuyển bảng là đổi ngay, không tải lại:
//   · "Theo khu chuyền"     : nhóm chuyền MTD · Banin · RB · MT · LG · MEP cả xưởng + dòng Tổng cộng
//                             (07/10/2026 bỏ cột Tổ — trước đó tách theo tổ in).
//   · "Theo khách hàng"     : cùng khuôn, 1 dòng / khách (09/10/2026). Thành phần bảng ở
//                             `components/BangBaoCaoSanXuat.js` (khối trên Dashboard đã gỡ 09/10/2026).
//   · "Theo chuyền"         : 1 dòng / chuyền · "Theo thợ in": 1 dòng / THỢ PHỤ TRÁCH của phiếu (người đầu danh
//                             sách thợ; chuyền Máy lấy chuyền trưởng) — 11/10/2026.
//   · "Chi tiết phần in"    : 1 dòng / (chuyền × phần in × thợ phụ trách).
// BỘ CHỌN CHUYỀN (11/10/2026): chọn 1/nhiều chuyền ⇒ MỌI bảng tính lại trên các chuyền đó. Vì vậy trang tự gom mọi
// bảng từ `chi_tiet` (`utils/gomBaoCao.js`, cùng phép cộng với backend) thay vì đọc `theo_nhom`/`theo_khach` có sẵn.
// Mỗi cột-nhóm (Tổng · HC · CA1 · CA2 · CA3): SL kế hoạch · SL in thực tế · % (= TT / KH) · Số giờ KH ·
// Số giờ TT · C.lệch giờ (= TT − KH). Luật tính ở backend `utils/baoCaoSanXuat.js`.
// Chuyển bảng: viên chọn trượt theo nút + bảng trượt/hiện dần theo hướng bấm (CSS thuần — không kéo
// thêm thư viện hiệu ứng vào bundle, ưu tiên tải nhanh). Ngày hôm nay ⇒ nghe socket tải ngầm.
// ─────────────────────────────────────────────────────────────────────────────

const BANG = [
  // Giữ mã 'TO' (đã nhớ ở localStorage `bcsx.bang`) — bảng nay không còn tách tổ.
  { v: 'TO', label: 'Theo khu chuyền', icon: 'layout' },
  { v: 'CH', label: 'Theo chuyền', icon: 'factory' },
  // 09/10/2026: cùng khuôn bảng khu chuyền nhưng gom theo KHÁCH HÀNG.
  { v: 'KH', label: 'Theo khách hàng', icon: 'users' },
  { v: 'TH', label: 'Theo thợ in', icon: 'user' },
  { v: 'CT', label: 'Chi tiết phần in', icon: 'list' },
];
const THU_TU = { TO: 0, CH: 1, KH: 2, TH: 3, CT: 4 };
const COT_CT = [
  { k: 'ma_chuyen', l: 'Chuyền', w: 'w-[76px] min-w-[76px] max-w-[76px]' },
  { k: 'khach', l: 'Khách hàng', w: 'w-[112px] min-w-[112px] max-w-[112px]' },
  { k: 'po', l: 'PO', w: 'min-w-[120px] max-w-[160px]' },
  { k: 'ma_hang', l: 'Mã hàng', w: 'min-w-[140px] max-w-[200px]' },
  { k: 'mau_vai', l: 'Màu vải', w: 'min-w-[90px] max-w-[130px]' },
  { k: 'kich_vai', l: 'Kích vải', w: 'min-w-[80px]' },
  { k: 'kich_phim', l: 'Kích phim', w: 'min-w-[80px]' },
  // Cả nhóm thợ của các lượt chạy (thợ phụ trách đứng đầu) — chuyền Máy là chuyền trưởng.
  { k: 'tho_ds', l: 'Thợ in', w: 'min-w-[120px] max-w-[220px]' },
];

// Bảng 2 — chi tiết (chuyền × phần in). Ô Chuyền gộp dọc theo các dòng liên tiếp cùng chuyền.
function BangChiTiet({ rows, tong }) {
  const span = useMemo(() => {
    const s = new Array(rows.length).fill(0);
    for (let i = 0; i < rows.length;) {
      let j = i;
      while (j < rows.length && rows[j].ma_chuyen === rows[i].ma_chuyen) j += 1;
      s[i] = j - i;
      i = j;
    }
    return s;
  }, [rows]);
  const cotTrai = COT_CT.map((c, i) => ({
    ...c, dinh: i === 0 ? 'left-0' : i === 1 ? 'left-[76px]' : '',
  }));
  return (
    <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
      <TieuDe cotTrai={cotTrai} />
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.ma_chuyen}|${r.ma_phan}|${i}`}>
            {span[i] > 0 && (
              <td rowSpan={span[i]} title={r.ten_chuyen || r.ma_chuyen}
                className="sticky left-0 z-10 border-b border-line bg-surface px-2 align-middle font-semibold text-ink">
                {r.ma_chuyen}
              </td>
            )}
            <td className="sticky left-[76px] z-10 max-w-[112px] truncate border-b border-line/60 bg-surface px-2 py-1.5 text-ink" title={r.khach || ''}>{r.khach || '—'}</td>
            {COT_CT.slice(2).map((c) => (
              <td key={c.k} title={r[c.k] || ''} className={`truncate border-b border-line/60 px-2 py-1.5 text-ink ${c.w}`}>
                {r[c.k] || '—'}
              </td>
            ))}
            {NHOM_CA.map((c) => <OSo key={c.k} m={r.m[c.k]} nhom={c.k} />)}
          </tr>
        ))}
        {rows.length > 1 && (
          <tr>
            <td colSpan={COT_CT.length} className="sticky left-0 z-10 border-t-2 border-line bg-surface-muted px-2 py-2 font-bold text-ink">Tổng cộng</td>
            {NHOM_CA.map((n) => <OSo key={n.k} m={tong[n.k]} nhom={n.k} dam />)}
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default function BaoCaoSanXuatPage() {
  const homNay = ngayLocalISO(new Date());
  const [ngay, setNgay] = useState(homNay);
  const [bang, setBang] = useState(() => {
    try { const v = localStorage.getItem('bcsx.bang'); return THU_TU[v] != null ? v : 'TO'; } catch { return 'TO'; }
  });
  const [huong, setHuong] = useState('phai');
  const [chuyenChon, setChuyenChon] = useState([]);   // mã chuyền đang chọn — rỗng = mọi chuyền
  const [data, setData] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState('');
  const yeuCau = useRef(0);

  // `ngam` = tải lại nền (socket / đổi ngày khi đã có dữ liệu): giữ bảng cũ, chỉ hiện vạch mảnh.
  const tai = useCallback(async (ngayTai, ngam = false) => {
    const lan = ++yeuCau.current;
    if (!ngam) setLoi('');
    setDangTai(true);
    try {
      const res = await getBaoCaoSanXuat(ngayTai);
      if (lan === yeuCau.current) setData(res.data);
    } catch (e) {
      if (lan === yeuCau.current && !ngam) setLoi(e.message || 'Không tải được báo cáo');
    } finally {
      if (lan === yeuCau.current) setDangTai(false);
    }
  }, []);

  useEffect(() => { tai(ngay); }, [ngay, tai]);
  const laHomNay = ngay === homNay;
  useSocketReload(['production:updated', 'dashboard:refresh'], () => { if (laHomNay) tai(ngay, true); }, 1200);

  const chonBang = (v) => {
    if (v === bang) return;
    setHuong(THU_TU[v] > THU_TU[bang] ? 'phai' : 'trai');
    setBang(v);
    try { localStorage.setItem('bcsx.bang', v); } catch { /* bỏ qua */ }
  };

  // Đổi ngày: GIỮ bảng cũ (mờ đi) tới khi số ngày mới về — không nháy spinner (API có cache, thường <0,2s).
  const dangXem = data;
  const cuNgay = !!data && data.ngay !== ngay;
  const rong = dangXem && !cuNgay && !dangXem.chi_tiet.length;
  // Mọi bảng gom từ dòng chi tiết của các chuyền ĐANG CHỌN (không chọn = cả xưởng).
  const chuyens = useMemo(() => dsChuyen(dangXem ? dangXem.chi_tiet : []), [dangXem]);
  const chonHopLe = useMemo(() => chuyenChon.filter((ma) => chuyens.some((c) => c.ma === ma)), [chuyenChon, chuyens]);
  const rows = useMemo(() => locChuyen(dangXem ? dangXem.chi_tiet : [], chonHopLe), [dangXem, chonHopLe]);
  const tong = useMemo(() => tongSanXuat(rows), [rows]);
  const bangGom = useMemo(() => ({
    TO: gomSanXuatTheoNhom(rows),
    CH: gomSanXuat(rows, CHIEU.CH.khoa),
    KH: gomSanXuat(rows, CHIEU.KH.khoa),
    TH: gomSanXuat(rows, CHIEU.TH.khoa),
  }), [rows]);

  return (
    <div>
      <Toolbar title="Báo cáo sản xuất">
        <ChonBang ds={BANG} value={bang} onChange={chonBang} />
        <ChonChuyenNhieu ds={chuyens} value={chonHopLe} onChange={setChuyenChon} />
        <ChonNgay ngay={ngay} setNgay={setNgay} homNay={homNay} />
        {!laHomNay && (
          <button type="button" onClick={() => setNgay(homNay)}
            className="h-10 rounded-control px-3 text-sm font-medium text-primary hover:bg-primary-wash">Hôm nay</button>
        )}
      </Toolbar>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span className="font-semibold text-ink">BÁO CÁO SẢN XUẤT NGÀY {hienNgay(ngay)}</span>
        {/* Mig 112: loại ca chung + loại chuyền cài ca RIÊNG khác ca chung của tuần. */}
        {dangXem && !cuNgay && <NhanLoaiCa data={dangXem} />}
        {chonHopLe.length > 0 && (
          <button type="button" onClick={() => setChuyenChon([])}
            className="rounded-full bg-primary-wash px-2 py-0.5 font-medium text-primary hover:text-danger"
            title="Bỏ chọn chuyền — xem cả xưởng">
            Chỉ chuyền: {chonHopLe.join(', ')} ✕
          </button>
        )}
      </div>

      <div className="relative">
        {dangTai && dangXem && (
          <div className="absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden rounded-full bg-primary/10">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        )}
        {!dangXem && dangTai ? (
          <div className="flex justify-center py-20"><Spinner size={32} /></div>
        ) : loi ? (
          <div className="rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loi}</div>
        ) : rong ? (
          <div className="rounded-card border border-dashed border-line py-16 text-center text-sm text-ink-soft">
            Không có chuyền nào in trong ngày {hienNgay(ngay)}.
          </div>
        ) : dangXem ? (
          <div key={bang}
            className={`max-h-[calc(100vh-13.5rem)] overflow-auto rounded-card border border-line bg-surface transition-opacity duration-200 motion-reduce:animate-none ${huong === 'phai' ? 'animate-vao-tu-phai' : 'animate-vao-tu-trai'} ${cuNgay ? 'opacity-50' : ''}`}>
            {bang === 'TO' && <BangTong dong={bangGom.TO} tong={tong} nhan="Khu chuyền" />}
            {bang === 'CH' && <BangTong dong={bangGom.CH} tong={tong} nhan="Chuyền" rongNhan="w-[110px] min-w-[110px] max-w-[110px]" />}
            {bang === 'KH' && <BangTong dong={bangGom.KH} tong={tong} nhan="Khách hàng" rongNhan="w-[150px] min-w-[150px] max-w-[150px]" />}
            {bang === 'TH' && <BangTong dong={bangGom.TH} tong={tong} nhan="Thợ in (phụ trách)" rongNhan="w-[190px] min-w-[190px] max-w-[190px]" />}
            {bang === 'CT' && <BangChiTiet rows={rows} tong={tong} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}
