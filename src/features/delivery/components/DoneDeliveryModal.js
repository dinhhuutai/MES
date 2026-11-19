import { useEffect, useState, useCallback, useMemo } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import ChipTabs from '../../../components/common/ChipTabs';
import DateRangePicker from '../../../components/common/DateRangePicker';
import HuyLyDoModal from '../../../components/common/HuyLyDoModal';
import FieldFilters, { filterRows, FilterToggle } from '../../../components/common/FieldFilters';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useSocketReload from '../../../hooks/useSocketReload';
import { fmtNum, fmtDateTime, ngayLocalISO } from '../../../utils/format';
import { khopNhieu } from '../../../utils/timKiem';
import { LOAI_TABS, nhanChip } from '../../../utils/khuChuyen';
import exportCheckpointExcel, { moTaBoLoc } from '../../../utils/exportCheckpointExcel';
import { getDoneDelivery, xacNhanDoneDelivery, huyXacNhanDoneDelivery } from '../../../services/deliveryService';
import { FILTER_FIELDS, oTimCols, khopChip, demChipFinish, fmtDMY } from '../../quality/utils/danhSachFinish';
import { LoaiFinishBadge } from '../../quality/components/DieuKienFinish';

// ─────────────────────────────────────────────────────────────────────────────
// DONE DELIVERY — 1 dòng / PHẦN IN (19/11/2026, người dùng chốt; luật BE `modules/delivery/doneDelivery.js`):
//   DONE khi phần in ĐÃ FINISH + mọi SL đạt đã có PHIẾU GIAO (đã giao) + SL giao ≥ SLĐH ⇒ tự động, ngày = ngày giao phiếu cuối.
//   Toggle tiêu đề **Đã done / Chưa done**: Chưa done = đã finish + đã giao hết SL đạt mà SL giao < SLĐH ⇒ nút
//   **"Xác nhận DONE"** (quyền quản lý giao hàng, ghi chú tùy chọn) ⇒ DONE ngày bấm. Admin hủy được xác nhận ở chế độ Đã done.
// Bộ lọc (ô tìm + panel + chip loại chuyền) dùng chung Danh sách finish.
// ─────────────────────────────────────────────────────────────────────────────

const DK_DONE = [
  { ma: 'FINISH', gon: 'Finish', ten: 'Phần in đã finish' },
  { ma: 'HET_GIAO', gon: 'Hết phiếu', ten: 'Mọi SL đạt đã có phiếu giao' },
  { ma: 'SL_GIAO', gon: 'SL ≥ SLĐH', ten: 'SL giao ≥ SLĐH' },
];

