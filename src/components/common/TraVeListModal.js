import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Badge from './Badge';
import Icon from './Icon';
import Spinner from './Spinner';
import ChipTabs from './ChipTabs';
import DateRangePicker from './DateRangePicker';
import { filterRows } from './FieldFilters';
import { Field, Input } from './controls';
import exportPanelExcel from './exportPanelExcel';
import useNow from '../../hooks/useNow';
import { fmtDate, fmtDateTime, fmtNum } from '../../utils/format';
import { khopNhieu } from '../../utils/timKiem';
import { listTraVe } from '../../services/qualityService';

// ─────────────────────────────────────────────────────────────────────────────
// "DANH SÁCH TRẢ VỀ" — modal dùng chung cho MỌI màn nhận hàng bị trả về (25/09/2026).
// Mỗi màn truyền `loais` = các loại `qc_tra_ve.loai` ĐỔ VỀ màn đó (xem `TRA_VE_THEO_MAN`).
//   · Ngày trả về: mặc định HÔM NAY (người dùng chốt), để trống = mọi ngày.
//   · "Đã ở đây": đang chờ ⇒ tính tới BÂY GIỜ (đồng hồ chạy); đã xử lý ⇒ tới lúc được làm lại xong.
//   · Chip tình trạng + chip nguồn trả về + ô tìm + panel lọc 10 trường + Excel.
// ⚠ Nguồn là `qc_tra_ve` (mọi lượt, kể cả đã xử lý) — KHÁC ô tích "Chỉ hiện … bị trả về" trên màn
//   vốn chỉ soi cờ CHƯA xử lý của các hàng đang trên bảng.
// ─────────────────────────────────────────────────────────────────────────────

// Nhãn luồng: "từ đâu → về đâu" (khớp cách nói ở chuông thông báo).
export const LOAI_TRA_VE = {
  READY: 'QC READY trả về Kỹ thuật',
  RELEASE1: 'Kế hoạch trả về READY',
  TEST_RUN_KT: 'Test Run trả về READY',
  TEST_RUN: 'Test Run không đạt (chờ KT làm lại)',
  OQC: 'OQC trả về KCS',
  OQC_SUA: 'OQC trả về Sửa',
  OQC_GIA_CONG: 'OQC trả về Kế hoạch (gia công)',
  TRA_VE_GN: 'READY trả về Giao nhận',
};

// Loại trả về ĐỔ VỀ từng màn — thêm màn mới chỉ khai ở đây.
// ⚠ READY & QC READY dùng CHUNG 3 loại: từ 17/09/2026 trả về READY giữ xác nhận kỹ thuật, chỉ bỏ QC
//   ⇒ hàng Kế hoạch / Test Run trả về thực tế nằm ở hàng đợi QC, còn QC trả về thì nằm ở Kỹ thuật.
export const TRA_VE_THEO_MAN = {
  KT_READY: ['READY', 'RELEASE1', 'TEST_RUN_KT'],
  CL_QC_READY: ['READY', 'RELEASE1', 'TEST_RUN_KT'],
  KH_RELEASE1: ['TEST_RUN'],
  CL_TEST_RUN: ['TEST_RUN'],
  KH_GIA_CONG: ['OQC_GIA_CONG'],
  SX_KCS: ['OQC'],
  SX_SUA: ['OQC_SUA'],
};

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' },
  { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
  { key: 'nguoi', label: 'Người trả về', col: 'nguoi_tra_ve' },
  { key: 'lyDo', label: 'Lý do', col: 'ly_do' },
  { key: 'maLenh', label: 'Mã đợt SX / tem', col: 'ma_doi_tuong' },
];
const oTim = (r) => [r.ma_phan, r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.mau_vai, r.kich_vai,
  r.kich_phim, r.ly_do, r.checklist_list, r.nguoi_tra_ve, r.ma_doi_tuong];

const homNay = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Thời lượng dài (có thể nhiều ngày) → "2n 3h05′" / "3h05′" / "45′".
export function fmtThoiLuong(phut) {
  if (phut == null || !Number.isFinite(phut)) return '—';
  const m = Math.max(0, Math.floor(phut));
  const n = Math.floor(m / 1440); const h = Math.floor((m % 1440) / 60); const p = m % 60;
  if (n) return `${n}n ${h}h${String(p).padStart(2, '0')}′`;
  if (h) return `${h}h${String(p).padStart(2, '0')}′`;
  return `${p}′`;
}

