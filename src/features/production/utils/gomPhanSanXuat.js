// ─────────────────────────────────────────────────────────────────────────────
// GOM LỆNH "NHƯ 1 PHẦN" Ở SIDEBAR SẢN XUẤT (22/10/2026, người dùng: "3 code phần giống nhau, chung máy — hiện + in tem
// như 1 phần, gộp tổng số lượng"). 1 phần in có nhiều đợt vải ⇒ release ra nhiều lệnh; chạy chung 1 máy thì sidebar
// coi cả nhóm là 1 phần: 1 dòng, 1 số đã in / SL tổng, 1 ô số lượng in tem. Mỗi lệnh VẪN là 1 lệnh + 1 phiếu riêng ở
// backend ⇒ số in của 1 lượt được PHÂN BỔ về từng lệnh (`phanBoInTem`) — vượt ranh giới lệnh thì tách 2 tem.
//   · Khóa nhóm = phần in + chuyền của lệnh + nhà gia công (27/10/2026). Lệnh gom set cũ (nhiều phần in / 1 lệnh) đứng riêng.
//   · Hàm thuần — không gọi API, thử được độc lập.
// ─────────────────────────────────────────────────────────────────────────────
import { khoaNgc } from '../../../utils/nhaGiaCong';

const n = (v) => Number(v) || 0;
export const slRelease = (run) => n(run?.lenh?.so_luong_release);
export const daIn = (run) => n(run?.printed);
// Phần đã in là tem BTP TRƯỚC (BE `getRun.printed_btp`, 29/10/2026; BE cũ không trả ⇒ 0 = luật cũ).
export const daInBtp = (run) => n(run?.printed_btp);
// Đã in theo trần đang xét: tem BTP trước có TRẦN RIÊNG 110% SL release ⇒ tích BTP trước = cộng thêm đúng số tem đó
//   vào mức tối đa in được (gương BE `production.service kiemTranIn`).
export const daInTheoTran = (run, btp = false) => (btp ? daInBtp(run) : daIn(run) - daInBtp(run));
// Còn in được của LỆNH (trần 110% SL release, trừ đã in). Không có SL release ⇒ null (không chặn) — gương BE.
export const conDuocIn = (run, btp = false) => {
  const t = slRelease(run);
  return t > 0 ? Math.max(0, Math.floor(t * 1.1) - daInTheoTran(run, btp)) : null;
};
// Vải còn lại CHƯA in của lệnh (tới 100% SL release) — số mặc định khi trả về Kế hoạch.
export const conLai = (run) => Math.max(0, slRelease(run) - daIn(run));
const soLenh = (run) => n(String(run?.lenh?.ma_lenh_san_xuat || '').replace(/\D/g, ''));

// Khóa NGC của lệnh = các nhà gia công khác nhau của đợt (27/10/2026: đợt khác NGC không gom). BE cũ không trả ⇒ ''.
const ngcRun = (run) => [...new Set((run?.dot_vai || []).filter((d) => n(d.sl_vao_sx) > 0 || d.sl_vao_sx == null)
  .map((d) => khoaNgc(d.nha_gia_cong)))].sort().join('|');

export function gomPhan(runs) {
  const m = new Map();
  const out = [];
  (runs || []).forEach((run) => {
    const pin = !run?.co_gom_set && !run?.loi ? (run?.dot_vai || [])[0]?.phan_in_id : null;
    const k = pin ? `${pin}|${run.lenh?.chuyen_id || ''}|${ngcRun(run)}` : `lenh|${run?.lenh?.id}`;
    let g = m.get(k);
    if (!g) { g = { key: k, runs: [] }; m.set(k, g); out.push(g); }
    g.runs.push(run);
  });
  return out;
}

export const tongNhom = (runs, f) => (runs || []).reduce((s, r) => s + f(r), 0);
// Còn in được của cả nhóm; 1 lệnh không có SL release ⇒ cả nhóm không chặn (null).
export const conDuocInNhom = (runs, btp = false) => {
  const ds = (runs || []).map((r) => conDuocIn(r, btp));
  return ds.some((x) => x == null) ? null : ds.reduce((s, x) => s + x, 0);
};

// Thứ tự rót số in vào lệnh: lệnh ĐANG IN DỞ trước (in tiếp đúng lệnh đang chạy), rồi lệnh chưa in, cuối cùng lệnh đã
// đủ SL; cùng nhóm thì theo số lệnh tăng dần.
export function thuTuIn(runs) {
  const hang = (r) => (daIn(r) > 0 && daIn(r) < slRelease(r) ? 0 : daIn(r) === 0 ? 1 : 2);
  return [...(runs || [])].sort((a, b) => hang(a) - hang(b) || soLenh(a) - soLenh(b));
}

// Phân bổ Q pcs của 1 lượt in vào các lệnh (đã xếp `thuTuIn`): lượt 1 rót mỗi lệnh tới ĐỦ SL release, lượt 2 rót phần
// dư tới trần 110% từng lệnh. Trả { phan: [{run, soLuong}], du } — du > 0 = vượt trần cả nhóm (không in được).
// Lệnh không có SL release ⇒ nhận hết phần còn lại (không trần).
export function phanBoInTem(runs, Q) {
  const ds = thuTuIn(runs);
  const giao = new Map(ds.map((r) => [r, 0]));
  let con = Math.max(0, Math.trunc(n(Q)));
  const rot = (tran) => {
    for (const r of ds) {
      if (con <= 0) return;
      const t = slRelease(r);
      const cap = t > 0 ? Math.max(0, tran(t) - daIn(r) - giao.get(r)) : con;
      const lay = Math.min(cap, con);
      if (lay > 0) { giao.set(r, giao.get(r) + lay); con -= lay; }
    }
  };
  rot((t) => t);
  rot((t) => Math.floor(t * 1.1));
  return { phan: ds.filter((r) => giao.get(r) > 0).map((r) => ({ run: r, soLuong: giao.get(r) })), du: con };
}

// Thứ tự nhận vải TRẢ VỀ KẾ HOẠCH: lệnh CHƯA IN trước (trả trọn ⇒ lệnh hủy, đợt về Release 1), lệnh đang in dở sau
// (thiếu hụt giữa số nhập và số còn lại dồn vào lệnh đang in — hao hụt xảy ra trong lúc in).
export function phanBoTraVe(runs, T) {
  const ds = [...(runs || [])].sort((a, b) => (daIn(a) === 0 ? 0 : 1) - (daIn(b) === 0 ? 0 : 1) || soLenh(a) - soLenh(b));
  let con = Math.max(0, Math.trunc(n(T)));
  return ds.map((r) => {
    const lay = Math.min(conLai(r), con);
    con -= lay;
    return { run: r, soLuong: lay };
  });
}

// "Chạy hoàn tất" của 1 nhóm: tổng đã in ≥ 90% tổng SL release (gương `RunPanel minFinish` cho 1 lệnh).
export const toiThieuHoanTatNhom = (runs) => { const t = tongNhom(runs, slRelease); return t ? Math.ceil(t * 0.9) : 0; };
export const duHoanTatNhom = (runs) => tongNhom(runs, daIn) >= toiThieuHoanTatNhom(runs);
