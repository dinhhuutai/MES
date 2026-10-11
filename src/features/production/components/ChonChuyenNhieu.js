import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/common/Icon';
import { khop } from '../../../utils/timKiem';
import { nhanNhom } from '../utils/gomBaoCao';

// ─────────────────────────────────────────────────────────────────────────────
// BỘ CHỌN CHUYỀN (chọn nhiều) cho 3 trang báo cáo của module Sản xuất (11/10/2026 — "theo từng chuyền, cho chọn
// chuyền"). `ds` = [{ ma, ten, nhom }] (từ `gomBaoCao.dsChuyen`), `value` = mảng mã chuyền đang chọn (rỗng = TẤT CẢ).
// Hộp danh sách vẽ `position: fixed` theo toạ độ thật của nút (thanh công cụ có thể nằm trong vùng cuộn/ẩn tràn).
// ─────────────────────────────────────────────────────────────────────────────
export default function ChonChuyenNhieu({ ds = [], value = [], onChange }) {
  const [mo, setMo] = useState(false);
  const [tim, setTim] = useState('');
  const [viTri, setViTri] = useState(null);
  const nut = useRef(null);
  const hop = useRef(null);

  useLayoutEffect(() => {
    if (!mo || !nut.current) { setViTri(null); return; }
    const r = nut.current.getBoundingClientRect();
    setViTri({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 288)) });
  }, [mo]);
  useEffect(() => {
    if (!mo) return undefined;
    const ngoai = (e) => {
      if (nut.current?.contains(e.target) || hop.current?.contains(e.target)) return;
      setMo(false);
    };
    const dong = () => setMo(false);
    document.addEventListener('mousedown', ngoai);
    window.addEventListener('resize', dong);
    return () => { document.removeEventListener('mousedown', ngoai); window.removeEventListener('resize', dong); };
  }, [mo]);

  const chon = useMemo(() => new Set(value), [value]);
  const hien = useMemo(() => ds.filter((c) => !tim.trim() || khop(`${c.ma} ${c.ten} ${nhanNhom(c.nhom)}`, tim)), [ds, tim]);
  const doi = (ma) => {
    const n = new Set(chon);
    if (n.has(ma)) n.delete(ma); else n.add(ma);
    onChange(ds.map((c) => c.ma).filter((m) => n.has(m)));
  };
  const nhan = !value.length ? 'Tất cả chuyền' : value.length <= 2 ? value.join(', ') : `${value.length} chuyền`;

  return (
    <>
      <button ref={nut} type="button" onClick={() => setMo((v) => !v)} title="Chọn chuyền để xem"
        className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-control border px-3 text-sm font-medium transition-colors ${
          value.length ? 'border-primary bg-primary-wash text-primary' : 'border-line bg-surface text-ink hover:bg-surface-muted'}`}>
        <Icon name="factory" size={15} />
        {nhan}
        <Icon name="chevron-down" size={14} className={mo ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {mo && viTri && (
        <div ref={hop} style={{ top: viTri.top, left: viTri.left }}
          className="fixed z-[70] w-[280px] rounded-control border border-line bg-surface p-2 shadow-card-hover">
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm chuyền..." autoFocus
            className="mb-2 h-9 w-full rounded-input border border-line bg-surface px-2.5 text-base outline-none focus:border-primary md:text-sm" />
          <div className="mb-1 flex items-center justify-between px-1 text-xs">
            <button type="button" className="font-medium text-primary hover:underline"
              onClick={() => onChange([...new Set([...value, ...hien.map((c) => c.ma)])])}>Chọn hết{tim.trim() ? ' (đang tìm)' : ''}</button>
            <button type="button" className="font-medium text-ink-soft hover:text-danger disabled:opacity-40" disabled={!value.length}
              onClick={() => onChange([])}>Bỏ chọn — xem tất cả</button>
          </div>
          <div className="max-h-[46vh] overflow-auto">
            {hien.length === 0 && <div className="px-2 py-3 text-center text-xs text-ink-soft">Không có chuyền nào khớp.</div>}
            {hien.map((c) => (
              <label key={c.ma} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-muted">
                <input type="checkbox" checked={chon.has(c.ma)} onChange={() => doi(c.ma)} />
                <span className="min-w-0 flex-1 truncate">
                  <b className="font-semibold text-ink">{c.ma}</b>
                  {c.ten && c.ten !== c.ma ? <span className="ml-1 text-xs text-ink-soft">{c.ten}</span> : null}
                </span>
                <span className="shrink-0 text-[11px] text-ink-soft">{nhanNhom(c.nhom)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
