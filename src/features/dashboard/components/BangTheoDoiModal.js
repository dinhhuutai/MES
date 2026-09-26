import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Spinner from '../../../components/common/Spinner';
import ChipTabs from '../../../components/common/ChipTabs';
import exportPanelExcel from '../../../components/common/exportPanelExcel';
import { layBangTheoDoiChiTiet } from '../../../services/siSoService';
import { listLyDoNghen } from '../../../services/lyDoNghenService';
import { fmtDate, fmtDateTime, fmtNum } from '../../../utils/format';
import { fmtDur } from '../../../utils/sla';
import { khop } from '../../../utils/timKiem';

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH PHẦN IN CỦA 1 DÒNG "BẢNG THEO DÕI 10 CHECK POINT" (Dashboard, 26/09/2026).
// Toggle Tồn đầu · Nhận · Xong · Tồn cuối · Nghẽn — số trên chip KHỚP ô của bảng vì backend dùng CÙNG
// điều kiện ô + CÙNG mốc bắt đầu nghẽn (`siso.repository.dsDongBang`). Kèm: nghẽn từ lúc nào, nghẽn bao
// lâu, LÝ DO NGHẼN (mig 106 — nhập lúc xác nhận ở màn đó), trạng thái, owner, SLA.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { v: '', label: 'Tất cả' },
  { v: 'ton_dau', label: 'Tồn đầu' },
  { v: 'nhan', label: 'Nhận' },
  { v: 'xong', label: 'Xong' },
  { v: 'ton_cuoi', label: 'Tồn cuối' },
  { v: 'nghen', label: 'Nghẽn' },
];
const CO = { ton_dau: 'o_ton_dau', nhan: 'o_nhan', xong: 'o_xong', ton_cuoi: 'o_ton_cuoi', nghen: 'o_nghen' };

const trangThai = (r) => {
  if (r.o_nghen) return { ten: 'Nghẽn', tone: 'danger' };
  if (r.o_ton_cuoi) return { ten: 'Đang tồn (trong hạn)', tone: 'warning' };
  if (r.o_xong) return { ten: 'Đã xong', tone: 'success' };
  return { ten: '—', tone: 'default' };
};

const TH = 'sticky top-0 z-10 whitespace-nowrap bg-surface-muted px-2 py-2 text-left text-xs font-semibold text-ink-soft';
const TD = 'px-2 py-1.5 align-top';

