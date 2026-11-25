// CODE PHẦN + BADGE CÔNG ĐOẠN Ở DÒNG DƯỚI (14/11/2026, người dùng chốt: "1 phần in có nhiều công đoạn thì đánh dấu badge
// của công đoạn đó ở dưới code phần ở các màn hình liên quan"). Dùng chung mọi màn có dòng theo công đoạn (READY · QC READY ·
// Release 1 · Kế hoạch tạm · Gom đợt vải · Test Run · Release 2 · Chờ chạy · Lập lại KH · Gia công · KCS/Sửa/OQC/Giao…).
//   · `luong` = `phan_in.luong_sx`, `gd` = `giai_doan` của dòng / lệnh. Phần in 1 công đoạn ⇒ không có badge
//     (trừ `hienLogo`: phần in chỉ Ép/Logo / chỉ In kiếng cũng hiện badge).
//   · `caCongDoan` (18/11/2026 — READY · QC READY): dòng mức ĐỢT trước Release 1. Đợt của phần in In + Logo (DSP Logo — ERP
//     gửi 1 lần) mang CẢ 2 công đoạn ⇒ vẽ "In + Logo" (`CongDoanPhanInBadges`, `paEp` = BE `pa_cd_ep`); kiếng ủi mỗi đợt 1
//     công đoạn ⇒ vẫn 1 badge theo `gd`. `caHaiDot` (25/11/2026, mig 139) = cờ BE `ca_hai_cong_doan` của dòng — đợt đánh dấu
//     "Cả 2" (kể cả kiếng ủi) / đợt In + Logo đánh dấu 1 công đoạn; không truyền ⇒ luật theo luồng như trên.
//   · Dòng công đoạn Ép/Logo có dấu "↳" trước mã (nối với dòng in ở trên).
//   · `children` = các badge / ghi chú khác của ô (gom set, trả về…) — đặt dưới badge công đoạn.
//   · `muiTen={false}` khi màn đã có dấu "↳" riêng (vd cột STT của Release 1).
import CongDoanBadge, { CongDoanPhanInBadges } from './CongDoanBadge';
import { chuanGd, GD_EP, laHaiCongDoan, dotCaHaiCongDoan } from '../../utils/luongSanXuat';

// `pa` = phương án in của dòng (`r.phuong_an_in`) ⇒ badge công đoạn ép ghi "Ép" (4) hay "Logo" (`CongDoanBadge`).
export default function CodePhanCongDoan({
  ma, luong, gd, pa, hienLogo = false, caCongDoan = false, caHaiDot, paEp, epTruoc = false, muiTen = true, children, className = '',
}) {
  const ep = muiTen && laHaiCongDoan(luong) && chuanGd(gd) === GD_EP;
  const caHai = caCongDoan && dotCaHaiCongDoan(luong, caHaiDot) && chuanGd(gd) !== GD_EP;
  return (
    <div className={`flex flex-col items-start gap-0.5 ${className}`}>
      <span>{ep && <span className="mr-1 text-orange-500" title="Công đoạn Logo / Ép của phần in ở dòng trên">↳</span>}{ma || '—'}</span>
      {caHai ? (
        <CongDoanPhanInBadges luong={luong} paEp={paEp} epTruoc={epTruoc}
          title="Đợt vải này có 2 công đoạn — READY xác nhận 1 lần cho cả đợt; Release 1 tách 2 dòng, mỗi công đoạn 1 lệnh riêng" />
      ) : (
        <CongDoanBadge luong={luong} gd={gd} pa={pa} hienLogo={hienLogo} />
      )}
      {children}
    </div>
  );
}
