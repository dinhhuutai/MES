import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import useSocketEvent from '../../../hooks/useSocketEvent';
import { getSummary, getActivity } from '../../../services/dashboardService';
import { fmtNum } from '../../../utils/format';

const TEM_STAGES = [
  { key: 'IN', label: 'Chờ phơi', color: '#f59e0b' },
  { key: 'DANG_PHOI', label: 'Đang phơi', color: '#0058be' },
  { key: 'DA_KHO', label: 'Đã khô', color: '#0ea5e9' },
  { key: 'CHO_SUA', label: 'Chờ sửa', color: '#f43f5e' },
  { key: 'CHO_OQC', label: 'Chờ OQC', color: '#8b5cf6' },
  { key: 'OQC_DAT', label: 'OQC đạt', color: '#22c55e' },
  { key: 'DA_GIAO', label: 'Đã giao', color: '#16a34a' },
  { key: 'LOAI', label: 'Loại', color: '#9ca3af' },
];

function StatCard({ icon, label, value, sub, tone = 'text-primary bg-primary-wash' }) {
  return (
    <div className="card p-4">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-control ${tone}`}>
        <Icon name={icon} size={18} />
      </div>
      <div className="text-2xl font-bold text-ink tabular-nums">{value}</div>
      <div className="text-sm text-ink-soft">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}

const fmtTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

export default function DashboardPage() {
  const { toast, show } = useToast();
  const [s, setS] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [sum, act] = await Promise.all([getSummary(), getActivity()]);
      setS(sum.data);
      setActivity(act.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);
  useSocketEvent('dashboard:refresh', load);

  if (loading || !s) return <div className="py-10 text-center text-ink-soft">Đang tải...</div>;

  const tem = s.tem || {};
  const chartData = TEM_STAGES.map((st) => ({ name: st.label, value: tem[st.key] || 0, color: st.color }));
  const temTotal = Object.values(tem).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-ink-soft">Theo dõi dòng chảy sản xuất theo thời gian thực</p>
        </div>
        <Badge tone="success"><span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Realtime</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon="package" label="Đơn hàng" value={fmtNum(s.don_hang.total)} />
        <StatCard icon="wrench" label="Phần in READY" value={`${s.phan_in.ready}/${s.phan_in.total}`} tone="text-amber-600 bg-amber-50" />
        <StatCard icon="factory" label="Lệnh đang SX" value={fmtNum(s.lenh.SAN_XUAT || 0)} tone="text-emerald-600 bg-emerald-50" />
        <StatCard icon="shield-check" label="OQC đạt" value={fmtNum(s.chat_luong.oqc_dat)} tone="text-teal-600 bg-teal-50" />
        <StatCard icon="truck" label="Tem đã giao" value={fmtNum(tem.DA_GIAO || 0)} sub={`${fmtNum(s.giao_hang.tong_sl_da_giao)} sp`} tone="text-green-600 bg-green-50" />
        <StatCard icon="loader" label="Nghẽn" value={fmtNum(s.nghen.dang_nghen)} tone={s.nghen.dang_nghen > 0 ? 'text-rose-600 bg-rose-50' : 'text-ink-soft bg-surface-muted'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-ink">Tem theo trạng thái ({fmtNum(temTotal)} tem)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Hoạt động gần đây</h3>
          <div className="space-y-3">
            {activity.length === 0 && <p className="text-sm text-ink-soft">Chưa có hoạt động.</p>}
            {activity.map((a) => (
              <div key={a.id} className="flex gap-2.5">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <div className="text-sm text-ink">{a.ly_do || a.trang_thai_moi || 'Cập nhật'}</div>
                  <div className="text-xs text-ink-soft">{a.nguoi || '—'} · {fmtTime(a.tg_thuc_hien)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 card p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink">Pipeline lệnh sản xuất</h3>
        <div className="flex flex-wrap gap-3">
          {[['RELEASE_1', 'Release 1'], ['SAN_XUAT', 'Đang SX'], ['RELEASE_2', 'Release 2']].map(([k, label]) => (
            <div key={k} className="flex-1 rounded-control border border-line p-3 text-center">
              <div className="text-xl font-bold text-ink">{fmtNum(s.lenh[k] || 0)}</div>
              <div className="text-xs text-ink-soft">{label}</div>
            </div>
          ))}
          <div className="flex-1 rounded-control border border-line p-3 text-center">
            <div className="text-xl font-bold text-ink">{fmtNum(s.giao_hang.by_trang_thai?.DA_GIAO || 0)}</div>
            <div className="text-xs text-ink-soft">Phiếu đã giao</div>
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
