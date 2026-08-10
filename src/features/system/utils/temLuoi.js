// ─────────────────────────────────────────────────────────────────────────────
// THAO TÁC TRÊN LƯỚI TEM — thêm/xóa hàng·cột · gộp · tách ô · định dạng theo VÙNG CHỌN.
// Toàn bộ hàm ở đây là THUẦN (pure): nhận khung cũ, trả khung MỚI — không sửa tại chỗ, để React
// nhận ra thay đổi và để nút Hoàn tác chỉ cần giữ lại các bản khung cũ.
//
// ⚠ Trần lưới phải KHỚP `kiemBoCuc` ở backend/src/utils/mauTem.js (1–24 cột, 1–60 hàng) — vượt trần
//   thì BE chặn lúc LƯU, người dùng mất công thiết kế rồi mới biết.
// ─────────────────────────────────────────────────────────────────────────────

export const SO_COT_MAX = 24;
export const SO_HANG_MAX = 60;

// Vùng nội dung thật của 1 tem (mm) — khớp KHO_TEM (backend) và KHO (renderMauTem.js).
export const RONG_MM = 49;
export const CAO_MM = 78;

export const khoaO = (r, c) => `${r},${c}`;
export const tachKhoa = (k) => k.split(',').map(Number);

const sao = (khung) => JSON.parse(JSON.stringify(khung));
const spanO = (cell) => [Math.max(1, Number(cell?.rs) || 1), Math.max(1, Number(cell?.cs) || 1)];

// Ô nào bị GỘP che (không kể chính ô gốc).
export function biChe(khung) {
  const che = new Set();
  for (const [k, cell] of Object.entries(khung.o || {})) {
    const [r, c] = tachKhoa(k);
    const [rs, cs] = spanO(cell);
    for (let i = r; i < r + rs; i += 1) {
      for (let j = c; j < c + cs; j += 1) if (!(i === r && j === c)) che.add(khoaO(i, j));
    }
  }
  return che;
}

// Ô GỐC đang phủ lên (r,c) — dùng khi bấm vào vùng bị gộp.
export function oGoc(khung, r, c) {
  for (const [k, cell] of Object.entries(khung.o || {})) {
    const [rr, cc] = tachKhoa(k);
    const [rs, cs] = spanO(cell);
    if (r >= rr && r < rr + rs && c >= cc && c < cc + cs) return k;
  }
  return khoaO(r, c);
}

// ─────────────────────────────────────────────────────────────────────────────
// VÙNG CHỌN (kéo chọn nhiều ô kiểu Excel) — { r1, c1, r2, c2 } đã chuẩn hóa.
// ─────────────────────────────────────────────────────────────────────────────

export const chuanVung = (a, b) => ({
  r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c),
  r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c),
});

// Nới vùng ra cho PHỦ TRỌN mọi ô gộp mà nó chạm vào (đúng hành vi Excel: kéo trúng nửa ô gộp thì
// cả ô gộp được chọn). Lặp tới khi ổn định vì nới ra có thể chạm thêm ô gộp khác.
export function moRongVung(khung, vung) {
  let { r1, c1, r2, c2 } = vung;
  const oList = Object.entries(khung.o || {});
  for (let lap = 0; lap < 12; lap += 1) {
    let doi = false;
    for (const [k, cell] of oList) {
      const [r, c] = tachKhoa(k);
      const [rs, cs] = spanO(cell);
      const gr2 = r + rs - 1; const gc2 = c + cs - 1;
      const giao = r <= r2 && gr2 >= r1 && c <= c2 && gc2 >= c1;
      if (!giao) continue;
      if (r < r1) { r1 = r; doi = true; }
      if (c < c1) { c1 = c; doi = true; }
      if (gr2 > r2) { r2 = gr2; doi = true; }
      if (gc2 > c2) { c2 = gc2; doi = true; }
    }
    if (!doi) break;
  }
  return { r1, c1, r2, c2 };
}

