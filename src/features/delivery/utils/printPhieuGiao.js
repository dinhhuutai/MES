import { maTemNhan } from '../../../utils/format';
import { renderPhieu, htmlToPhieu } from './renderMauPhieu';
import { mauChoViTriPhieu } from '../../../services/mauPhieuService';

// ─────────────────────────────────────────────────────────────────────────────
// IN PHIẾU GIAO HÀNG — 2 KIỂU (người dùng chốt 04/09/2026):
//   · CHI TIẾT : 1 dòng = 1 tem (truy được từng lô ra khỏi kho).
//   · GỘP      : cùng CODE PHẦN thì cộng SL thành 1 dòng (phiếu ngắn, khách dễ đối chiếu).
//
// TỪ 08/09/2026 (mig 094) mỗi kiểu có thể gắn MỘT MẪU thiết kế ở *Hệ thống → Thiết kế phiếu*.
// ⚠⚠ ĐƯỜNG LÙI LÀ BẮT BUỘC: chưa gắn mẫu / chưa chạy migration / API lỗi ⇒ in bằng BỐ CỤC CỨNG
//   (A4 dọc) bên dưới, Y HỆT như trước. Giao hàng là việc đang chờ ở cổng — module thiết kế không
//   được phép làm hỏng đường in. Vì vậy mọi lỗi ở nhánh mẫu đều nuốt và lùi, KHÔNG ném lên.
// ⚠ KHÔNG dùng `alert/confirm` — popup bị chặn thì NÉM Error để trang gọi hiện Toast (§6).
// ─────────────────────────────────────────────────────────────────────────────

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('vi-VN'));
const ngay = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : x.toLocaleDateString('vi-VN');
};

// ⚠⚠ Mã tem trên phiếu phải là mã NGƯỜI CẦM HÀNG nhìn thấy trên nhãn: tem con mig 091 đã mang sẵn
//   `17…` ⇒ in thẳng; tem gốc / dữ liệu cũ mới ghép tiền tố theo nguồn. Dùng `temCode()` chứ KHÔNG
//   nối chuỗi `'17-' + ma` — mã ERP 12 số phải THAY 2 số đầu, nối vào ra `17-152608057689` (sai).
// ⚠⚠ TEM 13 GIA CÔNG cũng mang mã riêng `13…` (06/09/2026) và đi ở nguồn KCS ⇒ ghép `15` sẽ biến
//   nó thành mã KHÔNG có thật, in lên phiếu giao là quét không ra. `maTemNhan` chặn ca đó.
const maHien = (t) => maTemNhan(t.ma_tem, t.nguon === 'SUA' ? 17 : 15, null, t.la_tem_sua);

// GỘP theo CODE PHẦN. Khóa gộp lấy cả mã hàng/màu/kích để 2 phần in trùng tên mà khác quy cách
// không bị cộng nhầm vào nhau. Giữ THỨ TỰ gặp đầu tiên (đừng sort lại — phiếu in ra phải khớp
// thứ tự người soạn nhìn trên màn hình).
export function gopTheoCodePhan(tems) {
  const m = new Map();
  (tems || []).forEach((t) => {
    const k = [t.phan_list || '', t.ma_hang || '', t.mau_vai || '', t.kich_vai || '', t.kich_phim || ''].join('|');
    const cu = m.get(k);
    if (cu) {
      cu.so_luong_giao += Number(t.so_luong_giao) || 0;
      cu.so_tem += 1;
      if (t.nguon === 'SUA' || t.la_tem_sua) cu.co_sua = true;
    } else {
      m.set(k, {
        phan_list: t.phan_list, ma_hang: t.ma_hang, mau_vai: t.mau_vai,
        kich_vai: t.kich_vai, kich_phim: t.kich_phim,
        so_luong_giao: Number(t.so_luong_giao) || 0, so_tem: 1,
        co_sua: t.nguon === 'SUA' || !!t.la_tem_sua,
      });
    }
  });
  return [...m.values()];
}

