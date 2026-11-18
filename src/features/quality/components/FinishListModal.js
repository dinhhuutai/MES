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
import { fmtNum, ngayLocalISO } from '../../../utils/format';
import { khopNhieu } from '../../../utils/timKiem';
import { LOAI_TABS, nhanChip } from '../../../utils/khuChuyen';
import { getOqcFinishList, chuyenFinish } from '../../../services/qualityService';
import { FILTER_FIELDS, oTimCols, khopChip, demChipFinish, tongHop, fmtDMY } from '../utils/danhSachFinish';
import exportFinishListExcel from '../utils/exportFinishListExcel';
import { DieuKienFinishChips, LoaiFinishBadge, MoDieuKienBadge } from './DieuKienFinish';

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH FINISH — khuôn tờ Excel xưởng "DANH SÁCH FINISH NGÀY …", 1 dòng / PHẦN IN (code phần); khối MỤC TIÊU (phần
// in có đợt hạn giao = ngày tiêu đề) / KẾT QUẢ. Bộ lọc giống *Danh sách release*: ô tìm 1-ô không dấu + panel lọc từng
// trường + chip loại chuyền/khu — áp cho CẢ bảng lẫn khối tổng.
// ⚠⚠ 18/11/2026 (`nguon="SX"`, mở từ Xác nhận chạy) — FINISH THEO 7 ĐIỀU KIỆN (luật BE `utils/dieuKienFinish.js`): chạy hoàn
//   tất · kiểm xong · phân loại lỗi xong · sửa xong · qua OQC · đã tích tem giao · SL đạt (đã tích) ≥ SLĐH; ngày finish =
//   ngày TÍCH TEM GIAO cuối. Toggle tiêu đề **Đã finish / Chưa finish**: chế độ Chưa finish (khoảng ngày = ngày chạy hoàn
//   tất) hiện điều kiện còn thiếu + nút **"Chuyển finish"** (lý do bắt buộc) khi đủ 6 điều kiện mà SL đạt < SLĐH, hoặc admin
//   đã mở điều kiện (trang Hệ thống › Mở điều kiện finish).
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
      <span title={giaiThich} className={`w-24 shrink-0 cursor-help rounded-full px-2 py-0.5 text-center text-[11px] font-bold ${tone}`}>{nhan}</span>
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
// Chế độ Sản xuất (`nguon="SX"`) — 7 điều kiện (18/11/2026).
const GIAI_THICH_SX = {
  ...GIAI_THICH,
  'Ngày cập nhật DS': 'Ngày finish = ngày tích tem giao cuối cùng (đủ 7 điều kiện) hoặc ngày bấm "Chuyển finish"',
  Sgiao: 'SL đạt giao khách = tổng SL qua OQC của các tem đã tích ở Giao hàng',
  'Ghi chú': 'Chuyển finish: người + lý do · Chưa finish: điều kiện còn thiếu',
};
const GIAI_THICH_CHUA = {
  ...GIAI_THICH_SX,
  'Ngày cập nhật DS': 'Ngày xác nhận chạy hoàn tất gần nhất của phần in',
};

// `nguon` 'SX' = mở từ Xác nhận chạy (finish 7 điều kiện + toggle Chưa finish); không truyền = chế độ OQC cũ.
export default function FinishListModal({ open, onClose, nguon }) {
  const laSx = nguon === 'SX';
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const coQuyenChuyen = can('PROD_RUN', 'OQC');
  const [cheDo, setCheDo] = useState('FINISH'); // FINISH | CHUA (chỉ chế độ SX)
  const chua = laSx && cheDo === 'CHUA';
  const giaiThich = !laSx ? GIAI_THICH : chua ? GIAI_THICH_CHUA : GIAI_THICH_SX;
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
  const [chiChuyen, setChiChuyen] = useState(false); // chế độ Chưa finish: chỉ dòng chuyển finish được
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chip, setChip] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [moLoc, setMoLoc] = useState(false);
  const [dongChuyen, setDongChuyen] = useState(null); // dòng đang mở hộp "Chuyển finish"

  // `ngam` = tải lại do socket: không spinner, không toast lỗi (giữ bảng cũ).
  const load = useCallback(async (ngam = false) => {
    if (!open) return;
    if (!ngam) setLoading(true);
    try {
      const r = await getOqcFinishList(tuNgay, denNgay, heThong, nguon, laSx ? cheDo : undefined);
      setData(r.data || null);
    } catch (e) {
      if (!ngam) { show(e.message || 'Lỗi tải danh sách finish', 'error'); setData(null); }
    } finally {
      if (!ngam) setLoading(false);
    }
  }, [open, tuNgay, denNgay, heThong, nguon, laSx, cheDo, show]);

  useEffect(() => { load(); }, [load]);
  // Tích giao / OQC / KCS / chạy hoàn tất đều đổi điều kiện ⇒ nghe đủ 3 kênh.
  useSocketReload(['quality:updated', 'delivery:updated', 'production:updated'], () => load(true), 800);

  const items = useMemo(() => data?.items || [], [data]);
  const mucTieuGoc = useMemo(() => data?.muc_tieu || [], [data]);
  const ngayTieuDe = data?.meta?.ngay_tieu_de || denNgay;

  // Lọc: ô tìm + panel từng trường (AND) — áp chung cho dòng finish và tập mục tiêu.
  const quaLoc = useCallback((rows) => filterRows(rows, filters, FILTER_FIELDS).filter((r) => khopNhieu(oTimCols(r), q)),
    [filters, q]);
  const truocChip = useMemo(() => quaLoc(items)
    .filter((r) => !conLoi || r.sl_con_lai > 0)
    .filter((r) => !chua || !chiChuyen || r.duoc_chuyen), [quaLoc, items, conLoi, chua, chiChuyen]);
  const viewItems = useMemo(() => truocChip.filter((r) => khopChip(r, chip)), [truocChip, chip]);
  const counts = useMemo(() => demChipFinish(truocChip), [truocChip]);
  const mucTieu = useMemo(() => tongHop(quaLoc(mucTieuGoc).filter((r) => khopChip(r, chip))), [quaLoc, mucTieuGoc, chip]);
  const ketQua = useMemo(() => tongHop(chua ? viewItems : viewItems.filter((r) => r.ngay === ngayTieuDe)),
    [viewItems, ngayTieuDe, chua]);
  const soDuocChuyen = useMemo(() => (chua ? items.filter((r) => r.duoc_chuyen).length : 0), [chua, items]);

  const xacNhanChuyen = async (r, lyDo) => {
    try {
      await chuyenFinish(r.phan_in_id, lyDo);
      show(`Đã chuyển finish ${r.ma_phan}`);
      setDongChuyen(null);
      load(true);
    } catch (e) {
      show(e.message || 'Chuyển finish thất bại', 'error');
      throw e;
    }
  };

  const soLoc = Object.values(filters).filter((v) => (v || '').trim()).length + (q.trim() ? 1 : 0);
  const th = 'px-2 py-2 text-xs font-semibold text-ink-soft align-bottom';
  const td = 'px-2 py-1.5 align-top whitespace-nowrap';
  const soCot = COT.length + 1 + (laSx ? 1 : 0) + (chua ? 1 : 0);

  // Toggle ở tiêu đề: Đã finish / Chưa finish (chỉ chế độ SX).
  const nutCheDo = (ma, ten) => (
    <button type="button" onClick={() => { setCheDo(ma); setChiChuyen(false); }}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${cheDo === ma
        ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:bg-surface-muted'}`}>
      {ten}
    </button>
  );
  const tieuDe = laSx ? (
    <span className="flex flex-wrap items-center gap-3">
      <span>{chua ? 'Phần in chưa finish' : `Danh sách finish ngày ${fmtDMY(ngayTieuDe)}`}</span>
      <span className="inline-flex rounded-full border border-line bg-surface p-0.5">
        {nutCheDo('FINISH', 'Đã finish')}{nutCheDo('CHUA', 'Chưa finish')}
      </span>
    </span>
  ) : `Danh sách finish ngày ${fmtDMY(ngayTieuDe)}`;

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay title={tieuDe}>
      <div className="shrink-0">
        {/* HÀNG 1 — khoảng ngày · ô tích · Xuất Excel */}
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink-soft">{!laSx ? 'Ngày OQC' : chua ? 'Ngày chạy hoàn tất' : 'Ngày finish (tích giao)'}</span>
            <DateRangePicker value={range} onChange={doiNgay} placeholder="Chọn ngày" />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
            <input type="checkbox" checked={conLoi} onChange={(e) => setConLoi(e.target.checked)} />
            Chỉ dòng còn SL lỗi
          </label>
          {chua && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft"
              title="Đủ 6 điều kiện mà SL đạt < SLĐH, hoặc admin đã mở điều kiện">
              <input type="checkbox" checked={chiChuyen} onChange={(e) => setChiChuyen(e.target.checked)} />
              Chỉ dòng chuyển finish được ({fmtNum(soDuocChuyen)})
            </label>
          )}
          {!chua && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft"
              title="Hàng do script dọn tồn sản xuất (hệ thống tự chạy đến giao) — mặc định không lên danh sách">
              <input type="checkbox" checked={heThong} onChange={(e) => setHeThong(e.target.checked)} />
              Gồm hàng hệ thống tự chạy
            </label>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button chiXemOk variant="secondary" icon="download" disabled={!viewItems.length && !mucTieu.phan}
              onClick={() => exportFinishListExcel(viewItems, {
                ngay: ngayTieuDe, mucTieu, ketQua,
                ...(chua ? { tieuDe: 'DANH SÁCH CHƯA FINISH — CHẠY HOÀN TẤT NGÀY' } : {}),
              }, chua ? 'danh-sach-chua-finish' : 'danh-sach-finish')}>Xuất Excel</Button>
          </div>
        </div>

        {/* HÀNG 2 — khối tổng như tờ giấy */}
        <div className="mb-2 space-y-1 rounded-control border border-line bg-surface-muted/40 px-3 py-2">
          <DongTong nhan="MỤC TIÊU" t={mucTieu} tone="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            giaiThich={`Phần in có đợt vải hạn giao ${fmtDMY(ngayTieuDe)}`} />
          {chua ? (
            <DongTong nhan="CHƯA FINISH" t={ketQua} tone="bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
              giaiThich="Phần in chạy hoàn tất trong khoảng ngày mà chưa finish (đang xem)" />
          ) : (
            <DongTong nhan="KẾT QUẢ" t={ketQua} tone="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
              giaiThich={laSx ? `Phần in finish ngày ${fmtDMY(ngayTieuDe)}` : `Phần in finish (OQC cho qua giao) ngày ${fmtDMY(ngayTieuDe)}`} />
          )}
          <div className="text-xs text-ink-soft">
            <b className="text-ink">{fmtNum(viewItems.length)}</b> code phần
            {laSx && (
              <span className="ml-2">· Finish khi đủ: chạy hoàn tất · kiểm xong · phân loại lỗi xong · sửa xong · qua OQC ·
                đã tích tem giao · SL đạt (đã tích) ≥ SLĐH</span>
            )}
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
              {chua && <th className={`${th} text-left`}>Chuyển finish</th>}
              {COT.map(([ten, canh], i) => {
                const nhan = chua && ten === 'Ngày cập nhật DS' ? 'Ngày chạy hoàn tất' : ten;
                return [
                  <th key={ten} title={giaiThich[ten] || undefined}
                    className={`${th} ${canh === 'right' ? 'text-right' : 'text-left'} ${giaiThich[ten] ? 'cursor-help' : ''}
                      ${ten === 'Ngày cập nhật kết quả' ? 'bg-yellow-100 dark:bg-yellow-900/40' : ''} ${ten === 'SL còn lại' ? 'text-danger' : ''}`}>
                    <div className="min-w-[3.5rem] max-w-[7rem] whitespace-normal leading-tight">{nhan}</div>
                  </th>,
                  // Sau cột ngày: "Kiểu finish" (Đã finish) / "Điều kiện" (Chưa finish).
                  i === 0 && laSx ? (
                    <th key="dk" className={`${th} text-left`}
                      title={chua ? 'Xanh = đạt, đỏ = còn thiếu' : 'Tự động = đủ 7 điều kiện · Chuyển tay = bấm Chuyển finish'}>
                      <div className="whitespace-normal leading-tight">{chua ? 'Điều kiện finish' : 'Kiểu finish'}</div>
                    </th>
                  ) : null,
                ];
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={soCot} className="px-3 py-8 text-center text-ink-soft">Đang tải...</td></tr>
            ) : viewItems.length === 0 ? (
              <tr><td colSpan={soCot} className="px-3 py-8 text-center text-ink-soft">
                {soLoc || conLoi || chiChuyen ? 'Không có dòng nào khớp ô tìm / bộ lọc'
                  : chip ? `Không có phần in nào thuộc ${nhanChip(chip)} trong khoảng ngày này`
                    : chua ? 'Không có phần in nào chạy hoàn tất mà chưa finish trong khoảng ngày này'
                      : laSx ? 'Chưa có phần in nào finish (tích tem giao đủ điều kiện) trong khoảng ngày này'
                        : 'Chưa có phần in nào được OQC cho qua giao trong khoảng ngày này'}
              </td></tr>
            ) : viewItems.map((r, i) => (
              <tr key={r.phan_in_id} className="border-t border-line/60 hover:bg-surface-muted/50">
                <td className={`${td} text-center text-ink-soft`}>{i + 1}</td>
                {chua && (
                  <td className={td}>
                    {r.duoc_chuyen && coQuyenChuyen ? (
                      <Button variant="primary" className="!px-2.5 !py-1 !text-xs" onClick={() => setDongChuyen(r)}>
                        Chuyển finish
                      </Button>
                    ) : <span className="text-xs text-ink-soft">—</span>}
                  </td>
                )}
                <td className={`${td} tabular-nums`}>{fmtDMY(r.ngay)}</td>
                {laSx && (
                  <td className={td}>
                    {chua ? (
                      <div className="space-y-1">
                        <DieuKienFinishChips r={r} />
                        <MoDieuKienBadge r={r} />
                      </div>
                    ) : <LoaiFinishBadge r={r} />}
                  </td>
                )}
                <td className={td}><OChu v={r.ten_khach_hang} rong="6rem" /></td>
                <td className={td}><OChu v={r.ma_don_hang} rong="9rem" /></td>
                <td className={td}>
                  <OChu v={r.ma_hang} rong="13rem" />
                  {laSx && <div className="text-[11px] text-ink-soft">{r.ma_phan}</div>}
                </td>
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
                <td className={td}><OChu v={r.ghi_chu || ''} rong="14rem" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HuyLyDoModal muc={dongChuyen} onClose={() => setDongChuyen(null)} onXacNhan={xacNhanChuyen}
        tieuDe="Chuyển finish" nhanNut="Chuyển finish" kieuNut="primary" nhanLyDo="Lý do chuyển finish"
        goiY="Vì sao cho finish khi chưa đủ SL (vd: khách chốt giao thiếu, hàng hư không bù)..." ghiChuErp=""
        moTa={(r) => (
          <div className="space-y-1">
            <div><b>{r.ma_phan}</b> · {r.ten_khach_hang} · {r.ma_don_hang}</div>
            <div className="text-xs text-ink-soft">
              SL đạt (đã tích giao) <b className="text-ink">{fmtNum(r.sl_dat)}</b> / SLĐH <b className="text-ink">{fmtNum(r.so_luong_don_hang)}</b>
              {r.mo_dieu_kien && r.thieu?.length ? ` · Admin đã mở điều kiện — còn thiếu: ${r.ghi_chu}` : ''}
            </div>
          </div>
        )}
        hauQua="Phần in vào Danh sách finish ngày hôm nay. Admin hủy được ở trang Hệ thống › Mở điều kiện finish." />

      <Toast toast={toast} />
    </Modal>
  );
}
