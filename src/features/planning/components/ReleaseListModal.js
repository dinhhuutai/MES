import { useEffect, useState, useCallback } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import { fmtNum } from '../../../utils/format';
import { getReleaseList } from '../../../services/planningService';
import exportReleaseListExcel from '../utils/exportReleaseListExcel';
import printReleaseList from '../utils/printReleaseList';

const tomorrowStr = () => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const pad = (n) => String(n).padStart(2, '0');
const fmtClock = (ts) => {
  if (!ts) return '—';
  const x = new Date(ts); if (Number.isNaN(+x)) return '—';
  let h = x.getHours(); const m = x.getMinutes(); const ap = h < 12 ? 'AM' : 'PM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${pad(m)} ${ap}`;
};
const fmtDMY = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

// Modal "Danh sách release" theo ngày kế hoạch — bảng bám form + Xuất Excel + In A4.
export default function ReleaseListModal({ open, onClose }) {
  const { toast, show } = useToast();
  const [date, setDate] = useState(tomorrowStr);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const r = await getReleaseList(date);
      setItems(r.data.items || []);
      setMeta(r.data.meta || null);
    } catch (e) {
      show(e.message || 'Lỗi tải danh sách release', 'error');
      setItems([]); setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [open, date, show]);

  useEffect(() => { load(); }, [load]);

  const th = 'px-2 py-2 text-xs font-semibold text-ink-soft whitespace-nowrap';
  const td = 'px-2 py-1.5 whitespace-nowrap';

  return (
    <Modal open={open} onClose={onClose} size="xl" title={`Danh sách release ${fmtDMY(date)}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-ink-soft">Ngày kế hoạch</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-input border border-line px-3 text-sm focus:border-primary focus:outline-none" />
          </label>
          {meta && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
              <span>Tổng đơn <b className="text-ink">{fmtNum(meta.tong_don)}</b></span>
              <span>Tổng mã <b className="text-ink">{fmtNum(meta.tong_ma)}</b></span>
              <span>Tổng phần <b className="text-ink">{fmtNum(meta.tong_phan)}</b></span>
              <span>SL release <b className="text-ink">{fmtNum(meta.sl_release)}</b></span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon="download" disabled={!items.length}
            onClick={() => exportReleaseListExcel(items, meta)}>Xuất Excel</Button>
          <Button icon="printer" disabled={!items.length}
            onClick={() => printReleaseList(items, meta)}>In</Button>
        </div>
      </div>

      <div className="max-h-[62vh] overflow-auto rounded-control border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-muted">
            <tr className="border-b border-line">
              <th className={`${th} text-left`}>Chuyền</th>
              <th className={`${th} text-left`}>KH</th>
              <th className={`${th} text-left`}>PO</th>
              <th className={`${th} text-left`}>Mã</th>
              <th className={`${th} text-left`}>Màu vải</th>
              <th className={`${th} text-left`}>Kích vải</th>
              <th className={`${th} text-left`}>Kích phim</th>
              <th className={`${th} text-right`}>SLĐH</th>
              <th className={`${th} text-right`}>SLNV</th>
              <th className={`${th} text-right`}>SL đã in</th>
              <th className={`${th} text-right`}>SL đã giao</th>
              <th className={`${th} text-right`}>SL release</th>
              <th className={`${th} text-left`}>Owner</th>
              <th className={`${th} text-left`}>Giờ BD</th>
              <th className={`${th} text-left`}>Giờ KT</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} className="px-3 py-8 text-center text-ink-soft">Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={15} className="px-3 py-8 text-center text-ink-soft">Không có đợt sản xuất release cho ngày này</td></tr>
            ) : items.map((r) => (
              <tr key={r.lenh_id} className="border-b border-line/60">
                <td className={`${td} font-medium text-ink`}>{r.ten_chuyen || '—'}</td>
                <td className={td}>{r.ten_khach_hang || '—'}</td>
                <td className={td}>{r.ma_don_hang || '—'}</td>
                <td className={`${td} max-w-[200px] truncate`}>{r.ten_ma_hang || r.ma_hang || '—'}</td>
                <td className={td}>{r.mau_vai || '—'}</td>
                <td className={td}>{r.kich_vai || '—'}</td>
                <td className={td}>{r.kich_phim || '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.so_luong_don_hang)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.slnv)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.sl_da_in)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.sl_da_giao)}</td>
                <td className={`${td} text-right tabular-nums font-semibold text-primary`}>{fmtNum(r.so_luong_release)}</td>
                <td className={td}></td>{/* Owner để trống (ký tay) */}
                <td className={`${td} tabular-nums`}>{fmtClock(r.tg_bd_kh)}</td>
                <td className={`${td} tabular-nums`}>{fmtClock(r.tg_kt_kh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Toast toast={toast} />
    </Modal>
  );
}
