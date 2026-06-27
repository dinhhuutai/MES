import { Outlet } from 'react-router-dom';
import Topbar from './Topbar';

// Layout cho Home Portal (toàn chiều rộng, không sidebar).
export default function PortalLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <Topbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
