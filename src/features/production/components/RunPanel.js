import { useEffect, useState, useCallback, useRef } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import SearchableSelect from '../../../components/common/SearchableSelect';
import NhieuNguoiSelect from '../../../components/common/NhieuNguoiSelect';
import TimeSelect from '../../../components/common/TimeSelect';
import { Field, Input, Textarea, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useHuyLichSu from '../../../hooks/useHuyLichSu';
import { getRun, printTem, printTemBatch, reprintTem, getTemLabel, getTemLogs, finishRun, stopLine, resumeLine, addVaiHuy, savePhanCong, pauseLenhChay, listProductionCandidates, startProduction, vuotSanXuat, doiChuyen, traVeKyThuatSanXuat, listChuyen, listLyDoNgung, listToIn, luuLyDoBoSungDotVai, huyTemTaiLichSu, moLaiTemTaiLichSu } from '../../../services/productionService';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import TraVeKeHoachModal from './TraVeKeHoachModal';
import { listUserOptions } from '../../../services/userService';
import printTemLabel, { printTemLabelNhieu, moSanCuaSoIn, dongCuaSoIn } from '../utils/printTemLabel';
import { fmtNum, fmtDate, ngayLocalISO } from '../../../utils/format';
import { getSocket } from '../../../services/socket';

// Ô "Số tem" (07/10/2026): in N tem cùng SL trong 1 lần bấm — mỗi tem 1 tờ (15 trái · 16 phải), mọi tờ trong
// 1 cửa sổ in. Trần khớp backend `printTemBatch TOI_DA_TEM_MOT_LUOT`.
export const TOI_DA_SO_TEM = 50;
export const soTemHopLe = (v) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, TOI_DA_SO_TEM) : 1;
};

const TEM_TONE = { IN: 'warning', DANG_PHOI: 'info', DA_KHO: 'success', HUY: 'danger' };
const TEM_LABEL = { IN: 'Chờ phơi', DANG_PHOI: 'Đang phơi', DA_KHO: 'Đã khô', HUY: 'Đã hủy' };
const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

// Ô nhập số trong bảng modal (gọn, canh phải). `text-base md:text-sm`: iOS phóng to trang khi focus
// input có font < 16px và không tự thu lại (xem ghi chú ở `components/common/controls.js`).
const numCls = 'w-24 rounded-control border border-line bg-surface px-2 py-1.5 text-right text-base md:text-sm text-ink outline-none focus:border-primary';
const TH = 'whitespace-nowrap px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft';
const TD = 'whitespace-nowrap px-2.5 py-2 text-sm text-ink';

// Các cột chung "Khách hàng → Loại đợt vải" của 2 modal In tem gom set / Phân công.
// ⚠ Component đặt ở MỨC MODULE (không lồng trong RunPanel) để React giữ nguyên identity giữa các lần
// render — nếu lồng, mỗi lần cha render sẽ remount ⇒ ô input trong bảng mất focus khi đang gõ.
function PhanInInfoCells({ r, stt }) {
  return (
    <>
      <td className={`${TD} text-center text-ink-soft`}>{stt}</td>
      <td className={`${TD} font-medium`}>{r.ten_khach_hang || '—'}</td>
      <td className={TD}>{r.ma_don_hang || '—'}</td>
      <td className={TD}>{r.ma_hang || '—'}</td>
      <td className={TD}>{r.ma_phan || '—'}</td>
      <td className={TD}>{r.mau_vai || '—'}</td>
      <td className={TD}>{r.kich_vai || '—'}</td>
      <td className={TD}>{r.kich_phim || '—'}</td>
      <td className={TD}>{r.ten_loai_dot_vai || '—'}</td>
    </>
  );
}

const INFO_HEADERS = ['STT', 'Khách hàng', 'Đơn hàng', 'Mã hàng', 'Code phần', 'Màu vải', 'Kích vải', 'Kích phim', 'Loại đợt vải'];

// ─── NGÀY CA · GIỜ SẢN XUẤT · BTP (mig 066 + 068) ─────────────────────────────
// Nhập theo LƯỢT IN, lưu vào TỪNG TEM tạo ra trong lượt đó. KHÔNG in lên nhãn tem — chỉ để tra cứu.
// ⚠ Đặt ở MỨC MODULE (không lồng trong RunPanel/PrintSetModal) — component lồng bị remount mỗi lần
// cha render ⇒ ô nhập mất focus khi đang gõ (cùng luật với `PhanInInfoCells`).
//
// NGÀY CA là Ô CHỮ dạng `YYMMDD` + mã ca (`260805D2` = 05/08/2026 ca Dài 2 · `C2` ca Ngắn 2 · `HC` hành chính).
// `ngayCt` = NGÀY CHỨNG TỪ gửi lên ERP (`@pNgayct`).
// ⚠⚠ "NHẬP ĐẦU CA" (13/10/2026, người dùng chốt): 2 ô này KHÔNG còn điền sẵn theo giờ / hôm nay — để TRỐNG, thiếu
//   là KHÔNG cho in tem (FE báo + BE 422 `THIEU_NGAY_CA`). Người in nhập 1 lần đầu ca; BE nhớ theo LƯỢT CA
//   (`goi_y_tem.ngay_ca` / `ngay_ct` / `khoa_ca`) nên các lượt in sau trong ca tự điền lại; hết ca ⇒ trống lại.
//   `_khoaCa` = lượt ca mà giá trị đang gõ thuộc về — gửi kèm (`khoaCa`) để BE chặn 409 `HET_CA` khi sidebar mở
//   sẵn từ ca trước.
// GIỜ dùng `TimeSelect` (0h–23h + phút) chứ KHÔNG `<input type="time">` — ô đó hiện AM/PM theo locale máy.
// ⚠ 26/10/2026 (người dùng: "ngày chứng từ cho tự động hiện sẵn ngày hiện tại"): Ngày chứng từ TỰ ĐIỀN HÔM NAY
//   (`_ctTuDong` = ô đang mang giá trị tự điền). Giá trị đã nhớ của lượt ca (người in nhập đầu ca) vẫn THẮNG giá trị tự
//   điền; người dùng gõ tay thì giữ nguyên. Ngày ca vẫn để trống, bắt nhập đầu ca như cũ.
const homNay = () => ngayLocalISO(new Date());
export const META_MAC_DINH = () => ({ ngayCa: '', gioBd: '', gioKt: '', btpTruoc: false, btpCuoi: false, gcMauVai: '', ngayCt: homNay(), _ctTuDong: true, _suaGioKt: false, _khoaCa: '' });
export const gioHienTai = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
// Mã ngày ca ĐÚNG 8 ký tự = YYMMDD (ngày có thật) + ca C1/C2/C3 · D1/D2 · HC, vd `261021HC` (21/10/2026 — ca thật tem
//   152608077267 in với `2610520D1`). Gương BE `utils/ca.js maNgayCaHopLe` / `NGAY_CA_SAI`. Trống ⇒ không coi là sai
//   (đã có câu "Chưa nhập"). Trả câu báo hoặc ''.
export const NGAY_CA_SAI = 'Nhập ngày ca không đúng — phải đủ 8 ký tự: năm tháng ngày + ca, vd 261021HC (ca: C1 · C2 · C3 · D1 · D2 · HC)';
export const maNgayCaSai = (ma) => {
  const s = String(ma || '').trim();
  if (!s) return '';
  const m = /^(\d{2})(\d{2})(\d{2})(C1|C2|C3|D1|D2|HC)$/.exec(s);
  if (!m) return NGAY_CA_SAI;
  const [yy, mm, dd] = [m[1], m[2], m[3]].map(Number);
  const d = new Date(Date.UTC(2000 + yy, mm - 1, dd));
  return d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd ? '' : NGAY_CA_SAI;
};
// Thiếu Ngày ca / Ngày chứng từ, hoặc ngày ca sai dạng ⇒ câu báo (rỗng = đủ). Gọi TRƯỚC khi mở cửa sổ in.
export const thieuNgayCaCt = (m) => {
  const thieu = [!String(m?.ngayCa || '').trim() && 'Ngày ca', !m?.ngayCt && 'Ngày chứng từ'].filter(Boolean);
  if (thieu.length) return `Chưa nhập ${thieu.join(' và ')} — nhập 1 lần đầu ca rồi mới in tem được`;
  return maNgayCaSai(m?.ngayCa);
};
export const CHUA_THO_IN = 'Chưa phân công thợ in / tổ in — chọn thợ in và tổ in ở khối Phân công rồi bấm Lưu trước khi in tem';
// Phân công chưa đủ để in tem: chưa có thợ in, hoặc ca này chuyền chưa phân công (gương BE `kiemThoInPhanCong`).
// TẢI NGẦM khi lệnh đang mở đổi ở MÁY KHÁC (21/10/2026): sidebar trước đây chỉ tải lúc mở ⇒ chuyền vừa được phân
//   công ở máy khác mà máy này vẫn hiện "chưa phân công + Lưu phân công" (khóa In tem). Nghe `production:updated`,
//   chỉ tải khi `lenhId` của sự kiện thuộc các lệnh đang mở; gộp sự kiện dồn trong 600 ms; không spinner, lỗi nuốt.
export function useTaiNgamKhiLenhDoi(lenhIds, taiLai) {
  const ref = useRef(taiLai);
  ref.current = taiLai;
  const khoa = (lenhIds || []).filter(Boolean).join(',');
  useEffect(() => {
    const s = getSocket();
    if (!s || !khoa) return undefined;
    const ds = khoa.split(',');
    let hen = null;
    const nghe = (p) => {
      if (!p || !ds.includes(p.lenhId)) return;
      if (hen) clearTimeout(hen);
      hen = setTimeout(() => { hen = null; Promise.resolve(ref.current()).catch(() => {}); }, 600);
    };
    s.on('production:updated', nghe);
    return () => { if (hen) clearTimeout(hen); s.off('production:updated', nghe); };
  }, [khoa]);
}

// `coToIn` = danh mục tổ in đang có tổ (27/10/2026: thiếu TỔ IN cũng khóa in tem — gương BE `CHUA_PHAN_CONG_TO_IN`).
export const chuaPhanCongThoIn = (pc, coToIn = false) => !!pc?.can_phan_cong_lai || !String(pc?.tho_in || '').trim()
  || (coToIn && !pc?.to_in_id);
// Đưa gợi ý của BE vào ô: chỉ điền ô người dùng CHƯA gõ; lượt ca đã đổi so với lúc gõ ⇒ bỏ ngày ca / ngày chứng
// từ của ca cũ trước (để trống lại cho ca mới).
export const apGoiYTem = (m, g) => {
  if (!g) return m;
  const sangCa = !!m._khoaCa && !!g.khoa_ca && m._khoaCa !== g.khoa_ca;
  const b = sangCa ? { ...m, ngayCa: '', ngayCt: '', _ctTuDong: true } : m;
  // Ô Ngày chứng từ còn trống / đang mang giá trị TỰ ĐIỀN ⇒ lấy giá trị nhớ của lượt ca, không có thì hôm nay.
  const ctTuDong = !b.ngayCt || b._ctTuDong;
  return {
    ...b,
    ngayCa: b.ngayCa || g.ngay_ca || '',
    ngayCt: ctTuDong ? (g.ngay_ct || homNay()) : b.ngayCt,
    _ctTuDong: ctTuDong ? !g.ngay_ct : false,
    gioBd: b.gioBd || g.gio_bd || '',
    gioKt: b.gioKt || g.gio_kt || '',
    _khoaCa: g.khoa_ca || '',
  };
};
// ⚠⚠ "ĐẾN GIỜ" CHẠY THEO ĐỒNG HỒ tới khi người dùng TỰ SỬA (30/09/2026): bản cũ điền giờ LÚC MỞ SIDEBAR rồi
//   đứng yên ⇒ để sidebar mở lâu rồi bấm In là gửi ERP giờ kết thúc cũ. Cờ `_suaGioKt` bật khi người dùng
//   chọn giờ ở ô đó; chưa bật ⇒ vòng 20s + lúc bấm In đều cập nhật về giờ hiện tại (ô hiện gì = gửi nấy).
// Ngày chứng từ còn là giá trị TỰ ĐIỀN ⇒ lấy lại hôm nay lúc bấm In (sidebar mở qua nửa đêm không gửi ngày hôm qua).
export const metaGuiDi = (m) => ({
  ...(m._suaGioKt ? m : { ...m, gioKt: gioHienTai() }),
  ...(m._ctTuDong ? { ngayCt: homNay() } : {}),
  khoaCa: m._khoaCa || '',
});

