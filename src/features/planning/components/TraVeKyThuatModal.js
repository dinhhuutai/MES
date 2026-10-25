import { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import { Field, Textarea } from '../../../components/common/controls';
import { release2TraVeKyThuat } from '../../../services/planningService';

// RELEASE 2 → TRẢ VỀ KỸ THUẬT (25/10/2026). Cùng luật BE với Test Run trả về (`returnTestRunToReady`, nguồn
// RELEASE2): lệnh GIỮ NGUYÊN, hủy kết quả test + QC ⇒ Kỹ thuật làm lại mục chọn, QC xác nhận xong lệnh tự về
// Test Run (phải test lại). "Đổi phương án in" thì HỦY lệnh, đợt vải về Release 1 (như ở Test Run).
const TECH_ITEMS = [{ ma: 'KHUON', label: 'Khuôn' }, { ma: 'FILM', label: 'Film' }, { ma: 'MUC', label: 'Mực' }];
const TECH_LABEL = { KHUON: 'Khuôn', FILM: 'Film', MUC: 'Mực' };
const LOAI = [
  { v: 'TEST_LOI', nhan: 'Kỹ thuật làm lại', mo: 'Giữ lệnh — Kỹ thuật làm lại mục chọn, QC xác nhận READY xong lệnh tự về Test Run để test lại.' },
  { v: 'DOI_PA_IN', nhan: 'Đổi phương án in', mo: 'Hủy cả 3 mục Khuôn/Film/Mực + QC, đồng thời HỦY lệnh để Kế hoạch release lại theo phương án/chuyền mới.' },
];

export default function TraVeKyThuatModal({ lenh, onClose, onDone, onToast }) {
  const [loai, setLoai] = useState('TEST_LOI');
  const [items, setItems] = useState(() => new Set());
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    if (lenh) { setLoai('TEST_LOI'); setItems(new Set()); setLyDo(''); setLoi(''); }
  }, [lenh]);

  // Tick Film ⇒ tự tick Khuôn (film làm lại thì khuôn phải chụp lại) — gương BE `normalizeTechItems`.
  const toggle = (ma) => setItems((s) => {
    const n = new Set(s);
    if (n.has(ma)) { n.delete(ma); if (ma === 'FILM') n.delete('KHUON'); } else { n.add(ma); if (ma === 'FILM') n.add('KHUON'); }
    return n;
  });

  const doiPaIn = loai === 'DOI_PA_IN';
  const du = (doiPaIn || items.size > 0) && !!lyDo.trim();

  const gui = async () => {
    if (!du || !lenh) return;
    setBusy(true); setLoi('');
    try {
      const res = await release2TraVeKyThuat(lenh.id, { checklists: [...items], lyDo: lyDo.trim(), loai });
      const d = res?.data || {};
      onToast?.(d.huy_lenh
        ? `Đã trả về Kỹ thuật — lệnh ${lenh.ma_lenh_san_xuat} đã hủy, đợt vải quay lại Release 1`
        : `Đã trả về Kỹ thuật (${(d.checklists || [...items]).map((m) => TECH_LABEL[m] || m).join(', ')}) — QC xác nhận xong lệnh về Test Run`);
      onDone?.();
      onClose?.();
    } catch (e) {
      setLoi(e.message || 'Trả về thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!lenh} onClose={() => (busy ? null : onClose?.())} size="md"
      title={`Trả về Kỹ thuật — ${lenh?.ma_lenh_san_xuat || ''}`}
      footer={(
        <>
          <Button chiXemOk variant="ghost" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button variant="danger" onClick={gui} loading={busy} disabled={!du}>
            {doiPaIn ? 'Trả về & hủy lệnh' : `Trả về Kỹ thuật (${items.size})`}
          </Button>
        </>
      )}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          {LOAI.map((o) => (
            <label key={o.v} className="flex cursor-pointer items-start gap-2 text-sm text-ink">
              <input type="radio" name="loai-tra-ve-r2" checked={loai === o.v} onChange={() => setLoai(o.v)}
                className="mt-0.5 h-4 w-4 border-line text-primary focus:ring-primary" />
              <span><b>{o.nhan}</b><span className="block text-xs text-ink-soft">{o.mo}</span></span>
            </label>
          ))}
        </div>
        {!doiPaIn ? (
          <div>
            <p className="mb-2 text-xs font-medium text-rose-700 dark:text-rose-300">Chọn mục Kỹ thuật phải làm lại:</p>
            <div className="flex flex-wrap gap-3">
              {TECH_ITEMS.map((it) => (
                <label key={it.ma} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink">
                  <input type="checkbox" checked={items.has(it.ma)} onChange={() => toggle(it.ma)}
                    className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
                  {it.label}
                </label>
              ))}
            </div>
            {items.has('FILM') && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Làm lại <b>Film</b> ⇒ <b>Khuôn</b> phải chụp lại (đã tự chọn kèm).</p>}
          </div>
        ) : (
          <p className="rounded-control border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            Lệnh <b>{lenh?.ma_lenh_san_xuat}</b> bị <b>HỦY</b>, đợt vải quay về màn <b>Release 1</b>; phần in về READY (Kỹ thuật) làm lại cả 3 mục.
          </p>
        )}
        <Field label="Lý do trả về Kỹ thuật" required>
          <Textarea rows={3} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Vì sao trả về Kỹ thuật..." />
        </Field>
        {loi && <p className="text-sm text-danger">{loi}</p>}
      </div>
    </Modal>
  );
}
