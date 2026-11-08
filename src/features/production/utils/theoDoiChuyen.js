// ─────────────────────────────────────────────────────────────────────────────
// BẢNG "CHUYỀN ĐANG CHẠY" (08/11/2026, người dùng: "ít thông tin nhưng nhìn nhanh vào là biết chuyền đang chạy phần in
// nào, đã sản xuất bao nhiêu, tiến độ ra sao, theo tiến độ thì khi nào xong, số lượng kế hoạch và thực tế, kế hoạch
// tiếp theo là mã phần in nào") — hàm THUẦN gom dữ liệu `GET /production/monitor` thành 1 thẻ / CHUYỀN.
//
// Luật số:
//   · 1 chuyền có thể chạy NHIỀU phiếu cùng lúc (set in chung) ⇒ KH = Σ SL release, TT = Σ đã in (tem chưa hủy) của
//     mọi phiếu đang chạy trên chuyền (chuyền THỰC TẾ của phiếu).
//   · TỐC ĐỘ (pcs/giờ) = Σ đã in ÷ số giờ in dài nhất trong các phiếu. Giờ in của 1 phiếu = Σ khoảng giờ SX nhập ở ô In
//     tem (`phut_in`, cùng cột "Phút" của Excel Đang sản xuất); chưa tem nào có giờ ⇒ từ lúc Xác nhận chạy tới giờ, trừ
//     phút ngừng. Lấy giờ DÀI NHẤT (không cộng) vì các phiếu chạy song song trên cùng 1 chuyền — cộng là tính 2 lần.
//   · DỰ KIẾN XONG = bây giờ + phần còn lại ÷ tốc độ (đủ KH ⇒ "Đủ SL"; chưa in gì ⇒ chưa ước tính được).
//   · So với GIỜ KẾT THÚC KẾ HOẠCH (muộn nhất trong các lệnh; KT < BĐ ⇒ qua đêm, +1 ngày): xong trước / đúng giờ ⇒ "đúng
//     tiến độ", xong sau ⇒ "trễ N phút".
//   · KẾ HOẠCH TIẾP THEO = lệnh chờ chạy (RELEASE_2) đầu tiên trên CHUYỀN KẾ HOẠCH trùng mã chuyền (BE xếp theo ngày SX
//     KH → giờ BĐ KH → lúc tạo).
// ─────────────────────────────────────────────────────────────────────────────

const so = (v) => Number(v) || 0;
const ms = (t) => (t ? new Date(t).getTime() : NaN);

// Giờ KT kế hoạch thật của 1 lệnh (KT < BĐ ⇒ qua nửa đêm, cộng 1 ngày — cùng luật `KT_QUA_DEM` lúc ghi).
export function gioKtKeHoach(l) {
  const kt = ms(l.tg_kt_kh);
  if (!Number.isFinite(kt)) return null;
  const bd = ms(l.tg_bd_kh);
  return Number.isFinite(bd) && kt < bd ? kt + 86400000 : kt;
}

// Giờ in (giờ đồng hồ) của 1 phiếu: giờ SX nhập ở tem, không có ⇒ từ lúc chạy tới giờ trừ ngừng.
export function gioInPhieu(r, nowMs) {
  const phut = so(r.phut_in);
  if (phut > 0) return phut / 60;
  const bd = ms(r.tg_bd);
  if (!Number.isFinite(bd)) return 0;
  return Math.max(0, (nowMs - bd) / 60000 - so(r.ngung_phut)) / 60;
}

const docMa = (r) => r.ma_phan || (r.phan_list || '').split(',')[0] || '';

/**
 * @param {Array} running  `monitor.running` (1 dòng / phiếu đang chạy)
 * @param {Array} queue    `monitor.queue` (lệnh chờ chạy, đã xếp theo kế hoạch)
 * @param {number} nowMs
 * @returns {Array} 1 thẻ / chuyền, xếp theo mã chuyền
 */
export function gomTheoChuyen(running = [], queue = [], nowMs = Date.now()) {
  const theo = new Map();
  for (const r of running || []) {
    const k = r.chuyen_id || r.ma_chuyen;
    if (!theo.has(k)) {
      theo.set(k, {
        key: String(k), chuyen_id: r.chuyen_id, ma_chuyen: r.ma_chuyen, ten_chuyen: r.ten_chuyen,
        ma_loai_chuyen: r.ma_loai_chuyen, ten_loai_chuyen: r.ten_loai_chuyen, phieu: [],
      });
    }
    theo.get(k).phieu.push(r);
  }
  const ds = [...theo.values()].map((c) => {
    const kh = c.phieu.reduce((s, r) => s + so(r.target), 0);
    const tt = c.phieu.reduce((s, r) => s + so(r.printed), 0);
    const gio = Math.max(0, ...c.phieu.map((r) => gioInPhieu(r, nowMs)));
    const tocDo = gio > 0 && tt > 0 ? tt / gio : 0;
    const conLai = Math.max(0, kh - tt);
    const xongMs = conLai <= 0 ? nowMs : (tocDo > 0 ? nowMs + (conLai / tocDo) * 3600000 : null);
    const ktKh = c.phieu.map(gioKtKeHoach).filter((x) => x != null);
    const khXongMs = ktKh.length ? Math.max(...ktKh) : null;
    const trePhut = xongMs != null && khXongMs != null ? Math.round((xongMs - khXongMs) / 60000) : null;
    // Phần in đang chạy (khác nhau) — dòng gom set mang `phan_list`.
    const phan = [];
    c.phieu.forEach((r) => {
      const ma = docMa(r);
      if (ma && !phan.some((p) => p.ma_phan === ma)) {
        phan.push({ ma_phan: ma, ma_hang: r.ma_hang, mau_vai: r.mau_vai, ten_khach_hang: r.ten_khach_hang, kh: so(r.target), tt: so(r.printed) });
      } else if (ma) {
        const p = phan.find((x) => x.ma_phan === ma); p.kh += so(r.target); p.tt += so(r.printed);
      }
    });
    const tiep = (queue || []).filter((q) => q.ma_chuyen === c.ma_chuyen);
    return {
      ...c,
      kh, tt, con_lai: conLai,
      pt: kh > 0 ? Math.min(999, (tt / kh) * 100) : null,
      toc_do: Math.round(tocDo),
      xong_ms: xongMs,
      kh_xong_ms: khXongMs,
      tre_phut: trePhut,
      dang_ngung: c.phieu.some((r) => r.dang_ngung),
      phan,
      tiep_theo: tiep[0] || null,
      so_cho: tiep.length,
    };
  });
  return ds.sort((a, b) => String(a.ma_chuyen).localeCompare(String(b.ma_chuyen), 'vi', { numeric: true }));
}
