import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import { recordSua } from '../../../services/qualityService';
import { fmtNum } from '../../../utils/format';

// ─── XÁC NHẬN SỬA NHIỀU TEM 1 LƯỢT (27/10/2026, người dùng: "Phân loại lỗi với Sửa cho thao tác nhanh giống KCS") ───
// Mỗi dòng = 1 tem: Sửa đạt (điền sẵn = cần sửa) · Sửa hủy · Hủy thẳng. Mỗi dòng đi ĐÚNG `recordSua` (POST
//   /quality/sua/:temId — khóa tem, tem 17 riêng mỗi lượt sửa đạt, ERP sửa đạt), TUẦN TỰ, dòng lỗi không chặn dòng sau.
//   Luật GƯƠNG BE `recordSua`: 0 < đạt + hủy + hủy thẳng ≤ cần sửa (nhỏ hơn = xử lý từng phần, phần còn lại ở lại màn Sửa).
//   In tem 17 vẫn ở sidebar "Đã hoàn thành" như lượt sửa lẻ.
const n = (v) => Math.max(0, Math.trunc(Number(v) || 0));
export function danhGiaSua(canSua, f) {
  const tong = n(f.soLuongSuaDat) + n(f.soLuongSuaHuy) + n(f.soLuongHuyThang);
  if (tong <= 0) return { ok: false, chu: 'Nhập số lượng' };
  if (tong > canSua) return { ok: false, chu: `Vượt ${fmtNum(tong - canSua)} (cần sửa ${fmtNum(canSua)})` };
  if (tong < canSua) return { ok: true, motPhan: true, chu: `Xử lý một phần · còn ${fmtNum(canSua - tong)} chờ sửa` };
  return { ok: true, chu: 'Xử lý hết' };
}

export const formMoi = (r) => ({ soLuongSuaDat: String(r.con_sua ?? ''), soLuongSuaHuy: '', soLuongHuyThang: '' });
export const O_SO = [['soLuongSuaDat', 'Sửa đạt'], ['soLuongSuaHuy', 'Sửa hủy'], ['soLuongHuyThang', 'Hủy thẳng']];

export default function SuaNhieuModal({ open, rows, onClose, onXong, truocXacNhan, show }) {
  const [forms, setForms] = useState({});
  const [ketQua, setKetQua] = useState({});
  const [dangLuu, setDangLuu] = useState(false);
  const [tienDo, setTienDo] = useState('');

  useEffect(() => {
    if (!open) return;
    setForms((cu) => Object.fromEntries((rows || []).map((r) => [r.tem_id, cu[r.tem_id] || formMoi(r)])));
    setKetQua((cu) => Object.fromEntries(Object.entries(cu).filter(([id, k]) => !k.ok && (rows || []).some((r) => r.tem_id === id))));
  }, [open, rows]);

  const set = (id, k, v) => setForms((f) => ({ ...f, [id]: { ...f[id], [k]: v } }));
  const danhGia = useMemo(() => Object.fromEntries((rows || []).map((r) => (
    [r.tem_id, danhGiaSua(Number(r.con_sua) || 0, forms[r.tem_id] || formMoi(r))]))), [rows, forms]);
  const soSai = (rows || []).filter((r) => !danhGia[r.tem_id]?.ok).length;
  const tong = (k) => (rows || []).reduce((s, r) => s + n(forms[r.tem_id]?.[k]), 0);

  const datHet = () => setForms((f) => Object.fromEntries((rows || []).map((r) => [r.tem_id, {
    ...(f[r.tem_id] || formMoi(r)), soLuongSuaDat: String(r.con_sua ?? ''), soLuongSuaHuy: '', soLuongHuyThang: '' }])));

  const luu = async () => {
    if (soSai) { show(`Còn ${soSai} dòng chưa hợp lệ — sửa trước khi lưu`, 'error'); return; }
    if (truocXacNhan && !(await truocXacNhan(rows))) return;
    setDangLuu(true);
    const ok = []; const loi = []; const kq = {};
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      setTienDo(`Đang lưu ${i + 1}/${rows.length} · ${r.ma_tem}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await recordSua(r.tem_id, { ...forms[r.tem_id] });
        const con = Number(res.data?.con_sua) || 0;
        kq[r.tem_id] = { ok: true, chu: con > 0 ? `Đã lưu · còn ${fmtNum(con)} chờ sửa` : 'Đã lưu' };
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
      title={`Xác nhận sửa — ${rows.length} tem`}
      footer={(
        <>
          {tienDo && <span className="mr-auto text-sm text-ink-soft">{tienDo}</span>}
          {!tienDo && soSai > 0 && <span className="mr-auto text-sm text-danger">{soSai} dòng chưa hợp lệ</span>}
          <Button chiXemOk variant="ghost" onClick={onClose} disabled={dangLuu}>Đóng</Button>
          <Button onClick={luu} loading={dangLuu} disabled={!rows.length || soSai > 0}>Xác nhận sửa ({rows.length})</Button>
        </>
      )}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button variant="secondary" icon="check" onClick={datHet} disabled={dangLuu}>Đạt hết (Sửa đạt = cần sửa)</Button>
          <span className="text-ink-soft">Tổng sửa đạt <b className="text-ink">{fmtNum(tong('soLuongSuaDat'))}</b> · sửa hủy <b className="text-ink">{fmtNum(tong('soLuongSuaHuy'))}</b> · hủy thẳng <b className="text-ink">{fmtNum(tong('soLuongHuyThang'))}</b></span>
          <span className="text-xs text-ink-soft">Nhập nhỏ hơn cần sửa = xử lý một phần, phần còn lại ở lại màn Sửa. Sửa đạt → OQC (in tem 17 ở "Đã hoàn thành").</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-card border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-2 py-2 text-right">STT</th>
                <th className="px-2 py-2">Tem</th>
                <th className="px-2 py-2">Đơn hàng · Mã hàng · Code phần</th>
                <th className="px-2 py-2">Màu · Kích vải · Kích phim</th>
                <th className="px-2 py-2 text-right">Cần sửa</th>
                {O_SO.map(([, l]) => <th key={l} className="w-24 px-2 py-2">{l}</th>)}
                <th className="px-2 py-2">Kiểm tra</th>
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
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-amber-600">{fmtNum(r.con_sua)}</td>
                    {O_SO.map(([k]) => (
                      <td key={k} className="px-1 py-1">
                        <input type="number" min="0" inputMode="numeric" value={f[k]} disabled={dangLuu}
                          onChange={(e) => set(r.tem_id, k, e.target.value)}
                          className="h-9 w-full rounded-input border border-line bg-surface px-2 text-right text-sm tabular-nums focus:border-primary focus:outline-none disabled:opacity-50" />
                      </td>
                    ))}
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
