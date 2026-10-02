import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getBaoCaoKiemHang } from '../../../services/productionService';
import { ngayLocalISO, fmtNum } from '../../../utils/format';
import { khopNhieu, chuanTuKhoa } from '../../../utils/timKiem';
import exportBaoCaoKiemHang from '../utils/exportBaoCaoKiemHang';

// ─────────────────────────────────────────────────────────────────────────────
// BÁO CÁO KẾT QUẢ KIỂM HÀNG (Sản xuất › Báo cáo kiểm hàng, 02/10/2026)
// Khuôn tờ Excel xưởng "KẾT QUẢ KIỂM TRA CLSP THEO DÂY CHUYỀN". 1 lượt API trả đủ: tổng · theo dây chuyền
// (kèm từng chuyền) · chi tiết lượt KCS. Luật (ngày SX 06:00→06:00, sửa/hủy theo Phân loại lỗi) ở backend
// `utils/baoCaoKiemHang.js`.
//   · Bấm dòng dây chuyền = mở/đóng các chuyền bên dưới; bấm dòng chuyền/dây chuyền (ô tên) = lọc chi tiết.
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
const nfPt = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pt = (v) => (v == null ? '—' : `${nfPt.format(v * 100)}%`);

const NHANH = [
  { v: 'HOM_NAY', label: 'Hôm nay', tinh: (h) => ({ from: h, to: h }) },
  { v: '7_NGAY', label: '7 ngày', tinh: (h) => ({ from: doiNgay(h, -6), to: h }) },
  { v: '30_NGAY', label: '30 ngày', tinh: (h) => ({ from: doiNgay(h, -29), to: h }) },
  { v: 'THANG', label: 'Tháng này', tinh: (h) => ({ from: `${h.slice(0, 8)}01`, to: h }) },
];

