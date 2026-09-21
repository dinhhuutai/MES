import { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import DataTable from '../../../components/common/DataTable';
import SidePanel from '../../../components/common/SidePanel';
import Pagination from '../../../components/common/Pagination';
import Spinner from '../../../components/common/Spinner';
import Toast from '../../../components/common/Toast';
import { Input } from '../../../components/common/controls';
import FieldFilters, { FilterToggle } from '../../../components/common/FieldFilters';
import DateRangePicker from '../../../components/common/DateRangePicker';
import useToast from '../../../hooks/useToast';
import { fmtNum, fmtDateTime, temCode } from '../../../utils/format';
import exportCheckpointExcel, { cotTemChung, moTaBoLoc } from '../../../utils/exportCheckpointExcel';
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';
import TemInPreview from './TemInPreview';
import { toTemSanXuat, toTemGiaCongVe } from '../utils/printTemLabel';

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DANH SÁCH TEM ĐÃ IN — view DÙNG CHUNG cho 2 trang (nhiệm vụ #8, phiên 04-05/09/2026):
//   · *Sản xuất › Danh sách tem in*        → tem sản xuất (nhãn 15/16), quyền PROD_RUN/PROD_MONITOR
//   · *Kế hoạch › Danh sách tem gia công*  → tem 13 "TH VỀ",            quyền RELEASE1/RELEASE2
// Mục đích: XEM thông tin tem mà KHÔNG phải in ra giấy.
//
// ⚠ 2 trang chỉ khác NGUỒN (route + quyền) và vài cột ⇒ viết 1 lần ở đây, đừng chép ra 2 bản: sửa
//   bộ lọc/cột một bên rồi quên bên kia là 2 màn lệch nhau (đúng họ lỗi đã ghi ở §8 CLAUDE.md).
// ⚠ `laGiaCong` KHÔNG gửi lên server — nó do ROUTE quyết định (mỗi module 1 route + 1 quyền riêng),
//   ở đây chỉ dùng để chọn BỘ CỘT. Xem `production.service.listTemDaIn`.
// ══════════════════════════════════════════════════════════════════════════════════════════════

const LIMIT = 20;

// Ô lọc dạng CHỮ — khớp đúng tên khóa backend nhận (`production.controller.dsTemDaIn`).
// ⚠ Lọc chạy Ở SERVER (danh sách tem rất lớn, phân trang server) ⇒ đừng đổi sang `filterRows`
//   client-side: nó chỉ lọc được TRANG ĐANG XEM.
const FIELDS_CHUNG = [
  { key: 'maTem', label: 'Mã tem' },
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'codePhan', label: 'Code phần' },
];
const FIELD_CHUYEN = { key: 'chuyen', label: 'Chuyền' };

// Trạng thái tem: IN → DANG_PHOI → DA_KHO → CHO_SUA/CHO_OQC/LOAI → OQC_DAT → DA_GIAO; HUY.
const TT = {
  IN: ['Đã in', 'default'],
  DANG_PHOI: ['Đang phơi', 'info'],
  DA_KHO: ['Đã khô', 'info'],
  CHO_SUA: ['Chờ sửa', 'warning'],
  CHO_OQC: ['Chờ OQC', 'warning'],
  LOAI: ['Loại', 'danger'],
  OQC_DAT: ['OQC đạt', 'success'],
  DA_GIAO: ['Đã giao', 'success'],
  HUY: ['Đã hủy', 'danger'],
};
const ttBadge = (v) => {
  const [ten, tone] = TT[v] || [v || '—', 'default'];
  return <Badge tone={tone}>{ten}</Badge>;
};

const chu = (v) => (v == null || v === '' ? '—' : v);

// ⚠⚠ MÃ TEM HIỆN THEO ĐÚNG NHÃN NGƯỜI DÙNG ĐANG CẦM, không phải mã thô trong DB (cùng luật đã áp ở
// trang *Phân loại lỗi* — ở đó hiện tiền tố `16` vì người phân loại cầm nhãn túi sửa).
//   · tem GIA CÔNG: từ 06/09/2026 mã `13…` do ERP cấp riêng (`/barcode-tem-13`) và lưu THẲNG vào DB
//     ⇒ `temCode(ma,13)` thành no-op, hiện đúng mã. Tem CŨ lưu mã gốc `15…` mà nhãn "TH VỀ" in ra
//     `13…` ⇒ vẫn phải ghép tiền tố, nếu không người soi nhãn `13` thấy bảng hiện `15` sẽ tưởng mất
//     tem (SidePanel hiện thêm dòng "Mã gốc (DB)" đúng cho nhóm cũ này).
//   · tem SẢN XUẤT: nhãn TRÁI (phiếu giao hàng) đã đúng `15…` = mã gốc ⇒ hiện thẳng. Nhãn PHẢI là
//     `16…`; gõ mã đó vào ô lọc vẫn ra vì backend `timTem()` bỏ 2 số đầu rồi mới khớp.
const maHienThi = (r, laGiaCong) => (laGiaCong ? temCode(r.ma_tem, 13) : r.ma_tem);
// 2 dòng trong 1 ô (khuôn chung của các màn tem/lệnh: gộp Khách·Đơn, Màu·Kích).
const HaiDong = ({ tren, duoi }) => (
  <div className="min-w-0">
    <div className="truncate font-medium text-ink">{chu(tren)}</div>
    <div className="truncate text-xs text-ink-soft">{chu(duoi)}</div>
  </div>
);

// Một ô thông tin trong SidePanel.
const O = ({ nhan, children }) => (
  <div className="min-w-0">
    <div className="text-xs text-ink-soft">{nhan}</div>
    <div className="truncate text-sm font-medium text-ink">{children}</div>
  </div>
);

// ─── DỮ LIỆU NHÃN CHO KHUNG XEM TRƯỚC ─────────────────────────────────────────
// Nguồn TỐT NHẤT là `GET /production/tem/:id/label` (`layNhan`) — CHÍNH nguồn mà nút In dùng. Trang
// gia công không gọi được route đó (quyền `PROD_RUN`), nên lùi về dựng từ chính hàng của bảng.
// ⚠ Hàng của bảng đã mang gần đủ trường nhãn (khách/đơn/mã hàng/màu/kích/SLĐH/chuyền/SL in) — chỗ
//   thiếu là mấy trường chỉ có lúc IN THẬT (giờ phơi, phân công, và 5 trường nhóm "Gia công" ghép ở
//   `GiaCongPage.buildVeLabel`). Khung xem trước để trống chúng, KHÔNG bịa số.
const nhanTuHang = (t) => ({
  ma_tem: t.ma_tem,
  so_luong: t.so_luong,
  created_date: t.created_date,
  ma_lenh_san_xuat: t.ma_lenh_san_xuat,
  ten_khach_hang: t.ten_khach_hang,
  ma_don_hang: t.ma_don_hang,
  ma_hang: t.ma_hang,
  ma_phan: t.ma_phan,
  mau_vai: t.mau_vai,
  kich_vai: t.kich_vai,
  kich_phim: t.kich_phim,
  so_luong_don_hang: t.so_luong_don_hang,
  ma_chuyen: t.ma_chuyen,
  ten_chuyen: t.ten_chuyen,
  nha_gia_cong: t.nha_gia_cong,
  gc_mau_vai: t.gc_mau_vai,
  ma_ngay_ca: t.ma_ngay_ca,
  gio_sx_bd: t.gio_sx_bd,
  gio_sx_kt: t.gio_sx_kt,
  nguoi_in: t.nguoi_in,
  trang_thai: t.trang_thai,
  // Tem 13 dựng từ dữ liệu LỆNH lúc nhận hàng về; ở đây chỉ suy được 2 mốc chắc chắn đúng.
  tg_nhan: t.created_date,
  nguoi_nhan: t.nguoi_in,
});

// Sổ cái số lượng của tem (§11.4 DATABASE.md) — 1 tem kiểm/giao NHIỀU LẦN TỪNG PHẦN nên các cột
// này mới là số thật, `trang_thai` chỉ là công đoạn kém tiến độ nhất.
const SO_CAI = [
  ['KCS đạt', 'sl_kcs_dat'], ['KCS chuyển sửa', 'sl_kcs_sua'], ['KCS hủy', 'sl_kcs_huy'],
  ['Sửa đạt', 'sl_sua_dat'], ['Sửa hủy', 'sl_sua_huy'],
  ['OQC đạt', 'sl_oqc_dat'], ['Đã giao', 'sl_da_giao'], ['Chênh lệch', 'sl_chenh_lech'],
];

export default function DanhSachTemView({
  title, subtitle, fetcher, laGiaCong = false, layNhan = null,
}) {
  const { toast, show } = useToast();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});   // mặc định KHÔNG lọc ngày (xem ghi chú ở DateRangePicker)
  const [showFilter, setShowFilter] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tem, setTem] = useState(null);         // hàng đang mở SidePanel
  const [dangXuat, setDangXuat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetcher({ search, page, limit: LIMIT, ...filters });
      setRows(res.data.items);
      setMeta(res.data.meta || { page: 1, totalPages: 1, total: res.data.items.length });
    } catch (e) { show(e.message || 'Lỗi tải danh sách tem', 'error'); }
    finally { setLoading(false); }
  }, [fetcher, search, page, filters, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // Đổi ô lọc / ô tìm → về trang 1 (đang ở trang 5 mà lọc còn 2 trang thì bảng ra rỗng).
  const setField = (k, v) => { setFilters((s) => ({ ...s, [k]: v })); setPage(1); };
  const setNgay = ({ from, to }) => {
    setFilters((s) => ({ ...s, ngayTu: from || '', ngayDen: to || '' })); setPage(1);
  };
  const clearFilters = () => { setFilters({}); setPage(1); };
  // Bỏ `ngayDen` khi đếm: khoảng ngày là MỘT bộ lọc, không phải hai.
  const filterCount = Object.entries(filters).filter(([k, v]) => v && k !== 'ngayDen').length;

  const fields = laGiaCong ? FIELDS_CHUNG : [...FIELDS_CHUNG, FIELD_CHUYEN];
  const textFilters = Object.fromEntries(fields.map((f) => [f.key, filters[f.key] || '']));

  // ⚠⚠ Phân trang Ở SERVER (20 dòng/trang) ⇒ tải hết mọi trang rồi mới xuất; lấy `rows` là chỉ ra
  //   ĐÚNG TRANG ĐANG XEM. Endpoint này đã nới trần `TRAN_TAI_HET` nên xin `LIMIT_TAI_LON` là đủ 1 lượt.
  // ⚠ Bộ cột bám đúng bảng của từng trang: tem gia công không có ngày ca / giờ SX (không ai đứng
  //   chuyền in nó) nên thay bằng cột "Giờ nhận về" + nhà gia công ở phần chung.
  const doExcel = async () => {
    setDangXuat(true);
    try {
      const { items, thieu, total } = await taiHetTrang(
        (p) => fetcher({ search, ...filters, ...p }), { limit: LIMIT_TAI_LON }
      );
      if (thieu) show(`Chỉ tải được ${items.length}/${total} tem — hãy thu hẹp bằng bộ lọc`, 'error');
      await exportCheckpointExcel({
        cols: [
          ...cotTemChung((r) => maHienThi(r, laGiaCong)),
          { header: 'Trạng thái', width: 14, value: (r) => (TT[r.trang_thai] || [r.trang_thai || ''])[0] },
          { header: laGiaCong ? 'Giờ nhận về' : 'Giờ in tem', width: 18, center: true,
            value: (r) => (r.created_date ? new Date(r.created_date).toLocaleString('vi-VN') : '') },
          ...(laGiaCong ? [] : [
            { header: 'Ngày ca', width: 14, value: (r) => (r.ma_ngay_ca == null ? '' : String(r.ma_ngay_ca)) },
            { header: 'Giờ SX', width: 16, center: true,
              value: (r) => [r.gio_sx_bd, r.gio_sx_kt].filter(Boolean).join(' → ') },
          ]),
          { header: 'SL in', width: 12, num: true, value: (r) => (r.so_luong == null ? null : Number(r.so_luong)) },
        ],
        rows: items,
        title,
        fileName: laGiaCong ? 'danh-sach-tem-gia-cong' : 'danh-sach-tem-in',
        moTaLoc: moTaBoLoc({
          'tìm kiếm': search,
          [laGiaCong ? 'ngày nhận về' : 'ngày in tem']: [filters.ngayTu, filters.ngayDen].filter(Boolean).join(' → '),
          ...Object.fromEntries(fields.map((f) => [f.label.toLowerCase(), filters[f.key] || ''])),
        }),
      });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setDangXuat(false);
    }
  };

  const cols = [
    { key: 'ma_tem', header: 'Mã tem', render: (r) => <span className="font-medium text-ink">{chu(maHienThi(r, laGiaCong))}</span> },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) => ttBadge(r.trang_thai) },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', headerClassName: 'text-right', render: (r) => fmtNum(r.so_luong) },
    { key: 'created_date', header: laGiaCong ? 'Giờ nhận về' : 'Giờ in tem', render: (r) => <span className="whitespace-nowrap text-ink-soft">{fmtDateTime(r.created_date)}</span> },
    ...(laGiaCong
      // Tem 13 do `confirmGiaCongToOqc` tạo lúc Kế hoạch nhận hàng về ⇒ KHÔNG có ngày ca / giờ SX
      // (không ai đứng chuyền in nó) — hiện nhà gia công thay vào chỗ đó.
      ? [{ key: 'nha_gia_cong', header: 'Nhà gia công', render: (r) => chu(r.nha_gia_cong) }]
      : [
        { key: 'ma_ngay_ca', header: 'Ngày ca / Giờ SX', render: (r) => <HaiDong tren={r.ma_ngay_ca} duoi={r.gio_sx_bd || r.gio_sx_kt ? `${chu(r.gio_sx_bd)} → ${chu(r.gio_sx_kt)}` : null} /> },
        { key: 'ma_chuyen', header: 'Chuyền', render: (r) => <HaiDong tren={r.ten_chuyen} duoi={r.ma_chuyen} /> },
      ]),
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', render: (r) => chu(r.ma_lenh_san_xuat) },
    { key: 'ten_khach_hang', header: 'Khách · Đơn', render: (r) => <HaiDong tren={r.ten_khach_hang} duoi={r.ma_don_hang} /> },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => chu(r.ma_hang) },
    { key: 'ma_phan', header: 'Code phần', render: (r) => chu(r.ma_phan) },
    { key: 'mau_vai', header: 'Màu · Kích (vải/phim)', render: (r) => <HaiDong tren={r.mau_vai} duoi={`${chu(r.kich_vai)} / ${chu(r.kich_phim)}`} /> },
  ];

  return (
    <div>
      <Toolbar title={title} subtitle={subtitle} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Tìm mã tem / mã đợt SX / code phần..." className="max-w-xs" />
        {/* Ngày IN TEM (`tem.created_date`, giờ VN). Mặc định KHÔNG lọc — đây là màn TRA CỨU, lọc sẵn
            hôm nay sẽ giấu tem của ngày khác mà người dùng không biết vì sao. */}
        <DateRangePicker value={{ from: filters.ngayTu || '', to: filters.ngayDen || '' }}
          onChange={setNgay} placeholder={laGiaCong ? 'Ngày nhận về' : 'Ngày in tem'} />
        <FilterToggle open={showFilter} count={filterCount} onClick={() => setShowFilter((v) => !v)} />
        <Button chiXemOk variant="secondary" icon="download" onClick={doExcel}
          loading={dangXuat} disabled={!meta.total}>Excel ({fmtNum(meta.total)})</Button>
        <Badge tone="info">{fmtNum(meta.total)} tem</Badge>
      </div>

      <FieldFilters fields={fields} values={textFilters} onField={setField}
        onClear={clearFilters} open={showFilter} />

      <DataTable
        columns={cols}
        rows={rows}
        loading={loading}
        onRowClick={setTem}
        sttStart={(meta.page - 1) * LIMIT}
        pageSize={0}
        emptyText={filterCount || search ? 'Không có tem khớp bộ lọc' : 'Chưa có tem'}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <TemPanel tem={tem} onClose={() => setTem(null)} laGiaCong={laGiaCong} layNhan={layNhan} />
      <Toast toast={toast} />
    </div>
  );
}

