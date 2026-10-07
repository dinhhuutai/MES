// ─────────────────────────────────────────────────────────────────────────────
// IN "LỆNH SẢN XUẤT" THEO CHUYỀN — A5 NGANG (07/10/2026, người dùng chốt; thay bản 06/10 in từng lệnh ra A4).
//
// 1 LỆNH SẢN XUẤT (giấy) = LỆNH LỚN của 1 CHUYỀN trong 1 NGÀY SX KẾ HOẠCH, gom mọi lệnh nhỏ (`LSX…` = đợt SX)
// đưa vào sản xuất trên chuyền đó. Dữ liệu = các dòng của *Danh sách release* (1 dòng / lệnh × phần in).
//   · mỗi TỜ tối đa 6 DÒNG (`DONG_MOT_TO`) như mẫu giấy; dài hơn thì sang tờ sau (STT chạy tiếp, mỗi tờ đủ đầu
//     tờ + ô ký — tờ nào cũng là 1 mẫu trọn vẹn, tách rời vẫn đọc được), tờ cuối thiếu thì dòng trống.
//   · đầu tờ: ngày SX KH · Tổ in (tổ của phiếu chạy gần nhất các lệnh, trống nếu chưa chạy) · Chuyền ·
//     Phụ trách (trống, ghi tay) · Số = `<ddmmyy>-<mã chuyền>` (1 chuyền × 1 ngày ⇒ duy nhất) · Tờ k/N.
//   · bảng: Khách · PO · Mã hàng (dòng nhỏ: code phần · mã lệnh nhỏ) · Kích vải/phim · Màu · Định mức ·
//     SL cần in (SL release của phần in trong lệnh) · Kế hoạch từ/đến giờ (của CHÍNH lệnh nhỏ). Thực hiện ·
//     Sản lượng · Ghi chú để ghi tay. Dòng xếp theo giờ BĐ kế hoạch.
//   · chân tờ: 4 ô ký, ngày = NGÀY IN.
// `nhomTheoChuyen` là nguồn gom DUY NHẤT — modal chọn chuyền đếm số tờ bằng chính hàm này ⇒ số tờ báo trước
//   luôn khớp số tờ in ra.
// ─────────────────────────────────────────────────────────────────────────────
import { gio24, ngayDMY } from './cotChecklistRelease';

export const DONG_MOT_TO = 6;
export const soTo = (soDong) => Math.max(1, Math.ceil(soDong / DONG_MOT_TO));

// Bề rộng 15 cột của bảng (%, Σ = 100) — theo tỉ lệ mẫu giấy (Mã hàng rộng nhất).
const RONG = [3.5, 6, 9, 17, 7, 7, 8, 5, 5.5, 4.5, 4.5, 4.5, 4.5, 5.5]; // + Ghi chú = phần còn lại
RONG.push(100 - RONG.reduce((a, b) => a + b, 0));
const COLS = RONG.map((w) => `<col style="width:${w}%">`).join('');
// Dòng ĐẦU tờ có bố cục RIÊNG (không bám cột bảng): tiêu đề dài, bám cột là đè lên ô ngày.
//   Đo theo chữ thật ở khổ A5 (198mm): tiêu đề 11pt đậm ~32mm · ngày ~20mm · "Phụ trách" ~17mm · Số ~29mm.
const RONG_DAU = [17, 10.5, 5.5, 6, 6.5, 12.5, 8.5, 7.5, 3.5, 14.5, 8];
const COLS_DAU = RONG_DAU.map((w) => `<col style="width:${w}%">`).join('');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const so = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('vi-VN'));
const tg = (v) => { const x = v ? new Date(v).getTime() : NaN; return Number.isNaN(x) ? Infinity : x; };
const soSanhChu = (a, b) => String(a || '').localeCompare(String(b || ''), 'vi', { numeric: true });