// `anGcMauVai`: lệnh GOM SET nhập GC màu vải RIÊNG từng dòng trong bảng → ẩn ô chung ở đây cho khỏi lẫn.
// `anBtp` (25/10/2026): bảng In tem nhiều phần nhập BTP trước/cuối RIÊNG từng dòng ⇒ ẩn 2 ô chung.
export function TemMetaFields({ meta, setMeta, anGcMauVai = false, anBtp = false }) {
  const set = (k, v) => setMeta((m) => ({ ...m, [k]: v, ...(k === 'gioKt' ? { _suaGioKt: true } : {}), ...(k === 'ngayCt' ? { _ctTuDong: false } : {}) }));
  const chk = 'h-4 w-4 rounded border-line text-primary focus:ring-primary/30';
  const batBuoc = <span className="text-danger"> *</span>;
  const thieuCa = !String(meta.ngayCa || '').trim();
  const caSai = maNgayCaSai(meta.ngayCa);
  return (
    <div className="rounded-control border border-line bg-surface-muted/40 p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Ngày ca{batBuoc}</span>
          {/* Viết HOA + bỏ khoảng trắng ngay lúc gõ (`261021hc` → `261021HC`). KHÔNG `maxLength`: cắt cụt chuỗi dán
              9 ký tự có thể ra mã đúng dạng mà sai ngày — để nguyên cho người nhập thấy lỗi. */}
          <Input value={meta.ngayCa}
            onChange={(e) => set('ngayCa', e.target.value.replace(/\s+/g, '').toUpperCase())}
            placeholder="vd: 261021HC" className={`tabular-nums ${thieuCa || caSai ? 'border-danger' : ''}`} />
          {caSai && <span className="mt-0.5 block text-[11px] leading-snug text-danger">{caSai}</span>}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Từ giờ</span>
          <TimeSelect value={meta.gioBd} onChange={(v) => set('gioBd', v)} minuteStep={1} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Đến giờ</span>
          <TimeSelect value={meta.gioKt} onChange={(v) => set('gioKt', v)} minuteStep={1} />
        </label>
      </div>
      {/* NGÀY CHỨNG TỪ — con số gửi lên ERP (`Ngayct`), KHÔNG phải ngày ca (ô trên) — 2 thứ khác nhau.
          Tự điền hôm nay (26/10/2026); ca đã có người nhập thì điền lại giá trị đó; sửa tay được, bắt buộc. */}
      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-medium text-ink-soft">Ngày chứng từ (gửi ERP){batBuoc}</span>
        <Input type="date" value={meta.ngayCt || ''} onChange={(e) => set('ngayCt', e.target.value)}
          className={meta.ngayCt ? '' : 'border-danger'} />
      </label>
      {!anGcMauVai && (
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">GC màu vải</span>
          <Input value={meta.gcMauVai || ''} onChange={(e) => set('gcMauVai', e.target.value)}
            placeholder="GC màu vải của tem này" />
        </label>
      )}
      {!anBtp && (
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" className={chk} checked={!!meta.btpTruoc}
              onChange={(e) => set('btpTruoc', e.target.checked)} /> BTP trước
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" className={chk} checked={!!meta.btpCuoi}
              onChange={(e) => set('btpCuoi', e.target.checked)} /> BTP cuối
          </label>
        </div>
      )}
    </div>
  );
}

