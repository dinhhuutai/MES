import { useEffect, useState, useCallback, useMemo } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import ChipTabs from '../../../components/common/ChipTabs';
import DateRangePicker from '../../../components/common/DateRangePicker';
import FieldFilters, { filterRows, FilterToggle } from '../../../components/common/FieldFilters';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import { fmtNum, ngayLocalISO } from '../../../utils/format';
import { khopNhieu } from '../../../utils/timKiem';
import { LOAI_TABS, nhanChip } from '../../../utils/khuChuyen';
import { getOqcFinishList } from '../../../services/qualityService';
import { FILTER_FIELDS, oTimCols, khopChip, demChipFinish, tongHop, fmtDMY } from '../utils/danhSachFinish';
import exportFinishListExcel from '../utils/exportFinishListExcel';

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH FINISH (màn OQC, 03/10/2026) — khuôn tờ Excel xưởng "DANH SÁCH FINISH NGÀY …".
// 1 dòng / PHẦN IN (code phần) — mọi tem cộng lại; khối MỤC TIÊU (phần in có đợt hạn giao = ngày tiêu đề) /
// KẾT QUẢ (phần in finish đúng ngày tiêu đề). Bộ lọc giống *Danh sách release*: ô tìm 1-ô không dấu + panel
// lọc từng trường + chip loại chuyền/khu — áp cho CẢ bảng lẫn khối tổng (số tổng tính lại trên tập đang xem).
// Luật từng cột: backend `utils/danhSachFinish.js`.
// ─────────────────────────────────────────────────────────────────────────────

// Ô chữ dài: XUỐNG DÒNG + thu nhỏ cỡ chữ, không cắt "…" (bảng để đối chiếu — gương Danh sách release).
const coChu = (s) => (s.length > 30 ? 'text-[11px] leading-tight' : s.length > 20 ? 'text-xs leading-tight' : '');
function OChu({ v, rong = '12rem' }) {
  const s = v == null || v === '' ? '—' : String(v);
  return <div className={`whitespace-normal break-words ${coChu(s)}`} style={{ maxWidth: rong }}>{s}</div>;
}

// Số có dấu: âm tô đỏ (chênh lệch thiếu so với PO / trễ hạn).
function SoAm({ v }) {
  if (v == null) return <span className="text-ink-soft">—</span>;
  return <span className={Number(v) < 0 ? 'font-semibold text-danger' : ''}>{fmtNum(v)}</span>;
}

// 1 dòng của khối tổng MỤC TIÊU / KẾT QUẢ.
function DongTong({ nhan, t, tone, giaiThich }) {
  const o = (ten, v) => (
    <span className="whitespace-nowrap"><span className="text-ink-soft">{ten}</span> <b className="tabular-nums text-ink">{fmtNum(v)}</b></span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
      <span title={giaiThich} className={`w-20 shrink-0 cursor-help rounded-full px-2 py-0.5 text-center text-[11px] font-bold ${tone}`}>{nhan}</span>
      {o('Tổng PO', t.tong_po)}{o('Tổng mã', t.tong_ma)}{o('Phần', t.phan)}{o('SLĐH', t.sldh)}{o('SLNV', t.slnv)}
    </div>
  );
}

const COT = [
  ['Ngày cập nhật DS', 'left'], ['Cty', 'left'], ['Đơn hàng', 'left'], ['Mã hàng', 'left'], ['Màu vải', 'left'],
  ['Kích vải', 'left'], ['Kích film', 'left'], ['Barcode', 'left'], ['Máy/bàn', 'left'], ['SLĐH', 'right'],
  ['SLNV', 'right'], ['SLIN', 'right'], ['Sgiao', 'right'], ['Chênh lệch giao/PO', 'right'], ['Tồn cuối', 'right'],
  ['Thời gian giao hàng', 'left'], ['Số ngày tồn đọng', 'right'], ['Ngày cập nhật kết quả', 'left'], ['Sửa đạt', 'right'],
  ['Sửa hủy', 'right'], ['SL còn lại', 'right'], ['Ghi chú', 'left'],
];
// Chú thích cột (title khi rê chuột lên tiêu đề) — nói rõ số lấy từ đâu.
const GIAI_THICH = {
  'Ngày cập nhật DS': 'Ngày OQC cho qua giao (finish) gần nhất trong khoảng ngày đã chọn',
  SLIN: 'Tổng SL in của mọi tem',
  Sgiao: 'Tổng SL đã qua OQC (finish) của mọi tem, lũy kế đến hết ngày cuối khoảng',
  'Chênh lệch giao/PO': 'Sgiao − SLĐH',
  'Tồn cuối': 'Hàng lỗi phát hiện ở KCS = Sửa đạt + Sửa hủy + SL còn lại',
  'Số ngày tồn đọng': 'Thời gian giao hàng − ngày danh sách (âm = trễ hạn)',
  'Ngày cập nhật kết quả': 'Lần ghi kết quả xử lý lỗi gần nhất trên mọi tem (Sửa / Phân loại lỗi có hủy)',
  'Sửa hủy': 'Sửa hủy + hủy thẳng ở Phân loại lỗi',
  'SL còn lại': 'Hàng lỗi còn chờ sửa',
  'Ghi chú': 'Hàng còn dở của phần in (chờ kiểm / chờ sửa / chờ OQC)',
};

