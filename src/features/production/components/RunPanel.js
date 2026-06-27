import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import { Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { getRun, printTem, finishRun } from '../../../services/productionService';
import { fmtNum } from '../../../utils/format';

const TEM_TONE = { IN: 'warning', DANG_PHOI: 'info', DA_KHO: 'success' };
const TEM_LABEL = { IN: 'Chờ phơi', DANG_PHOI: 'Đang phơi', DA_KHO: 'Đã khô' };

export default function RunPanel({ lenhId, onClose, onChanged }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRun = can('PROD_RUN');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [soLuong, setSoLuong] = useState('');

  const phieu = data?.phieu;
  const running = phieu?.trang_thai === 'DANG_CHAY';

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
      show(`Đã in tem ${fmtNum(soLuong)}`);
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

  const target = Number(data?.lenh?.so_luong_release) || 0;
  const printed = Number(data?.printed) || 0;
  const pct = target ? Math.min(100, Math.round((printed / target) * 100)) : 0;

  return (
    <SidePanel
      open={!!lenhId}
      onClose={onClose}
      title={data?.lenh ? `Sản xuất — ${data.lenh.ma_lenh_san_xuat}` : 'Sản xuất'}
      subtitle={data?.lenh ? `Chuyền ${data.lenh.ma_chuyen || '—'} · Phần ${data.lenh.phan_list || '—'}` : ''}
      footer={
        running && canRun && (
          <Button variant="danger" onClick={doFinish} loading={busy}>Chạy hoàn tất</Button>
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
          </section>

          {running && canRun && (
            <section className="flex items-end gap-2 border-t border-line pt-4">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-ink">Số lượng in (1 tem)</label>
                <Input type="number" value={soLuong} onChange={(e) => setSoLuong(e.target.value)} placeholder="vd: 200" />
              </div>
              <Button onClick={doPrint} loading={busy} disabled={!soLuong || Number(soLuong) <= 0}>In tem</Button>
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
