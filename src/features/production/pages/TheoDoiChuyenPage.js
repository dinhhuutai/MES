import { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Toast from '../../../components/common/Toast';
import Spinner from '../../../components/common/Spinner';
import useToast from '../../../hooks/useToast';
import useNow from '../../../hooks/useNow';
import useSocketReload from '../../../hooks/useSocketReload';
import { getMonitor } from '../../../services/productionService';
import { LOAI_TABS, hopChipChuyen as hopChip, nhanChip, demChip } from '../../../utils/khuChuyen';
import ChipTabs from '../../../components/common/ChipTabs';
import { gomTheoChuyen } from '../utils/theoDoiChuyen';

// ─────────────────────────────────────────────────────────────────────────────
// THEO DÕI CHUYỀN ĐANG CHẠY — BẢNG THẺ (08/11/2026, thiết kế lại theo yêu cầu người dùng: "ít thông tin nhưng nhìn nhanh
// vào là biết chuyền đang chạy phần in nào, đã sản xuất bao nhiêu, tiến độ ra sao, theo tiến độ thì khi nào xong, số
// lượng kế hoạch và thực tế, kế hoạch tiếp theo là mã phần in nào"). Bản cũ: 1 chuyền / màn, tự xoay vòng 30 s + 4 thẻ
// chỉ số + nút Dừng (ngừng chuyền vẫn làm ở sidebar Sản xuất). Nay MỌI chuyền đang chạy cùng lúc, 1 thẻ / chuyền.
// Luật số: hàm thuần `utils/theoDoiChuyen.js gomTheoChuyen`. Tự tải lại 10 s + socket `production:updated` (tải ngầm).
// `khe`: phần tử ở tiêu đề modal để đặt dải chip loại chuyền / khu (portal) — nội dung rộng ra.
// ─────────────────────────────────────────────────────────────────────────────

const nf = (n) => Number(n || 0).toLocaleString('vi-VN');
const pad = (n) => String(n).padStart(2, '0');
const gio = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// Giờ kèm ngày khi KHÁC hôm nay ("07:30 · 09/11").
const gioNgay = (t, nowMs) => {
  const d = new Date(t); const n = new Date(nowMs);
  const cungNgay = d.toDateString() === n.toDateString();
  return cungNgay ? gio(t) : `${gio(t)} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};
const khoangPhut = (p) => {
  const a = Math.abs(p);
  if (a < 60) return `${a}′`;
  const h = Math.floor(a / 60); const m = a % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
};

// ⚠ Khai ở MỨC MODULE (trang re-render theo `useNow`) — bẫy component lồng §9 CLAUDE.md.
function TheChuyen({ c, nowMs }) {
  const tre = c.tre_phut != null && c.tre_phut > 0;
  const du = c.con_lai <= 0;
  const vien = c.dang_ngung ? 'border-danger ring-1 ring-danger/40' : tre ? 'border-warning' : 'border-line';
  const thanh = c.dang_ngung ? 'bg-danger' : du ? 'bg-success' : tre ? 'bg-warning' : 'bg-primary';
  const p0 = c.phan[0];
  return (
    <div className={`flex flex-col rounded-card border bg-surface p-4 shadow-sm ${vien}`}>
      {/* Chuyền + trạng thái */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-2xl font-extrabold text-ink">{c.ma_chuyen}</span>
          {c.ten_loai_chuyen && <span className="truncate text-xs text-ink-soft">{c.ten_loai_chuyen}</span>}
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          c.dang_ngung ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
          <span className={`h-2 w-2 rounded-full ${c.dang_ngung ? 'bg-danger' : 'animate-pulse bg-success'}`} />
          {c.dang_ngung ? 'Đang ngừng' : 'Đang chạy'}
        </span>
      </div>

      {/* Phần in đang chạy */}
      <div className="mt-2 min-h-[2.75rem]">
        <div className="truncate font-mono text-[15px] font-bold text-primary" title={c.phan.map((p) => p.ma_phan).join(', ')}>
          {p0 ? p0.ma_phan : '—'}
          {c.phan.length > 1 && <span className="ml-1.5 font-sans text-xs font-semibold text-ink-soft">+{c.phan.length - 1} phần</span>}
        </div>
        <div className="truncate text-xs text-ink-soft">
          {p0 ? [p0.ten_khach_hang, p0.ma_hang, p0.mau_vai].filter(Boolean).join(' · ') : ''}
        </div>
      </div>

      {/* Thực tế / Kế hoạch + thanh tiến độ */}
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="leading-none">
          <span className="text-3xl font-extrabold tabular-nums text-ink">{nf(c.tt)}</span>
          <span className="text-base font-semibold tabular-nums text-ink-soft"> / {nf(c.kh)}</span>
        </div>
        <div className={`text-xl font-bold tabular-nums ${du ? 'text-success' : 'text-ink'}`}>
          {c.pt == null ? '—' : `${Math.round(c.pt)}%`}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink-soft">
        <span>Thực tế / Kế hoạch (pcs)</span>
        <span>{du ? 'Đủ số lượng' : `còn ${nf(c.con_lai)}`}</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full transition-all ${thanh}`} style={{ width: `${Math.min(100, c.pt || 0)}%` }} />
      </div>

      {/* Dự kiến xong theo tốc độ */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-control bg-surface-muted/60 px-3 py-2">
        <div className="leading-tight">
          <div className="text-[11px] text-ink-soft">Dự kiến xong</div>
          <div className="text-lg font-bold tabular-nums text-ink">
            {du ? 'Đã đủ SL' : c.xong_ms ? gioNgay(c.xong_ms, nowMs) : 'Chưa ước tính'}
          </div>
        </div>
        <div className="text-right leading-tight">
          {c.tre_phut != null && !du ? (
            <div className={`text-sm font-semibold ${tre ? 'text-warning' : 'text-success'}`}>
              {tre ? `Trễ ${khoangPhut(c.tre_phut)}` : 'Đúng tiến độ'}
            </div>
          ) : null}
          <div className="text-[11px] text-ink-soft">
            {c.kh_xong_ms ? `KH xong ${gioNgay(c.kh_xong_ms, nowMs)}` : 'Chưa có giờ KH'}
            {c.toc_do > 0 ? ` · ${nf(c.toc_do)} pcs/giờ` : ''}
          </div>
        </div>
      </div>

      {/* Kế hoạch tiếp theo */}
      <div className="mt-2 flex items-center gap-2 border-t border-line/70 pt-2 text-xs">
        <span className="shrink-0 font-semibold uppercase tracking-wide text-ink-soft">Tiếp theo</span>
        {c.tiep_theo ? (
          <span className="min-w-0 truncate" title={c.tiep_theo.ma_lenh_san_xuat}>
            <b className="font-mono text-[13px] text-ink">{c.tiep_theo.ma_phan || c.tiep_theo.ma_lenh_san_xuat}</b>
            <span className="text-ink-soft"> · {nf(c.tiep_theo.target)} pcs{c.tiep_theo.tg_bd_kh ? ` · ${gioNgay(c.tiep_theo.tg_bd_kh, nowMs)}` : ''}</span>
            {c.so_cho > 1 && <span className="text-ink-soft"> · còn {c.so_cho - 1} lệnh chờ</span>}
          </span>
        ) : <span className="text-ink-soft">Chưa có kế hoạch</span>}
      </div>
    </div>
  );
}

