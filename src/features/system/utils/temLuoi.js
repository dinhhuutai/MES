// ─────────────────────────────────────────────────────────────────────────────
// THAO TÁC TRÊN LƯỚI TEM — thêm/xóa hàng·cột · gộp · tách ô.
// Toàn bộ hàm ở đây là THUẦN (pure): nhận khung cũ, trả khung MỚI — không sửa tại chỗ, để React
// nhận ra thay đổi và để nút Hoàn tác về sau chỉ cần giữ lại các bản khung cũ.
// ─────────────────────────────────────────────────────────────────────────────

export const khoaO = (r, c) => `${r},${c}`;
export const tachKhoa = (k) => k.split(',').map(Number);

const sao = (khung) => JSON.parse(JSON.stringify(khung));

// Ô nào bị GỘP che (không kể chính ô gốc).
export function biChe(khung) {
  const che = new Set();
  for (const [k, cell] of Object.entries(khung.o || {})) {
    const [r, c] = tachKhoa(k);
    const cs = Math.max(1, Number(cell.cs) || 1);
    const rs = Math.max(1, Number(cell.rs) || 1);
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
    const cs = Math.max(1, Number(cell.cs) || 1);
    const rs = Math.max(1, Number(cell.rs) || 1);
    if (r >= rr && r < rr + rs && c >= cc && c < cc + cs) return k;
  }
  return khoaO(r, c);
}

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
  const k = sao(khung);
  const i = Math.max(0, Math.min(tai, k.hang.length));
  k.hang.splice(i, 0, { cao_mm: 3.4 });
  // Ô đang GỘP DỌC qua chỗ chèn thì nới rowspan để lưới không thủng.
  for (const [key, cell] of Object.entries(k.o)) {
    const [r] = tachKhoa(key);
    const rs = Math.max(1, Number(cell.rs) || 1);
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
    const rs = Math.max(1, Number(cell.rs) || 1);
    if (r < i && r + rs > i) cell.rs = rs - 1; // ô gộp dọc qua hàng bị xóa → co lại
  }
  k.o = doiKhoa(k, (r) => (r === i ? null : (r > i ? r - 1 : r)), (c) => c);
  return k;
}

export function themCot(khung, tai) {
  if (khung.so_cot >= 24) return khung;
  const k = sao(khung);
  const i = Math.max(0, Math.min(tai, k.so_cot));
  k.so_cot += 1;
  k.cot = Array.isArray(k.cot) ? k.cot : [];
  k.cot.splice(i, 0, { rong_mm: null });
  for (const [key, cell] of Object.entries(k.o)) {
    const [, c] = tachKhoa(key);
    const cs = Math.max(1, Number(cell.cs) || 1);
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
    const cs = Math.max(1, Number(cell.cs) || 1);
    if (c < i && c + cs > i) cell.cs = cs - 1;
  }
  k.o = doiKhoa(k, (r) => r, (c) => (c === i ? null : (c > i ? c - 1 : c)));
  return k;
}

// GỘP từ ô `tu` sang `den` (2 khóa bất kỳ — tự tính hình chữ nhật bao). Nội dung giữ của ô TRÊN-TRÁI,
// các ô bên trong bị xóa (mất nội dung — đúng như Excel, và người dùng thấy trước qua vùng bôi xanh).
export function gopO(khung, tu, den) {
  const [r1, c1] = tachKhoa(tu); const [r2, c2] = tachKhoa(den);
  const rt = Math.min(r1, r2); const rd = Math.max(r1, r2);
  const ct = Math.min(c1, c2); const cd = Math.max(c1, c2);
  if (rt === rd && ct === cd) return khung;
  const k = sao(khung);
  const goc = k.o[khoaO(rt, ct)] || {};
  for (let r = rt; r <= rd; r += 1) for (let c = ct; c <= cd; c += 1) delete k.o[khoaO(r, c)];
  k.o[khoaO(rt, ct)] = { ...goc, cs: cd - ct + 1, rs: rd - rt + 1 };
  return k;
}

// TÁCH ô đang gộp về các ô 1×1 (nội dung ở lại ô trên-trái).
export function tachO(khung, khoa) {
  const k = sao(khung);
  const cell = k.o[khoa];
  if (!cell) return khung;
  const cs = Math.max(1, Number(cell.cs) || 1);
  const rs = Math.max(1, Number(cell.rs) || 1);
  if (cs === 1 && rs === 1) return khung;
  const { cs: _a, rs: _b, ...con } = cell;
  k.o[khoa] = con;
  return k;
}

// Sửa thuộc tính 1 ô (gộp nông — `vien` gộp riêng vì là object con).
export function datO(khung, khoa, thayDoi) {
  const k = sao(khung);
  const cu = k.o[khoa] || {};
  const moi = { ...cu, ...thayDoi };
  if (thayDoi.vien) moi.vien = { ...(cu.vien || {}), ...thayDoi.vien };
  k.o[khoa] = moi;
  return k;
}

// Khung rỗng n hàng × m cột — dùng cho "Tạo mẫu mới".
export function khungRong(soHang = 12, soCot = 20) {
  return {
    so_cot: soCot,
    hang: Array.from({ length: soHang }, () => ({ cao_mm: null })),
    cot: Array.from({ length: soCot }, () => ({ rong_mm: null })),
    o: {},
  };
}