const CSS = `
  @page { size: A4 portrait; margin: 12mm 10mm; }
  *{box-sizing:border-box}
  body{font-family:Inter,Arial,sans-serif;color:#111827;margin:0;font-size:12px}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111827;padding-bottom:6px}
  .brand{font-size:20px;font-weight:800;letter-spacing:1px}
  .brand small{display:block;font-size:10px;font-weight:400;letter-spacing:0}
  h1{font-size:17px;margin:0;text-align:center;text-transform:uppercase}
  .sub{text-align:center;font-size:11px;color:#6b7280;margin-top:2px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;margin:8px 0 10px;font-size:12px}
  .meta b{display:inline-block;min-width:86px;font-weight:600;color:#6b7280}
  table{width:100%;border-collapse:collapse;font-size:11.5px}
  th,td{border:1px solid #9ca3af;padding:4px 6px;vertical-align:top}
  th{background:#f3f4f6;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px}
  td.r,th.r{text-align:right}
  td.c,th.c{text-align:center}
  tfoot td{font-weight:700;background:#f9fafb}
  .wrap{word-break:break-word}
  .ky{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:22px;text-align:center;font-size:11.5px}
  .ky div{padding-top:2px}
  .ky span{display:block;height:52px}
  .ft{margin-top:10px;font-size:10px;color:#6b7280;text-align:right}
  @media print{ .no-print{display:none} }
`;

// ─── DỮ LIỆU CHO MẪU THIẾT KẾ (mig 094) ─────────────────────────────────────
// 2 phạm vi TÁCH BẠCH, khớp `backend/src/utils/mauPhieu.js`:
//   · mức PHIẾU → khối `dau` / `cuoi`
//   · mức DÒNG  → khối `lap` (mỗi phần tử = 1 dòng bảng chi tiết)
// ⚠ Thêm trường mới vào `TRUONG_PHIEU`/`TRUONG_DONG_PHIEU` thì PHẢI thêm ở đây, nếu không ô trên
//   phiếu ra RỖNG mà không báo lỗi gì (đúng bẫy đã ghi cho nhóm "Gia công" của mẫu tem).
function duLieuPhieu(gh, gop, soDong) {
  const tems = gh.tems || [];
  return {
    ma_phieu_giao: gh.ma_phieu_giao || '',
    ngay_giao: gh.ngay_giao || gh.created_date || null,
    ngay_lap: gh.created_date || null,
    ngay_in: new Date().toISOString(),
    ghi_chu: gh.ghi_chu || '',
    kieu_in: gop ? 'Bản GỘP theo code phần' : 'Bản CHI TIẾT theo từng tem',
    ten_khach_hang: gh.ten_khach_hang || '',
    ma_don_hang: gh.ma_don_hang || '',
    so_tem: tems.length,
    so_dong: soDong,
    tong_sl: tems.reduce((s, t) => s + (Number(t.so_luong_giao) || 0), 0),
  };
}

function duLieuDong(gh, gop) {
  const tems = gh.tems || [];
  const kichVaiPhim = (a, b) => [a, b].filter(Boolean).join(' / ');
  if (gop) {
    return gopTheoCodePhan(tems).map((g, i) => ({
      stt: i + 1,
      ma_tem: '', nguon: '', ma_lenh_san_xuat: '',
      phan_list: g.phan_list || '', ma_hang: g.ma_hang || '', mau_vai: g.mau_vai || '',
      kich_vai: g.kich_vai || '', kich_phim: g.kich_phim || '',
      kich_vai_phim: kichVaiPhim(g.kich_vai, g.kich_phim),
      so_tem_gop: g.so_tem, co_sua: g.co_sua ? ' *' : '',
      so_luong_giao: Number(g.so_luong_giao) || 0,
    }));
  }
  return tems.map((t, i) => ({
    stt: i + 1,
    ma_tem: maHien(t),
    nguon: (t.nguon === 'SUA' || t.la_tem_sua) ? 'Sửa' : 'KCS',
    ma_lenh_san_xuat: t.ma_lenh_san_xuat || '',
    phan_list: t.phan_list || '', ma_hang: t.ma_hang || '', mau_vai: t.mau_vai || '',
    kich_vai: t.kich_vai || '', kich_phim: t.kich_phim || '',
    kich_vai_phim: kichVaiPhim(t.kich_vai, t.kich_phim),
    so_tem_gop: 1, co_sua: (t.nguon === 'SUA' || t.la_tem_sua) ? ' *' : '',
    so_luong_giao: Number(t.so_luong_giao) || 0,
  }));
}

