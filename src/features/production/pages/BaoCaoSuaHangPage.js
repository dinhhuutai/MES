import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import DateRangePicker from '../../../components/common/DateRangePicker';
import ChipTabs from '../../../components/common/ChipTabs';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Spinner from '../../../components/common/Spinner';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import { getBaoCaoSuaHang } from '../../../services/productionService';
import { ngayLocalISO, fmtNum } from '../../../utils/format';
import { khopNhieu, chuanTuKhoa } from '../../../utils/timKiem';
import exportBaoCaoSuaHang from '../utils/exportBaoCaoSuaHang';

// ─────────────────────────────────────────────────────────────────────────────
// BÁO CÁO SỬA HÀNG (Sản xuất › Báo cáo sửa hàng, 09/10/2026) — khuôn tờ xưởng "Báo cáo sửa hàng":
// Dây chuyền × Kết quả sửa (Tồn đầu · Nhận · Đã sửa · Chưa sửa) · Kết quả kiểm hàng sửa (Tồn đầu · Nhận · Đạt · Hủy ·
// Chưa kiểm) · Tồn sửa · Nghẽn (Hiện trạng Phần · SL · Thời gian nghẽn + Kết quả xử lý Phần/SL xong · Phần/SL chưa).
// 1 lượt API trả đủ: tổng · theo dây chuyền (kèm từng chuyền) · chi tiết theo tem · chi tiết lượt sửa. Luật (ngày SX
// 06:00→06:00, dựng chờ sửa theo sự kiện, MES ghi sửa 1 bước ⇒ khối kiểm không có tồn/chưa kiểm) ở backend
// `utils/baoCaoSuaHang.js`.
//   · Bấm dòng dây chuyền = mở/đóng các chuyền; bấm tên dây chuyền/chuyền = lọc chi tiết bên dưới.
//   · Ô tìm chỉ lọc bảng chi tiết. Excel = bảng dây chuyền + chi tiết ĐANG HIỆN.
//   · Khoảng ngày chứa hôm nay ⇒ nghe socket, tải ngầm.
// ─────────────────────────────────────────────────────────────────────────────

