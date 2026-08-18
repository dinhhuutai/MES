import DateRangePicker from './DateRangePicker';
import Icon from './Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Ô tick "Chỉ hiện … bị trả về" + ô chọn NGÀY TRẢ VỀ (chỉ hiện khi đã tick).
// Dùng chung 3 màn có ô tick này: READY (Kỹ thuật) · Release 1 (Kế hoạch) · KCS.
// Luật lọc nằm ở `utils/traVeNgay.js` — component này chỉ lo phần nhìn.
//
// ⚠ Ô ngày CHỈ HIỆN KHI ĐÃ TICK: chưa tick thì đang xem toàn bộ danh sách, một ô ngày trơ ra đó
//   không lọc gì cả chỉ làm người dùng tưởng đang có bộ lọc ngày chạy ngầm.
// ⚠ MẶC ĐỊNH KHÔNG LỌC NGÀY (khoảng rỗng = mọi ngày) — đây là màn thao tác hằng ngày, lọc sẵn
//   "hôm nay" sẽ giấu mất hàng bị trả về từ hôm trước mà người dùng không biết vì sao (cùng quy
//   ước với ô ngày ở Test Run / Xác nhận chạy).
// ⚠ BỎ TICK THÌ XÓA LUÔN KHOẢNG NGÀY (`onChecked(false)` kèm `onRange` rỗng ở màn gọi): giữ lại
//   thì lần sau tick lại vẫn dính khoảng ngày cũ đang ẩn, bảng ra ít dòng không rõ lý do.
// ─────────────────────────────────────────────────────────────────────────────
export default function TraVeFilter({
  checked, onChecked, range = {}, onRange, label = 'Chỉ hiện phần bị trả về',
}) {
  const coNgay = !!(range.from || range.to);
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            const v = e.target.checked;
            onChecked(v);
            if (!v && onRange) onRange({ from: '', to: '' });
          }}
        />
        {label}
      </label>

      {checked && (
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span className="whitespace-nowrap">Ngày trả về</span>
          <div className="w-56">
            <DateRangePicker value={range} onChange={onRange} placeholder="Mọi ngày" />
          </div>
          {coNgay && (
            <button
              type="button"
              onClick={() => onRange({ from: '', to: '' })}
              className="text-ink-soft hover:text-danger"
              aria-label="Bỏ lọc ngày trả về"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
