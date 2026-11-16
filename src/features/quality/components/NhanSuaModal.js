import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import { Input } from '../../../components/common/controls';
import { listChoNhanSua, nhanSua } from '../../../services/qualityService';
import { fmtNum, timTheoMaTem } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// HỘP "NHẬN SỬA" (mig 132, 14/11/2026 — người dùng chốt) — mở từ màn Sửa (và trang Hệ thống › Chờ nhận sửa).
// Tem đã phân loại lỗi còn phần CHỜ NHẬN ⇒ tích tem + nhập SL nhận hôm nay (mặc định = còn chờ nhận, sửa được) ⇒ chỉ phần
// đã nhận lên màn Sửa. 1 tem sửa nhiều ngày: cần sửa 8, hôm nay nhận 3 ⇒ sửa 3; mai nhận tiếp 5.
// Ô quét/tìm: quét đủ mã ⇒ tự tích tem + nhảy vào ô SL; ngừng gõ 0,5 s tự tra (Enter tra ngay). Gõ dở ⇒ lọc bảng.
// Luật + chặn ở BE `quality/nhansua.service.js` (SL ≤ chờ nhận, cả lô 1 transaction).
// ─────────────────────────────────────────────────────────────────────────────
const soNguyen = (v) => {
  const n = Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : 0;
};
const khongDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