// Danh sách khóa Ô GỐC nằm trong vùng (bỏ ô bị gộp che). Vùng phải đã qua `moRongVung`.
export function oTrongVung(khung, vung) {
  const che = biChe(khung);
  const out = [];
  for (let r = vung.r1; r <= vung.r2; r += 1) {
    for (let c = vung.c1; c <= vung.c2; c += 1) {
      const k = khoaO(r, c);
      if (!che.has(k)) out.push(k);
    }
  }
  return out;
}

export const soONhieu = (vung) => (vung ? (vung.r2 - vung.r1 + 1) * (vung.c2 - vung.c1 + 1) : 0);

// Mọi ô trong vùng đều thỏa `dk` → dùng cho nút bật/tắt (đậm, nghiêng…): đang bật hết thì bấm là tắt.
export const moiODeu = (khung, khoas, dk) => khoas.length > 0 && khoas.every((k) => dk(khung.o[k] || {}));

// ─────────────────────────────────────────────────────────────────────────────
// HÀNG / CỘT
// ─────────────────────────────────────────────────────────────────────────────

// Dời khóa ô khi chèn/xóa hàng hoặc cột.
function doiKhoa(khung, doiR, doiC) {
  const o = {};
  for (const [k, cell] of Object.entries(khung.o || {})) {
    const [r, c] = tachKhoa(k);
    const nr = doiR(r); const nc = doiC(c);
    if (nr == null || nc == null) continue; // ô nằm trên hàng/cột vừa xóa → bỏ
    o[khoaO(nr, nc)] = cell;
  }
  return o;
}

export function themHang(khung, tai) {
  if (khung.hang.length >= SO_HANG_MAX) return khung;
  const k = sao(khung);
  const i = Math.max(0, Math.min(tai, k.hang.length));
  k.hang.splice(i, 0, { cao_mm: null });
  // Ô đang GỘP DỌC qua chỗ chèn thì nới rowspan để lưới không thủng.
  for (const [key, cell] of Object.entries(k.o)) {
    const [r] = tachKhoa(key);
    const [rs] = spanO(cell);
    if (r < i && r + rs > i) cell.rs = rs + 1;
  }
  k.o = doiKhoa(k, (r) => (r >= i ? r + 1 : r), (c) => c);
  return k;
}

export function xoaHang(khung, i) {
  if (khung.hang.length <= 1) return khung; // luôn còn ít nhất 1 hàng
  const k = sao(khung);
  k.hang.splice(i, 1);
  for (const [key, cell] of Object.entries(k.o)) {
    const [r] = tachKhoa(key);
    const [rs] = spanO(cell);
    if (r < i && r + rs > i) cell.rs = rs - 1; // ô gộp dọc qua hàng bị xóa → co lại
  }
  k.o = doiKhoa(k, (r) => (r === i ? null : (r > i ? r - 1 : r)), (c) => c);
  return k;
}

export function themCot(khung, tai) {
  if (khung.so_cot >= SO_COT_MAX) return khung;
  const k = sao(khung);
  const i = Math.max(0, Math.min(tai, k.so_cot));
  k.so_cot += 1;
  k.cot = Array.isArray(k.cot) ? k.cot : [];
  k.cot.splice(i, 0, { rong_mm: null });
  for (const [key, cell] of Object.entries(k.o)) {
    const [, c] = tachKhoa(key);
    const [, cs] = spanO(cell);
    if (c < i && c + cs > i) cell.cs = cs + 1;
  }
  k.o = doiKhoa(k, (r) => r, (c) => (c >= i ? c + 1 : c));
  return k;
}

export function xoaCot(khung, i) {
  if (khung.so_cot <= 1) return khung;
  const k = sao(khung);
  k.so_cot -= 1;
  if (Array.isArray(k.cot)) k.cot.splice(i, 1);
  for (const [key, cell] of Object.entries(k.o)) {
    const [, c] = tachKhoa(key);
    const [, cs] = spanO(cell);
    if (c < i && c + cs > i) cell.cs = cs - 1;
  }
  k.o = doiKhoa(k, (r) => r, (c) => (c === i ? null : (c > i ? c - 1 : c)));
  return k;
}

