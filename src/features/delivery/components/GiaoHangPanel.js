import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { getGiaoHang, confirmGiao } from '../../../services/deliveryService';
import { fmtNum, fmtDate } from '../../../utils/format';
import { printGiaoHang } from '../../../utils/print';

export default function GiaoHangPanel({ giaoHangId, onClose, onChanged }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('DELIVERY_MANAGE');

  const [gh, setGh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGiaoHang(giaoHangId);
      setGh(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [giaoHangId, show]);

  useEffect(() => { load(); }, [load]);

  const doConfirm = async () => {
    setBusy(true);
    try {
      await confirmGiao(giaoHangId);
      show('Đã xác nhận giao — DONE DELIVERY');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const daGiao = gh?.trang_thai === 'DA_GIAO';

  return (
    <SidePanel
      open={!!giaoHangId}
      onClose={onClose}
      title={gh ? `Phiếu giao ${gh.ma_phieu_giao}` : 'Phiếu giao'}
      subtitle={gh?.ten_khach_hang}
      footer={
        gh && (
          <>
            <Button variant="ghost" icon="file-bar-chart" onClick={() => printGiaoHang(gh)}>In phiếu giao</Button>
            {!daGiao && canManage && <Button onClick={doConfirm} loading={busy}>Xác nhận giao</Button>}
          </>
        )
      }
    >
      {loading || !gh ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          <section className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-ink-soft">Trạng thái</span>
              {daGiao ? <Badge tone="success">Đã giao</Badge> : <Badge tone="warning">Chờ giao</Badge>}</div>
            <div className="flex justify-between"><span className="text-ink-soft">Đơn hàng</span><span className="font-medium text-ink">{gh.ma_don_hang || '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Ngày giao</span><span>{fmtDate(gh.ngay_giao)}</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Tổng</span><span className="font-medium text-ink">{fmtNum(gh.tong_sl)} ({gh.so_tem} tem)</span></div>
          </section>
          <section className="border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Tem giao ({gh.tems.length})</h3>
            <div className="space-y-1.5">
              {gh.tems.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-control border border-line px-3 py-2 text-sm">
                  <span className="font-medium text-ink">{t.ma_tem}</span>
                  <span className="text-ink-soft">{t.ma_lenh_san_xuat}</span>
                  <span className="tabular-nums">{fmtNum(t.so_luong_giao)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      <Toast toast={toast} />
    </SidePanel>
  );
}
