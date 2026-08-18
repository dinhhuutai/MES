import { useEffect, useState, useCallback, useMemo } from 'react';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import GomBadge from '../../../components/common/GomBadge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import { Field, Input, Textarea } from '../../../components/common/controls';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useSocketReload from '../../../hooks/useSocketReload';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import {
  listProductionCandidates, startProduction, getMonitor, listChuyen, traVeKyThuatSanXuat,
} from '../../../services/productionService';
import { fmtNum, fmtDate, trongKhoangNgay } from '../../../utils/format';
import DateRangePicker from '../../../components/common/DateRangePicker';
import exportCheckpointExcel, { COT_LENH, moTaBoLoc } from '../../../utils/exportCheckpointExcel';
import ChipTabs from '../../../components/common/ChipTabs';
import { LOAI_TABS, hopChipChuyen, nhanChip, demChip, locSiSoTheoChip } from '../../../utils/khuChuyen';
import RunPanel from '../components/RunPanel';
import { khop } from '../../../utils/timKiem';

export default function XacNhanChayPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const { statusLenh } = useNghenMap();
  const canRun = can('PROD_RUN');

  const [candidates, setCandidates] = useState([]);
  const [nghenOpen, setNghenOpen] = useState(false); // modal "Danh sách nghẽn"
  const [running, setRunning] = useState([]);
  const [chuyen, setChuyen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ khach: '', don: '', maHang: '', mauVai: '', kichVai: '', kichPhim: '', chuyenId: '' });
  const [sel, setSel] = useState(null);
  const [confirmRun, setConfirmRun] = useState(null); // lệnh đang xác nhận chạy
  const [runChuyenId, setRunChuyenId] = useState('');
  const [traVe, setTraVe] = useState(null);           // lệnh đang trả về Kỹ thuật (lý do bắt buộc)
  const [traVeReason, setTraVeReason] = useState('');
  const [busy, setBusy] = useState(false);
  // Chip LOẠI CHUYỀN + KHU BÀN — cùng bộ với "Theo dõi chuyền" / "Test Run - QA".
  // Áp cho CẢ 2 bảng (Đang chạy & Chờ chạy) để 2 bảng luôn nói về cùng một nhóm chuyền.
  const [loai, setLoai] = useState('');

  // Dải "Theo dõi" (sĩ số) bám ô tìm + panel lọc + dải chip loại chuyền/khu + ô chọn CHUYỀN.
  // ⚠⚠ Ô lọc chuyền giữ `chuyenId` (UUID) — backend KHÔNG hiểu UUID, nó khớp theo `ma_chuyen`.
  //   Phải quy đổi, nếu không ô đó im lặng không tác dụng lên 4 con số.
  // ⚠ Chip khu bàn CŨNG đặt `maChuyen` (một DANH SÁCH mã) ⇒ khi cả hai cùng bật thì phải GIAO NHAU,
  //   không được để cái sau đè cái trước: chọn chuyền nằm ngoài khu đang lọc thì đúng ra bảng rỗng,
  //   nên gửi mã sentinel để khớp rỗng thay vì lặng lẽ bỏ một trong hai điều kiện.
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
  // Lọc theo NGÀY KẾ HOẠCH SẢN XUẤT (`lenh_san_xuat.ngay_ke_hoach`) — chọn được NHIỀU NGÀY bằng
  // cùng 1 ô như trang Hồ sơ kỹ thuật. ⚠ MỖI BẢNG MỘT Ô RIÊNG (khác chip loại chuyền vốn dùng
  // chung): 2 bảng trả lời 2 câu hỏi khác nhau — "hôm nay chuyền đang chạy hàng của ngày nào" và
  // "ngày mai xếp chạy những gì" — nên ép chung 1 khoảng ngày là bó tay người điều hành.
  // Mặc định RỖNG = không lọc; lọc sẵn "hôm nay" sẽ giấu hàng của ngày khác mà không ai biết vì sao.
  const [ngayRun, setNgayRun] = useState({ from: '', to: '' });
  const [ngayCand, setNgayCand] = useState({ from: '', to: '' });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // limit 200 = trần của `getPaging` (backend). Trang lọc + phân trang CLIENT nên phải tải-hết,
      // nếu không nút Excel chỉ xuất được phần đã tải.
      const [c, m] = await Promise.all([listProductionCandidates({ search, limit: 200 }), getMonitor()]);
      setCandidates(c.data.items);
      setRunning(m.data.running);
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
  // Tự tải lại khi SL release / sản xuất đổi ở nơi khác (vd cập nhật SL nhận vải / release ở Hệ thống).
  // ⚠ Tải NGẦM khi có sự kiện realtime: `load(true)` bỏ qua `setLoading(true)` (bảng không bị
  // thay bằng spinner) và KHÔNG xóa dòng đang tích. Nhiều sự kiện trong 400ms gộp thành 1 lần tải.
  useSocketReload(['production:updated', 'dashboard:refresh'], () => load(true));

  // Lọc client-side theo từng trường (kết hợp AND) + chuyền. Áp cho cả "Đang chạy" & "Chờ chạy".
  const selChuyen = useMemo(() => (chuyen || []).find((x) => x.id === filters.chuyenId) || null, [chuyen, filters.chuyenId]);
  const hasFilter = Object.values(filters).some(Boolean);
  const applyFilters = useCallback((rows) => {
    if (!hasFilter) return rows;
    const like = (v, q) => khop(v, q);
    const matchChuyen = (r) => {
      if (!filters.chuyenId || !selChuyen) return true;
      const names = [selChuyen.ten_chuyen, selChuyen.ma_chuyen].filter(Boolean).map((s) => s.toLowerCase());
      const rowVals = [r.ten_chuyen, r.ma_chuyen].filter(Boolean).map((s) => s.toLowerCase());
      return rowVals.some((rv) => names.includes(rv));
    };
    // Lệnh GOM SET: khớp nếu BẤT KỲ phần in nào trong lệnh khớp (nếu chỉ xét `r.*` thì chỉ so được
    // phần in ĐẦU TIÊN — lọc theo mã hàng của phần in thứ 2 sẽ làm mất cả lệnh).
    const khopPin = (r) => {
      const list = r.phan_in_list && r.phan_in_list.length ? r.phan_in_list : [r];
      return list.some((p) =>
        like(p.ten_khach_hang, filters.khach) && like(p.ma_don_hang, filters.don)
        && like(p.ma_hang, filters.maHang) && like(p.mau_vai, filters.mauVai)
        && like(p.kich_vai, filters.kichVai) && like(p.kich_phim, filters.kichPhim));
    };
    return (rows || []).filter((r) => khopPin(r) && matchChuyen(r));
  }, [filters, hasFilter, selChuyen]);
  // Chip loại chuyền chồng lên bộ lọc trường (AND).
  const locTheoChip = useCallback((rows) => (loai ? (rows || []).filter((r) => hopChipChuyen(r, loai)) : rows), [loai]);
  // Khoảng ngày kế hoạch — mỗi bảng dùng ô của riêng nó.
  const locNgay = useCallback((rows, ng) => (rows || []).filter((r) => trongKhoangNgay(r.ngay_ke_hoach, ng.from, ng.to)), []);
  const candFiltered = useMemo(() => locNgay(locTheoChip(applyFilters(candidates)), ngayCand),
    [applyFilters, locTheoChip, locNgay, candidates, ngayCand]);
  const runFiltered = useMemo(() => locNgay(locTheoChip(applyFilters(running)), ngayRun),
    [applyFilters, locTheoChip, locNgay, running, ngayRun]);
  // Nguồn cho "Danh sách nghẽn": GỘP cả 2 bảng, lấy tập ĐẦY ĐỦ (chưa lọc) — danh sách nghẽn là bức
  // tranh của cả trạm; muốn thu hẹp thì dùng ô tìm ngay trong modal.
  // ⚠ 2 bảng có thể trùng `lenh_id` không? Không — lệnh đang chạy đã có phiếu nên rời khỏi "chờ chạy";
  //   vẫn khử trùng theo `lenh_id` cho chắc, để 1 lệnh không bị đếm 2 lần trên nút.
  const rowsNghen = useMemo(() => {
    const m = new Map();
    [...(running || []), ...(candidates || [])].forEach((r) => {
      if (r && r.lenh_id && !m.has(r.lenh_id)) m.set(r.lenh_id, r);
    });
    return [...m.values()];
  }, [running, candidates]);
  // Số trên chip đếm trên tập ĐÃ qua bộ lọc trường + khoảng ngày (bỏ chip) để khớp với bảng đang xem.
  // Gộp cả 2 bảng: 1 dải chip điều khiển cả "Đang chạy" lẫn "Chờ chạy" — nhưng mỗi bảng vẫn trừ đi
  // theo khoảng ngày CỦA CHÍNH NÓ, nếu không số trên chip sẽ nhiều hơn tổng 2 bảng.
  const countChip = useMemo(
    () => demChip([...locNgay(applyFilters(running), ngayRun), ...locNgay(applyFilters(candidates), ngayCand)]),
    [applyFilters, locNgay, running, candidates, ngayRun, ngayCand]
  );
  const clearFilters = () => setFilters({ khach: '', don: '', maHang: '', mauVai: '', kichVai: '', kichPhim: '', chuyenId: '' });

  // Xuất Excel 2 bảng RIÊNG (đang chạy / chờ chạy) — theo đúng bộ lọc đang bật, hết mọi dòng.
  // `ng` = khoảng ngày CỦA BẢNG đang xuất (2 bảng có 2 ô ngày riêng) ⇒ phụ đề file nói đúng
  // bộ lọc đã tạo ra đúng file đó.
  const moTa = (ng) => moTaBoLoc({
    'tìm kiếm': search, khách: filters.khach, đơn: filters.don, 'mã hàng': filters.maHang,
    'màu vải': filters.mauVai, 'kích vải': filters.kichVai, 'kích phim': filters.kichPhim,
    chuyền: selChuyen ? (selChuyen.ten_chuyen || selChuyen.ma_chuyen) : '',
    'loại chuyền': nhanChip(loai),
    'ngày SX kế hoạch': [ng.from, ng.to].filter(Boolean).join(' → '),
  });
  // Bảng "Đang chạy" lấy từ `monitorRunning` — bộ cột KHÁC danh sách lệnh (không có tính chất in /
  // loại đợt vải / SL đơn hàng), nên khai riêng thay vì dùng COT_LENH cho có rồi để trống.
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
    ],
    rows: runFiltered, title: 'Đang sản xuất', fileName: 'dang-san-xuat', moTaLoc: moTa(ngayRun),
  });
  const doExcelCand = () => exportCheckpointExcel({
    cols: [...COT_LENH,
      { header: 'Đã in trước đó', width: 13, num: true, value: (r) => r.da_in_truoc || null }],
    rows: candFiltered, title: 'Đang chờ chạy', fileName: 'cho-chay', moTaLoc: moTa(ngayCand),
  });

  // Mở hộp xác nhận: kế thừa chuyền kế hoạch, cho đổi chuyền thực tế.
  const openConfirm = (lenh) => { setConfirmRun(lenh); setRunChuyenId(lenh.chuyen_id || ''); };

  const doStart = async () => {
    setBusy(true);
    try {
      await startProduction(confirmRun.id, runChuyenId || null);
      show('Đã xác nhận chạy — bắt đầu in & tạo tem');
      const startedId = confirmRun.id;
      setConfirmRun(null);
      setSel(startedId);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  // TRẢ VỀ KỸ THUẬT (chờ chạy): lệnh chưa in gì mà kỹ thuật phải làm lại ⇒ hủy lệnh + phần in quay
  // về READY. Cùng ý nghĩa với nút "Trả về Kỹ thuật" ở Release 1; lý do BẮT BUỘC, nhập trong Modal.
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

  // LỆNH GOM SET → tách 1 dòng / PHẦN IN (prop `subRows` của DataTable). Cột nào thuộc về LỆNH
  // (chuyền, SL release, ngày SX, trạng thái, nút thao tác) đánh `merge: true` để hợp nhất ô bằng
  // rowSpan — cùng với STT. Cột thuộc PHẦN IN (khách/đơn/mã hàng/code phần/màu/kích/hạn giao) hiện
  // theo từng dòng. Backend chỉ gắn `phan_in_list` khi lệnh có >1 phần in ⇒ lệnh thường không đổi gì.
  const subRows = (r) => (r.phan_in_list ? r.phan_in_list.map((p) => ({ ...p, __sub: true })) : null);

  const candCols = [
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => (
      <div>
        <div className="text-ink">{r.ma_hang || '—'}</div>
        {/* Badge mức LỆNH → chỉ vẽ ở dòng đầu (`__sub` do `subRows` gắn cho dòng con). */}
        {!r.__sub && r.giai_doan === 'EP_UI' && <Badge tone="info">Ép ủi (in kiếng)</Badge>}
        {!r.__sub && <GomBadge soDotVai={r.so_dot_vai} soPhanIn={r.so_phan_in} />}
        {!r.__sub && Number(r.da_in_truoc) > 0 && (
          <div className="mt-0.5">
            <Badge tone="warning">
              Đã in {fmtNum(r.da_in_truoc)}{r.tg_ngung ? ` · ngừng ${new Date(r.tg_ngung).toLocaleString('vi-VN')}` : ''} → in tiếp
            </Badge>
          </div>
        )}
      </div>
    ) },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'ma_chuyen', header: 'Chuyền', merge: true, render: (r) => r.ten_chuyen || '—' },
    // Nhà gia công (ERP NGC, mig 072) — mức LỆNH nên `merge` như các cột lệnh khác.
    { key: 'nha_gia_cong', header: 'Nhà gia công', merge: true, render: (r) => r.nha_gia_cong || '—' },
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', merge: true, render: (r) => fmtNum(r.so_luong_release) },
    { key: 'ngay_ke_hoach', header: 'Ngày SX KH', merge: true, render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    // 2 nút xếp CHỒNG (cột dọc): "Xác nhận chạy" ở trên, "Trả về Kỹ thuật" ngay dưới.
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', merge: true, render: (r) =>
      canRun && (
        <div className="flex flex-col items-stretch gap-1">
          <Button className="px-2.5 py-1 text-xs" onClick={() => openConfirm(r)}>Xác nhận chạy</Button>
          <Button variant="secondary" className="px-2.5 py-1 text-xs"
            onClick={() => { setTraVeReason(''); setTraVe(r); }}>Trả về Kỹ thuật</Button>
        </div>
      ) },
  ];

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
    // Hiện luôn cột đang được lọc (bảng "Chờ chạy" vốn đã có). Mức LỆNH ⇒ `merge` như các cột lệnh khác.
    { key: 'ngay_ke_hoach', header: 'Ngày SX KH', merge: true, render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'printed', header: 'Đã in', className: 'text-right tabular-nums', merge: true, render: (r) => `${fmtNum(r.printed)} / ${fmtNum(r.target)}` },
    { key: 'so_tem', header: 'Tem', className: 'text-right', merge: true },
    { key: 'tt', header: 'Trạng thái', merge: true, render: (r) =>
      r.dang_ngung ? <Badge tone="danger">Đang ngừng</Badge> : <Badge tone="success">Đang chạy</Badge> },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', merge: true, render: (r) =>
      <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setSel(r.lenh_id)}>Mở</Button> },
  ];

  return (
    <div>
      <Toolbar title="Xác nhận chạy" subtitle="Lệnh đã Release 2 — chọn chuyền thực tế & bắt đầu in"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, mã hàng, màu/kích, đơn hàng...">
        <Button variant={showFilter || hasFilter ? 'secondary' : 'ghost'} icon="filter" onClick={() => setShowFilter((v) => !v)}>
          Bộ lọc{hasFilter ? ' ●' : ''}
        </Button>
        {/* ⚠ Gộp CẢ 2 bảng "Đang chạy" + "Chờ chạy" — màn này điều hành cả hai, tách ra thì người
            dùng phải mở 2 danh sách nghẽn cho cùng một việc. */}
        <NghenButton rows={rowsNghen} trangThai={(r) => statusLenh(r.lenh_id)} onClick={() => setNghenOpen(true)} />
      </Toolbar>

      {showFilter && (
        <div className="mb-4 rounded-card border border-line bg-surface p-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Khách hàng"><Input value={filters.khach} onChange={(e) => setFilters({ ...filters, khach: e.target.value })} placeholder="Lọc khách..." /></Field>
            <Field label="Đơn hàng"><Input value={filters.don} onChange={(e) => setFilters({ ...filters, don: e.target.value })} placeholder="Lọc đơn..." /></Field>
            <Field label="Mã hàng"><Input value={filters.maHang} onChange={(e) => setFilters({ ...filters, maHang: e.target.value })} placeholder="Lọc mã hàng..." /></Field>
            <Field label="Màu vải"><Input value={filters.mauVai} onChange={(e) => setFilters({ ...filters, mauVai: e.target.value })} placeholder="Lọc màu..." /></Field>
            <Field label="Kích vải"><Input value={filters.kichVai} onChange={(e) => setFilters({ ...filters, kichVai: e.target.value })} placeholder="Lọc kích vải..." /></Field>
            <Field label="Kích phim"><Input value={filters.kichPhim} onChange={(e) => setFilters({ ...filters, kichPhim: e.target.value })} placeholder="Lọc kích phim..." /></Field>
            <Field label="Chuyền">
              <select value={filters.chuyenId} onChange={(e) => setFilters({ ...filters, chuyenId: e.target.value })}
                className="h-9 w-full rounded-input border border-line bg-surface px-2 text-sm">
                <option value="">Tất cả chuyền</option>
                {(chuyen || []).map((c) => <option key={c.id} value={c.id}>{c.ten_chuyen || c.ma_chuyen}</option>)}
              </select>
            </Field>
          </div>
          {hasFilter && (
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-danger">
                <Icon name="x" size={14} /> Xóa lọc
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chip LOẠI CHUYỀN + KHU BÀN — cùng bộ với "Theo dõi chuyền" / "Test Run - QA",
          điều khiển CẢ 2 bảng bên dưới. */}
      <ChipTabs tabs={LOAI_TABS} value={loai} counts={countChip} onChange={setLoai} />

      {/* Ô lọc ngày kế hoạch nằm THẲNG HÀNG với title của bảng — mỗi bảng một ô riêng.
          `/tổng` hiện khi đang lọc: so số dòng thay vì liệt kê từng bộ lọc, thêm bộ lọc mới
          về sau cũng không phải sửa lại chỗ này. */}
      <div className="mb-2 mt-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">Đang chạy ({runFiltered.length}{runFiltered.length !== running.length ? `/${running.length}` : ''})</h3>
          <DateRangePicker value={ngayRun} onChange={setNgayRun} placeholder="Ngày SX kế hoạch" />
        </div>
        <Button variant="secondary" icon="download" onClick={doExcelRunning} disabled={!runFiltered.length}>
          Excel ({runFiltered.length})
        </Button>
      </div>
      <DataTable columns={runCols} rows={runFiltered} loading={loading} rowKey="phieu_id" sttStart={0}
        subRows={subRows} rowClassName={(r) => slaRowClass(statusLenh(r.lenh_id))}
        onRowClick={(r) => setSel(r.lenh_id)} emptyText="Không có lệnh đang chạy" />

      <div className="mb-2 mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">Chờ chạy ({candFiltered.length}{candFiltered.length !== candidates.length ? `/${candidates.length}` : ''})</h3>
          <DateRangePicker value={ngayCand} onChange={setNgayCand} placeholder="Ngày SX kế hoạch" />
        </div>
        <Button variant="secondary" icon="download" onClick={doExcelCand} disabled={!candFiltered.length}>
          Excel ({candFiltered.length})
        </Button>
      </div>
      <DataTable columns={candCols} rows={candFiltered} loading={loading} sttStart={0}
        subRows={subRows} rowClassName={(r) => slaRowClass(statusLenh(r.id))}
        emptyText="Không có lệnh nào chờ chạy" />

      {/* Xác nhận thông tin chạy + chọn chuyền thực tế */}
      <Modal open={!!confirmRun} onClose={() => setConfirmRun(null)} title="Xác nhận thông tin chạy"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmRun(null)}>Hủy</Button>
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
          <Button variant="ghost" onClick={() => setTraVe(null)}>Hủy</Button>
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
              {/* Lệnh "chờ chạy" vẫn có thể đã in tem ở lượt trước (bị Ngừng lệnh chạy) — nói rõ trước khi bấm. */}
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

      {sel && <RunPanel lenhId={sel} onClose={() => setSel(null)} onChanged={load} />}
      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="Xác nhận chạy" rows={rowsNghen} trangThai={(r) => statusLenh(r.lenh_id)} tenFile="nghen-xac-nhan-chay" />
      <Toast toast={toast} />
    </div>
  );
}
