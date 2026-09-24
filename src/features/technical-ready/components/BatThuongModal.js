import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import { Field, Input, Textarea } from '../../../components/common/controls';
import usePermissions from '../../../hooks/usePermissions';
import { khopNhieu } from '../../../utils/timKiem';
import { listBatThuong, danhDauBatThuong, goBatThuong } from '../../../services/readyService';

// ─────────────────────────────────────────────────────────────────────────────
// MODAL "PHẦN IN BẤT THƯỜNG" — màn Chuẩn bị kỹ thuật — READY (mig 103, 24/09/2026).
//   Trái : danh sách phần in ĐANG bị đánh dấu bất thường (lý do · người · giờ) — tích để GỠ.
//   Phải : chọn phần in từ danh sách READY đang tải (tìm không dấu) + ghi chú ⇒ "Đánh dấu bất thường".
// ⚠ Nguồn chọn = `rows` của màn READY (1 dòng / đợt) ⇒ KHỬ TRÙNG theo `id` phần in; ghi chú ở MỨC PHẦN IN.
// ⚠ Đánh dấu lại phần in đang bất thường = thay lý do (backend gỡ dấu cũ, giữ lịch sử).
// ─────────────────────────────────────────────────────────────────────────────

const QUYEN_GHI = ['READY_KHUON', 'READY_FILM', 'READY_MUC', 'READY_QC', 'READY_CANCEL'];
const fmt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');
const oTim = (r) => [r.ma_phan, r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.mau_vai, r.kich_vai, r.kich_phim];

