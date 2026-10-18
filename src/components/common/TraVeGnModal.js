import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';
import { Textarea } from './controls';
import { khop } from '../../utils/timKiem';
import { danhMucTraVeGn, traVeGn } from '../../services/suaThongTinService';

// ─────────────────────────────────────────────────────────────────────────────
// "TRẢ VỀ GIAO NHẬN" — màn READY (Kỹ thuật) + QC chuẩn bị kỹ thuật (25/09/2026, mig 105) + từ 06/10/2026
// Release 1 · Test Run · Release 2 · Chờ chạy (`nguon`, gương backend `utils/traVeGn.js NGUON_TRA_VE_GN`).
// Tick các THÔNG TIN SAI (chọn được nhiều) + ô "Khác" gõ tự do; ô tìm lọc danh sách mục (không dấu).
// Gửi xong: phần in RỜI màn đang đứng (lệnh GIỮ NGUYÊN, chỉ tạm khóa), sang *Đơn hàng › Phần in chờ sửa
// thông tin*; GN sửa rồi xác nhận lại là quay về ĐÚNG màn cũ. Danh mục mục do BACKEND trả — thêm mục không sửa FE.
// `dsPhanIn` (tùy chọn): lệnh gom set có NHIỀU phần in ⇒ cho chọn phần in nào sai (mặc định phần in đầu).
// `dotVaiIds` (11/10/2026, tùy chọn): modal mở từ 1 DÒNG ĐỢT VẢI (READY / QC READY / Release 1) ⇒ phạm vi trả về
//   = đúng các đợt đó; không truyền ⇒ backend tự lấy đợt của lệnh (`lenhId`) hoặc mọi đợt chưa vào sản xuất.
// ⚠ Mục "Hủy vải không in" (`HUY_VAI`) = XÓA MỀM đợt vải trong phạm vi NGAY lúc gửi — phần in KHÔNG sang trang
//   chờ sửa thông tin (người dùng chốt 11/10/2026). Khôi phục ở Hệ thống › Hủy lệnh xác nhận › Mở đợt vải.
// `ungVien` (18/10/2026, tùy chọn — người dùng: "bấm 1 phần in rồi bấm hủy, cho chọn thêm các phần khác nếu cùng lựa
//   chọn hủy"): các DÒNG KHÁC trên màn `[{ key, phanInId, ma_phan, mo_ta?, dotVaiIds?, lenhId? }]` ⇒ khối "Áp dụng
//   cùng lựa chọn cho phần in khác" cho tích thêm; gửi phần in đang mở trước rồi gửi CÙNG mục đã tick cho từng phần
//   in đã tích (mỗi phần in 1 lượt trả về riêng — vd hủy vải nhiều phần in 1 lần). Dòng cùng phần in gộp đợt lại;
//   dòng của chính phần in đang mở không hiện (phạm vi của nó do màn truyền).
// ─────────────────────────────────────────────────────────────────────────────

