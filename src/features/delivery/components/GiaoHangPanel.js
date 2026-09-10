import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import TemJourneyPanel from '../../../components/common/TemJourneyPanel';
import { getGiaoHang, confirmGiao } from '../../../services/deliveryService';
import { getTemHanhTrinh } from '../../../services/qualityService';
import { fmtNum, fmtDate, maTemNhan } from '../../../utils/format';
import { printPhieuGiao } from '../utils/printPhieuGiao';

// ⚠⚠ Mã tem hiện trên phiếu = mã NGƯỜI CẦM NHÃN nhìn thấy. Tem con (mig 091) đã mang sẵn `17…` ⇒ in
//   thẳng; tem gốc / dữ liệu cũ mới ghép tiền tố theo nguồn. Dùng `temCode()` — bản cũ nối chuỗi
//   `'17-' + ma_tem` cho ra `17-152608057689` (sai với mã ERP 12 số), đúng lỗi đã sửa ở OQC/Giao.
// ⚠⚠ TEM 13 GIA CÔNG cũng mang mã riêng `13…` (06/09/2026) và đi ở nguồn KCS ⇒ ghép `15` sẽ
//   biến nó thành mã KHÔNG có thật. `maTemNhan` chặn ca đó.
const maHien = (t) => maTemNhan(t.ma_tem, t.nguon === 'SUA' ? 17 : 15, null, t.la_tem_sua);

export default function GiaoHangPanel({ giaoHangId, onClose, onChanged }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('DELIVERY_MANAGE');

  const [gh, setGh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [journey, setJourney] = useState(null); // { temId, maTem }

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

  // In phiếu — popup bị chặn thì `printPhieuGiao` NÉM lỗi, phải bắt lại để hiện Toast.
  // ⚠ Hàm ASYNC từ 08/09/2026 (hỏi mẫu đã gắn trước khi dựng) ⇒ phải `await`, nếu không lỗi rơi vào
  //   promise và try/catch đồng bộ không bắt được.
  const doPrint = async (gop) => {
    try { await printPhieuGiao(gh, { gop }); }
    catch (e) { show(e.message || 'Không mở được cửa sổ in', 'error'); }
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
            {/* 2 KIỂU IN (người dùng chốt): chi tiết từng tem · gộp theo code phần. */}
            <Button variant="ghost" icon="printer" onClick={() => doPrint(false)}>In chi tiết</Button>
            <Button variant="ghost" icon="printer" onClick={() => doPrint(true)}>In gộp</Button>
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
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-sm">
                  <span className="font-medium text-ink">{maHien(t)}</span>
                  {t.nguon && <Badge tone={t.nguon === 'SUA' || t.la_tem_sua ? 'warning' : 'info'}>{t.nguon === 'SUA' || t.la_tem_sua ? 'Sửa' : 'KCS'}</Badge>}
                  <span className="text-ink-soft">{t.phan_list || t.ma_lenh_san_xuat}</span>
                  <span className="ml-auto tabular-nums">{fmtNum(t.so_luong_giao)}</span>
                  <button type="button" onClick={() => setJourney({ temId: t.tem_id, maTem: t.ma_tem })}
                    className="rounded-control border border-line px-2 py-0.5 text-xs text-ink-soft hover:bg-surface-muted">Hành trình</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {journey && (
        <TemJourneyPanel temId={journey.temId} maTem={journey.maTem}
          fetcher={getTemHanhTrinh} onClose={() => setJourney(null)} />
      )}
      <Toast toast={toast} />
    </SidePanel>
  );
}
