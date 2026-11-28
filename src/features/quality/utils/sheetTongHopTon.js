// ─────────────────────────────────────────────────────────────────────────────
// 3 SHEET TỔNG HỢP của file Excel "phiếu chưa kiểm" (hàng tồn KCS) — đúng 3 sheet của tờ ERP "FIE HANG TÔN ERP.xlsx"
// người dùng gửi 28/11/2026: Hang Ton · CLSP · NVK. Tờ ERP là PIVOT; exceljs không dựng được pivot ⇒ dựng bằng CÔNG THỨC
// (SUMIFS về sheet dữ liệu) — người kiểm điền tay Đạt / KĐ / Thiếu / Dư / Vải hư / Mẫu / Nhân viên kiểm ở sheet dữ liệu
// thì 3 sheet tự cập nhật (pivot phải bấm Refresh).
//   · Hang Ton: Tổ in × Ngày · Ngày · Khách hàng · Loại ca (= 2 ký tự cuối mã ca) — dải trên; Tổ in × Khách hàng ·
//     Tổ in × Máy/bàn · Ca — dải dưới. Ô "Ngày" (B1, chọn từ danh sách) lọc các bảng tờ ERP có lọc Ngày (Khách hàng và
//     cả dải dưới). Số = SL IN và SL chưa kiểm (cột "Còn lại").
//   · CLSP: theo Tổ in — SL kiểm (= Đạt + KĐ như trường tính của pivot ERP), Đạt, % Đạt, KĐ, % KĐ, Thiếu, Dư, Vải hư, Mẫu.
//   · NVK: theo Nhân viên kiểm (danh sách tên TỰ LẤY từ cột Nhân viên kiểm bằng công thức — xuất ra còn trống, điền xong
//     mới hiện) + ô lọc "Tổ in" (B1).
//   · Khóa dòng (tổ / ngày / khách / máy / ca) lấy theo dữ liệu lúc xuất; số luôn là công thức.
// Hàm thuần — chỉ nhận workbook exceljs + mô tả cột của sheet dữ liệu (không import gì) ⇒ thử được độc lập bằng Node.
// ─────────────────────────────────────────────────────────────────────────────

const FONT = 'Times New Roman';
const thin = { style: 'thin', color: { argb: 'FF808080' } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const FILL_HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
const FILL_SUB = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
const FILL_TONG = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
const FILL_LOC = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
const SO = '#,##0';
const PT = '0.00%';
const TAT_CA = '(All)';
const TRONG = '(blank)';

const chuCot = (n) => { let s = ''; let x = n; while (x > 0) { const m = (x - 1) % 26; s = String.fromCharCode(65 + m) + s; x = Math.floor((x - 1) / 26); } return s; };
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const num = (v) => Number(v) || 0;
const so = (v) => (v == null || v === '' ? 0 : num(v));

// 'YYYY-MM-DD' ⇒ { d: Date UTC, f: 'DATE(y,m,d)', k } · trống ⇒ null.
const ngayKhoa = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return null;
  return { k: m[0], d: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), f: `DATE(${+m[1]},${+m[2]},${+m[3]})` };
};

/**
 * @param wb       exceljs Workbook (đã có sheet dữ liệu)
 * @param ds       các dòng đã ghi vào sheet dữ liệu, ĐÚNG THỨ TỰ (dòng i ⇒ hàng `dongDau + i`)
 * @param o.sheet  tên sheet dữ liệu · o.dongDau hàng dữ liệu đầu · o.cot { khoa: số cột 1-based } ·
 *                 o.khoa { to, ngay, kh, may, ca, nvk: (r) => giá trị ĐÚNG như đã ghi ở sheet dữ liệu }
 */
