import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import SearchableSelect from '../../../components/common/SearchableSelect';
import { luuPhanLoaiLoi } from '../../../services/phanLoaiLoiService';
import { fmtNum, temCode } from '../../../utils/format';

// ─── PHÂN LOẠI LỖI NHIỀU TEM 1 LƯỢT (27/10/2026, người dùng: "Phân loại lỗi với Sửa cho thao tác nhanh giống KCS") ───
// Mỗi dòng = 1 tem CHƯA phân loại, 1 mã lỗi: Mã lỗi · Biện pháp · SL sửa (điền sẵn = SL hư) · SL hủy. Tem cần NHIỀU mã lỗi
//   thì mở panel từng tem như cũ. Mỗi dòng đi ĐÚNG `luuPhanLoaiLoi` (POST /quality/phan-loai-loi/:temId — đủ guard
//   "sửa + hủy = hư" + ERP), TUẦN TỰ, dòng lỗi không chặn dòng sau. Ô "Áp cho mọi dòng" điền 1 mã lỗi / biện pháp cho cả lượt.
const so = (v) => Math.max(0, Math.trunc(Number(v) || 0));
export const slHuCua = (r) => so(r.sl_kcs_sua) + so(r.sl_kcs_huy);
export const formMoi = (r) => ({ loaiLoiId: '', bienPhapId: '', soLuongSua: String(slHuCua(r)), soLuongHuy: '' });

export function danhGia(r, f) {
  const hu = slHuCua(r);
  if (hu <= 0) return { ok: false, chu: 'KCS chưa ghi hư' };
  if (!f.loaiLoiId) return { ok: false, chu: 'Chọn mã lỗi' };
  const lech = so(f.soLuongSua) + so(f.soLuongHuy) - hu;
  if (lech !== 0) return { ok: false, chu: `Lệch ${lech > 0 ? '+' : ''}${fmtNum(lech)} (phải = ${fmtNum(hu)} hư)` };
  return { ok: true, chu: 'Khớp' };
}

