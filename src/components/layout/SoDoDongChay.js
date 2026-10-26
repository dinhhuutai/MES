import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Modal from '../common/Modal';
import Icon from '../common/Icon';
import { inputClass } from '../common/controls';
import { getSoDoDongChay, timViTriSoDo } from '../../services/dashboardService';
import {
  TRAM_SO_DO, tramCuaTrang, ownerCuaTram, gomOwner, viTriTheoTram,
} from '../../constants/soDoDongChay';

// NÚT "SƠ ĐỒ DÒNG CHẢY" giữa thanh đầu trang (21/10/2026): chỉ hiện ở trang xác nhận thuộc dòng chảy
// (`constants/soDoDongChay.js`); bấm ⇒ modal dòng chảy dọc, mỗi trạm kèm người phụ trách (owner cấu hình ở
// *Hệ thống › Owner checkpoint / checklist*) và đánh dấu trạm của trang đang mở.
// ⚠ 26/10/2026: ô "Tìm code phần" — nhập code phần (hoặc quét mã TDTHĐH) ⇒ tô các trạm phần in đang nằm (từng đợt vải +
//   tem sau sản xuất, `GET /dashboard/so-do-dong-chay/tim`) để người không thấy hàng ở trạm mình biết hỏi ai.
// Màu nhãn phòng — chỉ để phân nhóm bằng mắt.
const MAU_PHONG = {
  'Phòng bán hàng': 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60',
  'Phòng kỹ thuật': 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/60',
  'Phòng QC': 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60',
  'Phòng kế hoạch': 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/60',
  'Sản xuất': 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900/60',
  KCS: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/60',
};

// Dữ liệu owner nhớ 60 s giữa các lần mở (đổi trang không tải lại).
let nho = { tg: 0, data: null };

