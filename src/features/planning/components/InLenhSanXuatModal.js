import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import { fmtNum } from '../../../utils/format';
import { khopNhieu } from '../../../utils/timKiem';
import printLenhSanXuat, { nhomTheoChuyen } from '../utils/printLenhSanXuat';
import { ngayDMY } from '../utils/cotChecklistRelease';

// ─────────────────────────────────────────────────────────────────────────────
// CHỌN CHUYỀN RỒI IN "LỆNH SẢN XUẤT" (A5 ngang, 07/10/2026) — mở từ *Danh sách release*.
// `rows` = dòng của danh sách (đã qua chip loại chuyền, CHƯA qua ô tìm / bộ lọc trường): lệnh sản xuất của
//   1 chuyền phải in ĐỦ mọi lệnh nhỏ trên chuyền đó, bộ lọc đang ẩn bớt dòng thì không được làm thiếu tờ.
// Gom theo (chuyền × ngày SX KH) bằng `nhomTheoChuyen` — chế độ "theo ngày release" có thể ra nhiều ngày KH
//   cho 1 chuyền ⇒ mỗi ngày 1 lệnh riêng.
// Ô "Chỉ lệnh đã duyệt Release 2": bỏ lệnh còn `RELEASE_1` (đang chờ Test Run / chờ KH duyệt R2).
// ─────────────────────────────────────────────────────────────────────────────
export default function InLenhSanXuatModal({ open, onClose, rows, onLoi }) {
  const [chon, setChon] = useState(() => new Set());
  const [chiR2, setChiR2] = useState(false);
  const [tim, setTim] = useState('');
  useEffect(() => { if (open) { setChon(new Set()); setTim(''); } }, [open]);

  const nhom = useMemo(
    () => nhomTheoChuyen((rows || []).filter((r) => !chiR2 || r.lenh_trang_thai !== 'RELEASE_1')),
    [rows, chiR2]
  );
  const nhieuNgay = useMemo(() => new Set(nhom.map((g) => ngayDMY(g.ngay_ke_hoach))).size > 1, [nhom]);
  const hien = useMemo(() => nhom.filter((g) => khopNhieu([g.ten_chuyen, g.ma_chuyen], tim)), [nhom, tim]);
  const daChon = nhom.filter((g) => chon.has(g.khoa));
  const soTo = daChon.reduce((s, g) => s + g.so_to, 0);
  const tatCa = hien.length > 0 && hien.every((g) => chon.has(g.khoa));

  const bat = (khoa) => setChon((s) => { const n = new Set(s); if (n.has(khoa)) n.delete(khoa); else n.add(khoa); return n; });
  const batTatCa = () => setChon((s) => {
    const n = new Set(s);
    hien.forEach((g) => (tatCa ? n.delete(g.khoa) : n.add(g.khoa)));
    return n;
  });
  const inNgay = () => {
    if (!printLenhSanXuat(daChon)) {
      if (onLoi) onLoi('Trình duyệt đang chặn cửa sổ in — cho phép popup cho trang này rồi bấm In lại');
      return;
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="md" title="In lệnh sản xuất theo chuyền"
      footer={
        <>
          <Button chiXemOk variant="ghost" onClick={onClose}>Hủy</Button>
          <Button chiXemOk icon="printer" disabled={!daChon.length} onClick={inNgay}>
            {daChon.length ? `In ${daChon.length} chuyền · ${soTo} tờ A5` : 'In'}
          </Button>
        </>
      }>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm chuyền..."
            className="h-9 w-full rounded-input border border-line bg-surface pl-9 pr-3 text-base md:text-sm outline-none focus:border-primary" />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          <input type="checkbox" checked={chiR2} onChange={(e) => setChiR2(e.target.checked)} />
          Chỉ lệnh đã duyệt Release 2
        </label>
      </div>

      {hien.length === 0 ? (
        <div className="rounded-control border border-dashed border-line px-3 py-8 text-center text-sm text-ink-soft">
          {nhom.length ? 'Không có chuyền nào khớp ô tìm' : 'Không có lệnh nào để in'}
        </div>
      ) : (
        <div className="rounded-control border border-line">
          <label className="flex cursor-pointer items-center gap-2 border-b border-line bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-soft">
            <input type="checkbox" checked={tatCa} onChange={batTatCa} />
            Chọn tất cả ({hien.length} chuyền)
          </label>
          <div className="max-h-[50vh] overflow-auto">
            {hien.map((g) => (
              <label key={g.khoa}
                className="flex cursor-pointer items-center gap-3 border-b border-line/60 px-3 py-2 text-sm last:border-b-0 hover:bg-surface-muted/60">
                <input type="checkbox" checked={chon.has(g.khoa)} onChange={() => bat(g.khoa)} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ink">{g.ten_chuyen}</span>
                  {g.ma_chuyen && g.ma_chuyen !== g.ten_chuyen && <span className="text-xs text-ink-soft"> · {g.ma_chuyen}</span>}
                  {nhieuNgay && <span className="text-xs text-ink-soft"> · KH {ngayDMY(g.ngay_ke_hoach) || '—'}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                  {fmtNum(g.so_lenh)} lệnh · {fmtNum(g.dong.length)} dòng ·{' '}
                  <b className={g.so_to > 1 ? 'text-primary' : 'text-ink'}>{g.so_to} tờ</b>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