export default function TheoDoiChuyenPage({ khe = null }) {
  const { toast, show } = useToast();
  const nowMs = useNow(30000);
  const [data, setData] = useState(null);
  const [loai, setLoai] = useState(''); // chip loại chuyền / khu ('' = tất cả)

  const load = useCallback(async () => {
    try { const res = await getMonitor(); setData(res.data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
  }, [show]);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  useSocketReload(['production:updated'], load, 1500);

  const tatCa = useMemo(() => gomTheoChuyen(data?.running || [], data?.queue || [], nowMs), [data, nowMs]);
  const dem = useMemo(() => demChip(tatCa), [tatCa]);
  const ds = useMemo(() => (loai ? tatCa.filter((c) => hopChip(c, loai)) : tatCa), [tatCa, loai]);
  const soNgung = ds.filter((c) => c.dang_ngung).length;
  const soTre = ds.filter((c) => c.tre_phut != null && c.tre_phut > 0 && c.con_lai > 0).length;

  const dauTrang = (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1">
      {/* Chip XUỐNG DÒNG trong tiêu đề (không cuộn ngang — bản cuộn hiện 2 thanh cuộn chồng nhau). */}
      <div className="min-w-0 [&>div]:!mx-0 [&>div]:!mb-0 [&>div]:!flex-wrap [&>div]:!overflow-visible [&>div]:!px-0 [&>div]:!pb-0">
        <ChipTabs gon tabs={LOAI_TABS} value={loai} counts={{ ...dem, '': tatCa.length }} onChange={setLoai} />
      </div>
      <span className="shrink-0 text-xs font-normal text-ink-soft">
        {ds.length} chuyền{soNgung ? ` · ${soNgung} ngừng` : ''}{soTre ? ` · ${soTre} trễ tiến độ` : ''}
      </span>
    </div>
  );

  return (
    <div>
      {khe ? createPortal(dauTrang, khe) : <div className="mb-3">{dauTrang}</div>}
      {!data ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : !ds.length ? (
        <div className="py-16 text-center text-ink-soft">
          {loai ? `Không có chuyền "${nhanChip(loai)}" nào đang chạy` : 'Không có chuyền nào đang chạy'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {ds.map((c) => <TheChuyen key={c.key} c={c} nowMs={nowMs} />)}
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
}