export default function NhanSuaModal({ open, onClose, show, onDone }) {
  const [rows, setRows] = useState([]);
  const [coCot, setCoCot] = useState(true);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [chon, setChon] = useState(() => new Map()); // tem_id → chuỗi SL nhận
  const [ghiChu, setGhiChu] = useState('');
  const [saving, setSaving] = useState(false);
  const [vuaQuet, setVuaQuet] = useState(null);
  const oSl = useRef({});
  const oQuet = useRef(null);

  useEffect(() => {
    if (!open) return;
    setChon(new Map()); setQ(''); setGhiChu(''); setVuaQuet(null);
    setLoading(true);
    listChoNhanSua()
      .then((r) => { setRows(r.data?.items || []); setCoCot(r.data?.co_cot !== false); })
      .catch((e) => show && show(e.message || 'Không tải được danh sách chờ nhận sửa', 'error'))
      .finally(() => setLoading(false));
  }, [open, show]);

  const tich = (r, sl) => setChon((m) => {
    const n = new Map(m);
    if (sl === undefined && n.has(r.tem_id)) n.delete(r.tem_id);
    else n.set(r.tem_id, String(sl ?? r.cho_nhan));
    return n;
  });

  // Tra mã: khớp đúng 1 tem ⇒ tích + vào ô SL; không khớp thì để ô tìm lọc bảng.
  const traMa = (giaTri) => {
    const code = String(giaTri || '').trim();
    if (!code) return false;
    const r = timTheoMaTem(rows, code);
    if (!r) return false;
    setChon((m) => (m.has(r.tem_id) ? m : new Map(m).set(r.tem_id, String(r.cho_nhan))));
    setQ('');
    setVuaQuet({ tone: 'ok', chu: `Đã tích ${r.ma_tem} · chờ nhận ${fmtNum(r.cho_nhan)}` });
    setTimeout(() => { const o = oSl.current[r.tem_id]; if (o) { o.focus(); o.select(); } }, 0);
    return true;
  };
  useEffect(() => {
    if (!q.trim()) return undefined;
    const h = setTimeout(() => { traMa(q); }, 500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hien = useMemo(() => {
    const k = khongDau(q.trim());
    if (!k) return rows;
    return rows.filter((r) => chon.has(r.tem_id) || khongDau([r.ma_tem, r.phan_list, r.ma_hang, r.ten_khach_hang,
      r.ma_don_hang, r.mau_vai, r.ma_chuyen].join(' ')).includes(k));
  }, [rows, q, chon]);

  const loiDong = (r) => {
    if (!chon.has(r.tem_id)) return null;
    const sl = soNguyen(chon.get(r.tem_id));
    if (!sl) return 'Nhập số nguyên > 0';
    if (sl > (Number(r.cho_nhan) || 0)) return `Tối đa ${fmtNum(r.cho_nhan)}`;
    return null;
  };
  const dsChon = rows.filter((r) => chon.has(r.tem_id));
  const coLoi = dsChon.some((r) => loiDong(r));
  const tongSl = dsChon.reduce((s, r) => s + soNguyen(chon.get(r.tem_id)), 0);
  const tatCa = hien.length > 0 && hien.every((r) => chon.has(r.tem_id));
  const tichTatCa = () => setChon((m) => {
    const n = new Map(m);
    if (tatCa) hien.forEach((r) => n.delete(r.tem_id));
    else hien.forEach((r) => { if (!n.has(r.tem_id)) n.set(r.tem_id, String(r.cho_nhan)); });
    return n;
  });

  const xacNhan = async () => {
    if (!dsChon.length || coLoi || saving) return;
    setSaving(true);
    try {
      const res = await nhanSua(dsChon.map((r) => ({ temId: r.tem_id, soLuong: soNguyen(chon.get(r.tem_id)) })), ghiChu.trim());
      const d = res.data || {};
      show && show(`Đã nhận sửa ${fmtNum(d.so_tem)} tem · ${fmtNum(d.tong_sl)} pcs — đã lên màn Sửa`);
      if (onDone) onDone(d);
      onClose();
    } catch (e) {
      show && show(e.message || 'Nhận sửa thất bại', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay title="Nhận sửa — tích tem, nhập số lượng nhận"
      footer={(
        <>
          <div className="mr-auto w-full sm:w-80">
            <Input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú (tùy chọn)" maxLength={300} />
          </div>
          <Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>
          <Button icon="check" onClick={xacNhan} loading={saving} disabled={!dsChon.length || coLoi || !coCot}>
            Xác nhận nhận sửa ({dsChon.length} tem · {fmtNum(tongSl)} pcs)
          </Button>
        </>
      )}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        {!coCot && (
          <div className="rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <b>Chưa chạy migration 132 (Nhận sửa).</b> Màn Sửa đang chạy như cũ (phân loại lỗi xong lên thẳng màn Sửa).
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-96">
            <Input ref={oQuet} autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!traMa(q)) setVuaQuet({ tone: 'loi', chu: `Không có tem chờ nhận sửa khớp "${q.trim()}"` }); } }}
              placeholder="Quét / gõ mã tem, code phần, mã hàng…" />
          </div>
          {vuaQuet && <span className={`text-xs ${vuaQuet.tone === 'ok' ? 'text-success' : 'text-danger'}`}>{vuaQuet.chu}</span>}
          <span className="ml-auto text-xs text-ink-soft">
            {fmtNum(rows.length)} tem chờ nhận · tổng {fmtNum(rows.reduce((s, r) => s + (Number(r.cho_nhan) || 0), 0))} pcs
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-card border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted text-xs text-ink-soft">
              <tr>
                <th className="w-10 px-3 py-2 text-left">
                  <input type="checkbox" checked={tatCa} onChange={tichTatCa} disabled={!hien.length}
                    className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
                </th>
                <th className="px-3 py-2 text-left">Tem</th>
                <th className="px-3 py-2 text-left">Khách · Mã hàng</th>
                <th className="px-3 py-2 text-left">Code phần</th>
                <th className="px-3 py-2 text-left">Màu · Kích vải / phim</th>
                <th className="px-3 py-2 text-left">Chuyền</th>
                <th className="px-3 py-2 text-right">Cần sửa</th>
                <th className="px-3 py-2 text-right">Đã nhận</th>
                <th className="px-3 py-2 text-right">Chờ nhận</th>
                <th className="w-32 px-3 py-2 text-right">SL nhận</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="px-3 py-6 text-center text-ink-soft">Đang tải…</td></tr>}
              {!loading && !hien.length && (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-ink-soft">
                  {rows.length ? 'Không có tem khớp ô tìm' : 'Không có tem nào chờ nhận sửa'}
                </td></tr>
              )}
              {!loading && hien.map((r) => {
                const dc = chon.has(r.tem_id);
                const loi = loiDong(r);
                return (
                  <tr key={r.tem_id} className={`border-t border-line ${dc ? 'bg-primary/5' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={dc} onChange={() => tich(r)}
                        className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
                    </td>
                    <td className="px-3 py-2"><Badge tone="warning">{r.ma_tem}</Badge></td>
                    <td className="px-3 py-2 leading-tight">
                      <div className="text-ink">{r.ten_khach_hang || '—'}</div>
                      <div className="text-xs text-ink-soft">{r.ma_hang || ''}</div>
                    </td>
                    <td className="px-3 py-2">{r.phan_list || '—'}</td>
                    <td className="px-3 py-2 leading-tight">
                      <div className="text-ink">{r.mau_vai || '—'}</div>
                      <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' / ')}</div>
                    </td>
                    <td className="px-3 py-2">{r.ma_chuyen || r.ten_chuyen || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.con_sua_tong)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.da_nhan)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-primary">{fmtNum(r.cho_nhan)}</td>
                    <td className="px-3 py-2 text-right">
                      <input ref={(el) => { oSl.current[r.tem_id] = el; }} inputMode="numeric" disabled={!dc}
                        value={dc ? chon.get(r.tem_id) : ''} placeholder={dc ? '' : '—'}
                        onChange={(e) => tich(r, e.target.value.replace(/[^\d]/g, ''))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); oQuet.current?.focus(); } }}
                        className={`h-9 w-24 rounded-input border bg-surface px-2 text-right text-sm tabular-nums focus:outline-none ${
                          loi ? 'border-danger focus:border-danger' : 'border-line focus:border-primary'} disabled:bg-surface-muted`} />
                      {loi && <div className="mt-0.5 text-[11px] text-danger">{loi}</div>}
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
