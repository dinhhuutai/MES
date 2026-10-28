import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import Spinner from '../../../components/common/Spinner';
import { Field, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import { fmtNum, fmtDate, fmtDateTime } from '../../../utils/format';
import { timBtpKhacKh, datBtpKhacKh } from '../../../services/planningService';

// ─────────────────────────────────────────────────────────────────────────────
// BTP KHÁC KẾ HOẠCH (mig 120, 28/10/2026, người dùng yêu cầu). In bán thành phẩm = in 2 ĐẦU tấm vải; 2 đầu có thể ở 2
// kế hoạch khác nhau (máy / ngày khác) ⇒ đợt vải phải Release 1 HAI LẦN. Lúc Release 1 có ô tích "BTP khác KH"; quên
// tích ⇒ tìm phần in ở đây, bật cờ cho đợt ⇒ đợt quay về Release 1 với "Còn release" = SL vải cho đầu kia.
// Luật số ở BE `utils/btpKhacKh.js` (BE trả sẵn `con_release`, `so_dau_btp`, `btp_cho`); trang chỉ hiện + thêm / bỏ đầu
// (lý do bắt buộc). 29/10/2026: nhiều đầu — "Thêm 1 đầu" khi không có đầu chờ, "Bỏ đầu chờ" khi đợt đang có đầu chờ.
// ─────────────────────────────────────────────────────────────────────────────

const TT_LENH = { RELEASE_1: 'Test Run', RELEASE_2: 'Chờ SX', SAN_XUAT: 'Đang SX', HOAN_TAT: 'Hoàn tất', GIA_CONG: 'Gia công', CHO_IN_XONG: 'Chờ in xong' };

// Nhóm dòng (1 dòng / đợt vải) theo phần in.
function gomTheoPhanIn(rows) {
  const m = new Map();
  (rows || []).forEach((r) => {
    if (!m.has(r.phan_in_id)) m.set(r.phan_in_id, { ...r, dots: [] });
    m.get(r.phan_in_id).dots.push(r);
  });
  return [...m.values()];
}

// Trạng thái của đợt đối với Release 1 (để người dùng biết bật xong đợt có quay về không).
function tinhTrang(d) {
  if (!d.da_len_ready) return { ten: 'Chưa lên READY', tone: 'default' };
  if (d.co_ke_hoach_tam) return { ten: 'Đang ở Kế hoạch tạm', tone: 'warning' };
  if (d.con_release > 0) return { ten: `Đang ở Release 1 · còn ${fmtNum(d.con_release)}`, tone: 'info' };
  return { ten: 'Đã release hết', tone: 'success' };
}

// Số đầu BTP của đợt (1 = thường) — BE trả `so_dau_btp` (29/10/2026: nhiều đầu, mỗi lần "Thêm 1 đầu" +1).
const soDau = (d) => Math.max(1, Number(d.so_dau_btp) || (d.btp_khac_kh ? 2 : 1));

function DotRow({ d, onDoi, khoa }) {
  const tt = tinhTrang(d);
  const n = soDau(d);
  return (
    <tr className="border-t border-line align-top">
      <td className="px-3 py-2">
        <div className="font-medium text-ink">{d.ma_dot_vai}</div>
        <div className="text-xs text-ink-soft">
          {[d.loai_dot_vai, d.nha_gia_cong, d.ngay_vai_ve ? `nhận ${fmtDate(d.ngay_vai_ve)}` : null,
            d.han_giao_hang ? `hạn ${fmtDate(d.han_giao_hang)}` : null].filter(Boolean).join(' · ')}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(d.so_luong_vai_ve)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(d.da_release)}</td>
      <td className="px-3 py-2">
        {(d.lenh || []).length === 0 ? <span className="text-ink-soft">—</span> : (
          <ul className="space-y-0.5 text-xs">
            {d.lenh.map((l) => (
              <li key={l.ma}>
                <b>{l.ma}</b> · {fmtNum(l.sl)} · {l.chuyen || '—'}{l.ngay ? ` · ${fmtDate(l.ngay)}` : ''} · {TT_LENH[l.trang_thai] || l.trang_thai}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-3 py-2"><Badge tone={tt.tone}>{tt.ten}</Badge></td>
      <td className="px-3 py-2">
        {n > 1 ? (
          <div>
            <Badge tone="info">BTP {n} đầu</Badge>
            {d.btp_cho && <div className="mt-0.5 text-[11px] text-primary">Có đầu đang chờ lập kế hoạch</div>}
            {d.btp_khac_kh_tg && (
              <div className="mt-0.5 text-[11px] text-ink-soft">{d.btp_khac_kh_nguoi || '—'} · {fmtDateTime(d.btp_khac_kh_tg)}</div>
            )}
          </div>
        ) : <span className="text-ink-soft">—</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <span className="inline-flex gap-1.5">
          {d.btp_cho && <Button variant="secondary" disabled={khoa} onClick={() => onDoi(d, false)}>Bỏ đầu chờ</Button>}
          {!d.btp_cho && <Button disabled={khoa} onClick={() => onDoi(d, true)}>Thêm 1 đầu</Button>}
        </span>
      </td>
    </tr>
  );
}
export default function BtpKhacKeHoachPage() {
  const { toast, show } = useToast();
  const [q, setQ] = useState('');
  const [data, setData] = useState({ co_cot: true, rows: [] });
  const [loading, setLoading] = useState(false);
  const [daTim, setDaTim] = useState(false);
  const [hoi, setHoi] = useState(null); // { d, bat }
  const [lyDo, setLyDo] = useState('');
  const [saving, setSaving] = useState(false);
  const qRef = useRef('');
  qRef.current = q;

  const tai = useCallback(async (ngam = false) => {
    const ma = qRef.current.trim();
    if (ma.length < 3) { setData((x) => ({ ...x, rows: [] })); setDaTim(false); return; }
    if (!ngam) setLoading(true);
    try {
      const r = await timBtpKhacKh(ma);
      setData(r.data || { co_cot: true, rows: [] });
      setDaTim(true);
    } catch (e) {
      if (!ngam) show(e.message || 'Lỗi tải', 'error');
    } finally { if (!ngam) setLoading(false); }
  }, [show]);

  useEffect(() => { const t = setTimeout(() => tai(), 350); return () => clearTimeout(t); }, [q, tai]);
  useSocketReload(['workflow:updated', 'production:updated'], () => tai(true), 800);

  const nhom = useMemo(() => gomTheoPhanIn(data.rows), [data.rows]);

  const moHoi = (d, bat) => { setHoi({ d, bat }); setLyDo(bat ? 'Quên tích BTP khác KH lúc lập kế hoạch' : ''); };
  const xacNhan = async () => {
    if (!hoi) return;
    const ly = lyDo.trim();
    if (!ly) { show('Nhập lý do', 'error'); return; }
    setSaving(true);
    try {
      const r = await datBtpKhacKh(hoi.d.dot_vai_id, { bat: hoi.bat, lyDo: ly });
      show(hoi.bat
        ? `Đã thêm 1 đầu — đợt ${hoi.d.ma_dot_vai} có ${r.data?.so_dau_btp || ''} đầu, hiện lại ở Release 1`
        : `Đã bỏ đầu chờ — đợt ${hoi.d.ma_dot_vai} rời Release 1`);
      setHoi(null);
      tai(true);
    } catch (e) {
      show(e.message || 'Lỗi lưu', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <Toolbar title="BTP khác kế hoạch" search={q} onSearch={setQ}
        searchPlaceholder="Code phần / mã vạch TDTHĐH (≥ 3 ký tự)" />
      {!data.co_cot && (
        <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Hệ thống chưa cập nhật cơ sở dữ liệu (migration 120) — chưa bật/tắt được.
        </div>
      )}
      {loading && <div className="py-10"><Spinner /></div>}
      {!loading && daTim && nhom.length === 0 && (
        <div className="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft">Không tìm thấy phần in</div>
      )}
      <div className="space-y-4">
        {nhom.map((p) => (
          <div key={p.phan_in_id} className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <div className="font-semibold text-ink">{p.ma_phan}</div>
              <div className="text-xs text-ink-soft">
                {[p.ten_khach_hang, p.ma_don_hang, p.ma_hang, p.mau_vai, [p.kich_vai, p.kich_phim].filter(Boolean).join(' · ')]
                  .filter(Boolean).join(' · ')} · SLĐH {fmtNum(p.so_luong_don_hang)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-surface-muted text-xs text-ink-soft">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Đợt vải</th>
                    <th className="px-3 py-2 text-right font-medium">SL vải</th>
                    <th className="px-3 py-2 text-right font-medium">Đã release</th>
                    <th className="px-3 py-2 text-left font-medium">Lệnh đã lập</th>
                    <th className="px-3 py-2 text-left font-medium">Tình trạng</th>
                    <th className="px-3 py-2 text-left font-medium">BTP khác KH</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {p.dots.map((d) => <DotRow key={d.dot_vai_id} d={d} onDoi={moHoi} khoa={!data.co_cot} />)}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!hoi}
        onClose={() => setHoi(null)}
        title={hoi ? `${hoi.bat ? 'Thêm 1 đầu BTP' : 'Bỏ đầu BTP đang chờ'} — ${hoi.d.ma_dot_vai}` : ''}
        footer={(
          <>
            <Button chiXemOk variant="ghost" onClick={() => setHoi(null)}>Hủy</Button>
            <Button onClick={xacNhan} loading={saving} disabled={!lyDo.trim()}>{hoi?.bat ? 'Thêm 1 đầu' : 'Bỏ đầu chờ'}</Button>
          </>
        )}
      >
        {hoi && (
          <div className="space-y-3 text-sm">
            <div className="rounded-control bg-surface-muted px-3 py-2 text-ink-soft">
              {hoi.bat
                ? <>Thêm 1 đầu tấm vải ({fmtNum(hoi.d.so_luong_vai_ve)} pcs) — như thêm 1 đợt vải mới. Đợt {hoi.d.da_len_ready ? <b>hiện lại ở Release 1</b> : 'sẽ ở Release 1 khi lên READY'} để lập kế hoạch đầu đó.</>
                : <>Bỏ đầu đang chờ lập kế hoạch — đợt <b>rời Release 1</b>. Lệnh đã lập giữ nguyên.</>}
            </div>
            <Field label="Lý do" required>
              <Textarea rows={3} value={lyDo} onChange={(e) => setLyDo(e.target.value)} maxLength={300} />
            </Field>
          </div>
        )}
      </Modal>
      <Toast toast={toast} />
    </div>
  );
}
