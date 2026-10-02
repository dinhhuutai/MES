import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Spinner from '../../../components/common/Spinner';
import Icon from '../../../components/common/Icon';
import useSocketReload from '../../../hooks/useSocketReload';
import { getBaoCaoSanXuat } from '../../../services/productionService';
import { ngayLocalISO } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// BÁO CÁO SẢN XUẤT NGÀY (Sản xuất › Báo cáo sản xuất, 02/10/2026)
// 2 bảng từ CÙNG một lượt API (`GET /production/bao-cao-ngay`) ⇒ bấm chuyển bảng là đổi ngay, không tải lại:
//   · "Theo tổ · khu chuyền": Tổ in (C1…) × nhóm chuyền MTD · Banin · RB · MT · LG · MEP + dòng Tổng.
//   · "Chi tiết phần in"    : 1 dòng / (chuyền × phần in).
// Mỗi cột-nhóm (Tổng · HC · CA1 · CA2 · CA3): SL kế hoạch · SL in thực tế · % (= TT / KH) · Số giờ KH ·
// Số giờ TT · C.lệch giờ (= TT − KH). Luật tính ở backend `utils/baoCaoSanXuat.js`.
// Chuyển bảng: viên chọn trượt theo nút + bảng trượt/hiện dần theo hướng bấm (CSS thuần — không kéo
// thêm thư viện hiệu ứng vào bundle, ưu tiên tải nhanh). Ngày hôm nay ⇒ nghe socket tải ngầm.
// ─────────────────────────────────────────────────────────────────────────────

const NHOM_CA = [
  { k: 'TONG', l: 'Tổng' }, { k: 'HC', l: 'HC' }, { k: 'CA1', l: 'CA1' }, { k: 'CA2', l: 'CA2' }, { k: 'CA3', l: 'CA3' },
];
const COT_SO = ['SL kế hoạch', 'SL in thực tế', '%', 'Số giờ KH', 'Số giờ TT', 'C.lệch giờ'];
const BANG = [
  { v: 'TO', label: 'Theo tổ · khu chuyền', icon: 'layout' },
  { v: 'CT', label: 'Chi tiết phần in', icon: 'list' },
];
const TEN_CA = { NGAN: 'Ca ngắn · CA1–CA3', DAI: 'Ca dài · CA1–CA2', HANH_CHINH: 'Hành chính' };
const COT_CT = [
  { k: 'ma_chuyen', l: 'Chuyền', w: 'w-[76px] min-w-[76px] max-w-[76px]' },
  { k: 'khach', l: 'Khách hàng', w: 'w-[112px] min-w-[112px] max-w-[112px]' },
  { k: 'po', l: 'PO', w: 'min-w-[120px] max-w-[160px]' },
  { k: 'ma_hang', l: 'Mã hàng', w: 'min-w-[140px] max-w-[200px]' },
  { k: 'mau_vai', l: 'Màu vải', w: 'min-w-[90px] max-w-[130px]' },
  { k: 'kich_vai', l: 'Kích vải', w: 'min-w-[80px]' },
  { k: 'kich_phim', l: 'Kích phim', w: 'min-w-[80px]' },
];

const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nhoXiu = (v) => Math.abs(Number(v) || 0) < 0.005;
const Gach = () => <span className="text-ink-soft/50">-</span>;

// Nền nhẹ xen kẽ cho từng cột-nhóm ca ⇒ mắt bám đúng cột trên bảng rất rộng.
const NEN_NHOM = {
  TONG: 'bg-primary-wash/40', HC: '', CA1: 'bg-surface-muted/40', CA2: '', CA3: 'bg-surface-muted/40',
};

// 'YYYY-MM-DD' → 'DD/MM/YYYY' bằng tách chuỗi (dựng Date từ chuỗi ISO là hiểu theo UTC ⇒ có thể lệch ngày).
const hienNgay = (iso) => String(iso || '').split('-').reverse().join('/');

const doiNgay = (iso, soNgay) => {
  const [y, m, d] = iso.split('-').map(Number);
  return ngayLocalISO(new Date(y, m - 1, d + soNgay));
};

