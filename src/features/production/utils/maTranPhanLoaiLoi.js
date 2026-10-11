// ─────────────────────────────────────────────────────────────────────────────
// MA TRẬN "BÁO CÁO PLL" (11/10/2026) — hàm THUẦN dựng bảng theo khuôn tờ xưởng từ dữ liệu
// `GET /production/bao-cao-phan-loai-loi` (`chi_tiet` = từng dòng lỗi của tem · `kiem` = SL kiểm từng tem):
//   dòng = MÃ LỖI · cột = từng giá trị của CHIỀU đang xem (dây chuyền / chuyền / thợ in / khách hàng) × Sửa · Hủy
//   + khối TỔNG LỖI (Sửa · Hủy · Sửa + Hủy · % S+H) · 3 dòng cuối: Tổng lỗi · % lỗi (= lỗi ÷ SL kiểm của cột) · SL kiểm.
//   "% S+H" của 1 mã lỗi = tỷ trọng mã đó trong tổng lỗi (Σ cột = 100%); ô "% S+H" dòng Tổng lỗi = tổng lỗi ÷ SL kiểm.
// Dùng chung cho bảng trên trang lẫn file Excel ⇒ 2 nơi luôn cùng số.
// ─────────────────────────────────────────────────────────────────────────────
import { NHOM_DAY_CHUYEN, CHIEU, soTuNhien, nhanNhom } from './gomBaoCao';

// Chiều CỘT của ma trận. `co_dinh` = danh sách cột luôn hiện (kể cả cột trống) — dây chuyền theo đúng tờ xưởng.
export const CHIEU_PLL = {
  DC: { ten: 'Dây chuyền', khoa: (r) => r.nhom || 'KHAC', nhan: (k) => (k === 'BANIN' ? 'Bàn in' : nhanNhom(k)),
    co_dinh: NHOM_DAY_CHUYEN.map((n) => n.key) },
  CH: { ten: 'Chuyền', khoa: CHIEU.CH.khoa, nhan: (k) => k },
  TH: { ten: 'Thợ in', khoa: CHIEU.TH.khoa, nhan: (k) => k },
  KH: { ten: 'Khách hàng', khoa: CHIEU.KH.khoa, nhan: (k) => k },
};

const o = () => ({ sua: 0, huy: 0 });
const tyLe = (tu, mau) => (mau > 0 ? tu / mau : null);

/**
 * @param {object} p
 * @param {Array} p.chiTiet  dòng lỗi đã lọc (mỗi dòng: ma_loi, sl_sua, sl_huy + các trường chiều)
 * @param {Array} p.kiem     SL kiểm từng tem đã lọc (sl_kiem + các trường chiều)
 * @param {Array} p.maLoi    danh sách mã lỗi của báo cáo [{ ma_loi, ten_loi, gia }]
 * @param {string} p.chieu   'DC' | 'CH' | 'TH' | 'KH'
 * @param {boolean} p.anTrong chỉ giữ mã lỗi có số
 * @returns {{ cot, dong, tongCot, tong, chieu }}
 *   cot: [{ key, nhan }] · dong: [{ ma_loi, ten_loi, gia, o: {key: {sua, huy}}, sua, huy, tong, ty_trong }]
 *   tongCot: { key: { sua, huy, kiem, ty_le_sua, ty_le_huy } } · tong: { sua, huy, tong, kiem, ty_le_sua, ty_le_huy, ty_le }
 */
export function dungMaTran({ chiTiet = [], kiem = [], maLoi = [], chieu = 'DC', anTrong = false }) {
  const C = CHIEU_PLL[chieu] || CHIEU_PLL.DC;
  const tongCot = new Map();
  const cotCua = (k) => { if (!tongCot.has(k)) tongCot.set(k, { sua: 0, huy: 0, kiem: 0 }); return tongCot.get(k); };
  (C.co_dinh || []).forEach(cotCua);
  kiem.forEach((k) => { cotCua(C.khoa(k)).kiem += Number(k.sl_kiem) || 0; });

  const theoMa = new Map();
  chiTiet.forEach((c) => {
    const ma = c.ma_loi;
    if (!theoMa.has(ma)) theoMa.set(ma, { o: new Map(), sua: 0, huy: 0 });
    const d = theoMa.get(ma);
    const k = C.khoa(c);
    if (!d.o.has(k)) d.o.set(k, o());
    const sua = Number(c.sl_sua) || 0; const huy = Number(c.sl_huy) || 0;
    d.o.get(k).sua += sua; d.o.get(k).huy += huy;
    d.sua += sua; d.huy += huy;
    const t = cotCua(k); t.sua += sua; t.huy += huy;
  });

  // Cột: cố định trước (đúng thứ tự tờ xưởng), còn lại xếp theo mã tự nhiên.
  const coDinh = C.co_dinh || [];
  const khac = [...tongCot.keys()].filter((k) => !coDinh.includes(k)).sort(soTuNhien);
  const cot = [...coDinh, ...khac].map((key) => ({ key, nhan: C.nhan(key) }));

  const tongSua = [...theoMa.values()].reduce((s, d) => s + d.sua, 0);
  const tongHuy = [...theoMa.values()].reduce((s, d) => s + d.huy, 0);
  const tongKiem = [...tongCot.values()].reduce((s, t) => s + t.kiem, 0);
  const tongLoi = tongSua + tongHuy;

  // Dòng: theo danh sách mã của báo cáo (đủ cả mã không có số), mã lạ có số thì nối cuối.
  const ds = [...maLoi];
  const daCo = new Set(ds.map((m) => m.ma_loi));
  theoMa.forEach((_, ma) => { if (!daCo.has(ma)) ds.push({ ma_loi: ma, ten_loi: null, gia: false }); });
  const dong = ds.map((m) => {
    const d = theoMa.get(m.ma_loi) || { o: new Map(), sua: 0, huy: 0 };
    return {
      ma_loi: m.ma_loi, ten_loi: m.ten_loi || null, gia: !!m.gia,
      o: Object.fromEntries(cot.map((c) => [c.key, d.o.get(c.key) || o()])),
      sua: d.sua, huy: d.huy, tong: d.sua + d.huy, ty_trong: tyLe(d.sua + d.huy, tongLoi),
    };
  }).filter((d) => !anTrong || d.tong > 0);

  const tc = {};
  cot.forEach((c) => {
    const t = tongCot.get(c.key) || { sua: 0, huy: 0, kiem: 0 };
    tc[c.key] = { ...t, ty_le_sua: tyLe(t.sua, t.kiem), ty_le_huy: tyLe(t.huy, t.kiem) };
  });
  return {
    chieu, ten_chieu: C.ten, cot, dong, tongCot: tc,
    tong: {
      sua: tongSua, huy: tongHuy, tong: tongLoi, kiem: tongKiem,
      ty_le_sua: tyLe(tongSua, tongKiem), ty_le_huy: tyLe(tongHuy, tongKiem), ty_le: tyLe(tongLoi, tongKiem),
    },
  };
}