// Gom dòng Danh sách release thành các LỆNH SẢN XUẤT theo (chuyền × ngày SX KH).
// Trả [{ khoa, ma_chuyen, ten_chuyen, ngay_ke_hoach, dinh_muc_gio, to_in, so, dong[], so_lenh, so_to }].
export function nhomTheoChuyen(rows) {
  const map = new Map();
  (rows || []).forEach((r) => {
    const chuyen = r.ma_chuyen || r.ten_chuyen || '';
    const khoa = `${chuyen}|${ngayDMY(r.ngay_ke_hoach)}`;
    if (!map.has(khoa)) {
      map.set(khoa, {
        khoa, ma_chuyen: r.ma_chuyen || '', ten_chuyen: r.ten_chuyen || r.ma_chuyen || '(chưa gán chuyền)',
        ngay_ke_hoach: r.ngay_ke_hoach || null, dinh_muc_gio: r.dinh_muc_gio, dong: [],
      });
    }
    map.get(khoa).dong.push(r);
  });
  return [...map.values()]
    .map((g) => {
      const dong = g.dong.slice().sort((a, b) => (tg(a.tg_bd_kh) - tg(b.tg_bd_kh))
        || (tg(a.created_date) - tg(b.created_date))
        || soSanhChu(a.ma_lenh_san_xuat, b.ma_lenh_san_xuat)
        || soSanhChu(a.ma_phan, b.ma_phan));
      const ngay = ngayDMY(g.ngay_ke_hoach, '');
      return {
        ...g,
        dong,
        so_lenh: new Set(dong.map((r) => r.lenh_id)).size,
        so_to: soTo(dong.length),
        to_in: [...new Set(dong.map((r) => r.to_in).filter(Boolean))].join(', '),
        // Số lệnh lớn: ddmmyy-mã chuyền (vd 071026-M4A-4B).
        so: [ngay ? ngay.slice(0, 4) + ngay.slice(6) : '', g.ma_chuyen || g.ten_chuyen].filter(Boolean).join('-'),
      };
    })
    .sort((a, b) => soSanhChu(a.ten_chuyen, b.ten_chuyen) || (tg(a.ngay_ke_hoach) - tg(b.ngay_ke_hoach)));
}

function dongBang(r, stt, g) {
  if (!r) return `<tr class="d"><td class="c">${stt}</td>${'<td></td>'.repeat(14)}</tr>`;
  const phu = [r.ma_phan, r.ma_lenh_san_xuat].filter(Boolean).join(' · ');
  return `
      <tr class="d">
        <td class="c">${stt}</td>
        <td><div class="o">${esc(r.ten_khach_hang)}</div></td>
        <td><div class="o">${esc(r.ma_don_hang)}</div></td>
        <td><div class="o"><div class="ten">${esc(r.ten_ma_hang || r.ma_hang)}</div>${phu ? `<div class="phu">${esc(phu)}</div>` : ''}</div></td>
        <td class="c"><div class="o">${esc(r.kich_vai)}</div></td>
        <td class="c"><div class="o">${esc(r.kich_phim)}</div></td>
        <td class="c"><div class="o nho">${esc(r.mau_vai)}</div></td>
        <td class="r">${so(g.dinh_muc_gio)}</td>
        <td class="r b">${so(r.sl_release_phan ?? r.so_luong_release)}</td>
        <td class="c">${gio24(r.tg_bd_kh)}</td>
        <td class="c">${gio24(r.tg_kt_kh)}</td>
        <td></td><td></td><td></td><td></td>
      </tr>`;
}

function toGiay(g, k, ngayKy) {
  const dau = k * DONG_MOT_TO;
  const dong = [];
  for (let i = 0; i < DONG_MOT_TO; i += 1) dong.push(dongBang(g.dong[dau + i], dau + i + 1, g));
  return `
  <section class="to">
    <table class="dau">
      <colgroup>${COLS_DAU}</colgroup>
      <tr>
        <td class="tieu-de">LỆNH SẢN XUẤT</td>
        <td class="gt c">${ngayDMY(g.ngay_ke_hoach)}</td>
        <td class="nhan">Tổ in</td>
        <td class="gt c">${esc(g.to_in)}</td>
        <td class="nhan">Chuyền</td>
        <td class="gt c">${esc(g.ten_chuyen)}</td>
        <td class="nhan">Phụ trách</td>
        <td></td>
        <td class="nhan">Số</td>
        <td class="gt so">${esc(g.so)}</td>
        <td class="r nho">Tờ ${k + 1}/${g.so_to}</td>
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
  </section>`;
}

