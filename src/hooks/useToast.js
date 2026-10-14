import { useState, useCallback, useRef, useEffect } from 'react';

// Toast tối giản (không thêm thư viện). Trả về { toast, show }.
// ⚠ Mỗi thông báo hiện ĐỦ 3 giây: `show` hủy hẹn giờ tắt của thông báo trước rồi mới hẹn lại (13/10/2026). Bản cũ
//   không hủy ⇒ thông báo thứ hai bấm trong vòng 3 giây bị hẹn giờ cũ tắt sớm, có khi chỉ kịp nháy (vd bấm In tem
//   2 lần liên tiếp khi còn thiếu ô).
export default function useToast() {
  const [toast, setToast] = useState(null);
  const hen = useRef(null);
  const show = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (hen.current) clearTimeout(hen.current);
    hen.current = setTimeout(() => { hen.current = null; setToast(null); }, 3000);
  }, []);
  useEffect(() => () => { if (hen.current) clearTimeout(hen.current); }, []);
  return { toast, show };
}
