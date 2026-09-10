import { useCallback, useEffect, useMemo, useState } from 'react';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Spinner from '../../../components/common/Spinner';
import Pagination from '../../../components/common/Pagination';
import DateRangePicker from '../../../components/common/DateRangePicker';
import exportPanelExcel from '../../../components/common/exportPanelExcel';
import { Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import { getKpiReady } from '../../../services/kpiReadyService';
import { fmtNum, fmtDate, fmtDateTime } from '../../../utils/format';
import { khopNhieu, chuanTuKhoa } from '../../../utils/timKiem';
import { KpiCard } from '../components/charts';
import {
  gopTheoDon, dongTong, dongPhanTram, fmtPt, fmtPhut,
  tachTheoDotVai, giaTriTheoDot, COT_THEO_DOT, COT_TRAI_THEO_DOT, viTatTen,
} from '../utils/kpiReadyTable';

// ⚠ Cột bên TRÁI (thông tin phần in) khai ở đây; 23 cột checklist do BACKEND trả về (`data.cot`)
//   nên thêm/bớt cột chỉ phải sửa `utils/kpiReady.js` — xem cảnh báo ở đầu file đó.
// ⚠⚠ THỨ TỰ CỘT = RANH GIỚI HỢP NHẤT (người dùng chốt 08/09/2026): ở chế độ *Chi tiết*, từ STT tới
//   SLĐH là ô HỢP NHẤT theo phần in; từ "Đợt vải" trở đi tách dòng theo đợt. Chèn cột mới phải đặt
//   đúng phía của ranh giới này, và khai vào `COT_TRAI_THEO_DOT` nếu nó có dữ liệu riêng theo đợt.
const COT_TRAI = [
  { ma: 'khach', ten: 'Khách hàng', w: 'min-w-[130px]' },
  { ma: 'don', ten: 'Đơn hàng', w: 'min-w-[120px]' },
  { ma: 'ma_hang', ten: 'Mã hàng', w: 'min-w-[120px]' },
  { ma: 'mau_vai', ten: 'Màu vải', w: 'min-w-[90px]' },
  { ma: 'kich_vai', ten: 'Kích vải', w: 'min-w-[80px]' },
  { ma: 'kich_phim', ten: 'Kích phim', w: 'min-w-[80px]' },
  { ma: 'code_phan', ten: 'Code phần', w: 'min-w-[150px]' },
  { ma: 'sldh', ten: 'SLĐH', so: true },
  { ma: 'slnv', ten: 'SLNV', so: true },
];
// ⚠ Chế độ THEO ĐƠN bỏ 5 cột từ "Mã hàng" đến "Code phần" (người dùng chốt 10/09/2026): ở mức ĐƠN
//   chúng chỉ còn là "N loại" — không đọc ra thông tin gì mà chiếm mất bề ngang của 23 cột checklist.
//   Cần xem chi tiết thì bấm sang chế độ *Chi tiết*. ⚠ Ô tìm kiếm VẪN soi 5 trường này (nó lọc trên
//   dữ liệu gốc, không phụ thuộc cột đang hiện) — gõ mã hàng ở chế độ theo đơn vẫn ra đúng đơn.
const BO_O_CHE_DO_DON = new Set(['ma_hang', 'mau_vai', 'kich_vai', 'kich_phim', 'code_phan']);
// Cột "Đợt vải" CHỈ có ở chế độ Chi tiết — chèn ngay TRƯỚC SLNV để người đọc biết dòng nào là đợt nào
// (không có nó thì mấy dòng con chỉ khác nhau ở con số, nhìn như dữ liệu lặp).
// ⚠⚠ Dữ liệu là **NGÀY VẢI VỀ** chứ không phải `ma_dot_vai` (mã ERP dài, không nói được gì) — xem
//   `giaTriTheoDot`. `ownerTu: 'vai'` = mượn owner của cột checklist "Vải" (cùng trạm `PIPELINE`),
//   KHÔNG khai owner riêng: nhà máy chỉ gán một chỗ ở *Hệ thống → Owner checkpoint/checklist*.
const COT_DOT_VAI = { ma: 'dot_vai', ten: 'Đợt vải', w: 'min-w-[110px]', ngay: true, ownerTu: 'vai' };
// 2 cột theo ĐỢT VẢI, đặt ngay SAU SLNV (người dùng chốt 10/09/2026).
const COT_NGAY_CHI_TIET = [
  { ma: 'ngay_kh', ten: 'Ngày SX KH', w: 'min-w-[110px]', ngay: true },
  { ma: 'han_giao', ten: 'Hạn giao', w: 'min-w-[110px]', ngay: true },
];
const COT_TRAI_CHI_TIET = (() => {
  const i = COT_TRAI.findIndex((c) => c.ma === 'slnv');
  return [...COT_TRAI.slice(0, i), COT_DOT_VAI, COT_TRAI[i], ...COT_NGAY_CHI_TIET, ...COT_TRAI.slice(i + 1)];
})();
// 2 cột CHỈ hiện ở chế độ "Theo đơn" (người dùng yêu cầu).
const COT_DON = [
  { ma: 'tong_phan_in', ten: 'Tổng phần in', so: true },
  { ma: 'tong_tg_ready', ten: 'Tổng TG ready (phút)', so: true },
];

const PAGE_SIZE = 20;
const TH = 'whitespace-nowrap px-2 py-1.5 text-[11px] font-semibold';
const TD = 'whitespace-nowrap px-2 py-1.5 text-xs';
// ⚠ Chiều cao TƯỜNG MINH của 2 hàng header và 2 hàng tổng — bắt buộc để tính mốc `top`/`bottom`
//   khi dính (xem chú thích ở `<thead>` / `<tfoot>`). Đổi padding/cỡ chữ thì sửa kèm 3 số này.
const H_HEAD = 30;
const H_OWNER = 28;
const H_FOOT = 29;

// `tachDot` = đang ở chế độ tách dòng theo đợt vải ⇒ 2 cột theo-đợt lấy từ `row._dot`.
const giaTriTrai = (r, ma, tachDot) => {
  if (tachDot && COT_TRAI_THEO_DOT.has(ma)) return giaTriTheoDot(r, ma);
  return {
    khach: r.ten_khach_hang, don: r.ma_don_hang, ma_hang: r.ma_hang, mau_vai: r.mau_vai,
    kich_vai: r.kich_vai, kich_phim: r.kich_phim, code_phan: r.ma_phan,
    sldh: r.so_luong_don_hang, slnv: r.so_luong_vai_ve, dot_vai: null,
    ngay_kh: null, han_giao: r.han_giao_hang,
    tong_phan_in: r.tong_phan_in, tong_tg_ready: r.tong_tg_ready_phut,
  }[ma];
};

// Ô của 1 cột checklist. `v` là giá trị đã gộp (chế độ đơn) hoặc giá trị thô (chế độ chi tiết).
// `tachDot` = dòng này thuộc một ĐỢT VẢI cụ thể ⇒ 4 cột mốc theo-đợt đọc từ `row._dot`.
function OChecklist({ cot, row, gop, tachDot }) {
  if (tachDot && COT_THEO_DOT.has(cot.ma)) {
    const t = giaTriTheoDot(row, cot.ma);
    if (!t) return <span className="text-ink-soft">—</span>;
    return <span className="text-emerald-600" title={fmtDateTime(t)}>✓</span>;
  }
  if (cot.nhom === 'pt') {
    const v = gop ? row[`_${cot.ma}`] : null;
    const tu = gop ? null : Number(row[cot.tuSo] || 0);
    const mau = gop ? null : Number(row[cot.mauSo] || 0);
    const pt = gop ? v : (mau > 0 ? (tu / mau) * 100 : null);
    return <span className="tabular-nums">{fmtPt(pt)}</span>;
  }
  if (cot.nhom === 'so') {
    const v = gop ? row[`_${cot.ma}`] : Number(row[cot.col] || 0);
    return <span className={`tabular-nums ${v ? 'text-ink' : 'text-ink-soft'}`}>{fmtNum(v)}</span>;
  }
  // Cột MỐC.
  if (gop) {
    const { qua, tong } = row[`_${cot.ma}`] || { qua: 0, tong: 0 };
    const tone = qua === 0 ? 'text-ink-soft' : qua === tong ? 'text-emerald-600 font-semibold' : 'text-amber-600';
    return <span className={`tabular-nums ${tone}`}>{qua}/{tong}</span>;
  }
  const t = row[cot.col];
  if (!t) return <span className="text-ink-soft">—</span>;
  return <span className="text-emerald-600" title={fmtDateTime(t)}>✓</span>;
}

export default function KpiReadyPage() {
  const { toast, show } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // ⚠ MẶC ĐỊNH "Theo đơn" (tổng hợp) — người dùng chốt "Mới vào thì lấy theo toggle tổng".
  const [cheDo, setCheDo] = useState('DON');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [loaiNgay, setLoaiNgay] = useState('TG_LEN_MES');
  const [donLoc, setDonLoc] = useState([]);      // [] = mọi đơn trong phạm vi
  const [page, setPage] = useState(1);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await getKpiReady({
        donHangIds: donLoc.join(','),
        loaiNgay, ngayTu: range.from || '', ngayDen: range.to || '',
      });
      setData(r.data);
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải KPI READY', 'error');
    } finally {
      setLoading(false);
    }
  }, [donLoc, loaiNgay, range.from, range.to, show]);

  useEffect(() => { load(); }, [load]);
  // ⚠ Tải NGẦM khi có xác nhận ở nơi khác: `load(true)` không bật spinner (bảng không bị thay
  //   bằng khối "Đang tải") và không bắn toast đỏ khi người dùng không hề bấm gì.
  useSocketReload(['ready:confirmed', 'workflow:updated', 'quality:updated', 'delivery:updated'],
    () => load(true));

  const cot = useMemo(() => data?.cot || [], [data]);

  // Ô tìm lọc Ở FE (dữ liệu đã tải trọn phạm vi) ⇒ gõ tới đâu thấy tới đó, không bắn request.
  const rows = useMemo(() => {
    const ds = data?.rows || [];
    if (!chuanTuKhoa(search)) return ds;
    return ds.filter((r) => khopNhieu(
      [r.ten_khach_hang, r.ma_don_hang, r.so_po, r.ma_hang, r.ma_phan, r.mau_vai, r.kich_vai, r.kich_phim],
      search));
  }, [data, search]);

  const viewRows = useMemo(
    () => (cheDo === 'DON' ? gopTheoDon(rows, cot) : rows.map((r) => ({ ...r, _id: r.phan_in_id }))),
    [rows, cot, cheDo]
  );
  // ⚠ Tổng & % tính trên TOÀN BỘ dòng phần in đang lọc — KHÔNG theo trang, cũng không theo chế độ
  //   xem ⇒ đổi toggle thì 2 dòng cuối bảng đứng yên, đúng bản chất (cùng một tập hàng).
  const tong = useMemo(() => dongTong(rows, cot), [rows, cot]);
  const ptRow = useMemo(() => dongPhanTram(rows, cot, tong), [rows, cot, tong]);

  useEffect(() => { setPage(1); }, [cheDo, search, donLoc, loaiNgay, range.from, range.to]);
  const totalPages = Math.max(1, Math.ceil(viewRows.length / PAGE_SIZE));
  // ⚠⚠ PHÂN TRANG THEO PHẦN IN (không theo dòng hiển thị): khối đợt vải của một phần in được hợp
  //   nhất bằng `rowSpan` — cắt ngang trang là các dòng con rơi sang trang sau MẤT ô hợp nhất, bảng
  //   lệch hết cột. Cắt theo phần in thì mỗi khối luôn nguyên vẹn trong 1 trang.
  const pageRows = useMemo(
    () => viewRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [viewRows, page]
  );

  const gop = cheDo === 'DON';
  const cotTrai = gop
    ? [...COT_TRAI.filter((c) => !BO_O_CHE_DO_DON.has(c.ma)), ...COT_DON]
    : COT_TRAI_CHI_TIET;
  // Owner của cột TRÁI: mượn từ cột checklist cùng trạm (`ownerTu`) — không có bảng owner riêng.
  const ownerCot = (c) => (c.ownerTu ? (cot.find((x) => x.ma === c.ownerTu) || {}).owner : null);

  // Dòng THẬT SỰ vẽ ra. Chế độ Chi tiết: 1 phần in → N dòng theo đợt vải (`_dau`/`_span`/`_dot`).
  // `_stt` đánh theo PHẦN IN nên khối nhiều đợt vẫn mang đúng một số thứ tự.
  const renderRows = useMemo(() => {
    const base = (page - 1) * PAGE_SIZE;
    if (gop) return pageRows.map((r, i) => ({ ...r, _dau: true, _span: 1, _stt: base + i + 1 }));
    const out = [];
    pageRows.forEach((r, i) => {
      tachTheoDotVai([r]).forEach((x) => out.push({ ...x, _stt: base + i + 1 }));
    });
    return out;
  }, [pageRows, gop, page]);
  const kpi = data?.kpi;
  const dsDon = data?.don_hang || [];

  const toggleDon = (id) => setDonLoc((cu) => (cu.includes(id) ? cu.filter((x) => x !== id) : [...cu, id]));

  const doExport = async () => {
    try {
      // ⚠⚠ Excel TÁCH DÒNG y như bảng, và các ô mức PHẦN IN chỉ điền ở DÒNG ĐẦU của khối — để trống
      //   ở dòng con. Lặp giá trị ra mọi dòng là mở đường cho người đọc bôi đen cột rồi cộng nhầm
      //   (SL in / SLĐH sẽ nhân lên theo số đợt vải).
      const xuatRows = gop ? viewRows : tachTheoDotVai(viewRows);
      // Ô mức phần in ở dòng CON (không phải dòng đầu khối) → để TRỐNG.
      const boQua = (r, tach) => !tach && r._dau === false;
      const cols = [
        // ⚠ Owner của cột trái (hiện chỉ "Đợt vải") cũng nhét vào header như 23 cột checklist.
        //   ⚠⚠ Excel giữ TÊN ĐẦY ĐỦ, KHÔNG viết tắt — file này dùng để đối chiếu/gán người.
        ...cotTrai.map((c) => {
          const own = ownerCot(c);
          return {
            header: own ? `${c.ten}\n${own}` : c.ten, width: c.so ? 12 : 18, num: !!c.so,
            value: (r) => {
              const tach = !gop && COT_TRAI_THEO_DOT.has(c.ma);
              if (boQua(r, tach)) return '';
              const v = giaTriTrai(r, c.ma, !gop);
              if (c.ngay) return v ? fmtDate(v) : '';
              return v ?? (c.so ? 0 : '');
            },
          };
        }),
        // ⚠ Owner nhét vào CHÍNH ô header (xuống dòng) — `exportPanelExcel` chỉ có 1 hàng header;
        //   bỏ owner đi thì file Excel mất đúng thứ trang này sinh ra để trả lời ("ai phụ trách").
        ...cot.map((c) => ({
          header: c.owner ? `${c.ten}\n${c.owner}` : c.ten, width: 14, num: c.nhom !== 'moc',
          center: c.nhom === 'moc',
          value: (r) => {
            const tach = !gop && COT_THEO_DOT.has(c.ma);
            if (boQua(r, tach)) return '';
            if (tach) { const t = giaTriTheoDot(r, c.ma); return t ? fmtDateTime(t) : ''; }
            if (c.nhom === 'moc') {
              if (gop) { const g = r[`_${c.ma}`] || {}; return `${g.qua || 0}/${g.tong || 0}`; }
              return r[c.col] ? fmtDateTime(r[c.col]) : '';
            }
            if (c.nhom === 'so') return gop ? (r[`_${c.ma}`] || 0) : Number(r[c.col] || 0);
            const v = gop ? r[`_${c.ma}`]
              : (Number(r[c.mauSo] || 0) > 0 ? (Number(r[c.tuSo] || 0) / Number(r[c.mauSo])) * 100 : null);
            return v === null || v === undefined ? 0 : Math.round(v * 10) / 10;
          },
        })),
      ];
      await exportPanelExcel({
        cols, rows: xuatRows, title: 'KPI READY',
        subtitle: `${gop ? 'Theo đơn hàng' : 'Chi tiết theo code phần (tách dòng theo đợt vải)'}`
          + ` · ${xuatRows.length} dòng · ${viewRows.length} ${gop ? 'đơn hàng' : 'phần in'}`
          + ` · ${rows.length} phần in${range.from || range.to ? ` · ${range.from || '…'} → ${range.to || '…'}` : ''}`,
        fileName: `kpi-ready-${gop ? 'theo-don' : 'chi-tiet'}`,
      });
    } catch (e) {
      show(e.message || 'Lỗi xuất Excel', 'error');
    }
  };

  return (
    <div>
      {/* ===== Header ===== */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">KPI READY</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Theo dõi phần in đi qua từng checklist, trên phạm vi các đơn hàng được chọn ở
            {' '}<span className="font-medium">Hệ thống → Chọn đơn hàng (KPI)</span>.
          </p>
        </div>
        <Badge tone="success">Realtime</Badge>
      </div>

      {/* ===== Phạm vi: các đơn hàng đang lấy số liệu ===== */}
      <div className="card mb-4 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Icon name="package" size={15} className="text-ink-soft" />
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Đơn hàng đang lấy số liệu ({dsDon.length})
          </span>
          {donLoc.length > 0 && (
            <button type="button" className="text-xs text-primary hover:underline"
              onClick={() => setDonLoc([])}>Bỏ lọc đơn</button>
          )}
        </div>
        {dsDon.length === 0 ? (
          <div className="rounded-control border border-dashed border-line px-3 py-2.5 text-sm text-ink-soft">
            {data && data.co_bang === false
              ? 'Chưa chạy migration 093 — bảng kpi_don_hang chưa tồn tại. Trang vẫn mở được nhưng chưa có phạm vi.'
              : 'Chưa chọn đơn hàng nào. Vào Hệ thống → Chọn đơn hàng (KPI) để tích các đơn cần theo dõi.'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {dsDon.map((d) => {
              const on = donLoc.length === 0 || donLoc.includes(d.id);
              return (
                <button key={d.id} type="button" onClick={() => toggleDon(d.id)}
                  title={`${d.ten_khach_hang}${d.ten_don_hang ? ` · ${d.ten_don_hang}` : ''}`}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${on
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-line text-ink-soft hover:bg-surface-muted'}`}>
                  {d.ma_don_hang}
                  <span className="ml-1 opacity-70">· {d.ten_khach_hang}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== 5 KPI ===== */}
      <div className="mb-4 flex flex-wrap gap-2.5">
        <KpiCard tone="emerald" icon="✅" label="% đơn READY đủ trước Release"
          value={kpi ? fmtPt(kpi.ready_truoc_release.pt) : '—'}
          sub={kpi ? `${fmtNum(kpi.ready_truoc_release.tu_so)}/${fmtNum(kpi.ready_truoc_release.mau_so)} phần in đã release` : ''} />
        <KpiCard tone="rose" icon="⚠" label="Số lần thiếu sau Release"
          value={kpi ? fmtNum(kpi.thieu_sau_release.so_lan) : '—'}
          sub="Đã Release 1 mà IQC chưa xác nhận READY" />
        <KpiCard tone="amber" icon="↩" label="Số lần quay lại / rework"
          value={kpi ? fmtNum(kpi.rework.so_lan) : '—'}
          sub={kpi ? `trên ${fmtNum(kpi.rework.so_phan_in)} phần in bị trả về` : ''} />
        <KpiCard tone="sky" icon="⏱" label="Lead time đến READY"
          value={kpi && kpi.lead_time.tb_phut != null ? fmtPhut(kpi.lead_time.tb_phut) : '—'}
          sub={kpi ? `TB · tổng ${fmtNum(kpi.lead_time.tong_phut)} phút / ${fmtNum(kpi.lead_time.so_phan_in)} phần in` : ''} />
        <KpiCard tone="violet" icon="🔀" label="% bất thường xử lý đúng quyền"
          value={kpi ? fmtPt(kpi.bat_thuong.pt) : '—'}
          sub={kpi ? `${fmtNum(kpi.bat_thuong.tu_so)}/${fmtNum(kpi.bat_thuong.mau_so)} phần in đổi PA in > ${kpi.bat_thuong.nguong} lần` : ''} />
      </div>

      {/* ===== Thanh lọc ===== */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-control border border-line bg-surface p-0.5">
          {[['DON', 'Theo đơn'], ['CHI_TIET', 'Chi tiết (code phần)']].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setCheDo(v)}
              className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition ${cheDo === v
                ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'}`}>{label}</button>
          ))}
        </div>
        <Select value={loaiNgay} onChange={(e) => setLoaiNgay(e.target.value)} className="!h-10 w-44">
          {(data?.loai_ngay || []).map((n) => <option key={n.ma} value={n.ma}>{n.ten}</option>)}
        </Select>
        <DateRangePicker value={range} onChange={(v) => setRange({ from: v.from || '', to: v.to || '' })} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm khách, đơn, mã hàng, code phần, màu..."
          className="h-10 w-full max-w-xs rounded-control border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
        <div className="ml-auto flex items-center gap-2">
          {loading && <Spinner size={16} />}
          <Button chiXemOk variant="secondary" icon="download" onClick={doExport} disabled={!viewRows.length}>
            Excel ({viewRows.length})
          </Button>
        </div>
      </div>

      {/* ===== Bảng ===== */}
      <div className="card overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 18rem)' }}>
          <table className="w-full border-collapse text-left">
            {/* ⚠⚠ 2 HÀNG HEADER ĐỀU DÍNH ĐỈNH ⇒ mốc `top` của hàng 2 phải bằng ĐÚNG chiều cao hàng 1.
                Vì vậy chiều cao khai bằng SỐ PIXEL TƯỜNG MINH (`H_HEAD`), không phó mặc cho nội dung:
                lệch vài pixel là hàng owner hở khe / đè lên tên cột khi cuộn.
                ⚠ Cũng vì thế KHÔNG dùng `rowSpan={2}` cho cột trái — `rowSpan` + `position:sticky`
                là tổ hợp trình duyệt xử lý rất phập phù; cho hàng 2 một ô trống là xong. */}
            <thead>
              {/* Hàng 1: tên cột */}
              <tr className="sticky z-20 bg-surface-muted text-ink" style={{ top: 0, height: H_HEAD }}>
                <th className={`${TH} sticky left-0 z-30 bg-surface-muted text-center`}>STT</th>
                {cotTrai.map((c) => (
                  <th key={c.ma}
                    className={`${TH} ${c.w || ''} ${c.so ? 'text-right' : ''} border-l border-line`}>{c.ten}</th>
                ))}
                {cot.map((c) => (
                  <th key={c.ma} title={c.ghi_chu || ''}
                    className={`${TH} border-l border-line text-center`}>{c.ten}</th>
                ))}
              </tr>
              {/* Hàng 2: OWNER — gán ở Hệ thống → Owner checkpoint/checklist (KHÔNG có bảng riêng) */}
              <tr className="sticky z-20 bg-surface-muted" style={{ top: H_HEAD, height: H_OWNER }}>
                <th className={`${TH} sticky left-0 z-30 bg-surface-muted text-center font-normal text-ink-soft/60`}>
                  Owner
                </th>
                {/* Cột trái phần lớn không có owner ⇒ ô trống; riêng "Đợt vải" mượn owner của cột
                    checklist cùng trạm (`ownerTu`) — người dùng yêu cầu 10/09/2026. */}
                {cotTrai.map((c) => {
                  const own = ownerCot(c);
                  if (!c.ownerTu) return <th key={c.ma} className={`${TH} border-l border-line`} aria-hidden="true" />;
                  return (
                    <th key={c.ma}
                      title={own ? `Chịu trách nhiệm: ${own}` : 'Chưa gán owner — vào Hệ thống → Owner checkpoint/checklist'}
                      className={`${TH} border-l border-line text-center font-normal ${own ? 'text-primary' : 'text-ink-soft/60'}`}>
                      {viTatTen(own) || '— chưa gán —'}
                    </th>
                  );
                })}
                {/* ⚠ Hiện tên VIẾT TẮT ("Thạch Công Tuấn" → "C.Tuấn") — 23 cột owner cạnh nhau, tên
                    đầy đủ làm bảng phải kéo ngang liên tục. TÊN ĐẦY ĐỦ vẫn ở tooltip và file Excel. */}
                {cot.map((c) => (
                  <th key={c.ma}
                    title={c.owner ? `Chịu trách nhiệm: ${c.owner}` : 'Chưa gán owner — vào Hệ thống → Owner checkpoint/checklist'}
                    className={`${TH} border-l border-line text-center font-normal ${c.owner ? 'text-primary' : 'text-ink-soft/60'}`}>
                    {viTatTen(c.owner) || '— chưa gán —'}
                  </th>
                ))}
              </tr>
            </thead>
            {/* ⚠⚠ Ô mức PHẦN IN chỉ vẽ ở dòng ĐẦU của khối (`_dau`) kèm `rowSpan`; dòng con bỏ hẳn
                thẻ `<td>` đó đi. Tuyệt đối KHÔNG vẽ lại giá trị ở mọi dòng con — người đọc và Excel
                sẽ cộng dồn thành số sai (bẫy đã ghi cho `sl_da_in` ở *Danh sách release*). */}
            <tbody>
              {renderRows.map((r, i) => {
                const span = r._span > 1 ? r._span : undefined;
                const oGop = (tach) => (!tach && span ? span : undefined);
                return (
                  <tr key={r._id || i}
                    className={`border-t ${r._dau ? 'border-line' : 'border-line/40'} hover:bg-surface-muted/60`}>
                    {/* ⚠ Cột STT KHÔNG dùng `rowSpan`: nó đang `position:sticky`, mà rowSpan + sticky
                        là tổ hợp trình duyệt xử lý rất phập phù (đã ghi ở `<thead>` phía trên). Vẫn
                        vẽ ô ở MỌI dòng, chỉ để trống số ở dòng con ⇒ cột không bao giờ lệch. */}
                    <td className={`${TD} sticky left-0 z-10 bg-surface text-center align-top text-ink-soft`}>
                      {r._dau ? r._stt : ''}
                    </td>
                    {cotTrai.map((c) => {
                      const tach = !gop && COT_TRAI_THEO_DOT.has(c.ma);
                      if (!tach && !r._dau) return null;
                      const v = giaTriTrai(r, c.ma, !gop);
                      // Cột NGÀY: hiện dd/mm/yyyy; ô "Đợt vải" giữ MÃ ĐỢT ở tooltip để vẫn tra được.
                      const noiDung = c.ngay
                        ? (v ? fmtDate(v) : <span className="text-ink-soft">—</span>)
                        : (c.so ? fmtNum(v || 0) : (v || <span className="text-ink-soft">—</span>));
                      return (
                        <td key={c.ma} rowSpan={oGop(tach)}
                          title={c.ma === 'dot_vai' && r._dot ? r._dot.ma_dot_vai : undefined}
                          className={`${TD} border-l border-line align-top ${c.so ? 'text-right tabular-nums' : ''} ${c.ngay ? 'tabular-nums' : ''}`}>
                          {noiDung}
                        </td>
                      );
                    })}
                    {cot.map((c) => {
                      const tach = !gop && COT_THEO_DOT.has(c.ma);
                      if (!tach && !r._dau) return null;
                      return (
                        <td key={c.ma} rowSpan={oGop(tach)}
                          className={`${TD} border-l border-line text-center align-top`}>
                          <OChecklist cot={c} row={r} gop={gop} tachDot={!gop} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={1 + cotTrai.length + cot.length} className="px-3 py-10 text-center text-sm text-ink-soft">
                    {loading ? 'Đang tải...' : 'Không có dữ liệu trong phạm vi đang chọn'}
                  </td>
                </tr>
              )}
            </tbody>
            {/* ⚠⚠ 2 DÒNG CUỐI TÍNH TRÊN **TOÀN BỘ** DÒNG ĐANG LỌC — không phải trang đang xem, cũng
                không phụ thuộc chế độ xem (đổi toggle thì 2 dòng này đứng yên, đúng bản chất: vẫn
                là cùng một tập hàng).
                ⚠ Dính đáy đặt trên TỪNG Ô, không đặt trên `<tfoot>`: `position:sticky` trên
                `<tfoot>` không được các trình duyệt hỗ trợ đồng đều. Mốc `bottom` của dòng Tổng =
                chiều cao dòng % ⇒ khai bằng số pixel tường minh (`H_FOOT`). */}
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-line font-semibold text-ink">
                  <td className={`${TD} sticky left-0 z-30 bg-surface-muted text-center`}
                    style={{ position: 'sticky', bottom: H_FOOT, height: H_FOOT }}>Σ</td>
                  {cotTrai.map((c) => (
                    <td key={c.ma} style={{ position: 'sticky', bottom: H_FOOT }}
                      className={`${TD} z-20 border-l border-line bg-surface-muted ${c.so ? 'text-right tabular-nums' : ''}`}>
                      {c.ma === 'khach' ? `Tổng ${fmtNum(rows.length)} phần in` : (c.so ? fmtNum(tong[{
                        sldh: 'so_luong_don_hang', slnv: 'so_luong_vai_ve',
                        tong_phan_in: 'tong_phan_in', tong_tg_ready: 'tong_tg_ready_phut',
                      }[c.ma]] || 0) : '')}
                    </td>
                  ))}
                  {cot.map((c) => (
                    <td key={c.ma} style={{ position: 'sticky', bottom: H_FOOT }}
                      className={`${TD} z-20 border-l border-line bg-surface-muted text-center tabular-nums`}>
                      {c.nhom === 'moc' ? `${tong[`_${c.ma}`].qua}/${tong[`_${c.ma}`].tong}`
                        : c.nhom === 'pt' ? fmtPt(tong[`_${c.ma}`]) : fmtNum(tong[`_${c.ma}`])}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-line text-ink-soft">
                  <td className={`${TD} sticky left-0 z-30 bg-surface-muted text-center`}
                    style={{ position: 'sticky', bottom: 0, height: H_FOOT }}>%</td>
                  <td colSpan={cotTrai.length} style={{ position: 'sticky', bottom: 0 }}
                    className={`${TD} z-20 border-l border-line bg-surface-muted`}>
                    % đạt — cột mốc: đã xác nhận / tổng phần in · cột số lượng: chia cho SL in
                  </td>
                  {cot.map((c) => {
                    const v = ptRow[`_${c.ma}`];
                    return (
                      <td key={c.ma} style={{ position: 'sticky', bottom: 0 }}
                        className={`${TD} z-20 border-l border-line bg-surface-muted text-center tabular-nums`}>
                        {v === null || v === undefined ? '—' : fmtPt(v)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} total={viewRows.length} onPage={setPage} />

      <Toast toast={toast} />
    </div>
  );
}