export default function FinishListModal({ open, onClose }) {
  const { toast, show } = useToast();
  // 1 ô chọn KHOẢNG ngày (cùng component Hồ sơ kỹ thuật): bấm ngày đầu → ngày cuối; bấm 1 ngày 2 lần = đúng ngày đó.
  // ⚠ Giữ NGUYÊN giá trị ô trả về (`to` rỗng khi mới bấm ngày đầu) — tự điền `to = from` ngay là ô coi như đã
  //   chọn xong và lần bấm thứ hai sẽ mở khoảng MỚI, không bao giờ chọn được khoảng. Truy vấn thì tạm lấy 1 ngày.
  const [range, setRange] = useState(() => { const t = ngayLocalISO(new Date()); return { from: t, to: t }; });
  const doiNgay = (v) => {
    if (v?.from) setRange(v);
    else { const t = ngayLocalISO(new Date()); setRange({ from: t, to: t }); } // "Xóa" ⇒ về hôm nay (danh sách cần ngày)
  };
  const tuNgay = range.from;
  const denNgay = range.to || range.from;
  const [heThong, setHeThong] = useState(false);    // gồm hàng script hệ thống tự chạy đến giao
  const [conLoi, setConLoi] = useState(false);      // chỉ dòng còn SL lỗi chưa xử lý
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chip, setChip] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [moLoc, setMoLoc] = useState(false);

  // `ngam` = tải lại do socket: không spinner, không toast lỗi (giữ bảng cũ).
  const load = useCallback(async (ngam = false) => {
    if (!open) return;
    if (!ngam) setLoading(true);
    try {
      const r = await getOqcFinishList(tuNgay, denNgay, heThong);
      setData(r.data || null);
    } catch (e) {
      if (!ngam) { show(e.message || 'Lỗi tải danh sách finish', 'error'); setData(null); }
    } finally {
      if (!ngam) setLoading(false);
    }
  }, [open, tuNgay, denNgay, heThong, show]);

  useEffect(() => { load(); }, [load]);
  useSocketReload(['quality:updated', 'delivery:updated'], () => load(true), 800);

  const items = useMemo(() => data?.items || [], [data]);
  const mucTieuGoc = useMemo(() => data?.muc_tieu || [], [data]);
  const ngayTieuDe = data?.meta?.ngay_tieu_de || denNgay;

  // Lọc: ô tìm + panel từng trường (AND) — áp chung cho dòng finish và tập mục tiêu.
  const quaLoc = useCallback((rows) => filterRows(rows, filters, FILTER_FIELDS).filter((r) => khopNhieu(oTimCols(r), q)),
    [filters, q]);
  const truocChip = useMemo(() => quaLoc(items).filter((r) => !conLoi || r.sl_con_lai > 0), [quaLoc, items, conLoi]);
  const viewItems = useMemo(() => truocChip.filter((r) => khopChip(r, chip)), [truocChip, chip]);
  const counts = useMemo(() => demChipFinish(truocChip), [truocChip]);
  const mucTieu = useMemo(() => tongHop(quaLoc(mucTieuGoc).filter((r) => khopChip(r, chip))), [quaLoc, mucTieuGoc, chip]);
  const ketQua = useMemo(() => tongHop(viewItems.filter((r) => r.ngay === ngayTieuDe)), [viewItems, ngayTieuDe]);

  const soLoc = Object.values(filters).filter((v) => (v || '').trim()).length + (q.trim() ? 1 : 0);
  const th = 'px-2 py-2 text-xs font-semibold text-ink-soft align-bottom';
  const td = 'px-2 py-1.5 align-top whitespace-nowrap';

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay title={`Danh sách finish ngày ${fmtDMY(ngayTieuDe)}`}>
      <div className="shrink-0">
        {/* HÀNG 1 — khoảng ngày OQC · 2 ô tích · Xuất Excel */}
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink-soft">Ngày OQC</span>
            <DateRangePicker value={range} onChange={doiNgay} placeholder="Chọn ngày" />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
            <input type="checkbox" checked={conLoi} onChange={(e) => setConLoi(e.target.checked)} />
            Chỉ dòng còn SL lỗi
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft"
            title="Hàng do script dọn tồn sản xuất (hệ thống tự chạy đến giao) — mặc định không lên danh sách">
            <input type="checkbox" checked={heThong} onChange={(e) => setHeThong(e.target.checked)} />
            Gồm hàng hệ thống tự chạy
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button chiXemOk variant="secondary" icon="download" disabled={!viewItems.length && !mucTieu.phan}
              onClick={() => exportFinishListExcel(viewItems, { ngay: ngayTieuDe, mucTieu, ketQua })}>Xuất Excel</Button>
          </div>
        </div>

        {/* HÀNG 2 — khối tổng như tờ giấy */}
        <div className="mb-2 space-y-1 rounded-control border border-line bg-surface-muted/40 px-3 py-2">
          <DongTong nhan="MỤC TIÊU" t={mucTieu} tone="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            giaiThich={`Phần in có đợt vải hạn giao ${fmtDMY(ngayTieuDe)}`} />
          <DongTong nhan="KẾT QUẢ" t={ketQua} tone="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
            giaiThich={`Phần in finish (OQC cho qua giao) ngày ${fmtDMY(ngayTieuDe)}`} />
          <div className="text-xs text-ink-soft">
            <b className="text-ink">{fmtNum(viewItems.length)}</b> code phần
          </div>
        </div>

        {/* Ô tìm 1-ô + panel lọc từng trường + chip loại chuyền / khu */}
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

      {/* VÙNG CUỘN DUY NHẤT (`min-h-0` bắt buộc — xem Danh sách release) */}
      <div className="min-h-0 flex-1 overflow-auto rounded-control border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-muted">
            <tr className="border-b border-line">
              <th className={`${th} w-10 text-center`}>STT</th>
              {COT.map(([ten, canh]) => (
                <th key={ten} title={GIAI_THICH[ten] || undefined}
                  className={`${th} ${canh === 'right' ? 'text-right' : 'text-left'} ${GIAI_THICH[ten] ? 'cursor-help' : ''}
                    ${ten === 'Ngày cập nhật kết quả' ? 'bg-yellow-100 dark:bg-yellow-900/40' : ''} ${ten === 'SL còn lại' ? 'text-danger' : ''}`}>
                  <div className="min-w-[3.5rem] max-w-[7rem] whitespace-normal leading-tight">{ten}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COT.length + 1} className="px-3 py-8 text-center text-ink-soft">Đang tải...</td></tr>
            ) : viewItems.length === 0 ? (
              <tr><td colSpan={COT.length + 1} className="px-3 py-8 text-center text-ink-soft">
                {soLoc || conLoi ? 'Không có dòng nào khớp ô tìm / bộ lọc'
                  : chip ? `Không có phần in finish nào thuộc ${nhanChip(chip)} trong khoảng ngày này`
                    : 'Chưa có phần in nào được OQC cho qua giao trong khoảng ngày này'}
              </td></tr>
            ) : viewItems.map((r, i) => (
              <tr key={r.phan_in_id} className="border-t border-line/60 hover:bg-surface-muted/50">
                <td className={`${td} text-center text-ink-soft`}>{i + 1}</td>
                <td className={`${td} tabular-nums`}>{fmtDMY(r.ngay)}</td>
                <td className={td}><OChu v={r.ten_khach_hang} rong="6rem" /></td>
                <td className={td}><OChu v={r.ma_don_hang} rong="9rem" /></td>
                <td className={td}><OChu v={r.ma_hang} rong="13rem" /></td>
                <td className={td}><OChu v={r.mau_vai} rong="10rem" /></td>
                <td className={td}><OChu v={r.kich_vai} rong="6rem" /></td>
                <td className={td}><OChu v={r.kich_phim} rong="6rem" /></td>
                <td className={`${td} tabular-nums`}><OChu v={r.barcode} rong="8rem" /></td>
                <td className={td}><OChu v={r.ma_chuyen} rong="6rem" /></td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.so_luong_don_hang)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.slnv)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.slin)}</td>
                <td className={`${td} text-right tabular-nums font-semibold text-primary`}>{fmtNum(r.sgiao)}</td>
                <td className={`${td} text-right tabular-nums`}><SoAm v={r.chenh_lech} /></td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.ton_cuoi)}</td>
                <td className={`${td} tabular-nums`}>{fmtDMY(r.han_giao_hang) || '—'}</td>
                <td className={`${td} text-right tabular-nums`}><SoAm v={r.so_ngay_ton_dong} /></td>
                <td className={`${td} tabular-nums`}>{fmtDMY(r.ngay_cap_nhat_ket_qua) || ''}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.sua_dat)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.sua_huy)}</td>
                <td className={`${td} text-right tabular-nums ${r.sl_con_lai > 0 ? 'font-bold text-danger' : ''}`}>{fmtNum(r.sl_con_lai)}</td>
                <td className={td}><OChu v={r.ghi_chu || ''} rong="12rem" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Toast toast={toast} />
    </Modal>
  );
}