function DanhSachNguoi({ nhom }) {
  if (!nhom.length) return <span className="text-xs text-ink-soft">Chưa gán người phụ trách</span>;
  return (
    <div className="space-y-0.5">
      {nhom.map((g) => (
        <div key={g.ghiChu || '_'} className="text-sm leading-snug">
          {g.ghiChu && <span className="mr-1 text-xs font-semibold text-ink-soft">{g.ghiChu}:</span>}
          {g.nguoi.map((p, i) => (
            <span key={p.ten}>
              {i > 0 && <span className="text-ink-soft">, </span>}
              <span className={p.chinh ? 'font-semibold text-ink' : 'text-ink'}>{p.ten}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function DongTram({ t, so, cuoi, laDay, data, refDay, viTri, refTram }) {
  const nhom = ownerCuaTram(t, data);
  const con = (t.con || []).map(([ma, ten]) => ({ ten, nhom: gomOwner(data?.checkpoint?.[ma] || []) }))
    .filter((c) => c.nhom.length);
  const vt = viTri || [];
  const coHang = vt.some((x) => !x.xong);
  return (
    <div ref={(el) => { if (laDay && refDay) refDay.current = el; if (refTram) refTram(t.ma, el); }} className="relative flex gap-3">
      {/* Cột số + đường nối dọc */}
      <div className="flex w-8 shrink-0 flex-col items-center">
        <div className={`z-[1] flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold
          ${coHang ? 'bg-amber-500 text-white ring-4 ring-amber-300/40' : laDay ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-surface-muted text-ink ring-1 ring-line'}`}>{so}</div>
        {!cuoi && <div className="w-0.5 flex-1 bg-line" />}
      </div>
      <div className={`mb-2 min-w-0 flex-1 rounded-control px-3 py-2 ${coHang ? 'bg-amber-50 ring-2 ring-amber-400 dark:bg-amber-950/30' : laDay ? 'bg-primary-wash ring-2 ring-primary' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-bold text-ink">{t.ten}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${MAU_PHONG[t.phong] || 'bg-surface-muted text-ink-soft ring-line'}`}>
            {t.phong}
          </span>
          {laDay && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">
              <Icon name="eye" size={12} /> Trang này
            </span>
          )}
          {coHang && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
              <Icon name="map-pin" size={12} /> Code phần đang ở đây
            </span>
          )}
        </div>
        <div className="mb-1 text-xs text-ink-soft">{t.viec}</div>
        {vt.length > 0 && (
          <ul className="mb-1.5 space-y-0.5">
            {vt.map((x) => (
              <li key={`${x.chu}|${x.phu || ''}`} className={`text-xs leading-snug ${x.xong ? 'text-ink-soft' : 'font-medium text-amber-800 dark:text-amber-300'}`}>
                {x.xong ? '✓ ' : '● '}{x.chu}
                {x.phu && <span className="font-normal text-ink-soft"> · {x.phu}</span>}
              </li>
            ))}
          </ul>
        )}
        {data ? <DanhSachNguoi nhom={nhom} /> : <span className="text-xs text-ink-soft">Đang tải…</span>}
        {con.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-soft">
            {con.map((c) => (
              <span key={c.ten}>{c.ten}: {c.nhom.flatMap((g) => g.nguoi.map((p) => p.ten)).join(', ')}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SoDoDongChayNut() {
  const { pathname } = useLocation();
  const tram = tramCuaTrang(pathname);
  const [mo, setMo] = useState(false);
  const [data, setData] = useState(nho.data);
  const [loi, setLoi] = useState('');
  const refDay = useRef(null);
  // TÌM CODE PHẦN (26/10/2026).
  const [tim, setTim] = useState('');
  const [dangTim, setDangTim] = useState(false);
  const [kq, setKq] = useState(null); // { ds, qua_nhieu, q }
  const [chonPin, setChonPin] = useState(0);
  const refTram = useRef({});
  const datRefTram = (ma, el) => { refTram.current[ma] = el; };
  const pin = kq && kq.ds[chonPin] ? kq.ds[chonPin] : null;
  const viTri = viTriTheoTram(pin);
  const tramCoHang = TRAM_SO_DO.filter((t) => (viTri[t.ma] || []).some((x) => !x.xong));
  const timCode = async (e) => {
    if (e) e.preventDefault();
    const q = tim.trim();
    if (q.length < 3) { setKq({ ds: [], qua_nhieu: false, q, ngan: true }); return; }
    setDangTim(true);
    try {
      const r = await timViTriSoDo(q);
      setKq({ ...(r.data || { ds: [] }), q });
      setChonPin(0);
    } catch (err) {
      setKq({ ds: [], qua_nhieu: false, q, loi: err.message || 'Không tìm được' });
    } finally { setDangTim(false); }
  };
  const xoaTim = () => { setTim(''); setKq(null); setChonPin(0); };
  // Có kết quả ⇒ cuộn tới trạm ĐẦU TIÊN phần in đang nằm.
  const tramDau = tramCoHang[0] ? tramCoHang[0].ma : null;
  useEffect(() => {
    if (!tramDau) return undefined;
    const h = setTimeout(() => refTram.current[tramDau]?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
    return () => clearTimeout(h);
  }, [tramDau, pin]);

  useEffect(() => {
    if (!mo) return;
    if (nho.data && Date.now() - nho.tg < 60000) { setData(nho.data); return; }
    setLoi('');
    getSoDoDongChay()
      .then((r) => { nho = { tg: Date.now(), data: r.data || {} }; setData(nho.data); })
      .catch((e) => setLoi(e.message || 'Không tải được người phụ trách'));
  }, [mo]);

  // Mở modal ⇒ cuộn tới trạm của trang này (đang xem kết quả tìm thì thôi).
  useEffect(() => {
    if (!mo || kq) return undefined;
    const h = setTimeout(() => refDay.current?.scrollIntoView({ block: 'center' }), 120);
    return () => clearTimeout(h);
  }, [mo, data, kq]);

  if (!tram) return null;
  return (
    <>
      <button type="button" onClick={() => setMo(true)} title="Sơ đồ dòng chảy — trạm và người phụ trách"
        className="inline-flex items-center gap-2 rounded-full bg-primary-wash px-3 py-1.5 text-sm font-semibold text-primary ring-1 ring-primary/20 hover:bg-primary hover:text-white">
        <Icon name="git-branch" size={16} />
        <span className="hidden md:inline">Sơ đồ dòng chảy</span>
        <span className="hidden rounded-full bg-white/70 px-1.5 text-[11px] font-semibold text-primary lg:inline dark:bg-black/20">{tram.ten}</span>
      </button>
      <Modal open={mo} onClose={() => { setMo(false); xoaTim(); }} size="lg" title="Sơ đồ dòng chảy">
        {loi && <p className="mb-3 rounded-control bg-danger/5 px-3 py-2 text-sm text-danger">{loi}</p>}
        {/* TÌM CODE PHẦN — code phần đang ở trạm nào để biết liên hệ ai. */}
        <form onSubmit={timCode} className="sticky -top-4 z-10 -mx-1 -mt-4 mb-3 bg-surface px-1 pb-2 pt-4 sm:-top-5 sm:-mt-5 sm:pt-5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm code phần (hoặc quét mã TDTHĐH) — xem đang ở trạm nào"
                className={`${inputClass} pl-9 pr-8`} aria-label="Tìm code phần" />
              {tim && (
                <button type="button" onClick={xoaTim} aria-label="Xóa tìm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-danger"><Icon name="x" size={14} /></button>
              )}
            </div>
            <button type="submit" disabled={dangTim}
              className="h-10 shrink-0 rounded-control bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
              {dangTim ? 'Đang tìm…' : 'Tìm'}
            </button>
          </div>
          {kq && (
            <div className="mt-2 text-sm">
              {kq.loi && <p className="text-danger">{kq.loi}</p>}
              {kq.ngan && <p className="text-ink-soft">Nhập ít nhất 3 ký tự của code phần.</p>}
              {!kq.loi && !kq.ngan && !kq.ds.length && <p className="text-ink-soft">Không tìm thấy code phần nào khớp «{kq.q}».</p>}
              {kq.ds.length > 1 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {kq.ds.map((p, i) => (
                    <button key={p.phan_in_id} type="button" onClick={() => setChonPin(i)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${i === chonPin ? 'bg-amber-500 text-white ring-amber-500' : 'bg-surface text-ink ring-line hover:ring-amber-400'}`}>
                      {p.ma_phan}
                    </button>
                  ))}
                  {kq.qua_nhieu && <span className="self-center text-xs text-ink-soft">… còn nữa — gõ đủ code phần</span>}
                </div>
              )}
              {pin && (
                <div className="rounded-control bg-amber-50 px-3 py-2 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900/60">
                  <div className="font-semibold text-ink">{pin.ma_phan}</div>
                  <div className="text-xs text-ink-soft">
                    {[pin.khach, pin.don, pin.ma_hang, pin.mau_vai, [pin.kich_vai, pin.kich_phim].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}
                  </div>
                  <div className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                    {!pin.dang_hoat_dong
                      ? 'Phần in đã bị hủy / ẩn (hết đợt vải sống) — không nằm ở trạm nào. Mở lại ở Hệ thống › Hủy lệnh xác nhận.'
                      : tramCoHang.length
                        ? `Đang ở: ${tramCoHang.map((t) => t.ten).join(' · ')}`
                        : (viTri.GIAO || []).length ? 'Đã giao hết — không còn ở trạm nào.' : 'Chưa có đợt vải nào lên MES (chưa vào dòng chảy).'}
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
        <div>
          {TRAM_SO_DO.map((t, i) => (
            <DongTram key={t.ma} t={t} so={i + 1} cuoi={i === TRAM_SO_DO.length - 1}
              laDay={t.ma === tram.ma} data={data} refDay={refDay} viTri={viTri[t.ma]} refTram={datRefTram} />
          ))}
        </div>
        <p className="mt-2 border-t border-line pt-2 text-xs text-ink-soft">
          <b className="text-ink">Tên in đậm</b> = chịu trách nhiệm chính · tên thường = xử lý · <span className="font-semibold text-amber-700 dark:text-amber-300">trạm vàng</span> = code phần vừa tìm đang ở đó. Đổi người ở Hệ thống › Owner checkpoint / checklist.
        </p>
      </Modal>
    </>
  );
}