export default function BangTheoDoiModal({ open, onClose, dong, range, oMacDinh = '' }) {
  const [data, setData] = useState(null);
  const [lyDo, setLyDo] = useState(() => new Map());
  const [loading, setLoading] = useState(false);
  const [loi, setLoi] = useState('');
  const [o, setO] = useState(oMacDinh);
  const [tim, setTim] = useState('');
  const [xuat, setXuat] = useState(false);

  useEffect(() => { if (open) { setO(oMacDinh); setTim(''); } }, [open, oMacDinh]);

  const ma = dong?.ma;
  const tai = useCallback(async () => {
    if (!ma) return;
    setLoading(true); setLoi('');
    try {
      const r = await layBangTheoDoiChiTiet(ma, { tu: range.from, den: range.to || range.from });
      setData(r.data);
      // Lý do nghẽn của màn tương ứng — lấy bản MỚI NHẤT theo phần in. Lỗi (thiếu mig 106) ⇒ bỏ qua.
      try {
        const l = await listLyDoNghen({ maTrang: r.data.man, soNgay: 120 });
        const m = new Map();
        (l.data?.items || []).forEach((x) => { if (x.phan_in_id && !m.has(x.phan_in_id)) m.set(x.phan_in_id, x); });
        setLyDo(m);
      } catch { setLyDo(new Map()); }
    } catch (e) {
      setLoi(e.message || 'Không tải được danh sách');
      setData(null);
    } finally { setLoading(false); }
  }, [ma, range.from, range.to]);
  useEffect(() => { if (open) tai(); }, [open, tai]);

  // Lý do chỉ tính khi ghi TRONG lượt ở trạm này (không lấy lý do của lần ở trạm trước đó).
  const lyDoCua = useCallback((r) => {
    const x = lyDo.get(r.id);
    if (!x) return null;
    if (r.tg_vao && new Date(x.created_date) < new Date(new Date(r.tg_vao).getTime() - 60000)) return null;
    return x;
  }, [lyDo]);

  const items = useMemo(() => data?.items || [], [data]);
  const counts = useMemo(() => {
    const c = { '': items.length };
    Object.entries(CO).forEach(([k, f]) => { c[k] = items.filter((r) => r[f]).length; });
    return c;
  }, [items]);

  const ds = useMemo(() => {
    let x = o ? items.filter((r) => r[CO[o]]) : items;
    if (tim.trim()) {
      x = x.filter((r) => khop([r.ma_phan, r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.mau_vai,
        r.ma_lenh_san_xuat, r.ma_tem, r.ten_chuyen, lyDoCua(r)?.ly_do].filter(Boolean).join(' '), tim));
    }
    // Nghẽn lâu nhất lên đầu ở toggle Nghẽn; còn lại giữ thứ tự backend (vào trạm mới nhất trước).
    if (o === 'nghen') x = [...x].sort((a, b) => (b.phut_nghen || 0) - (a.phut_nghen || 0));
    return x;
  }, [items, o, tim, lyDoCua]);

  const owner = data?.owner || { chiu_trach_nhiem: [], xu_ly: [] };
  const ctn = owner.chiu_trach_nhiem.join(', ') || '— chưa gán —';
  const xl = owner.xu_ly.join(', ') || '—';

  const doXuat = async () => {
    setXuat(true);
    try {
      await exportPanelExcel({
        title: `BẢNG THEO DÕI — ${data?.ten || ''} — ${TABS.find((t) => t.v === o)?.label || ''}`,
        subtitle: `Kỳ ${range.from}${range.to && range.to !== range.from ? ` → ${range.to}` : ''} · ${ds.length} phần in`
          + ` · owner: ${ctn}`,
        fileName: `bang-theo-doi-${(ma || '').toLowerCase()}`,
        rows: ds,
        cols: [
          { header: 'Trạng thái', width: 18, value: (r) => trangThai(r).ten, red: (r) => !!r.o_nghen },
          { header: 'Khách hàng', value: (r) => r.ten_khach_hang },
          { header: 'Đơn hàng', value: (r) => r.ma_don_hang },
          { header: 'Mã hàng', value: (r) => r.ma_hang },
          { header: 'Code phần', width: 24, value: (r) => r.ma_phan },
          { header: 'Màu vải', value: (r) => r.mau_vai },
          { header: 'Kích vải', value: (r) => r.kich_vai },
          { header: 'Kích phim', value: (r) => r.kich_phim },
          { header: 'Lệnh / Tem', width: 22, value: (r) => r.ma_tem || r.ma_lenh_san_xuat || '' },
          { header: 'Chuyền', value: (r) => r.ten_chuyen },
          { header: 'Hạn giao', type: 'date', value: (r) => r.han_giao_hang },
          { header: 'Vào trạm', width: 18, value: (r) => (r.tg_vao ? fmtDateTime(r.tg_vao) : '') },
          { header: 'Rời trạm', width: 18, value: (r) => (r.tg_ra ? fmtDateTime(r.tg_ra) : '') },
          { header: 'Đã ở (phút)', num: true, value: (r) => r.phut_da_o },
          { header: 'SLA (phút)', num: true, value: (r) => r.sla_phut },
          { header: 'Bắt đầu nghẽn', width: 18, value: (r) => (r.o_nghen && r.tg_bat_dau_nghen ? fmtDateTime(r.tg_bat_dau_nghen) : '') },
          { header: 'Nghẽn bao lâu (phút)', num: true, value: (r) => r.phut_nghen, red: (r) => !!r.o_nghen },
          { header: 'Lý do nghẽn', width: 40, value: (r) => lyDoCua(r)?.ly_do || '' },
          { header: 'Người ghi lý do', width: 20, value: (r) => lyDoCua(r)?.nguoi || '' },
          { header: 'Owner chịu trách nhiệm', width: 24, value: () => owner.chiu_trach_nhiem.join(', ') },
          { header: 'Người xử lý', width: 24, value: () => owner.xu_ly.join(', ') },
          { header: data?.don_vi_sl || 'SL', num: true, value: (r) => Number(r.sl_dong) || 0 },
        ],
      });
    } finally { setXuat(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay
      title={`Bảng theo dõi — ${dong?.ten || ''}`}>
      <div className="flex h-full flex-col">
        <div className="shrink-0 space-y-2 pb-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
            <span>Kỳ: <b className="text-ink">{range.from}{range.to && range.to !== range.from ? ` → ${range.to}` : ''}</b></span>
            <span>SLA trạm: <b className="text-ink">{data?.sla_phut ? fmtDur(Number(data.sla_phut)) : 'chưa đặt'}</b></span>
            <span>Owner chịu trách nhiệm: <b className="text-ink">{ctn}</b></span>
            <span>Người xử lý: <b className="text-ink">{xl}</b></span>
            {data?.ghi_chu && <span>{data.ghi_chu}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ChipTabs tabs={TABS} value={o} counts={counts} onChange={setO} />
            <div className="ml-auto mb-4 flex items-center gap-2">
              {loading && <Spinner size={16} />}
              <div className="relative">
                <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm code phần, khách, lý do..."
                  className="h-9 w-64 rounded-control border border-line bg-surface pl-8 pr-2 text-base outline-none focus:border-primary md:text-sm" />
              </div>
              <Button chiXemOk variant="secondary" icon="file-spreadsheet" loading={xuat} disabled={!ds.length} onClick={doXuat}>
                Excel ({ds.length})
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-[10rem] flex-1 overflow-auto rounded-card border border-line">
          {loi ? (
            <div className="px-3 py-10 text-center text-sm text-danger">{loi}</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {['STT', 'Trạng thái', 'Khách · Đơn', 'Mã hàng', 'Code phần', 'Màu · Kích (vải/phim)', 'Lệnh / Tem · Chuyền',
                    'Hạn giao', 'Vào trạm', 'Đã ở', 'SLA', 'Bắt đầu nghẽn', 'Nghẽn bao lâu', 'Lý do nghẽn', 'Owner', data?.don_vi_sl || 'SL']
                    .map((h) => <th key={h} className={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {ds.map((r, i) => {
                  const tt = trangThai(r);
                  const ld = lyDoCua(r);
                  return (
                    <tr key={`${r.id}-${i}`} className={`border-t border-line ${r.o_nghen ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''}`}>
                      <td className={`${TD} tabular-nums text-ink-soft`}>{i + 1}</td>
                      <td className={TD}>
                        <Badge tone={tt.tone} className="whitespace-nowrap">{tt.ten}</Badge>
                        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-ink-soft">
                          {r.o_ton_dau && <span>tồn đầu</span>}
                          {r.o_nhan && <span>· nhận trong kỳ</span>}
                        </div>
                      </td>
                      <td className={TD}><div className="text-ink">{r.ten_khach_hang || '—'}</div><div className="text-ink-soft">{r.ma_don_hang || ''}</div></td>
                      <td className={TD}>{r.ma_hang || '—'}</td>
                      <td className={`${TD} font-medium text-ink`}>{r.ma_phan || '—'}</td>
                      <td className={TD}><div>{r.mau_vai || '—'}</div><div className="text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' / ')}</div></td>
                      <td className={TD}><div className="max-w-[12rem] break-words">{r.ma_tem || r.ma_lenh_san_xuat || '—'}</div><div className="text-ink-soft">{r.ten_chuyen || ''}</div></td>
                      <td className={`${TD} whitespace-nowrap`}>{r.han_giao_hang ? fmtDate(r.han_giao_hang) : '—'}</td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {r.tg_vao ? fmtDateTime(r.tg_vao) : '—'}
                        {r.tg_ra && <div className="text-ink-soft">rời {fmtDateTime(r.tg_ra)}</div>}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{r.phut_da_o != null ? fmtDur(r.phut_da_o) : '—'}</td>
                      <td className={`${TD} whitespace-nowrap text-right tabular-nums text-ink-soft`}>{r.sla_phut != null ? fmtDur(r.sla_phut) : '—'}</td>
                      <td className={`${TD} whitespace-nowrap`}>{r.o_nghen && r.tg_bat_dau_nghen ? fmtDateTime(r.tg_bat_dau_nghen) : '—'}</td>
                      <td className={`${TD} whitespace-nowrap text-right font-semibold tabular-nums text-danger`}>
                        {r.o_nghen && r.phut_nghen != null ? `+${fmtDur(r.phut_nghen)}` : '—'}
                      </td>
                      <td className={`${TD} min-w-[12rem]`}>
                        {ld ? (
                          <>
                            <div className="text-ink">{ld.ly_do}</div>
                            <div className="text-[10px] text-ink-soft">{ld.nguoi || '—'} · {fmtDateTime(ld.created_date)}</div>
                          </>
                        ) : <span className="text-ink-soft">{r.o_nghen ? 'Chưa có lý do' : '—'}</span>}
                      </td>
                      <td className={`${TD} min-w-[9rem]`}>
                        <div className="text-ink">{ctn}</div>
                        {owner.xu_ly.length > 0 && <div className="text-[10px] text-ink-soft">Xử lý: {xl}</div>}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{fmtNum(Number(r.sl_dong) || 0)}</td>
                    </tr>
                  );
                })}
                {!ds.length && !loading && (
                  <tr><td colSpan={16} className="px-3 py-10 text-center text-sm text-ink-soft">Không có phần in nào</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
