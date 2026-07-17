import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// Bảng màu biểu đồ báo cáo — lấy từ design tokens (primary #0058be), tránh chói ở nhà máy.
const MAU = ['#0058be', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#64748B'];

export const CHART_KIEU = [
  { v: 'cot', ten: 'Cột' },
  { v: 'duong', ten: 'Đường' },
  { v: 'tron', ten: 'Tròn' },
];

// Dữ liệu biểu đồ = { nhan, gia_tri }[]. Nguồn:
//  · 'danh_sach' → lấy từ khối danh sách (ô neo `tu_o`): cột nhãn `cot_nhan`, cột số `cot_gia_tri`.
//  · 'metric'    → mỗi metric là 1 cột (mảng `metrics`), giá trị lấy từ metric_values.
export function chartData(cfg, { danhSach = {}, metricValues = {}, metricsByMa = {} }) {
  if (!cfg) return [];
  if (cfg.nguon === 'metric') {
    return (cfg.metrics || []).map((ma) => {
      const v = metricValues[ma];
      return { nhan: metricsByMa[ma]?.ten || ma, gia_tri: typeof v === 'number' ? v : Number(v) || 0 };
    });
  }
  const blk = danhSach[cfg.tu_o];
  if (!blk || !blk.rows?.length) return [];
  const rows = blk.rows.slice(0, Number(cfg.gioi_han) || 15);
  return rows.map((r) => ({
    nhan: String(r[cfg.cot_nhan] ?? ''),
    gia_tri: Number(r[cfg.cot_gia_tri]) || 0,
  }));
}

// Biểu đồ 1 khối trong báo cáo. `cao` = chiều cao px.
export default function ReportChart({ cfg, data, cao = 260 }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center rounded-control border border-dashed border-line text-xs text-ink-soft">
        Chưa có dữ liệu — bấm <b className="mx-1">Xem trước</b> hoặc kiểm tra lại nguồn biểu đồ.
      </div>
    );
  }
  const kieu = cfg?.kieu || 'cot';
  return (
    <div style={{ height: cao }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {kieu === 'tron' ? (
          <PieChart>
            <Pie data={data} dataKey="gia_tri" nameKey="nhan" outerRadius="80%" label={(e) => e.gia_tri}>
              {data.map((_, i) => <Cell key={i} fill={MAU[i % MAU.length]} />)}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        ) : kieu === 'duong' ? (
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="nhan" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="gia_tri" name={cfg?.ten || 'Giá trị'} stroke={MAU[0]} strokeWidth={2} dot />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="nhan" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="gia_tri" name={cfg?.ten || 'Giá trị'} fill={MAU[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