// `nhom` = các phần tử của `nhomTheoChuyen` cần in (1 cửa sổ in cho mọi chuyền — mở nhiều cửa sổ liên tiếp
//   thì trình duyệt chặn popup từ cửa sổ thứ 2). Trả `false` khi trình duyệt chặn cửa sổ in (bên gọi báo lỗi).
export default function printLenhSanXuat(nhom) {
  const ds = (nhom || []).filter((g) => g.dong && g.dong.length);
  if (!ds.length) return true;
  const homNay = new Date();
  const ngayKy = `Ngày ${String(homNay.getDate()).padStart(2, '0')} tháng ${String(homNay.getMonth() + 1).padStart(2, '0')} năm ${homNay.getFullYear()}`;
  const to = [];
  ds.forEach((g) => { for (let k = 0; k < g.so_to; k += 1) to.push(toGiay(g, k, ngayKy)); });
  const tieuDe = ds.length === 1 ? `${ds[0].ten_chuyen} ${ngayDMY(ds[0].ngay_ke_hoach)}` : `${ds.length} chuyền`;

  // Khổ A5 ngang (210×148mm), lề 6mm ⇒ vùng in 198×136mm. Đo bằng PDF Chrome (07/10/2026): dòng 13,5mm + ô
  //   ký 24mm ⇒ tờ cao ~127mm; dòng 15,5mm là TRÀN (ô ký rớt sang trang sau). Đang dùng dòng 14,5 + ô ký 21 ⇒
  //   ~130mm, dư ~6mm. Đổi chiều cao thì in thử lại PDF.
  // ⚠ Nội dung ô bọc `.o` (chặn cao) — chữ dài bị cắt bớt chứ không làm phình dòng (phình là cả tờ tràn sang
  //   trang sau). Tên mã hàng tối đa 2 dòng (`.ten`) để dòng "code phần · mã lệnh" luôn còn chỗ.
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
    <title>Lệnh sản xuất — ${esc(tieuDe)}</title>
    <style>
      @page { size: A5 landscape; margin: 6mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, "Helvetica Neue", sans-serif; color: #000; margin: 0; }
      .to + .to { break-before: page; page-break-before: always; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .dau td { border: none; border-bottom: 1px solid #000; padding: 1.5mm 0.8mm; font-size: 8.5pt; white-space: nowrap; overflow: hidden; }
      .dau .tieu-de { font-weight: bold; font-size: 11pt; }
      .dau .gt { font-weight: bold; }
      .dau .so { font-size: 8pt; }
      .dau .nhan { text-align: right; }
      .bang th, .bang td { border: 1px solid #000; padding: 0.6mm 0.8mm; font-size: 7.5pt; vertical-align: middle; }
      .bang th { font-weight: normal; text-align: center; font-size: 7pt; line-height: 1.15; }
      .bang tr.d td { height: 14.5mm; }
      .bang .o { max-height: 13.4mm; overflow: hidden; word-break: break-word; line-height: 1.2; }
      .bang .ten { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
      .bang .phu { margin-top: 0.4mm; font-size: 6pt; color: #333; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
      .b { font-weight: bold; }
      .c { text-align: center; }
      .r { text-align: right; }
      .nho { font-size: 6.5pt; }
      .ky { margin-top: -1px; }
      .ky td { border: 1px solid #000; height: 21mm; vertical-align: top; padding: 1mm 1.5mm; font-size: 8pt; position: relative; }
      .ky .ngay { position: absolute; left: 0; right: 0; bottom: 1mm; text-align: center; font-size: 7pt; }
    </style></head><body>
    ${to.join('')}
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };</script>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}