const doiNgay = (iso, soNgay) => {
  const [y, m, d] = iso.split('-').map(Number);
  return ngayLocalISO(new Date(y, m - 1, d + soNgay));
};
const hienNgay = (iso) => String(iso || '').split('-').reverse().join('/');
const ngayGio = (t) => (t ? new Date(t).toLocaleString('vi-VN', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '');
const nfGio = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const gio = (v) => (Number(v) > 0.05 ? nfGio.format(v) : '-');
const soO = (v) => (Number(v) ? fmtNum(v) : '-');

const NHANH = [
  { v: 'HOM_NAY', label: 'Hôm nay', tinh: (h) => ({ from: h, to: h }) },
  { v: '7_NGAY', label: '7 ngày', tinh: (h) => ({ from: doiNgay(h, -6), to: h }) },
  { v: '30_NGAY', label: '30 ngày', tinh: (h) => ({ from: doiNgay(h, -29), to: h }) },
  { v: 'THANG', label: 'Tháng này', tinh: (h) => ({ from: `${h.slice(0, 8)}01`, to: h }) },
];

const XEM = [
  { v: 'TEM', label: 'Theo tem' },
  { v: 'CHO', label: 'Còn chờ sửa' },
  { v: 'NGHEN', label: 'Nghẽn' },
  { v: 'LUOT', label: 'Lượt sửa' },
];

function OSo({ icon, nhan, giaTri, phu, tone = 'default' }) {
  const mau = {
    default: 'text-ink', primary: 'text-primary', success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400', danger: 'text-rose-600 dark:text-rose-400',
  }[tone];
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
        <Icon name={icon} size={14} />
        {nhan}
      </div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${mau}`}>{giaTri}</div>
      {phu ? <div className="mt-0.5 text-xs text-ink-soft">{phu}</div> : null}
    </div>
  );
}

const TH = 'border-b border-l border-line px-2 py-1.5 text-center font-semibold text-ink whitespace-nowrap';
const TD = 'border-l border-line/60 px-2 py-1.5 text-right tabular-nums whitespace-nowrap';
// Nền nhẹ theo khối cột ⇒ mắt bám đúng nhóm trên bảng rộng.
const NEN = { SUA: '', KIEM: 'bg-surface-muted/40', TON: 'bg-primary-wash/40', NGHEN: '' };

// 16 ô số của 1 dòng (dây chuyền / chuyền / tổng).
function OSoDong({ x }) {
  const ng = (v, d) => <td className={`${TD} ${NEN.NGHEN} ${v ? d : ''}`}>{soO(v)}</td>;
  return (
    <>
      <td className={`${TD} ${NEN.SUA}`}>{soO(x.ton_dau)}</td>
      <td className={`${TD} ${NEN.SUA}`}>{soO(x.nhan)}</td>
      <td className={`${TD} ${NEN.SUA}`}>{soO(x.da_sua)}</td>
      <td className={`${TD} ${NEN.SUA} ${x.chua_sua ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}`}>{soO(x.chua_sua)}</td>
      <td className={`${TD} ${NEN.KIEM}`}>{soO(x.kiem_ton_dau)}</td>
      <td className={`${TD} ${NEN.KIEM}`}>{soO(x.kiem_nhan)}</td>
      <td className={`${TD} ${NEN.KIEM} ${x.kiem_dat ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{soO(x.kiem_dat)}</td>
      <td className={`${TD} ${NEN.KIEM} ${x.kiem_huy ? 'text-rose-600 dark:text-rose-400' : ''}`}>{soO(x.kiem_huy)}</td>
      <td className={`${TD} ${NEN.KIEM}`}>{soO(x.chua_kiem)}</td>
      <td className={`${TD} ${NEN.TON} font-semibold`}>{soO(x.ton_sua)}</td>
      {ng(x.ng_phan, 'font-semibold text-danger')}
      {ng(x.ng_sl, 'text-danger')}
      <td className={`${TD} ${x.ng_gio > 0.05 ? 'font-medium text-danger' : ''}`}>{gio(x.ng_gio)}</td>
      {ng(x.ng_phan_xong, 'text-emerald-700 dark:text-emerald-400')}
      {ng(x.ng_sl_xong, 'text-emerald-700 dark:text-emerald-400')}
      {ng(x.ng_phan_chua, 'font-semibold text-danger')}
      {ng(x.ng_sl_chua, 'text-danger')}
    </>
  );
}

const GHI_KIEM = 'MES ghi kết quả kiểm cùng lúc xác nhận sửa (màn Sửa) — không có hàng chờ kiểm';

function BangDayChuyen({ data, mo, onMo, loc, onLoc }) {
  const rows = data.theo_day_chuyen || [];
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="wrench" size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-ink">Báo cáo sửa hàng</h3>
        <span className="ml-auto text-xs text-ink-soft">
          {data.sla_phut ? `SLA Sửa ${fmtNum(data.sla_phut)} phút` : 'Chưa cài SLA trạm Sửa — không đo nghẽn'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
          <thead className="bg-surface-muted">
            <tr>
              <th rowSpan={3} className="sticky left-0 z-10 min-w-[150px] border-b border-line bg-surface-muted px-3 py-1.5 text-left font-semibold text-ink">Dây chuyền</th>
              <th colSpan={4} rowSpan={2} className={TH}>Kết quả sửa</th>
              <th colSpan={5} rowSpan={2} className={TH} title={GHI_KIEM}>Kết quả kiểm hàng sửa</th>
              <th rowSpan={3} className={`${TH} text-primary`}>Tồn<br />Sửa</th>
              <th colSpan={7} className={TH}>Nghẽn</th>
            </tr>
            <tr>
              <th colSpan={3} className={TH}>Hiện trạng</th>
              <th colSpan={4} className={TH}>Kết quả xử lý</th>
            </tr>
            <tr className="text-ink-soft">
              {['Tồn đầu', 'Nhận', 'Đã sửa', 'Chưa sửa'].map((c) => <th key={`s${c}`} className={`${TH} font-medium text-ink-soft`}>{c}</th>)}
              {['Tồn đầu', 'Nhận', 'Đạt', 'Hủy', 'Chưa kiểm'].map((c) => (
                <th key={`k${c}`} className={`${TH} font-medium text-ink-soft`}
                  title={c === 'Tồn đầu' || c === 'Chưa kiểm' ? GHI_KIEM : undefined}>{c}</th>
              ))}
              {['Phần', 'SL', 'Thời gian nghẽn (giờ)', 'Phần xong', 'SL xong', 'Phần chưa', 'SL chưa'].map((c) => (
                <th key={`n${c}`} className={`${TH} font-medium text-ink-soft`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const dangMo = mo.has(d.nhom);
              const khoaD = `N:${d.nhom}`;
              const coChuyen = d.chuyen.length > 0;
              return (
                <Fragment key={d.nhom}>
                  <tr onClick={() => coChuyen && onMo(d.nhom)}
                    className={`border-t border-line/60 font-medium transition-colors ${coChuyen ? 'cursor-pointer' : ''} ${loc === khoaD ? 'bg-primary-wash' : 'hover:bg-surface-muted/60'}`}>
                    <td className="sticky left-0 z-10 border-b border-line/60 bg-surface px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Icon name={dangMo ? 'chevron-down' : 'chevron-right'} size={14}
                          className={coChuyen ? 'text-ink-soft' : 'text-ink-soft/30'} />
                        <button type="button" disabled={!d.so_tem}
                          onClick={(e) => { e.stopPropagation(); onLoc(loc === khoaD ? null : khoaD); }}
                          className={`text-left hover:underline disabled:no-underline ${loc === khoaD ? 'text-primary' : 'text-ink'}`}
                          title="Lọc chi tiết theo dây chuyền này">{d.ten}</button>
                        {d.so_tem ? <span className="text-[11px] font-normal text-ink-soft">{d.so_tem} tem</span> : null}
                      </div>
                    </td>
                    <OSoDong x={d} />
                  </tr>
                  {dangMo && d.chuyen.map((c) => {
                    const khoaC = `C:${c.ma_chuyen || '—'}`;
                    return (
                      <tr key={khoaC} onClick={() => onLoc(loc === khoaC ? null : khoaC)}
                        className={`cursor-pointer text-ink-soft transition-colors ${loc === khoaC ? 'bg-primary-wash text-primary' : 'hover:bg-surface-muted/60'}`}>
                        <td className="sticky left-0 z-10 border-b border-line/40 bg-surface py-1.5 pl-9 pr-3">
                          <span className="font-medium">{c.ma_chuyen || '— (không rõ chuyền)'}</span>
                          {c.ten_chuyen && c.ten_chuyen !== c.ma_chuyen ? <span className="ml-1 text-[11px]">{c.ten_chuyen}</span> : null}
                        </td>
                        <OSoDong x={c} />
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-surface-muted font-bold text-ink">
            <tr>
              <td className="sticky left-0 z-10 border-t-2 border-line bg-surface-muted px-3 py-2">Tổng cộng</td>
              <OSoDong x={data.tong} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const cotTemChung = [
  { key: 'ma_tem', header: 'Mã tem', render: (r) => <Badge tone="info">{r.ma_tem}</Badge> },
  { key: 'chuyen', header: 'Chuyền', render: (r) => (
    <div className="leading-tight">
      <div className="font-medium text-ink">{r.ma_chuyen || '—'}</div>
      <div className="text-[11px] text-ink-soft">{r.ten_nhom}</div>
    </div>
  ) },
  { key: 'lenh', header: 'Lệnh · Code phần', render: (r) => (
    <div className="leading-tight">
      <div className="text-ink">{r.ma_lenh_san_xuat || '—'}</div>
      <div className="max-w-[220px] truncate text-[11px] text-ink-soft" title={r.ma_phan || ''}>{r.ma_phan || '—'}</div>
    </div>
  ) },
  { key: 'khach', header: 'Khách · Mã hàng', render: (r) => (
    <div className="leading-tight">
      <div className="text-ink">{r.khach || '—'}</div>
      <div className="max-w-[200px] truncate text-[11px] text-ink-soft" title={r.ma_hang || ''}>{r.ma_hang || '—'}</div>
    </div>
  ) },
];

const COT_TEM = [
  { key: 'tg_vao', header: 'Vào sửa', className: 'whitespace-nowrap tabular-nums', render: (r) => ngayGio(r.tg_vao) || '—' },
  ...cotTemChung,
  { key: 'ton_dau', header: 'Tồn đầu', className: 'text-right tabular-nums', render: (r) => soO(r.ton_dau) },
  { key: 'nhan', header: 'Nhận', className: 'text-right tabular-nums', render: (r) => (
    <div className="leading-tight">
      <div>{soO(r.nhan)}</div>
      {r.nhan_tra_ve ? <div className="text-[10px] text-ink-soft">OQC trả về {fmtNum(r.nhan_tra_ve)}</div> : null}
    </div>
  ) },
  { key: 'da_sua', header: 'Đã sửa', className: 'text-right tabular-nums', render: (r) => (
    <div className="leading-tight">
      <div className="font-medium">{soO(r.da_sua)}</div>
      {r.da_sua ? (
        <div className="text-[10px] text-ink-soft">
          <span className="text-emerald-700 dark:text-emerald-400">đạt {fmtNum(r.kiem_dat)}</span>
          {' · '}
          <span className={r.kiem_huy ? 'text-rose-600 dark:text-rose-400' : ''}>hủy {fmtNum(r.kiem_huy)}</span>
        </div>
      ) : null}
    </div>
  ) },
  { key: 'chua_sua', header: 'Chưa sửa', className: 'text-right tabular-nums', render: (r) => (
    <span className={r.chua_sua ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-ink-soft'}>{soO(r.chua_sua)}</span>
  ) },
  { key: 'nghen', header: 'Nghẽn', render: (r) => (r.nghen === 'CHUA'
    ? <Badge tone="danger">Chưa xử lý · {gio(r.gio_nghen)} giờ</Badge>
    : r.nghen === 'XONG'
      ? <Badge tone="warning">Đã xử lý · trễ {gio(r.gio_nghen)} giờ</Badge>
      : <span className="text-ink-soft">—</span>) },
];

const COT_LUOT = [
  { key: 'tg', header: 'Lúc sửa', className: 'whitespace-nowrap tabular-nums', render: (r) => (
    <div className="leading-tight">
      <div className="font-medium text-ink">{ngayGio(r.tg)}</div>
      <div className="text-[11px] text-ink-soft">Ngày SX {hienNgay(r.ngay_sx)}</div>
    </div>
  ) },
  ...cotTemChung,
  { key: 'dat', header: 'Đạt', className: 'text-right tabular-nums text-emerald-700 dark:text-emerald-400', render: (r) => fmtNum(r.dat) },
  { key: 'huy', header: 'Hủy', className: 'text-right tabular-nums', render: (r) => (
    <div className="leading-tight">
      <div className={r.huy ? 'text-rose-600 dark:text-rose-400' : 'text-ink-soft'}>{fmtNum(r.huy)}</div>
      {r.huy_thang ? <div className="text-[10px] text-ink-soft">hủy thẳng {fmtNum(r.huy_thang)}</div> : null}
    </div>
  ) },
  { key: 'nguoi_sua', header: 'Người sửa', render: (r) => r.nguoi_sua || '—' },
  { key: 'nguoi_xac_nhan', header: 'Người xác nhận', render: (r) => r.nguoi_xac_nhan || '—' },
];

const LOC_XEM = {
  TEM: () => true,
  CHO: (r) => r.chua_sua > 0,
  NGHEN: (r) => !!r.nghen,
};

export default function BaoCaoSuaHangPage() {
  const { toast, show } = useToast();
  const homNay = ngayLocalISO(new Date());
  const [khoang, setKhoang] = useState(() => NHANH[0].tinh(homNay));
  const [search, setSearch] = useState('');
  const [loc, setLoc] = useState(null);      // 'N:<nhóm>' | 'C:<mã chuyền>'
  const [xem, setXem] = useState('TEM');
  const [mo, setMo] = useState(() => new Set());
  const [data, setData] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState('');
  const [dangXuat, setDangXuat] = useState(false);
  const yeuCau = useRef(0);

  const tu = khoang.from || khoang.to || homNay;
  const den = khoang.to || khoang.from || homNay;

  const tai = useCallback(async (ngam = false) => {
    const lan = ++yeuCau.current;
    if (!ngam) setLoi('');
    setDangTai(true);
    try {
      const res = await getBaoCaoSuaHang(tu, den);
      if (lan === yeuCau.current) setData(res.data);
    } catch (e) {
      if (lan === yeuCau.current && !ngam) setLoi(e.message || 'Không tải được báo cáo');
    } finally {
      if (lan === yeuCau.current) setDangTai(false);
    }
  }, [tu, den]);

  useEffect(() => { tai(); }, [tai]);
  const coHomNay = tu <= homNay && den >= homNay;
  useSocketReload(['quality:updated', 'production:updated'], () => { if (coHomNay) tai(true); }, 1200);

  const doiKhoang = (v) => { setKhoang(v); setLoc(null); };
  const nhanhDangChon = (NHANH.find((n) => {
    const x = n.tinh(homNay);
    return x.from === tu && x.to === den;
  }) || {}).v;
  const doiMo = (k) => setMo((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const cuKhoang = !!data && (data.tu_ngay !== tu || data.den_ngay !== den);
  const tenNhom = useMemo(() => new Map((data ? data.theo_day_chuyen : []).map((d) => [d.nhom, d.ten])), [data]);
  const kw = chuanTuKhoa(search);
  const hopLoc = useCallback((r) => (
    (!loc || (loc.startsWith('N:') ? `N:${r.nhom}` === loc : `C:${r.ma_chuyen || '—'}` === loc))
    && (!kw || khopNhieu([r.ma_tem, r.ma_chuyen, r.ma_lenh_san_xuat, r.ma_phan, r.khach, r.po, r.ma_hang, r.mau_vai, r.nguoi_sua, r.nguoi_xac_nhan], kw))
  ), [loc, kw]);
  const temLoc = useMemo(() => (data ? data.chi_tiet : []).filter(hopLoc), [data, hopLoc]);
  const luotLoc = useMemo(() => (data ? data.chi_tiet_luot : []).filter(hopLoc), [data, hopLoc]);
  const dem = useMemo(() => ({
    TEM: temLoc.length,
    CHO: temLoc.filter(LOC_XEM.CHO).length,
    NGHEN: temLoc.filter(LOC_XEM.NGHEN).length,
    LUOT: luotLoc.length,
  }), [temLoc, luotLoc]);
  const laLuot = xem === 'LUOT';
  const dongHien = useMemo(() => (laLuot ? luotLoc : temLoc.filter(LOC_XEM[xem] || LOC_XEM.TEM)), [laLuot, luotLoc, temLoc, xem]);
  const dangLoc = !!(loc || kw);
  const nhanLoc = loc ? (loc.startsWith('N:') ? `Dây chuyền ${tenNhom.get(loc.slice(2)) || loc.slice(2)}` : `Chuyền ${loc.slice(2)}`) : '';

  const doExcel = async () => {
    if (!data) return;
    setDangXuat(true);
    try {
      await exportBaoCaoSuaHang(data, {
        tems: temLoc, luot: luotLoc,
        moTaLoc: [nhanLoc, search && `tìm: ${search}`].filter(Boolean).join(' · '),
      });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setDangXuat(false);
    }
  };

  const tong = data && !cuKhoang ? data.tong : null;
  const nhanKhoang = tu === den ? `ngày SX ${hienNgay(tu)}` : `${hienNgay(tu)} → ${hienNgay(den)}`;

  return (
    <div>
      <Toolbar title="Báo cáo sửa hàng" search={search} onSearch={setSearch}
        searchPlaceholder="Tìm mã tem, chuyền, code phần, mã hàng, người sửa...">
        <div className="flex h-10 items-center gap-1 rounded-control border border-line bg-surface-muted p-1">
          {NHANH.map((n) => (
            <button key={n.v} type="button" onClick={() => doiKhoang(n.tinh(homNay))}
              className={`h-8 whitespace-nowrap rounded-[10px] px-3 text-xs font-medium transition-colors ${
                nhanhDangChon === n.v ? 'bg-surface text-primary shadow-sm ring-1 ring-line' : 'text-ink-soft hover:text-ink'}`}>
              {n.label}
            </button>
          ))}
        </div>
        <div className="w-60"><DateRangePicker value={khoang} onChange={doiKhoang} placeholder="Khoảng ngày SX" /></div>
        <Button chiXemOk variant="secondary" icon="download" onClick={doExcel} loading={dangXuat} disabled={!data || cuKhoang}>
          Excel
        </Button>
      </Toolbar>

      <div className="relative">
        {dangTai && data && (
          <div className="absolute inset-x-0 -top-2 z-20 h-0.5 overflow-hidden rounded-full bg-primary/10">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        )}
        {!data && dangTai ? (
          <div className="flex justify-center py-20"><Spinner size={32} /></div>
        ) : loi && !data ? (
          <div className="rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{loi}</div>
        ) : data ? (
          <div className={`space-y-4 transition-opacity duration-200 ${cuKhoang ? 'opacity-50' : ''}`}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <OSo icon="arrow-down" nhan="Nhận sửa" giaTri={tong ? fmtNum(tong.nhan) : '—'} tone="primary"
                phu={tong ? `Tồn đầu ${fmtNum(tong.ton_dau)} · ${nhanKhoang}` : null} />
              <OSo icon="check-circle" nhan="Đã sửa" giaTri={tong ? fmtNum(tong.da_sua) : '—'} tone="success"
                phu={tong ? `Đạt ${fmtNum(tong.kiem_dat)} · Hủy ${fmtNum(tong.kiem_huy)}` : null} />
              <OSo icon="wrench" nhan="Tồn sửa" giaTri={tong ? fmtNum(tong.ton_sua) : '—'} tone="warning"
                phu={tong ? `${fmtNum(dem.CHO)} tem còn chờ sửa` : null} />
              <OSo icon="alert-triangle" nhan="Nghẽn" giaTri={tong ? `${fmtNum(tong.ng_phan)} phần` : '—'} tone="danger"
                phu={tong ? `Chưa xử lý ${fmtNum(tong.ng_phan_chua)} · ${gio(tong.ng_gio)} giờ` : null} />
            </div>

            <BangDayChuyen data={data} mo={mo} onMo={doiMo} loc={loc} onLoc={setLoc} />

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">Chi tiết</h3>
                {loc && (
                  <button type="button" onClick={() => setLoc(null)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-3 py-1 text-xs font-medium text-primary hover:text-danger">
                    {nhanLoc}
                    <Icon name="x" size={12} />
                  </button>
                )}
                {dangLoc && (
                  <button type="button" onClick={() => { setLoc(null); setSearch(''); }}
                    className="text-xs font-medium text-ink-soft underline hover:text-danger">Bỏ lọc</button>
                )}
              </div>
              <ChipTabs tabs={XEM} value={xem} counts={dem} onChange={setXem} />
              <DataTable key={laLuot ? 'luot' : 'tem'} columns={laLuot ? COT_LUOT : COT_TEM} rows={dongHien}
                rowKey={laLuot ? 'id' : 'tem_id'} loading={!data && dangTai}
                emptyText={dangLoc ? 'Không có dòng nào khớp bộ lọc'
                  : laLuot ? 'Không có lượt sửa nào trong khoảng ngày này' : 'Không có tem nào trong khoảng ngày này'} />
            </div>
          </div>
        ) : null}
      </div>
      <Toast toast={toast} />
    </div>
  );
}
