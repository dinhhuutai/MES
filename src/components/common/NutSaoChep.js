import { useState } from 'react';
import Icon from './Icon';

// Chép chữ vào clipboard. `navigator.clipboard` chỉ có ở HTTPS/localhost ⇒ lùi `execCommand('copy')` qua textarea ẩn
// (máy mở bằng http:// trong mạng xưởng). Trả true khi chép được.
export async function chepChu(text) {
  const s = String(text ?? '');
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(s); return true; }
  } catch { /* lùi cách cũ bên dưới */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// Nút nhỏ "chép" đặt TRONG dòng bảng: chặn nổi bọt (không mở SidePanel của dòng), chép xong đổi dấu ✓ 1,2 s.
// `layChu` = hàm trả chuỗi (tính lúc bấm). `nhan` có thì hiện chữ cạnh icon.
export default function NutSaoChep({ layChu, title = 'Sao chép', nhan, onDone, className = '' }) {
  const [xong, setXong] = useState(false);
  const bam = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await chepChu(typeof layChu === 'function' ? layChu() : layChu);
    if (ok) { setXong(true); setTimeout(() => setXong(false), 1200); }
    if (onDone) onDone(ok);
  };
  return (
    <button type="button" onClick={bam} title={title}
      className={`inline-flex items-center gap-1 rounded-control px-1 py-0.5 text-ink-soft hover:bg-surface-muted hover:text-primary ${className}`}>
      <Icon name={xong ? 'check' : 'copy'} size={13} className={xong ? 'text-success' : ''} />
      {nhan && <span className="text-[11px] font-medium">{xong ? 'Đã chép' : nhan}</span>}
    </button>
  );
}
