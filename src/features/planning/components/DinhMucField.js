import { Field, Input } from '../../../components/common/controls';

// Ô ĐỊNH MỨC KẾ HOẠCH (mig 129) — số sản phẩm in được trong 1 GIỜ, người làm kế hoạch tự nhập (không bắt buộc).
//   Lưu vào lệnh (hoặc kế hoạch tạm nếu đợt chưa Ready); hiện ở In lệnh SX + Excel Danh sách release.
//   Giá trị là chuỗi chữ số ('' = chưa nhập). Dùng chung Release 1 · Kế hoạch tạm · Gom đợt vải · Lập lại kế hoạch.
export const chuanDinhMuc = (v) => {
  const s = String(v ?? '').replace(/\D/g, '');
  return s ? Number(s) : null;
};

export default function DinhMucField({ value, onChange, label = 'Định mức (SP / giờ)', placeholder = 'VD: 300' }) {
  return (
    <Field label={label}>
      <Input inputMode="numeric" value={value ?? ''} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 7))} />
    </Field>
  );
}
