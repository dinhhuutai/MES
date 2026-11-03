import { Component, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import Spinner from './Spinner';

// Bọc <Outlet/> của layout: trong lúc tải file JS của trang ⇒ thanh menu vẫn hiện, phần thân là vòng xoay.
// Tải hỏng hẳn (mất mạng, xem `utils/taiLuoi.js`) ⇒ báo + nút tải lại, không để trắng trang. Đổi trang thì tự thử lại.
class BatLoiTaiTrang extends Component {
  constructor(props) {
    super(props);
    this.state = { loi: null };
  }

  static getDerivedStateFromError(loi) {
    return { loi };
  }

  componentDidUpdate(truoc) {
    if (truoc.duongDan !== this.props.duongDan && this.state.loi) this.setState({ loi: null });
  }

  render() {
    if (!this.state.loi) return this.props.children;
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-slate-600">
        <p>Không tải được trang này. Kiểm tra kết nối mạng rồi thử lại.</p>
        <button
          type="button"
          className="rounded-control bg-primary px-4 py-2 font-medium text-white"
          onClick={() => window.location.reload()}
        >
          Tải lại trang
        </button>
      </div>
    );
  }
}

const CHO = (
  <div className="flex justify-center py-16" role="status" aria-label="Đang tải trang">
    <Spinner size={36} />
  </div>
);

export default function KhungTaiTrang({ children }) {
  const { pathname } = useLocation();
  return (
    <BatLoiTaiTrang duongDan={pathname}>
      <Suspense fallback={CHO}>{children}</Suspense>
    </BatLoiTaiTrang>
  );
}
