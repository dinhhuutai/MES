import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import { Input, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { getRun, printTem, finishRun, stopLine, resumeLine } from '../../../services/productionService';
import { fmtNum } from '../../../utils/format';

const TEM_TONE = { IN: 'warning', DANG_PHOI: 'info', DA_KHO: 'success' };
const TEM_LABEL = { IN: 'Chờ phơi', DANG_PHOI: 'Đang phơi', DA_KHO: 'Đã khô' };
const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

export default function RunPanel({ lenhId, onClose, onChanged }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRun = can('PROD_RUN');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [soLuong, setSoLuong] = useState('');
  const [stopReason, setStopReason] = useState('');

  const phieu = data?.phieu;
  const running = phieu?.trang_thai === 'DANG_CHAY';
  const ngungActive = data?.ngung_active || null;
  const ngungList = data?.ngung_list || [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRun(lenhId);
      setData(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [lenhId, show]);

  useEffect(() => { load(); }, [load]);

  const doPrint = async () => {
    setBusy(true);
    try {
      await printTem(phieu.id, Number(soLuong));
      show(`Đã in tem ${fmtNum(soLuong)} — tự đưa vào xe phơi, đang đếm ngược`);
      setSoLuong('');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'In tem thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doFinish = async () => {
    setBusy(true);
    try {
      await finishRun(phieu.id);
      show('Đã hoàn tất chạy');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doStop = async () => {
    if (!stopReason.trim()) { show('Nhập lý do ngừng chuyền', 'error'); return; }
    setBusy(true);
    try {
      await stopLine(phieu.id, stopReason.trim());
      show('Đã ngừng chuyền');
      setStopReason('');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally { setBusy(false); }
  };

  const doResume = async () => {
    setBusy(true);
    try {
      await resumeLine(phieu.id);
      show('Chuyền hoạt động lại');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally { setBusy(false); }
  };

  const target = Number(data?.lenh?.so_luong_release) || 0;
  const printed = Number(data?.printed) || 0;
  const pct = target ? Math.min(100, Math.round((printed / target) * 100)) : 0;
  const maxTotal = target ? Math.floor(target * 1.1) : 0;       // trần 110% SL release
  const remain = target ? Math.max(0, maxTotal - printed) : null; // còn được in
  const overMax = target > 0 && Number(soLuong) > remain;

  return (
    <SidePanel
      open={!!lenhId}
      onClose={onClose}
      title={data?.lenh ? `Sản xuất — ${data.lenh.ma_lenh_san_xuat}` : 'Sản xuất'}
      subtitle={data?.lenh ? `Chuyền ${data.lenh.ma_chuyen || '—'} · Phần ${data.lenh.phan_list || '—'}` : ''}
      footer={
        running && canRun && (
          <Button variant="danger" onClick={doFinish} loading={busy} disabled={printed < target}>
            Chạy hoàn tất
          </Button>
        )
      }
    >
      {loading || !data ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          <section>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-soft">Đã in</span>
              <span className="font-semibold text-ink">{fmtNum(printed)} / {fmtNum(target)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-soft">
              <span>Phiếu {phieu?.ma_phieu_san_xuat}</span>
              <Badge tone={running ? 'info' : 'success'}>{running ? 'Đang chạy' : 'Hoàn tất'}</Badge>
            </div>
            {running && canRun && printed < target && (
              <p className="mt-2 text-xs text-amber-600">
                Cần in đủ SL release ({fmtNum(target)}) mới hoàn tất được — còn thiếu <b>{fmtNum(target - printed)}</b>.
              </p>
            )}
          </section>

          {running && canRun && (
            <section className="border-t border-line pt-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-ink">Số lượng in (1 tem)</label>
                  <Input type="number" max={remain || undefined} value={soLuong}
                    onChange={(e) => setSoLuong(e.target.value)} placeholder="vd: 200"
                    className={overMax ? 'border-danger focus:border-danger focus:ring-danger/10' : ''} />
                </div>
                <Button onClick={doPrint} loading={busy}
                  disabled={!soLuong || Number(soLuong) <= 0 || overMax || remain === 0}>In tem</Button>
              </div>
              {target > 0 && (
                <p className={`mt-1.5 text-xs ${overMax ? 'text-danger' : 'text-ink-soft'}`}>
                  Trần 110% SL release: tối đa {fmtNum(maxTotal)} · còn được in <b>{fmtNum(remain)}</b>
                  {overMax ? ' — vượt giới hạn!' : ''}
                </p>
              )}
            </section>
          )}

          {/* Ngừng chuyền (downtime) */}
          {running && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Ngừng chuyền</h3>
              {ngungActive ? (
                <div className="rounded-control border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm">
                  <div className="font-semibold text-rose-700">⏸ Chuyền đang ngừng</div>
                  <div className="mt-0.5 text-xs text-ink-soft">Từ {fmtDt(ngungActive.tg_bd_ngung)}</div>
                  {ngungActive.ly_do && <div className="mt-0.5 text-xs text-ink">Lý do: {ngungActive.ly_do}</div>}
                  {canRun && (
                    <Button className="mt-2 w-full" onClick={doResume} loading={busy}>Chuyền hoạt động lại</Button>
                  )}
                </div>
              ) : canRun ? (
                <div className="space-y-2">
                  <Textarea rows={2} value={stopReason} onChange={(e) => setStopReason(e.target.value)}
                    placeholder="Lý do ngừng chuyền (vd: hết mực, kẹt vải, đổi khuôn...)" />
                  <Button variant="danger" className="w-full" onClick={doStop} loading={busy} disabled={!stopReason.trim()}>
                    Ngừng chuyền
                  </Button>
                </div>
              ) : null}

              {ngungList.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium text-ink-soft">Lịch ngừng ({ngungList.length})</div>
                  <div className="space-y-1.5">
                    {ngungList.map((n) => (
                      <div key={n.id} className="rounded-control border border-line px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-ink">{fmtDt(n.tg_bd_ngung)}{n.tg_kt_ngung ? ` → ${fmtDt(n.tg_kt_ngung)}` : ''}</span>
                          {n.trang_thai === 'DANG_NGUNG'
                            ? <Badge tone="danger">Đang ngừng</Badge>
                            : <Badge tone="default">{fmtNum(n.so_phut)} phút</Badge>}
                        </div>
                        {n.ly_do && <div className="mt-0.5 text-xs text-ink-soft">Lý do: {n.ly_do}{n.nguoi ? ` · ${n.nguoi}` : ''}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Tem đã in ({data.tems.length})</h3>
            {data.tems.length ? (
              <div className="space-y-1.5">
                {data.tems.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-control border border-line px-3 py-2 text-sm">
                    <span className="font-medium text-ink">{t.ma_tem}</span>
                    <span className="text-ink-soft">{fmtNum(t.so_luong)}</span>
                    <Badge tone={TEM_TONE[t.trang_thai] || 'default'}>{TEM_LABEL[t.trang_thai] || t.trang_thai}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Chưa in tem nào.</p>
            )}
          </section>
        </div>
      )}
      <Toast toast={toast} />
    </SidePanel>
  );
}
