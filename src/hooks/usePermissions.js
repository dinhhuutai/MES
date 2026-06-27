import { useSelector } from 'react-redux';
import { selectPermissions } from '../store/authSlice';

// Hook kiểm tra quyền. ADMIN có '*' → can() luôn true.
export default function usePermissions() {
  const perms = useSelector(selectPermissions);
  const can = (...required) => {
    if (perms.includes('*')) return true;
    if (!required || required.length === 0) return true;
    return required.some((p) => perms.includes(p));
  };
  return { permissions: perms, can };
}