// Chèn/xóa THEO VÙNG — chèn đúng bằng số hàng/cột đang chọn (Excel làm vậy).
export function themHangNhieu(khung, tai, n = 1) {
  let k = khung;
  for (let i = 0; i < n; i += 1) k = themHang(k, tai);
  return k;
}
export function themCotNhieu(khung, tai, n = 1) {
  let k = khung;
  for (let i = 0; i < n; i += 1) k = themCot(k, tai);
  return k;
}
// Xóa từ DƯỚI lên / PHẢI sang để chỉ số các hàng-cột chưa xóa không bị dời.
export function xoaHangVung(khung, r1, r2) {
  let k = khung;
  for (let r = r2; r >= r1; r -= 1) k = xoaHang(k, r);
  return k;
}
export function xoaCotVung(khung, c1, c2) {
  let k = khung;
  for (let c = c2; c >= c1; c -= 1) k = xoaCot(k, c);
  return k;
}

// Tổng bề rộng/chiều cao ĐÃ ĐẶT CỨNG (mm) — để cảnh báo tràn khổ tem và để kẹp lúc kéo mép.
export const tongRongCung = (khung, boCot = -1) => (khung.cot || [])
  .reduce((s, c, i) => s + (i === boCot ? 0 : (Number(c?.rong_mm) || 0)), 0);
export const tongCaoCung = (khung, boHang = -1) => (khung.hang || [])
  .reduce((s, h, i) => s + (i === boHang ? 0 : (Number(h?.cao_mm) || 0)), 0);
export const soCotTuDo = (khung, boCot = -1) => (khung.cot || [])
  .filter((c, i) => i !== boCot && !Number(c?.rong_mm)).length;
export const soHangTuDo = (khung, boHang = -1) => (khung.hang || [])
  .filter((h, i) => i !== boHang && !Number(h?.cao_mm)).length;

// Đặt bề rộng cột (mm; null = chia đều). Tự KẸP để tổng không tràn 49mm — cột tự do còn lại phải
// chừa tối thiểu 0.5mm mỗi cột, nếu không bản in sẽ đùn chữ ra ngoài tem mà màn hình vẫn trông ổn.
export function datRongCot(khung, i, mm) {
  const k = sao(khung);
  k.cot = Array.isArray(k.cot) ? k.cot : [];
  while (k.cot.length < k.so_cot) k.cot.push({ rong_mm: null });
  if (mm == null) { k.cot[i] = { ...(k.cot[i] || {}), rong_mm: null }; return k; }
  const conLai = RONG_MM - tongRongCung(k, i) - 0.5 * soCotTuDo(k, i);
  k.cot[i] = { ...(k.cot[i] || {}), rong_mm: Math.max(1, Math.min(Number(mm), Math.max(1, conLai))) };
  return k;
}

export function datCaoHang(khung, i, mm) {
  const k = sao(khung);
  if (mm == null) { k.hang[i] = { ...(k.hang[i] || {}), cao_mm: null }; return k; }
  const conLai = CAO_MM - tongCaoCung(k, i) - 1 * soHangTuDo(k, i);
  k.hang[i] = { ...(k.hang[i] || {}), cao_mm: Math.max(1, Math.min(Number(mm), Math.max(1, conLai))) };
  return k;
}

// ─────────────────────────────────────────────────────────────────────────────
// GỘP / TÁCH
// ─────────────────────────────────────────────────────────────────────────────

// GỘP cả VÙNG thành 1 ô. Nội dung giữ của ô TRÊN-TRÁI, các ô bên trong bị xóa (như Excel — người
// dùng đã thấy trước vùng bôi xanh nên không bất ngờ).
export function gopVung(khung, vung) {
  const { r1, c1, r2, c2 } = vung;
  if (r1 === r2 && c1 === c2) return khung;
  const k = sao(khung);
  const goc = k.o[khoaO(r1, c1)] || {};
  for (let r = r1; r <= r2; r += 1) for (let c = c1; c <= c2; c += 1) delete k.o[khoaO(r, c)];
  k.o[khoaO(r1, c1)] = { ...goc, cs: c2 - c1 + 1, rs: r2 - r1 + 1 };
  return k;
}

