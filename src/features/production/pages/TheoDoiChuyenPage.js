import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import { getMonitor } from '../../../services/productionService';
import { fmtNum } from '../../../utils/format';

export default function TheoDoiChuyenPage() {
  const { toast, show } = useToast();
  const [data, setData] = useState({ running: [], queue: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await getMonitor();
      setData(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // tự làm mới mỗi 8s
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <Toolbar title="Theo dõi hoạt động chuyền" subtitle="Tình trạng in theo thời gian thực (tự làm mới 8s)" />

      {loading ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.running.length === 0 && (
              <div className="card col-span-full px-6 py-10 text-center text-ink-soft">Không có chuyền đang chạy</div>
            )}
            {data.running.map((r) => {
              const pct = r.target ? Math.min(100, Math.round((r.printed / r.target) * 100)) : 0;
              return (
                <div key={r.phieu_id} className="card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-control bg-emerald-50 text-emerald-600">
                        <Icon name="factory" size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-ink">{r.ma_chuyen}</div>
                        <div className="text-xs text-ink-soft">{r.ten_chuyen}</div>
                      </div>
                    </div>
                    <Badge tone="info">{r.ma_lenh_san_xuat}</Badge>
                  </div>
                  <div className="mb-1 text-sm text-ink-soft">Đang in: <span className="font-medium text-ink">{r.phan_list || '—'}</span></div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-ink-soft">Tiến độ</span>
                    <span className="font-semibold text-ink">{fmtNum(r.printed)} / {fmtNum(r.target)} ({pct}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-ink-soft">{r.so_tem} tem đã in</div>
                </div>
              );
            })}
          </div>

          <h3 className="mb-2 mt-8 text-sm font-semibold text-ink">Hàng chờ ({data.queue.length})</h3>
          <div className="card divide-y divide-line">
            {data.queue.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-ink-soft">Không có lệnh chờ</div>
            ) : (
              data.queue.map((q, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span><Badge tone="default">{q.ma_chuyen}</Badge> <span className="ml-2 font-medium text-ink">{q.ma_lenh_san_xuat}</span></span>
                  <span className="text-ink-soft">SL {fmtNum(q.target)}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
      <Toast toast={toast} />
    </div>
  );
}
