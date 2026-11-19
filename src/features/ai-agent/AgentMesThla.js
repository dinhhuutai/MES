import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Pin, PinOff, Maximize2, Minimize2, Minus, X, Plus, History, Send, ThumbsUp, ThumbsDown, Trash2,
  ChevronDown, ChevronUp, Database, Globe, BookOpen, Loader2, AlertTriangle,
} from 'lucide-react';
import Robot, { RobotDefs } from './RobotAgent';
import NoiDungAi from './NoiDungAi';
import { hoiAi, dsHoiThoaiAi, chiTietHoiThoaiAi, xoaHoiThoaiAi, danhGiaTinNhanAi } from '../../services/aiService';

// ═════════════════════════════════════════════════════════════════════════════
// AGENT MES THLA — robot nổi + khung chat (19/11/2026). Gắn 1 lần ở `ProtectedRoute` (qua `AgentLoader`) nên
// sống xuyên mọi màn. Chỉ hiện với người có vai trò AI tường minh (BE `/api/ai/trang-thai`).
//   · Mẫu robot (Vàng Nắng / Vàng Kem) mỗi người tự chọn ở Thông tin cá nhân (`ChonMauRobot`), BE trả `mau_robot`.
//   · Trang chủ: robot cả con ở góc trên bên phải, NẰM ĐÈ (fixed) — bố cục trang chủ giữ nguyên;
//     nút thu gọn ⇒ nút "Hỏi Agent MES THLA" + đầu robot. Màn khác: luôn dạng thu gọn.
//   · Kéo robot đi đâu cũng được; vị trí + trạng thái thu gọn nhớ theo người (localStorage, tiện ích riêng máy).
//   · Bấm robot ⇒ khung chat bên phải. Ghim ⇒ khung nổi trên mọi màn, kéo thanh tiêu đề để di chuyển, kéo góc
//     để đổi cỡ. Chưa ghim mà chuyển màn ⇒ khung tự thu (cuộc trò chuyện giữ). Phóng to ⇒ toàn màn hình.
// z-index: robot + thanh bên 44 (dưới Topbar 45, dưới Modal 50) · khung ghim / phóng to 46.
// ═════════════════════════════════════════════════════════════════════════════

const HEADER = 72;
const LOI_CHAO = 'Xin chào, tôi là AI Agent THLA. Bạn có thể hỏi tôi bất cứ điều gì liên quan đến MES.';
const GOI_Y = [
  'Hôm nay trạm nào đang nghẽn nhiều nhất?',
  'Phần in nào quá SLA ở READY?',
  'Sản lượng in hôm qua theo chuyền',
  'Tỷ lệ hư KCS tuần này',
  'Hướng dẫn xác nhận Test Run',
];
const BUOC_CHO = ['Đang đọc câu hỏi…', 'Đang tra tài liệu MES…', 'Đang đọc số liệu trên MES…', 'Đang tổng hợp câu trả lời…'];
const TEN_CONG_CU = {
  mes_docs_tim: 'Tra tài liệu', mes_docs_menu: 'Tra menu', mes_web_danh_muc: 'Xem danh mục số liệu',
  mes_web_doc: 'Đọc số liệu MES', mes_web_tra_ma: 'Tra mã', mes_db_danh_sach_bang: 'Xem danh sách bảng',
  mes_db_mo_ta_bang: 'Xem cấu trúc bảng', mes_db_truy_van: 'Truy vấn database',
};
const ICON_MAY_CHU = { 'mes-docs': BookOpen, 'mes-web': Globe, 'mes-db': Database };

const kep = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
const khoaLuu = (uid) => `agentMes.v1.${uid || 'an-danh'}`;
function docLuu(uid) {
  try { return JSON.parse(localStorage.getItem(khoaLuu(uid)) || '{}') || {}; } catch (e) { return {}; }
}
function ghiLuu(uid, v) {
  try { localStorage.setItem(khoaLuu(uid), JSON.stringify(v)); } catch (e) { /* trình duyệt chặn lưu trữ */ }
}