// 6 ô số của 1 cột-nhóm ca.
function OSo({ m, nhom, dam }) {
  const o = m || {};
  const kh = Number(o.kh) || 0;
  const tt = Number(o.tt) || 0;
  const lech = (Number(o.gt) || 0) - (Number(o.gk) || 0);
  const td = `px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${NEN_NHOM[nhom]} ${dam ? 'font-semibold' : ''}`;
  return (
    <>
      <td className={`${td} border-l border-line`}>{Math.round(kh) ? nf0.format(Math.round(kh)) : <Gach />}</td>
      <td className={td}>{tt ? nf0.format(tt) : <Gach />}</td>
      <td className={td}>{kh > 0 ? `${nf2.format((tt / kh) * 100)}%` : <Gach />}</td>
      <td className={td}>{nhoXiu(o.gk) ? <Gach /> : nf2.format(o.gk)}</td>
      <td className={td}>{nhoXiu(o.gt) ? <Gach /> : nf2.format(o.gt)}</td>
      <td className={`${td} ${lech > 0.005 ? 'text-rose-600 dark:text-rose-400' : lech < -0.005 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
        {nhoXiu(lech) ? <Gach /> : `${lech > 0 ? '+' : '−'}${nf2.format(Math.abs(lech))}`}
      </td>
    </>
  );
}

// 2 hàng tiêu đề: cột cố định (rowSpan 2) + 5 cột-nhóm ca × 6 cột số. Dính đầu bảng khi cuộn.
function TieuDe({ cotTrai }) {
  const th = 'border-b border-line bg-surface-muted px-2 text-xs font-semibold text-ink whitespace-nowrap';
  return (
    <thead>
      <tr>
        {cotTrai.map((c) => (
          <th key={c.l} rowSpan={2} className={`${th} sticky top-0 z-30 h-[68px] text-left align-middle ${c.dinh || ''} ${c.w || ''}`}>{c.l}</th>
        ))}
        {NHOM_CA.map((n) => (
          <th key={n.k} colSpan={6} className={`${th} sticky top-0 z-20 h-8 border-l text-center ${n.k === 'TONG' ? 'text-primary' : ''}`}>{n.l}</th>
        ))}
      </tr>
      <tr>
        {NHOM_CA.map((n) => COT_SO.map((c, i) => (
          <th key={`${n.k}-${c}`} className={`${th} sticky top-8 z-20 h-9 text-right font-medium text-ink-soft ${i === 0 ? 'border-l' : ''}`}>{c}</th>
        )))}
      </tr>
    </thead>
  );
}

// Bảng 1 — tổ × nhóm chuyền. Ô Tổ gộp dọc; dòng Tổng mỗi tổ + Tổng cộng cuối bảng.
function BangTheoTo({ data }) {
  const cotTrai = [
    { l: 'Tổ', dinh: 'left-0', w: 'w-[64px] min-w-[64px] max-w-[64px]' },
    { l: 'Chuyền', dinh: 'left-[64px]', w: 'w-[84px] min-w-[84px] max-w-[84px]' },
  ];
  return (
    <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
      <TieuDe cotTrai={cotTrai} />
      <tbody>
        {data.theo_to.map((g) => (
          <TheoToKhoi key={g.ma_to || '_'} g={g} />
        ))}
        {data.theo_to.length > 1 && (
          <tr>
            <td colSpan={2} className="sticky left-0 z-10 border-t-2 border-line bg-surface-muted px-2 py-2 font-bold text-ink">Tổng cộng</td>
            {NHOM_CA.map((n) => <OSo key={n.k} m={data.tong[n.k]} nhom={n.k} dam />)}
          </tr>
        )}
      </tbody>
    </table>
  );
}

function TheoToKhoi({ g }) {
  const soDong = g.nhom.length + 1;
  return (
    <>
      {g.nhom.map((n, i) => (
        <tr key={n.key}>
          {i === 0 && (
            <td rowSpan={soDong} title={g.ten_to}
              className="sticky left-0 z-10 border-b border-line bg-surface px-2 text-center align-middle font-semibold text-ink">
              {g.ma_to || <span className="text-[11px] font-normal text-ink-soft">{g.ten_to}</span>}
            </td>
          )}
          <td className="sticky left-[64px] z-10 border-b border-line/60 bg-surface px-2 py-1.5 text-ink">{n.label}</td>
          {NHOM_CA.map((c) => <OSo key={c.k} m={n.m[c.k]} nhom={c.k} />)}
        </tr>
      ))}
      <tr className="bg-surface-muted/70">
        <td className="sticky left-[64px] z-10 border-b border-line bg-surface-muted px-2 py-1.5 font-semibold text-ink">Tổng</td>
        {NHOM_CA.map((c) => <OSo key={c.k} m={g.tong[c.k]} nhom={c.k} dam />)}
      </tr>
    </>
  );
}

// Bảng 2 — chi tiết (chuyền × phần in). Ô Chuyền gộp dọc theo các dòng liên tiếp cùng chuyền.
function BangChiTiet({ data }) {
  const rows = data.chi_tiet;
  const span = useMemo(() => {
    const s = new Array(rows.length).fill(0);
    for (let i = 0; i < rows.length;) {
      let j = i;
      while (j < rows.length && rows[j].ma_chuyen === rows[i].ma_chuyen) j += 1;
      s[i] = j - i;
      i = j;
    }
    return s;
  }, [rows]);
  const cotTrai = COT_CT.map((c, i) => ({
    ...c, dinh: i === 0 ? 'left-0' : i === 1 ? 'left-[76px]' : '',
  }));
  return (
    <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
      <TieuDe cotTrai={cotTrai} />
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.ma_chuyen}|${r.ma_phan}|${i}`}>
            {span[i] > 0 && (
              <td rowSpan={span[i]} title={r.ten_chuyen || r.ma_chuyen}
                className="sticky left-0 z-10 border-b border-line bg-surface px-2 align-middle font-semibold text-ink">
                {r.ma_chuyen}
              </td>
            )}
            <td className="sticky left-[76px] z-10 max-w-[112px] truncate border-b border-line/60 bg-surface px-2 py-1.5 text-ink" title={r.khach || ''}>{r.khach || '—'}</td>
            {COT_CT.slice(2).map((c) => (
              <td key={c.k} title={r[c.k] || ''} className={`truncate border-b border-line/60 px-2 py-1.5 text-ink ${c.w}`}>
                {r[c.k] || '—'}
              </td>
            ))}
            {NHOM_CA.map((c) => <OSo key={c.k} m={r.m[c.k]} nhom={c.k} />)}
          </tr>
        ))}
        {rows.length > 1 && (
          <tr>
            <td colSpan={COT_CT.length} className="sticky left-0 z-10 border-t-2 border-line bg-surface-muted px-2 py-2 font-bold text-ink">Tổng cộng</td>
            {NHOM_CA.map((n) => <OSo key={n.k} m={data.tong[n.k]} nhom={n.k} dam />)}
          </tr>
        )}
      </tbody>
    </table>
  );
}

