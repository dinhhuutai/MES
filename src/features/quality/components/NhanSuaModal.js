import { useEffect, useRef, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import { Input } from '../../../components/common/controls';
import { listChoNhanSua, nhanSua } from '../../../services/qualityService';
import { fmtNum, timTheoMaTem } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// HỘP "NHẬN SỬA" (mig 132, 14/11/2026 — người dùng chốt) — mở từ màn Sửa (và trang Hệ thống › Chờ nhận sửa).
// ⚠ 18/11/2026 (người dùng: "modal nhận sửa trống luôn, tích tem thì mới hiện lên — như phân loại lỗi"): hộp mở TRỐNG,
//   quét / gõ mã tem ⇒ tem đó thêm thành 1 dòng (SL nhận điền sẵn = còn chờ nhận, sửa được) ⇒ "Xác nhận nhận sửa" ⇒ đúng
//   số đó lên màn Sửa. Danh sách đầy đủ tem chờ nhận xem ở *Hệ thống › Chờ nhận sửa*.
//   · Danh sách chờ nhận vẫn nạp lúc mở (chỉ để TRA mã, không hiện); quét không thấy + Enter ⇒ nạp lại 1 lần rồi tra lại
//     (tem vừa phân loại sau lúc mở hộp vẫn quét được). Quét nhãn 16/17 tự quy về tem gốc (`timTheoMaTem`).
//   · Ngừng gõ 0,5 s tự tra (không báo lỗi khi chưa khớp); Enter tra ngay + báo lỗi nếu không có.
// Luật + chặn ở BE `quality/nhansua.service.js` (SL ≤ chờ nhận, cả lô 1 transaction).
// ─────────────────────────────────────────────────────────────────────────────
const soNguyen = (v) => {
  const n = Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export default function NhanSuaModal({ open, onClose, show, onDone }) {
  const [ds, setDs] = useState([]);           // mọi tem đang chờ nhận — chỉ để tra mã
  const dsRef = useRef([]);
  const [coCot, setCoCot] = useState(true);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [chon, setChon] = useState([]);       // [{ r, sl }] theo thứ tự quét
  const [ghiChu, setGhiChu] = useState('');
  const [saving, setSaving] = useState(false);
  const [vuaQuet, setVuaQuet] = useState(null);
  const oSl = useRef({});
  const oQuet = useRef(null);

  const napDs = async () => {
    const r = await listChoNhanSua();
    const items = r.data?.items || [];
    dsRef.current = items;
    setDs(items);
    setCoCot(r.data?.co_cot !== false);
    return items;
  };

  useEffect(() => {
    if (!open) return;
    setChon([]); setQ(''); setGhiChu(''); setVuaQuet(null);
    setLoading(true);
    napDs()
      .catch((e) => show && show(e.message || 'Không tải được danh sách chờ nhận sửa', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, show]);

  const vaoOSl = (temId) => setTimeout(() => { const o = oSl.current[temId]; if (o) { o.focus(); o.select(); } }, 0);

  // Tra mã: khớp ⇒ thêm dòng (đã có thì chỉ nhảy vào ô SL). `baoLoi` ⇒ báo khi không thấy; `taiLai` ⇒ nạp lại danh sách 1 lần.
  const traMa = async (giaTri, { baoLoi = false, taiLai = false } = {}) => {
    const code = String(giaTri || '').trim();
    if (!code) return;
    let r = timTheoMaTem(dsRef.current, code);
    if (!r && taiLai) {
      try { r = timTheoMaTem(await napDs(), code); } catch { /* báo lỗi chung bên dưới */ }
    }
    if (!r) {
      if (baoLoi) {
        setVuaQuet({ tone: 'loi', chu: `Tem "${code}" không có phần chờ nhận sửa — chưa phân loại lỗi, hoặc đã nhận hết (xem màn Sửa)` });
      }
      return;
    }
    setQ('');
    if (chon.some((x) => x.r.tem_id === r.tem_id)) {
      setVuaQuet({ tone: 'ok', chu: `${r.ma_tem} đã có trong danh sách — sửa SL nhận nếu cần` });
    } else {
      setChon((c) => [...c, { r, sl: String(r.cho_nhan) }]);
      setVuaQuet({ tone: 'ok', chu: `Đã thêm ${r.ma_tem} · chờ nhận ${fmtNum(r.cho_nhan)}` });
    }
    vaoOSl(r.tem_id);
  };
  useEffect(() => {
    if (!q.trim()) return undefined;
    const h = setTimeout(() => { traMa(q); }, 500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const doiSl = (temId, sl) => setChon((c) => c.map((x) => (x.r.tem_id === temId ? { ...x, sl } : x)));
  const bo = (temId) => setChon((c) => c.filter((x) => x.r.tem_id !== temId));

  const loiDong = (x) => {
    const sl = soNguyen(x.sl);
    if (!sl) return 'Nhập số nguyên > 0';
    if (sl > (Number(x.r.cho_nhan) || 0)) return `Tối đa ${fmtNum(x.r.cho_nhan)}`;
    return null;
  };
  const coLoi = chon.some((x) => loiDong(x));
  const tongSl = chon.reduce((s, x) => s + soNguyen(x.sl), 0);

  const xacNhan = async () => {
    if (!chon.length || coLoi || saving) return;
    setSaving(true);
    try {
      const res = await nhanSua(chon.map((x) => ({ temId: x.r.tem_id, soLuong: soNguyen(x.sl) })), ghiChu.trim());
      const d = res.data || {};
      show && show(`Đã nhận sửa ${fmtNum(d.so_tem)} tem · ${fmtNum(d.tong_sl)} pcs — đã lên màn Sửa`);
      if (onDone) onDone(d);
      onClose();
    } catch (e) {
      show && show(e.message || 'Nhận sửa thất bại', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay title="Nhận sửa — quét tem, nhập số lượng nhận"
      footer={(
        <>
          <div className="mr-auto w-full sm:w-80">
            <Input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú (tùy chọn)" maxLength={300} />
          </div>
          <Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>
          <Button icon="check" onClick={xacNhan} loading={saving} disabled={!chon.length || coLoi || !coCot}>
            Xác nhận nhận sửa ({chon.length} tem · {fmtNum(tongSl)} pcs)
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
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); traMa(q, { baoLoi: true, taiLai: true }); } }}
              placeholder="Quét / gõ mã tem rồi Enter để thêm…" />
          </div>
          {vuaQuet && <span className={`text-xs ${vuaQuet.tone === 'ok' ? 'text-success' : 'text-danger'}`}>{vuaQuet.chu}</span>}
          <span className="ml-auto text-xs text-ink-soft">
            {loading ? 'Đang tải…' : `${fmtNum(ds.length)} tem đang chờ nhận (xem ở Hệ thống › Chờ nhận sửa)`}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-card border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted text-xs text-ink-soft">
              <tr>
                <th className="w-10 px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Tem</th>
                <th className="px-3 py-2 text-left">Khách · Mã hàng</th>
                <th className="px-3 py-2 text-left">Code phần</th>
                <th className="px-3 py-2 text-left">Màu · Kích vải / phim</th>
                <th className="px-3 py-2 text-left">Chuyền</th>
                <th className="px-3 py-2 text-right">Cần sửa</th>
                <th className="px-3 py-2 text-right">Đã nhận</th>
                <th className="px-3 py-2 text-right">Chờ nhận</th>
                <th className="w-32 px-3 py-2 text-right">SL nhận</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {!chon.length && (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-ink-soft">
                  Chưa có tem nào — quét mã tem (nhãn 15 / 16 đều được) để thêm vào lượt nhận sửa
                </td></tr>
              )}
              {chon.map((x, i) => {
                const { r } = x;
                const loi = loiDong(x);
                return (
                  <tr key={r.tem_id} className="border-t border-line">
                    <td className="px-3 py-2 text-ink-soft tabular-nums">{i + 1}</td>
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
                      <input ref={(el) => { oSl.current[r.tem_id] = el; }} inputMode="numeric"
                        value={x.sl} onChange={(e) => doiSl(r.tem_id, e.target.value.replace(/[^\d]/g, ''))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); oQuet.current?.focus(); } }}
                        className={`h-9 w-24 rounded-input border bg-surface px-2 text-right text-sm tabular-nums focus:outline-none ${
                          loi ? 'border-danger focus:border-danger' : 'border-line focus:border-primary'}`} />
                      {loi && <div className="mt-0.5 text-[11px] text-danger">{loi}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => bo(r.tem_id)} aria-label={`Bỏ tem ${r.ma_tem}`}
                        className="text-ink-soft hover:text-danger"><Icon name="x" size={16} /></button>
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
