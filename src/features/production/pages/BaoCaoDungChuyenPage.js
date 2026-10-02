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
import { getBaoCaoDungChuyen } from '../../../services/productionService';
import { ngayLocalISO } from '../../../utils/format';
import { khopNhieu, chuanTuKhoa } from '../../../utils/timKiem';
import exportBaoCaoDungChuyen from '../utils/exportBaoCaoDungChuyen';

// ─────────────────────────────────────────────────────────────────────────────
// BÁO CÁO BẤT THƯỜNG DỪNG CHUYỀN (Sản xuất › Báo cáo dừng chuyền, 02/10/2026)
// Nguồn = các lần "Ngừng chuyền" người đứng máy ghi ở RunPanel (lý do chọn từ danh mục). Một lượt API
// (`GET /production/bao-cao-dung-chuyen`) trả đủ: số tổng · theo nguyên nhân · theo chuyền · chi tiết.
// Luật (ngày SX 06:00→06:00, ca theo tuần, lần dừng chưa bấm "hoạt động lại") ở backend
// `utils/baoCaoDungChuyen.js`.
//   · 2 bảng tổng hợp tính trên CẢ khoảng ngày; bấm 1 dòng ở đó = lọc bảng chi tiết (bấm lại để bỏ).
//   · Ô tìm chỉ lọc bảng chi tiết (không dấu — `utils/timKiem`). Excel = tổng hợp + chi tiết ĐANG HIỆN.
//   · Khoảng ngày chứa hôm nay ⇒ nghe socket `production:updated`, tải ngầm.
// ─────────────────────────────────────────────────────────────────────────────

