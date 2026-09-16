import { useCallback, useEffect, useMemo, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import ChipTabs from '../../../components/common/ChipTabs';
import DateRangePicker from '../../../components/common/DateRangePicker';
import FieldFilters, { FilterToggle } from '../../../components/common/FieldFilters';
import exportPanelExcel from '../../../components/common/exportPanelExcel';
import { Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import { getThoiGianTram } from '../../../services/thoiGianTramService';
import { fmtNum, fmtDateTime } from '../../../utils/format';
import { KpiCard } from '../components/charts';
import { fmtPhut } from '../utils/kpiReadyTable';
import { tongHopTheoTram, theoPhanIn, theoDotVai, thongKe } from '../utils/thoiGianTram';

// DASHBOARD › THỜI GIAN TRẠM (15/09/2026).
// Đo phần in / đợt vải / lệnh / tem ở TỪNG trạm bao lâu — nguồn mốc vào/ra = CHÍNH nguồn của dải
// "Theo dõi" (`utils/siSoTram.js`), KHÔNG dùng `lich_su_luan_chuyen` (bảng hỏng).
// 4 góc nhìn trên CÙNG 1 tập dòng: Tổng hợp theo trạm · Theo phần in · Theo đợt vải · Chi tiết.

const pad = (n) => String(n).padStart(2, '0');
// Ngày VN (YYYY-MM-DD) cách hôm nay N ngày — ⚠ không `toISOString()` (giờ VN trước 7h sẽ lùi 1 ngày).
const vnDay = (offset = 0) => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng' }, { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' }, { key: 'codePhan', label: 'Code phần' },
  { key: 'mauVai', label: 'Màu vải' }, { key: 'chuyen', label: 'Chuyền' },
];
const DON_VI = { pin: 'Phần in', dot_vai: 'Đợt vải', lenh: 'Lệnh SX', tem: 'Tem' };
const GOC = [
  ['TRAM', 'Tổng hợp theo trạm'], ['PIN', 'Theo phần in'], ['DOT', 'Theo đợt vải'], ['CHI_TIET', 'Chi tiết từng đơn vị'],
];

const phutTxt = (v) => (v === null || v === undefined ? '—' : fmtPhut(v));
// Ô thời gian có tô màu theo SLA: đỏ = quá SLA, cam = còn ở trạm (đồng hồ vẫn chạy).
function OPhut({ phut, sla, dangO }) {
  if (phut === null || phut === undefined) return <span className="text-ink-soft">—</span>;
  const qua = sla && phut > sla;
  return (
    <span className={`whitespace-nowrap tabular-nums ${qua ? 'font-semibold text-danger' : dangO ? 'text-amber-600' : 'text-ink'}`}
      title={`${fmtNum(phut)} phút${sla ? ` · SLA ${fmtNum(sla)} phút` : ''}${dangO ? ' · còn đang ở trạm' : ''}`}>
      {fmtPhut(phut)}{dangO ? ' ⏳' : ''}
    </span>
  );
}

