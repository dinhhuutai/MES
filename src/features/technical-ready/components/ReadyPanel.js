import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import OwnerHint from '../../../components/common/OwnerHint';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNow from '../../../hooks/useNow';
import { evalSla, SLA_BADGE, fmtDur } from '../../../utils/sla';
import { getReadyDetail, confirmReadyItem, confirmReadyItemsBatch } from '../../../services/readyService';

// 3 mục kỹ thuật + quyền tương ứng. Thứ tự hiển thị: FILM → KHUÔN → MỰC (HSKT đã bỏ).
// KHÔNG còn chọn giá trị (mới/cũ/gia công) — chỉ cần XÁC NHẬN là xong (đã bỏ ràng buộc Film-trước-Khuôn).
const ITEMS = [
  { ma: 'FILM', label: 'Film', perm: 'READY_FILM' },
  { ma: 'KHUON', label: 'Khuôn', perm: 'READY_KHUON' },
  { ma: 'MUC', label: 'Mực', perm: 'READY_MUC' },
];

const fmt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

export default function ReadyPanel({ phanInId, onClose, onChanged }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null); // ma đang submit

  const byMa = (detail?.checkpoints || []).reduce((acc, c) => ({ ...acc, [c.ma_checkpoint]: c }), {});
  const state = detail?.state || {};

  const load = useCallback(async () => {
    if (!phanInId) return;
    setLoading(true);
    try {
      const res = await getReadyDetail(phanInId);
      setDetail(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [phanInId, show]);

  useEffect(() => { load(); }, [load]);

  const doConfirm = async (item) => {
    setBusy(item.ma);
    try {
      await confirmReadyItem(phanInId, item.ma);
      show(`Đã xác nhận ${item.label}`);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setBusy(null);
    }
  };

  // Mục đủ điều kiện xác nhận hàng loạt: có quyền + chưa done (không còn ràng buộc giá trị/phụ thuộc).
  const eligible = state.qc_done ? [] : ITEMS.filter((it) => !state[`${it.ma.toLowerCase()}_done`] && can(it.perm));

  const doConfirmAll = async () => {
    setBusy('__ALL__');
    try {
      await confirmReadyItemsBatch(phanInId, eligible.map((it) => ({ ma: it.ma })));
      show(`Đã xác nhận ${eligible.length} mục`);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setBusy(null);
    }
  };

  // Render từng mục dạng HÀM (không phải component lồng) để tránh remount mỗi giây khi `now` cập nhật.
  const renderItem = (item) => {
    const cp = byMa[item.ma];
    const done = state[`${item.ma.toLowerCase()}_done`];
    const canEdit = !done && !state.qc_done && can(item.perm);
    const sla = (!done && cp?.thoi_gian_quy_dinh_phut)
      ? evalSla(detail?.ready_tg_vao, cp.thoi_gian_quy_dinh_phut, cp.canh_bao_truoc_phut, now)
      : null;

    return (
      <div key={item.ma} className="rounded-control border border-line p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{item.label}</span>
          <div className="flex items-center gap-1.5">
            {sla && sla.status !== 'OK' && (
              <Badge tone={SLA_BADGE[sla.status].tone}>{SLA_BADGE[sla.status].label} · {fmtDur(sla.phut)}/{fmtDur(cp.thoi_gian_quy_dinh_phut)}</Badge>
            )}
            {done
              ? <Badge tone="success">Đã xác nhận</Badge>
              : <Badge tone="default">Chưa xác nhận</Badge>}
          </div>
        </div>
        {!done && <OwnerHint checkpoint={item.ma} className="mb-2" />}

        {done ? (
          <div className="text-sm text-ink-soft">
            {cp?.gia_tri_text ? <div className="text-ink">{cp.gia_tri_text}</div> : null}
            {cp?.nguoi_xac_nhan_ten ? <div className="text-xs font-medium text-ink">{cp.nguoi_xac_nhan_ten}</div> : null}
            {cp?.tg_xac_nhan ? <div className="text-xs">Lúc {fmt(cp.tg_xac_nhan)}</div> : null}
          </div>
        ) : canEdit ? (
          <Button className="w-full" loading={busy === item.ma} onClick={() => doConfirm(item)}>
            Xác nhận {item.label}
          </Button>
        ) : (
          <div className="text-xs text-ink-soft">
            {can(item.perm) ? 'Chưa thực hiện.' : 'Bạn không có quyền xác nhận mục này.'}
          </div>
        )}
      </div>
    );
  };

  return (
    <SidePanel
      open={!!phanInId}
      onClose={onClose}
      title={detail?.phan_in ? `READY — ${detail.phan_in.ma_phan}` : 'Chuẩn bị kỹ thuật'}
      subtitle={detail?.phan_in ? `${detail.phan_in.ten_khach_hang} · ${detail.phan_in.mau_vai}` : ''}
    >
      {loading || !detail ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-4">
          {state.qc_done ? (
            <div className="rounded-control border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              READY hoàn thành — đã QC xác nhận, sẵn sàng Release 1.
            </div>
          ) : state.tech_done ? (
            <div className="rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
              Đã đủ 3 mục kỹ thuật — chờ QC xác nhận (Module Chất lượng).
            </div>
          ) : (
            <div className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Mỗi bộ phận xác nhận mục của mình. Đủ 3 mục sẽ chuyển sang chờ QC.
            </div>
          )}

          {eligible.length > 0 && (
            <Button className="w-full" loading={busy === '__ALL__'} onClick={doConfirmAll}>
              Xác nhận tất cả ({eligible.length} mục)
            </Button>
          )}

          {ITEMS.map((item) => renderItem(item))}

          <div className="space-y-2 border-t border-line pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Tiến trình</h3>
            <div className="flex items-center justify-between rounded-control border border-line px-3 py-2">
              <span className="text-sm font-medium text-ink">Kỹ thuật (3 mục)</span>
              {state.tech_done
                ? <Badge tone="success">Hoàn tất</Badge>
                : <Badge tone="warning">{[state.khuon_done, state.film_done, state.muc_done].filter(Boolean).length}/3</Badge>}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-ink-soft">
              <Icon name="shield-check" size={14} /> QC thực hiện tại Module Chất lượng → QC chuẩn bị kỹ thuật.
            </p>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </SidePanel>
  );
}
