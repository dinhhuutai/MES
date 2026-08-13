import { useState, useEffect, useCallback } from 'react';
import Icon from './Icon';
import Spinner from './Spinner';
import ConfirmDialog from './ConfirmDialog';
import PhuongAnInBadge, { PHUONG_AN_IN } from './PhuongAnInBadge';
import { changePhuongAnIn, getHskt } from '../../services/hsktService';

// Ô ĐỔI PHƯƠNG ÁN IN ngay tại chỗ (màn READY + bảng trong modal Quét/tích).
//
// Thao tác 2 BƯỚC — cố ý, để không đổi nhầm khi bấm lướt:
//   nghỉ:        [Bàn]  ↻
//   bấm ↻:       [Robot] ✓        ← Robot mới là XEM TRƯỚC, CHƯA ghi gì xuống DB
//   bấm ✓:       gọi API → [Robot] ↻
// Muốn bỏ xem trước thì cứ bấm ↻ tiếp cho hết vòng về giá trị cũ — lúc đó ✓ tự biến mất,
// nên KHÔNG cần nút hủy riêng (chỉ 3 giá trị, xoay 1–2 nhịp là về).
//
// ⚠⚠ PHẢI gọi `PATCH /hskt/:id/phuong-an-in` (service `changePhuongAnIn`), TUYỆT ĐỐI không tự viết
// đường UPDATE khác: chỉ endpoint đó mới đặt `pa_in_sua_tay = true`, mà thiếu cờ này thì post-pass
// `applyPainTheoSanLuong` của job ERP (5 phút/lần) sẽ ĐÈ LẠI phương án in theo tổng SL vải —
// người dùng đổi xong thấy nó tự quay về sau vài phút mà không hiểu vì sao.
// Endpoint đó cũng lo luôn: tạo phiên bản HSKT mới, relink `hskt_phan_in`, ghi `lich_su_hskt`,
// và ĐỔI SỐ CUỐI `barcode_hskt` theo phương án in.

// Vòng xoay theo yêu cầu nghiệp vụ: Bàn(1) → Robot(3) → Máy(2) → Bàn…
// ⚠ KHÔNG phải 1→2→3. Đổi thứ tự này là đổi thao tác tay của kỹ thuật, đừng "sửa cho gọn".
const VONG_XOAY = [1, 3, 2];

// Gương của `backend/src/utils/hskt.js` (BARCODE_RE + applyPainToBarcode): barcode HSKT 12 chữ số,
// 11 số đầu là ĐỊNH DANH, số cuối = phương án in. Sai định dạng → GIỮ NGUYÊN mã, không bịa.
const BARCODE_PA_RE = /^\d{11}[0-3]$/;
export const maVachTheoPa = (barcode, pa) => (BARCODE_PA_RE.test(String(barcode || ''))
  ? String(barcode).slice(0, 11) + String(Number(pa))
  : null);

// Giá trị kế tiếp trong vòng xoay. Phương án in đang là 0 ("Chưa xác định") hoặc rỗng → ra Bàn.
// KHÔNG bao giờ xoay VỀ 0: backend `isValidPain = [1,2,3]`, chỉ ERP mới ghi được 0.
const keTiep = (pa) => {
  const i = VONG_XOAY.indexOf(Number(pa));
  return i < 0 ? VONG_XOAY[0] : VONG_XOAY[(i + 1) % VONG_XOAY.length];
};

const NUT = 'shrink-0 rounded-control p-1 transition-colors disabled:opacity-40';

/**
 * @param {number|string|null} value   phương án in hiện tại (r.phuong_an_in)
 * @param {string|null} hsktId         r.hskt_id — thiếu thì khóa nút (phần in chưa có HSKT active)
 * @param {string|null} barcode        r.barcode_hskt — để hiện "mã cũ → mã mới"
 * @param {boolean} disabled           không có quyền
 * @param {(msg: string, type?: string) => void} show  toast của trang (component không tự dựng Toast)
 * @param {() => void} onChanged       trang tải lại ngầm sau khi đổi
 */
