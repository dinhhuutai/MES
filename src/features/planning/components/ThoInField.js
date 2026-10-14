import { Field } from '../../../components/common/controls';
import NhieuNguoiSelect from '../../../components/common/NhieuNguoiSelect';

// Ô chọn THỢ IN KẾ HOẠCH (mig 111, 07/10/2026) — giá trị = 1 chuỗi tên ngăn dấu phẩy, cùng định dạng phân công
// lúc chạy; gõ tên ngoài danh sách rồi Enter được (thợ khoán). Lưu vào lệnh (hoặc kế hoạch tạm nếu đợt chưa Ready).
// Dùng chung Release 1 + Gom đợt vải (13/10/2026) — `users` = `listUserOptions()` do trang tải.
const timNguoi = (u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`;

export default function ThoInField({ value, onChange, users, label = 'Thợ in' }) {
  return (
    <Field label={label}>
      <NhieuNguoiSelect value={value} onChange={onChange} options={users} getSearch={timNguoi}
        placeholder="Gõ tên hoặc MSNV để tìm rồi chọn / Enter..." />
    </Field>
  );
}
