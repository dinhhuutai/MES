import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import DateRangePicker from '../../../components/common/DateRangePicker';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Spinner from '../../../components/common/Spinner';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import { getBaoCaoPhanLoaiLoi } from '../../../services/productionService';
import { ngayLocalISO, fmtNum } from '../../../utils/format';
import { khopNhieu, chuanTuKhoa } from '../../../utils/timKiem';
import ChonChuyenNhieu from '../components/ChonChuyenNhieu';
import { dsChuyen, locChuyen } from '../utils/gomBaoCao';
import { CHIEU_PLL, dungMaTran } from '../utils/maTranPhanLoaiLoi';
import exportBaoCaoPhanLoaiLoi from '../utils/exportBaoCaoPhanLoaiLoi';

// ─────────────────────────────────────────────────────────────────────────────
// BÁO CÁO PHÂN LOẠI LỖI (Sản xuất › Báo cáo phân loại lỗi, 11/10/2026) — khuôn tờ xưởng "Báo cáo PLL":
//   dòng = MÃ LỖI (hiện đủ mọi mã của danh mục — tích "Chỉ mã có số liệu" để gọn) · cột = từng DÂY CHUYỀN × Sửa / Hủy
//   + khối Tổng lỗi (Sửa · Hủy · Sửa + Hủy · % S+H) · 3 dòng cuối Tổng lỗi · % lỗi · SL kiểm.
//   "Gồm theo: Loại dây chuyền · Thợ · Khách hàng · chi tiết" ⇒ dải "Xem theo" đổi CHIỀU CỘT (thêm Chuyền) + bảng
//   chi tiết bên dưới. Bấm 1 mã lỗi / 1 tiêu đề cột = lọc bảng chi tiết. Bộ chọn chuyền lọc cả ma trận lẫn chi tiết.
// 1 lượt API trả `chi_tiet` + `kiem` + `ma_loi`; ma trận dựng tại chỗ (`utils/maTranPhanLoaiLoi.js`) ⇒ đổi chiều / chọn
// chuyền không gọi lại API. Luật (kỳ = ngày SX của lượt KCS 06:00→06:00, lỗi theo phiếu Phân loại lỗi) ở backend
// `utils/baoCaoPhanLoaiLoi.js`. Khoảng ngày chứa hôm nay ⇒ nghe socket, tải ngầm.
// ─────────────────────────────────────────────────────────────────────────────