export default function PhanLoaiNhieuModal({ open, rows, loaiLoi, bienPhap, onClose, onXong, show }) {
  const [forms, setForms] = useState({});
  const [ketQua, setKetQua] = useState({}); // tem_id → { ok, chu }
  const [dangLuu, setDangLuu] = useState(false);
  const [tienDo, setTienDo] = useState('');
  const [chung, setChung] = useState({ loaiLoiId: '', bienPhapId: '' });

  useEffect(() => {
    if (!open) return;
    setForms((cu) => Object.fromEntries((rows || []).map((r) => [r.tem_id, cu[r.tem_id] || formMoi(r)])));
    setKetQua((cu) => Object.fromEntries(Object.entries(cu).filter(([id, k]) => !k.ok && (rows || []).some((r) => r.tem_id === id))));
  }, [open, rows]);

  // ⚠ `SearchableSelect` mặc định `getValue = (o) => o.id`.
  const optLoi = useMemo(() => (loaiLoi || []).map((l) => ({
    id: l.id, label: `${l.ma_loi} — ${l.ten_loi}`, search: `${l.ma_loi} ${l.ten_loi} ${l.nhom_loi || ''}`,
  })), [loaiLoi]);
  const optBP = useMemo(() => (bienPhap || []).map((b) => ({
    id: b.id, label: b.ten_bien_phap, search: `${b.ma_bien_phap} ${b.ten_bien_phap}`,
  })), [bienPhap]);

  const set = (id, v) => setForms((f) => ({ ...f, [id]: { ...f[id], ...v } }));
  const dg = useMemo(() => Object.fromEntries((rows || []).map((r) => [r.tem_id, danhGia(r, forms[r.tem_id] || formMoi(r))])), [rows, forms]);
  const soSai = (rows || []).filter((r) => !dg[r.tem_id]?.ok).length;

  const apChung = () => setForms((f) => Object.fromEntries((rows || []).map((r) => [r.tem_id, {
    ...(f[r.tem_id] || formMoi(r)),
    ...(chung.loaiLoiId ? { loaiLoiId: chung.loaiLoiId } : {}),
    ...(chung.bienPhapId ? { bienPhapId: chung.bienPhapId } : {}),
  }])));
  const tatCa = (kieu) => setForms((f) => Object.fromEntries((rows || []).map((r) => [r.tem_id, {
    ...(f[r.tem_id] || formMoi(r)),
    soLuongSua: kieu === 'SUA' ? String(slHuCua(r)) : '', soLuongHuy: kieu === 'HUY' ? String(slHuCua(r)) : '',
  }])));

  const luu = async () => {
    if (soSai) { show(`Còn ${soSai} dòng chưa đủ — chọn mã lỗi và cho sửa + hủy = SL hư`, 'error'); return; }
    setDangLuu(true);
    const ok = []; const loi = []; const kq = {};
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const f = forms[r.tem_id];
      setTienDo(`Đang lưu ${i + 1}/${rows.length} · ${temCode(r.ma_tem, 16)}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        await luuPhanLoaiLoi(r.tem_id, {
          dong: [{ loaiLoiId: f.loaiLoiId, bienPhapId: f.bienPhapId || null, soLuongSua: so(f.soLuongSua), soLuongHuy: so(f.soLuongHuy), ghiChu: '' }],
          ghiChu: '',
        });
        kq[r.tem_id] = { ok: true, chu: 'Đã lưu' };
        ok.push(r.tem_id);
      } catch (e) {
        kq[r.tem_id] = { ok: false, chu: e.message || 'Lưu lỗi' };
        loi.push(temCode(r.ma_tem, 16));
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
      title={`Phân loại lỗi — ${rows.length} tem`}
      footer={(
        <>
          {tienDo && <span className="mr-auto text-sm text-ink-soft">{tienDo}</span>}
          {!tienDo && soSai > 0 && <span className="mr-auto text-sm text-danger">{soSai} dòng chưa đủ</span>}
          <Button chiXemOk variant="ghost" onClick={onClose} disabled={dangLuu}>Đóng</Button>
          <Button onClick={luu} loading={dangLuu} disabled={!rows.length || soSai > 0}>Lưu phân loại ({rows.length})</Button>
        </>
      )}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <div className="w-72">
            <div className="mb-1 text-xs font-medium text-ink-soft">Mã lỗi chung</div>
            <SearchableSelect options={optLoi} value={chung.loaiLoiId} getSearch={(o) => o.search}
              onChange={(v) => setChung((c) => ({ ...c, loaiLoiId: v }))} placeholder="Gõ mã hoặc tên lỗi…" />
          </div>
          <div className="w-60">
            <div className="mb-1 text-xs font-medium text-ink-soft">Biện pháp chung</div>
            <SearchableSelect options={optBP} value={chung.bienPhapId} getSearch={(o) => o.search}
              onChange={(v) => setChung((c) => ({ ...c, bienPhapId: v }))} placeholder="Chọn biện pháp…" />
          </div>
          <Button variant="secondary" icon="check" onClick={apChung} disabled={dangLuu || (!chung.loaiLoiId && !chung.bienPhapId)}>Áp cho mọi dòng</Button>
          <Button variant="secondary" onClick={() => tatCa('SUA')} disabled={dangLuu}>Tất cả SỬA</Button>
          <Button variant="secondary" onClick={() => tatCa('HUY')} disabled={dangLuu}>Tất cả HỦY</Button>
          <span className="text-xs text-ink-soft">Mỗi tem 1 mã lỗi, sửa + hủy phải bằng đúng SL hư KCS đã ghi. Tem cần nhiều mã lỗi thì mở từng tem.</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-card border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-2 py-2 text-right">STT</th>
                <th className="px-2 py-2">Tem</th>
                <th className="px-2 py-2">Đơn hàng · Mã hàng · Code phần</th>
                <th className="px-2 py-2">Màu · Kích vải · Kích phim</th>
                <th className="px-2 py-2 text-right">SL hư</th>
                <th className="px-2 py-2" style={{ minWidth: 220 }}>Mã lỗi</th>
                <th className="px-2 py-2" style={{ minWidth: 170 }}>Biện pháp</th>
                <th className="w-24 px-2 py-2">SL sửa</th>
                <th className="w-24 px-2 py-2">SL hủy</th>
                <th className="px-2 py-2">Kiểm tra</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const f = forms[r.tem_id] || formMoi(r);
                const d = dg[r.tem_id] || {};
                const k = ketQua[r.tem_id];
                return (
                  <tr key={r.tem_id} className={`border-t border-line/70 align-middle ${k && !k.ok ? 'bg-danger/5' : ''}`}>
                    <td className="px-2 py-1.5 text-right tabular-nums text-ink-soft">{i + 1}</td>
                    <td className="px-2 py-1.5"><Badge tone="info">{temCode(r.ma_tem, 16)}</Badge></td>
                    <td className="px-2 py-1.5 leading-tight">
                      <div className="text-ink">{[r.ma_don_hang, r.ma_hang].filter(Boolean).join(' · ') || '—'}</div>
                      <div className="text-xs text-ink-soft">{r.ma_phan || ''}</div>
                    </td>
                    <td className="px-2 py-1.5 leading-tight">
                      <div className="text-ink">{r.mau_vai || '—'}</div>
                      <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-danger">{fmtNum(slHuCua(r))}</td>
                    <td className="px-1 py-1">
                      <SearchableSelect options={optLoi} value={f.loaiLoiId} getSearch={(o) => o.search}
                        onChange={(v) => set(r.tem_id, { loaiLoiId: v })} placeholder="Gõ mã lỗi…" />
                    </td>
                    <td className="px-1 py-1">
                      <SearchableSelect options={optBP} value={f.bienPhapId} getSearch={(o) => o.search}
                        onChange={(v) => set(r.tem_id, { bienPhapId: v })} placeholder="Biện pháp…" />
                    </td>
                    {['soLuongSua', 'soLuongHuy'].map((key) => (
                      <td key={key} className="px-1 py-1">
                        <input type="number" min="0" inputMode="numeric" value={f[key]} disabled={dangLuu}
                          onChange={(e) => set(r.tem_id, { [key]: e.target.value })}
                          className="h-9 w-full rounded-input border border-line bg-surface px-2 text-right text-sm tabular-nums focus:border-primary focus:outline-none disabled:opacity-50" />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-xs">
                      {k ? <span className={k.ok ? 'text-success' : 'text-danger'}>{k.ok ? '✓ ' : '✗ '}{k.chu}</span>
                        : <span className={d.ok ? 'text-success' : 'text-danger'}>{d.chu}</span>}
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
