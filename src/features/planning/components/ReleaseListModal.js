import { useEffect, useState, useCallback, useMemo } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import { fmtNum } from '../../../utils/format';
import { getReleaseList } from '../../../services/planningService';
import exportReleaseListExcel from '../utils/exportReleaseListExcel';
import printReleaseList from '../utils/printReleaseList';
import ChipTabs from '../../../components/common/ChipTabs';
import Icon from '../../../components/common/Icon';
import FieldFilters, { filterRows, FilterToggle } from '../../../components/common/FieldFilters';
import { khopNhieu } from '../../../utils/timKiem';
import { LOAI_TABS, hopChipChuyen, nhanChip, demChip } from '../../../utils/khuChuyen';
import { gopTheoLenh, demLenh } from '../utils/gopDongRelease';

// Bộ lọc từng trường (client-side — modal tải trọn 1 ngày nên lọc tại chỗ là đủ).
const FILTER_FIELDS = [
  { key: 'chuyen', label: 'Chuyền', col: 'ten_chuyen' },
  { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' },
  { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];
// Các trường mà ô tìm 1-ô quét qua (bất kỳ trường nào khớp là được) — tìm KHÔNG DẤU.
const oTimCols = (r) => [
  r.ten_chuyen, r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.ten_ma_hang,
  r.ma_phan, r.mau_vai, r.kich_vai, r.kich_phim, r.ma_lenh_san_xuat,
];

const tomorrowStr = () => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const pad = (n) => String(n).padStart(2, '0');
const fmtClock = (ts) => {
  if (!ts) return '—';
  const x = new Date(ts); if (Number.isNaN(+x)) return '—';
  let h = x.getHours(); const m = x.getMinutes(); const ap = h < 12 ? 'AM' : 'PM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${pad(m)} ${ap}`;
};
const fmtDMY = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

// Modal "Danh sách release" theo ngày kế hoạch — bảng bám form + Xuất Excel + In A4.
export default function ReleaseListModal({ open, onClose }) {
  const { toast, show } = useToast();
  const [date, setDate] = useState(tomorrowStr);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  // '' = tat ca | 'MAY'/'BAN'... | 'KHU:<key>' (chia nho chuyen Ban)
  const [chip, setChip] = useState('');
  const [q, setQ] = useState('');            // o tim 1-o
  const [filters, setFilters] = useState({}); // panel loc tung truong
  const [moLoc, setMoLoc] = useState(false);
  // CHE DO NGAY: 'KE_HOACH' (ngay hang len chuyen - de in phieu release) | 'RELEASE' (ngay bam
  // Release 1). Dung 'RELEASE' thi chip "Tat ca" khop dung voi sidebar "Da hoan thanh" cua Release 1.
  const [mode, setMode] = useState('KE_HOACH');

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const r = await getReleaseList(date, mode);
      setItems(r.data.items || []);
      setMeta(r.data.meta || null);
    } catch (e) {
      show(e.message || 'Lỗi tải danh sách release', 'error');
      setItems([]); setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [open, date, mode, show]);

  useEffect(() => { load(); }, [load]);

  // Loc theo chip (loai chuyen / khu Ban) - dung chung luat voi Theo doi chuyen & Test Run,
  // roi loc tiep theo o tim 1-o + panel loc tung truong (ket hop AND).
  const chipItems = useMemo(() => items.filter((r) => hopChipChuyen(r, chip)), [items, chip]);
  // ⚠ `gopTheoLenh` gắn `_stt`/`_dau`/`_span` để STT đếm theo ĐỢT SX và ô mức lệnh hợp nhất bằng
  //   rowSpan. Phải gọi SAU khi lọc — span tính trên tập ĐANG HIỂN THỊ (xem ghi chú trong helper).
  const viewItems = useMemo(
    () => gopTheoLenh(filterRows(chipItems, filters, FILTER_FIELDS).filter((r) => khopNhieu(oTimCols(r), q))),
    [chipItems, filters, q]
  );
  // So dem tren chip tinh tren tap DA qua o tim + bo loc (chip chi la 1 chieu loc khac) => bam chip
  // nao cung thay dung so dong se hien ra.
  const counts = useMemo(
    () => demChip(filterRows(items, filters, FILTER_FIELDS).filter((r) => khopNhieu(oTimCols(r), q))),
    [items, filters, q]
  );
  const soLoc = Object.values(filters).filter((v) => (v || '').trim()).length + (q.trim() ? 1 : 0);
  const dangLoc = !!chip || soLoc > 0;
  // Cac so tong phai tinh LAI theo tap DANG XEM, khong dung `meta` cua server: neu khong thi bam chip
  // loc con 3 dong ma van hien "Tong phan 49" - hai con so da nhau ngay tren cung mot man.
  const metaXem = useMemo(() => {
    if (!meta) return null;
    if (!dangLoc) return meta;
    const uniq = (k) => new Set(viewItems.map((r) => r[k]).filter(Boolean)).size;
    return {
      ...meta,
      tong_don: uniq('ma_don_hang'), tong_ma: uniq('ma_hang'), tong_phan: uniq('ma_phan'),
      so_lenh: uniq('lenh_id'),
      // ⚠ Cộng `sl_release_phan` (đã tách theo phần in), KHÔNG cộng `so_luong_release` — lệnh gom set
      //   ra nhiều dòng nên cộng số của LỆNH sẽ đếm trùng.
      sl_release: viewItems.reduce((acc, r) => acc + (Number(r.sl_release_phan) || 0), 0),
    };
  }, [meta, dangLoc, viewItems]);

  const th = 'px-2 py-2 text-xs font-semibold text-ink-soft whitespace-nowrap';
  const td = 'px-2 py-1.5 whitespace-nowrap';

  return (
    <Modal open={open} onClose={onClose} size="xl" title={`Danh sách release ${fmtDMY(date)}`}>
      {/* HÀNG 1 — gọn 1 dòng: [Ngày] [toggle chế độ ngày] ....... [Xuất Excel] [In].
          ⚠ Các số tổng ĐÃ TÁCH xuống hàng riêng: để chung hàng thì nó chiếm hết chỗ, đẩy 2 nút xuống
          dòng dưới và đầu modal trông rối. */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-soft">{mode === 'RELEASE' ? 'Ngày release' : 'Ngày kế hoạch'}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-input border border-line px-3 text-sm focus:border-primary focus:outline-none" />
        </label>
        {/* 2 CHẾ ĐỘ NGÀY — 2 câu hỏi khác nhau, đừng lẫn:
            · Ngày kế hoạch = hàng LÊN CHUYỀN ngày đó (dùng in phiếu release cho xưởng)
            · Ngày release  = ngày BẤM Release 1 ⇒ khớp sidebar "Đã hoàn thành" của màn Release 1 */}
        <div className="flex items-center gap-1 rounded-control border border-line p-0.5">
          {[['KE_HOACH', 'Theo ngày kế hoạch'], ['RELEASE', 'Theo ngày release']].map(([m, nhan]) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`rounded-[10px] px-2.5 py-1 text-xs font-medium ${mode === m ? 'bg-primary text-white' : 'text-ink-soft hover:bg-surface-muted'}`}>
              {nhan}
            </button>
          ))}
        </div>
        {/* `ml-auto` đẩy 2 nút sang mép PHẢI của CHÍNH hàng này */}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" icon="download" disabled={!viewItems.length}
            onClick={() => exportReleaseListExcel(viewItems, metaXem)}>Xuất Excel</Button>
          <Button icon="printer" disabled={!viewItems.length}
            onClick={() => printReleaseList(viewItems, metaXem)}>In</Button>
        </div>
      </div>

      {/* HÀNG 2 — các số tổng */}
      {metaXem && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
          <span>Tổng đơn <b className="text-ink">{fmtNum(metaXem.tong_don)}</b></span>
          <span>Tổng mã <b className="text-ink">{fmtNum(metaXem.tong_ma)}</b></span>
          <span>Tổng phần <b className="text-ink">{fmtNum(metaXem.tong_phan)}</b></span>
          <span>SL release <b className="text-ink">{fmtNum(metaXem.sl_release)}</b></span>
          {/* Đơn vị điều hành là ĐỢT SX ⇒ để nó lên trước; số dòng phần in chỉ là phụ đề. */}
          <span className="text-ink">
            <b>{fmtNum(demLenh(viewItems))}</b> đợt SX
            {dangLoc ? <span className="text-ink-soft">/{metaXem.so_lenh}</span> : ''}
            <span className="text-ink-soft"> · {viewItems.length} dòng phần in</span>
          </span>
        </div>
      )}

      {/* Ô tìm 1-ô + panel lọc từng trường (kết hợp AND với nhau và với chip loại chuyền) */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm chuyền, khách, đơn, mã hàng, code phần, màu, kích, mã LSX..."
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
      <div className="max-h-[62vh] overflow-auto rounded-control border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-muted">
            <tr className="border-b border-line">
              <th className={`${th} w-10 text-center`}>STT</th>
              <th className={`${th} text-left`}>Chuyền</th>
              <th className={`${th} text-left`}>KH</th>
              <th className={`${th} text-left`}>PO</th>
              <th className={`${th} text-left`}>Mã</th>
              <th className={`${th} text-left`}>Code phần</th>
              <th className={`${th} text-left`}>Màu vải</th>
              <th className={`${th} text-left`}>Kích vải</th>
              <th className={`${th} text-left`}>Kích phim</th>
              <th className={`${th} text-right`}>SLĐH</th>
              <th className={`${th} text-right`}>SLNV</th>
              <th className={`${th} text-right`}>SL đã in</th>
              <th className={`${th} text-right`}>SL đã giao</th>
              <th className={`${th} text-right`}>SL release</th>
              <th className={`${th} text-left`}>Owner</th>
              <th className={`${th} text-left`}>Giờ BD</th>
              <th className={`${th} text-left`}>Giờ KT</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={17} className="px-3 py-8 text-center text-ink-soft">Đang tải...</td></tr>
            ) : viewItems.length === 0 ? (
              <tr><td colSpan={17} className="px-3 py-8 text-center text-ink-soft">
                {soLoc ? 'Không có dòng nào khớp ô tìm / bộ lọc'
                  : chip ? `Không có đợt sản xuất nào thuộc ${nhanChip(chip)} trong ngày này`
                    : 'Không có đợt sản xuất release cho ngày này'}
              </td></tr>
            ) : viewItems.map((r) => (
              /* SỐ DÒNG ĐẾM THEO ĐỢT SX: các ô ở MỨC LỆNH (STT · Chuyền · SL đã in/giao · Owner ·
                 Giờ BD/KT) chỉ vẽ ở DÒNG ĐẦU của đợt và hợp nhất bằng `rowSpan`; các dòng sau chỉ
                 mang thông tin riêng của phần in. Viền TRÊN chỉ kẻ ở dòng đầu ⇒ nhìn ra ngay 1 đợt SX
                 là 1 khối. `_span`/`_dau`/`_stt` do `gopTheoLenh` gắn (tính trên tập ĐANG HIỂN THỊ). */
              <tr key={`${r.lenh_id}-${r.ma_phan}`}
                className={r._dau ? 'border-t border-line/60' : ''}>
                {r._dau && (
                  <td rowSpan={r._span} className={`${td} text-center font-medium text-ink-soft`}>
                    {r._stt}
                  </td>
                )}
                {r._dau && (
                  <td rowSpan={r._span} className={`${td} font-medium text-ink`}>
                    {r.ten_chuyen || '—'}
                    {r._span > 1 && (
                      <div className="mt-0.5">
                        <span className="rounded-full bg-primary-wash px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          gom set {r._span} phần in
                        </span>
                      </div>
                    )}
                  </td>
                )}
                <td className={td}>{r.ten_khach_hang || '—'}</td>
                <td className={td}>{r.ma_don_hang || '—'}</td>
                <td className={`${td} max-w-[200px] truncate`}>{r.ten_ma_hang || r.ma_hang || '—'}</td>
                <td className={td}>{r.ma_phan || '—'}</td>
                <td className={td}>{r.mau_vai || '—'}</td>
                <td className={td}>{r.kich_vai || '—'}</td>
                <td className={td}>{r.kich_phim || '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.so_luong_don_hang)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtNum(r.slnv)}</td>
                {/* SL đã in / đã giao chỉ tính được ở mức LỆNH (tem không lưu phần in) ⇒ hợp nhất ô,
                    KHÔNG lặp số ở từng dòng (lặp là có người cộng dồn thành số sai). */}
                {r._dau && <td rowSpan={r._span} className={`${td} text-right tabular-nums`}>{r.sl_da_in == null ? '' : fmtNum(r.sl_da_in)}</td>}
                {r._dau && <td rowSpan={r._span} className={`${td} text-right tabular-nums`}>{r.sl_da_giao == null ? '' : fmtNum(r.sl_da_giao)}</td>}
                <td className={`${td} text-right tabular-nums font-semibold text-primary`}>{fmtNum(r.sl_release_phan)}</td>
                {r._dau && <td rowSpan={r._span} className={`${td}`} />}{/* Owner để trống (ký tay) */}
                {r._dau && <td rowSpan={r._span} className={`${td} tabular-nums`}>{fmtClock(r.tg_bd_kh)}</td>}
                {r._dau && <td rowSpan={r._span} className={`${td} tabular-nums`}>{fmtClock(r.tg_kt_kh)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Toast toast={toast} />
    </Modal>
  );
}