function DieuKienDone({ r }) {
  const dk = r.dk || {};
  return (
    <div className="flex flex-wrap gap-1">
      {DK_DONE.map((d) => {
        const dat = !!dk[d.ma];
        return (
          <span key={d.ma} title={`${d.ten}: ${dat ? 'đạt' : 'chưa đạt'}`}
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${dat
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900'
              : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900'}`}>
            {dat ? '✓' : '✗'} {d.gon}
          </span>
        );
      })}
    </div>
  );
}

function LoaiDoneBadge({ r }) {
  if (r.loai_done === 'XAC_NHAN') {
    const x = r.xac_nhan_done || {};
    return (
      <span title={`Xác nhận DONE${x.nguoi ? ` — ${x.nguoi}` : ''}${x.tg ? ` · ${fmtDateTime(x.tg)}` : ''}${x.ghi_chu ? `\nGhi chú: ${x.ghi_chu}` : ''}`}
        className="inline-flex cursor-help items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
        Xác nhận tay
      </span>
    );
  }
  return (
    <span title="Đã finish + giao hết SL đạt + SL giao ≥ SLĐH — ngày done = ngày giao phiếu cuối"
      className="inline-flex cursor-help items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
      Tự động
    </span>
  );
}

// Ô chữ dài xuống dòng, không cắt.
function OChu({ v, rong = '12rem' }) {
  const s = v == null || v === '' ? '—' : String(v);
  return <div className={`whitespace-normal break-words ${s.length > 24 ? 'text-xs leading-tight' : ''}`} style={{ maxWidth: rong }}>{s}</div>;
}
function SoAm({ v }) {
  if (v == null) return <span className="text-ink-soft">—</span>;
  return <span className={Number(v) < 0 ? 'font-semibold text-danger' : ''}>{fmtNum(v)}</span>;
}

export default function DoneDeliveryModal({ open, onClose }) {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const coQuyenXacNhan = can('DELIVERY_MANAGE');
  const laAdmin = can('DONE_DELIVERY_HUY'); // mã giả — chỉ quyền '*' qua được (khớp route BE)
  const [cheDo, setCheDo] = useState('DONE'); // DONE | CHUA
  const chua = cheDo === 'CHUA';
  const [range, setRange] = useState(() => { const t = ngayLocalISO(new Date()); return { from: t, to: t }; });
  const doiNgay = (v) => {
    if (v?.from) setRange(v);
    else { const t = ngayLocalISO(new Date()); setRange({ from: t, to: t }); }
  };
  const tuNgay = range.from;
  const denNgay = range.to || range.from;
  const [heThong, setHeThong] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chip, setChip] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [moLoc, setMoLoc] = useState(false);
  const [dongXacNhan, setDongXacNhan] = useState(null);
  const [dongHuy, setDongHuy] = useState(null);

  const load = useCallback(async (ngam = false) => {
    if (!open) return;
    if (!ngam) setLoading(true);
    try {
      const r = await getDoneDelivery(tuNgay, denNgay, cheDo, heThong);
      setData(r.data || null);
    } catch (e) {
      if (!ngam) { show(e.message || 'Lỗi tải danh sách DONE DELIVERY', 'error'); setData(null); }
    } finally {
      if (!ngam) setLoading(false);
    }
  }, [open, tuNgay, denNgay, cheDo, heThong, show]);

  useEffect(() => { load(); }, [load]);
  // Phiếu giao / tích giao / finish / OQC đổi ⇒ điều kiện đổi.
  useSocketReload(['delivery:updated', 'quality:updated', 'production:updated'], () => load(true), 800);

  const items = useMemo(() => data?.items || [], [data]);
  const truocChip = useMemo(() => filterRows(items, filters, FILTER_FIELDS).filter((r) => khopNhieu(oTimCols(r), q)),
    [items, filters, q]);
  const viewItems = useMemo(() => truocChip.filter((r) => khopChip(r, chip)), [truocChip, chip]);
  const counts = useMemo(() => demChipFinish(truocChip), [truocChip]);
  const tong = useMemo(() => viewItems.reduce((s, r) => ({
    sldh: s.sldh + (Number(r.so_luong_don_hang) || 0), giao: s.giao + (Number(r.sl_giao) || 0),
  }), { sldh: 0, giao: 0 }), [viewItems]);

  const xacNhan = async (r, ghiChu) => {
    try {
      await xacNhanDoneDelivery(r.phan_in_id, ghiChu);
      show(`Đã xác nhận DONE ${r.ma_phan}`);
      setDongXacNhan(null);
      load(true);
    } catch (e) { show(e.message || 'Xác nhận DONE thất bại', 'error'); throw e; }
  };
  const huy = async (r, lyDo) => {
    try {
      await huyXacNhanDoneDelivery(r.phan_in_id, lyDo);
      show(`Đã hủy xác nhận DONE ${r.ma_phan}`);
      setDongHuy(null);
      load(true);
    } catch (e) { show(e.message || 'Hủy xác nhận thất bại', 'error'); throw e; }
  };

  const xuatExcel = () => exportCheckpointExcel({
    cols: [
      { header: chua ? 'Ngày giao (phiếu cuối)' : 'Ngày done', width: 13, value: (r) => fmtDMY(r.ngay) },
      ...(chua ? [] : [{ header: 'Kiểu done', width: 12, value: (r) => (r.loai_done === 'XAC_NHAN' ? 'Xác nhận tay' : 'Tự động') }]),
      { header: 'Cty', width: 14, value: (r) => r.ten_khach_hang || '' },
      { header: 'Đơn hàng', width: 16, value: (r) => r.ma_don_hang || '' },
      { header: 'Mã hàng', width: 20, value: (r) => r.ma_hang || '' },
      { header: 'Code phần', width: 24, value: (r) => r.ma_phan || '' },
      { header: 'Màu vải', width: 16, value: (r) => r.mau_vai || '' },
      { header: 'Kích vải', width: 10, value: (r) => r.kich_vai || '' },
      { header: 'Kích phim', width: 10, value: (r) => r.kich_phim || '' },
      { header: 'Barcode', width: 14, value: (r) => r.barcode || '' },
      { header: 'Máy/bàn', width: 10, value: (r) => r.ma_chuyen || '' },
      { header: 'SLĐH', width: 10, num: true, value: (r) => Number(r.so_luong_don_hang) || 0 },
      { header: 'SL qua OQC', width: 11, num: true, value: (r) => Number(r.sl_qua_oqc) || 0 },
      { header: 'SL giao', width: 10, num: true, value: (r) => Number(r.sl_giao) || 0 },
      { header: 'Chênh lệch giao/SLĐH', width: 12, num: true, value: (r) => Number(r.chenh_lech_giao) || 0 },
      { header: 'Phiếu giao', width: 24, value: (r) => r.ma_phieu || '' },
      { header: 'Hạn giao', width: 12, value: (r) => fmtDMY(r.han_giao_hang) },
      { header: 'Ghi chú', width: 30, value: (r) => r.ghi_chu_done || '' },
    ],
    rows: viewItems,
    title: chua ? 'DANH SÁCH CHƯA DONE DELIVERY' : 'DANH SÁCH DONE DELIVERY',
    fileName: chua ? 'chua-done-delivery' : 'done-delivery',
    moTaLoc: moTaBoLoc({
      [chua ? 'ngày giao' : 'ngày done']: tuNgay === denNgay ? fmtDMY(tuNgay) : `${fmtDMY(tuNgay)} → ${fmtDMY(denNgay)}`,
      'tìm kiếm': q, 'loại chuyền': chip ? nhanChip(chip) : '', 'gồm hàng hệ thống': heThong ? 'có' : '',
    }),
  });

  const soLoc = Object.values(filters).filter((v) => (v || '').trim()).length + (q.trim() ? 1 : 0);
  const th = 'px-2 py-2 text-xs font-semibold text-ink-soft align-bottom text-left';
  const thR = 'px-2 py-2 text-xs font-semibold text-ink-soft align-bottom text-right';
  const td = 'px-2 py-1.5 align-top whitespace-nowrap';
  const tdR = `${td} text-right tabular-nums`;
  const SO_COT = 18;

  const nutCheDo = (ma, ten) => (
    <button type="button" onClick={() => setCheDo(ma)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${cheDo === ma
        ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:bg-surface-muted'}`}>
      {ten}
    </button>
  );
  const tieuDe = (
    <span className="flex flex-wrap items-center gap-3">
      <span>{chua ? 'Chưa DONE DELIVERY' : 'DONE DELIVERY'}</span>
      <span className="inline-flex rounded-full border border-line bg-surface p-0.5">
        {nutCheDo('DONE', 'Đã done')}{nutCheDo('CHUA', 'Chưa done')}
      </span>
    </span>
  );

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay title={tieuDe}>
      <div className="shrink-0">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink-soft">{chua ? 'Ngày giao (phiếu đã giao)' : 'Ngày done'}</span>
            <DateRangePicker value={range} onChange={doiNgay} placeholder="Chọn ngày" />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft"
            title="Phiếu HT-… do script dọn tồn (hệ thống tự chạy đến giao) — mặc định không lên danh sách">
            <input type="checkbox" checked={heThong} onChange={(e) => setHeThong(e.target.checked)} />
            Gồm hàng hệ thống tự chạy
          </label>
          <div className="ml-auto">
            <Button chiXemOk variant="secondary" icon="download" disabled={!viewItems.length} onClick={xuatExcel}>Xuất Excel</Button>
          </div>
        </div>

        <div className="mb-2 rounded-control border border-line bg-surface-muted/40 px-3 py-2 text-xs text-ink-soft">
          <b className="text-ink">{fmtNum(viewItems.length)}</b> code phần · SLĐH <b className="text-ink">{fmtNum(tong.sldh)}</b>
          {' '}· SL giao <b className="text-ink">{fmtNum(tong.giao)}</b>
          <span className="ml-2">
            {chua
              ? '· Đã finish + mọi SL đạt đã có phiếu giao, nhưng SL giao < SLĐH ⇒ bấm "Xác nhận DONE".'
              : '· DONE khi: phần in đã finish · mọi SL đạt đã có phiếu giao · SL giao ≥ SLĐH (hoặc đã Xác nhận DONE).'}
          </span>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm máy/bàn, khách, đơn, mã hàng, code phần, màu, kích, barcode..."
              className="h-10 w-full rounded-input border border-line bg-surface pl-9 pr-8 text-base md:text-sm outline-none focus:border-primary" />
            {q && (
              <button onClick={() => setQ('')} aria-label="Xóa tìm kiếm"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-danger">
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
          <FilterToggle open={moLoc} count={soLoc} onClick={() => setMoLoc((v) => !v)} />
        </div>
        <FieldFilters fields={FILTER_FIELDS} values={filters} open={moLoc}
          onField={(k, v) => setFilters((s) => ({ ...s, [k]: v }))}
          onClear={() => { setFilters({}); setQ(''); }} />
        <ChipTabs tabs={LOAI_TABS} value={chip} counts={counts} onChange={setChip} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-control border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-muted">
            <tr className="border-b border-line">
              <th className={`${th} w-10 text-center`}>STT</th>
              <th className={th}>{chua ? 'Xác nhận' : 'Kiểu done'}</th>
              <th className={th}>{chua ? 'Ngày giao' : 'Ngày done'}</th>
              {chua && <th className={th}>Điều kiện</th>}
              <th className={th}>Cty</th>
              <th className={th}>Đơn hàng</th>
              <th className={th}>Mã hàng · code phần</th>
              <th className={th}>Màu vải</th>
              <th className={th}>Kích vải</th>
              <th className={th}>Kích phim</th>
              <th className={th}>Máy/bàn</th>
              <th className={thR}>SLĐH</th>
              <th className={thR} title="Tổng SL qua OQC (SL đạt) của mọi tem">SL qua OQC</th>
              <th className={thR} title="Tổng SL trên phiếu giao đã giao">SL giao</th>
              <th className={thR} title="SL giao − SLĐH">Chênh lệch</th>
              <th className={th}>Phiếu giao</th>
              <th className={th}>Finish</th>
              <th className={th}>Hạn giao</th>
              <th className={th}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={SO_COT + 1} className="px-3 py-8 text-center text-ink-soft">Đang tải...</td></tr>
            ) : viewItems.length === 0 ? (
              <tr><td colSpan={SO_COT + 1} className="px-3 py-8 text-center text-ink-soft">
                {soLoc ? 'Không có dòng nào khớp ô tìm / bộ lọc'
                  : chip ? `Không có phần in nào thuộc ${nhanChip(chip)} trong khoảng ngày này`
                    : chua ? 'Không có phần in nào chờ xác nhận DONE (đã finish, giao hết SL đạt mà SL giao < SLĐH) trong khoảng ngày này'
                      : 'Chưa có phần in nào DONE DELIVERY trong khoảng ngày này'}
              </td></tr>
            ) : viewItems.map((r, i) => (
              <tr key={r.phan_in_id} className="border-t border-line/60 hover:bg-surface-muted/50">
                <td className={`${td} text-center text-ink-soft`}>{i + 1}</td>
                <td className={td}>
                  {chua ? (
                    r.duoc_xac_nhan && coQuyenXacNhan ? (
                      <Button variant="primary" className="!px-2.5 !py-1 !text-xs" onClick={() => setDongXacNhan(r)}>
                        Xác nhận DONE
                      </Button>
                    ) : <span className="text-xs text-ink-soft">—</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <LoaiDoneBadge r={r} />
                      {r.loai_done === 'XAC_NHAN' && laAdmin && (
                        <button type="button" onClick={() => setDongHuy(r)} title="Admin: hủy xác nhận DONE"
                          className="text-xs font-semibold text-danger hover:underline">Hủy</button>
                      )}
                    </div>
                  )}
                </td>
                <td className={`${td} tabular-nums`}>{fmtDMY(r.ngay)}</td>
                {chua && <td className={td}><DieuKienDone r={r} /></td>}
                <td className={td}><OChu v={r.ten_khach_hang} rong="6rem" /></td>
                <td className={td}><OChu v={r.ma_don_hang} rong="9rem" /></td>
                <td className={td}>
                  <OChu v={r.ma_hang} rong="13rem" />
                  <div className="text-[11px] text-ink-soft">{r.ma_phan}</div>
                </td>
                <td className={td}><OChu v={r.mau_vai} rong="10rem" /></td>
                <td className={td}><OChu v={r.kich_vai} rong="6rem" /></td>
                <td className={td}><OChu v={r.kich_phim} rong="6rem" /></td>
                <td className={td}><OChu v={r.ma_chuyen} rong="6rem" /></td>
                <td className={tdR}>{fmtNum(r.so_luong_don_hang)}</td>
                <td className={tdR}>{fmtNum(r.sl_qua_oqc)}</td>
                <td className={`${tdR} font-semibold text-primary`}>{fmtNum(r.sl_giao)}</td>
                <td className={tdR}><SoAm v={r.chenh_lech_giao} /></td>
                <td className={td}><OChu v={r.ma_phieu} rong="10rem" /></td>
                <td className={td}><LoaiFinishBadge r={r} /></td>
                <td className={`${td} tabular-nums`}>{fmtDMY(r.han_giao_hang) || '—'}</td>
                <td className={td}><OChu v={r.ghi_chu_done || ''} rong="14rem" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HuyLyDoModal muc={dongXacNhan} onClose={() => setDongXacNhan(null)} onXacNhan={xacNhan} batBuoc={false}
        tieuDe="Xác nhận DONE DELIVERY" nhanNut="Xác nhận DONE" kieuNut="primary" nhanLyDo="Ghi chú (không bắt buộc)"
        goiY="vd: khách chốt nhận thiếu..." ghiChuErp=""
        moTa={(r) => (
          <div className="space-y-1">
            <div><b>{r.ma_phan}</b> · {r.ten_khach_hang} · {r.ma_don_hang}</div>
            <div className="text-xs text-ink-soft">
              SL giao <b className="text-ink">{fmtNum(r.sl_giao)}</b> / SLĐH <b className="text-ink">{fmtNum(r.so_luong_don_hang)}</b>
              {' '}(thiếu {fmtNum(Math.max(0, (Number(r.so_luong_don_hang) || 0) - (Number(r.sl_giao) || 0)))}) · phiếu {r.ma_phieu || '—'}
            </div>
          </div>
        )}
        hauQua="Phần in vào danh sách DONE DELIVERY ngày hôm nay. Admin hủy được ở chế độ Đã done." />

      <HuyLyDoModal muc={dongHuy} onClose={() => setDongHuy(null)} onXacNhan={huy}
        tieuDe="Hủy xác nhận DONE" nhanNut="Hủy xác nhận" ghiChuErp=""
        moTa={(r) => <div><b>{r.ma_phan}</b> · {r.ten_khach_hang} · {r.ma_don_hang}</div>}
        hauQua="Phần in quay lại chế độ Chưa done (nếu SL giao vẫn < SLĐH)." />

      <Toast toast={toast} />
    </Modal>
  );
}
