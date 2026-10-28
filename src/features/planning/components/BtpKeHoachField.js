// ─────────────────────────────────────────────────────────────────────────────
// Ô "BTP khác KH" ở LẬP LẠI KẾ HOẠCH + SỬA KẾ HOẠCH (Danh sách release · Quản trị phần in) — 29/10/2026, người dùng:
// "tích vào thì hiện lại ở Release 1, bỏ thì mất ở Release 1". Trạng thái ban đầu = đợt của lệnh đang có ĐẦU BTP CHỜ
// (`dot_vai[].btp_cho` từ `GET /planning/replan/:id`). Bên gọi chỉ gửi `btp` khi người dùng ĐỔI (`btpGuiDi`).
// Luật thêm / bỏ đầu ở BE `utils/btpKhacKh.js` (tích = thêm 1 đầu tấm vải, như thêm 1 đợt vải mới).
// ─────────────────────────────────────────────────────────────────────────────

// Lệnh có ít nhất 1 đợt đang có đầu BTP chờ lập kế hoạch.
export const btpBanDau = (dsDot) => (dsDot || []).some((d) => d.btp_cho);
// Thân gửi đi: `{ btp }` chỉ khi khác trạng thái ban đầu.
export const btpGuiDi = (giaTri, dsDot) => (dsDot && dsDot.length && !!giaTri !== btpBanDau(dsDot) ? { btp: !!giaTri } : {});

const soDau = (d) => Math.max(1, Number(d.so_dau_btp) || (d.btp_khac_kh ? 2 : 1));

export default function BtpKeHoachField({ checked, onChange, dsDot, disabled }) {
  const banDau = btpBanDau(dsDot);
  const maxDau = Math.max(1, ...(dsDot || []).map(soDau));
  let ghi;
  if (!!checked === banDau) {
    ghi = banDau
      ? `Đang có đầu chờ lập kế hoạch ở Release 1 (BTP ${maxDau} đầu) — bỏ tích để đợt rời Release 1`
      : 'Tích = thêm 1 đầu tấm vải (như thêm 1 đợt vải mới) — đợt hiện lại ở Release 1 để lập kế hoạch đầu đó';
  } else {
    ghi = checked
      ? 'Lưu xong: thêm 1 đầu, đợt vải của lệnh HIỆN LẠI ở Release 1'
      : 'Lưu xong: bỏ đầu đang chờ, đợt vải của lệnh RỜI Release 1';
  }
  return (
    <label className="flex items-start gap-2 rounded-control border border-line px-3 py-2 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={!!checked} disabled={disabled || !(dsDot || []).length}
        onChange={(e) => onChange(e.target.checked)} />
      <span>
        <b className="text-ink">BTP khác KH</b>
        <span className={`block text-xs ${!!checked !== banDau ? 'text-primary' : 'text-ink-soft'}`}>{ghi}</span>
      </span>
    </label>
  );
}
