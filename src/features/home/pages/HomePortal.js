import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Icon from '../../../components/common/Icon';
import { MODULES } from '../../../constants/modules';
import { selectAuth } from '../../../store/authSlice';
import usePermissions from '../../../hooks/usePermissions';

export default function HomePortal() {
  const { user } = useSelector(selectAuth);
  const { can } = usePermissions();
  const visibleModules = MODULES.filter((m) => !m.perm || can(m.perm));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">
          Xin chào, {user?.hoTen || user?.tenDangNhap} 👋
        </h1>
        <p className="mt-1 text-sm text-ink-soft">Chọn một module để bắt đầu công việc.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleModules.map((m) => {
          const target = m.children?.[0]?.route || m.base;
          return (
            <Link
              key={m.ma}
              to={target}
              className="card group p-6 transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-control ${m.mau}`}>
                <Icon name={m.icon} size={24} />
              </div>
              <div className="text-base font-semibold text-ink group-hover:text-primary">{m.ten}</div>
              <div className="mt-1 text-sm text-ink-soft">
                {m.children?.length || 0} màn hình
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
