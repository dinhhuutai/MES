import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import GomBadge from '../../../components/common/GomBadge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Textarea } from '../../../components/common/controls';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import TraVeGnModal from '../../../components/common/TraVeGnModal';
import { dsPhanInCuaLenh } from '../../../utils/phanInTraVeGn';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useSocketReload from '../../../hooks/useSocketReload';
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';
import useNghenMap from '../../../hooks/useNghenMap';
import useLyDoNghen from '../../../hooks/useLyDoNghen';
import { slaRowClass } from '../../../utils/sla';
import {
  listProductionCandidates, startProduction, getMonitor, listChuyen, traVeKyThuatSanXuat,
} from '../../../services/productionService';
import { fmtNum, fmtDate } from '../../../utils/format';
import DateRangePicker from '../../../components/common/DateRangePicker';
import exportCheckpointExcel, { moTaBoLoc } from '../../../utils/exportCheckpointExcel';
import ChipTabs from '../../../components/common/ChipTabs';
import { LOAI_TABS, hopChipChuyen, nhanChip, demChip, locSiSoTheoChip } from '../../../utils/khuChuyen';
import RunPanel from '../components/RunPanel';
import ChoChayModal, { LocLenhPanel } from '../components/ChoChayModal';
import { locLenhChay, coLoc, LOC_TRONG } from '../utils/locLenhChay';
import TheoDoiChuyenPage from './TheoDoiChuyenPage';
import XePhoiPage from './XePhoiPage';