export default function BatThuongModal({ open, onClose, rows = [], onToast, onChanged }) {
  const { can } = usePermissions();
  const coQuyenGhi = QUYEN_GHI.some((p) => can(p));
  const [ds, setDs] = useState([]);
  const [thieuMig, setThieuMig] = useState(false);
  const [dangTai, setDangTai] = useState(false);
  const [q, setQ] = useState('');
  const [chon, setChon] = useState(() => new Set());   // phần in sẽ đánh dấu
  const [chonGo, setChonGo] = useState(() => new Set()); // phần in sẽ gỡ dấu
  const [ghiChu, setGhiChu] = useState('');
  const [busy, setBusy] = useState(null);

  const tai = useCallback(async () => {
    setDangTai(true);
    try {
      const res = await listBatThuong();
      setDs(res.data.items || []);
      setThieuMig(!!res.data.thieu_migration);
    } catch (e) {
      onToast?.(e.message || 'Lỗi tải danh sách bất thường', 'error');
    } finally {
      setDangTai(false);
    }
  }, [onToast]);
  useEffect(() => {
    if (!open) return;
    setQ(''); setChon(new Set()); setChonGo(new Set()); setGhiChu('');
    tai();
  }, [open, tai]);

  // 1 dòng / phần in (màn READY tách dòng theo đợt vải).
  const phanIns = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => { if (r.id && !m.has(r.id)) m.set(r.id, r); });
    return [...m.values()];
  }, [rows]);
  const dangBT = useMemo(() => new Set(ds.map((d) => d.phan_in_id)), [ds]);
  const ungVien = useMemo(() => phanIns.filter((r) => khopNhieu(oTim(r), q)), [phanIns, q]);

  const bat = (set, setter, id) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); };

  const doDanhDau = async () => {
    setBusy('dd');
    try {
      const res = await danhDauBatThuong([...chon], ghiChu.trim());
      onToast?.(`Đã đánh dấu ${res.data.count} phần in bất thường`);
      setChon(new Set()); setGhiChu('');
      await tai(); onChanged?.();
    } catch (e) {
      onToast?.(e.message || 'Đánh dấu thất bại', 'error');
    } finally { setBusy(null); }
  };
  const doGo = async () => {
    setBusy('go');
    try {
      const res = await goBatThuong([...chonGo]);
      onToast?.(`Đã gỡ ${res.data.count} phần in khỏi danh sách bất thường`);
      setChonGo(new Set());
      await tai(); onChanged?.();
    } catch (e) {
      onToast?.(e.message || 'Gỡ thất bại', 'error');
    } finally { setBusy(null); }
  };

  return (
    <Modal open={open} onClose={onClose} size="full" canhTren={8} title="Phần in bất thường">
      {thieuMig ? (
        <div className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Chưa bật tính năng — cần chạy migration 103 (database/migrations/103_phan_in_ghi_chu.sql).
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── Đang bất thường ── */}
          <div className="flex min-w-0 flex-col rounded-card border border-line p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Icon name="alert-triangle" size={15} className="text-danger" /> Đang bất thường
                <Badge tone="danger">{ds.length}</Badge>
              </h3>
              {coQuyenGhi && chonGo.size > 0 && (
                <Button variant="secondary" loading={busy === 'go'} onClick={doGo}>Gỡ đánh dấu ({chonGo.size})</Button>
              )}
            </div>
            {dangTai ? <div className="py-6 text-center text-sm text-ink-soft">Đang tải…</div>
              : ds.length === 0 ? <div className="py-6 text-center text-sm text-ink-soft">Chưa có phần in nào bị đánh dấu.</div>
              : (
                <ul className="max-h-[65vh] space-y-2 overflow-auto pr-1">
                  {ds.map((d) => (
                    <li key={d.id} className="rounded-control border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm dark:border-rose-900/50 dark:bg-rose-950/20">
                      <label className={`flex gap-2 ${coQuyenGhi ? 'cursor-pointer' : ''}`}>
                        {coQuyenGhi && <input type="checkbox" className="mt-1" checked={chonGo.has(d.phan_in_id)}
                          onChange={() => bat(chonGo, setChonGo, d.phan_in_id)} />}
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-ink">{d.ma_phan}</span>
                          <span className="text-xs text-ink-soft"> · {[d.ten_khach_hang, d.ma_don_hang, d.ma_hang, d.mau_vai].filter(Boolean).join(' · ')}</span>
                          <span className="mt-1 block whitespace-pre-wrap break-words text-ink">{d.noi_dung}</span>
                          <span className="mt-0.5 block text-xs text-ink-soft">{[d.nguoi_tao, fmt(d.created_date)].filter(Boolean).join(' · ')}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
          </div>

          {/* ── Chọn phần in để đánh dấu ── */}
          {coQuyenGhi ? (
            <div className="flex min-w-0 flex-col rounded-card border border-line p-3">
              <h3 className="mb-2 text-sm font-semibold text-ink">Đánh dấu thêm (chọn từ danh sách READY)</h3>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm code phần, khách, đơn, mã hàng, màu/kích…" />
              <div className="mt-1 text-xs text-ink-soft">{ungVien.length}/{phanIns.length} phần in · đã chọn <b>{chon.size}</b></div>
              <ul className="mt-2 max-h-[40vh] space-y-1 overflow-auto pr-1">
                {ungVien.map((r) => (
                  <li key={r.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm hover:bg-surface-muted">
                      <input type="checkbox" className="mt-1" checked={chon.has(r.id)} onChange={() => bat(chon, setChon, r.id)} />
                      <span className="min-w-0">
                        <span className="font-medium text-ink">{r.ma_phan}</span>
                        {dangBT.has(r.id) && <Badge tone="danger" className="ml-1.5">Đang bất thường</Badge>}
                        <span className="block text-xs text-ink-soft">{[r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.mau_vai, r.kich_vai].filter(Boolean).join(' · ')}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-3" />
              <Field label="Ghi chú bất thường" required>
                <Textarea rows={3} maxLength={2000} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)}
                  placeholder="Mô tả bất thường (bắt buộc)…" />
              </Field>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-ink-soft">Phần in đang bất thường mà chọn lại ⇒ thay bằng ghi chú mới.</span>
                <Button icon="alert-triangle" loading={busy === 'dd'} disabled={!chon.size || !ghiChu.trim()} onClick={doDanhDau}>
                  Đánh dấu bất thường ({chon.size})
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-card border border-line p-3 text-sm text-ink-soft">Bạn chỉ có quyền xem danh sách này.</div>
          )}
        </div>
      )}
    </Modal>
  );
}
