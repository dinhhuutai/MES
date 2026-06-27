import { useEffect, useState } from 'react';

// Trả về thời điểm hiện tại, cập nhật mỗi `intervalMs` (mặc định 1s) — cho đếm ngược.
export default function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// Định dạng mm:ss từ số mili-giây còn lại (âm → "Đã xong").
export function fmtRemain(ms) {
  if (ms <= 0) return 'Đã xong';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