const soPhut = (r, now) => {
  const bd = new Date(r.tg_tra_ve).getTime();
  if (Number.isNaN(bd)) return null;
  const kt = r.da_xu_ly ? new Date(r.tg_xu_ly).getTime() : now;
  return Number.isNaN(kt) ? null : (kt - bd) / 60000;
};

export default function TraVeListModal({ open, onClose, loais = [], tenMan = '', tenFile = 'danh-sach-tra-ve' }) {
  const now = useNow(30000);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loi, setLoi] = useState('');
  const [ngay, setNgay] = useState(() => { const d = homNay(); return { from: d, to: d }; });
  const [q, setQ] = useState('');
  const [chipTT, setChipTT] = useState('');
  const [chipLoai, setChipLoai] = useState('');
  const [filters, setFilters] = useState({});
  const [moLoc, setMoLoc] = useState(false);
  const [xuat, setXuat] = useState(false);
  // ⚠ Chuỗi khóa ổn định cho deps — `loais` là mảng mới mỗi render ở trang gọi (bẫy deps §9).
  const khoaLoai = (loais || []).join(',');

  const tai = useCallback(async () => {
    if (!khoaLoai) return;
    setLoading(true); setLoi('');
    try {
      const r = await listTraVe({ loai: khoaLoai, tuNgay: ngay.from || '', denNgay: ngay.to || '' });
      setRows((r.data || []).map((x) => ({
        ...x,
        ma_doi_tuong: [x.ma_lenh_san_xuat, x.ma_tem].filter(Boolean).join(' · '),
      })));
    } catch (e) {
      setLoi(e.message || 'Không tải được danh sách trả về'); setRows([]);
    } finally { setLoading(false); }
  }, [khoaLoai, ngay.from, ngay.to]);

  useEffect(() => { if (open) tai(); }, [open, tai]);

  const daLoc = useMemo(
    () => filterRows(rows, filters, FILTER_FIELDS).filter((r) => khopNhieu(oTim(r), q)),
    [rows, filters, q]
  );
  // ⚠ Số trên mỗi dải chip đếm trên tập đã qua ô tìm + panel + CHIP DẢI KIA (không áp chính nó) —
  //   áp cả chính nó thì chip đang chọn có số còn các chip khác về 0 (quy ước ChipTabs).
  const theoLoai = useMemo(() => (chipLoai ? daLoc.filter((r) => r.loai === chipLoai) : daLoc), [daLoc, chipLoai]);
  const theoTT = useMemo(() => (
    chipTT === 'CHO' ? daLoc.filter((r) => !r.da_xu_ly) : chipTT === 'DA' ? daLoc.filter((r) => r.da_xu_ly) : daLoc
  ), [daLoc, chipTT]);
  const viewRows = useMemo(() => (
    chipTT === 'CHO' ? theoLoai.filter((r) => !r.da_xu_ly) : chipTT === 'DA' ? theoLoai.filter((r) => r.da_xu_ly) : theoLoai
  ), [theoLoai, chipTT]);

  const demTT = useMemo(() => ({
    '': theoLoai.length,
    CHO: theoLoai.filter((r) => !r.da_xu_ly).length,
    DA: theoLoai.filter((r) => r.da_xu_ly).length,
  }), [theoLoai]);
  const demLoai = useMemo(() => {
    const m = { '': theoTT.length };
    (loais || []).forEach((l) => { m[l] = 0; });
    theoTT.forEach((r) => { m[r.loai] = (m[r.loai] || 0) + 1; });
    return m;
  }, [theoTT, loais]);

  const soLoc = FILTER_FIELDS.filter((f) => (filters[f.key] || '').trim()).length;
  const nhieuLoai = (loais || []).length > 1;

  const doXuat = async () => {
    setXuat(true);
    try {
      await exportPanelExcel({
        title: `DANH SÁCH TRẢ VỀ — ${tenMan}`,
        subtitle: `${viewRows.length} lượt · ngày trả về ${ngay.from || ngay.to ? `${ngay.from || '…'} → ${ngay.to || '…'}` : 'mọi ngày'}`
          + ` · xuất ${new Date().toLocaleString('vi-VN')}${q.trim() ? ` · tìm "${q.trim()}"` : ''}`,
        fileName: tenFile,
        rows: viewRows,
        cols: [
          { header: 'Tình trạng', width: 14, value: (r) => (r.da_xu_ly ? 'Đã xử lý' : 'Đang chờ'), red: (r) => !r.da_xu_ly, ok: (r) => r.da_xu_ly },
          { header: 'Thời gian trả về', width: 18, value: (r) => fmtDateTime(r.tg_tra_ve) },
          { header: 'Đã ở đây (phút)', num: true, width: 12, value: (r) => { const p = soPhut(r, now); return p == null ? '' : Math.floor(p); } },
          { header: 'Đã ở đây', width: 12, value: (r) => fmtThoiLuong(soPhut(r, now)) },
          ...(nhieuLoai ? [{ header: 'Nguồn trả về', width: 26, value: (r) => LOAI_TRA_VE[r.loai] || r.loai }] : []),
          { header: 'Khách hàng', value: (r) => r.ten_khach_hang },
          { header: 'Đơn hàng', value: (r) => r.ma_don_hang },
          { header: 'Mã hàng', value: (r) => r.ma_hang },
          { header: 'Code phần', width: 24, value: (r) => r.ma_phan },
          { header: 'Màu vải', value: (r) => r.mau_vai },
          { header: 'Kích vải', value: (r) => r.kich_vai },
          { header: 'Kích phim', value: (r) => r.kich_phim },
          { header: 'Hạn giao', type: 'date', width: 12, value: (r) => r.han_giao_hang },
          { header: 'Mã đợt SX / tem', value: (r) => r.ma_doi_tuong },
          { header: 'Chuyền', value: (r) => r.ten_chuyen },
          { header: 'Mục rớt', width: 22, value: (r) => r.checklist_list },
          { header: 'Lý do', width: 40, value: (r) => r.ly_do },
          { header: 'Người trả về', width: 20, value: (r) => r.nguoi_tra_ve },
          { header: 'Xử lý xong lúc', width: 18, value: (r) => (r.tg_xu_ly ? fmtDateTime(r.tg_xu_ly) : '') },
        ],
      });
    } catch (e) { setLoi(e.message || 'Xuất Excel thất bại'); } finally { setXuat(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay
      title={`Danh sách trả về${tenMan ? ` — ${tenMan}` : ''}`}
      footer={<Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>}>
      <div className="flex h-full flex-col">
        <div className="relative shrink-0 space-y-2 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-ink-soft">Ngày trả về:</span>
            <DateRangePicker value={ngay} onChange={setNgay} />
            <Button chiXemOk variant="ghost" onClick={() => { const d = homNay(); setNgay({ from: d, to: d }); }}>Hôm nay</Button>
            <Button chiXemOk variant="ghost" onClick={() => setNgay({ from: '', to: '' })}>Mọi ngày</Button>
            <div className="ml-auto flex items-center gap-2">
              <Button chiXemOk variant="secondary" icon="rotate-cw" onClick={tai}>Tải lại</Button>
              <Button chiXemOk variant="secondary" icon="filter" onClick={() => setMoLoc((v) => !v)}>
                Bộ lọc{soLoc ? ` (${soLoc})` : ''}
              </Button>
              <Button chiXemOk variant="secondary" icon="file-spreadsheet" loading={xuat} onClick={doXuat} disabled={!viewRows.length}>
                Excel ({viewRows.length})
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[16rem] flex-1">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm: code phần, khách, đơn, mã hàng, màu, kích, lý do, người trả về, mã đợt SX / tem..."
                className="h-10 w-full rounded-control border border-line pl-9 pr-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 md:text-sm" />
            </div>
            {(q || soLoc > 0 || chipTT || chipLoai) && (
              <Button chiXemOk variant="ghost" onClick={() => { setQ(''); setFilters({}); setChipTT(''); setChipLoai(''); }}>Xóa lọc</Button>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-x-6">
            <ChipTabs value={chipTT} onChange={setChipTT} counts={demTT}
              tabs={[{ v: '', label: 'Tất cả' }, { v: 'CHO', label: 'Đang chờ xử lý' }, { v: 'DA', label: 'Đã xử lý' }]} />
            {nhieuLoai && (
              <ChipTabs value={chipLoai} onChange={setChipLoai} counts={demLoai}
                tabs={[{ v: '', label: 'Mọi nguồn' }, ...loais.map((l) => ({ v: l, label: LOAI_TRA_VE[l] || l }))]} />
            )}
          </div>

          {/* Panel NỔI (absolute) — modal `lapDay` không cuộn thân; chiếm chỗ là ép bảng co về ~0. */}
          {moLoc && (
            <div className="absolute right-0 top-full z-30 grid w-full max-w-3xl grid-cols-2 gap-2 rounded-control border border-line bg-surface p-3 shadow-card-hover md:grid-cols-3"
              style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {FILTER_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Input value={filters[f.key] || ''} onChange={(e) => setFilters((m) => ({ ...m, [f.key]: e.target.value }))} />
                </Field>
              ))}
              <div className="col-span-2 flex items-end md:col-span-3">
                <Button chiXemOk variant="ghost" onClick={() => setFilters({})}>Xóa lọc trong panel</Button>
              </div>
            </div>
          )}
        </div>

        <div className="min-h-[10rem] flex-1 overflow-auto rounded-control border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted">
              <tr>
                {['STT', 'Tình trạng', 'Trả về lúc', 'Đã ở đây', ...(nhieuLoai ? ['Nguồn'] : []), 'Khách · Đơn', 'Mã hàng',
                  'Code phần', 'Màu · Kích (vải/phim)', 'Hạn giao', 'Mã đợt SX / tem', 'Lý do', 'Người trả về'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-ink-soft">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={14} className="py-10 text-center"><Spinner size={22} /></td></tr>}
              {!loading && loi && <tr><td colSpan={14} className="py-10 text-center text-sm text-danger">{loi}</td></tr>}
              {!loading && !loi && !viewRows.length && (
                <tr><td colSpan={14} className="py-10 text-center text-sm text-ink-soft">
                  Không có lượt trả về nào{ngay.from || ngay.to ? ' trong khoảng ngày đã chọn' : ''}.
                </td></tr>
              )}
              {!loading && viewRows.map((r, i) => {
                const phut = soPhut(r, now);
                return (
                  <tr key={r.id} className={`border-t border-line/70 align-top ${r.da_xu_ly ? '' : 'bg-rose-50/50 dark:bg-rose-950/20'}`}>
                    <td className="px-2 py-1.5 text-xs text-ink-soft">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      {r.da_xu_ly
                        ? <Badge tone="success" className="whitespace-nowrap">Đã xử lý</Badge>
                        : <Badge tone="danger" className="whitespace-nowrap">Đang chờ</Badge>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs">{fmtDateTime(r.tg_tra_ve)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                      <span className={r.da_xu_ly ? 'text-ink-soft' : 'font-semibold text-danger'}>{fmtThoiLuong(phut)}</span>
                      {r.da_xu_ly && r.tg_xu_ly && (
                        <div className="text-[11px] text-ink-soft">xong {fmtDateTime(r.tg_xu_ly)}</div>
                      )}
                    </td>
                    {nhieuLoai && <td className="px-2 py-1.5 text-xs">{LOAI_TRA_VE[r.loai] || r.loai}</td>}
                    <td className="px-2 py-1.5">
                      <div>{r.ten_khach_hang || '—'}</div>
                      <div className="text-xs text-ink-soft">{r.ma_don_hang || ''}</div>
                    </td>
                    <td className="px-2 py-1.5"><div className="max-w-[12rem] break-words">{r.ma_hang || '—'}</div></td>
                    <td className="px-2 py-1.5 font-medium"><div className="max-w-[14rem] break-words">{r.ma_phan || '—'}</div></td>
                    <td className="px-2 py-1.5">
                      <div>{r.mau_vai || '—'}</div>
                      <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' / ')}</div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs">{r.han_giao_hang ? fmtDate(r.han_giao_hang) : '—'}</td>
                    <td className="px-2 py-1.5 text-xs">
                      {r.ma_doi_tuong || '—'}
                      {r.ten_chuyen && <div className="text-ink-soft">{r.ten_chuyen}</div>}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="max-w-[22rem] whitespace-normal break-words">{r.ly_do}</div>
                      {r.checklist_list && <div className="text-xs text-danger">Mục rớt: {r.checklist_list}</div>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs">{r.nguoi_tra_ve || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="shrink-0 pt-2 text-xs text-ink-soft">
          <b className="text-ink">{fmtNum(viewRows.length)}</b> lượt trả về · <b className="text-danger">"Đã ở đây"</b> của
          lượt đang chờ tính tới bây giờ, lượt đã xử lý tính tới lúc làm lại xong.
        </div>
      </div>
    </Modal>
  );
}

// Nút mở modal — đặt cạnh nút "Nghẽn" trên Toolbar.
export function TraVeListButton({ onClick }) {
  return (
    <Button variant="secondary" icon="undo" chiXemOk onClick={onClick}>Trả về</Button>
  );
}
