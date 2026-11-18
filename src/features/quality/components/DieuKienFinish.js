// Ô "Điều kiện finish" (18/11/2026) — 7 viên ✓ / ✗ theo `r.dk` BE trả (luật `backend/src/utils/dieuKienFinish.js`).
// Dùng chung: modal Danh sách finish (chế độ Chưa finish) · trang Hệ thống › Mở điều kiện finish.
import { DK_FINISH } from '../utils/danhSachFinish';
import { fmtDateTime } from '../../../utils/format';

export function DieuKienFinishChips({ r }) {
  const dk = r.dk || {};
  return (
    <div className="flex max-w-[15rem] flex-wrap gap-1">
      {DK_FINISH.map((d) => {
        const dat = !!dk[d.ma];
        return (
          <span key={d.ma} title={`${d.ten}: ${dat ? 'đạt' : 'chưa đạt'}`}
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${dat
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900'
              : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900'}`}>
            {dat ? '✓' : '✗'} {d.gon}
          </span>
        );
      })}
    </div>
  );
}

// Kiểu finish: tự động (đủ 7 điều kiện) / chuyển tay (người · giờ · lý do ở title).
export function LoaiFinishBadge({ r }) {
  if (r.loai_finish === 'CHUYEN_TAY') {
    const t = r.chuyen_finish || {};
    return (
      <span title={`Chuyển finish${t.nguoi ? ` — ${t.nguoi}` : ''}${t.tg ? ` · ${fmtDateTime(t.tg)}` : ''}${t.ly_do ? `\nLý do: ${t.ly_do}` : ''}`}
        className="inline-flex cursor-help items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
        Chuyển tay
      </span>
    );
  }
  if (r.loai_finish === 'TU_DONG') {
    return (
      <span title="Đủ 7 điều kiện — ngày finish = ngày tích tem giao cuối cùng"
        className="inline-flex cursor-help items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
        Tự động
      </span>
    );
  }
  return null;
}

// Nhãn "Admin đã mở điều kiện" (người · giờ · lý do ở title).
export function MoDieuKienBadge({ r }) {
  const m = r.mo_dieu_kien_info;
  if (!r.mo_dieu_kien) return null;
  return (
    <span title={m ? `Admin mở điều kiện${m.nguoi ? ` — ${m.nguoi}` : ''}${m.tg ? ` · ${fmtDateTime(m.tg)}` : ''}${m.ly_do ? `\nLý do: ${m.ly_do}` : ''}` : 'Admin đã mở điều kiện'}
      className="inline-flex cursor-help items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900">
      Đã mở điều kiện
    </span>
  );
}
