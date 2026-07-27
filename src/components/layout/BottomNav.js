import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../common/Icon';
import Toast from '../common/Toast';
import QrScanner from '../common/QrScanner';
import useToast from '../../hooks/useToast';
import { resolveScan } from '../../services/dashboardService';

// Thanh điều hướng dưới (chỉ hiện trên mobile/PWA): Trang chủ · nút QUÉT (nhô lên giữa) · Thông tin cá nhân.
// Nút quét: quét QR code phần / tem → Sơ đồ phần in; barcode HSKT → danh sách phần in trong HSKT.
export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { toast, show } = useToast();
  const [scanOpen, setScanOpen] = useState(false);

  const isHome = pathname === '/';
  const isProfile = pathname === '/thong-tin-ca-nhan';

  const onScan = async (code) => {
    setScanOpen(false);
    const c = String(code || '').trim();
    if (!c) return;
    try {
      const res = await resolveScan(c);
      const d = res.data || {};
      if (d.type === 'HSKT') {
        navigate(`/ky-thuat/ho-so-ky-thuat?bc=${encodeURIComponent(d.barcode_hskt)}`);
      } else if (d.type === 'PHAN_IN') {
        navigate(`/dashboard/tinh-trang-tram?q=${encodeURIComponent(d.ma_phan)}`);
      } else {
        show('Không nhận ra mã (code phần / tem / barcode đợt vải / HSKT)', 'error');
      }
    } catch (e) {
      show(e.message || 'Lỗi giải mã', 'error');
    }
  };

  const Item = ({ active, icon, label, onClick }) => (
    <button onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${active ? 'text-primary' : 'text-ink-soft'}`}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </button>
  );

  return (
    <>
      {/* Chỉ hiện ở màn nhỏ (mobile/PWA); desktop dùng sidebar. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,.06)] lg:hidden">
        <Item active={isHome} icon="layout-dashboard" label="Trang chủ" onClick={() => navigate('/')} />
        {/* Nút quét nhô lên giữa */}
        <div className="relative flex w-20 shrink-0 items-start justify-center">
          <button onClick={() => setScanOpen(true)} aria-label="Quét mã"
            className="absolute -top-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-4 ring-surface active:scale-95">
            <Icon name="scan-line" size={28} />
          </button>
          <span className="mt-11 text-[11px] font-medium text-ink-soft">Quét</span>
        </div>
        <Item active={isProfile} icon="user" label="Cá nhân" onClick={() => navigate('/thong-tin-ca-nhan')} />
      </nav>

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={onScan}
        title="Quét QR code phần / tem / barcode HSKT" />
      <Toast toast={toast} />
    </>
  );
}
