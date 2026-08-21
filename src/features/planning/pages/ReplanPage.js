import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Field, Input, Textarea } from '../../../components/common/controls';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import TimeSelect from '../../../components/common/TimeSelect';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import PhuongAnInBadge from '../../../components/common/PhuongAnInBadge';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import { codesCuaLenh, laGomSet } from '../utils/phanInLenh';
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';
import { listReplanCandidates, replan, getReplanDetail, replanBatch, listChuyen, planHistory, replanDone } from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

// Lọc nhiều trường (client-side, kết hợp AND) — trang tải-hết (limit 500) nên lọc đủ mọi dòng.
// `col` = tên thuộc tính trên hàng do `listReplanCandidates` trả về.
const FILTER_FIELDS = [
  { key: 'maLenh', label: 'Mã đợt SX', col: 'ma_lenh_san_xuat' },
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' },
  { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' },
  { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
  { key: 'chuyen', label: 'Chuyền hiện tại', col: 'ten_chuyen' },
  { key: 'nhaGiaCong', label: 'Nhà gia công', col: 'nha_gia_cong' },
];

// Ngày (Date/ISO) → 'YYYY-MM-DD' theo giờ địa phương cho input[type=date] (tránh lệch ngày do slice ISO/UTC).
const dateStr = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Giờ trong ngày ('HH:MM') của `tg_bd_kh`/`tg_kt_kh` đã lưu → đổ sẵn vào ô TimeSelect.
const gioStr = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Ghép ngày kế hoạch + giờ thành mốc gửi lên backend — GIỐNG HỆT màn Release 1.
// Thiếu ngày hoặc thiếu giờ ⇒ null: backend sẽ tự DỜI giờ cũ sang ngày mới, không mất giờ đã đặt.
const mkTs = (ngay, gio) => (ngay && gio ? `${ngay}T${gio}:00` : null);

export default function ReplanPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const { statusLenh } = useNghenMap();
  const canReplan = can('RELEASE2') || can('RELEASE1');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chuyen, setChuyen] = useState([]);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;
  const filtered = useMemo(() => filterRows(rows, filters, FILTER_FIELDS), [rows, filters]);

  const [detail, setDetail] = useState(null);
  // `dsDot` = đợt vải của lệnh đang mở + SL release đang giữ + trần được nâng (tải khi mở panel).
  const [dsDot, setDsDot] = useState([]);
  const [form, setForm] = useState({ chuyenId: '', ngayKeHoach: '', gioBd: '', gioKt: '', lyDo: '', slRelease: {} });
  const [saving, setSaving] = useState(false);
  // Tổng SL release đang nhập + cờ chặn Lưu. Ô để TRỐNG cũng tính là sai: SL release là số bắt buộc,
  // để trống rồi lưu thì người dùng tưởng đã xóa số mà thật ra backend giữ nguyên giá trị cũ.
  const tongSlMoi = useMemo(
    () => dsDot.reduce((a, d) => a + (Number(form.slRelease[d.dot_vai_id]) || 0), 0),
    [dsDot, form.slRelease]
  );
  const vuotSl = useMemo(() => dsDot.some((d) => {
    const v = form.slRelease[d.dot_vai_id];
    const n = Number(v);
    return v === '' || v === undefined || !Number.isInteger(n) || n <= 0 || n > d.toi_da;
  }), [dsDot, form.slRelease]);

  const [selected, setSelected] = useState(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({ chuyenId: '', ngayKeHoach: '', gioBd: '', gioKt: '', lyDo: '' });
  const [scanOpen, setScanOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // TẢI HẾT MỌI TRANG để lọc/quét ở client khớp đủ dòng; DataTable tự phân trang 20/trang.
      // ⚠ KHÔNG truyền `limit: 500` — `getPaging` cắt còn 200, mà prod đang có ~760 lệnh ở màn này
      //   ⇒ bộ lọc sẽ chỉ soi được 200 dòng đầu và im lặng bỏ sót phần còn lại.
      const { items, total, thieu } = await taiHetTrang((p) => listReplanCandidates({ search, ...p }), { limit: LIMIT_TAI_LON });
      setRows(items);
      setMeta({ page: 1, totalPages: 1, total });
      if (thieu && !silent) show(`Mới tải được ${items.length}/${total} lệnh — hãy thu hẹp tìm kiếm`, 'error');
      if (!silent) setSelected(new Set());
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, show]);

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Tự tải lại khi trạm khác xác nhận (tránh màn để lâu → dữ liệu cũ).
  // Bỏ qua khi đang tick dở để không mất lựa chọn — `load` xóa danh sách đã chọn.
  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua `setLoading(true)` (bảng không bị
  // thay bằng spinner) và KHÔNG xóa dòng đang tích. Nhiều sự kiện trong 400ms gộp thành 1 lần tải.
  useSocketReload(['workflow:updated'], () => load(true));

  // Đổ sẵn chuyền / ngày / GIỜ / SL RELEASE hiện tại của lệnh ⇒ không đụng gì thì giữ nguyên kế
  // hoạch cũ; sửa 1 thứ thì không phải nhập lại những thứ còn nguyên.
  // ⚠ SL release nằm ở mức (lệnh × ĐỢT VẢI) nên phải gọi thêm `GET /planning/replan/:id` — hàng trong
  //   bảng chỉ có tổng `so_luong_release`, không tách được theo đợt (198/1296 lệnh gộp nhiều đợt vải).
  // ⚠ Lỗi tải danh sách đợt vải bị NUỐT: đó là phần thêm, không được chặn việc dời ngày/chuyền.
  const openDetail = async (row) => {
    setDetail(row);
    setDsDot([]);
    setForm({
      chuyenId: row.chuyen_id || '',
      ngayKeHoach: dateStr(row.ngay_ke_hoach),
      gioBd: gioStr(row.tg_bd_kh),
      gioKt: gioStr(row.tg_kt_kh),
      lyDo: '',
      slRelease: {},
    });
    try {
      const r = await getReplanDetail(row.id);
      const ds = r.data.dot_vai || [];
      setDsDot(ds);
      setForm((f) => ({ ...f, slRelease: Object.fromEntries(ds.map((d) => [d.dot_vai_id, String(d.so_luong)])) }));
    } catch (e) { /* im lặng — vẫn dời được ngày/chuyền/giờ */ }
  };

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // "Chọn tất cả" theo tập ĐANG HIỆN (đã lọc) — tick xong mà lệnh ngoài bộ lọc cũng bị chọn thì
  // người dùng không kiểm soát được mình đang lập lại kế hoạch cho những lệnh nào.
  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(filtered.map((r) => r.id))));

  const openBatch = () => {
    setBatchForm({ chuyenId: '', ngayKeHoach: '', gioBd: '', gioKt: '', lyDo: '' });
    setBatchOpen(true);
  };

  const submitBatch = async () => {
    if (!batchForm.ngayKeHoach) { show('Chọn ngày sản xuất kế hoạch', 'error'); return; }
    setSaving(true);
    try {
      const res = await replanBatch({
        lenhIds: [...selected],
        chuyenId: batchForm.chuyenId || null,
        ngayKeHoach: batchForm.ngayKeHoach,
        tgBdKh: mkTs(batchForm.ngayKeHoach, batchForm.gioBd),
        tgKtKh: mkTs(batchForm.ngayKeHoach, batchForm.gioKt),
        lyDo: batchForm.lyDo.trim(),
      });
      const { okCount, failedCount } = res.data;
      show(failedCount ? `Đã lập lại ${okCount} lệnh, ${failedCount} lỗi` : `Đã lập lại kế hoạch ${okCount} lệnh`,
        failedCount ? 'error' : 'success');
      setBatchOpen(false);
      load();
    } catch (e) {
      show(e.message || 'Lập lại kế hoạch thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!form.ngayKeHoach) { show('Chọn ngày sản xuất kế hoạch', 'error'); return; }
    if (vuotSl) { show('Số lượng release không hợp lệ — kiểm tra lại các ô SL', 'error'); return; }
    setSaving(true);
    try {
      await replan(detail.id, {
        chuyenId: form.chuyenId || null,
        ngayKeHoach: form.ngayKeHoach,
        tgBdKh: mkTs(form.ngayKeHoach, form.gioBd),
        tgKtKh: mkTs(form.ngayKeHoach, form.gioKt),
        lyDo: form.lyDo.trim(),
        // Chỉ gửi ô THỰC SỰ ĐỔI — gửi cả bộ thì audit ghi "đổi SL" cho cả lần chỉ dời ngày.
        slRelease: Object.fromEntries(dsDot
          .filter((d) => String(form.slRelease[d.dot_vai_id] ?? '') !== String(d.so_luong))
          .map((d) => [d.dot_vai_id, form.slRelease[d.dot_vai_id]])),
      });
      show(`Đã lập lại kế hoạch cho ${detail.ma_lenh_san_xuat}`);
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Lập lại kế hoạch thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    ...(canReplan ? [{ key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)} aria-label="Chọn lệnh" />
      ) }] : []),
    // LỆNH GOM SET hiện GIỐNG MÀN RELEASE 1: mỗi phần in 1 DÒNG, các ô ở mức LỆNH hợp nhất bằng
    // `rowSpan` (prop `subRows` + cột `merge` của DataTable — cùng cơ chế màn Xác nhận chạy).
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', merge: true, render: (r) => (
      <div className="space-y-1">
        <Badge tone="info">{r.ma_lenh_san_xuat}</Badge>
        {laGomSet(r) && (
          <div className="text-xs text-primary">gom set · {r.so_phan_in} phần in · in chung</div>
        )}
      </div>
    ) },
    { key: 'giai_doan', header: 'Giai đoạn', merge: true, render: (r) => (
      r.trang_thai === 'RELEASE_1'
        ? <Badge tone="warning">Test Run</Badge>
        : <Badge tone="success">Release 2</Badge>
    ) },
    // ↓ Các cột THEO PHẦN IN — dòng con ghi đè giá trị nên mỗi phần in hiện đúng dữ liệu của nó.
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    // ↓ Từ đây là mức LỆNH → hợp nhất ô.
    // ⚠ `phuong_an_in`/`loai_dot_vai`/`SLNV`/`Hạn giao` lấy từ ĐỢT VẢI ĐẠI DIỆN (`PHAN_INFO_LATERAL`
    //   `LIMIT 1`) nên với lệnh gom set chỉ có MỘT giá trị — hợp nhất ô là cách trung thực nhất,
    //   lặp lại ở từng dòng con sẽ khiến người đọc tưởng mọi phần in đều đúng như vậy.
    { key: 'phuong_an_in', header: 'Phương án in', merge: true, render: (r) => <PhuongAnInBadge value={r.phuong_an_in} /> },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', merge: true, render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'nha_gia_cong', header: 'Nhà gia công', merge: true, render: (r) => r.nha_gia_cong || '—' },
    { key: 'so_luong_vai_ve', header: 'SLNV', className: 'text-right tabular-nums', merge: true, render: (r) => fmtNum(r.so_luong_vai_ve) },
    { key: 'han_giao_hang', header: 'Hạn giao', merge: true, render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'chuyen', header: 'Chuyền hiện tại', merge: true, render: (r) => r.ten_chuyen || '—' },
    { key: 'ngay_ke_hoach', header: 'Ngày SX kế hoạch', merge: true, render: (r) => fmtDate(r.ngay_ke_hoach) },
  ];

  // Lệnh GOM SET → tách 1 dòng / PHẦN IN. Lệnh thường trả `null` ⇒ render y như cũ.
  const subRows = (r) => (r.phan_in_list ? r.phan_in_list.map((p) => ({ ...p, __sub: true })) : null);

  return (
    <div>
      <Toolbar title="Lập kế hoạch lại" subtitle="Lệnh đang Test Run hoặc đã Release 2 (chưa bắt đầu sản xuất) — đổi chuyền / ngày sản xuất kèm lý do"
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {canReplan && (
          <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR code phần</Button>
        )}
        {canReplan && selected.size > 0 && (
          <Button onClick={openBatch}>Lập lại kế hoạch ({selected.size})</Button>
        )}
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{activeCount ? `${filtered.length}/` : ''}{meta.total} lệnh</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters}
        onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => setFilters({})} open={showFilters} />

      {/* Khối gom set: tách dòng theo phần in + VIỀN TRÁI xanh như màn Release 1.
          ⚠ Dùng `border-l`, KHÔNG đổi nền — nền đang dành cho màu cảnh báo SLA nghẽn. */}
      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={openDetail} sttStart={0}
        subRows={subRows}
        rowClassName={(r) => `${slaRowClass(statusLenh(r.id))} ${laGomSet(r) ? 'border-l-[3px] border-l-primary' : ''}`}
        emptyText="Không có lệnh nào để lập lại kế hoạch" />

      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Lập lại kế hoạch — ${detail.ma_lenh_san_xuat}` : 'Lập lại kế hoạch'}
        subtitle={detail ? `${detail.ten_khach_hang || ''} · ${detail.mau_vai || ''}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>Đóng</Button>
            <Button onClick={submit} loading={saving} disabled={!canReplan}>Lập lại kế hoạch</Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="Code phần" value={detail.ma_phan} />
              <Info label="Đơn hàng" value={detail.ma_don_hang} />
              <Info label="Mã hàng" value={detail.ma_hang} />
              <Info label="Màu vải" value={detail.mau_vai} />
              <Info label="Kích vải" value={detail.kich_vai} />
              <Info label="Kích phim" value={detail.kich_phim} />
              <Info label="SL nhận vải" value={fmtNum(detail.so_luong_vai_ve)} />
              <Info label="Hạn giao" value={fmtDate(detail.han_giao_hang)} />
            </div>
            <div className="space-y-3 border-t border-line pt-4">
              {/* Chọn chuyền GIỐNG MÀN RELEASE 1: `ChuyenPicker` có chip lọc theo loại + ô tìm mã/tên
                  (danh sách chuyền đã dài, `Select` trơn phải cuộn tìm rất lâu). */}
              <Field label="Chuyền in" hint="Mặc định kế thừa chuyền của kế hoạch cũ">
                <ChuyenPicker chuyen={chuyen} value={form.chuyenId}
                  onChange={(id) => setForm({ ...form, chuyenId: id })} />
              </Field>
              <Field label="Ngày sản xuất kế hoạch" required>
                <Input type="date" value={form.ngayKeHoach}
                  onChange={(e) => setForm({ ...form, ngayKeHoach: e.target.value })} />
              </Field>
              {/* SỐ LƯỢNG RELEASE — đổ sẵn đúng số đã nhập lúc Release 1, sửa được ngay tại đây.
                  ⚠ Ở mức (lệnh × ĐỢT VẢI): lệnh gộp nhiều đợt thì mỗi đợt một ô, tổng là SL của lệnh.
                  ⚠ `toi_da` = SL vải về − phần các lệnh KHÁC đang giữ (1 đợt vải release được nhiều lệnh). */}
              {dsDot.length > 0 && (
                <div className="space-y-2 rounded-control border border-line bg-surface-muted/40 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
                    <span>Số lượng release{dsDot.length > 1 ? ` (${dsDot.length} đợt vải)` : ''}</span>
                    <span className="tabular-nums">Tổng: {fmtNum(tongSlMoi)}</span>
                  </div>
                  {dsDot.map((d) => (
                    <div key={d.dot_vai_id} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="truncate text-ink">{d.ma_dot_vai}</div>
                        <div className="truncate text-ink-soft">
                          {dsDot.length > 1 ? `${d.ma_phan} · ` : ''}vải về {fmtNum(d.so_luong_vai_ve)}
                          {d.da_release_khac > 0 ? ` · lệnh khác giữ ${fmtNum(d.da_release_khac)}` : ''}
                          {` · tối đa ${fmtNum(d.toi_da)}`}
                        </div>
                      </div>
                      <div className="w-28 shrink-0">
                        <Input type="number" min={1} max={d.toi_da}
                          value={form.slRelease[d.dot_vai_id] ?? ''}
                          onChange={(e) => setForm((f) => ({
                            ...f, slRelease: { ...f.slRelease, [d.dot_vai_id]: e.target.value },
                          }))} />
                      </div>
                    </div>
                  ))}
                  {vuotSl && (
                    <div className="text-xs font-medium text-danger">
                      Có đợt vượt mức tối đa hoặc để trống — sửa lại trước khi lưu.
                    </div>
                  )}
                </div>
              )}
              {/* Giờ BD/KT — ghép với ngày kế hoạch thành `tg_bd_kh`/`tg_kt_kh`, y như Release 1.
                  Đổ sẵn giờ đang lưu của lệnh; xóa trắng thì backend DỜI giờ cũ sang ngày mới.
                  Dùng `TimeSelect` (24h) chứ KHÔNG `<input type="time">` — ô đó hiện AM/PM theo locale máy. */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giờ bắt đầu">
                  <TimeSelect value={form.gioBd} onChange={(v) => setForm({ ...form, gioBd: v })} minuteStep={5} />
                </Field>
                <Field label="Giờ kết thúc">
                  <TimeSelect value={form.gioKt} onChange={(v) => setForm({ ...form, gioKt: v })} minuteStep={5} />
                </Field>
              </div>
              <Field label="Lý do lập lại" hint="Không bắt buộc — có nhập thì hiện ở sidebar Lịch sử">
                <Textarea rows={3} value={form.lyDo}
                  onChange={(e) => setForm({ ...form, lyDo: e.target.value })}
                  placeholder="Vd: không kịp tiến độ, dời ngày sản xuất..." />
              </Field>
            </div>
          </div>
        )}
      </SidePanel>

      <Modal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        title="Lập lại kế hoạch hàng loạt"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBatchOpen(false)}>Hủy</Button>
            <Button onClick={submitBatch} loading={saving}>Lập lại {selected.size} lệnh</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          Áp dụng cùng chuyền / ngày / lý do cho <b>{selected.size}</b> lệnh đã chọn.
        </div>
        <Field label="Chuyền in" hint="Để trống = giữ chuyền hiện tại của từng lệnh">
          <ChuyenPicker chuyen={chuyen} value={batchForm.chuyenId}
            onChange={(id) => setBatchForm({ ...batchForm, chuyenId: id })}
            placeholder="— Giữ chuyền hiện tại —" />
        </Field>
        <Field label="Ngày sản xuất kế hoạch" required>
          <Input type="date" value={batchForm.ngayKeHoach}
            onChange={(e) => setBatchForm({ ...batchForm, ngayKeHoach: e.target.value })} />
        </Field>
        {/* Áp CÙNG giờ cho mọi lệnh đã chọn. Để trống = giữ giờ riêng của từng lệnh (backend dời
            sang ngày mới) — cố ý không xóa trắng, vì mỗi lệnh có thể đã đặt giờ khác nhau. */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giờ bắt đầu" hint="Trống = giữ giờ từng lệnh">
            <TimeSelect value={batchForm.gioBd} onChange={(v) => setBatchForm({ ...batchForm, gioBd: v })} minuteStep={5} />
          </Field>
          <Field label="Giờ kết thúc" hint="Trống = giữ giờ từng lệnh">
            <TimeSelect value={batchForm.gioKt} onChange={(v) => setBatchForm({ ...batchForm, gioKt: v })} minuteStep={5} />
          </Field>
        </div>
        <Field label="Lý do lập lại" hint="Không bắt buộc — có nhập thì hiện ở sidebar Lịch sử">
          <Textarea rows={3} value={batchForm.lyDo}
            onChange={(e) => setBatchForm({ ...batchForm, lyDo: e.target.value })}
            placeholder="Vd: không kịp tiến độ, dời ngày sản xuất..." />
        </Field>
      </Modal>

      <ScanCollectModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Quét QR code phần — Lập lại kế hoạch"
        help="Quét QR code phần để chọn các lệnh của phần in đó. Quét nhiều rồi bấm Lập lại kế hoạch cho tất cả cùng lúc."
        rows={rows}
        getId={(r) => r.id}
        getCodes={codesCuaLenh}
        matchMultiple
        isSelected={(r) => selected.has(r.id)}
        onToggle={(r) => toggleOne(r.id)}
        primaryLabel={(r) => r.ma_phan || r.ma_lenh_san_xuat || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.mau_vai, r.ma_lenh_san_xuat].filter(Boolean).join(' · ')}
        onConfirm={() => { setScanOpen(false); openBatch(); }}
        confirmLabel="Lập lại kế hoạch"
      />

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử kế hoạch (Release 2 + lập lại)" fetcher={planHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã lập lại kế hoạch" maHeader="Lệnh" fetcher={replanDone} />

      <Toast toast={toast} />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{value || '—'}</div>
    </div>
  );
}
