import { useCallback, useEffect, useMemo, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import Spinner from '../../../components/common/Spinner';
import DateRangePicker from '../../../components/common/DateRangePicker';
import HuyLyDoModal from '../../../components/common/HuyLyDoModal';
import useToast from '../../../hooks/useToast';
import useChiXem from '../../../hooks/useChiXem';
import useSocketReload from '../../../hooks/useSocketReload';
import { fmtNum, ngayLocalISO } from '../../../utils/format';
import { khopNhieu } from '../../../utils/timKiem';
import { dsMoDieuKienFinish, moDieuKienFinish, huyChuyenFinish } from '../../../services/qualityService';
import { fmtDMY } from '../../quality/utils/danhSachFinish';
import { DieuKienFinishChips, LoaiFinishBadge, MoDieuKienBadge } from '../../quality/components/DieuKienFinish';

// ─────────────────────────────────────────────────────────────────────────────
// MỞ ĐIỀU KIỆN FINISH (18/11/2026, người dùng chốt — CHỈ ADMIN, mã quyền `FINISH_MO_DIEU_KIEN` không có trong bảng quyền nên
// chỉ tài khoản '*' vào được). Phần in đã XÁC NHẬN CHẠY HOÀN TẤT (mọi lệnh sống) mà chưa finish ⇒ admin "Mở điều kiện" (lý do
// bắt buộc) ⇒ ở modal Danh sách finish › Chưa finish người dùng bấm được "Chuyển finish" dù chưa đủ các điều kiện khác. "Đóng
// điều kiện" thu lại; "Hủy chuyển finish" bỏ 1 lần chuyển tay. Luật: BE `utils/dieuKienFinish.js`, vết `audit_log`
// `phan_in_finish`.
//   · Mặc định: phần in chạy hoàn tất trong khoảng ngày (+ phần in đang mở) chưa finish.
//   · Ô "Tìm phần in" ≥ 3 ký tự (code phần / TDTHĐH) ⇒ tìm MỌI ngày, mọi trạng thái (≤ 100) — để hủy chuyển finish tay.
// ─────────────────────────────────────────────────────────────────────────────

const HANH_DONG = {
  MO: { tieuDe: 'Mở điều kiện finish', nhanNut: 'Mở điều kiện', kieuNut: 'primary', goiY: 'Vì sao cho chuyển finish khi chưa đủ điều kiện...',
    hauQua: 'Người dùng bấm được "Chuyển finish" cho phần in này ở Danh sách finish › Chưa finish (chỉ cần đã chạy hoàn tất).' },
  DONG: { tieuDe: 'Đóng điều kiện finish', nhanNut: 'Đóng điều kiện', kieuNut: 'danger', goiY: 'Vì sao thu lại...',
    hauQua: 'Phần in quay về luật chung: chỉ chuyển finish được khi đủ 6 điều kiện mà SL đạt < SLĐH.' },
  HUY: { tieuDe: 'Hủy chuyển finish', nhanNut: 'Hủy chuyển finish', kieuNut: 'danger', goiY: 'Vì sao hủy (vd: chuyển nhầm phần in)...',
    hauQua: 'Phần in rời Danh sách finish (trừ khi đã đủ 7 điều kiện tự động).' },
};

export default function MoDieuKienFinishPage() {
  const { toast, show } = useToast();
  const chiXem = useChiXem();
  const [range, setRange] = useState(() => {
    const d = new Date(); const t = ngayLocalISO(d); d.setDate(d.getDate() - 6);
    return { from: ngayLocalISO(d), to: t };
  });
  const [tim, setTim] = useState('');   // ô tìm server (≥ 3 ký tự ⇒ mọi ngày)
  const [timDung, setTimDung] = useState('');
  const [loc, setLoc] = useState('');   // lọc nhanh trên danh sách đang hiện
  const [chiMoDuoc, setChiMoDuoc] = useState(false);
  const [data, setData] = useState({ items: [], tim: false });
  const [loading, setLoading] = useState(false);
  const [thaoTac, setThaoTac] = useState(null); // { loai: 'MO'|'DONG'|'HUY', r }

  // Chờ người gõ xong 400 ms mới tìm.
  useEffect(() => { const t = setTimeout(() => setTimDung(tim.trim()), 400); return () => clearTimeout(t); }, [tim]);

  const tuNgay = range.from;
  const denNgay = range.to || range.from;
  const load = useCallback(async (ngam = false) => {
    if (!ngam) setLoading(true);
    try {
      const params = timDung.length >= 3 ? { q: timDung } : { tuNgay, denNgay };
      const r = await dsMoDieuKienFinish(params);
      setData(r.data || { items: [] });
    } catch (e) {
      if (!ngam) show(e.message || 'Lỗi tải danh sách', 'error');
    } finally {
      if (!ngam) setLoading(false);
    }
  }, [timDung, tuNgay, denNgay, show]);
  useEffect(() => { load(); }, [load]);
  useSocketReload(['quality:updated', 'delivery:updated', 'production:updated'], () => load(true), 1000);

  const rows = useMemo(() => (data.items || [])
    .filter((r) => !chiMoDuoc || r.duoc_mo || r.mo_dieu_kien)
    .filter((r) => khopNhieu([r.ma_phan, r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.mau_vai, r.barcode, r.ma_chuyen], loc)),
  [data, chiMoDuoc, loc]);

  const xacNhan = async ({ loai, r }, lyDo) => {
    try {
      if (loai === 'HUY') await huyChuyenFinish(r.phan_in_id, lyDo);
      else await moDieuKienFinish(r.phan_in_id, loai === 'MO', lyDo);
      show(`${HANH_DONG[loai].tieuDe}: ${r.ma_phan} — xong`);
      setThaoTac(null);
      load(true);
    } catch (e) {
      show(e.message || 'Thao tác thất bại', 'error');
      throw e;
    }
  };

  const th = 'px-3 py-2 text-left text-xs font-semibold text-ink-soft';
  const td = 'px-3 py-2 align-top';
  const hd = thaoTac ? HANH_DONG[thaoTac.loai] : null;

  return (
    <div>
      <Toolbar title="Mở điều kiện finish"
        subtitle="Admin mở điều kiện cho phần in đã chạy hoàn tất ⇒ người dùng bấm được “Chuyển finish” ở Danh sách finish › Chưa finish"
        search={tim} onSearch={setTim} searchPlaceholder="Tìm phần in mọi ngày: code phần / TDTHĐH (≥ 3 ký tự)..." />

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3">
        <div className={`flex items-center gap-2 text-sm ${timDung.length >= 3 ? 'opacity-50' : ''}`}>
          <span className="text-ink-soft">Ngày chạy hoàn tất</span>
          <DateRangePicker value={range} onChange={(v) => v?.from && setRange(v)} placeholder="Chọn ngày" />
        </div>
        <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Lọc nhanh danh sách đang hiện..."
          className="h-9 min-w-[14rem] flex-1 rounded-input border border-line bg-surface px-3 text-sm outline-none focus:border-primary" />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={chiMoDuoc} onChange={(e) => setChiMoDuoc(e.target.checked)} />
          Chỉ phần in mở được / đang mở
        </label>
        <span className="text-xs text-ink-soft">
          {timDung.length >= 3 ? `Kết quả tìm "${timDung}" (mọi ngày, mọi trạng thái)` : 'Phần in chạy hoàn tất trong khoảng ngày, chưa finish'}
          {' · '}<b className="text-ink">{fmtNum(rows.length)}</b> phần in
        </span>
      </div>

      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className={th}>Code phần</th>
              <th className={th}>Khách · Đơn · Mã hàng</th>
              <th className={`${th} text-right`}>SLĐH</th>
              <th className={`${th} text-right`}>SL đạt (đã tích)</th>
              <th className={th}>Ngày chạy hoàn tất</th>
              <th className={th}>Điều kiện finish</th>
              <th className={th}>Còn thiếu / trạng thái</th>
              <th className={th}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center"><Spinner size={22} className="mx-auto" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-ink-soft">Không có phần in nào</td></tr>
            ) : rows.map((r) => (
              <tr key={r.phan_in_id} className="border-t border-line/60 hover:bg-surface-muted/40">
                <td className={`${td} font-medium text-ink`}>
                  {r.ma_phan}
                  {r.ma_chuyen && <div className="text-[11px] font-normal text-ink-soft">{r.ma_chuyen}</div>}
                </td>
                <td className={td}>
                  <div className="text-ink">{r.ten_khach_hang}</div>
                  <div className="text-xs text-ink-soft">{[r.ma_don_hang, r.ma_hang].filter(Boolean).join(' · ')}</div>
                </td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.so_luong_don_hang)}</td>
                <td className={`${td} text-right tabular-nums font-semibold text-primary`}>{fmtNum(r.sl_dat)}</td>
                <td className={`${td} tabular-nums`}>{fmtDMY(r.ngay_hoan_tat) || '—'}</td>
                <td className={td}><DieuKienFinishChips r={r} /></td>
                <td className={td}>
                  <div className="flex flex-wrap items-center gap-1">
                    <LoaiFinishBadge r={r} />
                    <MoDieuKienBadge r={r} />
                  </div>
                  {r.finish
                    ? <div className="mt-0.5 text-xs text-ink-soft">Đã finish {fmtDMY(r.ngay_finish)}</div>
                    : <div className="mt-0.5 max-w-[22rem] whitespace-normal text-xs text-ink-soft">{r.ghi_chu || '—'}</div>}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <div className="flex flex-wrap gap-1.5">
                    {!chiXem && r.duoc_mo && !r.mo_dieu_kien && (
                      <Button variant="primary" className="!px-2.5 !py-1 !text-xs" onClick={() => setThaoTac({ loai: 'MO', r })}>Mở điều kiện</Button>
                    )}
                    {!chiXem && r.mo_dieu_kien && !r.finish && (
                      <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={() => setThaoTac({ loai: 'DONG', r })}>Đóng điều kiện</Button>
                    )}
                    {!chiXem && r.loai_finish === 'CHUYEN_TAY' && (
                      <Button variant="danger" className="!px-2.5 !py-1 !text-xs" onClick={() => setThaoTac({ loai: 'HUY', r })}>Hủy chuyển finish</Button>
                    )}
                    {!r.dk?.CHAY && !r.finish && <span className="text-xs text-ink-soft">Chưa chạy hoàn tất</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HuyLyDoModal muc={thaoTac} onClose={() => setThaoTac(null)} onXacNhan={xacNhan}
        tieuDe={hd?.tieuDe} nhanNut={hd?.nhanNut} kieuNut={hd?.kieuNut} nhanLyDo="Lý do" goiY={hd?.goiY} ghiChuErp=""
        moTa={(m) => (
          <div>
            <b>{m.r.ma_phan}</b> · {m.r.ten_khach_hang} · SL đạt {fmtNum(m.r.sl_dat)} / SLĐH {fmtNum(m.r.so_luong_don_hang)}
          </div>
        )}
        hauQua={hd?.hauQua} />

      <Toast toast={toast} />
    </div>
  );
}
