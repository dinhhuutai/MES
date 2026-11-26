import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TheoDoiChuyenPage from '../production/pages/TheoDoiChuyenPage';
import TheoDoiTo from '../production/components/TheoDoiTo';
import { getSanLuongChuyen, getSanLuongTo } from '../../services/congKhaiService';

// ─────────────────────────────────────────────────────────────────────────────
// TRANG CÔNG KHAI `/san-luong` — KHÔNG CẦN ĐĂNG NHẬP (26/11/2026, người dùng: "cái modal Theo dõi chuyền in tôi muốn đường dẫn
//   nó là public, không cần đăng nhập vẫn mở ra trang này được, chỉ cần /san-luong"). Cùng nội dung modal *Theo dõi chuyền in*
//   ở màn Xác nhận chạy (3 chế độ Chuyền đang chạy · Tổng nhà máy · Theo tổ) — dùng lại đúng 2 component, chỉ đổi nguồn dữ
//   liệu sang API công khai (`services/congKhaiService` → backend `modules/congkhai`, chỉ đọc + lọc trường). Route nằm NGOÀI
//   `ProtectedRoute` (App.js). Tự tải lại như modal (10 s / 30 s + socket).
// Chế độ nằm trên URL `?xem=tong|to` (mặc định Chuyền đang chạy) ⇒ mỗi màn TV ghim 1 chế độ được.
// ─────────────────────────────────────────────────────────────────────────────

const CHE_DO = [['chuyen', 'Chuyền đang chạy'], ['tong', 'Tổng nhà máy'], ['to', 'Theo tổ']];

export default function SanLuongPage() {
  const [params, setParams] = useSearchParams();
  const xem = params.get('xem');
  const cheDo = CHE_DO.some(([v]) => v === xem) ? xem : 'chuyen';
  const doiCheDo = (v) => setParams(v === 'chuyen' ? {} : { xem: v }, { replace: true });
  // Khe ở thanh đầu trang — 2 component đặt chip khu / ô ngày / chip tổ vào đây (portal), như tiêu đề modal.
  const [khe, setKhe] = useState(null);

  useEffect(() => {
    const cu = document.title;
    document.title = 'Theo dõi chuyền in — THLA';
    return () => { document.title = cu; };
  }, []);

  return (
    <div className="min-h-screen bg-background px-3 py-3 sm:px-5">
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line bg-surface px-4 py-3 shadow-sm">
        <h1 className="whitespace-nowrap text-lg font-bold text-ink">Theo dõi chuyền in</h1>
        <span className="inline-flex rounded-full border border-line bg-surface-muted p-0.5 text-sm font-medium" role="tablist" aria-label="Chế độ xem">
          {CHE_DO.map(([v, ten]) => (
            <button key={v} type="button" role="tab" aria-selected={cheDo === v} onClick={() => doiCheDo(v)}
              className={`rounded-full px-3 py-1 ${cheDo === v ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'}`}>
              {ten}
            </button>
          ))}
        </span>
        <span ref={setKhe} className="flex min-w-0 flex-wrap items-center gap-2" />
      </header>
      {cheDo === 'chuyen'
        ? <TheoDoiChuyenPage khe={khe} taiDuLieu={getSanLuongChuyen} />
        : <TheoDoiTo cheDo={cheDo} onCheDo={doiCheDo} khe={khe} taiDuLieu={getSanLuongTo} />}
    </div>
  );
}
