// ─────────────────────────────────────────────────────────────────────────────
// NHẬP TAY › THÊM ĐỢT VẢI NHANH THEO CODE PHẦN (19/11/2026, người dùng: "cho nhập nhanh theo code phần, chứ nhập từng khách,
//   đơn, mã rồi code thì lâu lắm"). Quét / gõ code phần (hoặc mã hàng, mã phiếu ready…) ⇒ danh sách phần in khớp ⇒ "Thêm đợt"
//   mở `ThemDotVaiModal` (chọn công đoạn In · In kiếng · Logo/Ép · kiếng ủi 4I/Ép + đặt màn). API của Quản trị phần in
//   (quyền PHAN_IN_ADMIN — không có quyền thì báo).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import { Input } from '../../../components/common/controls';
import { traCuuPhanIn } from '../../../services/quanTriPhanInService';
import { listUserOptions } from '../../../services/userService';
import { listChuyen } from '../../../services/planningService';
import ThemDotVaiModal from './ThemDotVaiModal';

export default function ThemDotTheoCodePhan({ show }) {
  const [q, setQ] = useState('');
  const [ds, setDs] = useState([]);
  const [dangTim, setDangTim] = useState(false);
  const [loi, setLoi] = useState('');
  const [mo, setMo] = useState(null); // phần in đang thêm đợt
  const [chuyen, setChuyen] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const ma = q.trim();
    if (ma.length < 3) { setDs([]); setLoi(''); return undefined; }
    let song = true;
    const t = setTimeout(() => {
      setDangTim(true);
      traCuuPhanIn(ma)
        .then((r) => { if (song) { setDs((r.data || []).filter((p) => p.dang_hoat_dong !== false).slice(0, 10)); setLoi(''); } })
        .catch((e) => { if (song) { setDs([]); setLoi(e.message || 'Không tra được'); } })
        .finally(() => { if (song) setDangTim(false); });
    }, 300);
    return () => { song = false; clearTimeout(t); };
  }, [q]);

  // Danh sách chuyền + người chỉ cần khi lập lệnh ngay — tải 1 lần lúc mở modal đầu tiên.
  const moModal = (p) => {
    setMo(p);
    if (chuyen === null) {
      listChuyen().then((r) => setChuyen(r.data || [])).catch(() => setChuyen([]));
      listUserOptions({ limit: 500 }).then((r) => setUsers(r.data || [])).catch(() => {});
    }
  };

  return (
    <div className="card mb-4 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">Thêm đợt vải nhanh theo code phần</h3>
        <span className="text-xs text-ink-soft">Phần in đã có trên MES mà ERP thiếu đợt — quét / gõ code phần, khỏi chọn khách → đơn → mã hàng.</span>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Quét / gõ code phần (≥ 3 ký tự)…" autoComplete="off" />
      {dangTim && <p className="mt-2 text-xs text-ink-soft">Đang tìm…</p>}
      {loi && <p className="mt-2 text-xs text-danger">{loi}</p>}
      {!dangTim && !loi && q.trim().length >= 3 && !ds.length && <p className="mt-2 text-xs text-ink-soft">Không có phần in khớp.</p>}
      {ds.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-control border border-line">
          {ds.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <b className="font-mono text-ink">{p.ma_phan}</b>
              <span className="text-xs text-ink-soft">{p.ten_khach_hang} · {p.ma_don_hang} · {p.ma_hang} · {p.mau_vai || '—'}</span>
              <Badge tone="default">{p.so_dot_vai} đợt</Badge>
              <Button className="ml-auto px-3 py-1.5" icon="plus" onClick={() => moModal(p)}>Thêm đợt</Button>
            </li>
          ))}
        </ul>
      )}
      <ThemDotVaiModal phanInId={mo && mo.id} mo={!!mo} show={show} chuyen={chuyen || []} users={users}
        onClose={() => setMo(null)} onDone={() => { setMo(null); setQ(''); }} />
    </div>
  );
}
