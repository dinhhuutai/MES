// Dòng "Vừa quét" dưới ô quét liên tục (19/10/2026). Ô quét TỰ XÓA sau mỗi lần Enter để mã kế tiếp không dính vào mã
// trước ⇒ người dùng không còn thấy mình vừa quét mã gì (thông báo chỉ hiện 3 giây). Dòng này giữ mã + kết quả của lần
// quét GẦN NHẤT tới lần quét sau. `ket` = { ma, tone: 'ok' | 'loi' | 'info', chu } — null ⇒ không hiện gì.
const MAU = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  loi: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300',
};
const DAU = { ok: '✓', loi: '✗', info: '•' };

export default function VuaQuet({ ket, className = '' }) {
  if (!ket || !ket.ma) return null;
  const tone = MAU[ket.tone] ? ket.tone : 'info';
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-control border px-3 py-1.5 text-sm ${MAU[tone]} ${className}`}>
      <span className="shrink-0 text-xs opacity-80">Vừa quét</span>
      <b className="shrink-0 font-mono tabular-nums">{ket.ma}</b>
      {ket.chu ? <span className="min-w-0 truncate" title={ket.chu}>{DAU[tone]} {ket.chu}</span> : null}
    </div>
  );
}
