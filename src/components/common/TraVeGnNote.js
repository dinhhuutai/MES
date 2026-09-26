import Badge from './Badge';
import { fmtDateTime } from '../../utils/format';

// Ghi chú "Đã trả về GN" ở HÀNH TRÌNH phần in (26/09/2026). Nguồn: `timeline.tra_ve_gn`
// (= mọi lượt READY trả về Giao nhận của phần in, mới nhất trước — `suathongtin.repository.lichSu`).
// Lượt còn chờ ⇒ đỏ "Đang ở GN"; đã xác nhận lại / đã hủy đợt vải ⇒ xám kèm người + giờ xử lý.
export default function TraVeGnNote({ list }) {
  if (!list || !list.length) return null;
  const dangCho = list.some((x) => !x.da_xu_ly);
  return (
    <div className={`mb-3 rounded-control border p-3 ${dangCho ? 'border-danger/40 bg-danger/5' : 'border-line bg-surface-muted'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={dangCho ? 'danger' : 'default'}>Đã trả về GN</Badge>
        <span className="text-xs text-ink-soft">
          {list.length} lượt{dangCho ? ' · đang chờ Giao nhận sửa thông tin' : ''}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {list.map((x) => (
          <li key={x.id} className="text-xs text-ink">
            <b>{fmtDateTime(x.tg_tra_ve)}</b>
            {x.nguoi_tra_ve ? ` · ${x.nguoi_tra_ve}` : ''}
            {x.nguon ? ` (${x.nguon})` : ''}
            {' — '}{x.ly_do || x.checklist_list || '—'}
            <div className="text-[11px] text-ink-soft">
              {x.da_xu_ly
                ? `Đã xử lý ${fmtDateTime(x.tg_xu_ly)}${x.nguoi_xu_ly ? ` · ${x.nguoi_xu_ly}` : ''}${x.ghi_chu_xac_nhan ? ` · ${x.ghi_chu_xac_nhan}` : ''}`
                : 'Chưa xử lý'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
