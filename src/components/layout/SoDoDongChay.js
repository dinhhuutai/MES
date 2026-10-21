import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Modal from '../common/Modal';
import Icon from '../common/Icon';
import { getSoDoDongChay } from '../../services/dashboardService';
import { TRAM_SO_DO, tramCuaTrang, ownerCuaTram, gomOwner } from '../../constants/soDoDongChay';

// NÚT "SƠ ĐỒ DÒNG CHẢY" giữa thanh đầu trang (21/10/2026): chỉ hiện ở trang xác nhận thuộc dòng chảy
// (`constants/soDoDongChay.js`); bấm ⇒ modal dòng chảy dọc, mỗi trạm kèm người phụ trách (owner cấu hình ở
// *Hệ thống › Owner checkpoint / checklist*) và đánh dấu trạm của trang đang mở.
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

function DongTram({ t, so, cuoi, laDay, data, refDay }) {
  const nhom = ownerCuaTram(t, data);
  const con = (t.con || []).map(([ma, ten]) => ({ ten, nhom: gomOwner(data?.checkpoint?.[ma] || []) }))
    .filter((c) => c.nhom.length);
  return (
    <div ref={laDay ? refDay : null} className="relative flex gap-3">
      {/* Cột số + đường nối dọc */}
      <div className="flex w-8 shrink-0 flex-col items-center">
        <div className={`z-[1] flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold
          ${laDay ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-surface-muted text-ink ring-1 ring-line'}`}>{so}</div>
        {!cuoi && <div className="w-0.5 flex-1 bg-line" />}
      </div>
      <div className={`mb-2 min-w-0 flex-1 rounded-control px-3 py-2 ${laDay ? 'bg-primary-wash ring-2 ring-primary' : ''}`}>
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
        </div>
        <div className="mb-1 text-xs text-ink-soft">{t.viec}</div>
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

  useEffect(() => {
    if (!mo) return;
    if (nho.data && Date.now() - nho.tg < 60000) { setData(nho.data); return; }
    setLoi('');
    getSoDoDongChay()
      .then((r) => { nho = { tg: Date.now(), data: r.data || {} }; setData(nho.data); })
      .catch((e) => setLoi(e.message || 'Không tải được người phụ trách'));
  }, [mo]);

  // Mở modal ⇒ cuộn tới trạm của trang này.
  useEffect(() => {
    if (!mo) return undefined;
    const h = setTimeout(() => refDay.current?.scrollIntoView({ block: 'center' }), 120);
    return () => clearTimeout(h);
  }, [mo, data]);

  if (!tram) return null;
  return (
    <>
      <button type="button" onClick={() => setMo(true)} title="Sơ đồ dòng chảy — trạm và người phụ trách"
        className="inline-flex items-center gap-2 rounded-full bg-primary-wash px-3 py-1.5 text-sm font-semibold text-primary ring-1 ring-primary/20 hover:bg-primary hover:text-white">
        <Icon name="git-branch" size={16} />
        <span className="hidden md:inline">Sơ đồ dòng chảy</span>
        <span className="hidden rounded-full bg-white/70 px-1.5 text-[11px] font-semibold text-primary lg:inline dark:bg-black/20">{tram.ten}</span>
      </button>
      <Modal open={mo} onClose={() => setMo(false)} size="lg" title="Sơ đồ dòng chảy">
        {loi && <p className="mb-3 rounded-control bg-danger/5 px-3 py-2 text-sm text-danger">{loi}</p>}
        <div>
          {TRAM_SO_DO.map((t, i) => (
            <DongTram key={t.ma} t={t} so={i + 1} cuoi={i === TRAM_SO_DO.length - 1}
              laDay={t.ma === tram.ma} data={data} refDay={refDay} />
          ))}
        </div>
        <p className="mt-2 border-t border-line pt-2 text-xs text-ink-soft">
          <b className="text-ink">Tên in đậm</b> = chịu trách nhiệm chính · tên thường = xử lý. Đổi người ở Hệ thống › Owner checkpoint / checklist.
        </p>
      </Modal>
    </>
  );
}
