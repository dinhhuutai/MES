import { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import { Textarea } from '../../../components/common/controls';
import { traVeKeHoachSx } from '../../../services/productionService';
import { fmtNum } from '../../../utils/format';
import { gomPhan, phanBoTraVe, conLai, daIn, slRelease, tongNhom } from '../utils/gomPhanSanXuat';

// ─────────────────────────────────────────────────────────────────────────────
// TRẢ VỀ KẾ HOẠCH KHI ĐANG CHẠY (22/10/2026, người dùng: "đang in được 1 nửa có thể trả về để làm lại kế hoạch chuyển
// qua máy khác in, trả về nhiều phần cùng lúc; hiện số vải còn lại, nhập tay sửa được, nhiều phần in thì nhiều hàng").
//   · 1 hàng / PHẦN (lệnh cùng code phần + cùng chuyền gom 1 hàng — `gomPhan`); ô "Trả về" mặc định = vải còn lại
//     (SL release − đã in), sửa được (0 … còn lại).
//   · Backend (`production.service traVeKeHoachSx`) với từng lệnh: giảm SL release đúng số trả về ⇒ phần đó hiện lại ở
//     Release 1 để lập kế hoạch máy khác, rồi CHẠY HOÀN TẤT lệnh ở máy này. Lệnh chưa in tem nào mà trả trọn ⇒ hủy
//     lệnh (đợt về Release 1). Nhập ít hơn số còn lại ⇒ phần chênh coi như hao hụt (lệnh đóng với SL thấp hơn).
//   · Hàng nhiều lệnh: số trả về rót vào lệnh CHƯA IN trước, lệnh đang in dở nhận phần còn lại (`phanBoTraVe`).
// ─────────────────────────────────────────────────────────────────────────────

const numCls = 'w-24 rounded-control border border-line bg-surface px-2 py-1.5 text-right text-base md:text-sm text-ink outline-none focus:border-primary';
const TH = 'whitespace-nowrap px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft';
const TD = 'px-2.5 py-2 text-sm text-ink align-top';
const soNguyen = (v) => Math.max(0, Math.trunc(Number(v) || 0));

// Lệnh sẽ ra sao sau khi trả về (gương nhánh của backend).
const ketQuaLenh = (p) => {
  const ma = p.run.lenh.ma_lenh_san_xuat;
  if (daIn(p.run) === 0 && p.soLuong >= slRelease(p.run)) return `${ma}: hủy lệnh, đợt về Release 1`;
  return `${ma}: chạy hoàn tất, giữ SL ${fmtNum(slRelease(p.run) - p.soLuong)}`;
};

export default function TraVeKeHoachModal({ open, onClose, runs, onXong }) {
  const nhom = gomPhan(runs || []);
  const [chon, setChon] = useState(() => new Set());
  const [sl, setSl] = useState({});
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState('');
  // ⚠ deps theo KHÓA CHUỖI (mảng `runs` tạo mới mỗi lần panel vẽ lại — §9).
  const khoa = nhom.map((g) => `${g.key}:${tongNhom(g.runs, conLai)}`).join(',');
  useEffect(() => {
    if (!open) return;
    const ds = khoa ? khoa.split(',').map((x) => { const i = x.lastIndexOf(':'); return [x.slice(0, i), x.slice(i + 1)]; }) : [];
    setChon(new Set(ds.filter(([, c]) => Number(c) > 0).map(([k]) => k)));
    setSl(Object.fromEntries(ds.map(([k, c]) => [k, c])));
    setLyDo(''); setLoi('');
  }, [open, khoa]);

  const so = (k) => soNguyen(sl[k]);
  const vuot = (g) => so(g.key) > tongNhom(g.runs, conLai);
  const chonDs = nhom.filter((g) => chon.has(g.key));
  const items = chonDs.flatMap((g) => phanBoTraVe(g.runs, so(g.key)));
  const coLoi = chonDs.some(vuot);
  const batChon = (k) => setChon((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });

  const gui = async () => {
    if (!lyDo.trim()) { setLoi('Nhập lý do trả về Kế hoạch'); return; }
    setBusy(true); setLoi('');
    try {
      const res = await traVeKeHoachSx({
        items: items.map((p) => ({ lenhId: p.run.lenh.id, soLuong: p.soLuong })), lyDo: lyDo.trim(),
      });
      const { ok = [], loi: dsLoi = [] } = res.data || {};
      if (dsLoi.length) {
        setLoi(`Đã trả về ${ok.length}/${items.length} lệnh · lỗi: ${dsLoi.map((x) => `${x.ma || ''} ${x.message}`).join(' · ')}`);
        return;
      }
      const tong = ok.reduce((s, x) => s + (Number(x.tra_ve) || 0), 0);
      onXong?.({
        thongBao: `Đã trả về Kế hoạch ${fmtNum(tong)} pcs (${fmtNum(ok.length)} lệnh) — lập kế hoạch lại ở Release 1`,
        conChay: (runs || []).length > ok.length,
      });
    } catch (e) {
      setLoi(e.message || 'Trả về Kế hoạch thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" title="Trả về Kế hoạch (đang chạy)"
      footer={<>
        <Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>
        <Button variant="danger" icon="undo" loading={busy} disabled={busy || !items.length || coLoi || !lyDo.trim()} onClick={gui}>
          Trả về Kế hoạch ({fmtNum(items.length)} lệnh)
        </Button>
      </>}>
      <div className="overflow-auto rounded-card border border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              <th className={TH} />
              <th className={TH}>Code phần</th>
              <th className={`${TH} text-right`}>SL release</th>
              <th className={`${TH} text-right`}>Đã in</th>
              <th className={`${TH} text-right`}>Vải còn lại</th>
              <th className={`${TH} text-right`}>Trả về</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {nhom.map((g) => {
              const r0 = g.runs[0];
              const info = (r0.dot_vai || [])[0] || {};
              const dangChon = chon.has(g.key);
              const phan = dangChon ? phanBoTraVe(g.runs, so(g.key)) : [];
              return (
                <tr key={g.key} className={dangChon ? '' : 'opacity-60'}>
                  <td className={TD}>
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={dangChon} onChange={() => batChon(g.key)}
                      aria-label="Chọn để trả về Kế hoạch" />
                  </td>
                  <td className={TD}>
                    <div className="font-medium">{r0.co_gom_set ? r0.lenh.phan_list : (info.ma_phan || r0.lenh.phan_list || '—')}</div>
                    <div className="text-xs text-ink-soft">
                      {[info.ma_hang, info.mau_vai, info.kich_vai].filter(Boolean).join(' · ')}
                    </div>
                    {dangChon && phan.length > 0 && (
                      <div className="mt-1 text-[11px] text-ink-soft">{phan.map(ketQuaLenh).join(' · ')}</div>
                    )}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtNum(tongNhom(g.runs, slRelease))}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtNum(tongNhom(g.runs, daIn))}</td>
                  <td className={`${TD} text-right tabular-nums font-semibold`}>{fmtNum(tongNhom(g.runs, conLai))}</td>
                  <td className={`${TD} text-right`}>
                    <input type="number" min="0" value={sl[g.key] ?? ''} disabled={!dangChon} aria-label="SL trả về"
                      onChange={(e) => setSl((s) => ({ ...s, [g.key]: e.target.value }))}
                      className={`${numCls} ${dangChon && vuot(g) ? 'border-danger focus:border-danger' : ''}`} />
                    {dangChon && vuot(g) && <div className="mt-0.5 text-[11px] text-danger">Vượt vải còn lại</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-ink">Lý do trả về <span className="text-danger">*</span></span>
        <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Vd: máy hỏng, chuyển sang máy khác in..." />
      </label>
      {loi && <div className="mt-2 text-sm text-danger">{loi}</div>}
    </Modal>
  );
}
