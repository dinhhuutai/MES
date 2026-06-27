import {
  Package,
  Wrench,
  CalendarDays,
  Factory,
  ShieldCheck,
  Truck,
  LayoutDashboard,
  FileBarChart,
  Settings,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Search,
  User,
  ChevronRight,
  Bell,
  Circle,
  Loader2,
} from 'lucide-react';

// Map tên kebab → component Lucide.
const MAP = {
  package: Package,
  wrench: Wrench,
  'calendar-days': CalendarDays,
  factory: Factory,
  'shield-check': ShieldCheck,
  truck: Truck,
  'layout-dashboard': LayoutDashboard,
  'file-bar-chart': FileBarChart,
  settings: Settings,
  menu: Menu,
  'panel-left-close': PanelLeftClose,
  'panel-left-open': PanelLeftOpen,
  'log-out': LogOut,
  search: Search,
  user: User,
  'chevron-right': ChevronRight,
  bell: Bell,
  loader: Loader2,
};

export default function Icon({ name, size = 20, className = '' }) {
  const Cmp = MAP[name] || Circle;
  return <Cmp size={size} className={className} aria-hidden="true" />;
}
