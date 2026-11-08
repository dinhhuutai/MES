import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { viTriLich } from './DateRangePicker';

// Ô CHỌN 1 NGÀY TIẾNG VIỆT (05/11/2026, người dùng: "các input lịch chọn ngày phải là tiếng Việt hết").
// Thay `<input type="date">`: lịch của ô gốc đi theo NGÔN NGỮ TRÌNH DUYỆT, trang web không đổi được (thuộc tính `lang` không
// có tác dụng) ⇒ Chrome tiếng Anh hiện "November 2026 · Today · Clear". Ô này hiện dd/mm/yyyy + lịch riêng, ở mọi máy như nhau.
//
// Dùng được thay thế trực tiếp: `value` / `min` / `max` = 'YYYY-MM-DD', `onChange(e)` đọc `e.target.value` như ô gốc
// (xóa ngày ⇒ ''). `Input type="date"` (`controls.js`) tự đi qua đây. ĐỪNG dùng `<input type="date">` thuần ở màn mới.
// Gõ tay được: 05112026 hoặc 5/11/2026 (năm 2 số ⇒ 20xx); rời ô mà chưa đúng ngày ⇒ trả về ngày đang chọn.
// Máy cảm ứng chỉ chọn trên lịch, không bật bàn phím.
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const taoNgay = (y, m, d) => {
  const n = new Date(y, m - 1, d);
  return n.getFullYear() === y && n.getMonth() === m - 1 && n.getDate() === d ? n : null;
};
const fromISO = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? taoNgay(Number(m[1]), Number(m[2]), Number(m[3])) : null;
};
const hien = (s) => {
  const d = fromISO(s);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
};
// Chữ đang gõ → 'YYYY-MM-DD' | null. Nhận "05112026", "051126", "5/11/2026", "5-11-26".
export const docNgayGo = (chu) => {
  const s = String(chu || '').trim();
  let m = /^(\d{1,2})\D+(\d{1,2})\D+(\d{4}|\d{2})$/.exec(s);
  if (!m) m = /^(\d{2})(\d{2})(\d{4}|\d{2})$/.exec(s);
  if (!m) return null;
  const nam = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (nam < 1900 || nam > 2100) return null; // "05/11/0260" đang gõ dở: chưa phải ngày
  const d = taoNgay(nam, Number(m[2]), Number(m[1]));
  return d ? toISO(d) : null;
};
// Chỉ gõ số ⇒ tự chèn dấu "/".
const dinhDangKhiGo = (chu) => {
  if (/\D/.test(chu.replace(/\//g, '')) || !/^[\d/]*$/.test(chu)) return chu;
  const so = chu.replace(/\//g, '').slice(0, 8);
  if (so.length <= 2) return so;
  if (so.length <= 4) return `${so.slice(0, 2)}/${so.slice(2)}`;
  return `${so.slice(0, 2)}/${so.slice(2, 4)}/${so.slice(4)}`;
};

const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const cungNgay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function NgayInput({
  value = '', onChange, min, max, disabled, readOnly, className = '', placeholder = 'dd/mm/yyyy', id, title,
  autoFocus, 'aria-label': ariaLabel, name,
}) {
  const [mo, setMo] = useState(false);
  const [chu, setChu] = useState(() => hien(value));
  const [thang, setThang] = useState(() => fromISO(value) || new Date());
  const [viTri, setViTri] = useState(null);
  const khung = useRef(null);
  const oNhap = useRef(null);
  const khoa = disabled || readOnly;
  const cam_ung = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  useEffect(() => { setChu(hien(value)); }, [value]);

  useEffect(() => {
    if (!mo) return undefined;
    const ngoai = (e) => { if (khung.current && !khung.current.contains(e.target)) setMo(false); };
    const tinhLai = () => { if (oNhap.current) setViTri(viTriLich(oNhap.current)); };
    document.addEventListener('mousedown', ngoai);
    document.addEventListener('touchstart', ngoai);
    window.addEventListener('resize', tinhLai);
    window.addEventListener('scroll', tinhLai, true);
    return () => {
      document.removeEventListener('mousedown', ngoai);
      document.removeEventListener('touchstart', ngoai);
      window.removeEventListener('resize', tinhLai);
      window.removeEventListener('scroll', tinhLai, true);
    };
  }, [mo]);

  const ngoaiKhoang = (iso) => (min && iso < min) || (max && iso > max);
  const dat = (iso) => { if (onChange) onChange({ target: { value: iso, name }, currentTarget: { value: iso, name } }); };

  const moLich = () => {
    if (khoa) return;
    setThang(fromISO(value) || new Date());
    if (oNhap.current) setViTri(viTriLich(oNhap.current));
    setMo(true);
  };
  const go = (e) => {
    const v = dinhDangKhiGo(e.target.value);
    setChu(v);
    if (!v.trim()) return; // đang xóa để gõ lại: chưa báo lên trang, rời ô mới tính (tránh tải lại danh sách giữa chừng)
    // Đang gõ chỉ nhận khi đủ năm 4 số: "05/11/20" còn đang gõ dở 2026 (năm 2 số chỉ tính lúc rời ô / Enter).
    const iso = /\d{4}$/.test(v) ? docNgayGo(v) : null;
    if (iso && !ngoaiKhoang(iso)) {
      if (iso !== value) dat(iso);
      setThang(fromISO(iso) || thang);
    }
  };
  const roiO = () => {
    setMo(false);
    if (!chu.trim()) { if (value) dat(''); return; }
    const iso = docNgayGo(chu);
    if (iso && !ngoaiKhoang(iso)) { if (iso !== value) dat(iso); setChu(hien(iso)); return; }
    setChu(hien(value));
  };
  const phim = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); roiO(); }
    // Chặn nổi lên: đang mở lịch trong SidePanel / Modal thì Esc chỉ đóng lịch, không đóng cả panel.
    if (e.key === 'Escape' && mo) { e.stopPropagation(); setMo(false); setChu(hien(value)); }
  };
  const chon = (d) => { const iso = toISO(d); dat(iso); setChu(hien(iso)); setMo(false); };

  const oNgay = useMemo(() => {
    const y = thang.getFullYear();
    const m = thang.getMonth();
    const dau = (new Date(y, m, 1).getDay() + 6) % 7; // thứ 2 đầu tuần
    const so = new Date(y, m + 1, 0).getDate();
    const ds = [];
    for (let i = 0; i < dau; i += 1) ds.push(null);
    for (let d = 1; d <= so; d += 1) ds.push(new Date(y, m, d));
    return ds;
  }, [thang]);

  const chonD = fromISO(value);
  const homNay = new Date();
  const hopLeHomNay = !ngoaiKhoang(toISO(homNay));
  const doiThang = (n) => setThang(new Date(thang.getFullYear(), thang.getMonth() + n, 1));
  const lopNut = 'rounded p-1 text-ink-soft hover:bg-surface-muted';
  // `w-full` (ô trong form) ⇒ chiếm hết hàng; còn lại ô gọn đủ dd/mm/yyyy như ô gốc.
  const tran = /(^|\s)w-full(\s|$)/.test(className) && !/(^|\s)w-auto(\s|$)/.test(className);
  const lopO = className.split(/\s+/).filter((c) => c !== 'w-auto').join(' ');

  return (
    // ⚠ Chặn click nổi lên (08/11/2026 — người dùng: "Báo cáo của tôi, bấm đổi ngày thì bị bấm vào báo cáo luôn"): ô ngày
    //   + lịch nổi nằm TRONG dòng bảng (`DataTable onRowClick`) / thẻ có onClick ⇒ chọn ngày trên lịch là mở luôn dòng đó.
    //   Lịch không portal (xem đầu file) nên phải chặn ở đây; prop `onClick` của trang (bản ô gốc) bị bỏ qua.
    <div ref={khung} onClick={(e) => e.stopPropagation()}
      className={`relative ${tran ? 'block w-full' : 'inline-block w-[9.5rem]'}`}>
      <Icon name="calendar-days" size={15} className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-ink-soft" />
      <input
        ref={oNhap} type="text" inputMode="numeric" autoComplete="off" value={chu} id={id} name={name} title={title}
        aria-label={ariaLabel} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus}
        readOnly={readOnly || cam_ung}
        onChange={go} onFocus={moLich} onBlur={roiO} onKeyDown={phim}
        // Bôi đen cả ô khi bấm ⇒ gõ là thay ngày, không lẫn vào số cũ.
        onClick={(e) => { if (!mo) moLich(); if (!cam_ung) e.target.select(); }}
        className={`${lopO} w-full pl-8 ${khoa ? '' : 'cursor-pointer'}`}
      />
      {mo && (
        // Lịch nổi `fixed`, KHÔNG portal ra body: trong SidePanel / Modal bấm ra ngoài Dialog.Panel là đóng cả panel.
        // Giữ con trỏ ở ô nhập khi bấm trong lịch ⇒ không dính `onBlur`.
        <div role="group" aria-label="Chọn ngày" onMouseDown={(e) => e.preventDefault()}
          className="fixed z-[75] w-[280px] rounded-card border border-line bg-surface p-3 shadow-card-hover" style={viTri || undefined}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center">
              <button type="button" aria-label="Năm trước" title="Năm trước" onClick={() => doiThang(-12)} className={lopNut}><Icon name="chevrons-left" size={16} /></button>
              <button type="button" aria-label="Tháng trước" title="Tháng trước" onClick={() => doiThang(-1)} className={lopNut}><Icon name="chevron-left" size={16} /></button>
            </div>
            <span className="text-sm font-semibold text-ink">Tháng {thang.getMonth() + 1}/{thang.getFullYear()}</span>
            <div className="flex items-center">
              <button type="button" aria-label="Tháng sau" title="Tháng sau" onClick={() => doiThang(1)} className={lopNut}><Icon name="chevron-right" size={16} /></button>
              <button type="button" aria-label="Năm sau" title="Năm sau" onClick={() => doiThang(12)} className={lopNut}><Icon name="chevrons-right" size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-ink-soft">
            {THU.map((t) => <div key={t} className="py-1">{t}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {oNgay.map((d, i) => {
              if (!d) return <div key={i} />;
              const iso = toISO(d);
              const dangChon = cungNgay(d, chonD);
              const laHomNay = cungNgay(d, homNay);
              return (
                <button key={i} type="button" disabled={!!ngoaiKhoang(iso)} onClick={() => chon(d)}
                  className={`h-9 rounded text-sm sm:h-8 sm:text-xs disabled:cursor-not-allowed disabled:opacity-30 ${dangChon
                    ? 'bg-primary font-semibold text-white'
                    : `text-ink hover:bg-surface-muted ${laHomNay ? 'font-semibold ring-1 ring-inset ring-primary/40' : ''}`}`}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between">
            <button type="button" disabled={!hopLeHomNay} onClick={() => chon(homNay)}
              className="text-xs text-primary hover:underline disabled:opacity-40">Hôm nay</button>
            <button type="button" onClick={() => { dat(''); setChu(''); setMo(false); }}
              className="text-xs text-ink-soft hover:text-danger">Xóa</button>
          </div>
        </div>
      )}
    </div>
  );
}
