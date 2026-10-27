import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import { recordKcs } from '../../../services/qualityService';
import { fmtNum } from '../../../utils/format';

// ─── XÁC NHẬN KCS NHIỀU TEM 1 LƯỢT (27/10/2026, người dùng: "quét tem, enter tự tích … bấm xác nhận thì hiện modal gần
//   toàn màn hình chứa danh sách các tem đã tích và các ô nhập xác nhận KCS giống in nhiều tem 15,16 bên sản xuất") ───
// Mỗi dòng = 1 tem: Đạt · Hư · Thiếu · Dư · Mẫu + ô "Một phần". Mỗi dòng đi ĐÚNG `recordKcs` (POST /quality/kcs/:temId —
//   đủ guard cân đối + khóa tem + ERP kiểm phẩm), TUẦN TỰ, dòng lỗi không chặn dòng sau. Luật cân đối GƯƠNG BE:
//   · thường: đạt + hư = cần kiểm + dư − thiếu (lệch là chặn);
//   · "Một phần" (kiểm trước): không thiếu/dư, 0 < đạt + hư < cần kiểm — phần còn lại tem ở lại màn KCS.
// Ô Đạt điền sẵn = còn cần kiểm (như panel 1 tem).
const n = (v) => Math.max(0, Math.trunc(Number(v) || 0));
export function danhGiaKcs(canKiem, f) {
  const dat = n(f.soLuongDat); const hu = n(f.soLuongHu);
  const thieu = n(f.soLuongThieu); const du = n(f.soLuongDu);
  const daNhap = dat + hu;
  if (f.kiemMotPhan) {
    if (thieu || du) return { ok: false, chu: 'Một phần: không nhập thiếu/dư' };
    if (daNhap <= 0) return { ok: false, chu: 'Nhập đạt/hư' };
    if (daNhap >= canKiem) return { ok: false, chu: `Phải < ${fmtNum(canKiem)} (kiểm hết thì bỏ tích "Một phần")` };
    return { ok: true, motPhan: true, chu: `Kiểm ${fmtNum(daNhap)} · còn ${fmtNum(canKiem - daNhap)} ở lại KCS` };
  }
  const tong = canKiem + du - thieu;
  const lech = daNhap - tong;
  if (daNhap <= 0) return { ok: false, chu: 'Nhập đạt/hư' };
  if (lech !== 0) return { ok: false, chu: `Lệch ${lech > 0 ? '+' : ''}${fmtNum(lech)} (cần ${fmtNum(tong)})` };
  return { ok: true, chu: 'Cân đối' };
}

const formMoi = (r) => ({
  soLuongDat: String(r.con_kcs ?? r.so_luong ?? ''), soLuongHu: '', soLuongThieu: '', soLuongDu: '', soLuongMau: '', kiemMotPhan: false,
});

const O_SO = [
  ['soLuongDat', 'Đạt'], ['soLuongHu', 'Hư'], ['soLuongThieu', 'Thiếu'], ['soLuongDu', 'Dư'], ['soLuongMau', 'Mẫu'],
];