// Dải chọn bảng — viên nền TRƯỢT theo nút đang chọn (đo vị trí thật của nút, không đoán bề rộng chữ).
function ChonBang({ value, onChange }) {
  const refs = useRef({});
  const [vien, setVien] = useState(null);
  const do_ = useCallback(() => {
    const el = refs.current[value];
    if (el) setVien({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);
  useLayoutEffect(() => { do_(); }, [do_]);
  useEffect(() => {
    window.addEventListener('resize', do_);
    return () => window.removeEventListener('resize', do_);
  }, [do_]);
  return (
    <div role="tablist" className="relative inline-flex h-10 items-center rounded-full border border-line bg-surface-muted p-1">
      {vien && (
        <span aria-hidden="true"
          className="absolute bottom-1 top-1 rounded-full bg-surface shadow-sm ring-1 ring-line transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ left: vien.left, width: vien.width }} />
      )}
      {BANG.map((b) => (
        <button key={b.v} type="button" role="tab" aria-selected={value === b.v}
          ref={(el) => { refs.current[b.v] = el; }}
          onClick={() => onChange(b.v)}
          className={`relative z-10 inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors duration-200 ${value === b.v ? 'text-primary' : 'text-ink-soft hover:text-ink'}`}>
          <Icon name={b.icon} size={15} />
          {b.label}
        </button>
      ))}
    </div>
  );
}

export default function BaoCaoSanXuatPage() {
  const homNay = ngayLocalISO(new Date());
  const [ngay, setNgay] = useState(homNay);
  const [bang, setBang] = useState(() => {
    try { return localStorage.getItem('bcsx.bang') === 'CT' ? 'CT' : 'TO'; } catch { return 'TO'; }
  });
  const [huong, setHuong] = useState('phai');
  const [data, setData] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState('');
  const yeuCau = useRef(0);

  // `ngam` = tải lại nền (socket / đổi ngày khi đã có dữ liệu): giữ bảng cũ, chỉ hiện vạch mảnh.
  const tai = useCallback(async (ngayTai, ngam = false) => {
    const lan = ++yeuCau.current;
    if (!ngam) setLoi('');
    setDangTai(true);
    try {
      const res = await getBaoCaoSanXuat(ngayTai);
      if (lan === yeuCau.current) setData(res.data);
    } catch (e) {
      if (lan === yeuCau.current && !ngam) setLoi(e.message || 'Không tải được báo cáo');
    } finally {
      if (lan === yeuCau.current) setDangTai(false);
    }
  }, []);

  useEffect(() => { tai(ngay); }, [ngay, tai]);
  const laHomNay = ngay === homNay;
  useSocketReload(['production:updated', 'dashboard:refresh'], () => { if (laHomNay) tai(ngay, true); }, 1200);

  const chonBang = (v) => {
    if (v === bang) return;
    setHuong(v === 'CT' ? 'phai' : 'trai');
    setBang(v);
    try { localStorage.setItem('bcsx.bang', v); } catch { /* bỏ qua */ }
  };

  // Đổi ngày: GIỮ bảng cũ (mờ đi) tới khi số ngày mới về — không nháy spinner (API có cache, thường <0,2s).
  const dangXem = data;
  const cuNgay = !!data && data.ngay !== ngay;
  const rong = dangXem && !cuNgay && !dangXem.chi_tiet.length;

  return (
    <div>
      <Toolbar title="Báo cáo sản xuất">
        <ChonBang value={bang} onChange={chonBang} />
        <div className="flex h-10 items-center rounded-input border border-line bg-surface">
          <button type="button" title="Ngày trước" onClick={() => setNgay((d) => doiNgay(d, -1))}
            className="flex h-full w-9 items-center justify-center text-ink-soft hover:text-ink">
            <Icon name="chevron-left" size={16} />
          </button>
          <input type="date" value={ngay} max={homNay}
            onChange={(e) => e.target.value && setNgay(e.target.value)}
            className="h-full border-x border-line bg-transparent px-2 text-sm text-ink outline-none" />
          <button type="button" title="Ngày sau" disabled={ngay >= homNay} onClick={() => setNgay((d) => doiNgay(d, 1))}
            className="flex h-full w-9 items-center justify-center text-ink-soft hover:text-ink disabled:opacity-30">
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
        {!laHomNay && (
          <button type="button" onClick={() => setNgay(homNay)}
            className="h-10 rounded-control px-3 text-sm font-medium text-primary hover:bg-primary-wash">Hôm nay</button>
        )}
      </Toolbar>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span className="font-semibold text-ink">BÁO CÁO SẢN XUẤT NGÀY {hienNgay(ngay)}</span>
        {dangXem && !cuNgay && (
          <span className="rounded-full bg-surface-muted px-2 py-0.5" title={dangXem.loai_ca_da_cai ? 'Theo cài đặt ca của tuần' : 'Tuần chưa cài loại ca — suy theo mã ca trên tem'}>
            {TEN_CA[dangXem.loai_ca] || dangXem.loai_ca}{dangXem.loai_ca_da_cai ? '' : ' (theo tem)'}
          </span>
        )}
      </div>

      <div className="relative">
        {dangTai && dangXem && (
          <div className="absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden rounded-full bg-primary/10">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        )}
        {!dangXem && dangTai ? (
          <div className="flex justify-center py-20"><Spinner size={32} /></div>
        ) : loi ? (
          <div className="rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loi}</div>
        ) : rong ? (
          <div className="rounded-card border border-dashed border-line py-16 text-center text-sm text-ink-soft">
            Không có chuyền nào in trong ngày {hienNgay(ngay)}.
          </div>
        ) : dangXem ? (
          <div key={bang}
            className={`max-h-[calc(100vh-13.5rem)] overflow-auto rounded-card border border-line bg-surface transition-opacity duration-200 motion-reduce:animate-none ${huong === 'phai' ? 'animate-vao-tu-phai' : 'animate-vao-tu-trai'} ${cuNgay ? 'opacity-50' : ''}`}>
            {bang === 'TO' ? <BangTheoTo data={dangXem} /> : <BangChiTiet data={dangXem} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}
