import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Spinner from '../../../components/common/Spinner';
import ChipTabs from '../../../components/common/ChipTabs';
import DateRangePicker from '../../../components/common/DateRangePicker';
import { filterRows } from '../../../components/common/FieldFilters';
import { Field, Input } from '../../../components/common/controls';
import PhuongAnInBadge from '../../../components/common/PhuongAnInBadge';
import exportPanelExcel from '../../../components/common/exportPanelExcel';
import { fmtNum, fmtDate } from '../../../utils/format';
import { khopNhieu } from '../../../utils/timKiem';
import { keHoachTamTheoDoi } from '../../../services/planningService';

// ─────────────────────────────────────────────────────────────────────────────
// "DANH SÁCH KẾ HOẠCH TẠM" — bản anh em của *Danh sách release*, cho màn Kế hoạch tạm.
// Liệt kê MỌI đợt vải TỪNG đi qua kế hoạch tạm + đánh dấu cái nào **đã Release 1 THẬT SỰ**, cái nào
// **chưa release vì chưa Ready**. Trả lời: "tôi lập kế hoạch N đợt, giờ bao nhiêu đã thực sự chạy".
//
// ⚠⚠⚠ KHÔNG lấy từ danh sách đang hiện trên màn: dòng `ke_hoach_tam` BỊ XÓA ngay khi xác nhận
//   Release 1 ⇒ đo prod 21/08 màn chỉ có 126 dòng và **0 dòng nào đã release**, trong khi thực tế
//   đã có **866** đợt đi qua kế hoạch tạm rồi release. Nguồn "từng đi qua" nằm ở `audit_log` —
//   xem `planning.repository.keHoachTamTheoDoi`.
// ⚠ Bảng này CỐ Ý không có cột SL đã in / đã giao như *Danh sách release*: phần lớn dòng ở đây chưa
//   release nên 2 cột đó sẽ rỗng gần hết, chỉ tổ làm bảng rộng thêm.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ Khóa khớp `tinh_trang` backend trả về (`KHT_TD_TINH_TRANG`). Thêm trạng thái mới thì khai ở đây.
const TT = {
  DA_RELEASE: { nhan: 'Đã Release 1', tone: 'success', mo_ta: 'Đã xác nhận và tạo lệnh sản xuất' },
  CHO_READY: { nhan: 'Chưa Ready', tone: 'warning', mo_ta: 'Còn nằm ở kế hoạch tạm, phần in chưa QC xác nhận READY' },
  SAN_SANG: { nhan: 'Đã Ready — chờ bấm', tone: 'info', mo_ta: 'Phần in đã Ready, chỉ còn bấm "Xác nhận Release 1"' },
  DA_XOA: { nhan: 'Đã bỏ kế hoạch', tone: 'default', mo_ta: 'Không còn ở kế hoạch tạm và cũng không có lệnh nào' },
};
const CHIP_TT = ['DA_RELEASE', 'SAN_SANG', 'CHO_READY', 'DA_XOA'];

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' },
  { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
  { key: 'chuyen', label: 'Chuyền dự kiến', col: 'ten_chuyen' },
  { key: 'maLenh', label: 'Mã đợt SX', col: 'ma_lenh_san_xuat' },
];
const oTim = (r) => [r.ma_phan, r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.mau_vai,
  r.ma_dot_vai, r.ma_lenh_san_xuat, r.ten_chuyen];

