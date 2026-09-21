import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import TemJourneyPanel from '../../../components/common/TemJourneyPanel';
import Modal from '../../../components/common/Modal';
import { Field, Textarea } from '../../../components/common/controls';
import { getGiaoHang, confirmGiao, guiLaiErpPhieuGiao, datGiaoHangTai } from '../../../services/deliveryService';
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
  // Người BẤM IN — trường `nguoi_in` của mẫu phiếu (khác `nguoi_tao` là người LẬP phiếu).
  const nguoiIn = useSelector((s) => s.auth.user?.ho_ten || s.auth.user?.ten_dang_nhap || '');

  const [gh, setGh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [journey, setJourney] = useState(null); // { temId, maTem }
  // Modal hỏi "Giao hàng tại" trước khi in — `inGop` = kiểu in đang chờ (false/true), null = đóng.
  const [inGop, setInGop] = useState(null);
  const [giaoTai, setGiaoTai] = useState('');

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

  // Gửi LẠI phiếu sang ERP. Lượt gửi lúc xác nhận giao chạy NGẦM và không bao giờ ném lỗi ⇒ ERP hỏng
  // thì không ai biết; nút này là đường đẩy lại sau khi ERP sửa xong (khỏi phải giao lại hàng).
  const doGuiLaiErp = async () => {
    setBusy(true);
    try {
      await guiLaiErpPhieuGiao(giaoHangId);
      show('ERP đã nhận phiếu giao');
    } catch (e) {
      show(e.message || 'ERP không nhận được — xem Hệ thống → Cài đặt API → Lịch sử', 'error');
    } finally {
      setBusy(false);
    }
  };

  // In phiếu — popup bị chặn thì `printPhieuGiao` NÉM lỗi, phải bắt lại để hiện Toast.
  // ⚠ Hàm ASYNC từ 08/09/2026 (hỏi mẫu đã gắn trước khi dựng) ⇒ phải `await`, nếu không lỗi rơi vào
  //   promise và try/catch đồng bộ không bắt được.
  // ⚠⚠ HỎI "Giao hàng tại" TRƯỚC KHI IN (20/09/2026) — cùng luật với tab *Phiếu giao* ở trang cha:
  //   ô đổ SẴN giá trị đang lưu, sửa thì GHI ĐÈ vào phiếu rồi mới in. Lưu hỏng ⇒ DỪNG, không in tờ
  //   mang địa điểm cũ trong khi người dùng vừa gõ địa điểm mới.
  const moIn = (gop) => { setGiaoTai(gh?.giao_hang_tai || ''); setInGop(gop); };

  const doPrint = async () => {
    const cu = gh?.giao_hang_tai || '';
    const moi = (giaoTai || '').trim();
    setBusy(true);
    try {
      let phieu = gh;
      if (moi !== cu) {
        await datGiaoHangTai(giaoHangId, moi);
        phieu = { ...gh, giao_hang_tai: moi };
        setGh(phieu);
        if (onChanged) onChanged();
      }
      const gop = inGop;
      setInGop(null);
      await printPhieuGiao(phieu, { gop, nguoiIn });
    } catch (e) {
      show(e.message || 'Không in được phiếu', 'error');
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
            {/* 2 KIỂU IN (người dùng chốt): chi tiết từng tem · gộp theo code phần. */}
            <Button variant="ghost" icon="printer" onClick={() => moIn(false)}>In chi tiết</Button>
            <Button variant="ghost" icon="printer" onClick={() => moIn(true)}>In gộp</Button>
            {daGiao && canManage && (
              <Button variant="secondary" icon="wifi" onClick={doGuiLaiErp} loading={busy}>Gửi lại ERP</Button>
            )}
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

      {/* Hỏi "Giao hàng tại" trước khi in (ô đổ sẵn giá trị đang lưu của phiếu). */}
      <Modal
        open={inGop !== null}
        onClose={() => setInGop(null)}
        title={`In phiếu giao ${inGop ? '(gộp theo phần in)' : '(chi tiết)'}`}
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setInGop(null)}>Đóng</Button>
            <Button icon="printer" loading={busy} onClick={doPrint}>In phiếu</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-soft">
          Phiếu <b className="text-ink">{gh?.ma_phieu_giao}</b> · {gh?.tems?.length || 0} tem.
          Sửa ô dưới rồi bấm in thì <b>nơi giao được ghi đè vào phiếu</b>.
        </div>
        <Field label="Giao hàng tại">
          <Textarea rows={2} value={giaoTai} onChange={(e) => setGiaoTai(e.target.value)}
            placeholder="Vd: Kho B — Lô A1, KCN Long An (để trống nếu không cần in địa điểm)" />
        </Field>
      </Modal>

      <Toast toast={toast} />
    </SidePanel>
  );
}
