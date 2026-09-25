import { useCallback, useEffect, useMemo, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import ChipTabs from '../../../components/common/ChipTabs';
import DateRangePicker from '../../../components/common/DateRangePicker';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import { Field, Input, Select, Textarea } from '../../../components/common/controls';
import PhuongAnInBadge from '../../../components/common/PhuongAnInBadge';
import exportPanelExcel from '../../../components/common/exportPanelExcel';
import { fmtThoiLuong } from '../../../components/common/TraVeListModal';
import useToast from '../../../hooks/useToast';
import useNow from '../../../hooks/useNow';
import usePermissions from '../../../hooks/usePermissions';
import useSocketReload from '../../../hooks/useSocketReload';
import { fmtDate, fmtDateTime, fmtNum, ngayLocalISO } from '../../../utils/format';
import {
  listSuaThongTin, chiTietSuaThongTin, suaPhanInGn, suaDotVaiGn, xacNhanLaiGn,
} from '../../../services/suaThongTinService';

// ─────────────────────────────────────────────────────────────────────────────
// ĐƠN HÀNG › PHẦN IN CHỜ SỬA THÔNG TIN (25/09/2026, mig 105).
// Hàng đợi của GIAO NHẬN: phần in bị READY (Kỹ thuật hoặc QC) trả về vì thông tin sai. GN mở phần in,
// sửa đúng các trường bị đánh dấu rồi bấm "Xác nhận đã sửa" ⇒ phần in QUAY LẠI màn READY.
// ⚠ Sửa trường đi qua CHÍNH đường ghi của *Quản trị phần in* (whitelist cột + guard + audit) — backend
//   chỉ cho sửa khi phần in ĐANG chờ ở GN, nên trang này không thành cửa sau sửa phần in bất kỳ.
// ─────────────────────────────────────────────────────────────────────────────

const NGUON = { KT: 'READY Kỹ thuật', QC: 'QC chuẩn bị KT' };

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' },
  { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
  { key: 'thongTin', label: 'Thông tin sai', col: 'checklist_list' },
  { key: 'nguoi', label: 'Người trả về', col: 'nguoi_tra_ve' },
];

// Trường phần in GN sửa được — `ten` KHỚP tên mục ở danh mục backend (`utils/traVeGn.js`) để tô đậm
// đúng ô đã bị đánh dấu sai.
const TRUONG_PHAN_IN = [
  { k: 'mau_vai', ten: 'Màu vải' },
  { k: 'kich_vai', ten: 'Kích vải' },
  { k: 'kich_phim', ten: 'Kích phim' },
  { k: 'tinh_chat_in', ten: 'Tính chất in' },
  { k: 'mau_in', ten: 'Màu in' },
  { k: 'do_in', ten: 'Độ in' },
  { k: 'so_luong_don_hang', ten: 'Số lượng đơn hàng (SLĐH)', so: true },
  { k: 'barcode', ten: 'Mã vạch phần in (TDTHĐH)' },
  { k: 'thoi_gian_cho_kho_phut', ten: 'Thời gian chờ khô', so: true, hau: 'phút' },
  { k: 'la_in_kieng', ten: 'In kiếng', bool: true },
  { k: 'ghi_chu', ten: 'Ghi chú phần in', dai: true },
];
const TRUONG_DOT = [
  { k: 'so_luong_vai_ve', ten: 'Số lượng vải về', so: true },
  { k: 'han_giao_hang', ten: 'Hạn giao hàng', ngay: true },
  { k: 'ngay_vai_ve', ten: 'Ngày vải về', ngay: true },
  { k: 'loai_dot_vai_id', ten: 'Loại đợt vải', loai: true },
  { k: 'nha_gia_cong', ten: 'Nhà gia công' },
  { k: 'barcode', ten: 'Barcode đợt vải' },
  { k: 'ghi_chu', ten: 'Ghi chú đợt vải', dai: true },
];

const giaTriForm = (t, v) => {
  if (t.ngay) return ngayLocalISO(v);
  if (t.bool) return !!v;
  return v == null ? '' : String(v);
};
// Chỉ gửi trường THỰC SỰ đổi — gửi cả bộ thì audit ghi "đã sửa" cho cả những ô không ai đụng.
const patchDoi = (truong, goc, form) => {
  const p = {};
  truong.forEach((t) => {
    const cu = giaTriForm(t, goc[t.k]);
    if (form[t.k] !== cu) p[t.k] = form[t.k];
  });
  return p;
};

const soPhutCho = (r, now) => {
  const bd = new Date(r.tg_tra_ve).getTime();
  const kt = r.da_xu_ly ? new Date(r.tg_xu_ly).getTime() : now;
  return Number.isNaN(bd) || Number.isNaN(kt) ? null : (kt - bd) / 60000;
};

export default function SuaThongTinPage() {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const coQuyenSua = can('GN_SUA_THONG_TIN');
  const now = useNow(30000);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [trangThai, setTrangThai] = useState('CHO');
  // Hàng đợi ⇒ mặc định KHÔNG lọc ngày (lọc sẵn hôm nay sẽ giấu hàng trả về từ hôm trước mà GN chưa sửa).
  const [ngay, setNgay] = useState({ from: '', to: '' });
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [sel, setSel] = useState(null); // dòng đang mở
  const [xuat, setXuat] = useState(false);

  const load = useCallback(async (ngam = false) => {
    if (!ngam) setLoading(true);
    try {
      const r = await listSuaThongTin({ search, trangThai, tuNgay: ngay.from || '', denNgay: ngay.to || '' });
      setRows(r.data || []);
    } catch (e) {
      if (!ngam) show(e.message || 'Lỗi tải danh sách', 'error');
    } finally { if (!ngam) setLoading(false); }
  }, [search, trangThai, ngay.from, ngay.to, show]);

  useEffect(() => { const t = setTimeout(() => load(), 250); return () => clearTimeout(t); }, [load]);
  useSocketReload(['gn:updated'], () => load(true));

  const viewRows = useMemo(() => filterRows(rows, filters, FILTER_FIELDS), [rows, filters]);
  const soCho = rows.filter((r) => !r.da_xu_ly).length;

  const columns = [
    {
      key: 'da_xu_ly', header: 'Tình trạng',
      render: (r) => (r.da_xu_ly
        ? <Badge tone="success" className="whitespace-nowrap">Đã xác nhận lại</Badge>
        : <Badge tone="danger" className="whitespace-nowrap">Chờ sửa</Badge>),
    },
    { key: 'tg_tra_ve', header: 'Trả về lúc', render: (r) => <span className="whitespace-nowrap text-xs">{fmtDateTime(r.tg_tra_ve)}</span> },
    {
      key: 'cho', header: 'Đã chờ',
      render: (r) => (
        <span className={`whitespace-nowrap tabular-nums ${r.da_xu_ly ? 'text-ink-soft' : 'font-semibold text-danger'}`}>
          {fmtThoiLuong(soPhutCho(r, now))}
        </span>
      ),
    },
    { key: 'nguon', header: 'Trả về từ', render: (r) => <span className="text-xs">{NGUON[r.nguon] || '—'}</span> },
    {
      key: 'kh', header: 'Khách · Đơn',
      render: (r) => (<div><div>{r.ten_khach_hang}</div><div className="text-xs text-ink-soft">{r.ma_don_hang}</div></div>),
    },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'ma_phan', header: 'Code phần', render: (r) => <span className="font-medium">{r.ma_phan}</span> },
    {
      key: 'mau', header: 'Màu · Kích (vải/phim)',
      render: (r) => (<div><div>{r.mau_vai || '—'}</div><div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' / ')}</div></div>),
    },
    { key: 'pa', header: 'Phương án in', render: (r) => <PhuongAnInBadge value={r.phuong_an_in} /> },
    { key: 'so_luong_don_hang', header: 'SLĐH', className: 'text-right', render: (r) => fmtNum(r.so_luong_don_hang) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <span className="whitespace-nowrap text-xs">{r.han_giao_hang ? fmtDate(r.han_giao_hang) : '—'}</span> },
    {
      key: 'checklist_list', header: 'Thông tin sai',
      render: (r) => (
        <div className="flex max-w-[20rem] flex-wrap gap-1">
          {(r.checklist_list || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => (
            <Badge key={s} tone="warning">{s}</Badge>
          ))}
        </div>
      ),
    },
    { key: 'nguoi_tra_ve', header: 'Người trả về', render: (r) => <span className="whitespace-nowrap text-xs">{r.nguoi_tra_ve || '—'}</span> },
    {
      key: 'xn', header: 'Xác nhận lại',
      render: (r) => (r.da_xu_ly
        ? <div className="text-xs"><div>{r.nguoi_xu_ly || '—'}</div><div className="text-ink-soft">{fmtDateTime(r.tg_xu_ly)}</div></div>
        : <span className="text-ink-soft">—</span>),
    },
  ];

  const doXuat = async () => {
    setXuat(true);
    try {
      await exportPanelExcel({
        title: 'PHẦN IN CHỜ SỬA THÔNG TIN (READY TRẢ VỀ GIAO NHẬN)',
        subtitle: `${viewRows.length} lượt · xuất ${new Date().toLocaleString('vi-VN')}`,
        fileName: 'phan-in-cho-sua-thong-tin',
        rows: viewRows,
        cols: [
          { header: 'Tình trạng', width: 16, value: (r) => (r.da_xu_ly ? 'Đã xác nhận lại' : 'Chờ sửa'), red: (r) => !r.da_xu_ly, ok: (r) => r.da_xu_ly },
          { header: 'Trả về lúc', width: 18, value: (r) => fmtDateTime(r.tg_tra_ve) },
          { header: 'Đã chờ', width: 12, value: (r) => fmtThoiLuong(soPhutCho(r, now)) },
          { header: 'Trả về từ', width: 18, value: (r) => NGUON[r.nguon] || '' },
          { header: 'Khách hàng', value: (r) => r.ten_khach_hang },
          { header: 'Đơn hàng', value: (r) => r.ma_don_hang },
          { header: 'Mã hàng', value: (r) => r.ma_hang },
          { header: 'Code phần', width: 24, value: (r) => r.ma_phan },
          { header: 'Màu vải', value: (r) => r.mau_vai },
          { header: 'Kích vải', value: (r) => r.kich_vai },
          { header: 'Kích phim', value: (r) => r.kich_phim },
          { header: 'SLĐH', num: true, value: (r) => r.so_luong_don_hang },
          { header: 'Hạn giao', type: 'date', width: 12, value: (r) => r.han_giao_hang },
          { header: 'Thông tin sai', width: 30, value: (r) => r.checklist_list },
          { header: 'Lý do', width: 40, value: (r) => r.ly_do },
          { header: 'Người trả về', width: 20, value: (r) => r.nguoi_tra_ve },
          { header: 'Người xác nhận lại', width: 20, value: (r) => r.nguoi_xu_ly || '' },
          { header: 'Xác nhận lúc', width: 18, value: (r) => (r.tg_xu_ly ? fmtDateTime(r.tg_xu_ly) : '') },
          { header: 'Ghi chú GN', width: 30, value: (r) => r.ghi_chu_xac_nhan || '' },
        ],
      });
    } catch (e) { show(e.message || 'Xuất Excel thất bại', 'error'); } finally { setXuat(false); }
  };

  return (
    <div>
      <Toolbar
        title="Phần in chờ sửa thông tin"
        subtitle={`READY (Kỹ thuật / QC) trả về Giao nhận vì thông tin sai — sửa xong bấm xác nhận để phần in quay lại READY · ${soCho} đang chờ`}
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm code phần, khách, đơn, mã hàng, lý do..."
      >
        <DateRangePicker value={ngay} onChange={setNgay} placeholder="Ngày trả về" />
        <FilterToggle open={showFilters} count={Object.values(filters).filter((v) => (v || '').trim()).length}
          onClick={() => setShowFilters((v) => !v)} />
        <Button chiXemOk variant="secondary" icon="file-spreadsheet" loading={xuat} disabled={!viewRows.length} onClick={doXuat}>
          Excel ({viewRows.length})
        </Button>
      </Toolbar>

      <ChipTabs value={trangThai} onChange={setTrangThai} anSo
        tabs={[{ v: 'CHO', label: 'Đang chờ sửa' }, { v: 'DA', label: 'Đã xác nhận lại' }, { v: '', label: 'Tất cả' }]} />
      <FieldFilters fields={FILTER_FIELDS} values={filters} open={showFilters}
        onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} />

      <DataTable columns={columns} rows={viewRows} rowKey="id" loading={loading} onRowClick={(r) => setSel(r)}
        rowClassName={(r) => (r.da_xu_ly ? '' : 'bg-rose-50/40 dark:bg-rose-950/10')}
        emptyText={trangThai === 'CHO' ? 'Không có phần in nào đang chờ sửa thông tin 🎉' : 'Không có dữ liệu'} />

      {sel && (
        <SuaThongTinPanel phanInId={sel.phan_in_id} coQuyenSua={coQuyenSua} onToast={show}
          onClose={() => setSel(null)} onChanged={() => load(true)} />
      )}
      <Toast toast={toast} />
    </div>
  );
}