const doiNgay = (iso, soNgay) => {
  const [y, m, d] = iso.split('-').map(Number);
  return ngayLocalISO(new Date(y, m - 1, d + soNgay));
};
const hienNgay = (iso) => String(iso || '').split('-').reverse().join('/');
const ngayGio = (t) => (t ? new Date(t).toLocaleString('vi-VN', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '');
const nfPt = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pt = (v) => (v == null ? '—' : `${nfPt.format(v * 100)}%`);
const soO = (v) => (Number(v) ? fmtNum(v) : '-');

const NHANH = [
  { v: 'HOM_NAY', label: 'Hôm nay', tinh: (h) => ({ from: h, to: h }) },
  { v: '7_NGAY', label: '7 ngày', tinh: (h) => ({ from: doiNgay(h, -6), to: h }) },
  { v: '30_NGAY', label: '30 ngày', tinh: (h) => ({ from: doiNgay(h, -29), to: h }) },
  { v: 'THANG', label: 'Tháng này', tinh: (h) => ({ from: `${h.slice(0, 8)}01`, to: h }) },
];
const DS_CHIEU = [
  { v: 'DC', label: 'Dây chuyền' }, { v: 'CH', label: 'Chuyền' }, { v: 'TH', label: 'Thợ in' }, { v: 'KH', label: 'Khách hàng' },
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

const TH = 'border-b border-l border-line px-2 py-1.5 text-center font-semibold whitespace-nowrap';
const TD = 'border-b border-l border-line/60 px-2 py-1.5 text-right tabular-nums whitespace-nowrap';
const NEN_TONG = 'bg-surface-muted/70';

// Ma trận mã lỗi × cột (khuôn tờ "Báo cáo PLL"). Bấm mã lỗi / tiêu đề cột = lọc chi tiết.
function BangMaTran({ mt, loc, onLoc }) {
  const { cot, dong, tongCot, tong } = mt;
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="alert-triangle" size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-ink">Báo cáo PLL — mã lỗi theo {mt.ten_chieu.toLowerCase()}</h3>
        <span className="ml-auto text-xs text-ink-soft">Bấm mã lỗi hoặc tiêu đề cột để lọc chi tiết</span>
      </div>
      <div className="max-h-[62vh] overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20 bg-surface-muted text-ink">
            <tr>
              <th rowSpan={2} className="sticky left-0 z-10 min-w-[220px] border-b border-line bg-surface-muted px-3 py-1.5 text-left font-semibold">Mã lỗi</th>
              {cot.map((c) => {
                const khoa = `C:${c.key}`;
                return (
                  <th key={c.key} colSpan={2} className={`${TH} cursor-pointer hover:text-primary ${loc === khoa ? 'bg-primary-wash text-primary' : ''}`}
                    onClick={() => onLoc(loc === khoa ? null : khoa)} title="Lọc chi tiết theo cột này">{c.nhan}</th>
                );
              })}
              <th colSpan={4} className={`${TH} ${NEN_TONG}`}>Tổng lỗi</th>
            </tr>
            <tr className="text-ink-soft">
              {cot.map((c) => [
                <th key={`${c.key}s`} className={`${TH} font-medium`}>Sửa</th>,
                <th key={`${c.key}h`} className={`${TH} font-medium`}>Hủy</th>,
              ])}
              {['Sửa', 'Hủy', 'Sửa + Hủy', '% S+H'].map((c) => <th key={c} className={`${TH} font-medium ${NEN_TONG}`}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {dong.length === 0 && (
              <tr><td colSpan={cot.length * 2 + 5} className="px-4 py-8 text-center text-sm text-ink-soft">Không có mã lỗi nào có số liệu trong khoảng ngày này</td></tr>
            )}
            {dong.map((d) => {
              const khoa = `M:${d.ma_loi}`;
              return (
                <tr key={d.ma_loi} onClick={() => d.tong && onLoc(loc === khoa ? null : khoa)}
                  className={`transition-colors ${d.tong ? 'cursor-pointer' : ''} ${loc === khoa ? 'bg-primary-wash' : 'hover:bg-surface-muted/50'}`}>
                  <td className={`sticky left-0 z-10 max-w-[300px] truncate border-b border-line/60 bg-surface px-3 py-1.5 ${d.tong ? 'font-medium text-ink' : 'text-ink-soft'} ${d.gia ? 'italic' : ''}`}
                    title={d.ten_loi ? `${d.ma_loi} — ${d.ten_loi}` : d.ma_loi}>
                    {d.ma_loi}{d.ten_loi && !d.gia ? <span className="ml-1.5 text-[11px] font-normal text-ink-soft">{d.ten_loi}</span> : null}
                  </td>
                  {cot.map((c) => [
                    <td key={`${c.key}s`} className={`${TD} ${d.o[c.key].sua ? 'text-amber-700 dark:text-amber-400' : 'text-ink-soft/50'}`}>{soO(d.o[c.key].sua)}</td>,
                    <td key={`${c.key}h`} className={`${TD} ${d.o[c.key].huy ? 'text-rose-600 dark:text-rose-400' : 'text-ink-soft/50'}`}>{soO(d.o[c.key].huy)}</td>,
                  ])}
                  <td className={`${TD} ${NEN_TONG}`}>{fmtNum(d.sua)}</td>
                  <td className={`${TD} ${NEN_TONG}`}>{fmtNum(d.huy)}</td>
                  <td className={`${TD} ${NEN_TONG} font-semibold`}>{fmtNum(d.tong)}</td>
                  <td className={`${TD} ${NEN_TONG}`}>{d.tong ? pt(d.ty_trong) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-20 bg-surface-muted text-ink">
            <tr className="font-bold">
              <td className="sticky left-0 z-10 border-t-2 border-line bg-surface-muted px-3 py-1.5">Tổng lỗi</td>
              {cot.map((c) => [
                <td key={`${c.key}s`} className={`${TD} border-t-2 border-t-line`}>{soO(tongCot[c.key].sua)}</td>,
                <td key={`${c.key}h`} className={`${TD} border-t-2 border-t-line`}>{soO(tongCot[c.key].huy)}</td>,
              ])}
              <td className={`${TD} border-t-2 border-t-line`}>{soO(tong.sua)}</td>
              <td className={`${TD} border-t-2 border-t-line`}>{soO(tong.huy)}</td>
              <td className={`${TD} border-t-2 border-t-line`}>{soO(tong.tong)}</td>
              <td className={`${TD} border-t-2 border-t-line`} title="Tổng lỗi ÷ SL kiểm">{pt(tong.ty_le)}</td>
            </tr>
            <tr>
              <td className="sticky left-0 z-10 bg-surface-muted px-3 py-1.5 font-medium">% lỗi</td>
              {cot.map((c) => [
                <td key={`${c.key}s`} className={TD}>{pt(tongCot[c.key].ty_le_sua)}</td>,
                <td key={`${c.key}h`} className={TD}>{pt(tongCot[c.key].ty_le_huy)}</td>,
              ])}
              <td className={TD}>{pt(tong.ty_le_sua)}</td>
              <td className={TD}>{pt(tong.ty_le_huy)}</td>
              <td className={`${TD} font-semibold`}>{pt(tong.ty_le)}</td>
              <td className={TD} />
            </tr>
            <tr>
              <td className="sticky left-0 z-10 bg-surface-muted px-3 py-1.5 font-medium">SL kiểm</td>
              {cot.map((c) => <td key={c.key} colSpan={2} className={`${TD} text-center`}>{soO(tongCot[c.key].kiem)}</td>)}
              <td colSpan={3} className={`${TD} text-center font-semibold`}>{fmtNum(tong.kiem)}</td>
              <td className={TD} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const COT_CT = [
  { key: 'tg_kiem', header: 'Lúc kiểm', className: 'whitespace-nowrap tabular-nums', render: (r) => (
    <div className="leading-tight">
      <div className="font-medium text-ink">{ngayGio(r.tg_kiem)}</div>
      <div className="text-[11px] text-ink-soft">Ngày SX {hienNgay(r.ngay_sx)}</div>
    </div>
  ) },
  { key: 'ma_tem', header: 'Mã tem', render: (r) => <Badge tone="info">{r.ma_tem}</Badge> },
  { key: 'chuyen', header: 'Chuyền', render: (r) => (
    <div className="leading-tight">
      <div className="font-medium text-ink">{r.ma_chuyen || '—'}</div>
      <div className="text-[11px] text-ink-soft">{CHIEU_PLL.DC.nhan(r.nhom || 'KHAC')}</div>
    </div>
  ) },
  { key: 'khach', header: 'Khách · Mã hàng', render: (r) => (
    <div className="leading-tight">
      <div className="text-ink">{r.khach || '—'}</div>
      <div className="max-w-[200px] truncate text-[11px] text-ink-soft" title={r.ma_hang || ''}>{r.ma_hang || '—'}</div>
    </div>
  ) },
  { key: 'ma_phan', header: 'Code phần · Màu', render: (r) => (
    <div className="leading-tight">
      <div className="max-w-[220px] truncate text-ink" title={r.ma_phan || ''}>{r.ma_phan || '—'}</div>
      <div className="text-[11px] text-ink-soft">{[r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
    </div>
  ) },
  { key: 'tho_ds', header: 'Thợ in', render: (r) => <span className="block max-w-[170px] truncate" title={r.tho_ds || ''}>{r.tho_ds || '—'}</span> },
  { key: 'ma_loi', header: 'Mã lỗi', render: (r) => (
    <div className="leading-tight">
      <div className={`font-medium ${r.chua_phan_loai ? 'italic text-ink-soft' : 'text-ink'}`}>{r.ma_loi}</div>
      <div className="max-w-[220px] truncate text-[11px] text-ink-soft" title={r.ten_loi || ''}>{r.ten_loi || ''}</div>
    </div>
  ) },
  { key: 'bien_phap', header: 'Biện pháp', render: (r) => r.bien_phap || '—' },
  { key: 'sl_sua', header: 'Sửa', className: 'text-right tabular-nums', render: (r) => (
    <span className={r.sl_sua ? 'text-amber-700 dark:text-amber-400' : 'text-ink-soft'}>{fmtNum(r.sl_sua)}</span>
  ) },
  { key: 'sl_huy', header: 'Hủy', className: 'text-right tabular-nums', render: (r) => (
    <span className={r.sl_huy ? 'text-rose-600 dark:text-rose-400' : 'text-ink-soft'}>{fmtNum(r.sl_huy)}</span>
  ) },
  { key: 'nguoi_phan_loai', header: 'Người phân loại', render: (r) => r.nguoi_phan_loai || '—' },
];

export default function BaoCaoPhanLoaiLoiPage() {
  const { toast, show } = useToast();
  const homNay = ngayLocalISO(new Date());
  const [khoang, setKhoang] = useState(() => NHANH[0].tinh(homNay));
  const [search, setSearch] = useState('');
  const [chieu, setChieu] = useState('DC');
  const [anTrong, setAnTrong] = useState(false);   // chỉ hiện mã lỗi có số liệu
  const [chuyenChon, setChuyenChon] = useState([]);
  const [loc, setLoc] = useState(null);            // 'M:<mã lỗi>' | 'C:<khóa cột của chiều đang xem>'
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
      const res = await getBaoCaoPhanLoaiLoi(tu, den);
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
  const cuKhoang = !!data && (data.tu_ngay !== tu || data.den_ngay !== den);

  // Tập gốc sau bộ chọn chuyền ⇒ ma trận + ô số tổng.
  const chuyens = useMemo(() => dsChuyen(data ? data.kiem : []), [data]);
  const chonHopLe = useMemo(() => chuyenChon.filter((ma) => chuyens.some((c) => c.ma === ma)), [chuyenChon, chuyens]);
  // `_k` = khóa dòng cho DataTable (1 tem có thể nhiều dòng cùng mã lỗi khác biện pháp).
  const gocLoi = useMemo(() => locChuyen((data ? data.chi_tiet : []).map((r, i) => ({ ...r, _k: i })), chonHopLe), [data, chonHopLe]);
  const gocKiem = useMemo(() => locChuyen(data ? data.kiem : [], chonHopLe), [data, chonHopLe]);
  const mt = useMemo(() => dungMaTran({
    chiTiet: gocLoi, kiem: gocKiem, maLoi: data ? data.ma_loi : [], chieu, anTrong,
  }), [gocLoi, gocKiem, data, chieu, anTrong]);

  const kw = chuanTuKhoa(search);
  const chiTiet = useMemo(() => gocLoi.filter((r) => (
    (!loc || (loc[0] === 'M' ? r.ma_loi === loc.slice(2) : CHIEU_PLL[chieu].khoa(r) === loc.slice(2)))
    && (!kw || khopNhieu([r.ma_tem, r.ma_chuyen, r.ma_lenh_san_xuat, r.ma_phan, r.khach, r.po, r.ma_hang, r.mau_vai,
      r.ma_loi, r.ten_loi, r.bien_phap, r.tho_ds, r.nguoi_phan_loai], kw))
  )), [gocLoi, loc, kw, chieu]);
  const tongLoc = useMemo(() => chiTiet.reduce((s, r) => ({ sua: s.sua + r.sl_sua, huy: s.huy + r.sl_huy }), { sua: 0, huy: 0 }), [chiTiet]);
  const dangLoc = !!(loc || kw);
  const nhanLoc = loc ? (loc[0] === 'M' ? `Mã lỗi ${loc.slice(2)}` : `${CHIEU_PLL[chieu].ten} ${CHIEU_PLL[chieu].nhan(loc.slice(2))}`) : '';
  const doiChieu = (v) => { setChieu(v); setLoc((l) => (l && l[0] === 'C' ? null : l)); };

  const doExcel = async () => {
    if (!data) return;
    setDangXuat(true);
    try {
      await exportBaoCaoPhanLoaiLoi(data, {
        maTran: mt, chiTiet,
        moTaLoc: [chonHopLe.length ? `chuyền: ${chonHopLe.join(', ')}` : '', nhanLoc, search && `tìm: ${search}`].filter(Boolean).join(' · '),
      });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setDangXuat(false);
    }
  };

  const tong = data && !cuKhoang ? mt.tong : null;
  const nhanKhoang = tu === den ? `ngày SX ${hienNgay(tu)}` : `${hienNgay(tu)} → ${hienNgay(den)}`;
  const chuaPl = data ? data.tong.so_tem_chua_phan_loai : 0;

  return (
    <div>
      <Toolbar title="Báo cáo phân loại lỗi" search={search} onSearch={setSearch}
        searchPlaceholder="Tìm mã tem, mã lỗi, chuyền, code phần, thợ in...">
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
        <ChonChuyenNhieu ds={chuyens} value={chonHopLe} onChange={(v) => { setChuyenChon(v); setLoc(null); }} />
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
              <OSo icon="shield-check" nhan="SL kiểm" giaTri={tong ? fmtNum(tong.kiem) : '—'} tone="primary" phu={tong ? nhanKhoang : null} />
              <OSo icon="wrench" nhan="Sửa" giaTri={tong ? fmtNum(tong.sua) : '—'} tone="warning"
                phu={tong ? `${pt(tong.ty_le_sua)} SL kiểm${chuaPl ? ` · ${chuaPl} tem chưa phân loại` : ''}` : null} />
              <OSo icon="trash-2" nhan="Hủy" giaTri={tong ? fmtNum(tong.huy) : '—'} tone="danger" phu={tong ? `${pt(tong.ty_le_huy)} SL kiểm` : null} />
              <OSo icon="alert-triangle" nhan="Tổng lỗi (Sửa + Hủy)" giaTri={tong ? fmtNum(tong.tong) : '—'} tone="danger"
                phu={tong ? `% lỗi ${pt(tong.ty_le)}` : null} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-ink-soft">Xem theo</span>
              <div className="flex h-9 items-center gap-1 rounded-control border border-line bg-surface-muted p-1">
                {DS_CHIEU.map((c) => (
                  <button key={c.v} type="button" onClick={() => doiChieu(c.v)}
                    className={`h-7 whitespace-nowrap rounded-[10px] px-3 text-xs font-medium transition-colors ${
                      chieu === c.v ? 'bg-surface text-primary shadow-sm ring-1 ring-line' : 'text-ink-soft hover:text-ink'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
                <input type="checkbox" checked={anTrong} onChange={(e) => setAnTrong(e.target.checked)} />
                Chỉ mã lỗi có số liệu
              </label>
              {chonHopLe.length > 0 && (
                <button type="button" onClick={() => { setChuyenChon([]); setLoc(null); }}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-3 py-1 text-xs font-medium text-primary hover:text-danger">
                  Chỉ chuyền: {chonHopLe.join(', ')}
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>

            <BangMaTran mt={mt} loc={loc} onLoc={setLoc} />

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">Chi tiết</h3>
                <Badge tone="info">{chiTiet.length} dòng · sửa {fmtNum(tongLoc.sua)} · hủy {fmtNum(tongLoc.huy)}</Badge>
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
              <DataTable columns={COT_CT} rows={chiTiet} rowKey="_k"
                loading={!data && dangTai}
                emptyText={dangLoc ? 'Không có dòng lỗi nào khớp bộ lọc' : 'Không có hàng lỗi nào trong khoảng ngày này'} />
            </div>
          </div>
        ) : null}
      </div>
      <Toast toast={toast} />
    </div>
  );
}
