import { fmtNum } from '../../utils/format';

// Bảng SL KCS theo TỪNG ĐỢT VẢI của 1 phần in + dòng Tổng (khi ≥2 đợt).
// data = { dot: [{ma_dot_vai, sl_kiem, sl_dat, sl_sua, sl_huy, sl_du, sl_thieu, sl_sua_dat}], tong }
const pct = (num, den) => (den > 0 ? `${Math.round((num / den) * 1000) / 10}%` : '—');

const TH = 'px-2 py-1 font-medium whitespace-nowrap';
const TD = 'px-2 py-1 text-right tabular-nums';

function KcsRow({ r, label, isTotal }) {
  const tongHuy = (r.sl_huy || 0) + (r.sl_sua_huy || 0); // hủy thẳng ở KCS + sửa hủy
  return (
    <tr className={isTotal ? 'border-t border-line bg-surface-muted font-semibold text-ink' : 'text-ink'}>
      <td className={`px-2 py-1 text-left ${isTotal ? 'font-semibold' : ''}`}>{label}</td>
      <td className={TD}>{fmtNum(r.sl_kiem)}</td>
      <td className={`${TD} text-emerald-600`}>{fmtNum(r.sl_dat)}</td>
      <td className={`${TD} text-amber-600`}>{fmtNum(r.sl_sua)}</td>
      <td className={`${TD} text-emerald-600`}>{fmtNum(r.sl_sua_dat)}</td>
      <td className={`${TD} text-rose-600`}>{fmtNum(tongHuy)}</td>
      <td className={TD}>{fmtNum(r.sl_du)}</td>
      <td className={TD}>{fmtNum(r.sl_thieu)}</td>
      <td className={`${TD} font-medium`}>{pct(r.sl_dat, r.sl_kiem)}</td>
      <td className={`${TD} font-medium`}>{pct(r.sl_dat + r.sl_sua_dat, r.sl_kiem)}</td>
    </tr>
  );
}

export default function KcsBreakdown({ data }) {
  if (!data || !data.dot || data.dot.length === 0) return null;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[620px] text-[11px]">
        <thead>
          <tr className="text-ink-soft">
            <th className={`${TH} text-left`}>Đợt vải</th>
            <th className={`${TH} text-right`}>SL kiểm</th>
            <th className={`${TH} text-right`}>Đạt</th>
            <th className={`${TH} text-right`}>Sửa</th>
            <th className={`${TH} text-right`}>Sửa đạt</th>
            <th className={`${TH} text-right`}>Tổng hủy</th>
            <th className={`${TH} text-right`}>Dư</th>
            <th className={`${TH} text-right`}>Thiếu</th>
            <th className={`${TH} text-right`}>% đạt sau kiểm</th>
            <th className={`${TH} text-right`}>% đạt sau sửa</th>
          </tr>
        </thead>
        <tbody>
          {data.dot.map((r) => <KcsRow key={r.dot_vai_ve_id} r={r} label={r.ma_dot_vai} />)}
          {data.tong && <KcsRow r={data.tong} label="Tổng" isTotal />}
        </tbody>
      </table>
    </div>
  );
}
