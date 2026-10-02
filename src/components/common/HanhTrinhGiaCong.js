import Badge from './Badge';
import Icon from './Icon';
import { fmtNum, fmtDateTime } from '../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// HÀNH TRÌNH 1 LỆNH GIA CÔNG của 1 code phần (01/10/2026) — dữ liệu dựng ở backend
// `utils/hanhTrinhGiaCong.js`, gắn vào `journey.gia_cong` + `journey.trams` (bước READY giữ nguyên ở đầu).
// Các bước: Gửi gia công → Ở nhà gia công → Nhận hàng về (tem 13) → OQC → Giao hàng. Bước đang giữ hàng
// tô xanh + "Đang ở đây · N pcs"; đầu khối có dải tóm tắt SL theo từng chỗ ⇒ nhìn là biết hàng ở đâu.
// Dùng chung ở SidePanel Danh sách phần in vải về + panel tra cứu phần in (Danh sách release).
// Trang tự vẽ bước READY theo kiểu của mình rồi mới đặt component này (`batDau` = số thứ tự bước đầu).
// ─────────────────────────────────────────────────────────────────────────────

const TONE_DONG = { dang: 'info', ok: 'success', warn: 'warning', muted: 'default' };

function CanhBao({ items }) {
  if (!items || !items.length) return null;
  return (
    <div className="space-y-1">
      {items.map((c) => (
        <div key={c} className="flex items-start gap-1.5 rounded-control border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <Icon name="alert-triangle" size={14} className="mt-px shrink-0" />
          <span>{c}</span>
        </div>
      ))}
    </div>
  );
}

function TomTat({ gc }) {
  return (
    <div className="space-y-2 rounded-control border border-primary/30 bg-primary-wash/60 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-ink-soft">Hàng của code phần này đang ở</div>
          <div className="text-sm font-semibold text-primary">{gc.dang_o_text}</div>
        </div>
        <div className="text-xs text-ink-soft">
          Gửi <b className="text-ink">{fmtNum(gc.sl_gui)}</b> pcs · {gc.nha_gia_cong || '—'}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(gc.doan || []).map((d) => {
          let cls = 'border-line bg-surface text-ink-soft';
          if (d.value > 0 && d.xong) cls = 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300';
          else if (d.value > 0 && !d.phu) cls = 'border-primary bg-primary text-white';
          return (
            <span key={d.key} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>
              {d.label} <b className="tabular-nums">{fmtNum(d.value)}</b>
            </span>
          );
        })}
      </div>
      <CanhBao items={gc.canh_bao} />
    </div>
  );
}

function VongSo({ trangThai, so }) {
  if (trangThai === 'xong') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Icon name="check" size={14} />
      </span>
    );
  }
  const cls = trangThai === 'dang'
    ? 'bg-primary text-white ring-4 ring-primary/20'
    : 'border border-dashed border-line text-ink-soft';
  return <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${cls}`}>{so}</span>;
}

function Buoc({ t, so }) {
  const dang = t.trang_thai === 'dang';
  const khung = dang ? 'border-primary/50 bg-primary-wash/30' : 'border-line';
  return (
    <div className={`rounded-control border p-3 ${khung} ${t.trang_thai === 'chua' ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <VongSo trangThai={t.trang_thai} so={so} />
        <span className="text-sm font-semibold text-ink">{t.ten_tram}</span>
        {dang && t.dang_o > 0 && <Badge tone="info">Đang ở đây · {fmtNum(t.dang_o)} pcs</Badge>}
        {t.trang_thai === 'chua' && <Badge>Chưa tới</Badge>}
        {t.an_tren_man && <Badge tone="danger">{t.an_tren_man}</Badge>}
      </div>
      {t.moc && (
        <div className="mt-1 pl-8 text-xs text-ink-soft">{fmtDateTime(t.moc.tg)} · {t.moc.nguoi || '—'}</div>
      )}
      {t.qty?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
          {t.qty.map((q) => (
            <span key={q.label} className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-soft">
              {q.label}: <b className="text-ink">{fmtNum(q.value)}</b>
            </span>
          ))}
        </div>
      )}
      {t.dong?.length > 0 && (
        <ul className="mt-2 space-y-1 pl-8">
          {t.dong.map((d, i) => (
            <li key={i} className="text-xs">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {d.badge && <Badge tone={TONE_DONG[d.tone] || 'default'}>{d.badge}</Badge>}
                <span className={d.tone === 'muted' ? 'text-ink-soft line-through decoration-ink-soft/40' : 'text-ink'}>{d.text}</span>
              </div>
              {(d.tg || d.nguoi) && (
                <div className="text-ink-soft">{d.tg ? fmtDateTime(d.tg) : ''}{d.tg && d.nguoi ? ' · ' : ''}{d.nguoi || ''}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {t.canh_bao?.length > 0 && <div className="mt-2 pl-8"><CanhBao items={t.canh_bao} /></div>}
    </div>
  );
}

export default function HanhTrinhGiaCong({ j, batDau = 1 }) {
  const gc = j?.gia_cong;
  if (!gc) return null;
  const trams = (j.trams || []).filter((t) => t.ma_tram !== 'READY');
  return (
    <div className="space-y-2">
      <TomTat gc={gc} />
      <ol>
        {trams.map((t, i) => (
          <li key={t.ma_tram}>
            <Buoc t={t} so={batDau + i} />
            {i < trams.length - 1 && (
              <div className="flex justify-center py-1 text-ink-soft"><Icon name="arrow-down" size={16} /></div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