// Cột bảng — `so` = căn phải. `render` để trống thì in thẳng giá trị.
const COT = [
  { key: 'tinh_trang', ten: 'Tình trạng', render: (r) => <BadgeTT ma={r.tinh_trang} /> },
  { key: 'ten_khach_hang', ten: 'Khách hàng' },
  { key: 'ma_don_hang', ten: 'Đơn hàng' },
  { key: 'ma_hang', ten: 'Mã hàng' },
  { key: 'ma_phan', ten: 'Code phần' },
  { key: 'mau_vai', ten: 'Màu vải' },
  { key: 'kich_vai', ten: 'Kích vải' },
  { key: 'kich_phim', ten: 'Kích phim' },
  { key: 'loai_dot_vai', ten: 'Loại đợt vải' },
  { key: 'phuong_an_in', ten: 'Phương án in', render: (r) => <PhuongAnInBadge value={r.phuong_an_in} /> },
  { key: 'so_luong_don_hang', ten: 'SLĐH', so: true },
  { key: 'so_luong_vai_ve', ten: 'SLNV', so: true },
  { key: 'so_luong_ke_hoach', ten: 'SL kế hoạch', so: true },
  { key: 'so_luong_release', ten: 'SL đã release', so: true },
  { key: 'ten_chuyen', ten: 'Chuyền dự kiến' },
  { key: 'ngay_ke_hoach', ten: 'Ngày KH SX', ngay: true },
  { key: 'han_giao_hang', ten: 'Hạn giao', ngay: true },
  { key: 'tg_lap_ke_hoach', ten: 'Lập KH tạm', ngay: true },
  { key: 'ma_lenh_san_xuat', ten: 'Mã đợt SX' },
  { key: 'nguoi_lap', ten: 'Người lập' },
];

const homNay = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function BadgeTT({ ma }) {
  const t = TT[ma] || { nhan: ma, tone: 'default', mo_ta: '' };
  return <Badge tone={t.tone} className="whitespace-nowrap" title={t.mo_ta}>{t.nhan}</Badge>;
}

// ⚠⚠ 2 CHẾ ĐỘ NGÀY (21/08/2026, bám *Danh sách release*) — 2 mốc này LỆCH NHAU RẤT XA vì kế hoạch
//   tạm vốn để lập SỚM: lập hôm nay nhưng ngày chạy có thể vài ngày sau. Nói rõ trong nhãn để người
//   dùng không tưởng hệ thống lọc sai khi đổi chế độ mà số nhảy hẳn.
const LOAI_NGAY = [
  { v: 'NGAY_KE_HOACH', nhan: 'Ngày KH sản xuất', mo_ta: 'Ngày hàng dự kiến lên chuyền' },
  { v: 'NGAY_LAP', nhan: 'Ngày lập KH tạm', mo_ta: 'Ngày bấm lưu kế hoạch tạm ("release tạm")' },
];