// TÁCH mọi ô đang gộp trong vùng về các ô 1×1 (nội dung ở lại ô trên-trái của từng ô gộp).
export function tachVung(khung, vung) {
  const k = sao(khung);
  let doi = false;
  for (const kh of oTrongVung(khung, vung)) {
    const cell = k.o[kh];
    if (!cell) continue;
    const [rs, cs] = spanO(cell);
    if (rs === 1 && cs === 1) continue;
    const { cs: _a, rs: _b, ...con } = cell;
    k.o[kh] = con; doi = true;
  }
  return doi ? k : khung;
}

// ─────────────────────────────────────────────────────────────────────────────
// ĐỊNH DẠNG
// ─────────────────────────────────────────────────────────────────────────────

// Sửa thuộc tính 1 ô (gộp nông — `vien` gộp riêng vì là object con).
export function datO(khung, khoa, thayDoi) {
  const k = sao(khung);
  const cu = k.o[khoa] || {};
  const moi = { ...cu, ...thayDoi };
  if (thayDoi.vien) moi.vien = { ...(cu.vien || {}), ...thayDoi.vien };
  k.o[khoa] = moi;
  return k;
}

// Áp CÙNG một thay đổi cho NHIỀU ô (vùng chọn). Ô chưa có trong `o` sẽ được tạo — đúng ý người dùng
// ("tô đậm cả vùng" thì ô trống cũng phải nhớ là đậm để gõ vào là đậm).
export function datONhieu(khung, khoas, thayDoi) {
  const k = sao(khung);
  for (const kh of khoas) {
    const cu = k.o[kh] || {};
    const moi = { ...cu, ...thayDoi };
    if (thayDoi.vien) moi.vien = { ...(cu.vien || {}), ...thayDoi.vien };
    k.o[kh] = moi;
  }
  return k;
}

// Kẻ viền theo VÙNG. `kieu`: tat_ca | ngoai | trong | khong.
// Ô gộp tính mép theo span của chính nó (ô 2×3 nằm sát mép trái vùng thì cạnh trái của nó là mép ngoài).
export function datVienVung(khung, vung, kieu) {
  const k = sao(khung);
  for (const kh of oTrongVung(khung, vung)) {
    const [r, c] = tachKhoa(kh);
    const [rs, cs] = spanO(k.o[kh]);
    const mepTren = r === vung.r1;
    const mepDuoi = r + rs - 1 === vung.r2;
    const mepTrai = c === vung.c1;
    const mepPhai = c + cs - 1 === vung.c2;
    const cu = k.o[kh] || {};
    const v = { ...(cu.vien || {}) };
    if (kieu === 'tat_ca') { v.tren = true; v.duoi = true; v.trai = true; v.phai = true; }
    else if (kieu === 'khong') { v.tren = false; v.duoi = false; v.trai = false; v.phai = false; }
    else if (kieu === 'ngoai') {
      v.tren = mepTren; v.duoi = mepDuoi; v.trai = mepTrai; v.phai = mepPhai;
    } else if (kieu === 'trong') {
      // Chỉ đụng các cạnh BÊN TRONG, giữ nguyên cạnh ngoài của vùng.
      if (!mepTren) v.tren = true;
      if (!mepDuoi) v.duoi = true;
      if (!mepTrai) v.trai = true;
      if (!mepPhai) v.phai = true;
    }
    k.o[kh] = { ...cu, vien: v };
  }
  return k;
}

// Xóa NỘI DUNG (giữ định dạng) — phím Delete.
export function xoaNoiDungO(khung, khoas) {
  const k = sao(khung);
  for (const kh of khoas) if (k.o[kh]) k.o[kh] = { ...k.o[kh], phan: [] };
  return k;
}