// Dựng tờ phiếu theo MẪU đã gắn. Trả `null` = chưa gắn mẫu / lỗi → bên gọi lùi về bố cục cứng.
async function htmlTheoMau(gh, gop) {
  const maViTri = gop ? 'GH_PHIEU_GIAO_GOP' : 'GH_PHIEU_GIAO_CT';
  let boCuc;
  try {
    const res = await mauChoViTriPhieu(maViTri);
    boCuc = res?.data?.mau?.bo_cuc_json;
    if (!boCuc || !boCuc.lap) return null;      // chưa gắn mẫu → dùng bố cục cứng
  } catch { return null; }                       // chưa chạy migration / mất mạng → dùng bố cục cứng
  try {
    const dongs = duLieuDong(gh, gop);
    const than = await renderPhieu(boCuc, duLieuPhieu(gh, gop, dongs.length), dongs);
    return htmlToPhieu(boCuc, than, `Phiếu giao ${gh.ma_phieu_giao}`, true);
  } catch (e) {
    console.error('[phieu-giao] Dựng phiếu theo mẫu lỗi, dùng bố cục mặc định:', e);
    return null;
  }
}

// ─── BỐ CỤC CỨNG (đường lùi — A4 dọc) ───────────────────────────────────────
function htmlCung(gh, gop) {
  const tems = gh.tems || [];
  const tong = tems.reduce((s, t) => s + (Number(t.so_luong_giao) || 0), 0);

  const rows = gop
    ? gopTheoCodePhan(tems).map((g, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="wrap">${esc(g.phan_list) || '—'}</td>
        <td class="wrap">${esc(g.ma_hang) || '—'}</td>
        <td class="wrap">${esc(g.mau_vai) || '—'}</td>
        <td class="wrap">${esc([g.kich_vai, g.kich_phim].filter(Boolean).join(' / ')) || '—'}</td>
        <td class="c">${g.so_tem}${g.co_sua ? ' *' : ''}</td>
        <td class="r">${num(g.so_luong_giao)}</td></tr>`).join('')
    : tems.map((t, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="wrap">${esc(maHien(t))}</td>
        <td class="wrap">${esc(t.phan_list) || '—'}</td>
        <td class="wrap">${esc(t.ma_hang) || '—'}</td>
        <td class="wrap">${esc(t.mau_vai) || '—'}</td>
        <td class="wrap">${esc([t.kich_vai, t.kich_phim].filter(Boolean).join(' / ')) || '—'}</td>
        <td class="c">${t.nguon === 'SUA' || t.la_tem_sua ? 'Sửa' : 'KCS'}</td>
        <td class="r">${num(t.so_luong_giao)}</td></tr>`).join('');

  const head = gop
    ? `<tr><th class="c" style="width:26px">TT</th><th>Code phần</th><th style="width:96px">Mã hàng</th>
       <th style="width:74px">Màu vải</th><th style="width:92px">Kích vải / phim</th>
       <th class="c" style="width:44px">Số tem</th><th class="r" style="width:66px">SL giao</th></tr>`
    : `<tr><th class="c" style="width:26px">TT</th><th style="width:104px">Mã tem</th><th>Code phần</th>
       <th style="width:88px">Mã hàng</th><th style="width:66px">Màu vải</th><th style="width:86px">Kích vải / phim</th>
       <th class="c" style="width:42px">Nguồn</th><th class="r" style="width:62px">SL giao</th></tr>`;

  const soCot = gop ? 6 : 7;
  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
    <title>Phiếu giao ${esc(gh.ma_phieu_giao)}</title><style>${CSS}</style></head><body>
    <div class="hd">
      <div class="brand">THLA<small>Công ty Thuận Hưng Long An</small></div>
      <div style="flex:1">
        <h1>Phiếu giao hàng</h1>
        <div class="sub">${gop ? 'Bản GỘP theo code phần' : 'Bản CHI TIẾT theo từng tem'}</div>
      </div>
      <div style="text-align:right;font-size:12px"><b>${esc(gh.ma_phieu_giao)}</b><br>${esc(ngay(gh.ngay_giao) || ngay(gh.created_date))}</div>
    </div>
    <div class="meta">
      <div><b>Khách hàng</b>${esc(gh.ten_khach_hang) || '—'}</div>
      <div><b>Đơn hàng</b>${esc(gh.ma_don_hang) || '—'}</div>
      <div><b>Số tem</b>${tems.length}</div>
      <div><b>Tổng SL giao</b>${num(tong)}</div>
      ${gh.ghi_chu ? `<div style="grid-column:1/-1"><b>Ghi chú</b>${esc(gh.ghi_chu)}</div>` : ''}
    </div>
    <table><thead>${head}</thead><tbody>${rows || `<tr><td colspan="${soCot + 1}" class="c">(Phiếu chưa có tem)</td></tr>`}</tbody>
      <tfoot><tr><td colspan="${soCot}" class="r">TỔNG CỘNG</td><td class="r">${num(tong)}</td></tr></tfoot></table>
    ${gop ? '<div class="ft">* = trong nhóm có hàng đã qua SỬA (tem 17)</div>' : ''}
    <div class="ky">
      <div>Người giao<span></span>(Ký, ghi rõ họ tên)</div>
      <div>Người vận chuyển<span></span>(Ký, ghi rõ họ tên)</div>
      <div>Người nhận<span></span>(Ký, ghi rõ họ tên)</div>
    </div>
    <div class="ft">In lúc ${new Date().toLocaleString('vi-VN')}</div>
    </body></html>`;

  return html;
}

// Mở cửa sổ in. `tuIn` = tài liệu KHÔNG tự gọi print (bố cục cứng) ⇒ phải gọi hộ.
// ⚠ Tài liệu dựng theo MẪU đã có sẵn đoạn tự in (chờ ảnh QR xong mới print) — gọi thêm ở đây là in 2 lần.
function moCuaSo(html, tuIn) {
  const w = window.open('', '_blank', 'width=900,height=700');
  // ⚠ NÉM lỗi để trang gọi hiện Toast — trình duyệt chặn popup là chuyện rất hay gặp, im lặng thì
  //   người dùng bấm mãi không thấy gì (bài học ở `printTemLabel`).
  if (!w) throw new Error('Trình duyệt đã chặn cửa sổ in — cho phép popup cho trang này rồi bấm lại');
  w.document.write(html);
  w.document.close();
  w.focus();
  if (tuIn) setTimeout(() => w.print(), 250);
}

// ⚠⚠ HÀM NAY LÀ `async` (từ 08/09/2026 — phải hỏi mẫu đã gắn trước khi dựng). Bên gọi PHẢI `await`,
//   nếu không lỗi "popup bị chặn" rơi vào promise và try/catch đồng bộ KHÔNG bắt được ⇒ người dùng
//   bấm in mà không thấy gì, cũng không có toast.
export async function printPhieuGiao(gh, { gop = false } = {}) {
  if (!gh) return;
  const theoMau = await htmlTheoMau(gh, gop);
  if (theoMau) { moCuaSo(theoMau, false); return; }
  moCuaSo(htmlCung(gh, gop), true);
}

// Dựng tài liệu XEM TRƯỚC (không tự in) — dùng ở màn Thiết kế phiếu.
export async function htmlXemTruocPhieu(boCuc, gh, gop) {
  const dongs = duLieuDong(gh, gop);
  const than = await renderPhieu(boCuc, duLieuPhieu(gh, gop, dongs.length), dongs);
  return htmlToPhieu(boCuc, than, 'Xem trước phiếu', false);
}

// IN THỬ từ màn Thiết kế — dựng bằng ĐÚNG đường in thật, chỉ khác là dữ liệu MẪU.
export async function inThuMauPhieu(boCuc, gh, gop) {
  const dongs = duLieuDong(gh, gop);
  const than = await renderPhieu(boCuc, duLieuPhieu(gh, gop, dongs.length), dongs);
  moCuaSo(htmlToPhieu(boCuc, than, 'In thử mẫu phiếu', true), false);
}

export default printPhieuGiao;