const doiNgay = (iso, soNgay) => {
  const [y, m, d] = iso.split('-').map(Number);
  return ngayLocalISO(new Date(y, m - 1, d + soNgay));
};
const hienNgay = (iso) => String(iso || '').split('-').reverse().join('/');
const gioPhut = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
const ngayGio = (t) => (t ? new Date(t).toLocaleString('vi-VN', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '');

// 125 → "2 giờ 05 phút" · 40 → "40 phút".
function fmtPhut(p) {
  const n = Math.max(0, Math.round(Number(p) || 0));
  if (n < 60) return `${n} phút`;
  const g = Math.floor(n / 60);
  const ph = n % 60;
  return ph ? `${g} giờ ${String(ph).padStart(2, '0')} phút` : `${g} giờ`;
}
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

const NHANH = [
  { v: 'HOM_NAY', label: 'Hôm nay', tinh: (h) => ({ from: h, to: h }) },
  { v: '7_NGAY', label: '7 ngày', tinh: (h) => ({ from: doiNgay(h, -6), to: h }) },
  { v: '30_NGAY', label: '30 ngày', tinh: (h) => ({ from: doiNgay(h, -29), to: h }) },
  { v: 'THANG', label: 'Tháng này', tinh: (h) => ({ from: `${h.slice(0, 8)}01`, to: h }) },
];

function OSo({ icon, nhan, giaTri, phu, tone = 'default' }) {
  const mau = {
    default: 'text-ink', primary: 'text-primary', warning: 'text-amber-600 dark:text-amber-400', danger: 'text-rose-600 dark:text-rose-400',
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

// Bảng tổng hợp gọn (nguyên nhân / chuyền) + thanh tỷ lệ thời gian. Bấm dòng = lọc chi tiết.
function BangTongHop({ tieuDe, icon, cotDau, rows, khoa, dangChon, onChon, cotPhu }) {
  return (
    <div className="flex min-h-0 flex-col rounded-card border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name={icon} size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-ink">{tieuDe}</h3>
        <span className="ml-auto text-xs text-ink-soft">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-ink-soft">—</div>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted text-xs text-ink-soft">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{cotDau}</th>
                <th className="px-3 py-2 text-right font-medium">Lần</th>
                <th className="px-3 py-2 text-right font-medium">Thời gian</th>
                <th className="w-32 px-3 py-2 text-left font-medium">% thời gian</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const k = khoa(r);
                const chon = dangChon === k;
                return (
                  <tr key={k} onClick={() => onChon(chon ? null : k)}
                    className={`cursor-pointer border-t border-line/60 transition-colors ${chon ? 'bg-primary-wash' : 'hover:bg-surface-muted/60'}`}>
                    <td className="px-3 py-2">
                      <div className={`font-medium ${chon ? 'text-primary' : 'text-ink'}`}>{cotPhu.ten(r)}</div>
                      {cotPhu.phu(r) ? <div className="max-w-[260px] truncate text-xs text-ink-soft" title={cotPhu.phu(r)}>{cotPhu.phu(r)}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.so_lan}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtPhut(r.so_phut)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((r.ty_le || 0) * 100)}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-ink-soft">{nf.format((r.ty_le || 0) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const khoaLyDo = (r) => r.ly_do_id || `#${r.nguyen_nhan}`;
const khoaChuyen = (r) => r.ma_chuyen || '—';
const PHU_LY_DO = { ten: (r) => r.nguyen_nhan, phu: (r) => (r.chuyen ? `Chuyền: ${r.chuyen}` : '') };
const PHU_CHUYEN = {
  ten: (r) => r.ma_chuyen || '— (không rõ chuyền)',
  phu: (r) => [r.loai_chuyen, r.nguyen_nhan_chinh ? `chủ yếu: ${r.nguyen_nhan_chinh}` : ''].filter(Boolean).join(' · '),
};

export default function BaoCaoDungChuyenPage() {
  const { toast, show } = useToast();
  const homNay = ngayLocalISO(new Date());
  const [khoang, setKhoang] = useState(() => NHANH[1].tinh(homNay));
  const [search, setSearch] = useState('');
  const [locLyDo, setLocLyDo] = useState(null);
  const [locChuyen, setLocChuyen] = useState(null);
  const [data, setData] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState('');
  const [dangXuat, setDangXuat] = useState(false);
  const yeuCau = useRef(0);

  // Ô ngày bị xóa trắng ⇒ coi như hôm nay (báo cáo luôn có một khoảng cụ thể).
  const tu = khoang.from || khoang.to || homNay;
  const den = khoang.to || khoang.from || homNay;

  // `ngam` = tải lại nền (socket): giữ bảng cũ, không báo lỗi.
  const tai = useCallback(async (ngam = false) => {
    const lan = ++yeuCau.current;
    if (!ngam) setLoi('');
    setDangTai(true);
    try {
      const res = await getBaoCaoDungChuyen(tu, den);
      if (lan === yeuCau.current) setData(res.data);
    } catch (e) {
      if (lan === yeuCau.current && !ngam) setLoi(e.message || 'Không tải được báo cáo');
    } finally {
      if (lan === yeuCau.current) setDangTai(false);
    }
  }, [tu, den]);

  useEffect(() => { tai(); }, [tai]);
  const coHomNay = tu <= homNay && den >= homNay;
  useSocketReload(['production:updated', 'dashboard:refresh'], () => { if (coHomNay) tai(true); }, 1200);

  // Đổi khoảng ngày ⇒ bỏ lọc nguyên nhân/chuyền (khóa cũ có thể không còn trong khoảng mới).
  const doiKhoang = (v) => { setKhoang(v); setLocLyDo(null); setLocChuyen(null); };
  const nhanhDangChon = (NHANH.find((n) => {
    const x = n.tinh(homNay);
    return x.from === tu && x.to === den;
  }) || {}).v;

  const cuKhoang = !!data && (data.tu_ngay !== tu || data.den_ngay !== den);
  const kw = chuanTuKhoa(search);
  const chiTiet = useMemo(() => (data ? data.chi_tiet : []).filter((r) => (
    (!locLyDo || khoaLyDo(r) === locLyDo)
    && (!locChuyen || khoaChuyen(r) === locChuyen)
    && (!kw || khopNhieu([r.ma_chuyen, r.ten_chuyen, r.ma_to, r.nguyen_nhan, r.ma_ly_do, r.ghi_chu, r.ma_lenh_san_xuat,
      r.ma_phan, r.khach, r.po, r.ma_hang, r.mau_vai, r.nguoi_ghi], kw))
  )), [data, locLyDo, locChuyen, kw]);
  const tongLoc = useMemo(() => chiTiet.reduce((s, r) => s + r.so_phut, 0), [chiTiet]);
  const dangLoc = !!(locLyDo || locChuyen || kw);

  const doExcel = async () => {
    if (!data) return;
    setDangXuat(true);
    try {
      const nnChon = locLyDo && (data.theo_ly_do.find((r) => khoaLyDo(r) === locLyDo) || {}).nguyen_nhan;
      const moTaLoc = [nnChon && `nguyên nhân: ${nnChon}`, locChuyen && `chuyền: ${locChuyen}`, search && `tìm: ${search}`]
        .filter(Boolean).join(' · ');
      await exportBaoCaoDungChuyen({ ...data, chi_tiet: chiTiet }, { moTaLoc });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setDangXuat(false);
    }
  };

  const columns = [
    { key: 'tg_bd', header: 'Bắt đầu', className: 'whitespace-nowrap tabular-nums', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{ngayGio(r.tg_bd)}</div>
        <div className="text-[11px] text-ink-soft">Ngày SX {hienNgay(r.ngay_sx)} · {r.ca || '—'}</div>
      </div>
    ) },
    { key: 'tg_kt', header: 'Kết thúc', className: 'whitespace-nowrap tabular-nums', render: (r) => {
      if (r.dang_dung) return <Badge tone="danger">Đang dừng</Badge>;
      if (r.chua_ket_thuc) return <span title="Chưa bấm 'Chuyền hoạt động lại' — thời gian tính tới lúc phiếu kết thúc"><Badge tone="warning">Chưa ghi giờ kết thúc</Badge></span>;
      return gioPhut(r.tg_kt);
    } },
    { key: 'so_phut', header: 'Thời gian', className: 'whitespace-nowrap text-right tabular-nums font-semibold', render: (r) => (
      <span className={r.so_phut >= 60 ? 'text-rose-600 dark:text-rose-400' : 'text-ink'}>{fmtPhut(r.so_phut)}</span>
    ) },
    { key: 'chuyen', header: 'Chuyền · Tổ', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ma_chuyen || '—'}</div>
        <div className="text-[11px] text-ink-soft">{[r.loai_chuyen, r.ma_to].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'nguyen_nhan', header: 'Nguyên nhân', render: (r) => (
      <div className="max-w-[280px] leading-tight">
        <div className="font-medium text-ink">{r.nguyen_nhan}</div>
        {r.ghi_chu ? <div className="mt-0.5 text-xs text-ink-soft">{r.ghi_chu}</div> : null}
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
    { key: 'nguoi_ghi', header: 'Người ghi', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.nguoi_ghi || '—'}</div>
        {r.nguoi_ket_thuc && r.nguoi_ket_thuc !== r.nguoi_ghi
          ? <div className="text-[11px] text-ink-soft">Hoạt động lại: {r.nguoi_ket_thuc}</div> : null}
      </div>
    ) },
  ];

  const tong = data && !cuKhoang ? data.tong : null;

  return (
    <div>
      <Toolbar title="Báo cáo bất thường dừng chuyền" search={search} onSearch={setSearch}
        searchPlaceholder="Tìm chuyền, nguyên nhân, code phần...">
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
              <OSo icon="pause" nhan="Số lần dừng" giaTri={tong ? tong.so_lan : '—'} tone="primary"
                phu={tu === den ? `Ngày SX ${hienNgay(tu)}` : `${hienNgay(tu)} → ${hienNgay(den)}`} />
              <OSo icon="clock" nhan="Tổng thời gian dừng" giaTri={tong ? fmtPhut(tong.so_phut) : '—'}
                phu={tong && tong.so_lan ? `TB ${fmtPhut(tong.so_phut / tong.so_lan)} / lần` : null} />
              <OSo icon="factory" nhan="Số chuyền bị dừng" giaTri={tong ? tong.so_chuyen : '—'} />
              <OSo icon="alert-triangle" nhan="Chưa bấm hoạt động lại" giaTri={tong ? tong.chua_ket_thuc : '—'}
                tone={tong && tong.chua_ket_thuc ? 'warning' : 'default'}
                phu={tong && tong.dang_dung ? `${tong.dang_dung} lần phiếu vẫn đang chạy` : null} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <BangTongHop tieuDe="Theo nguyên nhân" icon="list" cotDau="Nguyên nhân"
                rows={data.theo_ly_do} khoa={khoaLyDo} dangChon={locLyDo} onChon={setLocLyDo} cotPhu={PHU_LY_DO} />
              <BangTongHop tieuDe="Theo chuyền" icon="factory" cotDau="Chuyền"
                rows={data.theo_chuyen} khoa={khoaChuyen} dangChon={locChuyen} onChon={setLocChuyen} cotPhu={PHU_CHUYEN} />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">Chi tiết lần dừng</h3>
                <Badge tone="info">{chiTiet.length} lần · {fmtPhut(tongLoc)}</Badge>
                {locLyDo && (
                  <button type="button" onClick={() => setLocLyDo(null)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-3 py-1 text-xs font-medium text-primary hover:text-danger">
                    {(data.theo_ly_do.find((r) => khoaLyDo(r) === locLyDo) || {}).nguyen_nhan || 'Nguyên nhân'}
                    <Icon name="x" size={12} />
                  </button>
                )}
                {locChuyen && (
                  <button type="button" onClick={() => setLocChuyen(null)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-3 py-1 text-xs font-medium text-primary hover:text-danger">
                    Chuyền {locChuyen}
                    <Icon name="x" size={12} />
                  </button>
                )}
                {dangLoc && (
                  <button type="button" onClick={() => { setLocLyDo(null); setLocChuyen(null); setSearch(''); }}
                    className="text-xs font-medium text-ink-soft underline hover:text-danger">Bỏ lọc</button>
                )}
              </div>
              <DataTable columns={columns} rows={chiTiet} rowKey="id" loading={!data && dangTai}
                rowClassName={(r) => (r.dang_dung ? 'bg-rose-50/60 dark:bg-rose-950/20' : r.chua_ket_thuc ? 'bg-amber-50/60 dark:bg-amber-950/20' : '')}
                emptyText={dangLoc ? 'Không có lần dừng nào khớp bộ lọc' : 'Không có lần dừng chuyền nào trong khoảng ngày này'} />
            </div>
          </div>
        ) : null}
      </div>
      <Toast toast={toast} />
    </div>
  );
}