/** Kéo bằng con trỏ trên window (không setPointerCapture — capture làm click rơi khỏi nút). */
function keo(e, onMove, onEnd) {
  const sx = e.clientX;
  const sy = e.clientY;
  let daKeo = false;
  const mv = (ev) => {
    const dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    if (!daKeo && Math.hypot(dx, dy) < 5) return;
    daKeo = true;
    onMove(dx, dy);
  };
  const up = () => {
    window.removeEventListener('pointermove', mv);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (onEnd) onEnd(daKeo);
  };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function tomTatThamSo(b) {
  const t = b.tham_so || {};
  if (typeof t !== 'object') return '';
  const v = t.tu_khoa || t.ma || t.ten_bang || t.muc_dich || (t.duong_dan ? `${t.duong_dan}${t.truy_van ? `?${t.truy_van}` : ''}` : '');
  return v ? String(v).slice(0, 80) : '';
}

function CacBuoc({ buoc }) {
  const [mo, setMo] = useState(false);
  if (!Array.isArray(buoc) || !buoc.length) return null;
  return (
    <div className="text-[11.5px] text-ink-soft">
      <button type="button" onClick={() => setMo((x) => !x)} className="inline-flex items-center gap-1 hover:text-ink">
        {mo ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Đã tra {buoc.length} bước
      </button>
      {mo && (
        <ul className="mt-1 space-y-0.5">
          {buoc.map((b, i) => {
            const Ic = ICON_MAY_CHU[b.may_chu] || BookOpen;
            return (
              <li key={i} className={`flex items-center gap-1.5 ${b.loi ? 'text-danger' : ''}`}>
                <Ic size={12} className="shrink-0" />
                <span className="font-medium">{TEN_CONG_CU[b.ten] || b.ten}</span>
                <span className="truncate">{tomTatThamSo(b)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const nutCtl = 'agt-ctl grid h-6 w-6 place-items-center rounded-full border border-line bg-surface text-ink-soft shadow-card hover:border-amber-400 hover:text-amber-700';
const nutDau = 'grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-900/40 dark:hover:text-amber-200';

export default function AgentMesThla({ trangThai, userId }) {
  const location = useLocation();
  const laTrangChu = location.pathname === '/';
  const mau = trangThai.mau_robot; // mẫu robot người dùng chọn ở Thông tin cá nhân (mặc định Vàng Nắng)
  const [luu, setLuu] = useState(() => ({
    phai: 24, tren: HEADER + 16, thuGon: false, ghim: false, f: null, dockW: 420, ...docLuu(userId),
  }));
  useEffect(() => { ghiLuu(userId, luu); }, [userId, luu]);

  const [mo, setMo] = useState(false);
  const [phongTo, setPhongTo] = useState(false);
  const [hoiThoaiId, setHoiThoaiId] = useState(null);
  const [tinNhan, setTinNhan] = useState([]);
  const [dangHoi, setDangHoi] = useState(false);
  const [buocCho, setBuocCho] = useState(0);
  const [cauHoi, setCauHoi] = useState('');
  const [conLai, setConLai] = useState(trangThai.con_lai);
  const [xemLichSu, setXemLichSu] = useState(false);
  const [dsLichSu, setDsLichSu] = useState([]);
  const [w, setW] = useState(() => ({ rong: window.innerWidth, cao: window.innerHeight }));

  const widgetRef = useRef(null);
  const thanRef = useRef(null);
  const oNhapRef = useRef(null);
  const vuaKeo = useRef(false);

  useEffect(() => { setConLai(trangThai.con_lai); }, [trangThai.con_lai]);

  // Cửa sổ đổi cỡ ⇒ kéo robot / khung ghim về trong màn hình.
  useEffect(() => {
    const doi = () => setW({ rong: window.innerWidth, cao: window.innerHeight });
    window.addEventListener('resize', doi);
    return () => window.removeEventListener('resize', doi);
  }, []);

  // Chưa ghim mà chuyển màn ⇒ thu khung chat về robot (cuộc trò chuyện vẫn giữ).
  const duongTruoc = useRef(location.pathname);
  useEffect(() => {
    if (duongTruoc.current === location.pathname) return;
    duongTruoc.current = location.pathname;
    if (!luu.ghim && !phongTo) setMo(false);
  }, [location.pathname, luu.ghim, phongTo]);

  useEffect(() => {
    if (!dangHoi) return undefined;
    setBuocCho(0);
    const t = setInterval(() => setBuocCho((x) => Math.min(x + 1, BUOC_CHO.length - 1)), 2200);
    return () => clearInterval(t);
  }, [dangHoi]);

  useEffect(() => {
    if (thanRef.current) thanRef.current.scrollTop = thanRef.current.scrollHeight;
  }, [tinNhan, dangHoi, mo]);

  useEffect(() => {
    if (mo && oNhapRef.current) oNhapRef.current.focus({ preventScroll: true });
  }, [mo]);

  useEffect(() => {
    if (!phongTo) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setPhongTo(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [phongTo]);

  // ─── Robot nổi ──────────────────────────────────────────────────────────────
  const daiDien = laTrangChu && !luu.thuGon ? 'ca-con' : 'thu-gon';
  const viTriRobot = () => {
    const el = widgetRef.current;
    const rong = el ? el.offsetWidth : 120;
    const cao = el ? el.offsetHeight : 120;
    return { right: kep(luu.phai, 4, w.rong - rong - 4), top: kep(luu.tren, 4, w.cao - cao - 4) };
  };
  const batDauKeoRobot = (e) => {
    if (e.button > 0 || e.target.closest('.agt-ctl')) return;
    const el = widgetRef.current;
    const p0 = viTriRobot();
    vuaKeo.current = false;
    keo(e, (dx, dy) => {
      setLuu((l) => ({
        ...l,
        phai: kep(p0.right - dx, 4, window.innerWidth - (el ? el.offsetWidth : 120) - 4),
        tren: kep(p0.top + dy, 4, window.innerHeight - (el ? el.offsetHeight : 120) - 4),
      }));
    }, (daKeo) => {
      if (daKeo) { vuaKeo.current = true; setTimeout(() => { vuaKeo.current = false; }, 0); }
    });
  };
  const moChat = () => { if (!vuaKeo.current) setMo(true); };

  // ─── Khung chat ─────────────────────────────────────────────────────────────
  const nhoHon640 = w.rong < 640;
  const khungNoi = () => {
    const rong = Math.min(400, w.rong - 16);
    const cao = Math.min(600, w.cao - HEADER - 32);
    const f = luu.f || { x: w.rong - rong - 24, y: HEADER + 16, w: rong, h: cao };
    const fw = kep(f.w, 300, w.rong - 8);
    const fh = kep(f.h, 320, w.cao - 8);
    return { left: kep(f.x, 0, w.rong - fw), top: kep(f.y, 0, w.cao - 48), width: fw, height: fh };
  };
  let lopKhung;
  let kieuKhung;
  if (phongTo) {
    lopKhung = 'fixed inset-0 z-[46]';
    kieuKhung = {};
  } else if (luu.ghim) {
    lopKhung = 'fixed z-[46] rounded-card border border-line shadow-[0_24px_60px_rgba(15,27,45,.28)]';
    kieuKhung = khungNoi();
  } else {
    lopKhung = 'fixed right-0 bottom-0 z-[44] border-l border-line shadow-[-10px_0_36px_rgba(15,27,45,.16)]';
    kieuKhung = { top: HEADER, width: nhoHon640 ? w.rong : kep(luu.dockW, 320, w.rong - 40) };
  }

  const keoKhung = (e) => {
    if (!luu.ghim || phongTo || e.target.closest('button')) return;
    const f0 = khungNoi();
    keo(e, (dx, dy) => setLuu((l) => ({ ...l, f: { x: f0.left + dx, y: f0.top + dy, w: f0.width, h: f0.height } })));
  };
  const keoGoc = (e) => {
    e.stopPropagation();
    const f0 = khungNoi();
    keo(e, (dx, dy) => setLuu((l) => ({ ...l, f: { x: f0.left, y: f0.top, w: f0.width + dx, h: f0.height + dy } })));
  };
  const keoMep = (e) => {
    keo(e, (dx) => setLuu((l) => ({ ...l, dockW: kep((kieuKhung.width || 400) - dx, 320, window.innerWidth - 40) })));
  };

  // ─── Hỏi đáp ────────────────────────────────────────────────────────────────
  const gui = async (text) => {
    const q = String(text ?? cauHoi).trim();
    if (!q || dangHoi || !trangThai.san_sang) return;
    setCauHoi('');
    setXemLichSu(false);
    if (oNhapRef.current) oNhapRef.current.style.height = '';
    setTinNhan((ds) => [...ds, { tam: Date.now(), vai_tro: 'NGUOI_DUNG', noi_dung: q }]);
    setDangHoi(true);
    try {
      const r = await hoiAi({ cau_hoi: q, hoi_thoai_id: hoiThoaiId, trang_hien_tai: location.pathname });
      const d = r.data || {};
      setHoiThoaiId(d.hoi_thoai_id || hoiThoaiId);
      if (typeof d.con_lai === 'number') setConLai(d.con_lai);
      if (d.tin_nhan) setTinNhan((ds) => [...ds, d.tin_nhan]);
    } catch (e) {
      setTinNhan((ds) => [...ds, { tam: Date.now(), vai_tro: 'AI', loi: (e && e.message) || 'Không gọi được Agent' }]);
    } finally {
      setDangHoi(false);
    }
  };
  const cuocMoi = () => { setHoiThoaiId(null); setTinNhan([]); setXemLichSu(false); };
  const moLichSu = async () => {
    if (xemLichSu) { setXemLichSu(false); return; }
    setXemLichSu(true);
    try { const r = await dsHoiThoaiAi(); setDsLichSu(r.data || []); } catch (e) { setDsLichSu([]); }
  };
  const napHoiThoai = async (id) => {
    try {
      const r = await chiTietHoiThoaiAi(id);
      setHoiThoaiId(id);
      setTinNhan((r.data && r.data.tin_nhan) || []);
      setXemLichSu(false);
    } catch (e) { /* bỏ qua */ }
  };
  const xoaLichSu = async (id) => {
    try {
      await xoaHoiThoaiAi(id);
      setDsLichSu((ds) => ds.filter((x) => x.id !== id));
      if (id === hoiThoaiId) cuocMoi();
    } catch (e) { /* bỏ qua */ }
  };
  const danhGia = async (t, v) => {
    const moi = t.danh_gia === v ? 0 : v;
    try {
      await danhGiaTinNhanAi(t.id, moi);
      setTinNhan((ds) => ds.map((x) => (x.id === t.id ? { ...x, danh_gia: moi || null } : x)));
    } catch (e) { /* bỏ qua */ }
  };

  const trangThaiRobot = dangHoi ? 'nghi' : 'chao';
  const dongTrangThai = dangHoi
    ? BUOC_CHO[buocCho]
    : trangThai.san_sang ? `Sẵn sàng · còn ${conLai} câu` : 'Chưa sẵn sàng';

  return (
    <>
      <RobotDefs />

      {!mo && (
        <div
          ref={widgetRef}
          className="agt-noi fixed z-[44] cursor-grab active:cursor-grabbing"
          style={viTriRobot()}
          onPointerDown={batDauKeoRobot}
        >
          {daiDien === 'ca-con' ? (
            <div className="relative flex items-start gap-1 pt-1">
              <div className="mt-6 max-w-[200px] rounded-[14px_14px_4px_14px] border border-line bg-surface px-3 py-2 text-[12.5px] font-medium leading-snug text-ink shadow-card-hover max-sm:max-w-[150px] max-sm:text-[11.5px]">
                {LOI_CHAO}
              </div>
              <button type="button" onClick={moChat} aria-label="Mở Agent MES THLA" className="w-[112px] shrink-0 max-sm:w-[92px]">
                <Robot mau={mau} trangThai={trangThaiRobot} />
              </button>
              <button type="button" className={`${nutCtl} absolute right-0 top-0`} title="Thu gọn" aria-label="Thu gọn robot"
                onClick={() => setLuu((l) => ({ ...l, thuGon: true }))}>
                <Minimize2 size={13} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <button type="button" onClick={moChat} className="flex items-center gap-2.5" aria-label="Mở Agent MES THLA">
                <span className="rounded-xl bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink shadow-[0_2px_10px_rgba(15,27,45,.12)]">
                  Hỏi Agent MES THLA
                </span>
                <span className="agt-dau-bong block w-[76px]"><Robot mau={mau} dau trangThai={trangThaiRobot} /></span>
              </button>
              {laTrangChu && (
                <button type="button" className={`${nutCtl} absolute -right-1 -top-2`} title="Hiện cả con robot" aria-label="Hiện cả con robot"
                  onClick={() => setLuu((l) => ({ ...l, thuGon: false }))}>
                  <Maximize2 size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {mo && (
        <section className={`${lopKhung} flex min-h-0 flex-col overflow-hidden bg-surface text-ink`} style={kieuKhung} aria-label="Agent MES THLA">
          {!luu.ghim && !phongTo && !nhoHon640 && (
            <div className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize" onPointerDown={keoMep} aria-hidden="true" />
          )}
          <header
            className={`flex select-none items-center gap-2.5 border-b border-t-[3px] border-b-line border-t-amber-400 px-3 py-2 ${luu.ghim && !phongTo ? 'cursor-grab touch-none' : ''}`}
            onPointerDown={keoKhung}
          >
            <span className="block w-9 shrink-0"><Robot mau={mau} dau trangThai={trangThaiRobot} /></span>
            <div className="min-w-0 leading-tight" title={`Còn ${conLai} câu hỏi hôm nay`}>
              <div className="truncate text-[15px] font-bold">Agent MES THLA</div>
              <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                <i className={`inline-block h-[7px] w-[7px] rounded-full ${dangHoi ? 'animate-pulse bg-amber-400' : trangThai.san_sang ? 'bg-success' : 'bg-ink-soft'}`} />
                <span className="truncate">{dongTrangThai}</span>
              </div>
            </div>
            <div className="ml-auto flex shrink-0">
              <button type="button" className={nutDau} title="Cuộc trò chuyện mới" aria-label="Cuộc trò chuyện mới" onClick={cuocMoi}><Plus size={17} /></button>
              <button type="button" className={`${nutDau} ${xemLichSu ? 'bg-amber-100 text-amber-800' : ''}`} title="Lịch sử trò chuyện" aria-label="Lịch sử trò chuyện" onClick={moLichSu}><History size={17} /></button>
              <button type="button" className={`${nutDau} ${luu.ghim ? 'bg-amber-400 text-amber-950 hover:bg-amber-400' : ''}`}
                title={luu.ghim ? 'Bỏ ghim: về thanh bên phải' : 'Ghim nổi: giữ trên mọi màn, kéo đi và đổi cỡ được'}
                aria-label="Ghim" aria-pressed={luu.ghim}
                onClick={() => { setPhongTo(false); setLuu((l) => ({ ...l, ghim: !l.ghim })); }}>
                {luu.ghim ? <PinOff size={17} /> : <Pin size={17} />}
              </button>
              <button type="button" className={nutDau} title={phongTo ? 'Thu về kích thước cũ' : 'Phóng to toàn màn hình'} aria-label="Phóng to" aria-pressed={phongTo}
                onClick={() => setPhongTo((x) => !x)}>
                {phongTo ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
              <button type="button" className={nutDau} title="Thu nhỏ về robot" aria-label="Thu nhỏ" onClick={() => { setMo(false); setPhongTo(false); }}><Minus size={17} /></button>
              <button type="button" className={nutDau} title="Đóng" aria-label="Đóng" onClick={() => { setMo(false); setPhongTo(false); setLuu((l) => ({ ...l, ghim: false })); }}><X size={17} /></button>
            </div>
          </header>

          {!trangThai.san_sang && trangThai.ly_do_tat && (
            <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>Agent chưa sẵn sàng: {trangThai.ly_do_tat} Báo bộ phận IT.</span>
            </div>
          )}

          <div ref={thanRef} className={`flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-3.5 ${phongTo ? 'sm:px-[max(20px,calc((100%-780px)/2))]' : ''}`}>
            {xemLichSu ? (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Lịch sử trò chuyện</div>
                {!dsLichSu.length && <div className="text-sm text-ink-soft">Chưa có cuộc trò chuyện nào.</div>}
                {dsLichSu.map((h) => (
                  <div key={h.id} className="group flex items-center gap-2 rounded-control border border-line px-3 py-2 hover:border-amber-400">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => napHoiThoai(h.id)}>
                      <div className="truncate text-sm font-medium">{h.tieu_de || 'Cuộc trò chuyện'}</div>
                      <div className="text-[11.5px] text-ink-soft">
                        {h.so_cau_hoi} câu · {new Date(h.tg_cuoi || h.created_date).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </button>
                    <button type="button" className="rounded p-1 text-ink-soft hover:text-danger" title="Xóa" aria-label="Xóa cuộc trò chuyện" onClick={() => xoaLichSu(h.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <span className="block w-8 shrink-0"><Robot mau={mau} dau /></span>
                  <div className="rounded-[4px_14px_14px_14px] border border-line bg-surface-muted px-3 py-2.5 text-[13.5px] leading-relaxed">{LOI_CHAO}</div>
                </div>
                {tinNhan.map((t, i) => (t.vai_tro === 'NGUOI_DUNG' ? (
                  <div key={t.id || `t${i}`} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[14px_4px_14px_14px] bg-primary px-3 py-2 text-[13.5px] text-white">{t.noi_dung}</div>
                  </div>
                ) : (
                  <div key={t.id || `t${i}`} className="flex items-start gap-2">
                    <span className="block w-8 shrink-0"><Robot mau={mau} dau /></span>
                    <div className="min-w-0 flex-1 space-y-2 rounded-[4px_14px_14px_14px] border border-line bg-surface-muted px-3 py-2.5 text-[13.5px] leading-relaxed">
                      <CacBuoc buoc={t.cong_cu} />
                      {t.loi ? (
                        <div className="flex items-start gap-1.5 text-danger"><AlertTriangle size={14} className="mt-0.5 shrink-0" /><span>{t.loi}</span></div>
                      ) : (
                        <NoiDungAi text={t.noi_dung} />
                      )}
                      {t.id && !t.loi && (
                        <div className="flex items-center gap-1 pt-0.5 text-ink-soft">
                          <button type="button" title="Câu trả lời hữu ích" aria-label="Hữu ích" aria-pressed={t.danh_gia === 1}
                            className={`rounded p-1 hover:text-success ${t.danh_gia === 1 ? 'text-success' : ''}`} onClick={() => danhGia(t, 1)}>
                            <ThumbsUp size={13} />
                          </button>
                          <button type="button" title="Câu trả lời sai / chưa đúng ý" aria-label="Chưa đúng" aria-pressed={t.danh_gia === -1}
                            className={`rounded p-1 hover:text-danger ${t.danh_gia === -1 ? 'text-danger' : ''}`} onClick={() => danhGia(t, -1)}>
                            <ThumbsDown size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )))}
                {dangHoi && (
                  <div className="flex items-start gap-2">
                    <span className="block w-8 shrink-0"><Robot mau={mau} dau trangThai="nghi" /></span>
                    <div className="agt-buoc-chay flex items-center gap-2 rounded-[4px_14px_14px_14px] border border-line bg-surface-muted px-3 py-2.5 text-[13px] text-ink-soft">
                      <Loader2 size={14} /> {BUOC_CHO[buocCho]}
                    </div>
                  </div>
                )}
                {!tinNhan.length && !dangHoi && trangThai.san_sang && (
                  <div className="flex flex-wrap gap-1.5 pl-10">
                    {GOI_Y.map((g) => (
                      <button key={g} type="button" onClick={() => gui(g)}
                        className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40">
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <form className="flex items-end gap-2 border-t border-line px-3 pb-1.5 pt-2.5" onSubmit={(e) => { e.preventDefault(); gui(); }}>
            <label htmlFor="agt-cau-hoi" className="sr-only">Câu hỏi cho Agent MES THLA</label>
            <textarea
              id="agt-cau-hoi"
              ref={oNhapRef}
              rows={1}
              value={cauHoi}
              disabled={!trangThai.san_sang}
              maxLength={2000}
              placeholder={trangThai.san_sang ? 'Nhập câu hỏi về MES…' : 'Agent chưa sẵn sàng'}
              onChange={(e) => {
                setCauHoi(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gui(); } }}
              className="max-h-[120px] min-w-0 flex-1 resize-none rounded-input border border-line bg-background px-3 py-2 text-[13.5px] text-ink outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:opacity-60 dark:focus:ring-amber-900"
            />
            <button type="submit" disabled={dangHoi || !cauHoi.trim() || !trangThai.san_sang} aria-label="Gửi"
              className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-primary text-white hover:bg-primary-hover disabled:opacity-40">
              <Send size={17} />
            </button>
          </form>
          <p className="px-3 pb-2 text-center text-[11px] text-ink-soft">Chỉ đọc dữ liệu MES · AI có thể nhầm, kiểm lại số quan trọng</p>

          {luu.ghim && !phongTo && (
            <div className="absolute bottom-0.5 right-0.5 h-4 w-4 cursor-nwse-resize touch-none text-ink-soft" onPointerDown={keoGoc} aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14 7l-7 7M14 11.5L11.5 14" /></svg>
            </div>
          )}
        </section>
      )}
    </>
  );
}