export default function ThoiGianTramPage() {
  const { toast, show } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => ({ from: vnDay(-6), to: vnDay(0) }));
  const [loaiMoc, setLoaiMoc] = useState('VAO');
  const [trangThai, setTrangThai] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [goc, setGoc] = useState('TRAM');
  const [tramLoc, setTramLoc] = useState(''); // '' = mọi trạm (lọc CLIENT trên tập đã tải)
  const [chiQuaSla, setChiQuaSla] = useState(false);

  // Chuỗi khóa ổn định cho effect — không đưa object `filters` thẳng vào deps (bẫy §9).
  const khoaLoc = JSON.stringify({ range, loaiMoc, trangThai, search, filters });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getThoiGianTram({
        tuNgay: range.from || '', denNgay: range.to || '', loaiMoc, trangThai, timKiem: search, ...filters,
      });
      setData(r.data);
      if (r.data?.cat) show(`Có trạm vượt ${fmtNum(r.data.tran_dong)} dòng — hãy thu hẹp khoảng ngày`, 'error');
    } catch (e) {
      show(e.message || 'Lỗi tải thời gian trạm', 'error');
    } finally {
      setLoading(false);
    }
  }, [khoaLoc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const tramDs = useMemo(() => data?.tram || [], [data]);
  const slaCua = useMemo(() => new Map(tramDs.map((t) => [t.ma, t.sla_phut])), [tramDs]);
  // Tập dòng đang xét sau chip trạm + ô "chỉ quá SLA" (lọc client, không gọi lại API).
  const rows = useMemo(() => (data?.rows || []).filter((r) => (!tramLoc || r.ma_tram === tramLoc)
    && (!chiQuaSla || (slaCua.get(r.ma_tram) && r.phut > slaCua.get(r.ma_tram)))), [data, tramLoc, chiQuaSla, slaCua]);

  const tongTram = useMemo(() => tongHopTheoTram(rows, tramDs), [rows, tramDs]);
  const dsPin = useMemo(() => (goc === 'PIN' ? theoPhanIn(rows, tramDs) : []), [rows, tramDs, goc]);
  const dsDot = useMemo(() => (goc === 'DOT' ? theoDotVai(rows, tramDs) : []), [rows, tramDs, goc]);
  const tk = useMemo(() => thongKe(rows, null), [rows]);
  const quaSlaTong = useMemo(() => rows.filter((r) => slaCua.get(r.ma_tram) && r.phut > slaCua.get(r.ma_tram)).length,
    [rows, slaCua]);
  // Chỉ vẽ cột cho trạm CÓ dữ liệu (13 cột trống là bảng vô nghĩa).
  const tramCoDl = useMemo(() => tongTram.filter((t) => t.so_don_vi > 0), [tongTram]);
  const tenTram = (ma) => (tramDs.find((t) => t.ma === ma) || {}).ten || ma;

  const chipCounts = useMemo(() => {
    const m = { '': (data?.rows || []).length };
    (data?.rows || []).forEach((r) => { m[r.ma_tram] = (m[r.ma_tram] || 0) + 1; });
    return m;
  }, [data]);

  // ─── Cột từng góc nhìn ───────────────────────────────────────────────────
  const cotTram = [
    { key: 'ten', header: 'Trạm', className: 'font-medium text-ink', render: (t) => (
      <div><div>{t.ten}</div><div className="text-[11px] font-normal text-ink-soft">{t.mo_ta}</div></div>
    ) },
    { key: 'don_vi', header: 'Đơn vị đo', render: (t) => DON_VI[t.don_vi] || t.don_vi },
    { key: 'sla_phut', header: 'SLA', className: 'text-right', render: (t) => phutTxt(t.sla_phut) },
    { key: 'so_don_vi', header: 'Số đơn vị', className: 'text-right tabular-nums', render: (t) => fmtNum(t.so_don_vi) },
    { key: 'so_phan_in', header: 'Số phần in', className: 'text-right tabular-nums', render: (t) => fmtNum(t.so_phan_in) },
    { key: 'so_da_roi', header: 'Đã rời / đang ở', className: 'text-right tabular-nums', render: (t) => `${fmtNum(t.so_da_roi)} / ${fmtNum(t.so_dang_o)}` },
    { key: 'tb_phut', header: 'TB', className: 'text-right', render: (t) => <OPhut phut={t.tb_phut} sla={t.sla_phut} /> },
    { key: 'tb_da_roi_phut', header: 'TB (đã rời)', className: 'text-right', render: (t) => <OPhut phut={t.tb_da_roi_phut} sla={t.sla_phut} /> },
    { key: 'trung_vi_phut', header: 'Trung vị', className: 'text-right', render: (t) => phutTxt(t.trung_vi_phut) },
    { key: 'p90_phut', header: 'P90', className: 'text-right', render: (t) => phutTxt(t.p90_phut) },
    { key: 'max_phut', header: 'Lâu nhất', className: 'text-right', render: (t) => phutTxt(t.max_phut) },
    { key: 'tong_phut', header: 'Tổng', className: 'text-right', render: (t) => phutTxt(t.tong_phut) },
    { key: 'qua_sla', header: 'Quá SLA', className: 'text-right tabular-nums', render: (t) => (t.qua_sla == null ? '—'
      : <span className={t.qua_sla ? 'font-semibold text-danger' : ''}>{fmtNum(t.qua_sla)}{t.pt_qua_sla != null ? ` (${t.pt_qua_sla}%)` : ''}</span>) },
  ];
  const cotPinGoc = [
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink whitespace-nowrap' },
    { key: 'ten_khach_hang', header: 'Khách hàng' },
    { key: 'ma_don_hang', header: 'Đơn hàng' },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'mau_vai', header: 'Màu vải' },
  ];
  const cotMaTran = (thuocDot) => [
    ...cotPinGoc.slice(0, 1),
    ...(thuocDot ? [{ key: 'ma_dot_vai', header: 'Đợt vải', className: 'whitespace-nowrap',
      render: (r) => r.ma_dot_vai || <span className="text-ink-soft">(mức phần in)</span> }] : []),
    ...cotPinGoc.slice(1),
    ...tramCoDl.map((t) => ({
      key: `t_${t.ma}`, header: t.ten, className: 'text-right',
      render: (r) => (r.tram[t.ma] ? <OPhut phut={r.tram[t.ma].phut} sla={t.sla_phut} dangO={r.tram[t.ma].dang_o} /> : <span className="text-ink-soft">·</span>),
    })),
    { key: 'tong_phut', header: 'Tổng các trạm', className: 'text-right font-semibold', render: (r) => phutTxt(r.tong_phut) },
    { key: 'dau_cuoi_phut', header: 'Vào đầu → rời cuối', className: 'text-right', render: (r) => (
      <OPhut phut={r.dau_cuoi_phut} dangO={r.dang_o} />
    ) },
    { key: 'so_tram_qua_sla', header: 'Trạm quá SLA', className: 'text-right tabular-nums', render: (r) => (
      r.so_tram_qua_sla ? <span className="font-semibold text-danger">{r.so_tram_qua_sla}</span> : '0'
    ) },
  ];
  const cotChiTiet = [
    { key: 'ma_tram', header: 'Trạm', className: 'whitespace-nowrap', render: (r) => tenTram(r.ma_tram) },
    ...cotPinGoc.slice(0, 1),
    { key: 'don_vi', header: 'Đơn vị', className: 'whitespace-nowrap', render: (r) => {
      const t = tramDs.find((x) => x.ma === r.ma_tram) || {};
      return t.don_vi === 'pin' ? <span className="text-ink-soft">(phần in)</span> : r.don_vi;
    } },
    { key: 'ma_dot_vai', header: 'Đợt vải', render: (r) => r.ma_dot_vai || '—' },
    { key: 'ten_chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
    ...cotPinGoc.slice(1),
    { key: 'tg_vao', header: 'Vào', className: 'whitespace-nowrap', render: (r) => fmtDateTime(r.tg_vao) },
    { key: 'tg_ra', header: 'Rời', className: 'whitespace-nowrap', render: (r) => (r.tg_ra ? fmtDateTime(r.tg_ra) : <Badge tone="warning">Đang ở</Badge>) },
    { key: 'phut', header: 'Thời gian', className: 'text-right', render: (r) => <OPhut phut={r.phut} sla={slaCua.get(r.ma_tram)} dangO={!r.tg_ra} /> },
    { key: 'sla', header: 'SLA', className: 'text-right', render: (r) => phutTxt(slaCua.get(r.ma_tram)) },
  ];
  const chiTietSapXep = useMemo(() => [...rows].sort((a, b) => b.phut - a.phut)
    .map((r) => ({ ...r, _k: `${r.ma_tram}|${r.phan_in_id}|${r.don_vi}` })), [rows]);

  // ─── Excel theo góc nhìn đang mở ────────────────────────────────────────
  const doExport = async () => {
    const moTa = `${range.from || '…'} → ${range.to || '…'} theo mốc ${loaiMoc === 'RA' ? 'RỜI' : 'VÀO'} trạm`
      + `${trangThai ? ` · ${trangThai === 'DA_ROI' ? 'đã rời' : 'đang ở'}` : ''}${tramLoc ? ` · ${tenTram(tramLoc)}` : ''}`;
    const p = (v) => (v === null || v === undefined ? '' : Number(v));
    try {
      if (goc === 'TRAM') {
        await exportPanelExcel({ title: 'Thời gian trạm — tổng hợp', subtitle: moTa, fileName: 'thoi-gian-tram-tong-hop', rows: tongTram,
          cols: [
            { header: 'Trạm', value: (t) => t.ten }, { header: 'Đơn vị đo', value: (t) => DON_VI[t.don_vi] || '' },
            { header: 'SLA (phút)', value: (t) => p(t.sla_phut), num: true },
            { header: 'Số đơn vị', value: (t) => t.so_don_vi, num: true }, { header: 'Số phần in', value: (t) => t.so_phan_in, num: true },
            { header: 'Đã rời', value: (t) => t.so_da_roi, num: true }, { header: 'Đang ở', value: (t) => t.so_dang_o, num: true },
            { header: 'TB (phút)', value: (t) => p(t.tb_phut), num: true }, { header: 'TB đã rời (phút)', value: (t) => p(t.tb_da_roi_phut), num: true },
            { header: 'Trung vị (phút)', value: (t) => p(t.trung_vi_phut), num: true }, { header: 'P90 (phút)', value: (t) => p(t.p90_phut), num: true },
            { header: 'Lâu nhất (phút)', value: (t) => p(t.max_phut), num: true }, { header: 'Tổng (phút)', value: (t) => t.tong_phut, num: true },
            { header: 'Quá SLA', value: (t) => p(t.qua_sla), num: true },
          ] });
      } else if (goc === 'CHI_TIET') {
        await exportPanelExcel({ title: 'Thời gian trạm — chi tiết', subtitle: moTa, fileName: 'thoi-gian-tram-chi-tiet', rows: chiTietSapXep,
          cols: [
            { header: 'Trạm', value: (r) => tenTram(r.ma_tram) }, { header: 'Code phần', value: (r) => r.ma_phan },
            { header: 'Đơn vị', value: (r) => r.don_vi }, { header: 'Đợt vải', value: (r) => r.ma_dot_vai || '' },
            { header: 'Chuyền', value: (r) => r.ten_chuyen || '' },
            { header: 'Khách hàng', value: (r) => r.ten_khach_hang }, { header: 'Đơn hàng', value: (r) => r.ma_don_hang },
            { header: 'Mã hàng', value: (r) => r.ma_hang }, { header: 'Màu vải', value: (r) => r.mau_vai },
            { header: 'Vào', value: (r) => fmtDateTime(r.tg_vao) }, { header: 'Rời', value: (r) => (r.tg_ra ? fmtDateTime(r.tg_ra) : 'Đang ở') },
            { header: 'Thời gian (phút)', value: (r) => r.phut, num: true }, { header: 'SLA (phút)', value: (r) => p(slaCua.get(r.ma_tram)), num: true },
          ] });
      } else {
        const ds = goc === 'PIN' ? dsPin : dsDot;
        await exportPanelExcel({ title: `Thời gian trạm — theo ${goc === 'PIN' ? 'phần in' : 'đợt vải'}`, subtitle: `${moTa} · đơn vị: phút`,
          fileName: `thoi-gian-tram-${goc === 'PIN' ? 'phan-in' : 'dot-vai'}`, rows: ds,
          cols: [
            { header: 'Code phần', value: (r) => r.ma_phan },
            ...(goc === 'DOT' ? [{ header: 'Đợt vải', value: (r) => r.ma_dot_vai || '(mức phần in)' }] : []),
            { header: 'Khách hàng', value: (r) => r.ten_khach_hang }, { header: 'Đơn hàng', value: (r) => r.ma_don_hang },
            { header: 'Mã hàng', value: (r) => r.ma_hang }, { header: 'Màu vải', value: (r) => r.mau_vai },
            ...tramCoDl.map((t) => ({ header: t.ten, value: (r) => (r.tram[t.ma] ? r.tram[t.ma].phut : ''), num: true })),
            { header: 'Tổng các trạm', value: (r) => r.tong_phut, num: true },
            { header: 'Vào đầu → rời cuối', value: (r) => p(r.dau_cuoi_phut), num: true },
            { header: 'Trạm quá SLA', value: (r) => r.so_tram_qua_sla, num: true },
          ] });
      }
    } catch (e) { show(e.message || 'Xuất Excel thất bại', 'error'); }
  };

  const soDong = goc === 'TRAM' ? tongTram.length : goc === 'PIN' ? dsPin.length : goc === 'DOT' ? dsDot.length : rows.length;
  const soLoc = Object.values(filters).filter(Boolean).length;

  return (
    <div>
      <Toolbar title="Thời gian trạm"
        subtitle="Phần in / đợt vải / lệnh / tem ở từng trạm bao lâu — mốc vào/ra lấy đúng nguồn của dải “Theo dõi”."
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, đơn, mã hàng, lệnh, tem...">
        <FilterToggle open={showFilters} count={soLoc} onClick={() => setShowFilters((v) => !v)} />
        <Button chiXemOk variant="secondary" icon="file-spreadsheet" onClick={doExport} disabled={!soDong}>Excel ({fmtNum(soDong)})</Button>
      </Toolbar>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-40 shrink-0">
          <Select value={loaiMoc} onChange={(e) => setLoaiMoc(e.target.value)}>
            <option value="VAO">Theo mốc VÀO trạm</option>
            <option value="RA">Theo mốc RỜI trạm</option>
          </Select>
        </div>
        <DateRangePicker value={range} onChange={(v) => setRange({ from: v.from || '', to: v.to || '' })} />
        <div className="w-40 shrink-0">
          <Select value={trangThai} onChange={(e) => setTrangThai(e.target.value)} disabled={loaiMoc === 'RA'}>
            <option value="">Đã rời + đang ở</option>
            <option value="DA_ROI">Chỉ đã rời trạm</option>
            <option value="DANG_O">Chỉ đang ở trạm</option>
          </Select>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink">
          <input type="checkbox" checked={chiQuaSla} onChange={(e) => setChiQuaSla(e.target.checked)} /> Chỉ quá SLA
        </label>
        {loading && <Badge tone="info">Đang tải...</Badge>}
      </div>

      <FieldFilters fields={FILTER_FIELDS} values={filters} open={showFilters}
        onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} />

      <div className="mb-3 flex flex-wrap gap-2.5">
        <KpiCard tone="sky" icon="📦" label="Đơn vị đo" value={fmtNum(tk.so_don_vi)} sub={`${fmtNum(tk.so_phan_in)} phần in`} />
        <KpiCard tone="emerald" icon="✅" label="Đã rời trạm" value={fmtNum(tk.so_da_roi)} sub={`TB ${phutTxt(tk.tb_da_roi_phut)}`} />
        <KpiCard tone="amber" icon="⏳" label="Đang ở trạm" value={fmtNum(tk.so_dang_o)} sub="thời gian tính tới bây giờ" />
        <KpiCard tone="rose" icon="⚠" label="Quá SLA" value={fmtNum(quaSlaTong)}
          sub={rows.length ? `${Math.round((quaSlaTong / rows.length) * 1000) / 10}% số đơn vị` : ''} />
      </div>

      <div className="mb-1">
        <ChipTabs value={tramLoc} onChange={setTramLoc} counts={chipCounts}
          tabs={[{ v: '', label: 'Mọi trạm' }, ...tramDs.map((t) => ({ v: t.ma, label: t.ten }))]} />
      </div>

      <div className="mb-3 inline-flex flex-wrap rounded-control border border-line bg-surface p-0.5">
        {GOC.map(([v, label]) => (
          <button key={v} type="button" onClick={() => setGoc(v)}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition ${goc === v ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {goc === 'TRAM' && (
        <DataTable columns={cotTram} rows={tongTram} rowKey="ma" loading={loading} pageSize={0}
          onRowClick={(t) => { setTramLoc(t.ma); setGoc('CHI_TIET'); }}
          emptyText="Không có dữ liệu trong khoảng đã chọn" />
      )}
      {goc === 'PIN' && (
        <DataTable columns={cotMaTran(false)} rows={dsPin} rowKey="key" loading={loading}
          emptyText="Không có phần in nào" />
      )}
      {goc === 'DOT' && (
        <DataTable columns={cotMaTran(true)} rows={dsDot} rowKey="key" loading={loading}
          emptyText="Không có đợt vải nào" />
      )}
      {goc === 'CHI_TIET' && (
        <DataTable columns={cotChiTiet} rows={chiTietSapXep} loading={loading}
          rowKey="_k" emptyText="Không có đơn vị nào" />
      )}

      <p className="mt-3 text-xs text-ink-soft">
        ⏳ = còn ở trạm (tính tới bây giờ) · chữ đỏ = quá SLA của trạm · “Tổng các trạm” cộng thời gian ở từng trạm
        (một phần in có thể ở 2 trạm cùng lúc nên tổng có thể lớn hơn “Vào đầu → rời cuối”).
        Trạm READY đo ở mức phần in (khuôn/film/mực dùng chung mọi đợt vải) nên ở góc nhìn đợt vải được gắn cho mọi đợt của phần in đó.
      </p>
      <Toast toast={toast} />
    </div>
  );
}
