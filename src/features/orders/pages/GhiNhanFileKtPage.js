import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import ChipTabs from '../../../components/common/ChipTabs';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import SidePanel from '../../../components/common/SidePanel';
import DateRangePicker from '../../../components/common/DateRangePicker';
import HuyLyDoModal from '../../../components/common/HuyLyDoModal';
import QrScanner from '../../../components/common/QrScanner';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useSocketReload from '../../../hooks/useSocketReload';
import { fmtDateTime, fmtNum } from '../../../utils/format';
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';
import exportPanelExcel from '../../../components/common/exportPanelExcel';
import {
  listQuetFileKt, listPhanInFileKt, quetFileKt, huyQuetFileKt, ghepLaiFileKt,
} from '../../../services/fileKtService';

// ─────────────────────────────────────────────────────────────────────────────
// GHI NHẬN FILE PHẦN IN XUỐNG PHÒNG KỸ THUẬT (17/11/2026, mig 136) — trang Đơn hàng › Ghi nhận file xuống KT.
// Phòng bán hàng đưa file (HSKT / Bảng TDTHĐH) xuống Phòng KT ⇒ quét mã vạch trên giấy ⇒ giờ quét = THỜI GIAN THỰC TẾ.
//   Mã chưa có phần in trên MES ⇒ lưu TẠM (Chờ ghép), đồng bộ ERP đưa phần in lên thì hệ thống TỰ GHÉP (BE `modules/filekt`).
// · Máy quét cầm tay = bàn phím + Enter ⇒ ô quét luôn giữ con trỏ, quét liên tục được (hàng đợi `chuoi` — gửi tuần tự).
// · Quyền quét / hủy / ghép lại: `FILE_KT_GHI_NHAN`; `ORDER_VIEW` chỉ xem.
// ─────────────────────────────────────────────────────────────────────────────

const LIMIT = 20;
const LOAI = { TDTHDH: 'Bảng TDTHĐH', HSKT: 'HSKT', CODE_PHAN: 'Code phần' };
const TT = { CHO_GHEP: ['Chờ ghép', 'warning'], DA_GHEP: ['Đã ghép', 'success'], HUY: ['Đã hủy', 'danger'] };
const TAB = [{ v: 'quet', label: 'Lịch sử quét' }, { v: 'phan_in', label: 'Theo phần in' }];
const CHIP_TT = [{ v: '', label: 'Tất cả' }, { v: 'CHO_GHEP', label: 'Chờ ghép (tạm)' }, { v: 'DA_GHEP', label: 'Đã ghép' }, { v: 'HUY', label: 'Đã hủy' }];

const ttBadge = (v) => { const [ten, tone] = TT[v] || [v || '—', 'default']; return <Badge tone={tone}>{ten}</Badge>; };
const chu = (v) => (v == null || v === '' ? '—' : v);
const moTaPin = (p) => [p.ten_khach_hang, p.ma_don_hang, p.ma_hang].filter(Boolean).join(' · ');

// Khoảng thời gian dễ đọc: "2 ngày 3 giờ" · "5 giờ 10 phút" · "12 phút".
function khoang(ms) {
  const phut = Math.round(Math.abs(ms) / 60000);
  const ngay = Math.floor(phut / 1440); const gio = Math.floor((phut % 1440) / 60); const p = phut % 60;
  if (ngay) return `${ngay} ngày${gio ? ` ${gio} giờ` : ''}`;
  if (gio) return `${gio} giờ${p ? ` ${p} phút` : ''}`;
  return `${p} phút`;
}
// File xuống KT so với lúc phần in lên MES.
function soVoiLenMes(r) {
  if (!r.tg_file_kt || !r.tg_len_mes) return '—';
  const d = new Date(r.tg_file_kt) - new Date(r.tg_len_mes);
  if (Math.abs(d) < 60000) return 'cùng lúc';
  return d < 0 ? `trước khi lên MES ${khoang(d)}` : `sau khi lên MES ${khoang(d)}`;
}

