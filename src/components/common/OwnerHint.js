import { useEffect, useState } from 'react';
import Icon from './Icon';
import { getFlowOwners } from '../../services/dashboardService';

// Cache owner map (trạm + checkpoint) toàn app — owner đổi hiếm, tải 1 lần.
let _cache = null;
let _pending = null;
function loadOwners() {
  if (_cache) return Promise.resolve(_cache);
  if (!_pending) _pending = getFlowOwners().then((r) => { _cache = r.data; return _cache; }).catch(() => ({ tram: {}, checkpoint: {} }));
  return _pending;
}
export function invalidateOwners() { _cache = null; _pending = null; }

export function useFlowOwners() {
  const [map, setMap] = useState(_cache);
  useEffect(() => {
    let alive = true;
    loadOwners().then((d) => { if (alive) setMap(d); });
    return () => { alive = false; };
  }, []);
  return map;
}

// Hiển thị "Cần xử lý: X · TN: Y" cho 1 trạm HOẶC 1 checkpoint (theo workflow hiện hành).
// Chỉ hiện khi item CHƯA xong (truyền pending=true, mặc định true).
export default function OwnerHint({ tram, checkpoint, pending = true, className = '' }) {
  const map = useFlowOwners();
  if (!map || !pending) return null;
  const g = checkpoint ? map.checkpoint?.[checkpoint] : map.tram?.[tram];
  if (!g) return null;
  const xl = (g.xu_ly || []).join(', ');
  const tn = (g.chiu_trach_nhiem || []).join(', ');
  if (!xl && !tn) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft ${className}`}>
      <span className="inline-flex items-center gap-1"><Icon name="user" size={12} />
        {xl ? <>Cần xử lý: <b className="text-ink">{xl}</b></> : 'Chưa gán owner xử lý'}
      </span>
      {tn && <span>· TN: {tn}</span>}
    </div>
  );
}