// ⚠⚠ GỌN LẠI 01/10/2026 (người dùng yêu cầu): trang chỉ còn bảng *Đang chạy*; danh sách *Chờ chạy* chuyển
//   vào modal mở từ nút "Chờ chạy (N)" (`components/ChoChayModal`, bộ lọc RIÊNG đầy đủ). Ô tìm + panel lọc
//   + chip + 2 ô ngày của trang nay chỉ áp cho bảng Đang chạy. Luật lọc dùng chung `utils/locLenhChay.js`
//   — ô tìm khớp cả MÃ VẠCH TDTHĐH / HSKT (`ma_quet` backend gom đủ mã mọi phần in của lệnh).
export default function XacNhanChayPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const { statusLenh, tgLenh } = useNghenMap();
  // Khóa lý do mặc định (`utils/nghen.khoaMacDinh`) đọc `lenh_id` của 2 bảng — khớp màn này.
  const { hoiLyDoNghen, lyDoNghenModal } = useLyDoNghen({
    maTrang: 'SX_CHO_CHAY', trangThai: (r) => statusLenh(r.lenh_id), thoiGian: (r) => tgLenh(r.lenh_id),
  });
  const canRun = can('PROD_RUN');

  const [candidates, setCandidates] = useState([]);
  const [choChayOpen, setChoChayOpen] = useState(false);
  const [nghenOpen, setNghenOpen] = useState(false); // modal "Danh sách nghẽn"
  // ⚠ Theo dõi chuyền + Tình trạng xe phơi GỘP VÀO màn này (24/09/2026): 2 nút mở modal TOÀN MÀN HÌNH
  //   dựng NGUYÊN component trang cũ. Route cũ chuyển hướng về đây kèm `?mo=` (App.js).
  const [params, setParams] = useSearchParams();
  const [moTrang, setMoTrang] = useState(() => {
    const m = params.get('mo');
    return m === 'theo-doi-chuyen' || m === 'xe-phoi' ? m : null;
  });
  const dongTrang = () => {
    setMoTrang(null);
    if (params.get('mo')) setParams((p) => { const n = new URLSearchParams(p); n.delete('mo'); return n; }, { replace: true });
  };
  const [running, setRunning] = useState([]);
  const [chuyen, setChuyen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState(LOC_TRONG);
  const [sel, setSel] = useState(null);
  const [confirmRun, setConfirmRun] = useState(null); // lệnh đang xác nhận chạy
  const [runChuyenId, setRunChuyenId] = useState('');
  const [traVe, setTraVe] = useState(null);           // lệnh đang trả về Kỹ thuật (lý do bắt buộc)
  const [traVeReason, setTraVeReason] = useState('');
  const [gnLenh, setGnLenh] = useState(null);         // lệnh đang mở "Trả về GN" (lệnh giữ nguyên, tạm rời Chờ chạy)
  const [busy, setBusy] = useState(false);
  // Chip LOẠI CHUYỀN + KHU BÀN — cùng bộ với "Theo dõi chuyền" / "Test Run - QA".
  const [loai, setLoai] = useState('');
  // Bảng Đang chạy: ngày XÁC NHẬN CHẠY (`phieu_san_xuat.tg_bd`, cạnh title) + ngày SX kế hoạch (mép phải),
  // chồng nhau theo AND. Mặc định RỖNG = không lọc.
  const [ngayRun, setNgayRun] = useState({ from: '', to: '' });
  const [ngayXnRun, setNgayXnRun] = useState({ from: '', to: '' });

  // Dải "Theo dõi" (sĩ số) bám ô tìm + panel lọc + chip + ô chuyền.
  // ⚠⚠ Ô lọc chuyền giữ `chuyenId` (UUID) — backend khớp theo `ma_chuyen` ⇒ phải quy đổi. Chip khu bàn
  //   cũng đặt `maChuyen` ⇒ cả hai bật thì GIAO NHAU (chọn chuyền ngoài khu ⇒ sentinel khớp rỗng).
  useSiSoLoc((() => {
    const chip = locSiSoTheoChip(loai);
    const maChon = (chuyen || []).find((x) => x.id === filters.chuyenId)?.ma_chuyen || '';
    let maChuyen = chip.maChuyen || '';
    if (maChon) {
      const ds = maChuyen ? maChuyen.split(',') : null;
      maChuyen = !ds || ds.includes(maChon) ? maChon : '__KHONG_KHOP__';
    }
    return { timKiem: search, ...filters, ...chip, ...(maChuyen ? { maChuyen } : {}) };
  })());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Chờ chạy tải HẾT (lọc/tìm ở client trong modal; số trên nút). ⚠ Vượt 200 phải đi `taiHetTrang`.
      const [kq, m] = await Promise.all([
        taiHetTrang((p) => listProductionCandidates({ search: '', ...p }), { limit: LIMIT_TAI_LON }),
        getMonitor(),
      ]);
      setCandidates(kq.items);
      if (kq.thieu) show(`Chỉ tải được ${kq.items.length}/${kq.total} lệnh chờ chạy`, 'error');
      setRunning(m.data.running);
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [show]);

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  // Tải NGẦM theo sự kiện realtime (không spinner, không xóa lựa chọn); gộp 400ms.
  useSocketReload(['production:updated', 'dashboard:refresh'], () => load(true));

  const hasFilter = coLoc(filters);
  const runFiltered = useMemo(() => locLenhChay(running, {
    search, loc: filters, chuyen, loai, ngay: [{ cot: 'ngay_ke_hoach', ...ngayRun }, { cot: 'tg_bd', ...ngayXnRun }],
  }), [running, search, filters, chuyen, ngayRun, ngayXnRun, loai]);
  // Số trên chip = tập đã qua mọi bộ lọc TRỪ chính chip.
  const countChip = useMemo(() => demChip(locLenhChay(running, {
    search, loc: filters, chuyen, boChip: true, ngay: [{ cot: 'ngay_ke_hoach', ...ngayRun }, { cot: 'tg_bd', ...ngayXnRun }],
  })), [running, search, filters, chuyen, ngayRun, ngayXnRun]);

  // Nguồn "Danh sách nghẽn": GỘP cả Đang chạy + Chờ chạy, tập ĐẦY ĐỦ (chưa lọc), khử trùng `lenh_id`.
  const rowsNghen = useMemo(() => {
    const m = new Map();
    [...(running || []), ...(candidates || [])].forEach((r) => {
      if (r && r.lenh_id && !m.has(r.lenh_id)) m.set(r.lenh_id, r);
    });
    return [...m.values()];
  }, [running, candidates]);
  const locTheoChip = useCallback((rows) => (loai ? (rows || []).filter((r) => hopChipChuyen(r, loai)) : rows), [loai]);

  const selChuyen = (chuyen || []).find((x) => x.id === filters.chuyenId);
  // Bảng "Đang chạy" lấy từ `monitorRunning` — bộ cột KHÁC danh sách lệnh nên khai riêng.
  const doExcelRunning = () => exportCheckpointExcel({
    cols: [
      { header: 'Mã đợt SX', width: 16, value: (r) => r.ma_lenh_san_xuat || '' },
      { header: 'Chuyền', width: 16, value: (r) => r.ten_chuyen || r.ma_chuyen || '' },
      { header: 'Code phần', width: 24, value: (r) => r.ma_phan || r.phan_list || '' },
      { header: 'Khách hàng', width: 18, value: (r) => r.ten_khach_hang || '' },
      { header: 'Đơn hàng', width: 18, value: (r) => r.ma_don_hang || '' },
      { header: 'Mã hàng', width: 18, value: (r) => r.ma_hang || '' },
      { header: 'Màu vải', width: 18, value: (r) => r.mau_vai || '' },
      { header: 'Kích vải', width: 14, value: (r) => r.kich_vai || '' },
      { header: 'Kích phim', width: 14, value: (r) => r.kich_phim || '' },
      { header: 'SL release', width: 12, num: true, value: (r) => (r.target == null ? null : Number(r.target)) },
      { header: 'Đã in', width: 12, num: true, value: (r) => (r.printed == null ? null : Number(r.printed)) },
      { header: 'Số tem', width: 10, num: true, value: (r) => (r.so_tem == null ? null : Number(r.so_tem)) },
      { header: 'Trạng thái', width: 13, center: true, value: (r) => (r.dang_ngung ? 'Đang ngừng' : 'Đang chạy'),
        red: (r) => !!r.dang_ngung },
      { header: 'Ngừng (phút)', width: 12, num: true, value: (r) => (r.ngung_phut ? Number(r.ngung_phut) : null) },
      { header: 'Hạn giao', width: 13, type: 'date', center: true, value: (r) => r.han_giao_hang },
      { header: 'Ngày SX kế hoạch', width: 15, type: 'date', center: true, value: (r) => r.ngay_ke_hoach },
      { header: 'Xác nhận chạy', width: 17, center: true,
        value: (r) => (r.tg_bd ? new Date(r.tg_bd).toLocaleString('vi-VN') : '') },
    ],
    rows: runFiltered, title: 'Đang sản xuất', fileName: 'dang-san-xuat',
    moTaLoc: moTaBoLoc({
      'tìm kiếm': search, khách: filters.khach, đơn: filters.don, 'mã hàng': filters.maHang,
      'màu vải': filters.mauVai, 'kích vải': filters.kichVai, 'kích phim': filters.kichPhim,
      chuyền: selChuyen ? (selChuyen.ten_chuyen || selChuyen.ma_chuyen) : '',
      'loại chuyền': nhanChip(loai),
      'ngày SX kế hoạch': [ngayRun.from, ngayRun.to].filter(Boolean).join(' → '),
      'ngày xác nhận chạy': [ngayXnRun.from, ngayXnRun.to].filter(Boolean).join(' → '),
    }),
  });

  // Mở hộp xác nhận: kế thừa chuyền kế hoạch, cho đổi chuyền thực tế.
  const openConfirm = (lenh) => { setConfirmRun(lenh); setRunChuyenId(lenh.chuyen_id || ''); };

  const doStart = async () => {
    if (!(await hoiLyDoNghen([confirmRun]))) return; // quá SLA ⇒ lý do nghẽn (mig 106)
    setBusy(true);
    try {
      await startProduction(confirmRun.id, runChuyenId || null);
      show('Đã xác nhận chạy — bắt đầu in & tạo tem');
      const startedId = confirmRun.id;
      setConfirmRun(null);
      setChoChayOpen(false); // đóng modal Chờ chạy để thấy ngay sidebar Sản xuất của lệnh vừa chạy
      setSel(startedId);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  // TRẢ VỀ KỸ THUẬT (chờ chạy): hủy lệnh + phần in quay về READY; lý do BẮT BUỘC.
  const doTraVeKyThuat = async () => {
    if (!traVe) return;
    const lyDo = traVeReason.trim();
    if (!lyDo) { show('Nhập lý do trả về Kỹ thuật', 'error'); return; }
    setBusy(true);
    try {
      const res = await traVeKyThuatSanXuat(traVe.id, lyDo);
      const d = res.data || {};
      show(`Đã trả về Kỹ thuật — ${fmtNum(d.phan_in || 1)} phần in quay lại READY`);
      setTraVe(null); setTraVeReason('');
      load();
    } catch (e) {
      show(e.message || 'Trả về Kỹ thuật thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  // LỆNH GOM SET → tách 1 dòng / PHẦN IN; cột mức lệnh `merge`.
  const subRows = (r) => (r.phan_in_list ? r.phan_in_list.map((p) => ({ ...p, __sub: true })) : null);

  const runCols = [
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => (
      <div>
        <div className="text-ink">{r.ma_hang || '—'}</div>
        {!r.__sub && <GomBadge soDotVai={r.so_dot_vai} soPhanIn={r.so_phan_in} />}
      </div>
    ) },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'ma_chuyen', header: 'Chuyền', merge: true },
    { key: 'nha_gia_cong', header: 'Nhà gia công', merge: true, render: (r) => r.nha_gia_cong || '—' },
    { key: 'ngay_ke_hoach', header: 'Ngày SX KH', merge: true, render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'tg_bd', header: 'Xác nhận chạy', merge: true,
      render: (r) => (r.tg_bd ? new Date(r.tg_bd).toLocaleString('vi-VN') : '—') },
    { key: 'printed', header: 'Đã in', className: 'text-right tabular-nums', merge: true, render: (r) => `${fmtNum(r.printed)} / ${fmtNum(r.target)}` },
    { key: 'so_tem', header: 'Tem', className: 'text-right', merge: true },
    { key: 'tt', header: 'Trạng thái', merge: true, render: (r) =>
      r.dang_ngung ? <Badge tone="danger">Đang ngừng</Badge> : <Badge tone="success">Đang chạy</Badge> },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', merge: true, render: (r) =>
      <Button chiXemOk variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setSel(r.lenh_id)}>Mở</Button> },
  ];

  return (
    <div>
      <Toolbar title="Xác nhận chạy" search={search} onSearch={setSearch}
        searchPlaceholder="Tìm code phần, mã vạch TDTHĐH / HSKT, mã hàng, màu/kích, đơn...">
        <Button chiXemOk icon="list" onClick={() => setChoChayOpen(true)}>
          Chờ chạy ({fmtNum(candidates.length)})
        </Button>
        {can('PROD_MONITOR') && (
          <Button chiXemOk variant="ghost" icon="activity" onClick={() => setMoTrang('theo-doi-chuyen')}>Theo dõi chuyền</Button>
        )}
        {can('XEPHOI') && (
          <Button chiXemOk variant="ghost" icon="truck" onClick={() => setMoTrang('xe-phoi')}>Xe phơi</Button>
        )}
        <Button chiXemOk variant={showFilter || hasFilter ? 'secondary' : 'ghost'} icon="filter" onClick={() => setShowFilter((v) => !v)}>
          Bộ lọc{hasFilter ? ' ●' : ''}
        </Button>
        {/* Nghẽn gộp Đang chạy + Chờ chạy. Hiện ở MỌI chip (01/10/2026 — gỡ luật ẩn ở "Tất cả" của 26/09);
            đếm đúng chip đang đứng, modal mở sẵn chip đó. */}
        <NghenButton rows={locTheoChip(rowsNghen)} trangThai={(r) => statusLenh(r.lenh_id)}
          onClick={() => setNghenOpen(true)} />
      </Toolbar>

      {showFilter && <LocLenhPanel loc={filters} setLoc={setFilters} chuyen={chuyen} />}

      <ChipTabs tabs={LOAI_TABS} value={loai} counts={countChip} onChange={setLoai} />

      <div className="mb-2 mt-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">Đang chạy ({runFiltered.length}{runFiltered.length !== running.length ? `/${running.length}` : ''})</h3>
          <DateRangePicker value={ngayXnRun} onChange={setNgayXnRun} placeholder="Ngày xác nhận chạy" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={ngayRun} onChange={setNgayRun} placeholder="Ngày SX kế hoạch" />
          <Button chiXemOk variant="secondary" icon="download" onClick={doExcelRunning} disabled={!runFiltered.length}>
            Excel ({runFiltered.length})
          </Button>
        </div>
      </div>
      <DataTable columns={runCols} rows={runFiltered} loading={loading} rowKey="phieu_id" sttStart={0}
        subRows={subRows} rowClassName={(r) => slaRowClass(statusLenh(r.lenh_id))}
        onRowClick={(r) => setSel(r.lenh_id)} emptyText="Không có lệnh đang chạy" />

      <ChoChayModal open={choChayOpen} onClose={() => setChoChayOpen(false)} rows={candidates} loading={loading}
        chuyen={chuyen} canRun={canRun} statusLenh={statusLenh}
        onConfirm={openConfirm} onTraVe={(r) => { setTraVeReason(''); setTraVe(r); }}
        onTraVeGn={(r) => setGnLenh(r)} />

      <TraVeGnModal open={!!gnLenh} onClose={() => setGnLenh(null)} nguon="CHO_CHAY" lenhId={gnLenh?.id}
        phanIn={dsPhanInCuaLenh(gnLenh)[0] || null} dsPhanIn={dsPhanInCuaLenh(gnLenh)}
        onToast={(m) => show(m)} onDone={() => load(true)} />

      {/* Xác nhận thông tin chạy + chọn chuyền thực tế */}
      <Modal open={!!confirmRun} onClose={() => setConfirmRun(null)} title="Xác nhận thông tin chạy"
        footer={<>
          <Button chiXemOk variant="ghost" onClick={() => setConfirmRun(null)}>Hủy</Button>
          <Button onClick={doStart} loading={busy} disabled={!runChuyenId}>Bắt đầu chạy</Button>
        </>}>
        {confirmRun && (
          <div className="space-y-3">
            <div className="rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
              <div><b className="text-ink">{confirmRun.ten_khach_hang}</b> · {confirmRun.ma_don_hang}</div>
              <div>{confirmRun.ma_hang} · {confirmRun.mau_vai} · {confirmRun.kich_vai}/{confirmRun.kich_phim}</div>
              <div>Code phần: {confirmRun.ma_phan || '—'} · SL release: <b className="text-ink">{fmtNum(confirmRun.so_luong_release)}</b></div>
            </div>
            <Field label="Chuyền thực tế" required hint="Kế thừa chuyền kế hoạch — đổi nếu chạy chuyền khác">
              <ChuyenPicker chuyen={chuyen} value={runChuyenId} onChange={setRunChuyenId} />
            </Field>
          </div>
        )}
      </Modal>

      {/* Trả về Kỹ thuật — lý do bắt buộc (hiện lại ở màn READY / QC READY) */}
      <Modal open={!!traVe} onClose={() => setTraVe(null)} size="sm"
        title={`Trả về Kỹ thuật — ${traVe?.ma_lenh_san_xuat || ''}`}
        footer={<>
          <Button chiXemOk variant="ghost" onClick={() => setTraVe(null)}>Hủy</Button>
          <Button variant="danger" onClick={doTraVeKyThuat} loading={busy} disabled={!traVeReason.trim()}>
            Xác nhận trả về
          </Button>
        </>}>
        {traVe && (
          <div className="space-y-3">
            <div className="rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
              <div><b className="text-ink">{traVe.ten_khach_hang}</b> · {traVe.ma_don_hang}</div>
              <div>{traVe.ma_hang} · {traVe.mau_vai} · {traVe.kich_vai}/{traVe.kich_phim}</div>
              <div>Code phần: {traVe.ma_phan || '—'} · SL release: <b className="text-ink">{fmtNum(traVe.so_luong_release)}</b></div>
            </div>
            <p className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              Lệnh sẽ bị <b>HỦY</b>, phần in quay lại <b>READY</b>: hủy xác nhận Khuôn/Film/Mực + QC,
              kỹ thuật phải làm lại rồi Kế hoạch Release 1 lần nữa. Lý do sẽ hiện ở màn Chuẩn bị kỹ thuật.
              {Number(traVe.da_in_truoc) > 0 && (
                <> <b className="text-danger">Toàn bộ {fmtNum(traVe.da_in_truoc)} đã in trước đó (tem + phiếu) cũng bị hủy theo.</b></>
              )}
            </p>
            <Field label="Lý do trả về" required>
              <Textarea rows={3} value={traVeReason} onChange={(e) => setTraVeReason(e.target.value)}
                placeholder="Vì sao trả về kỹ thuật (vd: sai film, khuôn chưa đạt...)" />
            </Field>
          </div>
        )}
      </Modal>

      {sel && <RunPanel lenhId={sel} onClose={() => setSel(null)} onChanged={load}
        truocXacNhan={() => hoiLyDoNghen(rowsNghen.filter((r) => r.lenh_id === sel))} />}
      {/* Modal TOÀN MÀN HÌNH của 2 trang cũ — chỉ dựng component khi mở (2 trang có vòng tự làm mới 10–15s). */}
      <Modal open={moTrang === 'theo-doi-chuyen'} onClose={dongTrang} size="full" canhTren={8} title="Theo dõi chuyền in">
        {moTrang === 'theo-doi-chuyen' && <TheoDoiChuyenPage />}
      </Modal>
      <Modal open={moTrang === 'xe-phoi'} onClose={dongTrang} size="full" canhTren={8} title="Tình trạng xe phơi">
        {moTrang === 'xe-phoi' && <XePhoiPage />}
      </Modal>

      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="Xác nhận chạy" rows={rowsNghen} trangThai={(r) => statusLenh(r.lenh_id)} tenFile="nghen-xac-nhan-chay"
        maTrang="SX_CHO_CHAY" thoiGian={(r) => tgLenh(r.lenh_id)}
        chipTabs={LOAI_TABS} chipMacDinh={loai} hopChip={hopChipChuyen} />
      {lyDoNghenModal}
      <Toast toast={toast} />
    </div>
  );
}