function DsPhanInNgan({ r }) {
  const ds = r.phan_in || [];
  if (!ds.length) {
    return r.trang_thai === 'HUY' ? <span className="text-ink-soft">—</span>
      : <span className="text-xs text-amber-700 dark:text-amber-400">Chưa có phần in khớp — chờ phần in lên MES</span>;
  }
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-ink">
        {ds.slice(0, 2).map((p) => p.ma_phan).join(', ')}
        {r.so_phan_in > 2 && <span className="text-ink-soft"> +{r.so_phan_in - 2}</span>}
      </div>
      <div className="truncate text-xs text-ink-soft">{moTaPin(ds[0]) || '—'}</div>
    </div>
  );
}

// Thẻ kết quả 1 lượt vừa quét (khối "Vừa quét").
function TheVuaQuet({ k }) {
  if (k.loi) {
    return (
      <li className="rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-sm dark:border-rose-900 dark:bg-rose-950/20">
        <span className="font-mono font-medium text-ink">{k.ma}</span> <span className="text-danger">— {k.loi}</span>
      </li>
    );
  }
  const ds = k.phan_in || [];
  const lanDau = (k.quet_truoc || [])[0];
  return (
    <li className={`rounded-control border px-3 py-2 text-sm ${ds.length ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-amber-300/70 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular-nums text-xs text-ink-soft">{fmtDateTime(k.tg_quet)}</span>
        <span className="font-mono font-medium text-ink">{k.ma_quet}</span>
        <Badge>{LOAI[k.loai_ma] || k.loai_ma}</Badge>
        {ds.length ? <Badge tone="success">Khớp {ds.length} phần in</Badge> : <Badge tone="warning">Lưu tạm — chờ phần in lên MES</Badge>}
      </div>
      {ds.length > 0 && (
        <div className="mt-1 text-xs text-ink-soft">
          {ds.slice(0, 6).map((p) => p.ma_phan).join(', ')}{ds.length > 6 ? ` … +${ds.length - 6}` : ''}
          {moTaPin(ds[0]) ? ` · ${moTaPin(ds[0])}` : ''}
        </div>
      )}
      {lanDau && (
        <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Mã này đã quét {k.quet_truoc.length} lần trước — lần đầu {fmtDateTime(lanDau.tg_quet)}{lanDau.nguoi ? ` (${lanDau.nguoi})` : ''}.
          Giờ file xuống KT vẫn tính theo lần đầu.
        </div>
      )}
    </li>
  );
}

export default function GhiNhanFileKtPage() {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const coGhi = can('FILE_KT_GHI_NHAN');

  const [tab, setTab] = useState('quet');
  const [search, setSearch] = useState('');
  const [ngay, setNgay] = useState({ from: '', to: '' });
  const [trangThai, setTrangThai] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [dem, setDem] = useState({});
  const [loading, setLoading] = useState(true);
  const [chuaMig, setChuaMig] = useState(false);
  const [chiTiet, setChiTiet] = useState(null);
  const [huyDong, setHuyDong] = useState(null);
  const [dangXuat, setDangXuat] = useState(false);
  const [dangGhep, setDangGhep] = useState(false);

  // ─── Ô QUÉT ───────────────────────────────────────────────────────────────
  const [ma, setMa] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [cam, setCam] = useState(false);
  const [vuaQuet, setVuaQuet] = useState([]);   // kết quả các lượt quét trong phiên (mới nhất trước, tối đa 15)
  const [dangGui, setDangGui] = useState(0);
  const oQuet = useRef(null);
  const chuoi = useRef(Promise.resolve());

  const thamSo = useCallback((p = {}) => ({
    search, tuNgay: ngay.from || '', denNgay: ngay.to || '', ...(tab === 'quet' ? { trangThai } : {}), ...p,
  }), [search, ngay, tab, trangThai]);
  const fetcher = tab === 'quet' ? listQuetFileKt : listPhanInFileKt;

  const load = useCallback(async (ngam = false) => {
    if (!ngam) setLoading(true);
    try {
      const res = await fetcher(thamSo({ page, limit: LIMIT }));
      const d = res.data || {};
      setRows(d.items || []);
      setMeta(d.meta || { page: 1, totalPages: 1, total: 0 });
      if (tab === 'quet') setDem(d.dem || {});
      setChuaMig(!!d.chua_migration);
    } catch (e) { if (!ngam) show(e.message || 'Lỗi tải danh sách', 'error'); }
    finally { if (!ngam) setLoading(false); }
  }, [fetcher, thamSo, page, tab, show]);

  useEffect(() => { const t = setTimeout(() => load(), 250); return () => clearTimeout(t); }, [load]);
  useSocketReload(['filekt:updated', 'order:updated'], () => load(true), 800);

  const xuLyQuet = useCallback(async (raw, gc) => {
    const m = String(raw || '').trim();
    if (!m) return;
    setDangGui((n) => n + 1);
    try {
      const res = await quetFileKt(m, gc);
      setVuaQuet((ds) => [{ ...res.data, khoa: res.data.id }, ...ds].slice(0, 15));
    } catch (e) {
      setVuaQuet((ds) => [{ khoa: `${Date.now()}-${m}`, ma: m, loi: e.message || 'Lỗi ghi nhận' }, ...ds].slice(0, 15));
    } finally {
      setDangGui((n) => n - 1);
    }
  }, []);
  // Hàng đợi: máy quét bắn nhiều mã liền nhau ⇒ gửi TUẦN TỰ, không mất mã, ô quét không khóa.
  const guiQuet = (raw) => {
    const m = String(raw || '').trim();
    if (!m) return;
    const gc = ghiChu.trim();
    chuoi.current = chuoi.current.then(() => xuLyQuet(m, gc));
    setMa('');
    setTimeout(() => oQuet.current && oQuet.current.focus(), 0);
  };
  useEffect(() => { if (coGhi && !chuaMig && oQuet.current) oQuet.current.focus(); }, [coGhi, chuaMig]);

  const doiTab = (v) => { setTab(v); setPage(1); setRows([]); };
  const datLoc = (fn) => { fn(); setPage(1); };

  const ghepLai = async () => {
    setDangGhep(true);
    try { const r = await ghepLaiFileKt(); show(r.message || 'Đã ghép lại'); load(true); }
    catch (e) { show(e.message || 'Ghép lại thất bại', 'error'); }
    finally { setDangGhep(false); }
  };

  const huy = async (r, lyDo) => {
    try {
      await huyQuetFileKt(r.id, lyDo);
      show(`Đã hủy lượt quét ${r.ma_quet}`);
      setHuyDong(null); setChiTiet(null); load(true);
    } catch (e) { show(e.message || 'Hủy thất bại', 'error'); throw e; }
  };

  const xuatExcel = async () => {
    setDangXuat(true);
    try {
      const { items, thieu, total } = await taiHetTrang((p) => fetcher(thamSo(p)), { limit: LIMIT_TAI_LON });
      if (thieu) show(`Chỉ tải được ${items.length}/${total} dòng — hãy thu hẹp bằng bộ lọc`, 'error');
      const loc = [search && `tìm "${search}"`, (ngay.from || ngay.to) && `ngày ${ngay.from || '…'} → ${ngay.to || '…'}`,
        tab === 'quet' && trangThai && (TT[trangThai] || [])[0]].filter(Boolean).join(' · ');
      if (tab === 'quet') {
        await exportPanelExcel({
          title: 'LỊCH SỬ QUÉT FILE XUỐNG PHÒNG KT', subtitle: loc || undefined, fileName: 'ghi-nhan-file-kt-lich-su', rows: items,
          cols: [
            { header: 'Giờ quét', width: 20, value: (r) => (r.tg_quet ? new Date(r.tg_quet).toLocaleString('vi-VN') : '') },
            { header: 'Mã quét', width: 18, value: (r) => r.ma_quet },
            { header: 'Loại mã', width: 14, value: (r) => LOAI[r.loai_ma] || r.loai_ma },
            { header: 'Trạng thái', width: 14, value: (r) => (TT[r.trang_thai] || [r.trang_thai])[0] },
            { header: 'Số phần in', width: 11, value: (r) => r.so_phan_in },
            { header: 'Code phần', width: 50, value: (r) => (r.phan_in || []).map((p) => p.ma_phan).join(', ') },
            { header: 'Khách · Đơn · Mã hàng', width: 40, value: (r) => moTaPin((r.phan_in || [])[0] || {}) },
            { header: 'Người quét', width: 22, value: (r) => r.nguoi_quet || '' },
            { header: 'Ghép lúc', width: 20, value: (r) => (r.tg_ghep ? new Date(r.tg_ghep).toLocaleString('vi-VN') : '') },
            { header: 'Ghi chú', width: 30, value: (r) => r.ghi_chu || '' },
            { header: 'Lý do hủy', width: 30, value: (r) => r.ly_do_huy || '' },
          ],
        });
      } else {
        await exportPanelExcel({
          title: 'THỜI GIAN FILE PHẦN IN XUỐNG PHÒNG KT', subtitle: loc || undefined, fileName: 'ghi-nhan-file-kt-phan-in', rows: items,
          cols: [
            { header: 'Code phần', width: 26, value: (r) => r.ma_phan },
            { header: 'Màu mực', width: 14, value: (r) => r.mau_in || '' },
            { header: 'Khách hàng', width: 22, value: (r) => r.ten_khach_hang || '' },
            { header: 'Đơn hàng', width: 16, value: (r) => r.ma_don_hang || '' },
            { header: 'Mã hàng', width: 22, value: (r) => r.ma_hang || '' },
            { header: 'Màu vải', width: 18, value: (r) => r.mau_vai || '' },
            { header: 'File xuống KT', width: 20, value: (r) => (r.tg_file_kt ? new Date(r.tg_file_kt).toLocaleString('vi-VN') : '') },
            { header: 'Mã quét đầu', width: 16, value: (r) => (r.luot_dau && r.luot_dau.ma_quet) || '' },
            { header: 'Người quét đầu', width: 22, value: (r) => (r.luot_dau && r.luot_dau.nguoi) || '' },
            { header: 'Lên MES', width: 20, value: (r) => (r.tg_len_mes ? new Date(r.tg_len_mes).toLocaleString('vi-VN') : '') },
            { header: 'So với lên MES', width: 26, value: (r) => soVoiLenMes(r) },
            { header: 'Số lượt quét', width: 12, value: (r) => r.so_luot },
          ],
        });
      }
    } catch (e) { show(e.message || 'Xuất Excel thất bại', 'error'); }
    finally { setDangXuat(false); }
  };

  const cotQuet = [
    { key: 'tg_quet', header: 'Giờ quét', render: (r) => <span className="whitespace-nowrap tabular-nums">{fmtDateTime(r.tg_quet)}</span> },
    { key: 'ma_quet', header: 'Mã quét', render: (r) => (
      <div className="min-w-0">
        <div className="font-mono font-medium text-ink">{r.ma_quet}</div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-ink-soft">
          {LOAI[r.loai_ma] || r.loai_ma}
          {r.so_lan_quet_ma > 1 && <span className="text-amber-700 dark:text-amber-400">· quét {r.so_lan_quet_ma} lần</span>}
        </div>
      </div>
    ) },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) => ttBadge(r.trang_thai) },
    { key: 'phan_in', header: 'Phần in khớp', render: (r) => <DsPhanInNgan r={r} /> },
    { key: 'nguoi_quet', header: 'Người quét', render: (r) => chu(r.nguoi_quet) },
    { key: 'tg_ghep', header: 'Ghép lúc', render: (r) => {
      if (!r.tg_ghep) return <span className="text-ink-soft">—</span>;
      const tuDong = (r.phan_in || []).some((p) => p.cach_ghep === 'TU_DONG');
      return (
        <div className="whitespace-nowrap text-xs">
          <div className="tabular-nums text-ink">{fmtDateTime(r.tg_ghep)}</div>
          {tuDong && <div className="text-ink-soft">tự ghép khi phần in lên MES</div>}
        </div>
      );
    } },
    ...(coGhi ? [{ key: '_tt', header: '', className: 'text-right whitespace-nowrap', render: (r) => (r.trang_thai === 'HUY' ? null : (
      <Button variant="ghost" className="px-2.5 py-1 text-xs text-danger" title="Hủy lượt quét nhầm (nhập lý do)"
        onClick={(e) => { e.stopPropagation(); setHuyDong(r); }}>Hủy</Button>
    )) }] : []),
  ];

  const cotPhanIn = [
    { key: 'ma_phan', header: 'Code phần', render: (r) => (
      <div className="min-w-0">
        <Link to={`/don-hang/lich-su-phan-in?id=${r.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{r.ma_phan}</Link>
        {r.mau_in && <div className="truncate text-xs text-ink-soft">mực {r.mau_in}</div>}
      </div>
    ) },
    { key: 'kh', header: 'Khách · Đơn', render: (r) => (
      <div className="min-w-0"><div className="truncate text-ink">{chu(r.ten_khach_hang)}</div><div className="truncate text-xs text-ink-soft">{chu(r.ma_don_hang)}</div></div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => chu(r.ma_hang) },
    { key: 'mau', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="min-w-0"><div className="truncate text-ink">{chu(r.mau_vai)}</div><div className="truncate text-xs text-ink-soft">{chu(r.kich_vai)} / {chu(r.kich_phim)}</div></div>
    ) },
    { key: 'tg_file_kt', header: 'File xuống KT', render: (r) => (
      <div className="whitespace-nowrap">
        <div className="font-medium tabular-nums text-ink">{fmtDateTime(r.tg_file_kt)}</div>
        {r.luot_dau && (
          <div className="text-xs text-ink-soft">{[r.luot_dau.nguoi, LOAI[r.luot_dau.loai_ma] || r.luot_dau.loai_ma].filter(Boolean).join(' · ')}</div>
        )}
      </div>
    ) },
    { key: 'tg_len_mes', header: 'Lên MES', render: (r) => <span className="whitespace-nowrap tabular-nums text-ink-soft">{fmtDateTime(r.tg_len_mes)}</span> },
    { key: 'so_sanh', header: 'So với lên MES', render: (r) => <span className="whitespace-nowrap text-xs text-ink-soft">{soVoiLenMes(r)}</span> },
    { key: 'so_luot', header: 'Lượt quét', className: 'text-right tabular-nums', headerClassName: 'text-right', render: (r) => fmtNum(r.so_luot) },
  ];

  return (
    <div>
      <Toolbar title="Ghi nhận file xuống Phòng KT" search={search} onSearch={(v) => datLoc(() => setSearch(v))}
        searchPlaceholder="Mã quét · code phần · đơn · mã hàng · khách · người quét">
        {coGhi && (
          <Button variant="secondary" icon="rotate-cw" loading={dangGhep} disabled={chuaMig} onClick={ghepLai}
            title="Ghép lại các lượt quét đang chờ với phần in đã lên MES (bình thường hệ thống tự ghép sau mỗi lượt đồng bộ ERP)">Ghép lại</Button>
        )}
        <Button chiXemOk variant="secondary" icon="download" loading={dangXuat} disabled={!meta.total} onClick={xuatExcel}>Excel ({fmtNum(meta.total)})</Button>
      </Toolbar>

      {chuaMig && (
        <div className="mb-3 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          Chưa chạy migration 136 (<code>database/migrations/136_ghi_nhan_file_kt.sql</code>) — chưa quét được.
        </div>
      )}

      {coGhi && !chuaMig && (
        <div className="mb-4 rounded-card border border-line bg-surface p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[16rem] flex-1">
              <Icon name="barcode" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input ref={oQuet} value={ma} onChange={(e) => setMa(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guiQuet(ma); } }}
                placeholder="Quét mã vạch trên HSKT / Bảng TDTHĐH (hoặc gõ mã rồi Enter)"
                className="h-11 w-full rounded-input border border-line bg-surface pl-10 pr-3 font-mono text-base outline-none focus:border-primary" />
            </div>
            <Button variant="secondary" icon="scan-line" onClick={() => setCam(true)}>Quét camera</Button>
            <Button onClick={() => guiQuet(ma)} disabled={!ma.trim()}>Ghi nhận</Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} maxLength={500}
              placeholder="Ghi chú cho các lượt quét tiếp theo (tùy chọn, vd: người đưa file)"
              className="h-9 min-w-[16rem] flex-1 rounded-input border border-line bg-surface px-3 text-sm outline-none focus:border-primary" />
            {dangGui > 0 && <span className="text-xs text-ink-soft">Đang ghi {dangGui} mã…</span>}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Giờ quét = thời gian thực tế file xuống Phòng KT. Mã HSKT ghép mọi code phần của hồ sơ; mã chưa có phần in trên MES được
            lưu tạm và tự ghép khi phần in lên MES.
          </p>
          {vuaQuet.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink">
                <span>Vừa quét (phiên này)</span>
                <button type="button" className="font-normal text-ink-soft hover:text-primary" onClick={() => setVuaQuet([])}>Xóa danh sách</button>
              </div>
              <ul className="space-y-1.5">{vuaQuet.map((k) => <TheVuaQuet key={k.khoa} k={k} />)}</ul>
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ChipTabs tabs={TAB} value={tab} onChange={doiTab} anSo />
        <DateRangePicker value={ngay} onChange={(v) => datLoc(() => setNgay({ from: v.from || '', to: v.to || '' }))}
          placeholder={tab === 'quet' ? 'Ngày quét' : 'Ngày file xuống KT'} />
      </div>
      {tab === 'quet' && (
        <ChipTabs tabs={CHIP_TT} value={trangThai} counts={dem} onChange={(v) => datLoc(() => setTrangThai(v))} />
      )}

      <DataTable
        columns={tab === 'quet' ? cotQuet : cotPhanIn}
        rows={rows}
        loading={loading}
        onRowClick={tab === 'quet' ? setChiTiet : undefined}
        sttStart={(meta.page - 1) * LIMIT}
        pageSize={0}
        emptyText={tab === 'quet'
          ? (trangThai === 'CHO_GHEP' ? 'Không có mã nào đang chờ ghép' : 'Chưa có lượt quét')
          : 'Chưa có phần in nào được ghi nhận file xuống KT'}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <SidePanel open={!!chiTiet} onClose={() => setChiTiet(null)} title={chiTiet ? `Lượt quét ${chiTiet.ma_quet}` : ''}
        subtitle={chiTiet ? `${LOAI[chiTiet.loai_ma] || chiTiet.loai_ma} · ${fmtDateTime(chiTiet.tg_quet)}` : ''} width="max-w-xl"
        footer={chiTiet && coGhi && chiTiet.trang_thai !== 'HUY' ? (
          <Button variant="danger" onClick={() => setHuyDong(chiTiet)}>Hủy lượt quét</Button>
        ) : null}>
        {chiTiet && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3 text-sm">
              <div><div className="text-xs text-ink-soft">Trạng thái</div><div className="mt-1">{ttBadge(chiTiet.trang_thai)}</div></div>
              <div><div className="text-xs text-ink-soft">Người quét</div><div className="font-medium text-ink">{chu(chiTiet.nguoi_quet)}</div></div>
              <div><div className="text-xs text-ink-soft">Giờ quét (file xuống KT)</div><div className="font-medium tabular-nums text-ink">{fmtDateTime(chiTiet.tg_quet)}</div></div>
              <div><div className="text-xs text-ink-soft">Ghép lúc</div><div className="font-medium tabular-nums text-ink">{fmtDateTime(chiTiet.tg_ghep)}</div></div>
              <div><div className="text-xs text-ink-soft">Mã này đã quét</div><div className="font-medium text-ink">{fmtNum(chiTiet.so_lan_quet_ma)} lần</div></div>
              {chiTiet.ghi_chu && <div className="col-span-2"><div className="text-xs text-ink-soft">Ghi chú</div><div className="text-ink">{chiTiet.ghi_chu}</div></div>}
              {chiTiet.trang_thai === 'HUY' && (
                <div className="col-span-2 rounded-control bg-rose-50 p-2 text-xs text-rose-800 dark:bg-rose-950/20 dark:text-rose-300">
                  Đã hủy {fmtDateTime(chiTiet.tg_huy)}{chiTiet.nguoi_huy ? ` bởi ${chiTiet.nguoi_huy}` : ''} — {chu(chiTiet.ly_do_huy)}
                </div>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-ink">Phần in đã ghép ({fmtNum(chiTiet.so_phan_in)})</h4>
              {(chiTiet.phan_in || []).length === 0 ? (
                <p className="rounded-control border border-dashed border-amber-300 px-3 py-3 text-sm text-amber-700 dark:text-amber-400">
                  Chưa có phần in nào khớp mã này trên MES. Lượt quét đang lưu tạm — khi phần in lên MES (đồng bộ ERP) hệ thống tự ghép,
                  giờ file xuống KT vẫn là giờ quét ở trên.
                </p>
              ) : (
                <ul className="divide-y divide-line/60 rounded-control border border-line">
                  {chiTiet.phan_in.map((p) => (
                    <li key={p.id} className="px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/don-hang/lich-su-phan-in?id=${p.id}`} className="font-medium text-primary hover:underline">{p.ma_phan}</Link>
                        {p.mau_in && <span className="text-xs text-ink-soft">mực {p.mau_in}</span>}
                        <Badge tone={p.cach_ghep === 'TU_DONG' ? 'info' : 'default'}>{p.cach_ghep === 'TU_DONG' ? 'Tự ghép' : 'Khớp lúc quét'}</Badge>
                      </div>
                      <div className="text-xs text-ink-soft">
                        {[moTaPin(p), [p.mau_vai, p.kich_vai, p.kich_phim].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}
                      </div>
                      <div className="text-xs text-ink-soft">Lên MES {fmtDateTime(p.tg_len_mes)} · ghép {fmtDateTime(p.tg_ghep)}</div>
                    </li>
                  ))}
                </ul>
              )}
              {chiTiet.so_phan_in > (chiTiet.phan_in || []).length && (
                <p className="mt-1 text-xs text-ink-soft">Hiện {chiTiet.phan_in.length}/{chiTiet.so_phan_in} phần in — xem đủ ở tab Theo phần in.</p>
              )}
            </div>
          </div>
        )}
      </SidePanel>

      <HuyLyDoModal muc={huyDong} onClose={() => setHuyDong(null)} onXacNhan={huy}
        tieuDe="Hủy lượt quét" nhanNut="Hủy lượt quét" goiY="Vì sao hủy (vd: quét nhầm mã)..."
        moTa={(r) => <>Mã <b className="font-mono">{r.ma_quet}</b> · quét {fmtDateTime(r.tg_quet)}{r.nguoi_quet ? ` · ${r.nguoi_quet}` : ''}</>}
        hauQua="Lượt quét bị hủy không còn tính vào giờ file xuống KT của phần in (lượt quét khác của cùng mã vẫn giữ)."
        ghiChuErp="" />

      <QrScanner open={cam} onClose={() => setCam(false)} title="Quét mã vạch HSKT / Bảng TDTHĐH"
        onResult={(code) => { setCam(false); guiQuet(code); }} />

      <Toast toast={toast} />
    </div>
  );
}
