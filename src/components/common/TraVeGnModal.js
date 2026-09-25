import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';
import { Textarea } from './controls';
import { khop } from '../../utils/timKiem';
import { danhMucTraVeGn, traVeGn } from '../../services/suaThongTinService';

// ─────────────────────────────────────────────────────────────────────────────
// "TRẢ VỀ GIAO NHẬN" — màn READY (Kỹ thuật) + QC chuẩn bị kỹ thuật (25/09/2026, mig 105).
// Tick các THÔNG TIN SAI (chọn được nhiều) + ô "Khác" gõ tự do; ô tìm lọc danh sách mục (không dấu).
// Gửi xong: phần in RỜI màn READY, sang *Đơn hàng › Phần in chờ sửa thông tin*; GN sửa rồi xác nhận
// lại là quay về READY. Danh mục mục do BACKEND trả (`utils/traVeGn.js`) — thêm mục không sửa FE.
// ─────────────────────────────────────────────────────────────────────────────

let cacheDanhMuc = null; // danh mục gần như không đổi ⇒ tải 1 lần / phiên trang

export default function TraVeGnModal({ open, onClose, phanIn, nguon = 'KT', onDone, onToast }) {
  const [danhMuc, setDanhMuc] = useState(cacheDanhMuc || []);
  const [chon, setChon] = useState(() => new Set());
  const [coKhac, setCoKhac] = useState(false);
  const [khac, setKhac] = useState('');
  const [tim, setTim] = useState('');
  const [saving, setSaving] = useState(false);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    if (!open) return;
    setChon(new Set()); setCoKhac(false); setKhac(''); setTim(''); setLoi('');
    if (cacheDanhMuc) return;
    danhMucTraVeGn()
      .then((r) => { cacheDanhMuc = r.data?.thong_tin || []; setDanhMuc(cacheDanhMuc); })
      .catch((e) => setLoi(e.message || 'Không tải được danh mục thông tin'));
  }, [open]);

  // Lọc theo ô tìm, gom theo nhóm (giữ thứ tự khai ở backend).
  const nhom = useMemo(() => {
    const m = new Map();
    danhMuc.filter((x) => !tim.trim() || khop(`${x.ten} ${x.nhom}`, tim)).forEach((x) => {
      if (!m.has(x.nhom)) m.set(x.nhom, []);
      m.get(x.nhom).push(x);
    });
    return [...m.entries()];
  }, [danhMuc, tim]);
  const hienKhac = !tim.trim() || khop('khác khac', tim);

  const bat = (ma) => setChon((s) => { const n = new Set(s); if (n.has(ma)) n.delete(ma); else n.add(ma); return n; });
  const hopLe = chon.size > 0 || (coKhac && khac.trim());

  const gui = async () => {
    if (!hopLe || !phanIn) return;
    if (coKhac && !khac.trim()) { setLoi('Đã tích "Khác" thì ghi rõ thông tin sai là gì.'); return; }
    setSaving(true); setLoi('');
    try {
      await traVeGn({ phanInId: phanIn.id, thongTin: [...chon], khac: coKhac ? khac.trim() : '', nguon });
      onToast?.(`Đã trả ${phanIn.ma_phan} về Giao nhận sửa thông tin`);
      onDone?.();
      onClose?.();
    } catch (e) {
      setLoi(e.message || 'Trả về thất bại');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={`Trả về Giao nhận — ${phanIn?.ma_phan || ''}`}
      footer={(
        <>
          <Button chiXemOk variant="ghost" onClick={onClose}>Hủy</Button>
          <Button variant="danger" icon="undo" loading={saving} disabled={!hopLe} onClick={gui}>
            Trả về GN ({chon.size + (coKhac && khac.trim() ? 1 : 0)})
          </Button>
        </>
      )}>
      <div className="space-y-3">
        <p className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Tick các <b>thông tin sai</b> cần Giao nhận sửa. Phần in sẽ <b>rời màn READY</b> tới khi GN sửa xong và
          xác nhận lại. Xác nhận Khuôn/Film/Mực đã làm vẫn được <b>giữ nguyên</b>.
        </p>
        <div className="relative">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm thông tin: màu, kích phim, hạn giao..."
            className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-3 text-base outline-none focus:border-primary md:text-sm" />
        </div>

        <div className="max-h-[45vh] space-y-3 overflow-auto pr-1">
          {nhom.map(([ten, ds]) => (
            <div key={ten}>
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">{ten}</div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {ds.map((x) => (
                  <label key={x.ma} className={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm ${
                    chon.has(x.ma) ? 'border-danger bg-rose-50 dark:bg-rose-950/30' : 'border-line hover:bg-surface-muted'}`}>
                    <input type="checkbox" checked={chon.has(x.ma)} onChange={() => bat(x.ma)} />
                    <span>{x.ten}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {!nhom.length && !hienKhac && <div className="py-4 text-center text-sm text-ink-soft">Không có mục nào khớp.</div>}
          {hienKhac && (
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Khác</div>
              <label className={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm ${
                coKhac ? 'border-danger bg-rose-50 dark:bg-rose-950/30' : 'border-line hover:bg-surface-muted'}`}>
                <input type="checkbox" checked={coKhac} onChange={(e) => setCoKhac(e.target.checked)} />
                <span>Thông tin khác (ghi rõ bên dưới)</span>
              </label>
              {coKhac && (
                <Textarea className="mt-2" rows={2} value={khac} onChange={(e) => setKhac(e.target.value)}
                  placeholder="Ghi rõ thông tin nào sai, đúng phải là gì..." autoFocus />
              )}
            </div>
          )}
        </div>
        {loi && <div className="text-sm text-danger">{loi}</div>}
      </div>
    </Modal>
  );
}
