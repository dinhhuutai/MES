import { useCallback, useEffect, useState } from 'react';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import { Textarea } from '../../../components/common/controls';
import usePermissions from '../../../hooks/usePermissions';
import useSocketReload from '../../../hooks/useSocketReload';
import { getGhiChuPhanIn, themGhiChuPhanIn } from '../../../services/readyService';

// ─────────────────────────────────────────────────────────────────────────────
// Khối GHI CHÚ ở cuối SidePanel phần in (màn READY) — mig 103, 24/09/2026.
//   · Hiện ghi chú MỚI NHẤT nổi bật + ô nhập ghi chú mới + LỊCH SỬ các ghi chú trước.
//   · Phần in đang bị đánh dấu BẤT THƯỜNG ⇒ hiện banner đỏ kèm lý do.
// ⚠ Khai thành component RIÊNG (không lồng trong ReadyPanel): panel chạy `useNow(1000)` re-render mỗi
//   giây — component lồng sẽ bị dựng lại và ô nhập MẤT FOCUS / mất chữ đang gõ (bẫy §9).
// ─────────────────────────────────────────────────────────────────────────────

const QUYEN_GHI = ['READY_KHUON', 'READY_FILM', 'READY_MUC', 'READY_QC', 'READY_CANCEL'];
const fmt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

export default function GhiChuPhanIn({ phanInId, onToast }) {
  const { can } = usePermissions();
  const coQuyenGhi = QUYEN_GHI.some((p) => can(p));
  const [data, setData] = useState(null);
  const [noiDung, setNoiDung] = useState('');
  const [luu, setLuu] = useState(false);

  const tai = useCallback(async () => {
    if (!phanInId) return;
    try {
      const res = await getGhiChuPhanIn(phanInId);
      setData(res.data);
    } catch {
      setData({ ghi_chu: [], bat_thuong: null, loi: true });
    }
  }, [phanInId]);
  useEffect(() => { setNoiDung(''); tai(); }, [tai]);
  // Máy khác ghi chú / đánh dấu bất thường ⇒ cập nhật ngầm.
  useSocketReload(['ready:ghi-chu', 'ready:bat-thuong'], tai, 600);

  const doLuu = async () => {
    if (!noiDung.trim()) return;
    setLuu(true);
    try {
      const res = await themGhiChuPhanIn(phanInId, noiDung.trim());
      setData(res.data);
      setNoiDung('');
      onToast?.('Đã lưu ghi chú');
    } catch (e) {
      onToast?.(e.message || 'Lưu ghi chú thất bại', 'error');
    } finally {
      setLuu(false);
    }
  };

  if (!data) return <div className="border-t border-line pt-4 text-xs text-ink-soft">Đang tải ghi chú…</div>;

  const [moiNhat, ...cu] = data.ghi_chu || [];
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
        <Icon name="pencil" size={13} /> Ghi chú
      </h3>

      {data.thieu_migration && (
        <div className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Chưa bật tính năng ghi chú — cần chạy migration 103.
        </div>
      )}

      {data.bat_thuong && (
        <div className="rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            <Icon name="alert-triangle" size={13} /> Phần in bất thường
          </div>
          <div className="mt-1 whitespace-pre-wrap break-words">{data.bat_thuong.noi_dung}</div>
          <div className="mt-1 text-xs opacity-80">{[data.bat_thuong.nguoi_tao, fmt(data.bat_thuong.created_date)].filter(Boolean).join(' · ')}</div>
        </div>
      )}

      {moiNhat ? (
        <div className="rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
          <div className="mb-0.5 flex items-center gap-2 text-xs">
            <Badge tone="info">Mới nhất</Badge>
            <span className="opacity-80">{[moiNhat.nguoi_tao, fmt(moiNhat.created_date)].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="whitespace-pre-wrap break-words">{moiNhat.noi_dung}</div>
        </div>
      ) : (
        !data.thieu_migration && <div className="text-xs text-ink-soft">Chưa có ghi chú nào.</div>
      )}

      {coQuyenGhi && !data.thieu_migration && (
        <div className="space-y-2">
          <Textarea rows={3} value={noiDung} maxLength={2000} placeholder="Nhập ghi chú cho phần in này…"
            onChange={(e) => setNoiDung(e.target.value)} />
          <div className="flex justify-end">
            <Button icon="save" loading={luu} disabled={!noiDung.trim()} onClick={doLuu}>Lưu ghi chú</Button>
          </div>
        </div>
      )}

      {cu.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold text-ink-soft">Lịch sử ghi chú ({cu.length})</div>
          <ul className="max-h-72 space-y-2 overflow-auto pr-1">
            {cu.map((g) => (
              <li key={g.id} className="rounded-control border border-line px-3 py-2 text-sm">
                <div className="text-xs text-ink-soft">{[g.nguoi_tao, fmt(g.created_date)].filter(Boolean).join(' · ')}</div>
                <div className="mt-0.5 whitespace-pre-wrap break-words text-ink">{g.noi_dung}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