export default function themSheetTongHop(wb, ds, o) {
  const n = ds.length;
  const d1 = o.dongDau;
  const d2 = Math.max(d1, d1 + n - 1);
  const src = `'${o.sheet.replace(/'/g, "''")}'`;
  const R = (k) => `${src}!$${chuCot(o.cot[k])}$${d1}:$${chuCot(o.cot[k])}$${d2}`;
  const K = o.khoa;
  // Giá trị khóa của từng dòng (chuỗi; ngày = 'YYYY-MM-DD').
  const kv = (r, k) => { const v = K[k](r); return v == null ? '' : String(v); };
  const ngayCua = (r) => { const x = ngayKhoa(K.ngay(r)); return x ? x.k : ''; };

  // Điều kiện SUMIFS cho 1 khóa: text ⇒ "..." · ngày ⇒ DATE() · trống ⇒ "" (khớp ô trống).
  const dk = (k, v) => {
    if (k === 'ngay') { const x = ngayKhoa(v); return x ? x.f : '""'; }
    return q(v);
  };
  const tong = (rows, f) => rows.reduce((s, r) => s + f(r), 0);
  const giaTri = { sl: (r) => so(r.so_luong), con: (r) => so(r.con_kcs) };
  const COT_SO = { sl: 'slIn', con: 'con' };

  const datFont = (cell, extra = {}) => { cell.font = { name: FONT, size: 10, ...extra }; };
  const oCong = (ws, r, c, v, { kieu, dam, fill, canh } = {}) => {
    const cell = ws.getCell(r, c);
    cell.value = v;
    datFont(cell, dam ? { bold: true } : {});
    cell.border = BORDER;
    if (fill) cell.fill = fill;
    if (kieu) cell.numFmt = kieu;
    cell.alignment = { vertical: 'middle', horizontal: canh || (kieu ? 'right' : 'left') };
    return cell;
  };
  const tieuDe = (ws, r, c, ten) => oCong(ws, r, c, ten, { dam: true, fill: FILL_HEAD, canh: 'center' });
  const nhanKhoa = (k, v) => {
    if (v === '') return TRONG;
    if (k === 'ngay') return ngayKhoa(v).d;
    return v;
  };
  const kieuKhoa = (k) => (k === 'ngay' ? 'dd/mm/yyyy' : undefined);
  const uniq = (rows, k, sapXep) => {
    const s = [...new Set(rows.map((r) => (k === 'ngay' ? ngayCua(r) : kv(r, k))))];
    return sapXep ? s.sort(sapXep) : s.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'vi', { numeric: true })));
  };

  // ═══ SHEET "Hang Ton" ═══════════════════════════════════════════════════════════════════════════════════════
  const ws = wb.addWorksheet('Hang Ton');
  ws.properties.defaultRowHeight = 16;
  // Dải trên: A–D · F–H · J–L · N–P; dải dưới: A–D · G–J · O–Q (E, M để trống ngăn bảng).
  [12, 13, 11, 13, 3, 12, 11, 13, 11, 16, 11, 13, 3, 12, 12, 12, 13].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  // Ô lọc Ngày (B1) + danh sách chọn ở cột ẩn T.
  const ngays = uniq(ds, 'ngay').filter(Boolean);
  const COT_DS = 20; // T
  ws.getColumn(COT_DS).hidden = true;
  ws.getCell(1, COT_DS).value = TAT_CA;
  ngays.forEach((v, i) => { const c = ws.getCell(2 + i, COT_DS); c.value = ngayKhoa(v).d; c.numFmt = 'dd/mm/yyyy'; });
  const LOC = '$B$1';
  oCong(ws, 1, 1, 'Ngày', { dam: true });
  const oLoc = oCong(ws, 1, 2, TAT_CA, { dam: true, fill: FILL_LOC, canh: 'center', kieu: 'dd/mm/yyyy' });
  oLoc.dataValidation = { type: 'list', allowBlank: false, formulae: [`$T$1:$T$${1 + ngays.length}`] };
  ws.getCell(1, 3).value = '← chọn ngày để lọc bảng Khách hàng và các bảng phía dưới; (All) = tất cả';
  datFont(ws.getCell(1, 3), { italic: true, color: { argb: 'FF595959' } });
  const dkLoc = `IF(${LOC}="${TAT_CA}","<>§",${LOC})`;

  // SUMIFS 1 cột số theo các cặp (khóa, giá trị) (+ lọc ngày nếu `loc`).
  const fSum = (sokey, cap, loc) => {
    const dieu = cap.map(([k, v]) => `,${R(k)},${dk(k, v)}`).join('') + (loc ? `,${R('ngay')},${dkLoc}` : '');
    return `SUMIFS(${R(COT_SO[sokey])}${dieu})`;
  };
  const loc1 = (cap) => (r) => cap.every(([k, v]) => (k === 'ngay' ? ngayCua(r) : kv(r, k)) === v);

  // Bảng 1 cấp: [khóa] | SL.IN | SL. Chưa kiểm + Grand Total. Trả số hàng đã dùng.
  const bang1 = (r0, c0, k, ten, loc, { tenSo = ['SL.IN', 'SL. Chưa kiểm'] } = {}) => {
    tieuDe(ws, r0, c0, ten); tieuDe(ws, r0, c0 + 1, tenSo[0]); tieuDe(ws, r0, c0 + 2, tenSo[1]);
    let r = r0 + 1;
    uniq(ds, k).forEach((v) => {
      oCong(ws, r, c0, nhanKhoa(k, v), { kieu: kieuKhoa(k), canh: 'left' });
      ['sl', 'con'].forEach((s, j) => oCong(ws, r, c0 + 1 + j,
        { formula: fSum(s, [[k, v]], loc), result: tong(ds.filter(loc1([[k, v]])), giaTri[s]) }, { kieu: SO }));
      r += 1;
    });
    oCong(ws, r, c0, 'Grand Total', { dam: true, fill: FILL_TONG });
    ['sl', 'con'].forEach((s, j) => oCong(ws, r, c0 + 1 + j,
      { formula: loc ? `SUMIFS(${R(COT_SO[s])},${R('ngay')},${dkLoc})` : `SUM(${R(COT_SO[s])})`, result: tong(ds, giaTri[s]) },
      { kieu: SO, dam: true, fill: FILL_TONG }));
    return r - r0 + 1;
  };
  // Bảng 2 cấp: Tổ in | [khóa 2] | SL.IN | SL. Chưa kiểm — dòng "<tổ> Total" sau mỗi tổ + Grand Total.
  const bang2 = (r0, c0, k2, ten2, loc) => {
    tieuDe(ws, r0, c0, 'Tổ in'); tieuDe(ws, r0, c0 + 1, ten2); tieuDe(ws, r0, c0 + 2, 'SL.IN'); tieuDe(ws, r0, c0 + 3, 'SL. Chưa kiểm');
    let r = r0 + 1;
    uniq(ds, 'to').forEach((to) => {
      const cua = ds.filter((x) => kv(x, 'to') === to);
      uniq(cua, k2).forEach((v, i) => {
        oCong(ws, r, c0, i === 0 ? nhanKhoa('to', to) : '');
        oCong(ws, r, c0 + 1, nhanKhoa(k2, v), { kieu: kieuKhoa(k2), canh: 'left' });
        ['sl', 'con'].forEach((s, j) => oCong(ws, r, c0 + 2 + j,
          { formula: fSum(s, [['to', to], [k2, v]], loc), result: tong(cua.filter(loc1([[k2, v]])), giaTri[s]) }, { kieu: SO }));
        r += 1;
      });
      oCong(ws, r, c0, `${to === '' ? TRONG : to} Total`, { dam: true, fill: FILL_SUB });
      oCong(ws, r, c0 + 1, '', { fill: FILL_SUB });
      ['sl', 'con'].forEach((s, j) => oCong(ws, r, c0 + 2 + j,
        { formula: fSum(s, [['to', to]], loc), result: tong(cua, giaTri[s]) }, { kieu: SO, dam: true, fill: FILL_SUB }));
      r += 1;
    });
    oCong(ws, r, c0, 'Grand Total', { dam: true, fill: FILL_TONG });
    oCong(ws, r, c0 + 1, '', { fill: FILL_TONG });
    ['sl', 'con'].forEach((s, j) => oCong(ws, r, c0 + 2 + j,
      { formula: loc ? `SUMIFS(${R(COT_SO[s])},${R('ngay')},${dkLoc})` : `SUM(${R(COT_SO[s])})`, result: tong(ds, giaTri[s]) },
      { kieu: SO, dam: true, fill: FILL_TONG }));
    return r - r0 + 1;
  };
  // Loại ca = 2 ký tự cuối mã ca (D1 / D2 / HC…) — như cột phụ `RIGHT(Ca,2)` của tờ ERP. Không lọc ngày (như ERP).
  const loaiCa = (r) => kv(r, 'ca').slice(-2);
  const bangLoaiCa = (r0, c0) => {
    tieuDe(ws, r0, c0, 'Loại ca'); tieuDe(ws, r0, c0 + 1, 'SLIN'); tieuDe(ws, r0, c0 + 2, 'SL.Chưa kiểm');
    let r = r0 + 1;
    [...new Set(ds.map(loaiCa))].sort().forEach((v) => {
      oCong(ws, r, c0, v === '' ? TRONG : v);
      ['sl', 'con'].forEach((s, j) => oCong(ws, r, c0 + 1 + j,
        { formula: `SUMPRODUCT((RIGHT(${R('ca')},2)=${q(v)})*${R(COT_SO[s])})`, result: tong(ds.filter((x) => loaiCa(x) === v), giaTri[s]) },
        { kieu: SO }));
      r += 1;
    });
    oCong(ws, r, c0, 'Grand Total', { dam: true, fill: FILL_TONG });
    ['sl', 'con'].forEach((s, j) => oCong(ws, r, c0 + 1 + j,
      { formula: `SUM(${R(COT_SO[s])})`, result: tong(ds, giaTri[s]) }, { kieu: SO, dam: true, fill: FILL_TONG }));
    return r - r0 + 1;
  };

  const ghiChuBang = (r, c, s) => { const cell = ws.getCell(r, c); cell.value = s; datFont(cell, { italic: true, color: { argb: 'FF595959' } }); };
  const T = 3;
  ghiChuBang(T - 1, 10, 'Lọc theo Ngày (B1)');
  const cao = Math.max(
    bang2(T, 1, 'ngay', 'Ngày', false),
    bang1(T, 6, 'ngay', 'Ngày', false),
    bang1(T, 10, 'kh', 'Khách hàng', true),
    bangLoaiCa(T, 14),
  );
  const D = T + cao + 3;
  ['A', 'G', 'O'].forEach((c) => ghiChuBang(D - 1, ws.getColumn(c).number, 'Lọc theo Ngày (B1)'));
  bang2(D, 1, 'kh', 'Khách hàng', true);
  bang2(D, 7, 'may', 'Máy/bàn', true);
  bang1(D, 15, 'ca', 'Ca', true);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // ═══ SHEET "CLSP" — chất lượng theo Tổ in ═══════════════════════════════════════════════════════════════════
  const wc = wb.addWorksheet('CLSP');
  [12, 11, 11, 10, 11, 10, 11, 11, 11, 11].forEach((w, i) => { wc.getColumn(i + 1).width = w; });
  const COT_CL = [['dat', ' SL Đạt'], ['kd', ' SL KĐ'], ['thieu', ' SL thiếu'], ['du', ' SL Dư'], ['vh', ' SL vải hư'], ['mau', ' SL mẫu']];
  const hdr = ['Tổ in', ' SL Kiểm', ' SL Đạt', ' % Đạt', ' SL KĐ', ' % KĐ', ' SL thiếu', ' SL Dư', ' SL vải hư', ' SL mẫu'];
  const ghiChu = (w, r, s) => { const cell = w.getCell(r, 1); cell.value = s; datFont(cell, { italic: true, color: { argb: 'FF595959' } }); };
  ghiChu(wc, 1, 'SL Kiểm = Đạt + Không đạt (như tờ ERP). Số lấy từ các cột Đạt · Không đạt · Thiếu · Dư · Vải hư · Mẫu do người kiểm ghi ở sheet dữ liệu.');
  const H = 4;
  hdr.forEach((t, i) => tieuDe(wc, H, i + 1, t));
  const sumCl = (k, toV) => (toV === null ? `SUM(${R(k)})` : `SUMIFS(${R(k)},${R('to')},${dk('to', toV)})`);
  const dongCl = (r, toV, nhan, style) => {
    // C = đạt, E = KĐ ⇒ B = C + E; D = C/B; F = E/B.
    oCong(wc, r, 1, nhan, style);
    oCong(wc, r, 2, { formula: `C${r}+E${r}` }, { kieu: SO, ...style });
    oCong(wc, r, 3, { formula: sumCl('dat', toV) }, { kieu: SO, ...style });
    oCong(wc, r, 4, { formula: `IF(B${r}=0,"",C${r}/B${r})` }, { kieu: PT, ...style });
    oCong(wc, r, 5, { formula: sumCl('kd', toV) }, { kieu: SO, ...style });
    oCong(wc, r, 6, { formula: `IF(B${r}=0,"",E${r}/B${r})` }, { kieu: PT, ...style });
    COT_CL.slice(2).forEach(([k], j) => oCong(wc, r, 7 + j, { formula: sumCl(k, toV) }, { kieu: SO, ...style }));
  };
  let rc = H + 1;
  uniq(ds, 'to').forEach((to) => { dongCl(rc, to, to === '' ? TRONG : to, {}); rc += 1; });
  dongCl(rc, null, 'Grand Total', { dam: true, fill: FILL_TONG });
  wc.views = [{ state: 'frozen', ySplit: H }];

  // ═══ SHEET "NVK" — theo Nhân viên kiểm (+ lọc Tổ in ở B1) ═══════════════════════════════════════════════════
  const wn = wb.addWorksheet('NVK');
  [24, 11, 11, 11, 11, 11, 11, 11].forEach((w, i) => { wn.getColumn(i + 1).width = w; });
  const tos = uniq(ds, 'to').filter(Boolean);
  wn.getColumn(12).hidden = true; // L = danh sách chọn tổ
  wn.getCell(1, 12).value = TAT_CA;
  tos.forEach((v, i) => { wn.getCell(2 + i, 12).value = v; });
  oCong(wn, 1, 1, 'Tổ in', { dam: true });
  const locTo = oCong(wn, 1, 2, TAT_CA, { dam: true, fill: FILL_LOC, canh: 'center' });
  locTo.dataValidation = { type: 'list', allowBlank: false, formulae: [`$L$1:$L$${1 + tos.length}`] };
  const dkTo = `IF($B$1="${TAT_CA}","<>§",$B$1)`;
  ghiChu(wn, 2, 'Danh sách nhân viên tự hiện khi cột "Nhân viên kiểm" ở sheet dữ liệu có tên. SL Kiểm = Đạt + Không đạt.');
  const HN = 4;
  ['Nhân viên kiểm', ' SL Kiểm', 'SL Đạt', ' SL KĐ', ' SL thiếu', ' SL Dư', ' SL Vải hư', ' SL mẫu'].forEach((t, i) => tieuDe(wn, HN, i + 1, t));
  const COT_NV = ['dat', 'kd', 'thieu', 'du', 'vh', 'mau'];
  const nvR = R('nvk');
  // Số ô tên: đủ cho mọi dòng (tối đa 60). Tên thứ i = tên CHƯA xuất hiện ở các ô phía trên (bỏ ô trống) — dạng
  //   INDEX(MATCH(0, INDEX(COUNTIF(...),0), 0)) không cần Ctrl+Shift+Enter (chạy được Excel 2007).
  const soO = Math.min(60, Math.max(1, n));
  const dongNv = (r, tenCell, style, toanBo) => {
    const dieuTen = toanBo ? '' : `,${nvR},${tenCell}`;
    const sum = (k) => `SUMIFS(${R(k)}${dieuTen},${R('to')},${dkTo})`;
    const boc = (f) => (toanBo || tenCell === '""' ? f : `IF(${tenCell}="","",${f})`);
    oCong(wn, r, 2, { formula: boc(`${sum('dat')}+${sum('kd')}`) }, { kieu: SO, ...style });
    COT_NV.forEach((k, j) => oCong(wn, r, 3 + j, { formula: boc(sum(k)) }, { kieu: SO, ...style }));
  };
  for (let i = 0; i < soO; i += 1) {
    const r = HN + 1 + i;
    oCong(wn, r, 1, {
      formula: `IFERROR(INDEX(${nvR},MATCH(0,INDEX(COUNTIF($A$${HN}:A${r - 1},${nvR})+(${nvR}=""),0),0)),"")`,
    });
    dongNv(r, `$A${r}`, {});
  }
  const rTrong = HN + 1 + soO;
  oCong(wn, rTrong, 1, '(chưa ghi tên)', { canh: 'left' });
  dongNv(rTrong, '""', {});
  oCong(wn, rTrong + 1, 1, 'Grand Total', { dam: true, fill: FILL_TONG });
  dongNv(rTrong + 1, null, { dam: true, fill: FILL_TONG }, true);
  wn.views = [{ state: 'frozen', ySplit: HN }];
}