// Màu % không đạt: ≥ 10% đỏ · ≥ 5% vàng.
const mauKhongDat = (v) => (v == null ? 'text-ink-soft' : v >= 0.1 ? 'text-rose-600 dark:text-rose-400'
  : v >= 0.05 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400');

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

const TH = 'px-3 py-2 text-right font-medium whitespace-nowrap';
const TD = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

// 8 ô số của 1 dòng (dây chuyền / chuyền / tổng) — dùng chung cho 3 loại dòng.
function OSoDong({ x }) {
  return (
    <>
      <td className={TD}>{fmtNum(x.sl_kiem)}</td>
      <td className={TD}>{fmtNum(x.sl_dat)}</td>
      <td className={TD}>{pt(x.ty_le_dat)}</td>
      <td className={TD}>{x.sl_sua ? fmtNum(x.sl_sua) : '-'}</td>
      <td className={TD}>{pt(x.ty_le_sua)}</td>
      <td className={TD}>{fmtNum(x.sl_huy)}</td>
      <td className={TD}>{pt(x.ty_le_huy)}</td>
      <td className={`${TD} font-semibold ${mauKhongDat(x.ty_le_khong_dat)}`}>{pt(x.ty_le_khong_dat)}</td>
    </>
  );
}

function BangDayChuyen({ data, mo, onMo, loc, onLoc }) {
  const rows = data.theo_day_chuyen || [];
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="factory" size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-ink">Kết quả kiểm tra CLSP theo dây chuyền</h3>
        <span className="ml-auto text-xs text-ink-soft">Bấm dây chuyền để xem từng chuyền</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-xs text-ink-soft">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Dây chuyền</th>
              <th className={TH}>SL kiểm</th><th className={TH}>SL đạt</th><th className={TH}>%Đạt</th>
              <th className={TH}>SL sửa</th><th className={TH}>%Sửa</th><th className={TH}>SL hủy</th>
              <th className={TH}>%Hủy</th><th className={TH}>% K.đạt</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-ink-soft">Không có lượt kiểm nào trong khoảng ngày này</td></tr>
            )}
            {rows.map((d) => {
              const dangMo = mo.has(d.nhom);
              const khoaD = `N:${d.nhom}`;
              return (
                <Fragment key={d.nhom}>
                  <tr onClick={() => onMo(d.nhom)}
                    className={`cursor-pointer border-t border-line/60 font-medium transition-colors ${loc === khoaD ? 'bg-primary-wash' : 'hover:bg-surface-muted/60'}`}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Icon name={dangMo ? 'chevron-down' : 'chevron-right'} size={14} className="text-ink-soft" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); onLoc(loc === khoaD ? null : khoaD); }}
                          className={`text-left hover:underline ${loc === khoaD ? 'text-primary' : 'text-ink'}`}
                          title="Lọc chi tiết theo dây chuyền này">{d.ten}</button>
                        <span className="text-[11px] font-normal text-ink-soft">{d.chuyen.length} chuyền · {d.so_luot} lượt</span>
                      </div>
                    </td>
                    <OSoDong x={d} />
                  </tr>
                  {dangMo && d.chuyen.map((c) => {
                    const khoaC = `C:${c.ma_chuyen || '—'}`;
                    return (
                      <tr key={khoaC} onClick={() => onLoc(loc === khoaC ? null : khoaC)}
                        className={`cursor-pointer border-t border-line/40 text-ink-soft transition-colors ${loc === khoaC ? 'bg-primary-wash text-primary' : 'hover:bg-surface-muted/60'}`}>
                        <td className="py-1.5 pl-10 pr-3">
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
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-line bg-surface-muted font-semibold text-ink">
              <tr>
                <td className="px-3 py-2">Tổng</td>
                <OSoDong x={data.tong} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default function BaoCaoKiemHangPage() {
  const { toast, show } = useToast();
  const homNay = ngayLocalISO(new Date());
  const [khoang, setKhoang] = useState(() => NHANH[0].tinh(homNay));
  const [search, setSearch] = useState('');
  const [loc, setLoc] = useState(null);      // 'N:<nhóm>' | 'C:<mã chuyền>'
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
      const res = await getBaoCaoKiemHang(tu, den);
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
  const chiTiet = useMemo(() => (data ? data.chi_tiet : [])
    .map((r) => ({ ...r, ten_nhom: tenNhom.get(r.nhom) || r.nhom }))
    .filter((r) => (
      (!loc || (loc.startsWith('N:') ? `N:${r.nhom}` === loc : `C:${r.ma_chuyen || '—'}` === loc))
      && (!kw || khopNhieu([r.ma_tem, r.ma_chuyen, r.ma_lenh_san_xuat, r.ma_phan, r.khach, r.po, r.ma_hang, r.mau_vai, r.nguoi_kiem], kw))
    )), [data, tenNhom, loc, kw]);
  const tongLoc = useMemo(() => chiTiet.reduce((s, r) => ({
    kiem: s.kiem + r.sl_kiem, khongDat: s.khongDat + r.sl_sua + r.sl_huy,
  }), { kiem: 0, khongDat: 0 }), [chiTiet]);
  const dangLoc = !!(loc || kw);
  const nhanLoc = loc ? (loc.startsWith('N:') ? `Dây chuyền ${tenNhom.get(loc.slice(2)) || loc.slice(2)}` : `Chuyền ${loc.slice(2)}`) : '';

  const doExcel = async () => {
    if (!data) return;
    setDangXuat(true);
    try {
      await exportBaoCaoKiemHang(data, { chiTiet, moTaLoc: [nhanLoc, search && `tìm: ${search}`].filter(Boolean).join(' · ') });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setDangXuat(false);
    }
  };

  const columns = [
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
    { key: 'sl_kiem', header: 'SL kiểm', className: 'text-right tabular-nums font-medium', render: (r) => fmtNum(r.sl_kiem) },
    { key: 'sl_dat', header: 'Đạt', className: 'text-right tabular-nums text-emerald-700 dark:text-emerald-400', render: (r) => fmtNum(r.sl_dat) },
    { key: 'sl_sua', header: 'Sửa', className: 'text-right tabular-nums', render: (r) => (
      <div className="leading-tight">
        <div className={r.sl_sua ? 'text-amber-700 dark:text-amber-400' : 'text-ink-soft'}>{fmtNum(r.sl_sua)}</div>
        {r.chua_phan_loai ? <div className="text-[10px] text-ink-soft">chưa phân loại</div> : null}
      </div>
    ) },
    { key: 'sl_huy', header: 'Hủy', className: 'text-right tabular-nums', render: (r) => (
      <span className={r.sl_huy ? 'text-rose-600 dark:text-rose-400' : 'text-ink-soft'}>{fmtNum(r.sl_huy)}</span>
    ) },
    { key: 'nguoi_kiem', header: 'Người kiểm', render: (r) => r.nguoi_kiem || '—' },
  ];

  const tong = data && !cuKhoang ? data.tong : null;

  return (
    <div>
      <Toolbar title="Báo cáo kết quả kiểm hàng" search={search} onSearch={setSearch}
        searchPlaceholder="Tìm mã tem, chuyền, code phần, mã hàng...">
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
              <OSo icon="shield-check" nhan="SL kiểm" giaTri={tong ? fmtNum(tong.sl_kiem) : '—'} tone="primary"
                phu={tong ? `${tong.so_luot} lượt · ${tong.so_tem} tem · ${tu === den ? `ngày SX ${hienNgay(tu)}` : `${hienNgay(tu)} → ${hienNgay(den)}`}` : null} />
              <OSo icon="check-circle" nhan="Đạt" giaTri={tong ? pt(tong.ty_le_dat) : '—'} tone="success"
                phu={tong ? `${fmtNum(tong.sl_dat)} pcs` : null} />
              <OSo icon="wrench" nhan="Sửa" giaTri={tong ? pt(tong.ty_le_sua) : '—'} tone="warning"
                phu={tong ? `${fmtNum(tong.sl_sua)} pcs${data.chua_phan_loai ? ` · ${data.chua_phan_loai} lượt chưa phân loại` : ''}` : null} />
              <OSo icon="alert-triangle" nhan="Hủy · % không đạt" giaTri={tong ? pt(tong.ty_le_huy) : '—'} tone="danger"
                phu={tong ? `${fmtNum(tong.sl_huy)} pcs · K.đạt ${pt(tong.ty_le_khong_dat)}` : null} />
            </div>

            <BangDayChuyen data={data} mo={mo} onMo={doiMo} loc={loc} onLoc={setLoc} />

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">Chi tiết lượt kiểm</h3>
                <Badge tone="info">{chiTiet.length} lượt · {fmtNum(tongLoc.kiem)} pcs · K.đạt {pt(tongLoc.kiem ? tongLoc.khongDat / tongLoc.kiem : null)}</Badge>
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
              <DataTable columns={columns} rows={chiTiet} rowKey="id" loading={!data && dangTai}
                emptyText={dangLoc ? 'Không có lượt kiểm nào khớp bộ lọc' : 'Không có lượt kiểm nào trong khoảng ngày này'} />
            </div>
          </div>
        ) : null}
      </div>
      <Toast toast={toast} />
    </div>
  );
}
