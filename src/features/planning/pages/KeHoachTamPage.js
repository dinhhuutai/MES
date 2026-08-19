import { useEffect, useState, useCallback, useMemo } from 'react';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import useNghenMap from '../../../hooks/useNghenMap';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import { Field, Input, Textarea } from '../../../components/common/controls';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import PhuongAnInBadge from '../../../components/common/PhuongAnInBadge';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import {
  listKeHoachTam, confirmKeHoachTam, updateKeHoachTam, deleteKeHoachTam, listChuyen,
  keHoachTamHistory, keHoachTamDone, release1TraVeKyThuat,
} from '../../../services/planningService';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';
import { fmtNum, fmtDate } from '../../../utils/format';

// Lọc nhiều trường (client-side, kết hợp AND) — trang tải-hết (limit 500) nên lọc đủ mọi dòng.
// `col` = tên thuộc tính trên hàng do `listKeHoachTam` trả về.
const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' },
  { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' },
  { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
  { key: 'chuyen', label: 'Chuyền dự kiến', col: 'ten_chuyen' },
  { key: 'gomSet', label: 'Gom set', col: 'ma_set' },
  { key: 'nhaGiaCong', label: 'Nhà gia công', col: 'nha_gia_cong' },
];

// timestamptz → 'YYYY-MM-DD' cho ô <input type="date"> (ngày local).
const toDateInput = (t) => {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const hhmm = (t) => {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Màn "Kế hoạch tạm": bản nháp chuyền/giờ/ngày cho phần in CHƯA Ready. Khi phần in Ready xong (QA xác nhận)
// → bấm "Xác nhận Release 1" (dùng lại chuyền/giờ/ngày đã lưu, không chọn lại).
export default function KeHoachTamPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canDo = can('RELEASE1') || can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [nghenOpen, setNghenOpen] = useState(false); // modal "Danh sách nghẽn"
  // Nguồn nghẽn dùng CHUNG với các màn Kế hoạch khác (dashboard `flowRows`) — cùng một bản đồ nên
  // danh sách nghẽn ở đây không bao giờ lệch với Release 1/2.
  const { statusDot } = useNghenMap();
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [scanOpen, setScanOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { ids:[], label } — xác nhận Release 1 (1 hoặc nhiều)
  const [del, setDel] = useState(null); // { id, label }
  const [saving, setSaving] = useState(false);
  const [chuyen, setChuyen] = useState([]);
  const [edit, setEdit] = useState(null); // dòng đang sửa
  const [editForm, setEditForm] = useState({ chuyenId: '', soLuongRelease: '', ngayKeHoach: '' });
  const [traVeOpen, setTraVeOpen] = useState(false); // modal "Trả về Kỹ thuật" (lý do bắt buộc)
  const [traVeReason, setTraVeReason] = useState('');
  const [filters, setFilters] = useState({});

  // Dải "Theo dõi" (sĩ số) bám ĐÚNG ô tìm + panel lọc của màn này — xem hooks/useSiSoLoc.js.
  useSiSoLoc({ timKiem: search, ...filters });
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;
  const filtered = useMemo(() => filterRows(rows, filters, FILTER_FIELDS), [rows, filters]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // TẢI HẾT MỌI TRANG — bộ lọc chạy ở client nên phải có đủ dòng mới lọc đúng.
      // ⚠ `getPaging` cắt `limit` còn 200; danh sách ≤200 dòng thì vòng lặp chỉ tốn 1 lời gọi.
      const { items, total, thieu } = await taiHetTrang((p) => listKeHoachTam({ search, ...p }), { limit: LIMIT_TAI_LON });
      setRows(items);
      setMeta({ total });
      if (thieu && !silent) show(`Mới tải được ${items.length}/${total} bản — hãy thu hẹp tìm kiếm`, 'error');
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
  useSocketReload(['ready:confirmed', 'workflow:updated'], () => load(true));

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);

  const openEdit = (r) => {
    setEdit(r);
    setEditForm({
      chuyenId: r.chuyen_id || '',
      soLuongRelease: r.so_luong != null ? String(r.so_luong) : '',
      ngayKeHoach: toDateInput(r.ngay_ke_hoach),
    });
  };

  const doSaveEdit = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await updateKeHoachTam(edit.id, {
        chuyenId: editForm.chuyenId || null,
        soLuong: editForm.soLuongRelease ? Number(editForm.soLuongRelease) : null,
        ngayKeHoach: editForm.ngayKeHoach || null,
      });
      show(`Đã cập nhật kế hoạch tạm ${edit.ma_phan || ''}`);
      setEdit(null);
      load();
    } catch (e) {
      show(e.message || 'Cập nhật thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Trả về Kỹ thuật — DÙNG CHUNG endpoint với màn Release 1 (`traVeKyThuat` chỉ cần `dotVaiId`):
  // mở lại READY cho phần in (hủy xác nhận Khuôn/Film/Mực + QC), và nếu đợt thuộc GOM SET thì trả CẢ SET.
  // ⚠ CỐ Ý GIỮ NGUYÊN dòng kế hoạch tạm: màn này vốn dành cho phần in CHƯA Ready, nên sau khi trả về
  // dòng chỉ đổi badge sang "Chờ Ready" (qc_done tính sống ở BE) và không tick chọn được nữa. Xóa dòng
  // sẽ vứt luôn chuyền/ngày kế hoạch đã lập — bắt người lập kế hoạch làm lại từ đầu, không có lý do gì.
  const doTraVeKyThuat = async () => {
    if (!edit) return;
    const lyDo = traVeReason.trim();
    if (!lyDo) { show('Nhập lý do trả về Kỹ thuật', 'error'); return; }
    setSaving(true);
    try {
      const res = await release1TraVeKyThuat({ dotVaiId: edit.dot_vai_ve_id, lyDo });
      const n = res?.data?.so_phan_in || 1;
      const maSet = res?.data?.ma_set;
      show(maSet
        ? `Đã trả cả set ${maSet} về Kỹ thuật — ${n} phần in quay lại READY (kế hoạch tạm giữ nguyên)`
        : 'Đã trả về Kỹ thuật — phần in quay lại READY (kế hoạch tạm giữ nguyên)');
      setTraVeOpen(false); setTraVeReason('');
      setEdit(null);
      load();
    } catch (e) {
      show(e.message || 'Trả về Kỹ thuật thất bại', 'error');
    } finally { setSaving(false); }
  };

  // Nút chỉ có nghĩa khi CÓ thứ để hủy: dòng đã Ready, hoặc dòng thuộc set mà set có phần in đã Ready
  // (dòng đang xem chưa Ready nhưng trả cả set vẫn hợp lý) — cùng luật với màn Release 1.
  // ⚠ CỐ Ý xét trên `rows` ĐẦY ĐỦ, KHÔNG phải `filtered`: thành viên của set là dữ kiện thật, không
  //   phụ thuộc người dùng đang lọc gì. Đổi sang `filtered` sẽ làm nút biến mất chỉ vì thành viên
  //   còn lại của set bị bộ lọc ẩn đi.
  const setDaReady = !!edit?.ma_set && rows.some((r) => r.ma_set === edit.ma_set && r.qc_done);
  const choPhepTraVe = canDo && !!edit && (edit.qc_done === true || setDaReady);

  // Chỉ phần in ĐÃ Ready (qc_done) mới xác nhận Release 1 được → chỉ những dòng này chọn được.
  // Tính trên tập ĐANG HIỆN (đã lọc) để "chọn tất cả" không ôm luôn dòng ngoài bộ lọc.
  const readyRows = filtered.filter((r) => r.qc_done);
  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = readyRows.length > 0 && readyRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(readyRows.map((r) => r.id))));

  const doConfirm = async () => {
    if (!confirm) return;
    setSaving(true);
    let okCount = 0; let donCount = 0; let failCount = 0; let firstErr = ''; let lenhDaCo = '';
    for (const id of confirm.ids) {
      try {
        const res = await confirmKeHoachTam(id);
        // `da_don` = đợt đã được release ở đường khác (thường là release cả gom set ở màn Release 1),
        // dòng kế hoạch tạm chỉ còn là rác và BE vừa dọn — KHÔNG phải lỗi, đừng đếm vào `failCount`.
        if (res?.data?.da_don) { donCount += 1; if (!lenhDaCo) lenhDaCo = res.data.ma_lenh || ''; }
        else okCount += 1;
      } catch (e) { failCount += 1; if (!firstErr) firstErr = e.message || ''; }
    }
    setSaving(false);
    setConfirm(null);
    // Giữ LÝ DO lỗi đầu tiên (vd đợt thuộc gom set chưa đủ Ready) — trước chỉ đếm số lỗi nên không ai biết vì sao.
    const phanDon = donCount
      ? ` · dọn ${donCount} dòng đã release trước đó${lenhDaCo ? ` (vd lệnh ${lenhDaCo})` : ''}`
      : '';
    show(failCount
      ? `Đã xác nhận Release 1 ${okCount} phần in, ${failCount} lỗi${firstErr ? ` — ${firstErr}` : ''}${phanDon}`
      : `Đã xác nhận Release 1 ${okCount} phần in${phanDon}`,
    failCount ? 'error' : 'success');
    load();
  };

  const doDelete = async () => {
    if (!del) return;
    setSaving(true);
    try {
      await deleteKeHoachTam(del.id);
      show(`Đã xóa kế hoạch tạm ${del.label}`);
      setDel(null);
      load();
    } catch (e) {
      show(e.message || 'Xóa thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    ...(canDo ? [{ key: 'sel', className: 'w-10', selection: true,
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      render: (r) => (
        <input type="checkbox" checked={selected.has(r.id)} disabled={!r.qc_done}
          onClick={(e) => e.stopPropagation()} onChange={() => toggleOne(r.id)}
          aria-label="Chọn phần in" title={r.qc_done ? '' : 'Chưa Ready — chưa xác nhận Release 1 được'} />
      ) }] : []),
    { key: 'trang_thai', header: 'Tình trạng', render: (r) => (
      r.qc_done ? <Badge tone="success">Đã Ready</Badge> : <Badge tone="warning">Chờ Ready</Badge>
    ) },
    // Đợt thuộc GOM SET: xác nhận sẽ release CẢ SET thành 1 lệnh chung, và chỉ khi mọi đợt trong set đã Ready.
    { key: 'ma_set', header: 'Gom set', render: (r) => (r.ma_set
      ? <Badge tone="info" title="Release chung cả set khi mọi đợt trong set đã Ready">{r.ma_set}</Badge>
      : <span className="text-ink-soft">—</span>) },
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => r.ma_phan || '—' },
    { key: 'ten_khach_hang', header: 'Khách hàng', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
    { key: 'phuong_an_in', header: 'Phương án in', render: (r) => <PhuongAnInBadge value={r.phuong_an_in} /> },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    { key: 'nha_gia_cong', header: 'Nhà gia công', render: (r) => r.nha_gia_cong || '—' },
    { key: 'so_luong', header: 'SL', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'ten_chuyen', header: 'Chuyền (dự kiến)', render: (r) => r.ten_chuyen || '—' },
    { key: 'ngay_ke_hoach', header: 'Ngày KH', render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'gio', header: 'Giờ BD–KT', render: (r) => (r.tg_bd_kh || r.tg_kt_kh ? `${hhmm(r.tg_bd_kh) || '—'}–${hhmm(r.tg_kt_kh) || '—'}` : '—') },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    ...(canDo ? [{ key: 'act', header: '', className: 'text-right whitespace-nowrap', render: (r) => (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" icon="check" disabled={!r.qc_done}
          onClick={(e) => { e.stopPropagation(); setConfirm({ ids: [r.id], label: r.ma_phan }); }}>
          Xác nhận Release 1
        </Button>
        <Button size="sm" variant="ghost" icon="trash-2"
          onClick={(e) => { e.stopPropagation(); setDel({ id: r.id, label: r.ma_phan }); }} aria-label="Xóa"
          title="Xóa kế hoạch tạm — đợt vải quay lại Release 1" />
      </div>
    ) }] : []),
  ];

  return (
    <div>
      <Toolbar title="Kế hoạch tạm" subtitle="Bản kế hoạch sớm cho phần in CHƯA Ready. Khi phần in Ready xong (QA xác nhận) → bấm 'Xác nhận Release 1' (dùng lại chuyền/giờ/ngày đã lưu)"
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm code phần, mã hàng, màu, khách...">
        {canDo && (
          <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR code phần</Button>
        )}
        {canDo && selected.size > 0 && (
          <Button onClick={() => setConfirm({ ids: [...selected], label: `${selected.size} phần in` })}>
            Xác nhận Release 1 ({selected.size})
          </Button>
        )}
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <NghenButton rows={rows} trangThai={(r) => statusDot(r.dot_vai_ve_id)} onClick={() => setNghenOpen(true)} />
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{activeCount ? `${filtered.length}/` : ''}{meta.total || rows.length} bản</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters}
        onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => setFilters({})} open={showFilters} />

      <DataTable columns={columns} rows={filtered} loading={loading} sttStart={0}
        onRowClick={(r) => openEdit(r)}
        emptyText={activeCount ? 'Không có bản nào khớp bộ lọc' : 'Chưa có kế hoạch tạm nào'} />

      {/* ĐỦ `rows` (không phải `readyRows`) — quét dòng đang hiện trên bảng cũng khớp; dòng chưa Ready
          thì `canSelect` nói rõ lý do thay vì báo "Không thấy". */}
      <ScanCollectModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Quét QR code phần — Kế hoạch tạm"
        help="Quét QR code phần (hoặc mã vạch) để chọn các bản kế hoạch tạm ĐÃ Ready của phần in đó. Quét nhiều rồi bấm Xác nhận Release 1 cùng lúc."
        rows={rows}
        getId={(r) => r.id}
        getCodes={(r) => [r.ma_phan]}
        getBarcodes={(r) => [r.barcode]}
        matchMultiple
        canSelect={(r) => r.qc_done === true || 'chưa Ready (QC chưa xác nhận) — chưa Release 1 được'}
        isSelected={(r) => selected.has(r.id)}
        onToggle={(r) => toggleOne(r.id)}
        primaryLabel={(r) => r.ma_phan || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.mau_vai, r.ma_hang].filter(Boolean).join(' · ')}
        onConfirm={() => { setScanOpen(false); setConfirm({ ids: [...selected], label: `${selected.size} phần in` }); }}
        confirmLabel="Xác nhận Release 1"
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        loading={saving}
        title="Xác nhận Release 1"
        confirmText="Xác nhận Release 1"
        message={confirm ? `Xác nhận Release 1 cho ${confirm.label} theo chuyền/giờ/ngày đã lập kế hoạch tạm?` : ''}
      />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={doDelete}
        loading={saving}
        variant="danger"
        title="Xóa kế hoạch tạm"
        confirmText="Xóa"
        message={del ? `Xóa bản kế hoạch tạm của ${del.label}?` : ''}
      />

      {/* SidePanel chỉnh sửa kế hoạch tạm (chuyền / SL release / ngày kế hoạch) — như bên Release 1 */}
      <SidePanel
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `Sửa kế hoạch tạm — ${edit.ma_phan || ''}` : 'Chỉnh sửa kế hoạch tạm'}
        subtitle={edit ? `${edit.ten_khach_hang || ''} · ${edit.mau_vai || ''}` : ''}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>Đóng</Button>
            {choPhepTraVe && (
              <Button variant="danger" icon="log-out" onClick={() => { setTraVeReason(''); setTraVeOpen(true); }}>
                Trả về Kỹ thuật
              </Button>
            )}
            <Button onClick={doSaveEdit} loading={saving} disabled={!editForm.chuyenId}>Lưu</Button>
          </>
        )}
      >
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="Khách hàng" value={edit.ten_khach_hang} />
              <Info label="Đơn hàng" value={edit.ma_don_hang} />
              <Info label="Mã hàng" value={edit.ma_hang} />
              <Info label="Code phần" value={edit.ma_phan} />
              <Info label="Màu vải" value={edit.mau_vai} />
              <Info label="Đợt vải" value={edit.ma_dot_vai} />
              <Info label="SL nhận vải" value={fmtNum(edit.so_luong_vai_ve)} />
              <Info label="Hạn giao" value={fmtDate(edit.han_giao_hang)} />
            </div>
            <div className="space-y-3 border-t border-line pt-4">
              <Field label="Chuyền in" required>
                <ChuyenPicker chuyen={chuyen} value={editForm.chuyenId} onChange={(id) => setEditForm((f) => ({ ...f, chuyenId: id }))} />
              </Field>
              <div className="grid grid-cols-2 gap-x-4">
                <Field label="Số lượng release" hint={edit.so_luong_vai_ve != null ? `SL nhận vải ${fmtNum(edit.so_luong_vai_ve)}` : undefined}>
                  <Input type="number" min="1" max={edit.so_luong_vai_ve || undefined}
                    value={editForm.soLuongRelease} onChange={(e) => setEditForm((f) => ({ ...f, soLuongRelease: e.target.value }))} />
                </Field>
                <Field label="Ngày kế hoạch">
                  <Input type="date" value={editForm.ngayKeHoach} onChange={(e) => setEditForm((f) => ({ ...f, ngayKeHoach: e.target.value }))} />
                </Field>
              </div>
              <p className="text-xs text-ink-soft">Giờ bắt đầu/kết thúc kế hoạch giữ nguyên như đã lập.</p>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Trả về Kỹ thuật — lý do BẮT BUỘC, hiện lại ở màn READY / QC READY (giống màn Release 1) */}
      <Modal
        open={traVeOpen}
        onClose={() => setTraVeOpen(false)}
        title={`Trả về Kỹ thuật — ${edit?.ma_set || edit?.ma_phan || ''}`}
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setTraVeOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={doTraVeKyThuat} loading={saving} disabled={!traVeReason.trim()}>
              Xác nhận trả về
            </Button>
          </>
        )}
      >
        <p className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          {edit?.ma_set ? (
            <>
              Đợt vải thuộc <b>{edit.ma_set}</b> — gom set in chung nên sẽ trả về <b>CẢ SET</b>: mọi phần in
              trong set quay lại <b>READY</b> (hủy xác nhận Khuôn/Film/Mực + QC), kỹ thuật phải làm lại.
            </>
          ) : (
            <>
              Phần in sẽ quay lại <b>READY</b>: hủy xác nhận Khuôn/Film/Mực + QC, kỹ thuật phải làm lại.
            </>
          )}
          {' '}Lý do sẽ hiện ở màn Chuẩn bị kỹ thuật. <b>Bản kế hoạch tạm được GIỮ NGUYÊN</b> (chuyền/ngày
          đã lập không mất), chỉ đổi sang <b>Chờ Ready</b> — Ready xong là xác nhận Release 1 được ngay.
        </p>
        <Field label="Lý do trả về" required>
          <Textarea rows={3} value={traVeReason} onChange={(e) => setTraVeReason(e.target.value)}
            placeholder="Vì sao trả về kỹ thuật (vd: sai film, khuôn chưa đạt...)" />
        </Field>
      </Modal>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử kế hoạch tạm" fetcher={keHoachTamHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Kế hoạch tạm đã xác nhận Release 1" maHeader="Lệnh" showChuyen fetcher={keHoachTamDone} />

      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="Kế hoạch tạm" rows={rows} trangThai={(r) => statusDot(r.dot_vai_ve_id)} tenFile="nghen-ke-hoach-tam" />
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