export default function KcsNhieuModal({ open, rows, onClose, onXong, truocXacNhan, show }) {
  const [forms, setForms] = useState({});
  const [ketQua, setKetQua] = useState({}); // tem_id → { ok, chu }
  const [dangLuu, setDangLuu] = useState(false);
  const [tienDo, setTienDo] = useState('');

  // Mở modal ⇒ điền sẵn dòng mới; giữ số đã gõ của dòng còn ở lại (vd lần trước lỗi).
  useEffect(() => {
    if (!open) return;
    setForms((cu) => Object.fromEntries((rows || []).map((r) => [r.tem_id, cu[r.tem_id] || formMoi(r)])));
    setKetQua((cu) => Object.fromEntries(Object.entries(cu).filter(([id, k]) => !k.ok && (rows || []).some((r) => r.tem_id === id))));
  }, [open, rows]);

  const set = (id, k, v) => setForms((f) => ({ ...f, [id]: { ...f[id], [k]: v } }));
  const danhGia = useMemo(() => Object.fromEntries((rows || []).map((r) => {
    const f = forms[r.tem_id] || formMoi(r);
    return [r.tem_id, danhGiaKcs(Number(r.con_kcs ?? r.so_luong ?? 0) || 0, f)];
  })), [rows, forms]);
  const soSai = (rows || []).filter((r) => !danhGia[r.tem_id]?.ok).length;
  const tongDat = (rows || []).reduce((s, r) => s + n(forms[r.tem_id]?.soLuongDat), 0);
  const tongHu = (rows || []).reduce((s, r) => s + n(forms[r.tem_id]?.soLuongHu), 0);

  const datHet = () => setForms((f) => Object.fromEntries((rows || []).map((r) => [r.tem_id, { ...(f[r.tem_id] || formMoi(r)),
    soLuongDat: String(r.con_kcs ?? ''), soLuongHu: '', soLuongThieu: '', soLuongDu: '', kiemMotPhan: false }])));

  const luu = async () => {
    if (soSai) { show(`Còn ${soSai} dòng chưa cân đối — sửa trước khi lưu`, 'error'); return; }
    if (truocXacNhan && !(await truocXacNhan(rows))) return;
    setDangLuu(true);
    const ok = []; const loi = [];
    const kq = {};
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      setTienDo(`Đang lưu ${i + 1}/${rows.length} · ${r.ma_tem}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await recordKcs(r.tem_id, { ...forms[r.tem_id] });
        const con = Number(res.data?.con_kcs) || 0;
        kq[r.tem_id] = { ok: true, chu: con > 0 ? `Đã lưu · còn ${fmtNum(con)} chờ kiểm` : 'Đã lưu' };
        ok.push(r.tem_id);
      } catch (e) {
        kq[r.tem_id] = { ok: false, chu: e.message || 'Lưu lỗi' };
        loi.push(r.ma_tem);
      }
    }
    setKetQua(kq);
    setTienDo('');
    setDangLuu(false);
    onXong?.(ok, loi);
  };

  if (!open) return null;
  return (
    <Modal open={open} onClose={() => (dangLuu ? null : onClose())} size="full" lapDay
      title={`Xác nhận KCS — ${rows.length} tem`}
      footer={(
        <>
          {tienDo && <span className="mr-auto text-sm text-ink-soft">{tienDo}</span>}
          {!tienDo && soSai > 0 && <span className="mr-auto text-sm text-danger">{soSai} dòng chưa cân đối</span>}
          <Button chiXemOk variant="ghost" onClick={onClose} disabled={dangLuu}>Đóng</Button>
          <Button onClick={luu} loading={dangLuu} disabled={!rows.length || soSai > 0}>Xác nhận KCS ({rows.length})</Button>
        </>
      )}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button variant="secondary" icon="check" onClick={datHet} disabled={dangLuu}>Đạt hết (điền Đạt = còn kiểm)</Button>
          <span className="text-ink-soft">Tổng đạt <b className="text-ink">{fmtNum(tongDat)}</b> · hư <b className="text-ink">{fmtNum(tongHu)}</b></span>
          <span className="text-xs text-ink-soft">Tích <b>Một phần</b> khi kiểm trước một phần — phần còn lại tem ở lại màn KCS. Toàn bộ hư vào chờ sửa.</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-card border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-2 py-2 text-right">STT</th>
                <th className="px-2 py-2">Tem</th>
                <th className="px-2 py-2">Đơn hàng · Mã hàng · Code phần</th>
                <th className="px-2 py-2">Màu · Kích vải · Kích phim</th>
                <th className="px-2 py-2 text-right">Còn kiểm</th>
                {O_SO.map(([, l]) => <th key={l} className="w-24 px-2 py-2">{l}</th>)}
                <th className="px-2 py-2 text-center">Một phần</th>
                <th className="px-2 py-2">Cân đối</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const f = forms[r.tem_id] || formMoi(r);
                const dg = danhGia[r.tem_id] || {};
                const kq = ketQua[r.tem_id];
                return (
                  <tr key={r.tem_id} className={`border-t border-line/70 align-middle ${kq && !kq.ok ? 'bg-danger/5' : ''}`}>
                    <td className="px-2 py-1.5 text-right tabular-nums text-ink-soft">{i + 1}</td>
                    <td className="px-2 py-1.5"><Badge tone="info">{r.ma_tem}</Badge></td>
                    <td className="px-2 py-1.5 leading-tight">
                      <div className="text-ink">{[r.ma_don_hang, r.ma_hang].filter(Boolean).join(' · ') || '—'}</div>
                      <div className="text-xs text-ink-soft">{r.ma_phan || r.phan_list || ''}</div>
                    </td>
                    <td className="px-2 py-1.5 leading-tight">
                      <div className="text-ink">{r.mau_vai || '—'}</div>
                      <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-primary">{fmtNum(r.con_kcs)}</td>
                    {O_SO.map(([k]) => {
                      const khoa = dangLuu || (f.kiemMotPhan && (k === 'soLuongThieu' || k === 'soLuongDu'));
                      return (
                        <td key={k} className="px-1 py-1">
                          <input type="number" min="0" inputMode="numeric" value={f[k]} disabled={khoa}
                            onChange={(e) => set(r.tem_id, k, e.target.value)}
                            className="h-9 w-full rounded-input border border-line bg-surface px-2 text-right text-sm tabular-nums focus:border-primary focus:outline-none disabled:opacity-50" />
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={!!f.kiemMotPhan} disabled={dangLuu}
                        onChange={(e) => setForms((all) => ({ ...all, [r.tem_id]: { ...f, kiemMotPhan: e.target.checked,
                          ...(e.target.checked ? { soLuongThieu: '', soLuongDu: '' } : {}) } }))} aria-label="Kiểm một phần" />
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {kq ? <span className={kq.ok ? 'text-success' : 'text-danger'}>{kq.ok ? '✓ ' : '✗ '}{kq.chu}</span>
                        : <span className={dg.ok ? (dg.motPhan ? 'text-amber-700 dark:text-amber-400' : 'text-success') : 'text-danger'}>{dg.chu}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
