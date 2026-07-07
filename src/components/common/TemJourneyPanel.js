import { useEffect, useState, useCallback, useRef } from 'react';
import SidePanel from './SidePanel';
import Badge from './Badge';
import Toast from './Toast';
import useToast from '../../hooks/useToast';
import { fmtNum } from '../../utils/format';

// Nhãn + màu cho từng công đoạn trên hành trình.
const LOAI = {
  KCS: { label: 'KCS', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
  SUA: { label: 'Sửa', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  OQC: { label: 'OQC', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
  GIAO: { label: 'Giao', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
};
const fmtTs = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

// Panel "Hành trình theo tem": gộp mọi lần KCS / Sửa / OQC / Giao của 1 tem theo thời gian.
// fetcher(temId) -> { data: { tem, events:[{loai,tg,nguoi,chi_tiet}] } }.
export default function TemJourneyPanel({ temId, maTem, fetcher, onClose }) {
  const { toast, show } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    if (!temId) return;
    setLoading(true);
    try { const res = await fetcherRef.current(temId); setData(res.data); }
    catch (e) { show(e.message || 'Lỗi tải hành trình', 'error'); setData(null); }
    finally { setLoading(false); }
  }, [temId, show]);
  useEffect(() => { load(); }, [load]);

  const tem = data?.tem;
  const events = data?.events || [];

  return (
    <SidePanel open={!!temId} onClose={onClose} width="max-w-2xl"
      title={`Hành trình tem — ${maTem || tem?.ma_tem || ''}`}
      subtitle={tem ? `SL in ${fmtNum(tem.so_luong)}` : ''}>
      {tem && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Badge tone="info">Còn KCS {fmtNum(tem.con_kcs)}</Badge>
          <Badge tone="warning">Còn sửa {fmtNum(tem.con_sua)}</Badge>
          <Badge tone="info">Còn OQC {fmtNum(tem.con_oqc)}</Badge>
          <Badge tone="success">Còn giao {fmtNum(tem.con_giao)}</Badge>
        </div>
      )}
      {loading ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : events.length === 0 ? (
        <div className="py-10 text-center text-ink-soft">Chưa có thao tác nào trên tem này.</div>
      ) : (
        <ol className="relative ml-2 border-l border-line">
          {events.map((e, i) => {
            const L = LOAI[e.loai] || { label: e.loai, cls: 'bg-surface-muted text-ink-soft' };
            return (
              <li key={i} className="mb-4 ml-4">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${L.cls}`}>{L.label}</span>
                  <span className="tabular-nums text-xs text-ink-soft">{fmtTs(e.tg)}</span>
                  <span className="text-xs text-ink-soft">· {e.nguoi}</span>
                </div>
                <div className="mt-0.5 text-sm text-ink">{e.chi_tiet}</div>
              </li>
            );
          })}
        </ol>
      )}
      <Toast toast={toast} />
    </SidePanel>
  );
}
