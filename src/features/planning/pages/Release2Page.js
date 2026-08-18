import { useEffect, useState, useCallback, useMemo } from 'react';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import GomBadge from '../../../components/common/GomBadge';
import Button from '../../../components/common/Button';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import { codesCuaLenh, laGomSet } from '../utils/phanInLenh';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import PhuongAnInBadge, { PHUONG_AN_IN } from '../../../components/common/PhuongAnInBadge';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import { listRelease2Candidates, approveRelease2, approveRelease2Batch, planHistory, release2Done } from '../../../services/planningService';
import { fmtNum, fmtDate, trongKhoangNgay } from '../../../utils/format';
import DateRangePicker from '../../../components/common/DateRangePicker';
import exportCheckpointExcel, { COT_LENH, moTaBoLoc } from '../../../utils/exportCheckpointExcel';
// Chip lọc theo LOẠI CHUYỀN + KHU của chuyền Bàn — nguồn chung `utils/khuChuyen.js`, dùng chung với
// "Theo dõi chuyền" · "Test Run - QA" · "Xác nhận chạy" ⇒ 4 màn luôn giống hệt nhau.
// ⚠ KHÔNG cần sửa backend: `lenhListSql` (dùng chung Test Run/Release 2/Replan) đã trả sẵn
//   `ma_chuyen` + `ma_loai_chuyen` — 2 cột mà chip khu và chip loại cần.
import { LOAI_TABS, hopChipChuyen as hopChip, nhanChip, demChip, locSiSoTheoChip } from '../../../utils/khuChuyen';
import ChipTabs from '../../../components/common/ChipTabs';

const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' }, { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' }, { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' }, { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];

// Ô thông tin trong SidePanel chi tiết (cùng kiểu màn Release 1).
function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{value == null || value === '' ? '—' : value}</div>
    </div>
  );
}