// ─── SỐ LƯỢNG BỔ SUNG cho 1 ĐỢT VẢI (inline, mig 077 + 079) ───────────────────
// Chỉ hiện với đợt vải loại BỔ SUNG. Chia SL bổ sung theo TRÁCH NHIỆM:
//   vd bổ sung 50 = 40 do CÔNG TY làm sai + 10 do KHÁCH HÀNG (giao vải thiếu…).
//
// ⚠⚠ ĐÃ BỎ Ô CHỌN LÝ DO (chốt 12/08/2026) — chỉ còn 2 ô SỐ LƯỢNG + ghi chú. Cột `ly_do_bo_sung_id`
//   (mig 077) giữ trong DB cho dữ liệu đã nhập trước đó, nhưng FE KHÔNG gửi lên nữa.
// ⚠ Σ(cty + khách) nên bằng SL vải về của đợt bổ sung — lệch thì chỉ CẢNH BÁO màu, KHÔNG chặn Lưu
//   (số ERP và số thực nhận có thể khác; đây là ô nhập ở chuyền đang chạy).
// ⚠ Đặt ở MỨC MODULE (không lồng trong RunPanel) — component lồng bị remount mỗi lần cha render ⇒
//   ô nhập mất focus khi đang gõ (cùng luật với `PhanCongInline`/`TemMetaFields`).
function LyDoBoSungInline({ dot, canRun, onSave }) {
  const daGhi = dot.sl_bo_sung_cty != null || dot.sl_bo_sung_khach != null || !!dot.ghi_chu_bo_sung;
  const [sua, setSua] = useState(false);
  const [form, setForm] = useState({ slCty: '', slKhach: '', ghiChu: '' });
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    setForm({
      slCty: dot.sl_bo_sung_cty == null ? '' : String(dot.sl_bo_sung_cty),
      slKhach: dot.sl_bo_sung_khach == null ? '' : String(dot.sl_bo_sung_khach),
      ghiChu: dot.ghi_chu_bo_sung || '',
    });
  }, [dot.sl_bo_sung_cty, dot.sl_bo_sung_khach, dot.ghi_chu_bo_sung, sua]);

  const dangSua = canRun && (!daGhi || sua);
  const num = (v) => Math.max(0, Math.trunc(Number(v) || 0));
  const tong = num(form.slCty) + num(form.slKhach);
  const slVe = Number(dot.so_luong_vai_ve) || 0;
  const lech = slVe > 0 && tong > 0 && tong !== slVe;
  const coSo = form.slCty !== '' || form.slKhach !== '';

  const luu = async () => {
    setDangLuu(true);
    const ok = await onSave(dot.dot_vai_ve_id, {
      slCty: form.slCty === '' ? null : num(form.slCty),
      slKhach: form.slKhach === '' ? null : num(form.slKhach),
      ghiChu: form.ghiChu,
    });
    setDangLuu(false);
    if (ok) setSua(false);   // lỗi thì GIỮ ô nhập, không mất thứ đang gõ
  };

  return (
    <div className="rounded-control border border-amber-300/60 bg-amber-50/40 px-3 py-2.5 dark:bg-amber-950/10">
      <div className="mb-1.5 text-xs">
        <b className="text-ink">{dot.ma_dot_vai}</b>
        <span className="text-ink-soft"> · {dot.ma_phan} · {dot.mau_vai}</span>
        <Badge tone="warning" className="ml-1.5">{dot.ten_loai_dot_vai || 'Bổ sung'}</Badge>
        {slVe > 0 && <span className="ml-1.5 text-ink-soft">SL vải về <b className="text-ink">{fmtNum(slVe)}</b></span>}
      </div>
      {dangSua ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">SL do công ty</span>
              <Input type="number" min="0" value={form.slCty} placeholder="vd: 40"
                onChange={(e) => setForm((f) => ({ ...f, slCty: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">SL do khách hàng</span>
              <Input type="number" min="0" value={form.slKhach} placeholder="vd: 10"
                onChange={(e) => setForm((f) => ({ ...f, slKhach: e.target.value }))} />
            </label>
          </div>
          <div className={`text-xs ${lech ? 'text-amber-600' : 'text-ink-soft'}`}>
            Tổng <b>{fmtNum(tong)}</b>{slVe > 0 ? ` / ${fmtNum(slVe)} SL vải về` : ''}
            {lech ? ' — lệch so với SL vải về, kiểm lại giúp (vẫn lưu được)' : ''}
          </div>
          <Textarea rows={2} value={form.ghiChu}
            onChange={(e) => setForm((f) => ({ ...f, ghiChu: e.target.value }))}
            placeholder="Ghi chú thêm (tùy chọn) — vd: in hư 40, khách giao vải thiếu 10" />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={luu} loading={dangLuu}
              disabled={!coSo && !form.ghiChu.trim()}>Lưu số lượng bổ sung</Button>
            {daGhi && <Button chiXemOk variant="ghost" onClick={() => setSua(false)}>Hủy</Button>}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span className="text-ink-soft">Do công ty: <b className="text-ink">{dot.sl_bo_sung_cty == null ? '—' : fmtNum(dot.sl_bo_sung_cty)}</b></span>
              <span className="text-ink-soft">Do khách hàng: <b className="text-ink">{dot.sl_bo_sung_khach == null ? '—' : fmtNum(dot.sl_bo_sung_khach)}</b></span>
            </div>
            {dot.ghi_chu_bo_sung && <div className="mt-0.5 text-xs text-ink-soft">{dot.ghi_chu_bo_sung}</div>}
          </div>
          {canRun && <Button variant="ghost" icon="pencil" className="px-2.5 py-1 text-xs"
            onClick={() => setSua(true)}>Sửa</Button>}
        </div>
      )}
    </div>
  );
}

// ─── PHÂN CÔNG (inline, không modal) ──────────────────────────────────────────
// Lần đầu: 3 ô nhập + nút Lưu. Đã lưu: hiện thẳng tên + nút Sửa (bấm mới cho sửa lại).
// "Thợ in" là 1 ô chữ = DANH SÁCH thợ trên chuyền (mức phiếu) — BE ghi cùng chuỗi cho mọi đợt vải.
//
// ⚠ CẢ 3 Ô ĐỀU CHỌN TỪ DANH SÁCH TÀI KHOẢN (2026-08-12) — trước đây Chuyền trưởng/Thợ in là ô chữ gõ
//   tay nên mỗi người viết một kiểu ("Nguyễn Văn A" / "nguyen van a" / "A"), không đối chiếu được.
//   Ca trưởng lưu **id** (`phieu_san_xuat.ca_truong_id`), còn Chuyền trưởng / Thợ in lưu **TÊN**
//   (`chuyen_truong` VARCHAR · `tho_in` TEXT) ⇒ đổi sang ô chọn KHÔNG cần migration, và vẫn cho gõ
//   tên người chưa có tài khoản (thợ khoán) — xem `NhieuNguoiSelect`.
// `thoInKh` (mig 111) = thợ in KẾ HOẠCH chọn lúc Release 1 — chưa phân công thì điền sẵn vào ô Thợ in (vẫn phải
//   bấm Lưu mới thành phân công thật, vì phân công là thứ gửi ERP).
// Dòng chú thích PHÂN CÔNG ĐẦU CA (19/10/2026): BE nhớ phân công theo CHUYỀN × LƯỢT CA (`production.service
//   phanCongCaHienTai`). `pc.tu_dau_ca` = chuyền đã phân công trong ca này (lưu ở lệnh nào cũng được) · `pc.can_phan_cong_lai`
//   = ca này chưa ai phân công cho chuyền ⇒ phải nhập + Lưu (đổ sẵn người cũ của phiếu).
const gioPhut = (t) => { const d = t ? new Date(t) : null; return d && !Number.isNaN(d.getTime()) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''; };
function GhiChuDauCa({ pc }) {
  const dc = pc?.dau_ca;
  if (!dc) return null;
  if (pc.can_phan_cong_lai) {
    return (
      <p className="mb-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
        <b>Ca {dc.ma_ngay_ca}</b>: chuyền này chưa phân công — chọn người rồi bấm <b>Lưu phân công</b>. Lưu 1 lần là áp cho
        mọi lệnh của chuyền trong ca này.
      </p>
    );
  }
  // 21/10/2026 (người dùng): lệnh thừa hưởng phân công của chuyền phải trông như ĐÃ LƯU — ghi rõ "Đã phân công",
  //   không cần bấm Lưu ở lệnh này.
  return (
    <p className="mb-2 rounded-control border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
      <b>✓ Đã phân công ca {dc.ma_ngay_ca}</b> cho chuyền{dc.nguoi ? ` — ${dc.nguoi} lưu lúc ${gioPhut(dc.tg)}` : ''}.
      Mọi lệnh của chuyền trong ca dùng chung, không cần Lưu lại; sang ca mới mới phân công lại.
    </p>
  );
}

export function PhanCongInline({ pc, users, toIns = [], onSave, busy, canRun, thoInKh = '' }) {
  // Sang ca mới (`can_phan_cong_lai`) ⇒ coi như CHƯA lưu: mở ô nhập, đổ sẵn người của ca trước.
  const daLuu = !pc?.can_phan_cong_lai && !!(pc?.ca_truong_id || pc?.chuyen_truong || pc?.tho_in || pc?.to_in_id);
  const [sua, setSua] = useState(false);
  const [form, setForm] = useState({ caTruongId: '', chuyenTruong: '', thoIn: '', toInId: '' });
  // Danh mục rỗng = chưa chạy mig 084 (hoặc xưởng chưa nhập tổ nào) ⇒ ẩn hẳn ô, đừng hiện ô chọn trống.
  const coToIn = toIns.length > 0;

  // Nạp lại mỗi khi dữ liệu server đổi (sau khi lưu) hoặc khi bấm Sửa.
  useEffect(() => {
    setForm({
      caTruongId: pc?.ca_truong_id || '', chuyenTruong: pc?.chuyen_truong || '',
      thoIn: pc?.tho_in || thoInKh || '', toInId: pc?.to_in_id || '',
    });
  }, [pc?.ca_truong_id, pc?.chuyen_truong, pc?.tho_in, pc?.to_in_id, sua, thoInKh]);

  const dangSua = canRun && (!daLuu || sua); // không có quyền PROD_RUN → chỉ xem
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  if (!dangSua) {
    return (
      <>
      <GhiChuDauCa pc={pc} />
      <div className="rounded-control border border-line px-3 py-2.5 text-sm">
        <div className="grid grid-cols-1 gap-y-1">
          <div><span className="text-ink-soft">Ca trưởng:</span> <b className="text-ink">{pc?.ca_truong_ten || '—'}</b></div>
          <div><span className="text-ink-soft">Chuyền trưởng:</span> <b className="text-ink">{pc?.chuyen_truong || '—'}</b></div>
          <div>
            <span className="text-ink-soft">Thợ in:</span> <b className="text-ink">{pc?.tho_in || thoInKh || '—'}</b>
            {!pc?.tho_in && thoInKh && <span className="text-xs text-ink-soft"> (kế hoạch)</span>}
          </div>
          {coToIn && (
            <div>
              <span className="text-ink-soft">Tổ in:</span>{' '}
              <b className="text-ink">{pc?.ma_to ? `${pc.ma_to}${pc.ten_to ? ` — ${pc.ten_to}` : ''}` : '—'}</b>
            </div>
          )}
        </div>
        {canRun && (
          <Button variant="secondary" className="mt-2 w-full" icon="edit" onClick={() => setSua(true)} disabled={busy}>
            Sửa phân công
          </Button>
        )}
      </div>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <GhiChuDauCa pc={pc} />
      <Field label="Ca trưởng">
        <SearchableSelect
          value={form.caTruongId}
          onChange={(v) => set('caTruongId', v)}
          options={users}
          getValue={(u) => u.id}
          getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''}
          getSearch={(u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`}
          placeholder="Gõ tên hoặc tên đăng nhập để tìm..."
        />
      </Field>
      {/* ⚠ `chapNhanTuDo`: ô này TRƯỚC ĐÂY là ô chữ gõ tay, đổi sang ô chọn mà chặt quá thì MẤT khả
          năng ghi tên người chưa có tài khoản. Cột `chuyen_truong` lưu TÊN nên nhận chữ thô là hợp lệ. */}
      <Field label="Chuyền trưởng" hint="Chọn trong danh sách, hoặc gõ tên rồi Enter nếu người đó chưa có tài khoản">
        <SearchableSelect
          chapNhanTuDo
          value={form.chuyenTruong}
          onChange={(v) => set('chuyenTruong', v)}
          options={users}
          getValue={(u) => u.ho_ten || u.ten_dang_nhap || ''}
          getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''}
          getSearch={(u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`}
          placeholder="Gõ tên hoặc tên đăng nhập để tìm..."
        />
      </Field>
      <Field label="Thợ in trên chuyền" hint="Chọn xong 1 người là tự thêm vào danh sách, chọn tiếp được; tên chưa có trong danh sách thì gõ rồi Enter">
        <NhieuNguoiSelect
          value={form.thoIn}
          onChange={(v) => set('thoIn', v)}
          options={users}
          placeholder="Gõ tên thợ in để tìm rồi chọn / Enter..."
        />
      </Field>
      {/* TỔ IN (mig 084) — `ma_to` được GỬI THẲNG lên ERP qua `@pToin`. Ô chọn thuần danh mục, KHÔNG
          bật `chapNhanTuDo` như ô Chuyền trưởng: gõ tự do sẽ ra mã tổ ERP không có, gửi lên là hỏng
          đối soát. Muốn thêm tổ thì vào Hệ thống > Danh mục tổ in. */}
      {coToIn && (
        <Field label="Tổ in" hint="Gửi lên ERP theo mã tổ — thêm tổ mới ở Hệ thống › Danh mục tổ in">
          <SearchableSelect
            moNgay
            value={form.toInId}
            onChange={(v) => set('toInId', v)}
            options={toIns}
            getValue={(t) => t.id}
            getLabel={(t) => `${t.ma_to} — ${t.ten_to}`}
            getSearch={(t) => `${t.ma_to} ${t.ten_to}`}
            placeholder="Chọn tổ in..."
          />
        </Field>
      )}
      <div className="flex gap-2">
        {daLuu && <Button chiXemOk variant="ghost" className="flex-1" onClick={() => setSua(false)} disabled={busy}>Hủy</Button>}
        <Button className="flex-1" icon="check" loading={busy}
          onClick={async () => {
            const ok = await onSave({
              caTruongId: form.caTruongId || null,
              chuyenTruong: form.chuyenTruong,
              thoIn: form.thoIn,
              // ⚠ Chỉ gửi khóa này khi ô THẬT SỰ hiện: backend chỉ ghi `to_in_id` khi `toInId !==
              //   undefined`, nên chưa chạy mig 084 thì không đụng gì tới cột.
              ...(coToIn ? { toInId: form.toInId || null } : {}),
            });
            if (ok) setSua(false);
          }}>
          Lưu phân công
        </Button>
      </div>
    </div>
  );
}

// ─── Modal IN TEM cho lệnh GOM SET ────────────────────────────────────────────
// ⚠⚠ IN TỪNG DÒNG, KHÔNG in gộp 1 lượt (đổi 2026-08-06). Bản cũ có 1 nút "In tem (N phần in)" ở
// footer: BE tạo đủ N tem nhưng FE mở N cửa sổ in liên tiếp ⇒ trình duyệt CHẶN POPUP từ cửa sổ thứ 2
// trở đi (chỉ lần mở đầu còn giữ được ngữ cảnh user-gesture) ⇒ người dùng chỉ nhận được nhãn của
// PHẦN IN ĐẦU TIÊN, các tem sau vẫn tạo trong DB nhưng KHÔNG in ra. Nay mỗi dòng 1 nút "In tem":
// mỗi lần bấm = 1 user-gesture = 1 cửa sổ in ⇒ không bị chặn, và in tới đâu biết tới đó.
// Modal KHÔNG đóng sau khi in để bấm tiếp dòng khác; dòng đã in trong phiên này hiện dấu ✓.
function PrintSetModal({ open, onClose, rows, onPrintRow, busy, meta, setMeta, goiY }) {
  const [form, setForm] = useState({}); // dotVaiId → { sl, huy, thieu, gc }
  const [daIn, setDaIn] = useState(() => new Set()); // dotVaiId đã in trong phiên mở modal này
  useEffect(() => { if (open) { setForm({}); setDaIn(new Set()); } }, [open]);
  const setCell = (id, key, v) => setForm((f) => ({ ...f, [id]: { ...(f[id] || {}), [key]: v } }));
  const num = (id, key) => Number((form[id] || {})[key]) || 0;

  const capOf = (r) => Math.floor((Number(r.sl_vao_sx) || 0) * 1.1);
  // Số tem của dòng (07/10/2026) — trống/sai ⇒ 1. Trần 110% tính trên TỔNG SL × số tem (gương backend).
  const soTemDong = (id) => soTemHopLe((form[id] || {}).so_tem || 1);
  const overRow = (r) => {
    const cap = capOf(r);
    return cap > 0 && num(r.dot_vai_ve_id, 'sl') * soTemDong(r.dot_vai_ve_id) > cap;
  };

  // In 1 dòng: `printTemBatch` (giữ guard 110% từng đợt + tổng lệnh) — N tem cùng SL ⇒ 1 cửa sổ in N tờ.
  const inDong = async (r) => {
    const id = r.dot_vai_ve_id;
    const f = form[id] || {};
    const ok = await onPrintRow({
      dotVaiId: id,
      soLuong: num(id, 'sl'),
      soLuongHuy: num(id, 'huy'),
      soLuongThieu: num(id, 'thieu'),
      gcMauVai: (f.gc || '').trim() || null,
    }, soTemDong(id));
    if (ok) {
      setDaIn((s) => new Set(s).add(id));
      // Xóa SL đã in để không bấm nhầm lần 2; giữ lại GC màu vải cho dễ đối chiếu.
      setForm((s) => ({ ...s, [id]: { ...(s[id] || {}), sl: '', huy: '', thieu: '', so_tem: '' } }));
    }
  };

  // BTP TRƯỚC = bán thành phẩm chuyển tiếp trong xưởng, KHÔNG dán tem ra ngoài ⇒ chỉ LƯU dữ liệu
  // (vẫn tạo tem + vào xe phơi như thường), không mở cửa sổ in. Nút đổi nhãn cho khỏi hiểu nhầm.
  const chiLuu = !!meta.btpTruoc;

  return (
    <Modal open={open} onClose={onClose} title={`${chiLuu ? 'Lưu' : 'In tem'} — đợt sản xuất gom set`} size="xl"
      footer={<Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>}
    >
      {/* Ngày ca / giờ SX / BTP áp cho MỌI tem in ở modal này. GC màu vải nhập RIÊNG từng dòng ⇒ ẩn ô chung. */}
      <div className="mb-3"><TemMetaFields meta={meta} setMeta={setMeta} goiY={goiY} anGcMauVai /></div>
      {chiLuu && (
        <p className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Đang bật <b>BTP trước</b> — dữ liệu vẫn lưu vào hệ thống như bình thường (tạo tem, vào xe phơi),
          nhưng <b>KHÔNG mở cửa sổ in nhãn</b>. Bỏ tick nếu cần in tem ra ngoài.
        </p>
      )}
      <p className="mb-3 text-xs text-ink-soft">
        Nhập <b>SL in</b> + <b>GC màu vải</b> của từng phần in rồi bấm <b>{chiLuu ? 'Lưu' : 'In tem'}</b> ở ĐÚNG dòng đó —
        <b> Số tem</b> &gt; 1 thì in nhiều tem cùng SL trong 1 lần bấm. Trần mỗi phần in = <b>110% SL vào SX</b>
        (tính trên tổng). <b>SL vải hủy/thiếu</b> &gt; 0 sẽ ghi vào sổ vải của đợt đó.
      </p>
      <div className="overflow-auto rounded-card border border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              {INFO_HEADERS.map((h) => <th key={h} className={TH}>{h}</th>)}
              <th className={`${TH} text-right`}>SL vào SX</th>
              <th className={`${TH} text-right`}>SL vải hủy</th>
              <th className={`${TH} text-right`}>SL vải thiếu</th>
              <th className={TH}>GC màu vải</th>
              <th className={`${TH} text-right`}>Số lượng in</th>
              <th className={`${TH} text-right`}>Số tem</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => {
              const id = r.dot_vai_ve_id;
              const f = form[id] || {};
              const coGhiVai = num(id, 'huy') > 0 || num(id, 'thieu') > 0;
              return (
                <tr key={id} className={daIn.has(id) ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}>
                  <PhanInInfoCells r={r} stt={i + 1} />
                  <td className={`${TD} text-right tabular-nums text-ink-soft`}>{fmtNum(r.sl_vao_sx)}</td>
                  <td className={`${TD} text-right`}>
                    <input type="number" min="0" value={f.huy || ''} placeholder="0" className={numCls}
                      onChange={(e) => setCell(id, 'huy', e.target.value)} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <input type="number" min="0" value={f.thieu || ''} placeholder="0" className={numCls}
                      onChange={(e) => setCell(id, 'thieu', e.target.value)} />
                  </td>
                  <td className={TD}>
                    <input value={f.gc || ''} placeholder="GC màu vải"
                      onChange={(e) => setCell(id, 'gc', e.target.value)}
                      className="w-40 rounded-control border border-line bg-surface px-2 py-1.5 text-base md:text-sm text-ink outline-none focus:border-primary" />
                  </td>
                  <td className={`${TD} text-right`}>
                    <input type="number" min="0" max={capOf(r) || undefined} value={f.sl || ''}
                      onChange={(e) => setCell(id, 'sl', e.target.value)}
                      placeholder="0"
                      className={`${numCls} ${overRow(r) ? 'border-danger focus:border-danger' : ''}`} />
                    {overRow(r) && <div className="mt-0.5 text-[11px] text-danger">Tối đa {fmtNum(capOf(r))} (tổng)</div>}
                  </td>
                  <td className={`${TD} text-right`}>
                    <input type="number" min="1" max={TOI_DA_SO_TEM} value={f.so_tem || ''} placeholder="1"
                      onChange={(e) => setCell(id, 'so_tem', e.target.value)} className={numCls} />
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <div className="flex items-center gap-2">
                      <Button className="px-2.5 py-1 text-xs" icon={chiLuu ? 'save' : 'printer'} loading={busy}
                        disabled={busy || overRow(r) || (num(id, 'sl') <= 0 && !coGhiVai)}
                        onClick={() => inDong(r)}>
                        {num(id, 'sl') <= 0 && coGhiVai ? 'Ghi vải'
                          : (chiLuu ? 'Lưu' : (soTemDong(id) > 1 ? `In ${soTemDong(id)} tem` : 'In tem'))}
                      </Button>
                      {daIn.has(id) && (
                        <span className="text-xs font-medium text-success">{chiLuu ? '✓ đã lưu' : '✓ đã in'}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// `truocXacNhan()` (26/09/2026) — Promise<bool>: trang hỏi LÝ DO NGHẼN khi "Chạy hoàn tất" một lệnh
// đang quá SLA (mig 106). Không truyền ⇒ như cũ.
// Tem còn HỦY được ở "Tem đã in": chưa qua kiểm (gương guard backend `production.service.cancelPrintTem`).
const TEM_CHUA_KIEM = ['IN', 'DANG_PHOI', 'DA_KHO'];
const temHuyDuoc = (t) => TEM_CHUA_KIEM.includes(t.trang_thai) && !t.da_kiem;

export default function RunPanel({ lenhId, onClose, onChanged, truocXacNhan }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRun = can('PROD_RUN');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [soLuong, setSoLuong] = useState('');
  const [soTem, setSoTem] = useState('1'); // in N tem cùng SL 1 lần (07/10/2026)
  const [stopReason, setStopReason] = useState('');   // ghi chú thêm (tùy chọn)
  const [stopLyDoId, setStopLyDoId] = useState('');   // lý do chọn từ danh mục (mig 076)
  const [lyDoNgungDs, setLyDoNgungDs] = useState([]);
  // Giờ ngừng / hoạt động lại NHẬP TAY ('HH:MM', bỏ trống = giờ hệ thống). Luồng vẫn 2 bước như cũ.
  const [stopGioBd, setStopGioBd] = useState('');
  const [stopGioKt, setStopGioKt] = useState('');   // giờ kết thúc khi bấm "Chuyền hoạt động lại"
  const [stopKtLucTao, setStopKtLucTao] = useState(''); // giờ kết thúc nhập NGAY lúc tạo (ghi bù sự cố đã xong)
  const [reprint, setReprint] = useState(null); // tem đang in lại
  const [reprintReason, setReprintReason] = useState('');
  const [logsOpen, setLogsOpen] = useState(false);
  const [temLogs, setTemLogs] = useState([]);
  // ⚠⚠ VẢI HỦY và VẢI THIẾU giữ Ô NHẬP RIÊNG, KHÔNG dùng chung 1 form + toggle `loai` như trước:
  //   bản cũ đổi toggle chỉ đổi `loai` nên SỐ LƯỢNG + LÝ DO vừa gõ cho vải hủy **đi theo luôn** sang
  //   vải thiếu ⇒ bấm Ghi là ghi nhầm loại (lỗi thật 2026-08-11). Nay 2 khối tách hẳn, hiện cùng lúc,
  //   không còn toggle nên không có đường nào lẫn nữa. `vhDot` (đợt vải) CỐ Ý dùng chung — nó là ngữ
  //   cảnh "đang ghi cho đợt vải nào", hiện 1 lần ở trên và nhìn thấy rõ.
  const [vhDot, setVhDot] = useState('');
  const [vhHuy, setVhHuy] = useState({ soLuong: '', lyDo: '' });
  const [vhThieu, setVhThieu] = useState({ soLuong: '', lyDo: '' });
  const [pauseOpen, setPauseOpen] = useState(false);   // modal ngừng lệnh chạy (in hàng gấp)
  const [swapList, setSwapList] = useState([]);        // phần in đang chờ sản xuất để hoán đổi
  const [swapLoading, setSwapLoading] = useState(false);
  const [vuot, setVuot] = useState('');                // SL vượt sản xuất
  const [temMeta, setTemMeta] = useState(META_MAC_DINH()); // ngày ca · giờ SX · BTP của lượt in (mig 066)
  const [printSetOpen, setPrintSetOpen] = useState(false); // modal in tem gom set
  const [users, setUsers] = useState([]);              // tài khoản để chọn ca trưởng
  const [toInDs, setToInDs] = useState([]);            // danh mục tổ in (mig 084) cho khối Phân công
  const [doiOpen, setDoiOpen] = useState(false);       // modal đổi chuyền (máy hỏng / dồn tải)
  const [doiChuyenId, setDoiChuyenId] = useState('');
  const [doiGhiChu, setDoiGhiChu] = useState('');
  const [chuyenList, setChuyenList] = useState([]);
  const [traVeOpen, setTraVeOpen] = useState(false);   // modal "Trả về Kỹ thuật" (lý do bắt buộc)
  const [traVeKhOpen, setTraVeKhOpen] = useState(false); // modal "Trả về Kế hoạch" (22/10/2026)
  const [traVeReason, setTraVeReason] = useState('');

  const phieu = data?.phieu;
  const running = phieu?.trang_thai === 'DANG_CHAY';
  const ngungActive = data?.ngung_active || null;
  const ngungList = data?.ngung_list || [];
  const dotVaiList = data?.dot_vai || [];
  // Đợt vải loại BỔ SUNG (ERP `loaikd = 5I`) — nhận diện bằng MÃ danh mục, không so tên hiển thị.
  const dotVaiBoSung = dotVaiList.filter((d) => d.ma_loai_dot_vai === 'BO_SUNG');
  const vaiHuyList = data?.vai_huy || [];
  const goiYTem = data?.goi_y_tem || null;
  // GOM SET = lệnh có NHIỀU PHẦN IN in chung 1 chuyền ⇒ in tem & ghi vải hủy/thiếu làm theo BẢNG
  // (modal In tem), nên ẩn 2 khối nhập lẻ "Vải hủy/Vải thiếu" ở sidebar.
  const coGomSet = !!data?.co_gom_set;
  // Chưa LƯU phân công có thợ in ⇒ khóa In tem 15|16 (18/10/2026, gương BE `kiemThoInPhanCong` — thợ in kế hoạch
  // chỉ điền sẵn ô, không tính). 19/10/2026: sang ca mới mà chuyền chưa phân công (`can_phan_cong_lai`) cũng khóa.
  const chuaThoIn = !!data && chuaPhanCongThoIn(data.phan_cong, toInDs.length > 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRun(lenhId);
      setData(res.data);
      // Điền lại Ngày ca + Ngày chứng từ ĐÃ NHẬP ĐẦU CA (chưa ai nhập ⇒ để trống) + giờ SX (từ mốc kết thúc
      // lượt in trước → bây giờ). ⚠ Chỉ điền ô nào người dùng CHƯA gõ (`apGoiYTem`).
      setTemMeta((m) => apGoiYTem(m, res.data?.goi_y_tem));
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [lenhId, show]);

  useEffect(() => { load(); }, [load]);
  useTaiNgamKhiLenhDoi([lenhId], async () => {
    const res = await getRun(lenhId);
    setData(res.data);
    setTemMeta((m) => apGoiYTem(m, res.data?.goi_y_tem));
  });

  // NÚT "HỦY" Ở TỪNG TEM ĐÃ IN (14/10/2026): nhập lý do ⇒ backend hủy tem (gỡ khỏi xe phơi, trả SL cho lệnh)
  // rồi báo ERP hủy phiếu in tem theo IDMES của lượt in đó. Chỉ tem CHƯA kiểm mới hủy được (`temHuyDuoc`).
  const huyTem = useHuyLichSu({
    goiHuy: (t, ly) => huyTemTaiLichSu(t.id, ly),
    show,
    coQuyen: canRun,
    tieuDe: 'Hủy tem đã in',
    moTa: (t) => <>Tem <b>{t.ma_tem}</b> · {fmtNum(t.so_luong)} pcs</>,
    hauQua: 'Tem bị hủy và gỡ khỏi xe phơi; số lượng trả lại cho lệnh để in lại.',
    nhanNut: 'Hủy tem',
    baoXong: (t) => `Đã hủy tem ${t.ma_tem}`,
    sauKhiHuy: () => { load(); onChanged?.(); },
  });
  // NÚT "MỞ LẠI" Ở TEM ĐÃ HỦY (14/10/2026): chỉ tem hủy bằng nút Hủy / "Hủy lệnh in tem" (`mo_lai_duoc` do backend tính —
  // cùng điều kiện với guard). Mở lại ⇒ tem về trạng thái trước khi hủy, SL tính lại vào đã in, ERP được gửi lại phiếu.
  const moLaiTem = useHuyLichSu({
    goiHuy: (t, ly) => moLaiTemTaiLichSu(t.id, ly),
    show,
    coQuyen: canRun,
    tieuDe: 'Mở lại tem đã hủy',
    moTa: (t) => <>Tem <b>{t.ma_tem}</b> · {fmtNum(t.so_luong)} pcs</>,
    hauQua: 'Tem về lại trạng thái trước khi hủy (chờ khô / chờ kiểm); số lượng tính lại vào "đã in" của lệnh (không vượt 110% SL release).',
    nhanNut: 'Mở lại tem',
    baoXong: (t) => `Đã mở lại tem ${t.ma_tem}`,
    sauKhiHuy: () => { load(); onChanged?.(); },
    modalProps: {
      nhanLyDo: 'Lý do mở lại', kieuNut: 'primary', goiY: 'Vì sao mở lại (vd: hủy nhầm tem)...',
      ghiChuErp: 'Mở xong hệ thống tự gửi lại phiếu in tem sang ERP (cùng IDMES của lượt in).',
    },
  });
  // "Đến giờ" chưa bị người dùng sửa ⇒ nhích theo đồng hồ (xem `metaGuiDi`).
  useEffect(() => {
    const t = setInterval(() => setTemMeta((m) => (m._suaGioKt || m.gioKt === gioHienTai() ? m : metaGuiDi(m))), 20000);
    return () => clearInterval(t);
  }, []);
  // Tài khoản cho ô "Ca trưởng" (dùng /users/options — chỉ cần đăng nhập, không đòi USER_VIEW).
  useEffect(() => {
    listUserOptions({ limit: 500 })
      .then((r) => setUsers(r.data || []))
      .catch(() => { /* không chặn màn sản xuất; ô ca trưởng sẽ rỗng */ });
  }, []);
  // Danh mục lý do ngừng chuyền (mig 076). Lỗi/chưa chạy migration → mảng rỗng → ô chọn ẩn đi,
  // người đứng máy vẫn gõ tay lý do được như trước.
  // ⚠ KHÔNG còn nạp danh mục "lý do bổ sung" — khối Số lượng bổ sung đã bỏ ô chọn lý do (mig 079).
  useEffect(() => {
    listLyDoNgung()
      .then((r) => setLyDoNgungDs(r.data || []))
      .catch(() => setLyDoNgungDs([]));
  }, []);

  // Danh mục TỔ IN (mig 084) — ô chọn ở khối Phân công. Chưa chạy migration / lỗi → mảng rỗng ⇒
  // ô Tổ in tự ẩn, phân công vẫn lưu được như cũ (ERP nhận `Toin` rỗng, đúng bằng hiện trạng cũ).
  useEffect(() => {
    listToIn()
      .then((r) => setToInDs(r.data || []))
      .catch(() => setToInDs([]));
  }, []);

  // Lấy dữ liệu nhãn của 1..N tem rồi in hết trong 1 cửa sổ (`w` = cửa sổ mở sẵn trong cú bấm).
  // `dot_vai_id` (gom set) → nhãn lấy đúng khách/đơn/mã hàng/màu/kích của phần in đó.
  // Không ném lỗi: tem đã tạo xong rồi, lỗi in chỉ báo (in lại ở "Tem đã in").
  const printLabelsFor = async (tems, w) => {
    const ds = (tems || []).filter((t) => t && t.tem_id);
    if (!ds.length) { dongCuaSoIn(w); return; }
    try {
      const labels = await Promise.all(ds.map(async (t) => (await getTemLabel(t.tem_id, t.dot_vai_id || null)).data));
      if (labels.length === 1) await printTemLabel(labels[0], w);
      else await printTemLabelNhieu(labels, w);
    } catch (e) {
      dongCuaSoIn(w);
      show(`CHƯA in được nhãn tem: ${e.message || ''} — in lại ở "Tem đã in"`, 'error');
    }
  };
  // In (lại) nhãn của 1 tem đã có — nút máy in ở "Tem đã in" + In lại.
  const printLabelFor = (temId, dotVaiId = null) => printLabelsFor([{ tem_id: temId, dot_vai_id: dotVaiId }], null);

  // BTP TRƯỚC = bán thành phẩm chuyển tiếp trong xưởng ⇒ KHÔNG dán tem ra ngoài: vẫn lưu dữ liệu
  // (tạo tem + vào xe phơi + ghi ngày ca/giờ SX) như bình thường, chỉ BỎ bước mở cửa sổ in nhãn.
  const chiLuu = !!temMeta.btpTruoc;

  // ⚠ Mở SẴN cửa sổ in ngay trong cú bấm (trước mọi await) — xin N mã tem ERP xong mới mở là bị chặn popup.
  const moCuaSo = () => {
    if (chiLuu) return null;
    try { return moSanCuaSoIn(); } catch (e) { show(e.message, 'error'); return undefined; }
  };

  // Thiếu Ngày ca / Ngày chứng từ ⇒ báo và KHÔNG in (kiểm trước khi mở cửa sổ in).
  const thieuDauCa = () => {
    const loi = chuaThoIn ? CHUA_THO_IN : thieuNgayCaCt(temMeta);
    if (loi) show(loi, 'error');
    return !!loi;
  };
  // BE báo đã sang ca mới (sidebar mở từ ca trước) ⇒ bỏ giá trị ca cũ, tải lại gợi ý của ca này.
  const neuHetCa = (e) => {
    if (e?.errorCode !== 'HET_CA') return;
    setTemMeta((m) => ({ ...m, ngayCa: '', ngayCt: homNay(), _ctTuDong: true, _khoaCa: '' }));
    load();
  };

  const doPrint = async () => {
    if (thieuDauCa()) return;
    const n = soTemHopLe(soTem);
    const w = moCuaSo();
    if (w === undefined) return; // popup bị chặn — chưa tạo tem nào
    setBusy(true);
    try {
      let tems;
      if (n === 1) {
        const res = await printTem(phieu.id, Number(soLuong), metaGuiDi(temMeta));
        tems = [{ tem_id: res.data?.new_tem_id }];
      } else {
        // N tem cùng SL — `printTemBatch` giữ trần 110% (tổng) và tạo N tem trong 1 transaction.
        const res = await printTemBatch(phieu.id,
          Array.from({ length: n }, () => ({ soLuong: Number(soLuong) })), metaGuiDi(temMeta));
        tems = res.data?.tems_in || [];
      }
      const tong = Number(soLuong) * n;
      // Số vải hủy / thiếu đang chờ (21/10/2026) đã được BE gắn vào tem đầu của lượt này.
      const vc = data?.vai_cho_tem;
      const kemVai = vc ? ` · kèm ${[vc.huy > 0 && `hủy ${fmtNum(vc.huy)}`, vc.thieu > 0 && `thiếu ${fmtNum(vc.thieu)}`].filter(Boolean).join(', ')}` : '';
      show(chiLuu
        ? `Đã lưu ${n > 1 ? `${n} tem × ` : ''}${fmtNum(soLuong)}${n > 1 ? ` = ${fmtNum(tong)}` : ''} (BTP trước — không in tem)${kemVai} — tự đưa vào xe phơi, đang đếm ngược`
        : `Đã in ${n > 1 ? `${n} tem × ${fmtNum(soLuong)} = ${fmtNum(tong)}` : `tem ${fmtNum(soLuong)}`}${kemVai} — tự đưa vào xe phơi, đang đếm ngược`);
      setSoLuong('');
      setSoTem('1');
      if (!chiLuu) await printLabelsFor(tems, w);
      // Xóa meta rồi tải lại ⇒ lượt in KẾ TIẾP lấy gợi ý mới (giờ BĐ = mốc kết thúc của lượt vừa in).
      setTemMeta(META_MAC_DINH());
      await load();
      onChanged?.();
    } catch (e) {
      dongCuaSoIn(w);
      show(e.message || 'In tem thất bại', 'error');
      neuHetCa(e);
    } finally {
      setBusy(false);
    }
  };

  // GOM SET: in tem cho ĐÚNG 1 phần in — `soTemDong` tem cùng SL (07/10/2026), 1 cửa sổ in.
  // Trả true/false để modal biết có đánh dấu "đã in" cho dòng đó không. KHÔNG đóng modal, KHÔNG reset
  // `temMeta` (ngày ca/giờ áp chung cho cả lượt đứng máy — còn in tiếp các dòng khác).
  // ⚠ Vải hủy/thiếu chỉ gắn vào DÒNG ĐẦU — backend ghi sổ vải theo từng dòng, lặp N dòng là ghi N lần.
  const doPrintRow = async (item, soTemDong = 1) => {
    if (thieuDauCa()) return false;
    const n = item.soLuong > 0 ? soTemHopLe(soTemDong) : 1;
    const w = item.soLuong > 0 ? moCuaSo() : null;
    if (w === undefined) return false;
    setBusy(true);
    try {
      const items = [item, ...Array.from({ length: n - 1 }, () => ({
        dotVaiId: item.dotVaiId, soLuong: item.soLuong, gcMauVai: item.gcMauVai,
      }))];
      const res = await printTemBatch(phieu.id, items, metaGuiDi(temMeta));
      const tems = res.data?.tems_in || [];
      if (tems.length) {
        const t = tems[0];
        show(chiLuu
          ? `Đã lưu ${tems.length > 1 ? `${tems.length} tem` : `tem ${t.ma_tem}`} (${fmtNum(t.so_luong)}${tems.length > 1 ? '/tem' : ''}) — BTP trước, không in nhãn`
          : `Đã in ${tems.length > 1 ? `${tems.length} tem` : `tem ${t.ma_tem}`} (${fmtNum(t.so_luong)}${tems.length > 1 ? '/tem' : ''}) — tự vào xe phơi, đang đếm ngược`);
        if (!chiLuu) await printLabelsFor(tems, w);
        else dongCuaSoIn(w);
      } else {
        dongCuaSoIn(w);
        show('Đã ghi sổ vải hủy/thiếu cho phần in này');
      }
      await load();
      onChanged?.();
      return true;
    } catch (e) {
      dongCuaSoIn(w);
      show(e.message || 'In tem thất bại', 'error');
      neuHetCa(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  // ĐỔI CHUYỀN lượt chạy: máy hỏng / dồn tải sang chuyền khác. Đổi cả phiếu lẫn lệnh ở BE,
  // tem đã in GIỮ NGUYÊN (thuộc về lượt in đó, không in lại).
  const moDoiChuyen = () => {
    setDoiChuyenId(data?.lenh?.chuyen_id || '');
    setDoiGhiChu('');
    setDoiOpen(true);
    if (!chuyenList.length) listChuyen().then((r) => setChuyenList(r.data || [])).catch(() => {});
  };
  const doDoiChuyen = async () => {
    setBusy(true);
    try {
      const res = await doiChuyen(phieu.id, { chuyenId: doiChuyenId, ghiChu: doiGhiChu });
      const d = res.data || {};
      show(`Đã đổi chuyền${d.chuyen_cu ? ` từ ${d.chuyen_cu}` : ''} → ${d.chuyen_moi}`);
      setDoiOpen(false);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Đổi chuyền thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  // TRẢ VỀ KỸ THUẬT: đang chạy mới phát hiện khuôn/film/mực sai ⇒ HỦY LỆNH (kèm tem đã in) và đưa
  // phần in quay lại READY. Cùng ý nghĩa với nút "Trả về Kỹ thuật" ở Release 1 — lý do BẮT BUỘC,
  // nhập trong Modal (không dùng window.prompt) và hiện lại ở màn Chuẩn bị kỹ thuật.
  // ⚠ Backend chặn khi tem đã qua KCS/Sửa/OQC/giao (409 `TEM_DA_XU_LY`) — sổ cái số lượng đã chạy tiếp.
  const doTraVeKyThuat = async () => {
    const lyDo = traVeReason.trim();
    if (!lyDo) { show('Nhập lý do trả về Kỹ thuật', 'error'); return; }
    setBusy(true);
    try {
      const res = await traVeKyThuatSanXuat(lenhId, lyDo);
      const d = res.data || {};
      show(`Đã trả về Kỹ thuật — ${fmtNum(d.phan_in || 1)} phần in quay lại READY`
        + (d.so_tem_huy ? ` · hủy ${fmtNum(d.so_tem_huy)} tem đã in` : ''));
      setTraVeOpen(false); setTraVeReason('');
      onChanged?.();
      onClose?.();                       // lệnh đã hủy → không còn gì để xem trong panel
    } catch (e) {
      show(e.message || 'Trả về Kỹ thuật thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doSavePhanCong = async (body) => {
    setBusy(true);
    try {
      await savePhanCong(phieu.id, body);
      show('Đã lưu phân công sản xuất');
      await load();
      onChanged?.();
      return true; // lưu OK → khối phân công thoát chế độ sửa
    } catch (e) {
      show(e.message || 'Lưu phân công thất bại', 'error');
      return false; // lỗi → GIỮ ô nhập để người dùng sửa tiếp, không mất thứ đang gõ
    } finally {
      setBusy(false);
    }
  };

  const doFinish = async () => {
    if (truocXacNhan && !(await truocXacNhan())) return; // quá SLA ⇒ lý do nghẽn (mig 106)
    setBusy(true);
    try {
      await finishRun(phieu.id);
      show('Đã hoàn tất chạy');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doStop = async () => {
    // Có danh mục thì BẮT BUỘC chọn lý do; chưa chạy mig 076 (danh sách rỗng) thì lùi về gõ tay.
    if (!stopLyDoId && !stopReason.trim()) {
      show(lyDoNgungDs.length ? 'Chọn lý do ngừng chuyền' : 'Nhập lý do ngừng chuyền', 'error');
      return;
    }
    setBusy(true);
    try {
      // `stopKtLucTao` = giờ kết thúc nhập NGAY lúc tạo (sự cố đã xong mới ngồi ghi lại) ⇒ bản ghi
      // vào thẳng "đã hoạt động lại". Bỏ trống thì y như cũ, phải bấm "Chuyền hoạt động lại" sau.
      await stopLine(phieu.id, stopReason.trim(), stopGioBd || null, stopLyDoId || null, stopKtLucTao || null);
      show(stopKtLucTao ? `Đã ghi ngừng chuyền ${stopGioBd || 'bây giờ'} → ${stopKtLucTao}` : 'Đã ngừng chuyền');
      setStopReason(''); setStopGioBd(''); setStopLyDoId(''); setStopKtLucTao('');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally { setBusy(false); }
  };

  const openLogs = async () => {
    setLogsOpen(true);
    try { const res = await getTemLogs(phieu.id); setTemLogs(res.data); }
    catch (e) { show(e.message || 'Lỗi tải lịch sử', 'error'); }
  };

  // Ngừng lệnh chạy để in hàng gấp: mở modal + nạp danh sách phần in đang chờ sản xuất (để hoán đổi).
  const openPause = async () => {
    setPauseOpen(true);
    setSwapLoading(true);
    try {
      const res = await listProductionCandidates({ limit: 50 });
      setSwapList((res.data.items || []).filter((r) => r.id !== lenhId)); // trừ chính lệnh đang mở
    } catch (e) {
      show(e.message || 'Lỗi tải danh sách chờ sản xuất', 'error');
    } finally { setSwapLoading(false); }
  };

  // Chỉ ngừng lệnh chạy (không hoán đổi) → lệnh về chờ chạy.
  const doPauseOnly = async () => {
    setBusy(true);
    try {
      await pauseLenhChay(phieu.id);
      show('Đã ngừng lệnh chạy — lệnh về chờ chạy để lập lại kế hoạch (giữ nguyên số lượng đã in)');
      setPauseOpen(false);
      onChanged?.();
      onClose?.();
    } catch (e) {
      show(e.message || 'Ngừng lệnh chạy thất bại', 'error');
    } finally { setBusy(false); }
  };

  // Hoán đổi: ngừng lệnh hiện tại rồi bắt đầu chạy phần in gấp hơn TRÊN CÙNG CHUYỀN.
  const doSwap = async (cand) => {
    setBusy(true);
    try {
      await pauseLenhChay(phieu.id);
      await startProduction(cand.id, data?.lenh?.chuyen_id || null);
      show(`Đã ngừng ${data?.lenh?.ma_lenh_san_xuat || ''} & chạy ${cand.ma_lenh_san_xuat} thay thế`);
      setPauseOpen(false);
      onChanged?.();
      onClose?.();
    } catch (e) {
      show(e.message || 'Hoán đổi thất bại', 'error');
    } finally { setBusy(false); }
  };

  // Ghi vải hủy (= vải hư) / vải THIẾU theo phần in. Lệnh chỉ 1 phần in → tự chọn; nhiều phần in → phải chọn.
  // Ghi SL bổ sung (do công ty / do khách hàng) cho 1 đợt vải.
  // Trả true/false để khối inline biết có thoát chế độ sửa không.
  const doSaveLyDoBoSung = async (dotVaiId, form) => {
    try {
      await luuLyDoBoSungDotVai(dotVaiId, form);
      show('Đã lưu số lượng bổ sung');
      await load();
      return true;
    } catch (e) {
      show(e.message || 'Lưu số lượng bổ sung thất bại', 'error');
      return false;
    }
  };

  // `loai` truyền TƯỜNG MINH từ nút bấm của đúng khối — không suy từ state dùng chung nữa.
  const doVaiHuy = async (loai) => {
    const thieu = loai === 'THIEU';
    const nhan = thieu ? 'vải thiếu' : 'vải hủy';
    const form = thieu ? vhThieu : vhHuy;
    const qty = Number(form.soLuong);
    if (!qty || qty <= 0) { show(`Nhập số lượng ${nhan}`, 'error'); return; }
    if (dotVaiList.length > 1 && !vhDot) { show(`Chọn đợt vải cần ghi ${nhan}`, 'error'); return; }
    setBusy(true);
    try {
      await addVaiHuy(phieu.id, {
        dotVaiId: vhDot || (dotVaiList.length === 1 ? dotVaiList[0].dot_vai_ve_id : null),
        soLuong: qty,
        lyDo: form.lyDo.trim() || null,
        loai,
      });
      show(`Đã lưu ${nhan} ${fmtNum(qty)} — sẽ gắn vào tem in kế tiếp`);
      // Chỉ xóa Ô CỦA CHÍNH LOẠI VỪA GHI — khối kia đang gõ dở thì giữ nguyên.
      (thieu ? setVhThieu : setVhHuy)({ soLuong: '', lyDo: '' });
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || `Ghi ${nhan} thất bại`, 'error');
    } finally { setBusy(false); }
  };

  // Xóa số chờ gắn tem (21/10/2026) — lưu 0 cho cả 2 loại.
  const xoaVaiCho = async () => {
    setBusy(true);
    try {
      for (const loai of ['HUY', 'THIEU']) {
        // eslint-disable-next-line no-await-in-loop
        await addVaiHuy(phieu.id, { dotVaiId: null, soLuong: 0, lyDo: null, loai });
      }
      show('Đã xóa số vải hủy / thiếu đang chờ');
      await load();
    } catch (e) { show(e.message || 'Xóa thất bại', 'error'); } finally { setBusy(false); }
  };

  // Vượt sản xuất: cộng SL vượt vào release + trừ đợt vải chưa release cùng phần in.
  const doVuot = async () => {
    const qty = Number(vuot);
    if (!(qty > 0)) { show('Nhập số lượng vượt', 'error'); return; }
    setBusy(true);
    try {
      const res = await vuotSanXuat(phieu.id, qty);
      const tru = res?.data?.so_luong_da_tru ?? 0;
      show(`Đã vượt ${fmtNum(qty)} → release ${fmtNum(res?.data?.release_sau)}`
        + (tru > 0 ? ` · trừ ${fmtNum(tru)} ở đợt chưa release` : ' · không có đợt chưa release để trừ'),
        tru < qty ? 'warning' : 'success');
      setVuot('');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Ghi nhận vượt sản xuất thất bại', 'error');
    } finally { setBusy(false); }
  };

  const doReprint = async () => {
    if (!reprintReason.trim()) { show('Nhập lý do in lại', 'error'); return; }
    setBusy(true);
    try {
      const res = await reprintTem(reprint.id, reprintReason.trim());
      show(`Đã in lại tem ${reprint.ma_tem} (giữ nguyên mã)`);
      setReprint(null); setReprintReason('');
      await printLabelFor(res.data?.new_tem_id);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'In lại thất bại', 'error');
    } finally { setBusy(false); }
  };

  const doResume = async () => {
    setBusy(true);
    try {
      await resumeLine(phieu.id, stopGioKt || null);
      show('Chuyền hoạt động lại');
      setStopGioKt('');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally { setBusy(false); }
  };

  const target = Number(data?.lenh?.so_luong_release) || 0;
  const printed = Number(data?.printed) || 0;
  const pct = target ? Math.min(100, Math.round((printed / target) * 100)) : 0;
  const maxTotal = target ? Math.floor(target * 1.1) : 0;       // trần 110% SL release
  const minFinish = target ? Math.ceil(target * 0.9) : 0;       // tối thiểu 90% SL release (cho -10%) mới hoàn tất được
  const remain = target ? Math.max(0, maxTotal - printed) : null; // còn được in
  const nTem = soTemHopLe(soTem);
  const overMax = target > 0 && Number(soLuong) * nTem > remain; // trần tính trên TỔNG N tem

  return (
    <SidePanel
      open={!!lenhId}
      onClose={onClose}
      title={data?.lenh ? `Sản xuất — ${data.lenh.ma_lenh_san_xuat}` : 'Sản xuất'}
      subtitle={data?.lenh ? `Chuyền ${data.lenh.ma_chuyen || '—'} · Phần ${data.lenh.phan_list || '—'}` : ''}
      footer={
        running && canRun && (
          <>
            {/* Đổi chuyền đứng ĐỐI DIỆN "Chạy hoàn tất" — footer của SidePanel là `justify-end` nên
                phải `mr-auto` mới đẩy được sang mép TRÁI. Thao tác điều hành (máy hỏng / dồn tải),
                không phải hành động kết thúc ⇒ để nút phụ. */}
            <Button variant="secondary" icon="shuffle" className="mr-auto" onClick={moDoiChuyen} disabled={busy}>
              Đổi chuyền
            </Button>
            {/* Trả về Kỹ thuật đứng GIỮA "Đổi chuyền" và "Chạy hoàn tất": phát hiện khuôn/film/mực sai
                giữa chừng ⇒ hủy lệnh + phần in quay lại READY (giống nút cùng tên ở Release 1). */}
            <Button variant="secondary" icon="chevron-left" disabled={busy}
              onClick={() => { setTraVeReason(''); setTraVeOpen(true); }}>
              Trả về Kỹ thuật
            </Button>
            {/* Trả về Kế hoạch (22/10/2026): đang in dở muốn chuyển phần vải còn lại sang máy khác ⇒ phần còn lại về
                Release 1, lệnh này chạy hoàn tất ở máy hiện tại (xem `TraVeKeHoachModal`). */}
            <Button variant="secondary" icon="undo" disabled={busy} onClick={() => setTraVeKhOpen(true)}>
              Trả về Kế hoạch
            </Button>
            <Button variant="success" icon="check" onClick={doFinish} loading={busy} disabled={printed < minFinish}>
              Chạy hoàn tất
            </Button>
          </>
        )
      }
    >
      {loading || !data ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          <section>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-soft">Đã in</span>
              <span className="font-semibold text-ink">{fmtNum(printed)} / {fmtNum(target)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-soft">
              <span>Phiếu {phieu?.ma_phieu_san_xuat}</span>
              <Badge tone={running ? 'info' : 'success'}>{running ? 'Đang chạy' : 'Hoàn tất'}</Badge>
            </div>
            {running && canRun && printed < minFinish && (
              <p className="mt-2 text-xs text-amber-600">
                Cần in tối thiểu 90% SL release ({fmtNum(minFinish)}) mới hoàn tất được — còn thiếu <b>{fmtNum(minFinish - printed)}</b>.
              </p>
            )}
          </section>

          {running && canRun && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                {chiLuu ? 'Lưu (BTP trước)' : 'In tem'}{coGomSet ? ` (gom set · ${data.so_phan_in} phần in)` : ''}
              </h3>
              {/* Ngày ca · giờ SX · BTP: nhập 1 lần, áp cho mọi tem in ở lượt này (mig 066).
                  Với gom set thì bảng in tem cũng hiện lại khối này để nhập ngay trước khi in. */}
              {chuaThoIn && (
                <p className="mb-2 rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {CHUA_THO_IN} (khối Phân công bên dưới).
                </p>
              )}
              {!coGomSet && <div className="mb-2"><TemMetaFields meta={temMeta} setMeta={setTemMeta} goiY={goiYTem} /></div>}
              {coGomSet ? (
                <Button className="w-full" icon={chiLuu ? 'save' : 'printer'} onClick={() => setPrintSetOpen(true)} disabled={busy || remain === 0 || chuaThoIn}>
                  Nhập số lượng &amp; {chiLuu ? 'lưu' : 'in tem'}…
                </Button>
              ) : (
                <div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-ink-soft">Số lượng in (1 tem)</label>
                      <Input type="number" max={remain || undefined} value={soLuong}
                        onChange={(e) => setSoLuong(e.target.value)} placeholder="vd: 200"
                        className={overMax ? 'border-danger focus:border-danger focus:ring-danger/10' : ''} />
                    </div>
                    {/* SỐ TEM (07/10/2026): in N tem cùng SL 1 lần — N tờ trong 1 cửa sổ in. */}
                    <div className="w-24">
                      <label className="mb-1 block text-xs font-medium text-ink-soft">Số tem</label>
                      <Input type="number" min={1} max={TOI_DA_SO_TEM} value={soTem}
                        onChange={(e) => setSoTem(e.target.value)} />
                    </div>
                    {/* BTP trước → chỉ LƯU (không mở cửa sổ in nhãn), nút đổi hẳn nhãn cho khỏi hiểu nhầm. */}
                    <Button onClick={doPrint} loading={busy} icon={chiLuu ? 'save' : undefined}
                      disabled={!soLuong || Number(soLuong) <= 0 || overMax || remain === 0 || chuaThoIn}>
                      {chiLuu ? 'Lưu' : (nTem > 1 ? `In ${nTem} tem` : 'In tem')}
                    </Button>
                  </div>
                  {nTem > 1 && Number(soLuong) > 0 && (
                    <p className={`mt-1 text-xs ${overMax ? 'text-danger' : 'text-ink-soft'}`}>
                      {nTem} tem × {fmtNum(soLuong)} = <b>{fmtNum(Number(soLuong) * nTem)}</b>
                      {overMax ? ` — vượt phần còn được in (${fmtNum(remain)})` : ''}
                    </p>
                  )}
                </div>
              )}
              {chiLuu && (
                <p className="mt-1.5 text-xs text-amber-600">
                  Đang bật <b>BTP trước</b> — vẫn lưu vào hệ thống (tạo tem, vào xe phơi) nhưng KHÔNG in nhãn ra ngoài.
                </p>
              )}
              {target > 0 && (
                <p className={`mt-1.5 text-xs ${overMax ? 'text-danger' : 'text-ink-soft'}`}>
                  Trần 110%: tối đa {fmtNum(maxTotal)} · còn in được <b>{fmtNum(remain)}</b>
                  {overMax ? ' — vượt giới hạn!' : ''}
                </p>
              )}
            </section>
          )}

          {/* SỐ LƯỢNG BỔ SUNG — CHỈ hiện khi lệnh có đợt vải loại BỔ SUNG (mig 077 + 079). Đặt NGAY
              TRÊN Phân công. Chia SL bổ sung thành phần do CÔNG TY và phần do KHÁCH HÀNG.
              ⚠ Ghi ở mức ĐỢT VẢI (mỗi đợt bổ sung số riêng), không phải mức phiếu — đi theo
                đợt vải qua mọi lệnh sản xuất về sau.
              ⚠ Nhận diện bằng `ma_loai_dot_vai === 'BO_SUNG'` (mã danh mục), KHÔNG so tên hiển thị. */}
          {dotVaiBoSung.length > 0 && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                Số lượng bổ sung <span className="ml-1 font-normal normal-case">({dotVaiBoSung.length} đợt vải)</span>
              </h3>
              <div className="space-y-2">
                {dotVaiBoSung.map((d) => (
                  <LyDoBoSungInline key={d.dot_vai_ve_id} dot={d}
                    canRun={canRun} onSave={doSaveLyDoBoSung} />
                ))}
              </div>
            </section>
          )}

          {/* PHÂN CÔNG (inline — không modal): ca trưởng · chuyền trưởng · danh sách thợ in trên chuyền.
              Chưa lưu → ô nhập + nút Lưu; đã lưu → hiện thẳng tên + nút Sửa. */}
          {phieu && dotVaiList.length > 0 && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Phân công</h3>
              <PhanCongInline pc={data.phan_cong} users={users} toIns={toInDs} onSave={doSavePhanCong} busy={busy} canRun={canRun}
                thoInKh={data.lenh?.tho_in_kh || ''} />
            </section>
          )}

          {/* Vải hủy (= vải hư) / vải thiếu trong sản xuất — ghi theo ĐỢT VẢI (`vai_huy.dot_vai_ve_id`).
              ⚠ 1 phần in có thể có NHIỀU đợt vải trong cùng đợt SX (gộp đợt) ⇒ ô chọn phải hiện mã đợt
              vải, nếu chỉ hiện code phần thì 2 dòng trùng tên, không biết đang ghi cho đợt nào.
              GOM SET → ẨN ô nhập lẻ (nhập trong modal In tem theo bảng); vẫn hiện sổ "Đã ghi". */}
          {/* ⚠⚠ 21/10/2026 (người dùng chốt) — HỦY / THIẾU THEO TEM: "Lưu" giữ 1 GIÁ TRỊ CHỜ (lưu lại = thay, 0 = xóa);
              lượt in tem kế tiếp gắn số đó vào tem (sổ + ERP cùng tem) rồi tự xóa. In nhiều phần in mà bảng in có nhập
              hủy/thiếu ⇒ số ở bảng được ưu tiên, số chờ bị bỏ (BE `production.service addVaiHuy` / `nhanVaiChoTx`). */}
          <section className="border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
              Vải hủy / vải thiếu (gắn vào tem in kế tiếp)
            </h3>
            {phieu && data.vai_cho_tem && (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span>
                  Chờ gắn vào tem in kế tiếp:{' '}
                  {data.vai_cho_tem.huy > 0 && <b>Hủy {fmtNum(data.vai_cho_tem.huy)}</b>}
                  {data.vai_cho_tem.huy > 0 && data.vai_cho_tem.thieu > 0 && ' · '}
                  {data.vai_cho_tem.thieu > 0 && <b>Thiếu {fmtNum(data.vai_cho_tem.thieu)}</b>}
                  {data.vai_cho_tem.nguoi && <span className="text-xs"> · {data.vai_cho_tem.nguoi}</span>}
                </span>
                {canRun && (
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={xoaVaiCho} loading={busy}>Xóa</Button>
                )}
              </div>
            )}
            {canRun && phieu && !coGomSet && (
              <div className="space-y-2">
                {dotVaiList.length > 1 && (
                  <Select value={vhDot} onChange={(e) => setVhDot(e.target.value)}>
                    <option value="">— Chọn đợt vải —</option>
                    {dotVaiList.map((d) => (
                      <option key={d.dot_vai_ve_id} value={d.dot_vai_ve_id}>
                        {d.ma_dot_vai} · {d.ma_phan} · {d.mau_vai} · {d.kich_vai}/{d.kich_phim}
                      </option>
                    ))}
                  </Select>
                )}
                {dotVaiList.length === 1 && (
                  <div className="rounded-control bg-surface-muted px-3 py-1.5 text-xs text-ink-soft">
                    Đợt vải: <b className="text-ink">{dotVaiList[0].ma_dot_vai}</b> · {dotVaiList[0].ma_phan} · {dotVaiList[0].mau_vai}
                  </div>
                )}
                {/* 2 KHỐI TÁCH HẲN — bỏ toggle `loai` cũ (xem ghi chú ở state `vhHuy`/`vhThieu`). */}
                {[
                  {
                    loai: 'HUY', ten: 'Vải hủy (hư)', form: vhHuy, set: setVhHuy,
                    vien: 'border-danger/30', nut: 'danger',
                    goiY: 'Lý do vải hủy (vd: lỗi vải, in hỏng, rách...)',
                  },
                  {
                    loai: 'THIEU', ten: 'Vải thiếu', form: vhThieu, set: setVhThieu,
                    vien: 'border-warning/40', nut: 'secondary',
                    goiY: 'Lý do vải thiếu (vd: giao thiếu, hụt khổ...)',
                  },
                ].map((k) => (
                  <div key={k.loai} className={`space-y-2 rounded-control border ${k.vien} p-2.5`}>
                    <div className="text-sm font-semibold text-ink">{k.ten}</div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-ink-soft">Số lượng</label>
                        <Input type="number" min="1" value={k.form.soLuong}
                          onChange={(e) => k.set({ ...k.form, soLuong: e.target.value })} placeholder="vd: 5" />
                      </div>
                      <Button variant={k.nut} onClick={() => doVaiHuy(k.loai)} loading={busy}
                        disabled={!k.form.soLuong || Number(k.form.soLuong) <= 0}>
                        Lưu
                      </Button>
                    </div>
                    <Textarea rows={2} value={k.form.lyDo}
                      onChange={(e) => k.set({ ...k.form, lyDo: e.target.value })} placeholder={k.goiY} />
                  </div>
                ))}
              </div>
            )}
            {canRun && phieu && coGomSet && (
              <p className="rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30">
                Đợt SX gom set nhiều phần in — nhập <b>SL vải hủy / vải thiếu</b> theo từng đợt vải trong
                bảng ở nút <b>Nhập số lượng &amp; in tem…</b> phía trên (ghi cùng lúc với lúc in tem).
              </p>
            )}
            {vaiHuyList.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-xs font-medium text-ink-soft">Đã ghi ({vaiHuyList.length})</div>
                {vaiHuyList.map((v) => (
                  <div key={v.id} className="rounded-control border border-line px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 font-medium text-ink">
                        {v.ma_dot_vai || '—'}
                        <span className="ml-1 text-xs font-normal text-ink-soft">
                          {[v.ma_phan, v.mau_vai].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={v.loai === 'THIEU' ? 'warning' : 'danger'}>
                          {v.loai === 'THIEU' ? 'Thiếu' : 'Hủy'}
                        </Badge>
                        <Badge tone={v.loai === 'THIEU' ? 'warning' : 'danger'}>{fmtNum(v.so_luong)}</Badge>
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-soft">
                      {v.ma_tem ? <b className="font-mono text-ink">Tem {v.ma_tem} · </b> : ''}
                      {v.nguoi ? `${v.nguoi} · ` : ''}{fmtDt(v.created_date)}{v.ly_do ? ` · ${v.ly_do}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Tem đã in ({data.tems.length})</h3>
              {data.tems.length > 0 && (
                <button onClick={openLogs} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Icon name="history" size={13} /> Lịch sử in
                </button>
              )}
            </div>
            {data.tems.length ? (
              <div className="space-y-1.5">
                {data.tems.map((t) => {
                  const huy = t.trang_thai === 'HUY';
                  return (
                    <div key={t.id}
                      className={`flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-sm ${huy ? 'border-line/60 bg-surface-muted/40 opacity-70' : 'border-line'}`}>
                      <span className={`flex items-center gap-1.5 font-medium ${huy ? 'text-ink-soft line-through' : 'text-ink'}`}>
                        {t.ma_tem}
                      </span>
                      <span className="text-ink-soft">{fmtNum(t.so_luong)}</span>
                      <div className="flex items-center gap-2">
                        <Badge tone={TEM_TONE[t.trang_thai] || 'default'}>{TEM_LABEL[t.trang_thai] || t.trang_thai}</Badge>
                        {canRun && !huy && (
                          <>
                            <button onClick={() => printLabelFor(t.id)} title="In lại tờ tem (giữ mã)"
                              className="text-ink-soft hover:text-primary"><Icon name="printer" size={15} /></button>
                            <button onClick={() => { setReprint(t); setReprintReason(''); }}
                              className="text-xs font-medium text-primary hover:underline">In lại</button>
                            {temHuyDuoc(t) && (
                              <button onClick={() => huyTem.moHuy(t)} title="Hủy tem này (nhập lý do) — báo ERP hủy phiếu in tem"
                                className="text-xs font-medium text-danger hover:underline">Hủy</button>
                            )}
                          </>
                        )}
                        {canRun && huy && t.mo_lai_duoc && (
                          <button onClick={() => moLaiTem.moHuy(t)} title="Mở lại tem đã hủy (nhập lý do) — gửi lại phiếu in tem sang ERP"
                            className="text-xs font-medium text-primary hover:underline">Mở lại</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Chưa in tem nào.</p>
            )}
          </section>

          {/* Ngừng chuyền (downtime) */}
          {running && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Ngừng chuyền</h3>
              {ngungActive ? (
                <div className="rounded-control border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm">
                  <div className="font-semibold text-rose-700">⏸ Chuyền đang ngừng</div>
                  <div className="mt-0.5 text-xs text-ink-soft">Từ {fmtDt(ngungActive.tg_bd_ngung)}</div>
                  {ngungActive.ly_do && <div className="mt-0.5 text-xs text-ink">Lý do: {ngungActive.ly_do}</div>}
                  {canRun && (
                    <div className="mt-2 space-y-2">
                      {/* Giờ KẾT THÚC ngừng — bỏ trống = giờ hệ thống. Số phút ngừng tự tính lại theo 2 mốc. */}
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-ink-soft">Giờ hoạt động lại (bỏ trống = bây giờ)</span>
                        <TimeSelect value={stopGioKt} onChange={setStopGioKt} minuteStep={1} />
                      </label>
                      <Button className="w-full" onClick={doResume} loading={busy}>Chuyền hoạt động lại</Button>
                    </div>
                  )}
                </div>
              ) : canRun ? (
                <div className="space-y-2">
                  {/* Lý do lấy từ DANH MỤC (Sản xuất > Danh mục lý do ngừng chuyền, mig 076).
                      ⚠ Chưa chạy migration → danh sách rỗng → ẩn ô chọn, lùi về gõ tay như trước. */}
                  {lyDoNgungDs.length > 0 && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">Lý do ngừng</span>
                      {/* Ô tìm kiếm giống hệt ô "Ca trưởng" (`SearchableSelect`) — gõ vài chữ là ra,
                          tìm KHÔNG DẤU. Danh mục lý do sẽ dài dần nên đừng đổi về `<Select>` trơn.
                          `moNgay`: BẤM VÀO Ô LÀ BUNG SẴN CẢ DANH SÁCH (người đứng máy thường muốn xem
                          có những lý do gì rồi mới chọn, chứ không nhớ sẵn để gõ). */}
                      <SearchableSelect
                        moNgay
                        value={stopLyDoId}
                        onChange={setStopLyDoId}
                        options={lyDoNgungDs}
                        getValue={(l) => l.id}
                        getLabel={(l) => l.ten_ly_do || ''}
                        getSearch={(l) => `${l.ten_ly_do || ''} ${l.ma_ly_do || ''}`}
                        placeholder="Bấm để xem danh sách, hoặc gõ để tìm..."
                        emptyLabel="— Chọn lý do —"
                      />
                    </label>
                  )}
                  <Textarea rows={2} value={stopReason} onChange={(e) => setStopReason(e.target.value)}
                    placeholder={lyDoNgungDs.length
                      ? 'Ghi chú thêm (tùy chọn)'
                      : 'Lý do ngừng chuyền (vd: hết mực, kẹt vải, đổi khuôn...)'} />
                  {/* Giờ BẮT ĐẦU ngừng — bỏ trống = giờ hệ thống. Nhập giờ lớn hơn bây giờ ⇒ hiểu là HÔM QUA (ca đêm). */}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">Giờ bắt đầu (trống = bây giờ)</span>
                      <TimeSelect value={stopGioBd} onChange={setStopGioBd} minuteStep={1} />
                    </label>
                    {/* GIỜ KẾT THÚC NGAY LÚC TẠO — cho ca sự cố đã xong rồi mới ngồi ghi lại: khỏi phải
                        bấm Ngừng rồi bấm tiếp "Hoạt động lại". Bỏ trống ⇒ chuyền vào trạng thái ĐANG
                        NGỪNG như cũ. Sớm hơn giờ bắt đầu ⇒ backend hiểu là qua đêm (+1 ngày). */}
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">Giờ kết thúc (trống = chưa xong)</span>
                      <TimeSelect value={stopKtLucTao} onChange={setStopKtLucTao} minuteStep={1} />
                    </label>
                  </div>
                  <Button variant="danger" className="w-full" onClick={doStop} loading={busy}
                    disabled={lyDoNgungDs.length ? !stopLyDoId : !stopReason.trim()}>
                    {stopKtLucTao ? 'Ghi lần ngừng (đã kết thúc)' : 'Ngừng chuyền'}
                  </Button>
                </div>
              ) : null}

              {ngungList.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium text-ink-soft">Lịch ngừng ({ngungList.length})</div>
                  <div className="space-y-1.5">
                    {ngungList.map((n) => (
                      <div key={n.id} className="rounded-control border border-line px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-ink">{fmtDt(n.tg_bd_ngung)}{n.tg_kt_ngung ? ` → ${fmtDt(n.tg_kt_ngung)}` : ''}</span>
                          {n.trang_thai === 'DANG_NGUNG'
                            ? <Badge tone="danger">Đang ngừng</Badge>
                            : <Badge tone="default">{fmtNum(n.so_phut)} phút</Badge>}
                        </div>
                        {n.ly_do && <div className="mt-0.5 text-xs text-ink-soft">Lý do: {n.ly_do}{n.nguoi ? ` · ${n.nguoi}` : ''}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Ngừng lệnh chạy để in hàng gấp hơn (khác với "Ngừng chuyền" downtime) */}
          {running && canRun && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Ngừng lệnh chạy (in hàng gấp)</h3>
              <Button variant="secondary" className="w-full" onClick={openPause} disabled={busy}>
                Ngừng lệnh chạy…
              </Button>
            </section>
          )}

          {/* Vượt sản xuất — cộng SL vượt vào release + trừ đợt vải chưa release cùng phần in */}
          {canRun && phieu && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Vượt sản xuất</h3>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-ink-soft">SL vượt kế hoạch (cộng vào release, trừ đợt chưa release)</label>
                  <Input type="number" min="1" value={vuot}
                    onChange={(e) => setVuot(e.target.value)} placeholder="vd: 50" />
                </div>
                <Button onClick={doVuot} loading={busy} disabled={!(Number(vuot) > 0)}>Vượt kế hoạch</Button>
              </div>
            </section>
          )}
        </div>
      )}
      {/* GOM SET: nhập SL in từng phần in → in nhiều tem liên tiếp */}
      <PrintSetModal open={printSetOpen} onClose={() => setPrintSetOpen(false)} rows={dotVaiList}
        onPrintRow={doPrintRow} busy={busy} meta={temMeta} setMeta={setTemMeta} goiY={goiYTem} />

      <TraVeKeHoachModal open={traVeKhOpen} onClose={() => setTraVeKhOpen(false)} runs={data && running ? [data] : []}
        onXong={({ thongBao }) => { setTraVeKhOpen(false); show(thongBao); load(); onChanged?.(); }} />

      {/* Trả về Kỹ thuật — lý do bắt buộc (hiện lại ở màn READY / QC READY) */}
      <Modal open={traVeOpen} onClose={() => setTraVeOpen(false)} size="sm"
        title={`Trả về Kỹ thuật — ${data?.lenh?.ma_lenh_san_xuat || ''}`}
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setTraVeOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={doTraVeKyThuat} loading={busy} disabled={!traVeReason.trim()}>
              Xác nhận trả về
            </Button>
          </>
        }
      >
        <p className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Lệnh <b>{data?.lenh?.ma_lenh_san_xuat}</b> sẽ bị <b>HỦY</b>, phần in quay lại <b>READY</b>:
          hủy xác nhận Khuôn/Film/Mực + QC, kỹ thuật phải làm lại rồi Kế hoạch Release 1 lần nữa.
          Lý do sẽ hiện ở màn Chuẩn bị kỹ thuật.
          {printed > 0 && (
            <> <b className="text-danger">Toàn bộ {fmtNum(printed)} đã in (tem + phiếu) cũng bị hủy theo.</b></>
          )}
        </p>
        <Field label="Lý do trả về" required>
          <Textarea rows={3} value={traVeReason} onChange={(e) => setTraVeReason(e.target.value)}
            placeholder="Vì sao trả về kỹ thuật (vd: sai film, khuôn chưa đạt...)" />
        </Field>
      </Modal>

      {/* Đổi chuyền lượt chạy — chọn chuyền khác, tem đã in giữ nguyên */}
      <Modal open={doiOpen} onClose={() => setDoiOpen(false)} title="Đổi chuyền" size="sm"
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setDoiOpen(false)}>Hủy</Button>
            <Button onClick={doDoiChuyen} loading={busy}
              disabled={!doiChuyenId || doiChuyenId === data?.lenh?.chuyen_id}>
              Xác nhận đổi
            </Button>
          </>
        }
      >
        <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Chuyển lệnh <b>{data?.lenh?.ma_lenh_san_xuat}</b> sang chuyền khác (máy hỏng, dồn tải…).
          Đổi cả <b>phiếu đang chạy</b> lẫn <b>lệnh</b>; <b>tem đã in giữ nguyên</b> — không in lại,
          không đụng xe phơi.
        </div>
        <div className="mb-3 text-sm text-ink">
          Chuyền hiện tại: <b>{data?.lenh?.ten_chuyen || data?.lenh?.ma_chuyen || '—'}</b>
        </div>
        <Field label="Chuyền mới" required>
          <ChuyenPicker chuyen={chuyenList} value={doiChuyenId} onChange={setDoiChuyenId} />
        </Field>
        <Field label="Ghi chú" hint="Không bắt buộc — ghi vào nhật ký để sau tra được vì sao đổi">
          <Textarea rows={2} value={doiGhiChu} onChange={(e) => setDoiGhiChu(e.target.value)}
            placeholder="vd: máy M5 hỏng trục, chuyển sang M7" />
        </Field>
      </Modal>

      {/* Ngừng lệnh chạy + hoán đổi phần in gấp hơn */}
      <Modal open={pauseOpen} onClose={() => setPauseOpen(false)} title="Ngừng lệnh chạy — in hàng gấp" size="lg"
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setPauseOpen(false)}>Đóng</Button>
            <Button variant="danger" onClick={doPauseOnly} loading={busy}>Chỉ ngừng lệnh chạy</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30">
          Ngừng lệnh <b>{data?.lenh?.ma_lenh_san_xuat}</b> (đã in <b>{fmtNum(printed)}</b>/{fmtNum(target)}).
          Tem đã in đi tiếp <b>Chờ khô/kiểm</b> — số lượng giữ nguyên. Lệnh về <b>chờ chạy</b> để lập lại kế hoạch
          (không cần test lại). Chọn một phần in bên dưới để <b>hoán đổi</b> chạy ngay trên cùng chuyền.
        </div>
        <div className="mb-1 text-xs font-medium text-ink-soft">Đang chờ sản xuất — bấm để hoán đổi ({swapList.length})</div>
        {swapLoading ? (
          <div className="py-6 text-center text-sm text-ink-soft">Đang tải...</div>
        ) : swapList.length === 0 ? (
          <p className="py-4 text-sm text-ink-soft">Không có phần in nào đang chờ sản xuất để hoán đổi.</p>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {swapList.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge tone="info">{r.ma_lenh_san_xuat}</Badge>
                    <span className="truncate font-medium text-ink">{r.ten_khach_hang || '—'}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-soft">
                    {[r.ma_hang, r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ')}
                    {r.han_giao_hang ? ` · Hạn giao ${fmtDate(r.han_giao_hang)}` : ''}
                    {` · SL ${fmtNum(r.so_luong_release)}`}
                  </div>
                </div>
                <Button className="shrink-0 px-2.5 py-1 text-xs" onClick={() => doSwap(r)} loading={busy}>Hoán đổi</Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!reprint} onClose={() => setReprint(null)}
        title={reprint ? `In lại tem ${reprint.ma_tem}` : 'In lại tem'}
        footer={
          <>
            <Button chiXemOk variant="ghost" onClick={() => setReprint(null)}>Hủy</Button>
            <Button onClick={doReprint} loading={busy} disabled={!reprintReason.trim()}>In lại tem</Button>
          </>
        }
      >
        <div className="mb-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30">
          In lại nhãn của tem <b>{reprint?.ma_tem}</b> — <b>giữ nguyên mã tem</b>, không đổi số lượng/sổ cái
          (dùng khi tem giấy bị <b>mất/rách</b>). Lần in lại được lưu vào lịch sử in tem.
        </div>
        <Textarea rows={3} value={reprintReason} onChange={(e) => setReprintReason(e.target.value)}
          placeholder="Lý do in lại (vd: tem rách, mất tem, in mờ...)" />
      </Modal>

      <Modal open={logsOpen} onClose={() => setLogsOpen(false)} title="Lịch sử in tem" size="lg"
        footer={<Button chiXemOk variant="ghost" onClick={() => setLogsOpen(false)}>Đóng</Button>}
      >
        {temLogs.length === 0 ? (
          <p className="text-sm text-ink-soft">Chưa có lượt in nào.</p>
        ) : (
          <div className="space-y-1.5">
            {temLogs.map((l) => {
              const huy = l.tem_trang_thai === 'HUY';
              return (
                <div key={l.id} className={`flex items-center justify-between rounded-control border px-3 py-2 text-sm ${huy ? 'border-danger/30 bg-danger/5' : 'border-line'}`}>
                  <span className={`flex items-center gap-2 font-medium ${huy ? 'text-ink-soft line-through' : 'text-ink'}`}>
                    {l.ma_tem}
                    {l.so_lan_in > 1 ? <Badge tone="warning">In lại lần {l.so_lan_in}</Badge> : <Badge tone="info">In lần đầu</Badge>}
                    {huy && <Badge tone="danger">Đã hủy</Badge>}
                  </span>
                  <div className="text-right text-xs text-ink-soft">
                    <div>{l.nguoi || '—'} · {fmtDt(l.tg_in)}</div>
                    {l.ly_do_in_lai && <div className="text-danger">Lý do in lại: {l.ly_do_in_lai}</div>}
                    {huy && (l.tg_huy || l.nguoi_huy || l.ly_do_huy) && (
                      <div className="mt-0.5 text-danger">
                        Hủy in tem{l.nguoi_huy ? ` · ${l.nguoi_huy}` : ''}{l.tg_huy ? ` · ${fmtDt(l.tg_huy)}` : ''}
                        {l.ly_do_huy ? <div>Lý do hủy: {l.ly_do_huy}</div> : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {huyTem.modal}
      {moLaiTem.modal}
      <Toast toast={toast} />
    </SidePanel>
  );
}