// Các khóa thuộc về ĐỊNH DẠNG (xóa định dạng = bỏ hết những khóa này, giữ nội dung + gộp + kiểu ô).
const KHOA_DINH_DANG = [
  'dam', 'nghieng', 'gach_chan', 'co_chu_mm', 'tu_co', 'ngang', 'doc',
  'nen', 'mau_chu', 'xuong_dong', 'vien', 'xoay', 'gian_chu_mm',
];

export function xoaDinhDangO(khung, khoas) {
  const k = sao(khung);
  for (const kh of khoas) {
    const cu = k.o[kh];
    if (!cu) continue;
    const moi = { ...cu };
    KHOA_DINH_DANG.forEach((p) => delete moi[p]);
    k.o[kh] = moi;
  }
  return k;
}

// Chép định dạng của 1 ô (cho "chổi quét định dạng").
export function layDinhDang(o = {}) {
  const out = {};
  KHOA_DINH_DANG.forEach((p) => { if (o[p] !== undefined) out[p] = o[p]; });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// KHUNG RỖNG (mẫu mới)
// ⚠ MẶC ĐỊNH Ô RỘNG–THẤP: **24 hàng × 5 cột** trên vùng 49×78mm ⇒ mỗi ô **~9.8mm rộng × 3.25mm cao**
//   (tỉ lệ 3:1 — người dùng chốt 08/08/2026). Bản đầu là 20 cột × 12 hàng ⇒ ô 2.45×6.5mm, cao nhòng,
//   nhìn không ra bảng tính và gõ chữ vào là tràn. Cỡ chữ mặc định 2.2mm nên hàng 3.25mm vừa 1 dòng.
// ─────────────────────────────────────────────────────────────────────────────
export const HANG_MAC_DINH = 24;
export const COT_MAC_DINH = 5;

export function khungRong(soHang = HANG_MAC_DINH, soCot = COT_MAC_DINH) {
  return {
    so_cot: soCot,
    hang: Array.from({ length: soHang }, () => ({ cao_mm: null })),
    cot: Array.from({ length: soCot }, () => ({ rong_mm: null })),
    o: {},
  };
}

// CHIA LẠI LƯỚI — đổi số hàng × số cột của khung ĐANG CÓ.
// Giữ lại tối đa những gì còn nằm trong lưới mới (nội dung + định dạng + kích thước hàng/cột);
// ô nằm ngoài thì bỏ, ô GỘP tràn ra ngoài thì CO LẠI cho vừa (không để lại cs/rs mồ côi — bố cục
// tràn lưới sẽ bị `kiemBoCuc` của backend chặn lúc lưu).
export function chiaLaiLuoi(khung, soHang, soCot) {
  const h = Math.max(1, Math.min(Number(soHang) || 1, SO_HANG_MAX));
  const c = Math.max(1, Math.min(Number(soCot) || 1, SO_COT_MAX));
  const cu = khung || khungRong(h, c);
  const hangCu = Array.isArray(cu.hang) ? cu.hang : [];
  const cotCu = Array.isArray(cu.cot) ? cu.cot : [];
  const o = {};
  for (const [k, cell] of Object.entries(cu.o || {})) {
    const [r, cc] = tachKhoa(k);
    if (r >= h || cc >= c) continue;
    const [rs, cs] = spanO(cell);
    const moi = { ...cell };
    const rsMoi = Math.min(rs, h - r);
    const csMoi = Math.min(cs, c - cc);
    if (rsMoi > 1) moi.rs = rsMoi; else delete moi.rs;
    if (csMoi > 1) moi.cs = csMoi; else delete moi.cs;
    o[k] = moi;
  }
  return {
    so_cot: c,
    hang: Array.from({ length: h }, (_, i) => ({ cao_mm: hangCu[i]?.cao_mm ?? null })),
    cot: Array.from({ length: c }, (_, i) => ({ rong_mm: cotCu[i]?.rong_mm ?? null })),
    o,
  };
}