export default function Release2Page() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const { statusLenh } = useNghenMap();
  const canApprove = can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [nghenOpen, setNghenOpen] = useState(false); // modal "Danh sách nghẽn"
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null); // row (đơn) hoặc { batch: true }
  const [busy, setBusy] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [detail, setDetail] = useState(null); // bấm vào hàng → SidePanel chi tiết lệnh
  const [loai, setLoai] = useState(''); // chip loại chuyền / khu bàn ('' = tất cả)

  // Dải "Theo dõi" (sĩ số) bám ô tìm + panel lọc + dải chip loại chuyền/khu của màn này.
  useSiSoLoc({ timKiem: search, ...filters, ...locSiSoTheoChip(loai) });
  // Lọc theo NGÀY SX KẾ HOẠCH (`lenh_san_xuat.ngay_ke_hoach`) — cùng khuôn màn Xác nhận chạy.
  // ⚠ Mặc định KHÔNG lọc: đây là màn thao tác hằng ngày, lọc sẵn hôm nay sẽ giấu hàng của ngày khác
  //   mà người dùng không biết vì sao (bài học ghi ở §6 Sản xuất).
  const [ngayKH, setNgayKH] = useState({ from: '', to: '' });
  // ⚠ So sánh ngày PHẢI qua `trongKhoangNgay` — `ngay_ke_hoach` là cột DATE, node-pg trả Date lúc
  //   00:00 giờ LOCAL; dùng `toISOString()` sẽ LÙI 1 NGÀY ở giờ VN ⇒ lọc trượt hết.
  const locNgay = useCallback((ds) => (ds || []).filter((r) => trongKhoangNgay(r.ngay_ke_hoach, ngayKH.from, ngayKH.to)), [ngayKH]);

  // Chip chồng lên bộ lọc trường + khoảng ngày theo AND (giống Test Run).
  const filtered = useMemo(() => {
    let base = locNgay(rows);
    if (loai) base = base.filter((r) => hopChip(r, loai));
    return filterRows(base, filters, FILTER_FIELDS);
  }, [rows, filters, loai, locNgay]);
  // ⚠ Đếm cho chip tính trên tập ĐÃ qua khoảng ngày (nhưng chưa qua chip) — nếu không trừ theo ngày
  //   thì số trên chip sẽ LỚN HƠN tổng số dòng của bảng.
  const countChip = useMemo(() => demChip(locNgay(rows)), [rows, locNgay]);
  const activeCount = Object.values(filters).filter(Boolean).length;

  // Xuất Excel TOÀN BỘ lệnh sau bộ lọc (trang tải-hết rồi phân trang client ⇒ không giới hạn trang xem).
  const doExcel = () => exportCheckpointExcel({
    cols: COT_LENH,
    rows: filtered,
    title: 'Release 2 — chờ duyệt cuối',
    fileName: 'release-2',
    moTaLoc: moTaBoLoc({
      'tìm kiếm': search, khu: nhanChip(loai),
      'ngày SX kế hoạch': [ngayKH.from, ngayKH.to].filter(Boolean).join(' → '),
      ...filters,
    }),
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await listRelease2Candidates({ search, limit: 500 });
      setRows(res.data.items);
      if (!silent) setSelected(new Set());
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Tự tải lại khi trạm khác xác nhận (tránh màn để lâu → dữ liệu cũ).
  // Bỏ qua khi đang tick dở để không mất lựa chọn — `load` xóa danh sách đã chọn.
  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua `setLoading(true)` (bảng không bị
  // thay bằng spinner) và KHÔNG xóa dòng đang tích. Nhiều sự kiện trong 400ms gộp thành 1 lần tải.
  useSocketReload(['workflow:updated'], () => load(true));

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Chọn tất cả = mọi dòng SAU LỌC (spanning mọi trang phân trang client của DataTable), không chỉ trang hiện tại.
  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(filtered.map((r) => r.id))));

  const doApprove = async () => {
    setBusy(true);
    try {
      if (confirm.batch) {
        const res = await approveRelease2Batch([...selected]);
        const { okCount, failedCount } = res.data;
        show(failedCount ? `Đã duyệt ${okCount} lệnh, ${failedCount} lỗi` : `Đã Release 2 ${okCount} lệnh`,
          failedCount ? 'error' : 'success');
      } else {
        await approveRelease2(confirm.id);
        show(`Đã Release 2 — ${confirm.ma_lenh_san_xuat} sẵn sàng sản xuất`);
      }
      setConfirm(null);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    ...(canApprove ? [{ key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)} aria-label="Chọn lệnh" />
      ) }] : []),
    // ⚠⚠ LỆNH GOM SET TÁCH 1 DÒNG / PHẦN IN — giống màn Release 1 & Lập kế hoạch lại (18/08/2026).
    //   Bảng này đọc thẳng `r.*` mà query mức lệnh (`PHAN_INFO_LATERAL`) chỉ `LIMIT 1` ⇒ lệnh gom set
    //   chỉ hiện phần in ĐẠI DIỆN, các phần in còn lại biến mất. Cơ chế: `subRows` + cột `merge`.
    // ⚠ GomBadge là thông tin MỨC LỆNH ⇒ chuyển vào cột `merge` (trước nằm dưới "Mã hàng" — cột theo
    //   phần in — nên sẽ lặp ở mọi dòng con).
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', merge: true, render: (r) => (
      <div className="space-y-1">
        <Badge tone="info">{r.ma_lenh_san_xuat}</Badge>
        {r.so_dot_vai > 1 && <div><GomBadge soDotVai={r.so_dot_vai} soPhanIn={r.so_phan_in} /></div>}
      </div>
    ) },
    // ↓ Các cột THEO PHẦN IN — dòng con ghi đè giá trị nên mỗi phần in hiện đúng dữ liệu của nó.
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    // Code phần là trường ĐANG ĐƯỢC LỌC/QUÉT, và là thứ duy nhất phân biệt các dòng con của gom set.
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    // ↓ Từ đây là mức LỆNH → hợp nhất ô (giá trị lấy từ đợt vải ĐẠI DIỆN nên chỉ có MỘT).
    { key: 'phuong_an_in', header: 'Phương án in', merge: true, render: (r) => <PhuongAnInBadge value={r.phuong_an_in} /> },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', merge: true, render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    // Nhà gia công (ERP NGC, mig 072) — theo ĐỢT NHẬN VẢI; lệnh gộp nhiều đợt thì gộp DISTINCT ở BE.
    { key: 'nha_gia_cong', header: 'Nhà gia công', merge: true, render: (r) => r.nha_gia_cong || '—' },
    { key: 'sl_vai_don', header: 'SL vải về / đơn', className: 'text-right tabular-nums whitespace-nowrap', merge: true, render: (r) => (
      <span><b className="text-ink">{fmtNum(r.so_luong_vai_ve)}</b><span className="text-ink-soft"> / {fmtNum(r.so_luong_don_hang)}</span></span>
    ) },
    { key: 'ngay_vai_ve', header: 'Ngày nhận vải', merge: true, render: (r) => fmtDate(r.ngay_vai_ve) },
    { key: 'han_giao_hang', header: 'Hạn giao', merge: true, render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'chuyen', header: 'Chuyền', merge: true, render: (r) => r.ten_chuyen || '—' },
    { key: 'ngay_ke_hoach', header: 'Ngày SX kế hoạch', merge: true, render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'test', header: 'Test', className: 'whitespace-nowrap', merge: true,
      render: () => <Badge tone="success" className="whitespace-nowrap">CNSP ✓ · QA ✓</Badge> },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', merge: true, render: (r) =>
      canApprove && <Button className="px-2.5 py-1 text-xs" onClick={() => setConfirm(r)}>Duyệt Release 2</Button> },
  ];

  // Lệnh GOM SET → tách 1 dòng / PHẦN IN. Lệnh thường trả `null` ⇒ render y như cũ.
  const subRows = (r) => (r.phan_in_list ? r.phan_in_list.map((p) => ({ ...p, __sub: true })) : null);

  return (
    <div>
      <Toolbar title="Release 2 — duyệt cuối" subtitle="Kế hoạch duyệt lệnh đã đủ test (CNSP + QA) để vào sản xuất"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {canApprove && (
          <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR code phần</Button>
        )}
        {canApprove && selected.size > 0 && (
          <Button onClick={() => setConfirm({ batch: true })}>Duyệt Release 2 ({selected.size})</Button>
        )}
        <DateRangePicker value={ngayKH} onChange={setNgayKH} placeholder="Ngày SX kế hoạch" />
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="secondary" icon="download" onClick={doExcel} disabled={!filtered.length}>
          Excel ({filtered.length})
        </Button>
        <NghenButton rows={rows} trangThai={(r) => statusLenh(r.id)} onClick={() => setNghenOpen(true)} />
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{filtered.length} chờ duyệt</Badge>
      </Toolbar>

      <ChipTabs tabs={LOAI_TABS} value={loai} counts={countChip} onChange={setLoai} />

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      {/* Khối gom set: tách dòng theo phần in + VIỀN TRÁI xanh như màn Release 1.
          ⚠ Dùng `border-l`, KHÔNG đổi nền — nền đang dành cho màu cảnh báo SLA nghẽn. */}
      <DataTable columns={columns} rows={filtered} loading={loading} sttStart={0}
        onRowClick={(r) => setDetail(r)}
        subRows={subRows}
        rowClassName={(r) => `${slaRowClass(statusLenh(r.id))} ${laGomSet(r) ? 'border-l-[3px] border-l-primary' : ''}`}
        emptyText={loai
          ? `Không có lệnh nào thuộc "${nhanChip(loai)}" đang chờ Release 2`
          : 'Không có lệnh nào chờ Release 2'} />

      {/* Bấm vào HÀNG (không phải ô chọn / nút) → SidePanel chi tiết lệnh, duyệt được ngay tại đây. */}
      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Release 2 — ${detail.ma_lenh_san_xuat || ''}` : 'Chi tiết lệnh'}
        subtitle={detail ? [detail.ten_khach_hang, detail.ma_don_hang, detail.ma_phan].filter(Boolean).join(' · ') : ''}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>Đóng</Button>
            {canApprove && detail && (
              <Button onClick={() => { const r = detail; setDetail(null); setConfirm(r); }}>Duyệt Release 2</Button>
            )}
          </>
        )}
      >
        {detail && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Info label="Mã lệnh" value={detail.ma_lenh_san_xuat} />
            <Info label="Chuyền" value={detail.ten_chuyen} />
            <Info label="Khách hàng" value={detail.ten_khach_hang} />
            <Info label="Đơn hàng" value={detail.ma_don_hang} />
            <Info label="Mã hàng" value={detail.ma_hang} />
            <Info label="Code phần" value={detail.ma_phan} />
            <Info label="Màu vải" value={detail.mau_vai} />
            <Info label="Kích vải / phim" value={[detail.kich_vai, detail.kich_phim].filter(Boolean).join(' / ')} />
            <Info label="Tính chất in" value={detail.tinh_chat_in} />
            <Info label="Phương án in" value={PHUONG_AN_IN[Number(detail.phuong_an_in)] || null} />
            <Info label="Loại đợt vải" value={detail.loai_dot_vai} />
            <Info label="Số đợt vải trong lệnh" value={detail.so_dot_vai} />
            <Info label="SL vải về" value={fmtNum(detail.so_luong_vai_ve)} />
            <Info label="SL đơn hàng" value={fmtNum(detail.so_luong_don_hang)} />
            <Info label="SL release" value={fmtNum(detail.so_luong_release)} />
            <Info label="Ngày nhận vải" value={fmtDate(detail.ngay_vai_ve)} />
            <Info label="Hạn giao" value={fmtDate(detail.han_giao_hang)} />
            <Info label="Ngày SX kế hoạch" value={fmtDate(detail.ngay_ke_hoach)} />
          </div>
        )}
      </SidePanel>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doApprove}
        loading={busy}
        title="Duyệt Release 2"
        message={!confirm ? '' : confirm.batch
          ? `Xác nhận Release 2 cho ${selected.size} lệnh đã chọn? Các lệnh sẽ sẵn sàng vào sản xuất.`
          : `Xác nhận Release 2 cho lệnh ${confirm.ma_lenh_san_xuat}? Lệnh sẽ sẵn sàng vào sản xuất.`}
        confirmText="Release 2"
      />

      <ScanCollectModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Quét QR code phần — Release 2"
        help="Quét QR code phần để chọn các lệnh chờ duyệt của phần in đó. Quét nhiều rồi bấm Duyệt để duyệt tất cả cùng lúc."
        rows={rows}
        getId={(r) => r.id}
        getCodes={codesCuaLenh}
        matchMultiple
        isSelected={(r) => selected.has(r.id)}
        onToggle={(r) => toggleOne(r.id)}
        primaryLabel={(r) => r.ma_phan || r.ma_lenh_san_xuat || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.mau_vai, r.ma_lenh_san_xuat].filter(Boolean).join(' · ')}
        onConfirm={() => { setScanOpen(false); setConfirm({ batch: true }); }}
        confirmLabel="Duyệt Release 2"
      />

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử kế hoạch (Release 2 + lập lại)" fetcher={planHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã Release 2" maHeader="Lệnh" fetcher={release2Done} />

      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="Release 2" rows={rows} trangThai={(r) => statusLenh(r.id)} tenFile="nghen-release-2" />
      <Toast toast={toast} />
    </div>
  );
}
