import { useCallback, useRef, useState } from 'react';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { Field, Textarea } from '../components/common/controls';
import { ghiLyDoNghen, goiYLyDoNghen } from '../services/lyDoNghenService';
import { doNghen, khoaChuoi, khoaMacDinh, tienToCodePhan, codePhanCuaHang } from '../utils/nghen';
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
// ⚠⚠ LẤY LẠI LÝ DO CÙNG NHÓM CODE PHẦN (07/10/2026, người dùng chốt): khi XÁC NHẬN (không phải "Ghi lý do" tay),
//   mục nghẽn có code phần chung 3 đoạn đầu (`utils/nghen.js tienToCodePhan`, vd `DK-2610-004`) với 1 code phần
//   đã nhập lý do HÔM NAY ở CÙNG màn ⇒ dùng lại lý do đó (`GET /ly-do-nghen/goi-y`), không hỏi nữa. Mọi mục đều
//   có lý do cũ ⇒ tự ghi rồi đi tiếp, KHÔNG mở hộp; còn mục chưa có ⇒ hộp chỉ hỏi các mục đó, các mục kia được
//   ghi cùng lúc với lý do cũ của nhóm mình (bấm Hủy thì không ghi gì). Tra hỏng ⇒ hỏi như cũ.
// ─────────────────────────────────────────────────────────────────────────────
const dongGhi = ({ k, d, ma }) => ({
  phan_in_id: k.phan_in_id || null, dot_vai_ve_id: k.dot_vai_ve_id || null,
  lenh_san_xuat_id: k.lenh_san_xuat_id || null, tem_id: k.tem_id || null, ma: ma || null,
  tg_bat_dau_nghen: d?.batDau ? d.batDau.toISOString() : null,
  so_phut_nghen: d?.qua != null ? Math.max(0, d.qua) : null, sla_phut: d?.sla || null,
});
// Ghi các mục lấy lại lý do — mỗi lý do 1 lượt gọi (API nhận 1 lý do chung / lượt).
async function ghiLayLai(maTrang, hanhDong, coSan) {
  const theoLyDo = new Map();
  coSan.forEach((x) => { const a = theoLyDo.get(x.goiY.ly_do) || []; a.push(x); theoLyDo.set(x.goiY.ly_do, a); });
  for (const [ly, ds] of theoLyDo) {
    // eslint-disable-next-line no-await-in-loop
    await ghiLyDoNghen({ maTrang, lyDo: ly, hanhDong, items: ds.map(dongGhi) });
  }
}

export default function useLyDoNghen({ maTrang, trangThai, khoa, thoiGian } = {}) {
  const optsRef = useRef({});
  optsRef.current = { maTrang, trangThai, khoa: khoa || khoaMacDinh, thoiGian };
  const resolveRef = useRef(null);
  const [phien, setPhien] = useState(null); // { ds: [{k, d, ma, cp}], coSan: [...+goiY], hanhDong }
  const [lyDo, setLyDo] = useState('');
  const [luu, setLuu] = useState(false);
  const [loi, setLoi] = useState('');

  const hoiLyDoNghen = useCallback(async (rows, opts = {}) => {
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
      ds.push({ k, d: doNghen(r, o.thoiGian, now), ma: k.ma || r.ma_phan || '', cp: codePhanCuaHang(r) });
    });
    if (!ds.length) return true;
    const hanhDong = opts.hanhDong || 'XAC_NHAN';

    // Tra lý do đã nhập hôm nay của nhóm code phần (chỉ khi XÁC NHẬN; "Ghi lý do" tay thì người dùng muốn tự viết).
    let coSan = [];
    let can = ds;
    if (hanhDong === 'XAC_NHAN' && o.maTrang) {
      const tien = [...new Set(ds.map((x) => tienToCodePhan(x.cp)).filter(Boolean))];
      if (tien.length) {
        try {
          const res = await goiYLyDoNghen({ maTrang: o.maTrang, tien: tien.join(',') });
          const m = new Map((res?.data?.items || []).map((g) => [g.tien, g]));
          coSan = ds.filter((x) => m.has(tienToCodePhan(x.cp))).map((x) => ({ ...x, goiY: m.get(tienToCodePhan(x.cp)) }));
          can = ds.filter((x) => !m.has(tienToCodePhan(x.cp)));
        } catch (e) { coSan = []; can = ds; /* tra hỏng ⇒ hỏi như cũ */ }
      }
    }
    if (!can.length) {
      try { await ghiLayLai(o.maTrang, hanhDong, coSan); return true; } catch (e) {
        // Ghi tự động hỏng ⇒ mở hộp cho mọi mục, điền sẵn lý do cũ để người dùng bấm lại.
        can = ds; coSan = [];
      }
    }
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setLyDo(opts.lyDoMacDinh || '');
      setLoi('');
      setPhien({ ds: can, coSan, hanhDong });
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
        items: phien.ds.map(dongGhi),
      });
      if (phien.coSan?.length) await ghiLayLai(optsRef.current.maTrang, phien.hanhDong, phien.coSan);
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
          {phien.coSan?.length > 0 && (
            <div className="rounded-control border border-line bg-surface-muted px-3 py-2 text-xs text-ink-soft">
              <div className="mb-1 font-semibold text-ink">Dùng lại lý do đã nhập hôm nay ({phien.coSan.length} mục cùng nhóm code phần)</div>
              <div className="max-h-24 space-y-0.5 overflow-auto">
                {phien.coSan.map(({ ma, goiY }, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={`${ma}-${i}`}><b className="text-ink">{ma || '—'}</b> — {goiY.ly_do}</div>
                ))}
              </div>
            </div>
          )}
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
