import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import ConfirmDialog from './ConfirmDialog';
import SearchableSelect from './SearchableSelect';
import Icon from './Icon';
import { fmtNum } from '../../utils/format';
import { tenNguoi, timNguoi } from '../../hooks/useDsNguoi';

// ─── TÍCH TEM — QUÉT + NHẬP NHIỀU TEM THEO DÒNG (29/10/2026, người dùng: "có nút tích → modal gần full màn hình,
//   dạng bảng, cột đầu ô tích, rồi khách · đơn · mã · màu · kích · kích film, rồi các ô nhập; mở lên con trỏ ở ô quét,
//   quét ra thông tin thì con trỏ tới ô số lượng đạt, Enter qua ô kế; mũi tên xuống thêm 1 dòng, con trỏ tự vào;
//   nút xác nhận cùng lúc nhiều phần — KCS, Phân loại lỗi, Sửa đều như vậy") ───
// Dùng chung cho 3 màn: màn khai `traMa` (tra 1 mã ⇒ dòng dữ liệu), `truong` (các ô nhập), `formMoi` / `danhGia` / `luu`
//   (GƯƠNG luật BE của màn — chốt chặn thật vẫn ở BE). Mỗi dòng tích đi ĐÚNG API lẻ của màn, TUẦN TỰ, dòng lỗi không chặn
//   dòng sau; dòng lưu được rời bảng, dòng lỗi ở lại kèm câu lỗi.
// Phím: ô quét Enter = tra mã · ô nhập Enter = sang ô kế (ô cuối ⇒ dòng dưới, chưa có thì thêm) · ↓ / ↑ = dòng dưới / trên
//   (dòng cuối bấm ↓ ⇒ thêm 1 dòng mới, con trỏ vào ô quét). Ô chọn (danh mục) giữ ↑↓ cho danh sách thả xuống.
// `truong`: [{ k, label, kieu: 'so' | 'chon' | 'nguoi', options, getSearch, placeholder, minW, keThua, macDinh }].
//   · `kieu: 'nguoi'` (09/11/2026 — cột Người kiểm / Người sửa ở CUỐI bảng): ô chọn người lưu TÊN (gõ tên ngoài danh sách
//     được), `options` = `useDsNguoi().dsTen`; ↑ ↓ đi dòng như modal In tem KCS — ↓ sang dòng dưới đang TRỐNG thì chép tên.
//   · `keThua: true`: dòng vừa tra được lấy giá trị của dòng ĐÃ TRA GẦN NHẤT phía trên; chưa có ⇒ `macDinh()` (tên nhớ trên máy).
// `moTruoc(ds)` / `sauKhiLuu(ctx, daLuu)` (tùy chọn — nút "Xác nhận và in tem" trang Sửa): `moTruoc` chạy ĐỒNG BỘ ngay sau
//   `truocXacNhan` (vẫn trong lượt bấm ⇒ mở được cửa sổ in, trình duyệt không chặn), trả `ctx`; `sauKhiLuu` nhận các dòng
//   đã lưu `[{ row, f, data }]` (`data` = `data` của API) để in. Lỗi ở `sauKhiLuu` chỉ báo, dữ liệu đã lưu giữ nguyên.
// ─── 1 TEM NHIỀU DÒNG (`nhom`, 09/11/2026 — trang Phân loại lỗi: "1 tem có thể nhiều lỗi, kiểm tra tính trên các dòng
//   cùng tem; lệch mà bấm ↓ thì cho phân loại tiếp tem đó; gom ô trùng thông tin cho dễ nhìn") ───
//   `nhom = { danhGia(row, fs), conLai(row, fs), formTiep(row, con), luu(row, fs) }` — `fs` = form MỌI dòng của tem.
//   · Quét lại tem đã có ⇒ thêm dòng cho tem đó (đặt ngay dưới các dòng của nó), không báo trùng.
//   · ↓ / Enter ở ô cuối của dòng CUỐI một tem mà `conLai > 0` ⇒ chèn dòng mới cho tem đó, đổ sẵn `formTiep(row, conLai)`.
//   · Các dòng cùng tem luôn LIỀN NHAU; ô tích · mã tem · khách → SL · Kiểm tra gộp ô (rowSpan); tích / lưu theo TEM
//     (1 lần `nhom.luu` / tem). Không có `nhom` ⇒ như cũ: mỗi tem 1 dòng, quét trùng báo lỗi.
// ─── BỐ CỤC VỪA 1 KHUNG HÌNH (10/11/2026, người dùng: "xem được trên 1 khung hình không cần lướt sang ngang, bỏ ô checkbox,
//   màu vải · kích vải · kích film màn hình nhỏ thì chung 1 cột") ───
//   · KHÔNG còn ô tích: MỌI dòng đã tra được mã đều được xác nhận; không muốn lưu dòng nào thì bấm × bỏ dòng đó.
//   · Bảng `w-full` (bỏ `min-w` cố định), ô nhập hẹp, chữ thông tin được xuống dòng ⇒ laptop 1366 px không cuộn ngang
//     (điện thoại vẫn cuộn được nhờ khung `overflow-auto`).
//   · Màu vải · Kích vải · Kích film: < 1536 px (`2xl`) gộp 1 cột (màu ở trên, kích vải / kích film ở dưới); ≥ 1536 px 3 cột.
const TOI_DA_DONG = 100;
const n = (v) => Math.max(0, Math.trunc(Number(v) || 0));