// Dựng `ungVien` từ dòng của màn (dùng chung các màn — truyền cách đọc phần in / đợt / lệnh của dòng).
export const ungVienGn = (rows, { pinId = (r) => r.phan_in_id, dotIds = null, lenhId = null } = {}) => (rows || [])
  .filter((r) => pinId(r))
  .map((r) => ({
    phanInId: pinId(r),
    ma_phan: r.ma_phan,
    mo_ta: [r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · '),
    dotVaiIds: dotIds ? dotIds(r) : null,
    lenhId: lenhId ? lenhId(r) : null,
  }));

// Gộp ứng viên theo phần in (1 phần in nhiều dòng đợt ⇒ 1 lượt, gộp `dotVaiIds`; có dòng không mang đợt ⇒ để backend
// tự lấy phạm vi). Mức module (gương luật khai component/hàm ngoài component — §9).
function gopUngVien(ds, boPinId) {
  const m = new Map();
  (ds || []).forEach((u) => {
    if (!u || !u.phanInId || String(u.phanInId) === String(boPinId)) return;
    const k = String(u.phanInId);
    const cu = m.get(k);
    const dots = Array.isArray(u.dotVaiIds) && u.dotVaiIds.length ? u.dotVaiIds : null;
    if (!cu) { m.set(k, { ...u, key: k, dotVaiIds: dots, _khongDot: !dots }); return; }
    cu._khongDot = cu._khongDot || !dots;
    cu.dotVaiIds = cu._khongDot ? null : [...new Set([...(cu.dotVaiIds || []), ...dots])];
    if (u.lenhId && cu.lenhId && String(u.lenhId) !== String(cu.lenhId)) cu.lenhId = null; // nhiều lệnh ⇒ mọi đợt chưa SX
    if (u.mo_ta && !String(cu.mo_ta || '').includes(u.mo_ta)) cu.mo_ta = [cu.mo_ta, u.mo_ta].filter(Boolean).join(' · ');
  });
  return [...m.values()];
}

let cacheDanhMuc = null; // danh mục gần như không đổi ⇒ tải 1 lần / phiên trang

const TEN_MAN = {
  KT: 'READY', QC: 'QC READY', RELEASE1: 'Release 1', TEST_RUN: 'Test Run', RELEASE2: 'Release 2', CHO_CHAY: 'Chờ sản xuất',
};

export default function TraVeGnModal({ open, onClose, phanIn, dsPhanIn, lenhId, dotVaiIds, nguon = 'KT', onDone, onToast, ungVien }) {
  const [danhMuc, setDanhMuc] = useState(cacheDanhMuc || []);
  const [chon, setChon] = useState(() => new Set());
  const [coKhac, setCoKhac] = useState(false);
  const [khac, setKhac] = useState('');
  const [tim, setTim] = useState('');
  const [saving, setSaving] = useState(false);
  const [loi, setLoi] = useState('');
  // Phần in đang chọn để trả (lệnh 1 phần in ⇒ chính `phanIn`).
  const nhieuPhanIn = Array.isArray(dsPhanIn) && dsPhanIn.length > 1;
  const [pinId, setPinId] = useState('');
  const pin = nhieuPhanIn ? (dsPhanIn.find((x) => String(x.id) === String(pinId)) || dsPhanIn[0]) : phanIn;
  const sauReady = !['KT', 'QC'].includes(nguon);
  // ⚠ Chuỗi (không phải mảng) làm deps — `dsPhanIn` thường dựng mới mỗi render, đưa thẳng vào deps là
  //   effect chạy lại liên tục và xóa sạch mục đã tick.
  const pinDau = nhieuPhanIn ? String(dsPhanIn[0].id) : '';
  // Phần in khác áp cùng lựa chọn (key = phanInId).
  const [them, setThem] = useState(() => new Set());
  const [timThem, setTimThem] = useState('');
  const dsUngVien = useMemo(() => gopUngVien(ungVien, pin?.id), [ungVien, pin?.id]);
  const ungVienLoc = useMemo(
    () => dsUngVien.filter((u) => !timThem.trim() || khop(`${u.ma_phan || ''} ${u.mo_ta || ''}`, timThem)),
    [dsUngVien, timThem]);
  const dsThem = dsUngVien.filter((u) => them.has(u.key));
  const batThem = (k) => setThem((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  useEffect(() => {
    if (!open) return;
    setChon(new Set()); setCoKhac(false); setKhac(''); setTim(''); setLoi('');
    setThem(new Set()); setTimThem('');
    setPinId(pinDau);
    if (cacheDanhMuc) return;
    danhMucTraVeGn()
      .then((r) => { cacheDanhMuc = r.data?.thong_tin || []; setDanhMuc(cacheDanhMuc); })
      .catch((e) => setLoi(e.message || 'Không tải được danh mục thông tin'));
  }, [open, pinDau]);

  // Lọc theo ô tìm, gom theo nhóm (giữ thứ tự khai ở backend).
  // ⚠ Nhóm "Khác" của danh mục (vd "Hủy vải không in") GỘP vào CHUNG khối "Khác" với ô gõ tự do bên
  //   dưới — tách ra thì màn hiện 2 tiêu đề "Khác" (người dùng báo 26/09/2026).
  const NHOM_KHAC = 'Khác';
  const locTim = useMemo(
    () => danhMuc.filter((x) => !tim.trim() || khop(`${x.ten} ${x.nhom}`, tim)), [danhMuc, tim]);
  const nhom = useMemo(() => {
    const m = new Map();
    locTim.filter((x) => x.nhom !== NHOM_KHAC).forEach((x) => {
      if (!m.has(x.nhom)) m.set(x.nhom, []);
      m.get(x.nhom).push(x);
    });
    return [...m.entries()];
  }, [locTim]);
  const khacDanhMuc = useMemo(() => locTim.filter((x) => x.nhom === NHOM_KHAC), [locTim]);
  const hienOKhac = !tim.trim() || khop('khác khac thông tin khác', tim);
  const hienKhac = hienOKhac || khacDanhMuc.length > 0;

  const bat = (ma) => setChon((s) => { const n = new Set(s); if (n.has(ma)) n.delete(ma); else n.add(ma); return n; });
  const hopLe = chon.size > 0 || (coKhac && khac.trim());
  const huyVai = chon.has('HUY_VAI');

  const gui = async () => {
    if (!hopLe || !pin) return;
    if (coKhac && !khac.trim()) { setLoi('Đã tích "Khác" thì ghi rõ thông tin sai là gì.'); return; }
    setSaving(true); setLoi('');
    const thongTin = [...chon];
    const khacGui = coKhac ? khac.trim() : '';
    // 1 lượt gửi — trả câu tóm tắt (ném lỗi khi API báo lỗi).
    const guiMot = async (p, phamVi) => {
      const r = await traVeGn({ phanInId: p.id, thongTin, khac: khacGui, nguon, ...phamVi });
      const hv = r?.data?.huy_vai;
      if (hv && hv.ok) return { ok: true, tin: `Đã hủy vải ${p.ma_phan} — xóa mềm ${hv.so_dot} đợt vải${hv.so_lenh_huy ? `, hủy ${hv.so_lenh_huy} lệnh chưa chạy` : ''}` };
      if (hv) return { ok: false, tin: `Chưa hủy được vải ${p.ma_phan}: ${(hv.loi || []).map((x) => x.ly_do).join(' · ') || 'không rõ lý do'} — phần in nằm ở trang chờ sửa thông tin` };
      return { ok: true, tin: `Đã trả ${p.ma_phan} về Giao nhận sửa thông tin` };
    };
    let chinh;
    try {
      chinh = await guiMot(pin, {
        lenhId: lenhId || undefined,
        // Đợt của DÒNG đang mở (lệnh gom set chọn phần in khác thì để backend tự lấy đợt theo lệnh).
        dotVaiIds: !nhieuPhanIn && Array.isArray(dotVaiIds) && dotVaiIds.length ? dotVaiIds : undefined,
      });
    } catch (e) {
      setLoi(e.message || 'Trả về thất bại');
      setSaving(false);
      return;
    }
    if (!dsThem.length) {
      onToast?.(chinh.tin, chinh.ok ? undefined : 'error');
      setSaving(false);
      onDone?.();
      onClose?.();
      return;
    }
    // Phần in KHÁC cùng lựa chọn — tuần tự, lỗi phần in này không chặn phần in sau.
    const loiThem = [];
    let okThem = 0;
    for (const u of dsThem) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const k = await guiMot({ id: u.phanInId, ma_phan: u.ma_phan }, {
          lenhId: u.lenhId || undefined, dotVaiIds: u.dotVaiIds && u.dotVaiIds.length ? u.dotVaiIds : undefined,
        });
        if (k.ok) okThem += 1; else loiThem.push(k.tin);
      } catch (e) {
        loiThem.push(`${u.ma_phan}: ${e.message || 'lỗi'}`);
      }
    }
    const tong = 1 + dsThem.length;
    const okTong = (chinh.ok ? 1 : 0) + okThem;
    const loiTong = [...(chinh.ok ? [] : [chinh.tin]), ...loiThem];
    onToast?.(`${huyVai ? 'Hủy vải' : 'Trả về GN'} ${okTong}/${tong} phần in${loiTong.length ? ` · LỖI: ${loiTong.join(' · ')}` : ''}`,
      loiTong.length ? 'error' : undefined);
    setSaving(false);
    onDone?.();
    onClose?.();
  };

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={`Trả về Giao nhận — ${pin?.ma_phan || ''}`}
      footer={(
        <>
          <Button chiXemOk variant="ghost" onClick={onClose}>Hủy</Button>
          <Button variant="danger" icon="undo" loading={saving} disabled={!hopLe} onClick={gui}>
            {huyVai ? 'Hủy vải' : 'Trả về GN'} ({chon.size + (coKhac && khac.trim() ? 1 : 0)}){dsThem.length ? ` · ${1 + dsThem.length} phần in` : ''}
          </Button>
        </>
      )}>
      <div className="space-y-3">
        <p className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Tick các <b>thông tin sai</b> cần Giao nhận sửa. Phần in sẽ <b>rời màn {TEN_MAN[nguon] || 'READY'}</b> tới khi GN
          sửa xong và xác nhận lại.{' '}
          {sauReady
            ? <>Lệnh sản xuất và xác nhận Khuôn/Film/Mực/QC <b>giữ nguyên</b>; mọi lệnh chưa chạy của phần in này tạm khóa tới khi GN xác nhận lại.</>
            : <>Xác nhận Khuôn/Film/Mực đã làm vẫn được <b>giữ nguyên</b>.</>}
        </p>
        {nhieuPhanIn && (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-ink-soft">Phần in sai thông tin (lệnh gom set)</span>
            <select value={pinId} onChange={(e) => setPinId(e.target.value)}
              className="h-10 w-full rounded-control border border-line bg-surface px-3 text-base outline-none focus:border-primary md:text-sm">
              {dsPhanIn.map((x) => (
                <option key={x.id} value={String(x.id)}>{[x.ma_phan, x.mau_vai].filter(Boolean).join(' · ')}</option>
              ))}
            </select>
          </label>
        )}
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
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {khacDanhMuc.map((x) => (
                  <label key={x.ma} className={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm ${
                    chon.has(x.ma) ? 'border-danger bg-rose-50 dark:bg-rose-950/30' : 'border-line hover:bg-surface-muted'}`}>
                    <input type="checkbox" checked={chon.has(x.ma)} onChange={() => bat(x.ma)} />
                    <span>{x.ten}</span>
                  </label>
                ))}
                {hienOKhac && (
                  <label className={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm ${
                    coKhac ? 'border-danger bg-rose-50 dark:bg-rose-950/30' : 'border-line hover:bg-surface-muted'}`}>
                    <input type="checkbox" checked={coKhac} onChange={(e) => setCoKhac(e.target.checked)} />
                    <span>Thông tin khác (ghi rõ bên dưới)</span>
                  </label>
                )}
              </div>
              {coKhac && (
                <Textarea className="mt-2" rows={2} value={khac} onChange={(e) => setKhac(e.target.value)}
                  placeholder="Ghi rõ thông tin nào sai, đúng phải là gì..." autoFocus />
              )}
            </div>
          )}
        </div>
        {huyVai && (
          <p className="rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <b>Hủy vải không in = xóa mềm đợt vải</b>{Array.isArray(dotVaiIds) && dotVaiIds.length && !nhieuPhanIn ? ' của dòng này' : ' chưa vào sản xuất của phần in'}
            {sauReady ? ' (lệnh chưa chạy đang giữ đợt bị hủy theo)' : ''}. Phần in <b>không</b> sang trang chờ sửa thông tin;
            hết đợt vải thì phần in ẩn luôn. Mở lại ở Hệ thống › Hủy lệnh xác nhận › Mở đợt vải.
          </p>
        )}
        {dsUngVien.length > 0 && (
          <div className="rounded-control border border-line p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Áp dụng cùng lựa chọn cho phần in khác{dsThem.length ? ` (đã chọn ${dsThem.length})` : ''}
              </span>
              <div className="relative ml-auto min-w-[12rem] flex-1">
                <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input value={timThem} onChange={(e) => setTimThem(e.target.value)} placeholder="Tìm code phần, màu..."
                  className="h-9 w-full rounded-control border border-line bg-surface pl-8 pr-3 text-base outline-none focus:border-primary md:text-sm" />
              </div>
              {dsThem.length > 0 && (
                <button type="button" onClick={() => setThem(new Set())} className="text-xs text-ink-soft hover:text-danger">Bỏ chọn hết</button>
              )}
            </div>
            <div className="max-h-48 space-y-1 overflow-auto pr-1">
              {ungVienLoc.map((u) => (
                <label key={u.key} className={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-1.5 text-sm ${
                  them.has(u.key) ? 'border-danger bg-rose-50 dark:bg-rose-950/30' : 'border-line hover:bg-surface-muted'}`}>
                  <input type="checkbox" checked={them.has(u.key)} onChange={() => batThem(u.key)} />
                  <span className="font-medium text-ink">{u.ma_phan}</span>
                  {u.mo_ta && <span className="truncate text-xs text-ink-soft">{u.mo_ta}</span>}
                </label>
              ))}
              {!ungVienLoc.length && <div className="py-2 text-center text-xs text-ink-soft">Không có phần in nào khớp.</div>}
            </div>
          </div>
        )}
        {loi && <div className="text-sm text-danger">{loi}</div>}
      </div>
    </Modal>
  );
}