export default function KeHoachTamListModal({ open, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loi, setLoi] = useState('');
  const [loaiNgay, setLoaiNgay] = useState('NGAY_KE_HOACH');
  // ⚠ Mặc định = HÔM NAY (người dùng chốt), cắt theo giờ LOCAL — `toISOString()` sẽ lùi 1 ngày ở
  //   giờ VN (UTC+7) trước 07:00 sáng và modal mở ra trống trơn.
  const [ngay, setNgay] = useState(() => { const d = homNay(); return { from: d, to: d }; });
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('');
  const [filters, setFilters] = useState({});
  const [moLoc, setMoLoc] = useState(false);
  const [xuat, setXuat] = useState(false);

  const tai = useCallback(async () => {
    setLoading(true); setLoi('');
    try {
      const r = await keHoachTamTheoDoi({ tuNgay: ngay.from || '', denNgay: ngay.to || '', loaiNgay });
      setRows(r.data.items || []);
    } catch (e) {
      setLoi(e.message || 'Không tải được danh sách'); setRows([]);
    } finally { setLoading(false); }
  }, [ngay.from, ngay.to, loaiNgay]);

  useEffect(() => { if (open) tai(); }, [open, tai]);

  // Ô tìm + panel lọc AND với nhau; chip tình trạng là chiều lọc thứ 3.
  const daLoc = useMemo(
    () => filterRows(rows, filters, FILTER_FIELDS).filter((r) => khopNhieu(oTim(r), q)),
    [rows, filters, q]
  );
  const viewRows = useMemo(
    () => (chip ? daLoc.filter((r) => r.tinh_trang === chip) : daLoc),
    [daLoc, chip]
  );
  // ⚠ Số trên chip đếm trên tập ĐÃ qua ô tìm + bộ lọc (chip chỉ là 1 chiều lọc khác) — nếu đếm trên
  //   `rows` thô thì bấm chip xong số không khớp bảng.
  const counts = useMemo(() => {
    const m = { '': daLoc.length };
    CHIP_TT.forEach((k) => { m[k] = 0; });
    daLoc.forEach((r) => { m[r.tinh_trang] = (m[r.tinh_trang] || 0) + 1; });
    return m;
  }, [daLoc]);

  const tabs = useMemo(() => [{ v: '', label: 'Tất cả' },
    ...CHIP_TT.filter((k) => counts[k] > 0 || k === 'DA_RELEASE' || k === 'CHO_READY')
      .map((k) => ({ v: k, label: TT[k].nhan }))], [counts]);

  const soLoc = FILTER_FIELDS.filter((f) => (filters[f.key] || '').trim()).length;
  const daRelease = counts.DA_RELEASE || 0;
  const nhanNgay = (LOAI_NGAY.find((x) => x.v === loaiNgay) || LOAI_NGAY[0]).nhan;

  const doXuat = async () => {
    setXuat(true);
    try {
      await exportPanelExcel({
        cols: COT.map((c) => ({
          header: c.ten,
          num: !!c.so,
          type: c.ngay ? 'date' : undefined,
          width: c.ngay ? 14 : 18,
          value: (r) => (c.key === 'tinh_trang' ? (TT[r.tinh_trang] || {}).nhan || r.tinh_trang
            : c.key === 'phuong_an_in' ? r.phuong_an_in
              : r[c.key]),
          ok: c.key === 'tinh_trang' ? (r) => r.tinh_trang === 'DA_RELEASE' : undefined,
          red: c.key === 'tinh_trang' ? (r) => r.tinh_trang === 'CHO_READY' : undefined,
        })),
        rows: viewRows,
        title: 'DANH SÁCH KẾ HOẠCH TẠM',
        subtitle: `${viewRows.length} dòng · Đã Release 1: ${daRelease}`
          + `${ngay.from || ngay.to ? ` · ${nhanNgay} ${ngay.from || '…'} → ${ngay.to || '…'}` : ' · mọi ngày'}`
          + `${q.trim() ? ` · tìm "${q.trim()}"` : ''}`,
        fileName: 'danh-sach-ke-hoach-tam',
      });
    } catch (e) { setLoi(e.message || 'Xuất Excel thất bại'); } finally { setXuat(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      lapDay
      title="Danh sách kế hoạch tạm"
      footer={<Button variant="ghost" onClick={onClose}>Đóng</Button>}
    >
      <div className="flex h-full flex-col">
        <div className="relative shrink-0 space-y-2 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* ⚠ Để TRỐNG = mọi ngày (đo prod chỉ ~992 dòng, tải ~650ms) — mặc định lọc sẵn một ngày
                thì người dùng mở ra thấy trống rồi tưởng mất dữ liệu. */}
            <DateRangePicker value={ngay} onChange={setNgay} />
            {/* Toggle 2 chế độ ngày — giống nút chuyển ở *Danh sách release*. */}
            <div className="flex overflow-hidden rounded-full border border-line">
              {LOAI_NGAY.map((x) => (
                <button
                  key={x.v}
                  type="button"
                  title={x.mo_ta}
                  onClick={() => setLoaiNgay(x.v)}
                  className={`px-3 py-1 text-xs font-medium transition ${
                    loaiNgay === x.v ? 'bg-primary text-white' : 'bg-surface text-ink-soft hover:text-ink'}`}
                >
                  {x.nhan}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => { const d = homNay(); setNgay({ from: d, to: d }); }}>
              Hôm nay
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" icon="filter" onClick={() => setMoLoc((v) => !v)}>
                Bộ lọc{soLoc ? ` (${soLoc})` : ''}
              </Button>
              <Button variant="secondary" icon="download" loading={xuat} onClick={doXuat} disabled={!viewRows.length}>
                Excel
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[16rem] flex-1">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm: code phần, khách, đơn, mã hàng, màu vải, mã đợt vải, mã đợt SX, chuyền..."
                className="h-10 w-full rounded-control border border-line pl-9 pr-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 md:text-sm"
              />
            </div>
            {(q || soLoc > 0 || chip) && (
              <Button variant="ghost" onClick={() => { setQ(''); setFilters({}); setChip(''); }}>Xóa lọc</Button>
            )}
          </div>

          <div className="text-xs text-ink-soft">
            <b className="text-ink">{fmtNum(viewRows.length)}</b> đợt vải
            {' · '}đã Release 1 thật sự: <b className="text-emerald-600">{fmtNum(daRelease)}</b>
            {' · '}chưa release vì chưa Ready: <b className="text-amber-600">{fmtNum(counts.CHO_READY || 0)}</b>
            <span className="ml-2">
              · Đang lọc theo <b className="text-ink">{nhanNgay.toLowerCase()}</b>
              {ngay.from || ngay.to ? '' : ' (mọi ngày)'}
              {' '}· Gồm cả đợt ĐÃ rời khỏi màn Kế hoạch tạm (dòng kế hoạch bị xóa khi xác nhận Release 1).
            </span>
          </div>

          <ChipTabs tabs={tabs} value={chip} counts={counts} onChange={setChip} />

          {/* ⚠ Panel NỔI (absolute) — modal bật `lapDay` nên thân không cuộn; panel chiếm chỗ sẽ ép
              vùng bảng co về ~0 trên laptop màn thấp (bẫy đã ghi ở SiSoTram). */}
          {moLoc && (
            <div className="absolute right-0 top-full z-30 grid w-full max-w-3xl grid-cols-2 gap-2 rounded-control border border-line bg-surface p-3 shadow-card-hover md:grid-cols-3"
              style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {/* ⚠ Tự dựng ô nhập thay vì dùng `<FieldFilters>`: component đó tự bọc `card` + tự vẽ
                  dải chip "đang lọc", nhét vào hộp nổi sẽ lồng card trong card. `filterRows` vẫn
                  dùng chung nên LUẬT LỌC không lệch với các trang khác. */}
              {FILTER_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Input value={filters[f.key] || ''}
                    onChange={(e) => setFilters((m) => ({ ...m, [f.key]: e.target.value }))} />
                </Field>
              ))}
              <div className="col-span-2 flex items-end md:col-span-3">
                <Button variant="ghost" onClick={() => setFilters({})}>Xóa lọc trong panel</Button>
              </div>
            </div>
          )}
        </div>

        <div className="min-h-[10rem] flex-1 overflow-auto rounded-control border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted">
              <tr>
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-ink-soft">STT</th>
                {COT.map((c) => (
                  <th key={c.key} className={`whitespace-nowrap px-2 py-2 text-xs font-semibold text-ink-soft ${c.so ? 'text-right' : 'text-left'}`}>
                    {c.ten}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={COT.length + 1} className="py-10 text-center"><Spinner size={22} /></td></tr>
              )}
              {!loading && loi && (
                <tr><td colSpan={COT.length + 1} className="py-10 text-center text-sm text-danger">{loi}</td></tr>
              )}
              {!loading && !loi && !viewRows.length && (
                <tr><td colSpan={COT.length + 1} className="py-10 text-center text-sm text-ink-soft">Không có dữ liệu</td></tr>
              )}
              {!loading && viewRows.map((r, i) => (
                <tr key={`${r.dot_vai_ve_id}-${r.ma_lenh_san_xuat || ''}`} className="border-t border-line/70 align-top hover:bg-surface-muted/40">
                  <td className="px-2 py-1.5 text-xs text-ink-soft">{i + 1}</td>
                  {COT.map((c) => (
                    <td key={c.key} className={`px-2 py-1.5 ${c.so ? 'whitespace-nowrap text-right' : ''}`}>
                      {oCell(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function oCell(r, c) {
  if (c.render) return c.render(r);
  const v = r[c.key];
  if (v === null || v === undefined || v === '') return <span className="text-ink-soft">—</span>;
  if (c.ngay) return <span className="whitespace-nowrap text-xs">{fmtDate(v)}</span>;
  if (c.so) return fmtNum(v);
  // ⚠ Không `truncate`: 2 mã hàng chỉ khác nhau ở ĐUÔI mà cắt đi thì nhìn y hệt nhau (bài học ở
  //   Danh sách release) — cho xuống dòng trong bề rộng giới hạn.
  return <div className="max-w-[12rem] whitespace-normal break-words">{String(v)}</div>;
}