export default function PhuongAnInCell({ value, hsktId, barcode, disabled = false, show, onChanged }) {
  const [thuc, setThuc] = useState(value);   // giá trị ĐÃ LƯU
  const [chon, setChon] = useState(null);    // giá trị XEM TRƯỚC (null = không có)
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // { pa, maCu, maMoi, dsPhanIn[] }

  // Cha tải lại (socket `ready:confirmed` / refresh) → nhận giá trị mới, nhưng KHÔNG đè khi người dùng
  // đang có xem trước dở dang.
  useEffect(() => { if (chon == null) setThuc(value); }, [value, chon]);

  const luu = useCallback(async (pa) => {
    setSaving(true);
    try {
      const res = await changePhuongAnIn(hsktId, pa);
      const { barcode_cu: maCu, barcode_moi: maMoi } = res.data || {};
      setThuc(pa);          // tự cập nhật: dòng trong modal là ẢNH CHỤP lúc quét, cha không làm mới nó
      setChon(null);
      setConfirm(null);
      show?.(`Đã đổi phương án in → ${PHUONG_AN_IN[pa]}`
        + (maMoi && maMoi !== maCu ? ` · mã vạch ${maCu} → ${maMoi}` : ''));
      onChanged?.();
    } catch (e) {
      // Backend ném câu tiếng Việt đầy đủ (vd BARCODE_TRUNG) → hiện nguyên văn.
      show?.(e.message || 'Đổi phương án in thất bại', 'error');
    } finally {
      setSaving(false);
    }
  }, [hsktId, show, onChanged]);

  // Bấm ✓: HSKT gắn NHIỀU phần in (gom set) thì hỏi lại + liệt kê, vì đổi 1 dòng là đổi cho cả nhóm
  // mà người bấm không nhìn thấy trên màn hình. HSKT 1 phần in → đổi luôn (⟳ rồi ✓ đã đủ xác nhận).
  const bamCheck = async () => {
    if (chon == null || !hsktId) return;
    setSaving(true);
    let dsPhanIn = [];
    try {
      const res = await getHskt(hsktId);
      dsPhanIn = (res.data?.phan_in || []).map((p) => p.ma_phan).filter(Boolean);
    } catch (e) {
      // Không tra được danh sách thì vẫn cho đổi (chỉ mất phần cảnh báo) — đây là thao tác của người dùng.
    }
    if (dsPhanIn.length > 1) {
      setSaving(false); // dừng quay: chờ người dùng đọc hộp xác nhận
      setConfirm({ pa: chon, maCu: barcode || null, maMoi: maVachTheoPa(barcode, chon), dsPhanIn });
      return;
    }
    // ⚠ KHÔNG tắt `saving` giữa 2 lời gọi — `luu` tự tắt ở `finally`. Tắt ở đây thì vòng quay
    //   nháy một nhịp giữa lúc tra HSKT xong và lúc bắt đầu lưu.
    await luu(chon);
  };

  const hienThi = chon == null ? thuc : chon;
  const coTheDoi = !disabled && !!hsktId;
  // ĐANG XEM TRƯỚC = giá trị đang hiện KHÁC giá trị đã lưu. Viền nhấn + nút ✓ dùng CHUNG cờ này,
  // nếu không thì xoay hết vòng về đúng phương án in hiện tại sẽ mất ✓ mà viền vẫn còn (trông như
  // đang có thay đổi chưa lưu, trong khi thực ra không đổi gì).
  const dangXemTruoc = chon != null && Number(chon) !== Number(thuc);

  return (
    <>
      {/* ⚠⚠ stopPropagation ở phần tử BỌC: `DataTable` chỉ tự chặn nổi bọt ở cột `selection`, cột khác
          không chặn ⇒ thiếu dòng này thì bấm ⟳ sẽ mở luôn SidePanel chi tiết phần in. */}
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Đang lưu: làm mờ nhãn để thấy rõ giá trị chưa chốt, cùng lúc nút ✓ đổi thành vòng quay. */}
        <PhuongAnInBadge value={hienThi}
          className={`${dangXemTruoc ? 'ring-1 ring-primary' : ''} ${saving ? 'opacity-60' : ''}`.trim() || undefined} />
        {coTheDoi && (
          <>
            <button
              type="button" disabled={saving} onClick={() => setChon(keTiep(hienThi))} className={`${NUT} text-ink-soft hover:bg-surface-muted hover:text-primary`}
              title={`Đổi sang ${PHUONG_AN_IN[keTiep(hienThi)]} (Bàn → Robot → Máy)`} aria-label="Đổi phương án in"
            >
              <Icon name="rotate-cw" size={14} />
            </button>
            {/* ✓ CHỈ hiện khi ĐANG XEM TRƯỚC — xoay hết vòng về giá trị cũ thì tự biến mất (cùng lúc
                với viền), nên không cần nút hủy riêng.
                Đang lưu thì đổi thành VÒNG QUAY: đổi phương án in phải gọi 2 API (tra HSKT rồi ghi),
                mất khoảng 1 nhịp — không có phản hồi thì người dùng tưởng bấm hụt và bấm lại. */}
            {dangXemTruoc && (
              <button
                type="button" disabled={saving} onClick={bamCheck}
                className={`${NUT} ${saving ? 'text-primary' : 'text-success hover:bg-success/10'}`}
                title={saving ? 'Đang đổi phương án in...'
                  : `Xác nhận đổi sang ${PHUONG_AN_IN[chon]}${maVachTheoPa(barcode, chon) ? ` · mã vạch ${barcode} → ${maVachTheoPa(barcode, chon)}` : ''}`}
                aria-label={saving ? 'Đang đổi phương án in' : 'Xác nhận đổi phương án in'} aria-busy={saving}
              >
                {saving ? <Spinner size={14} /> : <Icon name="check" size={14} />}
              </button>
            )}
          </>
        )}
      </div>

      {/* ⚠ ConfirmDialog bọc `message` trong <p> ⇒ chỉ dùng <span className="block">, không dùng <div>. */}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => luu(confirm.pa)}
        loading={saving}
        title="Đổi phương án in cho cả nhóm"
        confirmText="Đổi phương án in"
        message={!confirm ? '' : (
          <span className="block space-y-2" onClick={(e) => e.stopPropagation()}>
            <span className="block">
              Hồ sơ kỹ thuật này dùng chung cho <b className="text-ink">{confirm.dsPhanIn.length} phần in</b> —
              đổi sang <b className="text-ink">{PHUONG_AN_IN[confirm.pa]}</b> là đổi cho <b className="text-ink">tất cả</b>:
            </span>
            <span className="block text-ink">{confirm.dsPhanIn.join(' · ')}</span>
            {confirm.maMoi
              ? <span className="block">Số cuối mã vạch HSKT đổi theo: <b className="text-ink">{confirm.maCu}</b> → <b className="text-ink">{confirm.maMoi}</b>.</span>
              : <span className="block">Mã vạch HSKT giữ nguyên (không đúng định dạng 11 số + số cuối 0..3).</span>}
            <span className="block">Sau khi sửa tay, đồng bộ ERP sẽ không ghi đè phương án in này nữa.</span>
          </span>
        )}
      />
    </>
  );
}
