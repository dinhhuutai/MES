import { useEffect, useState, useCallback } from 'react';
import Modal from '../../../components/common/Modal';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import { Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import useNow from '../../../hooks/useNow';
import usePermissions from '../../../hooks/usePermissions';
import { getMonitor, stopLine, resumeLine } from '../../../services/productionService';

const ROTATE_MS = 30000;
const nf = (n) => Number(n || 0).toLocaleString('vi-VN');
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const oneDecimal = (n) => (Math.round(n * 10) / 10).toLocaleString('vi-VN');
const dateLabel = (d) => `T${d.getDay() === 0 ? 'CN' : d.getDay() + 1}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

export default function TheoDoiChuyenPage() {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const canRun = can('PROD_RUN');
  const nowMs = useNow(1000);
  const now = new Date(nowMs);

  const [data, setData] = useState({ running: [], queue: [] });
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const [stopFor, setStopFor] = useState(null);
  const [stopReason, setStopReason] = useState('');
  const [busy, setBusy] = useState(false);

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
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const running = data.running || [];
  const count = running.length;
  const cur = count ? idx % count : 0;

  useEffect(() => {
    if (!auto || count <= 1) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(t);
  }, [auto, count]);

  const r = count ? running[cur] : null;
  const nextList = r ? (data.queue || []).filter((q) => q.ma_chuyen === r.ma_chuyen) : [];
  const next = nextList[0] || null;

  const target = Number(r?.target) || 0;
  const printed = Number(r?.printed) || 0;
  const remaining = Math.max(0, target - printed);
  const pct = target ? Math.min(100, (printed / target) * 100) : 0;
  const ngungPhut = Number(r?.ngung_phut) || 0;
  const elapsedMin = r?.tg_bd ? Math.max(0, (nowMs - new Date(r.tg_bd).getTime()) / 60000 - ngungPhut) : 0;
  const speed = elapsedMin > 0 ? Math.round(printed / (elapsedMin / 60)) : 0;
  const dinhMuc = r?.dinh_muc_gio ? Number(r.dinh_muc_gio) : null;
  const oee = dinhMuc ? (speed / dinhMuc) * 100 : null;
  const etc = (speed > 0 && remaining > 0) ? new Date(nowMs + (remaining / speed) * 3600 * 1000) : null;

  const go = (n) => setIdx((i) => ((i + n) % count + count) % count);

  const doResume = async () => {
    setBusy(true);
    try { await resumeLine(r.phieu_id); show('Chuyền hoạt động lại'); await load(); }
    catch (e) { show(e.message || 'Thất bại', 'error'); }
    finally { setBusy(false); }
  };
  const doStop = async () => {
    if (!stopReason.trim()) { show('Nhập lý do ngừng', 'error'); return; }
    setBusy(true);
    try { await stopLine(stopFor, stopReason.trim()); show('Đã ngừng chuyền'); setStopFor(null); setStopReason(''); await load(); }
    catch (e) { show(e.message || 'Thất bại', 'error'); }
    finally { setBusy(false); }
  };

  const Card = ({ label, children }) => (
    <div className="rounded-card border border-line bg-surface-muted/50 p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</div>
      {children}
    </div>
  );

  return (
    <div>
      <div className="card p-6 sm:p-7">
        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {count > 0 ? (
              <select value={cur} onChange={(e) => setIdx(Number(e.target.value))}
                className="h-10 rounded-input border border-line bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
                {running.map((x, i) => <option key={x.phieu_id} value={i}>{x.ma_chuyen} · {x.ten_chuyen}</option>)}
              </select>
            ) : <span className="text-sm text-ink-soft">Không có chuyền đang chạy</span>}
            {r && (r.dang_ngung ? <Badge tone="danger">● Đang ngừng</Badge> : <Badge tone="success">● Đang chạy</Badge>)}
          </div>
          <div className="flex items-center gap-4">
            {count > 1 && (
              <div className="flex items-center gap-1">
                {running.map((x, i) => <span key={x.phieu_id} className={`h-1.5 rounded-full transition-all ${i === cur ? 'w-6 bg-primary' : 'w-3 bg-line'}`} />)}
              </div>
            )}
            <div className="text-right leading-tight">
              <div className="font-mono text-2xl font-bold text-ink tabular-nums">{hhmm(now)}</div>
              <div className="text-[11px] text-ink-soft">{dateLabel(now)}</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-ink-soft">Đang tải...</div>
        ) : !r ? (
          <div className="py-16 text-center text-ink-soft">Không có chuyền nào đang chạy</div>
        ) : (
          <>
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">Đang sản xuất</div>

            {/* Lệnh + tiến độ */}
            <div className="mb-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Lệnh sản xuất</div>
              <div className="mt-1 text-2xl font-bold text-ink">
                {r.ma_lenh_san_xuat} · {r.ma_hang || r.ma_phan || r.phan_list || '—'}
              </div>
              <div className="mt-1 text-sm text-ink-soft">
                {[r.ma_phan, r.mau_vai, r.kich_vai && `Kích vải ${r.kich_vai}`, r.kich_phim && `Kích phim ${r.kich_phim}`].filter(Boolean).join(' · ') || '—'}
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold text-primary">{nf(printed)} / {nf(target)} · {oneDecimal(pct)}%</span>
                <span className="text-ink-soft">còn {nf(remaining)} cái</span>
              </div>
            </div>

            {/* 4 thẻ chỉ số */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card label="Tốc độ thực tế">
                <div className="mt-1 text-3xl font-bold text-ink">{nf(speed)}</div>
                <div className="mt-1 text-xs text-ink-soft">cái / giờ{dinhMuc ? ` · định mức ${nf(dinhMuc)}` : ''}</div>
              </Card>
              <Card label="Hiệu suất">
                <div className={`mt-1 text-3xl font-bold ${oee != null && oee < 80 ? 'text-warning' : 'text-ink'}`}>{oee != null ? `${oneDecimal(oee)}%` : '—'}</div>
                <div className="mt-1 text-xs text-ink-soft">{oee != null ? 'so với định mức (ca này)' : 'chưa có định mức'}</div>
              </Card>
              <Card label="Dự kiến hoàn thành">
                <div className="mt-1 text-3xl font-bold text-ink">{etc ? hhmm(etc) : (remaining <= 0 ? 'Đủ SL' : '—')}</div>
                <div className="mt-1 text-xs text-ink-soft">{r.ngay_ke_hoach ? `KH ${new Date(r.ngay_ke_hoach).toLocaleDateString('vi-VN')}` : 'theo tốc độ hiện tại'}</div>
              </Card>
              <Card label="Lệnh kế tiếp">
                {next ? (
                  <>
                    <div className="mt-1 text-2xl font-bold text-primary">{next.ma_lenh_san_xuat}</div>
                    <div className="mt-1 text-xs text-ink-soft">{[next.ma_phan, next.mau_vai].filter(Boolean).join(' · ') || '—'} · Sẵn sàng</div>
                  </>
                ) : <div className="mt-1 text-sm text-ink-soft">Chưa có</div>}
              </Card>
            </div>

            {/* Nút Dừng / Hoạt động lại + điều hướng */}
            <div className="mt-6 flex items-center justify-center gap-2">
              {count > 1 && <Button variant="ghost" icon="chevron-left" className="px-3" onClick={() => go(-1)} />}
              {canRun && (r.dang_ngung
                ? <Button onClick={doResume} loading={busy}>Hoạt động lại</Button>
                : <Button variant="danger" onClick={() => { setStopFor(r.phieu_id); setStopReason(''); }} disabled={busy}>Dừng</Button>)}
              <span className="px-1 text-xs text-ink-soft">{cur + 1} / {count}</span>
              <Button variant="ghost" icon={auto ? 'pause' : 'play'} className="px-3" onClick={() => setAuto((a) => !a)} />
              {count > 1 && <Button variant="ghost" icon="chevron-right" className="px-3" onClick={() => go(1)} />}
            </div>
          </>
        )}
      </div>

      {/* Kế hoạch tiếp theo của chuyền */}
      {r && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-ink">Kế hoạch tiếp theo của chuyền {r.ma_chuyen} ({nextList.length})</h3>
          <div className="card divide-y divide-line">
            {nextList.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-ink-soft">Không có lệnh chờ cho chuyền này</div>
            ) : (
              nextList.map((q, i) => (
                <div key={q.ma_lenh_san_xuat} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-center text-xs font-semibold text-ink-soft">{i + 1}</span>
                    <span className="font-semibold text-ink">{q.ma_lenh_san_xuat}</span>
                    <span className="text-ink-soft">{[q.ma_phan, q.mau_vai, q.ma_hang].filter(Boolean).join(' · ')}</span>
                  </div>
                  <div className="flex items-center gap-4 text-ink-soft">
                    <span>SL {nf(q.target)}</span>
                    <span>KH {q.ngay_ke_hoach ? new Date(q.ngay_ke_hoach).toLocaleDateString('vi-VN') : '—'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal lý do ngừng */}
      <Modal open={!!stopFor} onClose={() => setStopFor(null)} title="Ngừng chuyền"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStopFor(null)}>Hủy</Button>
            <Button variant="danger" onClick={doStop} loading={busy} disabled={!stopReason.trim()}>Ngừng chuyền</Button>
          </>
        }
      >
        <Textarea rows={3} value={stopReason} onChange={(e) => setStopReason(e.target.value)}
          placeholder="Lý do ngừng chuyền (vd: hết mực, kẹt vải, đổi khuôn...)" />
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
