import { Link } from 'react-router-dom';
import usePermissions from '../hooks/usePermissions';
import Icon from '../components/common/Icon';

// Chặn truy cập theo quyền. anyOf = mảng permission; có 1 quyền là vào được.
export default function RequirePermission({ anyOf = [], children }) {
  const { can } = usePermissions();
  if (anyOf.length > 0 && !can(...anyOf)) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-card bg-rose-50 text-danger">
          <Icon name="shield-check" size={26} />
        </div>
        <div className="text-base font-semibold text-ink">Không có quyền truy cập</div>
        <div className="text-sm text-ink-soft">Bạn không được cấp quyền cho chức năng này.</div>
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          ← Về trang chủ
        </Link>
      </div>
    );
  }
  return children;
}