const O_SO = 'h-9 w-full min-w-[52px] rounded-input border border-line bg-surface px-1.5 text-right text-sm tabular-nums focus:border-primary focus:outline-none disabled:opacity-50';
const O_MA = 'h-9 w-full min-w-[124px] rounded-input border border-line bg-surface px-2 font-mono text-sm focus:border-primary focus:outline-none';
// Cột 3 ô riêng chỉ hiện ở màn ≥ 2xl; cột gộp chỉ hiện dưới 2xl.
const CHI_MAN_RONG = 'hidden 2xl:table-cell';
const CHI_MAN_HEP = '2xl:hidden';

let demId = 0;
const dongTrong = () => { demId += 1; return { id: `d${demId}`, ma: '', tt: 'TRONG', row: null, f: {}, tich: false, chu: '' }; };

// ─── 1 DÒNG CỦA BẢNG — `memo` (09/11/2026, người dùng báo "xoay và chậm, chỉ mới 10 tem") ───
// Trước đây cả bảng vẽ lại mỗi phím gõ (mỗi dòng có 1 Combobox chọn người ~500 tên) và mỗi GIÂY (trang KCS / Sửa vẽ lại
//   theo đồng hồ SLA ⇒ modal con vẽ lại theo). Đo 10 dòng: gõ 4 phím vào ô số mất ~350 ms (bản dev, CPU thường).
//   Nay dòng chỉ vẽ lại khi CHÍNH dữ liệu dòng đổi (`d`), số thứ tự, cờ đang lưu hoặc nút bỏ dòng.
// ⚠ Mọi hàm (xử lý phím, đặt ref, `danhGia` / `soCan` / `maHien` của trang…) đi qua `h` = REF ỔN ĐỊNH của modal — đừng
//   truyền hàm nội tuyến làm prop (đổi mỗi lần vẽ ⇒ `memo` vô dụng). `danhGia` / `soCan` / `maHien` của 3 trang là hàm
//   THUẦN theo dòng nên đọc bản mới nhất qua ref là đúng.
// Chế độ `nhom`: `dau` = dòng đầu của tem (vẽ các ô gộp, `rowSpan = soDong`); dòng sau của cùng tem (`dau = false`) bỏ
//   các ô đó. Kết quả kiểm tra (`dgOk` · `dgChu` · `dgVang`) do modal tính theo CẢ tem, truyền dạng giá trị đơn để `memo`
//   không vẽ lại mọi dòng.
const DongTichTem = memo(function DongTichTem({
  d, i, truong, dangLuu, coNutBo, h, dau = true, soDong = 1, dgOk, dgChu, dgVang,
}) {
  const r = d.row || {};
  const ok = d.tt === 'OK';
  const H = h.current;
  const gop = dau && soDong > 1 ? { rowSpan: soDong } : {};
  const nen = dau && soDong > 1 ? 'align-top' : '';
  const dem = soDong > 1 ? 'pt-3' : '';
  const kich = [r.kich_vai, r.kich_phim].filter(Boolean).join(' / ');
  return (
    <tr className={`${dau ? 'border-t border-line/70' : 'border-t border-dashed border-line/50'} align-middle ${d.kq ? 'bg-danger/5' : ''}`}>
      <td className="px-1 py-1 text-right tabular-nums text-ink-soft">{i + 1}</td>
      {dau && (
        <>
          <td {...gop} className={`px-1.5 py-1 ${nen}`}>
            {ok ? (
              <div className={soDong > 1 ? 'pt-2' : ''}>
                <span className="font-mono text-xs font-semibold text-primary">{H.maHien(r)}</span>
                {soDong > 1 && <div className="text-[11px] text-ink-soft">{soDong} dòng lỗi</div>}
              </div>
            ) : (
              <input ref={(el) => h.current.datRef(`${d.id}|ma`, el)} className={O_MA}
                value={d.ma} placeholder="Quét / gõ mã tem…" disabled={dangLuu}
                onChange={(e) => h.current.doiMa(d.id, e.target.value)}
                onKeyDown={(e) => h.current.phim(e, d, 'ma')} />
            )}
          </td>
          <td {...gop} className={`break-words px-1.5 py-1 font-medium leading-tight text-ink ${nen} ${dem}`}>{r.ten_khach_hang || ''}</td>
          <td {...gop} className={`break-words px-1.5 py-1 leading-tight ${nen} ${dem}`}>{r.ma_don_hang || ''}</td>
          <td {...gop} className={`break-words px-1.5 py-1 leading-tight ${nen} ${dem}`}>
            <div>{r.ma_hang || ''}</div>
            {r.ma_phan && <div className="text-[11px] text-ink-soft">{r.ma_phan}</div>}
          </td>
          {/* Màn hẹp: 1 cột gộp Màu vải · Kích vải / Kích film. Màn ≥ 2xl: 3 cột riêng. */}
          <td {...gop} className={`${CHI_MAN_HEP} break-words px-1.5 py-1 leading-tight ${nen} ${dem}`}>
            <div>{r.mau_vai || ''}</div>
            {kich && <div className="text-[11px] text-ink-soft">{kich}</div>}
          </td>
          <td {...gop} className={`${CHI_MAN_RONG} break-words px-1.5 py-1 leading-tight ${nen} ${dem}`}>{r.mau_vai || ''}</td>
          <td {...gop} className={`${CHI_MAN_RONG} px-1.5 py-1 ${nen} ${dem}`}>{r.kich_vai || ''}</td>
          <td {...gop} className={`${CHI_MAN_RONG} px-1.5 py-1 ${nen} ${dem}`}>{r.kich_phim || ''}</td>
          <td {...gop} className={`px-1.5 py-1 text-right font-semibold tabular-nums text-primary ${nen} ${dem}`}>{ok ? fmtNum(H.soCan(r)) : ''}</td>
        </>
      )}
      {truong.map((t) => (
        <td key={t.k} className="px-1 py-1">
          {ok && t.kieu === 'chon' && (
            // ⚠ Ô chọn: Enter khi danh sách đang mở do Combobox xử lý (chọn mục, chặn nổi bọt) ⇒ `onChange` tự sang ô kế;
            //   danh sách đóng thì Enter nổi lên đây ⇒ sang ô kế. ↑↓ để Combobox dùng.
            <div ref={(el) => h.current.datRef(`${d.id}|${t.k}`, el)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.defaultPrevented) { e.preventDefault(); h.current.oKe(d.id, t.k); } }}>
              <SearchableSelect options={t.options} value={d.f[t.k] || ''} getSearch={t.getSearch}
                placeholder={t.placeholder}
                onChange={(v) => { h.current.setF(d.id, t.k, v); if (v) h.current.henSangKe(d.id, t.k); }} />
            </div>
          )}
          {ok && t.kieu === 'nguoi' && (
            // Enter khi danh sách đóng nổi lên đây ⇒ sang ô kế (cột cuối ⇒ dòng dưới); chọn từ danh sách /
            //   gõ tên mới + Enter ⇒ `onChange` tự sang ô kế. ↑ ↓ đi dòng (`onMuiTen`).
            <div ref={(el) => h.current.datRef(`${d.id}|${t.k}`, el)} style={{ minWidth: t.minW || 170 }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.defaultPrevented) { e.preventDefault(); h.current.oKe(d.id, t.k); } }}>
              <SearchableSelect chapNhanTuDo options={t.options || []} value={d.f[t.k] || ''}
                getValue={tenNguoi} getLabel={tenNguoi} getSearch={timNguoi}
                placeholder={t.placeholder || 'Chọn / gõ tên…'}
                onMuiTen={(huong, ten) => h.current.muiTenNguoi(d, t, huong, ten)}
                onChange={(v) => { h.current.setF(d.id, t.k, v); if (v) h.current.henSangKe(d.id, t.k); }} />
            </div>
          )}
          {ok && t.kieu !== 'chon' && t.kieu !== 'nguoi' && (
            <input ref={(el) => h.current.datRef(`${d.id}|${t.k}`, el)} type="number" min="0" inputMode="numeric"
              className={O_SO} value={d.f[t.k] ?? ''} disabled={dangLuu}
              onChange={(e) => h.current.setF(d.id, t.k, e.target.value)}
              onKeyDown={(e) => h.current.phim(e, d, t.k)} />
          )}
        </td>
      ))}
      {dau && (
        <td {...gop} className={`min-w-[100px] break-words px-1.5 py-1 text-xs leading-snug ${nen} ${dem}`}>
          {d.kq ? <span className="text-danger">✗ {d.kq}</span>
            : d.tt === 'TRA' ? <span className="text-ink-soft">{d.chu}</span>
              : d.tt === 'LOI' ? <span className="text-danger">{d.chu}</span>
                : dgChu ? <span className={dgOk ? (dgVang ? 'text-amber-700 dark:text-amber-400' : 'text-success') : 'text-danger'}>{dgChu}</span>
                  : null}
        </td>
      )}
      <td className="px-1 py-1 text-center">
        {coNutBo && (
          <button type="button" title="Bỏ dòng" className="text-ink-soft hover:text-danger disabled:opacity-40"
            disabled={dangLuu} onClick={() => h.current.boDong(d.id)}><Icon name="x" size={14} /></button>
        )}
      </td>
    </tr>
  );
});

