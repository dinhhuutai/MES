// ─────────────────────────────────────────────────────────────────────────────
// NHẬN FILE BH — màn Chuẩn bị kỹ thuật — READY (11/11/2026, người dùng chốt).
//   Bán hàng mang hồ sơ CỨNG sang ⇒ KT CHUỘT PHẢI dòng ⇒ "Đưa vào danh sách đã nhận file" (dòng đã nhận ⇒ "Hủy khỏi danh sách
//   đã nhận"). Đang tích nhiều dòng mà chuột phải vào 1 dòng trong số đó ⇒ áp cho mọi dòng đang tích. Dòng đã nhận VẪN ở
//   bảng chính — STT khoanh tròn (`SttNhanFile`); nút "Đã nhận file (N)" mở `NhanFileModal`.
//   Đánh dấu THEO ĐỢT VẢI của dòng (`dot_vai_ids`); BE `technical/nhanFileBh.js`, trạng thái ở `row.nhan_file`.
// ⚠ Component khai ở MỨC MODULE (luật §9).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import DataTable from '../../../components/common/DataTable';
import { Input } from '../../../components/common/controls';
import { fmtDateTime } from '../../../utils/format';
import { khopTungTu } from '../../../utils/timKiem';

// Dòng ĐÃ nhận file = MỌI đợt của dòng đã nhận (dòng thường chỉ 1 đợt).
export const daNhanFile = (r) => !!(r && r.nhan_file && r.nhan_file.da_nhan);
export const coDotNhanFile = (r) => Array.isArray(r && r.dot_vai_ids) && r.dot_vai_ids.length > 0;
const moTaNhan = (nf) => (nf ? `Đã nhận file BH${nf.nguoi ? ` — ${nf.nguoi}` : ''}${nf.tg ? ` · ${fmtDateTime(nf.tg)}` : ''}` : '');

// Ô STT: dòng đã nhận ⇒ số khoanh tròn xanh (rê chuột: ai nhận, lúc nào).
export function SttNhanFile({ row, stt }) {
  if (!daNhanFile(row)) return stt;
  return (
    <span title={moTaNhan(row.nhan_file)}
      className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 font-semibold text-emerald-700 ring-2 ring-emerald-500 dark:text-emerald-300">
      {stt}
    </span>
  );
}

// Menu chuột phải nhỏ tại vị trí chuột. `menu` = { x, y, dong: [row…] } (đã lọc dòng có đợt vải).
// Đóng khi bấm ra ngoài / Esc / cuộn / đổi cỡ cửa sổ.
export function NhanFileMenu({ menu, dangLuu, onPick, onClose }) {
  const ref = useRef(null);
  const [vt, setVt] = useState(null);
  useEffect(() => {
    if (!menu) { setVt(null); return undefined; }
    setVt({ x: menu.x, y: menu.y });
    const dong = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const phim = (e) => { if (e.key === 'Escape') onClose(); };
    const tat = () => onClose();
    document.addEventListener('mousedown', dong, true);
    document.addEventListener('touchstart', dong, true);
    document.addEventListener('keydown', phim);
    window.addEventListener('scroll', tat, true);
    window.addEventListener('resize', tat);
    return () => {
      document.removeEventListener('mousedown', dong, true);
      document.removeEventListener('touchstart', dong, true);
      document.removeEventListener('keydown', phim);
      window.removeEventListener('scroll', tat, true);
      window.removeEventListener('resize', tat);
    };
  }, [menu, onClose]);
  // Kẹp trong khung nhìn sau khi đo kích thước thật của menu.
  useEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8));
    const y = Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8));
    if (x !== menu.x || y !== menu.y) setVt({ x, y });
  }, [menu]);
  if (!menu) return null;
  const n = menu.dong.length;
  const soNhan = menu.dong.filter(daNhanFile).length;
  // Số dòng THẬT SỰ đổi của mỗi mục (dòng đã đúng trạng thái bị bỏ qua).
  const soChua = n - soNhan;
  const motDong = n === 1 ? menu.dong[0] : null;
  const muc = 'flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50';
  return (
    <div ref={ref} role="menu" style={{ left: (vt || menu).x, top: (vt || menu).y }}
      className="fixed z-[60] min-w-[16rem] max-w-xs rounded-card border border-line bg-surface p-1 shadow-card-hover"
      onContextMenu={(e) => e.preventDefault()}>
      <div className="truncate border-b border-line px-3 py-1.5 text-xs text-ink-soft">
        {motDong ? `${motDong.ma_phan || ''}${motDong.loai_dot_vai ? ` · ${motDong.loai_dot_vai}` : ''}` : `${n} dòng đang chọn`}
        {motDong && daNhanFile(motDong) && <div className="mt-0.5 text-emerald-700 dark:text-emerald-300">{moTaNhan(motDong.nhan_file)}</div>}
        {!motDong && soNhan > 0 && <div className="mt-0.5">{soNhan}/{n} dòng đã nhận file</div>}
      </div>
      {soNhan < n && (
        <button type="button" role="menuitem" className={`${muc} text-ink`} disabled={dangLuu} onClick={() => onPick(true)}>
          <Icon name="check-circle" size={16} className="text-emerald-600" />Đưa vào danh sách đã nhận file{n > 1 ? ` (${soChua} dòng)` : ''}
        </button>
      )}
      {soNhan > 0 && (
        <button type="button" role="menuitem" className={`${muc} text-danger`} disabled={dangLuu} onClick={() => onPick(false)}>
          <Icon name="undo" size={16} />Hủy khỏi danh sách đã nhận{n > 1 ? ` (${soNhan} dòng)` : ''}
        </button>
      )}
    </div>
  );
}

