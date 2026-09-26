import { useCallback, useRef, useState } from 'react';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { Field, Textarea } from '../components/common/controls';
import { ghiLyDoNghen } from '../services/lyDoNghenService';
import { doNghen, khoaChuoi, khoaMacDinh } from '../utils/nghen';
import { fmtDur } from '../utils/sla';
import { fmtDateTime } from '../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// HỎI LÝ DO NGHẼN TRƯỚC KHI XÁC NHẬN (mig 106, 26/09/2026).
//
//   const { hoiLyDoNghen, lyDoNghenModal } = useLyDoNghen({ maTrang, trangThai, khoa, thoiGian });
//   // trong hàm xác nhận:
//   if (!(await hoiLyDoNghen(dsHangSapXacNhan))) return;   // người dùng bấm Hủy ⇒ dừng
//   …gọi API xác nhận như cũ…
//   // và render {lyDoNghenModal} ở đâu đó trong trang.
//
// · `trangThai(r)` — ĐÚNG vị từ màn đang dùng để tô đỏ hàng (cùng thứ truyền cho NghenListModal).
//   Chỉ hàng trả 'NGHEN' mới bị hỏi; không hàng nào nghẽn ⇒ trả true NGAY, không hiện gì.
// · `khoa(r)` — khóa đối tượng lưu kèm lý do ({phan_in_id, dot_vai_ve_id, lenh_san_xuat_id, tem_id, ma}).
// · `thoiGian(r)` — {phut, sla} cho họ màn dùng `useNghenMap`; bỏ trống thì đọc `tg_vao`/`sla_phut`.
// ⚠ Các tham số được giữ trong REF ⇒ `hoiLyDoNghen` ỔN ĐỊNH giữa các lần render (trang truyền hàm
//   nội tuyến, đưa vào deps là vòng lặp — bẫy §9).
// ⚠ Lưu lý do HỎNG ⇒ báo lỗi ngay trong hộp, người dùng thử lại hoặc Hủy; thiếu mig 106 ⇒ backend trả
//   `thieu_migration` và việc xác nhận vẫn đi tiếp (lý do là phần thêm, không chặn xưởng).
// ─────────────────────────────────────────────────────────────────────────────
export default function useLyDoNghen({ maTrang, trangThai, khoa, thoiGian } = {}) {
  const optsRef = useRef({});
  optsRef.current = { maTrang, trangThai, khoa: khoa || khoaMacDinh, thoiGian };
  const resolveRef = useRef(null);
  const [phien, setPhien] = useState(null); // { ds: [{k, d, ma}], hanhDong }
  const [lyDo, setLyDo] = useState('');
  const [luu, setLuu] = useState(false);
  const [loi, setLoi] = useState('');

  const hoiLyDoNghen = useCallback((rows, opts = {}) => {
    const o = optsRef.current;
    const now = Date.now();
    const seen = new Set();
    const ds = [];
    (Array.isArray(rows) ? rows : [rows]).forEach((r) => {
      if (!r) return;
      if (!opts.batBuoc && !(o.trangThai && o.trangThai(r) === 'NGHEN')) return;
      const k = o.khoa(r) || {};
      const key = khoaChuoi(k) || `i${ds.length}`;
      if (seen.has(key)) return;
      seen.add(key);
      ds.push({ k, d: doNghen(r, o.thoiGian, now), ma: k.ma || r.ma_phan || '' });
    });
    if (!ds.length) return Promise.resolve(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setLyDo(opts.lyDoMacDinh || '');
      setLoi('');
      setPhien({ ds, hanhDong: opts.hanhDong || 'XAC_NHAN' });
    });
  }, []);

  const dong = (kq) => {
    const r = resolveRef.current;
    resolveRef.current = null;
    setPhien(null);
    if (r) r(kq);
  };

  const gui = async () => {
    const t = lyDo.trim();
    if (!t) { setLoi('Vui lòng nhập lý do nghẽn'); return; }
    setLuu(true); setLoi('');
    try {
      await ghiLyDoNghen({
        maTrang: optsRef.current.maTrang, lyDo: t, hanhDong: phien.hanhDong,
        items: phien.ds.map(({ k, d, ma }) => ({
          phan_in_id: k.phan_in_id || null, dot_vai_ve_id: k.dot_vai_ve_id || null,
          lenh_san_xuat_id: k.lenh_san_xuat_id || null, tem_id: k.tem_id || null, ma: ma || null,
          tg_bat_dau_nghen: d?.batDau ? d.batDau.toISOString() : null,
          so_phut_nghen: d?.qua != null ? Math.max(0, d.qua) : null, sla_phut: d?.sla || null,
        })),
      });
      dong(true);
    } catch (e) {
      setLoi(e.message || 'Không lưu được lý do nghẽn');
    } finally { setLuu(false); }
  };

  const laGhiTay = phien?.hanhDong === 'GHI_TAY';
  const lyDoNghenModal = (
    <Modal open={!!phien} onClose={() => !luu && dong(false)} size="lg"
      title={laGhiTay ? 'Ghi lý do nghẽn' : 'Phần in đã quá thời gian'}
      footer={(
        <>
          <Button chiXemOk variant="ghost" onClick={() => dong(false)} disabled={luu}>Hủy</Button>
          <Button icon="check" loading={luu} onClick={gui}>{laGhiTay ? 'Lưu lý do' : 'Lưu lý do & xác nhận'}</Button>
        </>
      )}>
      {phien && (
        <div className="space-y-3">
          {!laGhiTay && (
            <div className="rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              {phien.ds.length > 1 ? `${phien.ds.length} mục này` : 'Phần in này'} đã <b>quá thời gian (SLA)</b>, vui lòng nhập lý do nghẽn trước khi xác nhận.
            </div>
          )}
          <div className="max-h-48 overflow-auto rounded-control border border-line">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-muted text-ink-soft">
                <tr>
                  <th className="px-2 py-1.5 text-left">Mã</th>
                  <th className="px-2 py-1.5 text-left">Nghẽn từ</th>
                  <th className="px-2 py-1.5 text-right">SLA</th>
                  <th className="px-2 py-1.5 text-right">Nghẽn bao lâu</th>
                </tr>
              </thead>
              <tbody>
                {phien.ds.map(({ ma, d }, i) => (
                  <tr key={`${ma}-${i}`} className="border-t border-line">
                    <td className="px-2 py-1.5 font-medium text-ink">{ma || '—'}</td>
                    <td className="px-2 py-1.5">{d?.batDau ? fmtDateTime(d.batDau) : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{d?.sla ? fmtDur(d.sla) : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-danger">
                      {d?.qua != null ? (d.qua > 0 ? `+${fmtDur(d.qua)}` : <Badge tone="warning">chưa quá</Badge>) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Field label="Lý do nghẽn (bắt buộc)">
            <Textarea rows={3} value={lyDo} autoFocus onChange={(e) => setLyDo(e.target.value)}
              placeholder="Vd: chờ vải, thiếu khuôn, máy hỏng, chờ khách xác nhận màu..." />
          </Field>
          {loi && <p className="text-sm text-danger">{loi}</p>}
        </div>
      )}
    </Modal>
  );

  return { hoiLyDoNghen, lyDoNghenModal };
}