// ─── SIDEPANEL SỬA + XÁC NHẬN LẠI ─────────────────────────────────────────────
// ⚠ Khai ở MỨC MODULE (không lồng trong trang): trang chạy `useNow` ⇒ component lồng bị remount mỗi
//   lần cha render, ô input đang gõ sẽ mất focus (bẫy §9).
function SuaThongTinPanel({ phanInId, coQuyenSua, onToast, onClose, onChanged }) {
  const [ct, setCt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formPin, setFormPin] = useState({});
  const [formDot, setFormDot] = useState({});
  const [dangLuu, setDangLuu] = useState('');
  const [ghiChu, setGhiChu] = useState('');

  const tai = useCallback(async () => {
    setLoading(true);
    try {
      const r = await chiTietSuaThongTin(phanInId);
      const d = r.data;
      setCt(d);
      const fp = {}; TRUONG_PHAN_IN.forEach((t) => { fp[t.k] = giaTriForm(t, d.phan_in[t.k]); });
      setFormPin(fp);
      const fd = {};
      (d.dot_vai || []).forEach((dv) => { fd[dv.id] = {}; TRUONG_DOT.forEach((t) => { fd[dv.id][t.k] = giaTriForm(t, dv[t.k]); }); });
      setFormDot(fd);
    } catch (e) {
      onToast?.(e.message || 'Không tải được phần in', 'error');
    } finally { setLoading(false); }
  }, [phanInId, onToast]);

  useEffect(() => { tai(); }, [tai]);

  const dangCho = useMemo(() => ct?.tra_ve_dang_cho || [], [ct]);
  const choSua = dangCho.length > 0;
  const suaDuoc = coQuyenSua && choSua;
  // Tên các mục bị đánh dấu sai (gộp mọi lượt đang chờ) — để tô đậm đúng ô cần sửa.
  const danhDau = useMemo(() => new Set(dangCho.flatMap((x) => (x.checklist_list || '').split(',').map((s) => s.trim()))), [dangCho]);
  const dotSong = (ct?.dot_vai || []).filter((d) => !['DA_HUY', 'DA_GOP'].includes(d.trang_thai));

  const luuPin = async () => {
    const patch = patchDoi(TRUONG_PHAN_IN, ct.phan_in, formPin);
    if (!Object.keys(patch).length) { onToast?.('Chưa đổi thông tin nào của phần in', 'error'); return; }
    setDangLuu('pin');
    try {
      await suaPhanInGn(phanInId, patch);
      onToast?.('Đã lưu thông tin phần in');
      await tai(); onChanged?.();
    } catch (e) { onToast?.(e.message || 'Lưu thất bại', 'error'); } finally { setDangLuu(''); }
  };
  const luuDot = async (dv) => {
    const patch = patchDoi(TRUONG_DOT, dv, formDot[dv.id] || {});
    if (!Object.keys(patch).length) { onToast?.('Chưa đổi thông tin nào của đợt vải này', 'error'); return; }
    setDangLuu(dv.id);
    try {
      const r = await suaDotVaiGn(dv.id, patch);
      const pa = r.data?.phuong_an_in_moi;
      onToast?.(pa ? 'Đã lưu đợt vải — phương án in được tính lại theo sản lượng' : 'Đã lưu thông tin đợt vải');
      await tai(); onChanged?.();
    } catch (e) { onToast?.(e.message || 'Lưu thất bại', 'error'); } finally { setDangLuu(''); }
  };
  const xacNhan = async () => {
    // Còn ô đã sửa mà chưa bấm Lưu ⇒ nhắc, đừng để GN tưởng đã lưu rồi xác nhận mất công sửa.
    const chuaLuu = Object.keys(patchDoi(TRUONG_PHAN_IN, ct.phan_in, formPin)).length
      || dotSong.some((dv) => Object.keys(patchDoi(TRUONG_DOT, dv, formDot[dv.id] || {})).length);
    if (chuaLuu) { onToast?.('Còn thông tin đã sửa nhưng CHƯA bấm Lưu — lưu trước rồi mới xác nhận', 'error'); return; }
    setDangLuu('xn');
    try {
      await xacNhanLaiGn(phanInId, { ghiChu });
      onToast?.(`Đã xác nhận — ${ct.phan_in.ma_phan} quay lại READY`);
      onChanged?.(); onClose?.();
    } catch (e) { onToast?.(e.message || 'Xác nhận thất bại', 'error'); } finally { setDangLuu(''); }
  };

  const oNhap = (t, gt, doi, khoa) => {
    const nhan = <span className={danhDau.has(t.ten) ? 'font-bold text-danger' : ''}>{t.ten}{danhDau.has(t.ten) ? ' ⚠' : ''}</span>;
    let input;
    if (t.bool) {
      input = (
        <label className="flex h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={!!gt} disabled={!suaDuoc} onChange={(e) => doi(e.target.checked)} /> Có
        </label>
      );
    } else if (t.loai) {
      input = (
        <Select value={gt} disabled={!suaDuoc} onChange={(e) => doi(e.target.value)}>
          <option value="">— Chưa gán —</option>
          {(ct?.loai_dot_vai || []).map((l) => <option key={l.id} value={l.id}>{l.ten_loai}</option>)}
        </Select>
      );
    } else if (t.dai) {
      input = <Textarea rows={2} value={gt} disabled={!suaDuoc} onChange={(e) => doi(e.target.value)} />;
    } else {
      input = (
        <Input type={t.ngay ? 'date' : t.so ? 'number' : 'text'} value={gt} disabled={!suaDuoc}
          onChange={(e) => doi(e.target.value)} placeholder={t.hau || ''} />
      );
    }
    return (
      <div key={khoa} className={t.dai ? 'sm:col-span-2' : ''}>
        <Field label={nhan}>{input}</Field>
      </div>
    );
  };

  return (
    <SidePanel open onClose={onClose} width="max-w-3xl"
      title={ct?.phan_in ? `Sửa thông tin — ${ct.phan_in.ma_phan}` : 'Sửa thông tin phần in'}
      subtitle={ct?.phan_in ? [ct.phan_in.ten_khach_hang, ct.phan_in.ma_don_hang, ct.phan_in.ma_hang].filter(Boolean).join(' · ') : ''}
      footer={(
        <>
          <Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>
          {suaDuoc && (
            <Button icon="check" loading={dangLuu === 'xn'} onClick={xacNhan}>Xác nhận đã sửa — trả lại READY</Button>
          )}
        </>
      )}>
      {loading || !ct ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          {choSua ? dangCho.map((x) => (
            <div key={x.id} className="rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="text-xs font-semibold uppercase tracking-wide">{NGUON[x.nguon] || 'READY'} trả về · {fmtDateTime(x.tg_tra_ve)}{x.nguoi_tra_ve ? ` · ${x.nguoi_tra_ve}` : ''}</div>
              <div className="mt-1">{x.ly_do}</div>
            </div>
          )) : (
            <div className="rounded-control border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Phần in không còn chờ sửa — đã được xác nhận lại và quay về READY. Chỉ xem.
            </div>
          )}
          {choSua && !coQuyenSua && (
            <div className="text-xs text-ink-soft">Bạn không có quyền <b>GN_SUA_THONG_TIN</b> — chỉ xem.</div>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Thông tin phần in</h3>
              {suaDuoc && <Button variant="secondary" icon="save" loading={dangLuu === 'pin'} onClick={luuPin}>Lưu phần in</Button>}
            </div>
            <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-soft sm:grid-cols-4">
              <span>Khách: <b className="text-ink">{ct.phan_in.ten_khach_hang}</b></span>
              <span>Đơn: <b className="text-ink">{ct.phan_in.ma_don_hang}</b></span>
              <span>Mã hàng: <b className="text-ink">{ct.phan_in.ma_hang}</b></span>
              <span>Phương án in: <PhuongAnInBadge value={ct.phan_in.phuong_an_in} /></span>
            </div>
            <p className="mb-2 text-[11px] text-ink-soft">Khách hàng / đơn / mã hàng / code phần do ERP quản — sai thì sửa bên ERP rồi mới xác nhận lại.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TRUONG_PHAN_IN.map((t) => oNhap(t, formPin[t.k], (v) => setFormPin((f) => ({ ...f, [t.k]: v })), `pin-${t.k}`))}
            </div>
          </section>

          {dotSong.map((dv, i) => (
            <section key={dv.id} className="rounded-control border border-line p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Đợt vải {i + 1}/{dotSong.length}
                  <span className="ml-2 font-normal normal-case">
                    {dv.ngay_vai_ve ? `vải về ${fmtDate(dv.ngay_vai_ve)}` : ''}{dv.giai_doan_ten ? ` · ${dv.giai_doan_ten}` : ''}
                    {dv.ma_lenh_san_xuat ? ` · ${dv.ma_lenh_san_xuat}` : ''}
                  </span>
                </h3>
                {suaDuoc && <Button variant="secondary" icon="save" loading={dangLuu === dv.id} onClick={() => luuDot(dv)}>Lưu đợt vải</Button>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TRUONG_DOT.map((t) => oNhap(t, (formDot[dv.id] || {})[t.k],
                  (v) => setFormDot((f) => ({ ...f, [dv.id]: { ...(f[dv.id] || {}), [t.k]: v } })), `${dv.id}-${t.k}`))}
              </div>
            </section>
          ))}

          {suaDuoc && (
            <Field label="Ghi chú khi xác nhận (tùy chọn)">
              <Textarea rows={2} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)}
                placeholder="Đã sửa gì, theo xác nhận của ai..." />
            </Field>
          )}

          {(ct.lich_su || []).length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Lịch sử trả về GN ({ct.lich_su.length})</h3>
              <div className="space-y-1.5">
                {ct.lich_su.map((x) => (
                  <div key={x.id} className="rounded-control border border-line px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {x.da_xu_ly ? <Badge tone="success">Đã xác nhận lại</Badge> : <Badge tone="danger">Chờ sửa</Badge>}
                      <span>{fmtDateTime(x.tg_tra_ve)} · {NGUON[x.nguon] || 'READY'} · {x.nguoi_tra_ve || '—'}</span>
                    </div>
                    <div className="mt-1 text-ink">{x.ly_do}</div>
                    {x.da_xu_ly && (
                      <div className="mt-1 text-ink-soft">
                        GN xác nhận: {x.nguoi_xu_ly || '—'} · {fmtDateTime(x.tg_xu_ly)}{x.ghi_chu_xac_nhan ? ` · "${x.ghi_chu_xac_nhan}"` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </SidePanel>
  );
}