// Danh sách đợt ĐÃ NHẬN FILE trong các dòng đang ở READY — mỗi dòng nút "Hủy". `rows` = dòng của màn (đã tải).
export function NhanFileModal({ open, onClose, rows, coQuyen, dangLuu, onHuy, onMoDong }) {
  const [tim, setTim] = useState('');
  useEffect(() => { if (!open) setTim(''); }, [open]);
  const ds = useMemo(() => {
    if (!open) return []; // đóng thì không lọc (luật §9 — trang vẽ lại theo đồng hồ)
    return (rows || []).filter(daNhanFile)
      .filter((r) => !tim.trim() || khopTungTu(`${r.ma_phan} ${r.ten_khach_hang} ${r.ma_don_hang} ${r.ma_hang} ${r.mau_vai} ${r.kich_vai} ${r.kich_phim} ${r.ma_dot_vai_list || ''} ${r.nhan_file?.nguoi || ''}`, tim))
      .sort((a, b) => new Date(b.nhan_file.tg) - new Date(a.nhan_file.tg));
  }, [open, rows, tim]);
  const cot = [
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink' },
    { key: 'ten_khach_hang', header: 'Khách hàng' },
    { key: 'ma_don_hang', header: 'Đơn hàng' },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'mau_vai', header: 'Màu vải' },
    { key: 'kich_vai', header: 'Kích vải / phim', render: (r) => [r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—' },
    { key: 'loai_dot_vai', header: 'Đợt vải', render: (r) => (
      <div className="leading-tight">
        <div>{r.loai_dot_vai || '—'}</div>
        {r.ma_dot_vai_list && <div className="text-[11px] text-ink-soft">{r.ma_dot_vai_list}</div>}
      </div>
    ) },
    { key: 'nguoi', header: 'Người nhận', render: (r) => r.nhan_file?.nguoi || '—' },
    { key: 'tg', header: 'Giờ nhận', className: 'whitespace-nowrap', render: (r) => fmtDateTime(r.nhan_file?.tg) },
    ...(coQuyen ? [{ key: 'tv', header: '', render: (r) => (
      <Button variant="ghost" className="px-2 py-1 text-xs text-danger hover:bg-danger/10" disabled={dangLuu}
        onClick={(e) => { e.stopPropagation(); onHuy(r); }}>Hủy</Button>
    ) }] : []),
  ];
  return (
    <Modal open={open} onClose={onClose} size="xl" title={`Danh sách đã nhận file BH (${(rows || []).filter(daNhanFile).length})`}
      footer={<Button chiXemOk variant="secondary" onClick={onClose}>Đóng</Button>}>
      <div className="space-y-3">
        <div className="max-w-sm">
          <Input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm code phần, khách, đơn, mã hàng, người nhận…" />
        </div>
        <DataTable columns={cot} rows={ds} rowKey="_key" sttStart={0}
          onRowClick={onMoDong ? (r) => onMoDong(r) : undefined}
          emptyText={tim ? 'Không có dòng nào khớp' : 'Chưa có dòng nào đã nhận file — chuột phải vào dòng ở bảng READY để đưa vào'} />
      </div>
    </Modal>
  );
}