// ─── SidePanel: thông tin 1 tem ────────────────────────────────────────────────────────────────
// Phần lớn dữ liệu ĐÃ CÓ SẴN trong hàng (backend trả đủ) ⇒ mở panel là thấy ngay, không chờ API.
// Riêng khối "phân công + giờ phơi" phải gọi `GET /production/tem/:temId/label` — đó là NGUỒN DUY
// NHẤT của dữ liệu nhãn (⚠ KHÔNG dựng lại ở FE, xem kế hoạch #8).
// ⚠⚠ Route đó gác `PROD_RUN`/`PROD_MONITOR` ⇒ trang GIA CÔNG (quyền RELEASE1/RELEASE2) gọi vào sẽ
//    403 ⇒ chỉ trang Sản xuất truyền `layNhan`. Ngoài ra tem 13 vốn được in từ dữ liệu LỆNH
//    (`printGiaCongVeTem`), không phải từ bản ghi tem, nên khối này cũng không đúng nguồn cho nó.
function TemPanel({ tem, onClose, laGiaCong, layNhan }) {
  const [nhan, setNhan] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const temId = tem?.id;

  // ⚠⚠ `dungTo` phải ỔN ĐỊNH giữa các lần render (nó nằm trong deps `useEffect` của `TemInPreview`):
  //   hàm mới mỗi render ⇒ dựng lại tem liên tục, mỗi lần đều gọi `mauChoViTri` + sinh QR (bẫy deps
  //   đã ghi ở CLAUDE.md §9).
  // ⚠ Chờ `layNhan` xong mới dựng (`dangTai`) — dựng bằng hàng rồi lại dựng bằng nhãn là nháy 2 lần.
  const dungTo = useCallback(async () => {
    if (!tem) return null;
    const label = (!laGiaCong && nhan) ? { ...nhanTuHang(tem), ...nhan } : nhanTuHang(tem);
    return laGiaCong ? toTemGiaCongVe(label) : toTemSanXuat(label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temId, laGiaCong, nhan]);

  useEffect(() => {
    if (!temId || !layNhan) { setNhan(null); return; }
    let huy = false;
    setDangTai(true); setNhan(null);
    layNhan(temId)
      .then((res) => { if (!huy) setNhan(res.data); })
      // Nuốt lỗi: đây là khối THÔNG TIN THÊM, hỏng nó không được chặn việc xem tem.
      .catch(() => { if (!huy) setNhan(null); })
      .finally(() => { if (!huy) setDangTai(false); });
    return () => { huy = true; };
  }, [temId, layNhan]);

  if (!tem) return null;
  const t = tem;

  return (
    <SidePanel open={!!tem} onClose={onClose} title={`Tem ${maHienThi(t, laGiaCong) || ''}`}
      subtitle={`${t.ma_lenh_san_xuat || '—'} · SL in ${fmtNum(t.so_luong)}`} width="max-w-2xl">
      <div className="space-y-4">
        {/* ═══ TỜ TEM ĐÚNG NHƯ LÚC IN ═══════════════════════════════════════════════════════════
            Dựng bằng CHÍNH đường in (`toTemSanXuat`/`toTemGiaCongVe`): đã gắn mẫu ở *Hệ thống →
            Thiết kế tem* thì ra mẫu, chưa gắn thì ra bố cục mặc định — y hệt tờ giấy sẽ in ra.
            ⚠ Chờ `layNhan` xong mới dựng (trang Sản xuất) để nhãn có đủ giờ phơi + phân công. */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Tem như lúc in</h4>
          {dangTai ? (
            <div className="flex items-center gap-2 py-4 text-sm text-ink-soft">
              <Spinner size={18} /><span>Đang tải dữ liệu nhãn...</span>
            </div>
          ) : (
            <TemInPreview dungTo={dungTo} tieuDe={maHienThi(t, laGiaCong) || 'Tem'} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3">
          <O nhan="Mã tem">{chu(maHienThi(t, laGiaCong))}</O>
          {/* Mã GỐC trong DB — hiện khi khác mã trên nhãn, để đối chiếu khi tra cứu/hỗ trợ. */}
          {laGiaCong && t.ma_tem !== maHienThi(t, laGiaCong) && <O nhan="Mã gốc (DB)">{chu(t.ma_tem)}</O>}
          <div><div className="text-xs text-ink-soft">Trạng thái</div><div className="mt-1">{ttBadge(t.trang_thai)}</div></div>
          <O nhan="Số lượng in">{fmtNum(t.so_luong)}</O>
          <O nhan={laGiaCong ? 'Giờ nhận về' : 'Giờ in tem'}>{fmtDateTime(t.created_date)}</O>
          <O nhan="Mã đợt SX">{chu(t.ma_lenh_san_xuat)}</O>
          <O nhan="Chuyền">{t.ten_chuyen ? `${t.ten_chuyen}${t.ma_chuyen ? ` (${t.ma_chuyen})` : ''}` : '—'}</O>
          <O nhan="Số lần in">{fmtNum(t.so_lan_in)}</O>
          <O nhan="Người in">{chu(t.nguoi_in)}</O>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Phần in</h4>
          <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3">
            <O nhan="Khách hàng">{chu(t.ten_khach_hang)}</O>
            <O nhan="Đơn hàng">{chu(t.ma_don_hang)}</O>
            <O nhan="Mã hàng">{chu(t.ma_hang)}</O>
            <O nhan="Code phần">{chu(t.ma_phan)}</O>
            <O nhan="Màu vải">{chu(t.mau_vai)}</O>
            <O nhan="Kích vải / phim">{`${chu(t.kich_vai)} / ${chu(t.kich_phim)}`}</O>
            <O nhan="Tính chất in">{chu(t.tinh_chat_in)}</O>
            <O nhan="SL đơn hàng">{fmtNum(t.so_luong_don_hang)}</O>
            <O nhan="Nhà gia công">{chu(t.nha_gia_cong)}</O>
            <O nhan="Hạn giao">{t.han_giao_hang ? new Date(t.han_giao_hang).toLocaleDateString('vi-VN') : '—'}</O>
          </div>
        </div>

        {/* Ngày ca / giờ SX / BTP / GC màu vải — nhập theo LƯỢT IN, lưu vào từng tem (mig 066/068).
            Tem gia công không có các trường này nên bỏ hẳn khối. */}
        {!laGiaCong && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-ink">Lượt in</h4>
            <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3">
              <O nhan="Mã ngày ca">{chu(t.ma_ngay_ca)}</O>
              <O nhan="Giờ sản xuất">{t.gio_sx_bd || t.gio_sx_kt ? `${chu(t.gio_sx_bd)} → ${chu(t.gio_sx_kt)}` : '—'}</O>
              <O nhan="GC màu vải">{chu(t.gc_mau_vai)}</O>
              <div>
                <div className="text-xs text-ink-soft">BTP</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.btp_truoc && <Badge tone="info">BTP trước</Badge>}
                  {t.btp_cuoi && <Badge tone="info">BTP cuối</Badge>}
                  {!t.btp_truoc && !t.btp_cuoi && <span className="text-sm text-ink-soft">—</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Sổ cái số lượng</h4>
          {/* 1 tem kiểm/giao NHIỀU LẦN TỪNG PHẦN ⇒ đây mới là số thật (DATABASE.md §11.4). */}
          <div className="grid grid-cols-4 gap-3 rounded-control border border-line p-3">
            {SO_CAI.map(([nhan, k]) => (
              <O key={k} nhan={nhan}>{fmtNum(t[k])}</O>
            ))}
          </div>
        </div>

        {/* Chỉ trang Sản xuất — xem ghi chú ở đầu component. */}
        {layNhan && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-ink">Phân công &amp; phơi khô</h4>
            {dangTai ? (
              <div className="flex items-center gap-2 py-4 text-sm text-ink-soft">
                <Spinner size={18} /><span>Đang tải dữ liệu nhãn...</span>
              </div>
            ) : !nhan ? (
              <div className="text-sm text-ink-soft">Không lấy được dữ liệu nhãn tem.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3">
                <O nhan="Ca trưởng">{chu(nhan.ca_truong)}</O>
                <O nhan="Chuyền trưởng">{chu(nhan.chuyen_truong)}</O>
                <O nhan="Thợ in">{chu(nhan.tho_in)}</O>
                <O nhan="Bắt đầu in (phiếu)">{fmtDateTime(nhan.tg_bd_in)}</O>
                <O nhan="Bắt đầu phơi">{fmtDateTime(nhan.tg_bd_phoi)}</O>
                <O nhan="Kết thúc phơi">{fmtDateTime(nhan.tg_kt_phoi)}</O>
              </div>
            )}
          </div>
        )}
      </div>
    </SidePanel>
  );
}
