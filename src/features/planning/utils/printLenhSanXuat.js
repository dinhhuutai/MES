// ─────────────────────────────────────────────────────────────────────────────
// IN "LỆNH SẢN XUẤT" 1 LỆNH RA A4 NGANG — nút In ở đầu mỗi dòng của *Danh sách release* (06/10/2026, theo mẫu
// giấy người dùng gửi; người dùng chốt: mỗi tờ = ĐÚNG lệnh của dòng bấm).
//
// Dữ liệu = các dòng của Danh sách release thuộc lệnh đó (1 dòng/phần in — lệnh gom set cũ ra nhiều dòng):
//   · đầu tờ: ngày = NGÀY SX KẾ HOẠCH · Tổ in = tổ của phiếu chạy gần nhất (trống nếu chưa chạy) · Chuyền ·
//     Phụ trách (trống, ghi tay) · Số = MÃ LỆNH MES (`LSX…`).
//   · bảng: Khách · PO (mã đơn) · Mã hàng · Kích vải/phim · Màu · Định mức (`chuyen_san_xuat.dinh_muc_gio`) ·
//     SL cần in (SL release của phần in) · Kế hoạch từ/đến giờ. Thực hiện · Sản lượng · Ghi chú để ghi tay.
//     Luôn đủ 6 dòng như mẫu (thiếu thì dòng trống; lệnh >6 phần in thì kéo dài thêm).
//   · chân tờ: 4 ô ký, ngày = NGÀY IN.
// Trả `false` khi trình duyệt chặn cửa sổ in (bên gọi báo lỗi).
// ─────────────────────────────────────────────────────────────────────────────
import { gio24, ngayDMY } from './cotChecklistRelease';

const SO_DONG_TOI_THIEU = 6;
// Bề rộng 15 cột của bảng (%, Σ = 100) — theo tỉ lệ mẫu giấy (Mã hàng rộng nhất).
const RONG = [3.5, 5.5, 9, 18, 8, 8, 8, 5, 5, 4.5, 4.5, 4.5, 4.5, 6]; // + Ghi chú = phần còn lại (6)
RONG.push(100 - RONG.reduce((a, b) => a + b, 0));
const COLS = RONG.map((w) => `<col style="width:${w}%">`).join('');
// Dòng ĐẦU tờ có bố cục RIÊNG (không bám cột bảng): tiêu đề dài, bám cột là đè lên ô ngày.
const RONG_DAU = [19, 11, 7, 7, 8, 10, 5, 10, 8, 4, 11];
const COLS_DAU = RONG_DAU.map((w) => `<col style="width:${w}%">`).join('');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const so = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('vi-VN'));

export default function printLenhSanXuat(dongLenh) {
  const ds = (dongLenh || []).slice().sort((a, b) => String(a.ma_phan || '').localeCompare(String(b.ma_phan || '')));
  if (!ds.length) return true;
  const l = ds[0];
  const homNay = new Date();
  const ngayKy = `Ngày ${String(homNay.getDate()).padStart(2, '0')} tháng ${String(homNay.getMonth() + 1).padStart(2, '0')} năm ${homNay.getFullYear()}`;

  const soDong = Math.max(SO_DONG_TOI_THIEU, ds.length);
  const dong = [];
  for (let i = 0; i < soDong; i += 1) {
    const r = ds[i];
    dong.push(r ? `
      <tr class="d">
        <td class="c">${i + 1}</td>
        <td>${esc(r.ten_khach_hang)}</td>
        <td>${esc(r.ma_don_hang)}</td>
        <td class="nho">${esc(r.ten_ma_hang || r.ma_hang)}</td>
        <td class="c">${esc(r.kich_vai)}</td>
        <td class="c">${esc(r.kich_phim)}</td>
        <td class="c nho">${esc(r.mau_vai)}</td>
        <td class="r">${so(l.dinh_muc_gio)}</td>
        <td class="r">${so(r.sl_release_phan ?? r.so_luong_release)}</td>
        <td class="c">${gio24(l.tg_bd_kh)}</td>
        <td class="c">${gio24(l.tg_kt_kh)}</td>
        <td></td><td></td><td></td><td></td>
      </tr>` : `
      <tr class="d"><td class="c">${i + 1}</td>${'<td></td>'.repeat(14)}</tr>`);
  }

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
    <title>Lệnh sản xuất ${esc(l.ma_lenh_san_xuat)}</title>
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, "Helvetica Neue", sans-serif; color: #000; margin: 0; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .dau td { border: none; border-bottom: 1px solid #000; padding: 6px 4px; font-size: 15px; white-space: nowrap; }
      .dau .tieu-de { font-weight: bold; font-size: 17px; }
      .dau .gt { font-weight: bold; }
      .dau .nhan { text-align: right; }
      .bang th, .bang td { border: 1px solid #000; padding: 3px 4px; font-size: 13px; vertical-align: middle; }
      .bang th { font-weight: normal; text-align: center; }
      .bang tr.d td { height: 21mm; }
      .c { text-align: center; }
      .r { text-align: right; }
      .nho { font-size: 11.5px; }
      .ky { margin-top: -1px; }
      .ky td { border: 1px solid #000; height: 30mm; vertical-align: top; padding: 4px 6px; font-size: 14px; position: relative; }
      .ky .ngay { position: absolute; left: 0; right: 0; bottom: 4px; text-align: center; font-size: 13px; }
    </style></head><body>
    <table class="dau">
      <colgroup>${COLS_DAU}</colgroup>
      <tr>
        <td class="tieu-de">LỆNH SẢN XUẤT</td>
        <td class="gt c">${ngayDMY(l.ngay_ke_hoach)}</td>
        <td class="nhan">Tổ in</td>
        <td class="gt c">${esc(l.to_in)}</td>
        <td class="nhan">Chuyền</td>
        <td class="gt c">${esc(l.ten_chuyen || l.ma_chuyen)}</td>
        <td></td>
        <td class="c">Phụ trách</td>
        <td></td>
        <td class="nhan">Số</td>
        <td class="gt">${esc(l.ma_lenh_san_xuat)}</td>
      </tr>
    </table>
    <table class="bang">
      <colgroup>${COLS}</colgroup>
      <thead>
        <tr>
          <th rowspan="2"><b>STT</b></th><th rowspan="2">Khách hàng</th><th rowspan="2">PO</th><th rowspan="2">Mã hàng</th>
          <th rowspan="2">Kích vải</th><th rowspan="2">Kích phim</th><th rowspan="2">Màu vải</th>
          <th rowspan="2">Định mức</th><th rowspan="2">Sl cần in</th>
          <th colspan="2">Kế hoạch</th><th colspan="2">Thực hiện</th>
          <th rowspan="2">Sản lượng</th><th rowspan="2">Ghi chú</th>
        </tr>
        <tr><th>Từ giờ</th><th>Đến giờ</th><th>Từ giờ</th><th>Đến giờ</th></tr>
      </thead>
      <tbody>${dong.join('')}</tbody>
    </table>
    <table class="ky">
      <tr>
        <td>Người lập<div class="ngay">${ngayKy}</div></td>
        <td>Phòng Kế Hoạch<div class="ngay">${ngayKy}</div></td>
        <td>Chuyền trưởng<div class="ngay">${ngayKy}</div></td>
        <td>Phòng sản xuất<div class="ngay">${ngayKy}</div></td>
      </tr>
    </table>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };</script>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}