export default function TichTemNhapModal({
  open, onClose, title, nhanXacNhan, show,
  traMa, khoaDong, maHien, soCan, nhanSoCan, truong, formMoi, danhGia, luu,
  truocXacNhan, onXong, phuTro, moTruoc, sauKhiLuu, iconXacNhan = 'check-circle', nhom,
}) {
  const [dong, setDong] = useState(() => [dongTrong()]);
  const [dangLuu, setDangLuu] = useState(false);
  const [tienDo, setTienDo] = useState('');
  const [hoiDong, setHoiDong] = useState(false);
  const [muonFocus, setMuonFocus] = useState(null); // { id, k, n } — đặt con trỏ sau lần vẽ kế
  const dongRef = useRef(dong);
  dongRef.current = dong;
  const refs = useRef({});

  const keys = useMemo(() => truong.map((t) => t.k), [truong]);
  const oCua = (d) => (d.tt === 'OK' ? keys : ['ma']);
  // `chon` = bôi đen chữ trong ô (mặc định có — quét lại là thay mã cũ); tra trượt khi người đang GÕ TAY thì không bôi đen.
  const datConTro = useCallback((id, k, chon = true) => setMuonFocus((m) => ({ id, k, chon, n: (m?.n || 0) + 1 })), []);
  // TỰ TRA MÃ (29/10/2026, người dùng: "đủ 12 số tự tìm luôn khỏi Enter, tự gõ thì dừng ~0,5 s tự hiện"):
  //   hẹn giờ tra của từng dòng · mã đang tra của từng dòng (chặn tra 2 lần cùng mã — đầu đọc vẫn gửi Enter sau 12 số)
  //   · lúc gõ phím cuối ở ô quét (Enter của đầu đọc tới SAU khi con trỏ đã nhảy sang ô "Đạt" thì bỏ qua).
  const henTra = useRef({});
  const dangTra = useRef({});
  const lucGoMa = useRef(0);
  const huyHenTra = (id) => { clearTimeout(henTra.current[id]); delete henTra.current[id]; };
  // Hẹn "sang ô kế" sau khi chọn ở ô danh mục / ô người — GỘP theo dòng: gõ tên mới + Enter làm ô chọn báo `onChange` 2 lần
  //   (Enter + lúc rời ô) ⇒ sang ô kế 2 lần ⇒ đẻ 2 dòng trống (lỗi thấy khi bấm thử 09/11/2026).
  const henKe = useRef({});
  const henSangKe = (id, k) => {
    clearTimeout(henKe.current[id]);
    henKe.current[id] = setTimeout(() => { delete henKe.current[id]; oKe(id, k); }, 80);
  };
  useEffect(() => () => {
    Object.values(henTra.current).forEach(clearTimeout);
    Object.values(henKe.current).forEach(clearTimeout);
  }, []);

  // Mở modal ⇒ bảng mới 1 dòng trống, con trỏ ở ô quét (Headless UI tự đặt focus lúc mở ⇒ đợi vài nhịp như các panel khác).
  useEffect(() => {
    if (!open) return undefined;
    const d0 = dongTrong();
    setDong([d0]); setTienDo(''); setHoiDong(false);
    const hen = [80, 250].map((ms) => setTimeout(() => datConTro(d0.id, 'ma'), ms));
    return () => hen.forEach(clearTimeout);
  }, [open, datConTro]);

  // Mỗi yêu cầu đặt con trỏ chỉ thực hiện 1 lần (đánh dấu `daDat`) — không thì gõ ở ô khác (đổi `dong`) bị kéo con trỏ về.
  // ⚠ Ô chọn người vừa đóng danh sách thì Headless UI còn khóa (`inert`) các ô khác vài nhịp ⇒ đặt con trỏ có THỬ LẠI.
  const daDat = useRef(0);
  useEffect(() => {
    if (!muonFocus || daDat.current === muonFocus.n) return undefined;
    const el = refs.current[`${muonFocus.id}|${muonFocus.k}`];
    const o = el && (el.tagName === 'INPUT' ? el : el.querySelector('input'));
    if (!o) return undefined;
    daDat.current = muonFocus.n;
    let lan = 0;
    let hen = null;
    const dat = () => {
      o.focus();
      if (document.activeElement !== o && lan < 20) { lan += 1; hen = setTimeout(dat, 16); return; }
      if (muonFocus.chon && o.select) o.select();
    };
    dat();
    return () => clearTimeout(hen);
  }, [muonFocus, dong]);

  const sua = (id, patch) => setDong((ds) => ds.map((d) => (d.id === id ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)));
  const setF = (id, k, v) => sua(id, (d) => ({ f: { ...d.f, [k]: v }, kq: null }));

  // Thêm 1 dòng trống cuối bảng (dòng cuối đang trống thì dùng luôn dòng đó — không đẻ dòng trống liên tiếp).
  const themDong = () => {
    const ds = dongRef.current;
    const cuoi = ds[ds.length - 1];
    if (cuoi && cuoi.tt !== 'OK' && !cuoi.ma.trim()) { datConTro(cuoi.id, 'ma'); return; }
    if (ds.length >= TOI_DA_DONG) { show?.(`Tối đa ${TOI_DA_DONG} tem một lượt`, 'error'); return; }
    const moi = dongTrong();
    setDong((cu) => [...cu, moi]);
    datConTro(moi.id, 'ma');
  };

  // Các dòng cùng tem với dòng `d` (chế độ `nhom`) — theo thứ tự bảng.
  const cungTem = (ds, d) => {
    const khoa = khoaDong(d.row);
    return ds.filter((x) => x.tt === 'OK' && khoaDong(x.row) === khoa);
  };

  // ↓ ở dòng CUỐI của 1 tem còn thiếu (chế độ `nhom`) ⇒ chèn ngay dưới 1 dòng nữa cho tem đó, đổ sẵn phần còn lại.
  //   Trả true khi đã chèn.
  const themTiep = (ds, i) => {
    const d = ds[i];
    if (!nhom || !d || d.tt !== 'OK') return false;
    const ke = ds[i + 1];
    if (ke && ke.tt === 'OK' && khoaDong(ke.row) === khoaDong(d.row)) return false;
    const con = nhom.conLai(d.row, cungTem(ds, d).map((x) => x.f));
    if (!(con > 0)) return false;
    if (ds.length >= TOI_DA_DONG) { show?.(`Tối đa ${TOI_DA_DONG} dòng một lượt`, 'error'); return true; }
    const moi = { ...dongTrong(), tt: 'OK', row: d.row, f: nhom.formTiep(d.row, con), tich: d.tich };
    setDong((cu) => {
      const j = cu.findIndex((x) => x.id === d.id);
      return j < 0 ? cu : [...cu.slice(0, j + 1), moi, ...cu.slice(j + 1)];
    });
    datConTro(moi.id, keys[0]);
    return true;
  };

  const sang = (id, k, buoc) => {
    const ds = dongRef.current;
    const i = ds.findIndex((d) => d.id === id);
    if (buoc === 1 && themTiep(ds, i)) return;
    const j = i + buoc;
    if (j < 0) return;
    if (j >= ds.length) { themDong(); return; }
    const dich = ds[j];
    datConTro(dich.id, oCua(dich).includes(k) ? k : oCua(dich)[0]);
  };

  const oKe = (id, k) => {
    const d = dongRef.current.find((x) => x.id === id);
    if (!d) return;
    const ds = oCua(d);
    const i = ds.indexOf(k);
    if (i >= 0 && i < ds.length - 1) datConTro(id, ds[i + 1]);
    else sang(id, ds[0], 1);
  };

  // `giaTri` = mã vừa gõ (gọi ngay trong onChange thì state chưa vẽ lại) · `goTay` = tra do hẹn giờ 0,5 s (người đang gõ).
  const tra = async (id, giaTri, goTay = false) => {
    huyHenTra(id);
    const d0 = dongRef.current.find((x) => x.id === id);
    if (!d0 || d0.tt === 'OK') return;
    const code = String(giaTri ?? d0.ma ?? '').trim();
    if (!code || dangTra.current[id] === code) return;
    dangTra.current[id] = code;
    sua(id, { tt: 'TRA', chu: 'Đang tra…' });
    let kq;
    try { kq = await traMa(code); } catch (e) { kq = { loi: e.message || 'Không tra được mã' }; }
    delete dangTra.current[id];
    // Trong lúc chờ người dùng đã sửa mã ⇒ bỏ kết quả cũ (lượt tra của mã mới tự chạy).
    const hienTai = dongRef.current.find((x) => x.id === id);
    if (!hienTai || String(hienTai.ma || '').trim() !== code) return;
    if (!kq?.row) {
      sua(id, { tt: 'LOI', chu: kq?.loi || 'Không tìm thấy tem' });
      datConTro(id, 'ma', !goTay);
      return;
    }
    const khoa = khoaDong(kq.row);
    const ds = dongRef.current;
    const trung = ds.findIndex((x) => x.id !== id && x.tt === 'OK' && khoaDong(x.row) === khoa);
    if (trung >= 0 && nhom) {
      // Quét lại tem đã có ⇒ thêm 1 dòng lỗi cho tem đó, chuyển dòng xuống ngay dưới các dòng của tem (gộp ô liền nhau).
      setDong((cu) => {
        const ban = cu.find((x) => x.id === id);
        const con = cu.filter((x) => x.id !== id);
        let cuoi = -1;
        con.forEach((x, j) => { if (x.tt === 'OK' && khoaDong(x.row) === khoa) cuoi = j; });
        if (!ban || cuoi < 0) return cu;
        const goc = con[cuoi];
        const fs = con.filter((x) => x.tt === 'OK' && khoaDong(x.row) === khoa).map((x) => x.f);
        const moi = { ...ban, tt: 'OK', row: goc.row, f: nhom.formTiep(goc.row, nhom.conLai(goc.row, fs)), tich: goc.tich, chu: '', kq: null };
        return [...con.slice(0, cuoi + 1), moi, ...con.slice(cuoi + 1)];
      });
      datConTro(id, keys[0]);
      return;
    }
    if (trung >= 0) {
      sua(id, { tt: 'LOI', ma: '', chu: `Tem ${maHien(kq.row)} đã có ở dòng ${trung + 1}` });
      datConTro(ds[trung].id, keys[0]);
      return;
    }
    sua(id, { tt: 'OK', row: kq.row, f: keThuaF(id, formMoi(kq.row)), tich: true, chu: '', kq: null });
    datConTro(id, keys[0]);
  };

  // Ô `keThua` còn trống ⇒ lấy giá trị dòng đã tra gần nhất phía trên (chưa có ⇒ `macDinh()`).
  const keThuaF = (id, f) => {
    const ds = dongRef.current;
    const i = ds.findIndex((x) => x.id === id);
    const out = { ...f };
    truong.filter((t) => t.keThua && !String(out[t.k] || '').trim()).forEach((t) => {
      const tren = ds.slice(0, Math.max(0, i)).reverse().find((x) => x.tt === 'OK' && String(x.f[t.k] || '').trim());
      out[t.k] = tren ? tren.f[t.k] : (t.macDinh ? t.macDinh() : '');
    });
    return out;
  };

  // ↑ ↓ ở ô chọn người: ↓ sang dòng dưới (dòng dưới đang TRỐNG tên thì chép tên này sang); ↑ lên dòng.
  const muiTenNguoi = (d, t, huong, ten) => {
    const ds = dongRef.current;
    const i = ds.findIndex((x) => x.id === d.id);
    const ke = ds[i + 1];
    if (huong === 'xuong' && ten && ke && ke.tt === 'OK' && !String(ke.f[t.k] || '').trim()) setF(ke.id, t.k, ten);
    sang(d.id, t.k, huong === 'xuong' ? 1 : -1);
  };

  const boDong = (id) => setDong((ds) => {
    const con = ds.filter((d) => d.id !== id);
    return con.length ? con : [dongTrong()];
  });

  // Gõ ở ô quét: ĐỦ 12 SỐ (mã tem ERP — đầu đọc / dán) ⇒ tra NGAY; còn lại (≥ 4 ký tự) ⇒ ngừng gõ 0,5 s mới tra.
  const doiMa = (id, v) => {
    lucGoMa.current = Date.now();
    huyHenTra(id);
    sua(id, { ma: v, tt: 'TRONG', chu: '' });
    const ma = v.trim();
    if (/^\d{12}$/.test(ma)) { tra(id, ma); return; }
    if (ma.length >= 4) henTra.current[id] = setTimeout(() => tra(id, undefined, true), 500);
  };

  const phim = (e, d, k) => {
    if (e.nativeEvent?.isComposing) return;
    if (k === 'ma') lucGoMa.current = Date.now();
    // Enter / mũi tên của đầu đọc tới sát sau 12 số mà con trỏ đã sang ô nhập ⇒ bỏ (không thì nhảy mất ô "Đạt").
    else if (Date.now() - lucGoMa.current < 250 && ['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (k === 'ma') tra(d.id); else oKe(d.id, k);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); sang(d.id, k, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); sang(d.id, k, -1);
    }
  };

  // Hàm cho từng dòng (`DongTichTem`) — 1 ref ổn định, nội dung cập nhật mỗi lần vẽ (các hàm đọc `dongRef` nên không cũ).
  const h = useRef({});
  h.current = {
    sua, setF, doiMa, phim, oKe, henSangKe, muiTenNguoi, boDong, soCan, maHien,
    datRef: (k, el) => { refs.current[k] = el; },
  };

  // NHÓM theo tem: mỗi đơn vị kiểm tra / tích / lưu. Không có `nhom` ⇒ mỗi dòng 1 nhóm (như cũ).
  //   `cacNhom` = [{ khoa, ds: [dòng…] }] theo thứ tự xuất hiện; `viTri[id]` = { dau, so, dg } để vẽ dòng.
  const { cacNhom, viTri } = useMemo(() => {
    const ds = []; const theoKhoa = new Map(); const vt = {};
    dong.forEach((d) => {
      if (d.tt !== 'OK') return;
      const khoa = nhom ? khoaDong(d.row) : d.id;
      let g = theoKhoa.get(khoa);
      if (!g) { g = { khoa, ds: [] }; theoKhoa.set(khoa, g); ds.push(g); }
      g.ds.push(d);
    });
    ds.forEach((g) => {
      const d0 = g.ds[0];
      g.dg = nhom ? nhom.danhGia(d0.row, g.ds.map((x) => x.f)) : danhGia(d0.row, d0.f);
      g.ds.forEach((x, k) => { vt[x.id] = { dau: k === 0, so: g.ds.length, dg: g.dg }; });
    });
    return { cacNhom: ds, viTri: vt };
  }, [dong, nhom, khoaDong, danhGia]);

  // Không còn ô tích (10/11/2026): MỌI dòng đã tra được mã đều vào lượt xác nhận — bỏ dòng thì bấm ×.
  const dongOk = dong.filter((d) => d.tt === 'OK');
  const dongTich = dongOk;
  const nhomTich = cacNhom;
  const soSai = nhomTich.filter((g) => !g.dg?.ok).length;
  const donVi = nhom ? 'tem' : 'dòng';
  const tongSo = truong.filter((t) => t.kieu !== 'chon' && t.kieu !== 'nguoi').map((t) => [t.label, dongTich.reduce((s, d) => s + n(d.f[t.k]), 0)]);

  // Áp 1 hàm cho mọi dòng đã tra được (nút phụ trợ của màn: "Đạt hết", "Mã lỗi chung"…).
  //   `fn(row, f, { thu, so })` — `thu` = vị trí dòng trong tem, `so` = số dòng của tem (chế độ `nhom`; không có ⇒ 0 / 1).
  const apMoiDong = (fn) => setDong((ds) => {
    const tong = {}; const dem = {};
    const khoaCua = (d) => (nhom ? khoaDong(d.row) : d.id);
    ds.forEach((d) => { if (d.tt === 'OK') tong[khoaCua(d)] = (tong[khoaCua(d)] || 0) + 1; });
    return ds.map((d) => {
      if (d.tt !== 'OK') return d;
      const k = khoaCua(d);
      const thu = dem[k] || 0;
      dem[k] = thu + 1;
      return { ...d, f: fn(d.row, d.f, { thu, so: tong[k] }), kq: null };
    });
  });

  const xacNhan = async () => {
    if (!nhomTich.length) { show?.('Chưa quét tem nào', 'error'); return; }
    if (soSai) { show?.(`Còn ${soSai} ${donVi} chưa hợp lệ — sửa số hoặc bỏ dòng (×) trước khi xác nhận`, 'error'); return; }
    if (truocXacNhan && !(await truocXacNhan(nhomTich.map((g) => g.ds[0].row)))) return;
    let ctx = null;
    if (moTruoc) {
      try { ctx = moTruoc(nhomTich.map((g) => ({ row: g.ds[0].row, f: g.ds[0].f, fs: g.ds.map((x) => x.f) }))); } catch (e) { show?.(e.message || 'Không mở được cửa sổ in', 'error'); return; }
    }
    setDangLuu(true);
    const okIds = new Set(); const loi = []; const kq = {}; const daLuu = [];
    let soOk = 0;
    for (let i = 0; i < nhomTich.length; i += 1) {
      const g = nhomTich[i];
      const d = g.ds[0];
      setTienDo(`Đang lưu ${i + 1}/${nhomTich.length} · ${maHien(d.row)}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = nhom ? await nhom.luu(d.row, g.ds.map((x) => x.f)) : await luu(d.row, d.f);
        g.ds.forEach((x) => okIds.add(x.id));
        soOk += 1;
        daLuu.push({ row: d.row, f: d.f, fs: g.ds.map((x) => x.f), data: res && res.data !== undefined ? res.data : res });
      } catch (e) {
        g.ds.forEach((x) => { kq[x.id] = e.message || 'Lưu lỗi'; });
        loi.push(maHien(d.row));
      }
    }
    let ketIn = null;
    if (sauKhiLuu) {
      setTienDo('Đang chuẩn bị tem để in…');
      try { ketIn = await sauKhiLuu(ctx, daLuu); } catch (e) { ketIn = { loi: e.message || 'In tem lỗi' }; }
    }
    setTienDo('');
    setDangLuu(false);
    const con = dongRef.current.filter((d) => !okIds.has(d.id)).map((d) => (kq[d.id] ? { ...d, kq: kq[d.id] } : d));
    const conDong = con.length ? con : [dongTrong()];
    setDong(conDong);
    onXong?.(soOk, loi, ketIn);
    if (loi.length) {
      const dauLoi = conDong.find((d) => d.kq);
      if (dauLoi) datConTro(dauLoi.id, keys[0]);
    }
  };

  const xinDong = () => {
    if (dangLuu) return;
    if (dong.some((d) => d.tt === 'OK')) { setHoiDong(true); return; }
    onClose();
  };

  if (!open) return null;
  return (
    <>
      <Modal open={open} onClose={xinDong} size="full" lapDay title={title}
        footer={(
          <>
            <span className="mr-auto text-sm text-ink-soft">
              {tienDo || (soSai > 0
                ? <span className="text-danger">{soSai} {donVi} chưa hợp lệ</span>
                : (
                  <>
                    <b className="text-ink">{nhomTich.length}</b> tem
                    {nhom && dongTich.length > nhomTich.length && <> · {dongTich.length} dòng</>}
                    {tongSo.map(([l, v]) => (v ? <span key={l}> · {l.toLowerCase()} <b className="text-ink">{fmtNum(v)}</b></span> : null))}
                  </>
                ))}
            </span>
            <Button chiXemOk variant="ghost" onClick={xinDong} disabled={dangLuu}>Đóng</Button>
            <Button icon={iconXacNhan} onClick={xacNhan} loading={dangLuu} disabled={!nhomTich.length || soSai > 0}>
              {nhanXacNhan} ({nhomTich.length})
            </Button>
          </>
        )}>
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2 text-sm">
            {phuTro && phuTro({ apMoiDong, dangLuu, coDong: dongOk.length > 0 })}
            <Button variant="secondary" icon="plus" onClick={themDong} disabled={dangLuu}>Thêm dòng (↓)</Button>
            <span className="text-xs text-ink-soft">
              Quét mã tem + Enter ⇒ tự nhảy sang ô nhập · Enter sang ô kế · ↓ thêm dòng / xuống dòng · ↑ lên dòng.
              {nhom && ' 1 tem nhiều lỗi: còn thiếu số lượng thì ↓ (hoặc quét lại mã tem) để thêm dòng lỗi cho tem đó.'}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-card border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-muted text-left text-[11px] uppercase leading-tight tracking-wide text-ink-soft">
                <tr>
                  <th className="w-7 px-1 py-2 text-right">#</th>
                  <th className="px-1.5 py-2">Mã tem (quét)</th>
                  <th className="px-1.5 py-2">Khách hàng</th>
                  <th className="px-1.5 py-2">Đơn hàng</th>
                  <th className="px-1.5 py-2">Mã hàng</th>
                  <th className={`${CHI_MAN_HEP} px-1.5 py-2`}>Màu vải · Kích vải / film</th>
                  <th className={`${CHI_MAN_RONG} px-1.5 py-2`}>Màu vải</th>
                  <th className={`${CHI_MAN_RONG} px-1.5 py-2`}>Kích vải</th>
                  <th className={`${CHI_MAN_RONG} px-1.5 py-2`}>Kích film</th>
                  <th className="px-1.5 py-2 text-right">{nhanSoCan}</th>
                  {truong.map((t) => (
                    <th key={t.k} className="px-1.5 py-2" style={t.minW ? { minWidth: t.minW } : { width: 72 }}>{t.label}</th>
                  ))}
                  <th className="px-1.5 py-2">Kiểm tra</th>
                  <th className="w-7 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {dong.map((d, i) => {
                  const vt = viTri[d.id];
                  return (
                    <DongTichTem key={d.id} d={d} i={i} truong={truong} dangLuu={dangLuu} h={h}
                      coNutBo={!!(d.tt === 'OK' || d.ma || dong.length > 1)}
                      dau={vt ? vt.dau : true} soDong={vt ? vt.so : 1}
                      dgOk={!!vt?.dg?.ok} dgChu={vt?.dg?.chu || ''} dgVang={!!vt?.dg?.motPhan} />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={hoiDong} onClose={() => setHoiDong(false)} variant="danger" confirmText="Đóng, bỏ dữ liệu"
        title="Đóng bảng tích tem?" message={`Còn ${dongOk.length} tem đã quét chưa xác nhận — đóng là bỏ số đã nhập.`}
        onConfirm={() => { setHoiDong(false); onClose(); }} />
    </>
  );
}
