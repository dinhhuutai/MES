import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import ChipTabs from '../../../components/common/ChipTabs';
import exportPanelExcel from '../../../components/common/exportPanelExcel';
import { fmtNum, fmtDateTime } from '../../../utils/format';
import { khopNhieu, chuanTuKhoa } from '../../../utils/timKiem';
import { fmtPhut } from '../utils/kpiReadyTable';

// DRILL-DOWN 5 Ô KPI Ở TRANG KPI READY (15/09/2026, thuần FE — KHÔNG endpoint mới).
// ⚠⚠ Nguồn là `data.rows` (1 dòng / PHẦN IN) — CHÍNH tập backend dùng để tính 5 KPI (`tinhKpi`), KHÔNG
//   phải tập đã qua ô tìm kiếm trên trang. Dùng tập khác là số dòng trong modal lệch con số trên ô.
// ⚠ Mỗi KPI khai `loc` = ĐÚNG vị từ của `kpiready.service.tinhKpi` — sửa luật KPI ở backend thì sửa
//   kèm ở đây, nếu không danh sách chi tiết và con số trên ô sẽ đá nhau.

const readyTruoc = (r) => !!(r.moc_release_1 && r.moc_qa_ready
  && new Date(r.moc_qa_ready) <= new Date(r.moc_release_1));

const COT_CHUNG = [
  { key: 'ten_khach_hang', header: 'Khách hàng' },
  { key: 'ma_don_hang', header: 'Đơn hàng' },
  { key: 'ma_hang', header: 'Mã hàng' },
  { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink' },
  { key: 'mau_vai', header: 'Màu vải' },
  { key: 'kich_vai', header: 'Kích vải' },
  { key: 'kich_phim', header: 'Kích phim' },
  { key: 'so_luong_don_hang', header: 'SLĐH', so: true },
];

const tg = (key, header) => ({ key, header, ngayGio: true });

export const KPI_DRILL = {
  READY_TRUOC: {
    ten: '% đơn READY đủ trước Release',
    moTa: 'Phần in đã Release 1 — "Đạt" khi QA xác nhận READY TRƯỚC (hoặc đúng lúc) Release 1 lần đầu.',
    loc: (r) => !!r.moc_release_1,
    chip: [['', 'Tất cả'], ['DAT', 'READY trước release'], ['KHONG', 'Thiếu sau release']],
    hopChip: (r, v) => !v || (v === 'DAT' ? readyTruoc(r) : !readyTruoc(r)),
    cot: [tg('moc_qa_ready', 'QA ready'), tg('moc_release_1', 'Release 1'),
      { key: '_kq', header: 'Kết quả', val: (r) => (readyTruoc(r) ? 'Đạt' : 'Thiếu') }],
  },
  THIEU_SAU: {
    ten: 'Số lần thiếu sau Release',
    moTa: 'Đã Release 1 mà QA chưa xác nhận READY, hoặc xác nhận SAU khi release.',
    loc: (r) => !!r.moc_release_1 && !readyTruoc(r),
    cot: [tg('moc_release_1', 'Release 1'), tg('moc_qa_ready', 'QA ready'),
      { key: '_tre', header: 'QA trễ sau release', val: (r) => (r.moc_qa_ready
        ? fmtPhut(Math.round((new Date(r.moc_qa_ready) - new Date(r.moc_release_1)) / 60000))
        : 'Chưa QA') }],
  },
  REWORK: {
    ten: 'Số lần quay lại / rework',
    moTa: 'Phần in có ít nhất 1 lượt bị trả về (READY · Release 1 · Test Run · OQC · gia công).',
    loc: (r) => Number(r.so_lan_tra_ve) > 0,
    sapXep: (a, b) => Number(b.so_lan_tra_ve) - Number(a.so_lan_tra_ve),
    cot: [{ key: 'so_lan_tra_ve', header: 'Số lần trả về', so: true }, tg('moc_qa_ready', 'QA ready')],
    tong: (ds) => `${fmtNum(ds.reduce((s, r) => s + Number(r.so_lan_tra_ve || 0), 0))} lượt trả về`,
  },
  LEAD: {
    ten: 'Lead time đến READY',
    moTa: 'Từ lúc phần in lên MES (có vải) tới lúc QA xác nhận READY. Phần in chưa READY không tính.',
    loc: (r) => r.lead_time_phut !== null && r.lead_time_phut !== undefined,
    sapXep: (a, b) => Number(b.lead_time_phut) - Number(a.lead_time_phut),
    cot: [tg('moc_vai', 'Lên MES'), tg('moc_qa_ready', 'QA ready'),
      { key: 'lead_time_phut', header: 'Lead time', val: (r) => fmtPhut(Number(r.lead_time_phut)), so: true }],
    tong: (ds) => {
      const t = ds.reduce((s, r) => s + Number(r.lead_time_phut || 0), 0);
      return ds.length ? `TB ${fmtPhut(Math.round(t / ds.length))} · tổng ${fmtNum(t)} phút` : '';
    },
  },
  BAT_THUONG: {
    ten: '% bất thường xử lý đúng quyền',
    moTa: 'Phần in bị NGƯỜI đổi phương án in. "Bất thường" = đổi quá ngưỡng (tử số của KPI).',
    loc: (r) => Number(r.so_lan_doi_pa) > 0,
    chipTheoNguong: true,
    sapXep: (a, b) => Number(b.so_lan_doi_pa) - Number(a.so_lan_doi_pa),
    cot: [{ key: 'so_lan_doi_pa', header: 'Số lần đổi PA in', so: true }],
  },
};

// Vị từ chip — HÀM THUẦN ở mức module (lồng trong component là vào deps useMemo, bẫy §9).
function hopChipKpi(def, nguong, r, v) {
  if (!def || !v) return true;
  if (def.chipTheoNguong) return Number(r.so_lan_doi_pa) > nguong;
  return def.hopChip ? def.hopChip(r, v) : true;
}

export default function KpiDrillModal({ ma, rows, nguong = 2, onClose }) {
  const def = ma ? KPI_DRILL[ma] : null;
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('');

  // Mở KPI khác ⇒ về trạng thái sạch. BAT_THUONG mặc định đứng ở chip "bất thường" (đúng tử số KPI).
  useEffect(() => { setQ(''); setChip(ma === 'BAT_THUONG' ? 'VUOT' : ''); }, [ma]);

  const chipDs = useMemo(() => {
    if (!def) return null;
    if (def.chipTheoNguong) return [['', 'Có đổi PA in'], ['VUOT', `Bất thường (> ${nguong} lần)`]];
    return def.chip || null;
  }, [def, nguong]);

  const goc = useMemo(() => {
    if (!def) return [];
    const ds = (rows || []).filter(def.loc);
    return def.sapXep ? [...ds].sort(def.sapXep) : ds;
  }, [def, rows]);

  const locChu = useMemo(() => (chuanTuKhoa(q)
    ? goc.filter((r) => khopNhieu([r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.ma_phan, r.mau_vai], q))
    : goc), [goc, q]);
  const view = useMemo(() => locChu.filter((r) => hopChipKpi(def, nguong, r, chip)),
    [locChu, chip, def, nguong]);
  const counts = useMemo(() => {
    const m = {};
    (chipDs || []).forEach(([v]) => { m[v] = locChu.filter((r) => hopChipKpi(def, nguong, r, v)).length; });
    return m;
  }, [chipDs, locChu, def, nguong]);

  if (!def) return null;
  const cot = [...COT_CHUNG, ...def.cot];
  const giaTri = (r, c) => {
    if (c.val) return c.val(r);
    const v = r[c.key];
    if (c.ngayGio) return v ? fmtDateTime(v) : '—';
    if (c.so) return fmtNum(v || 0);
    return v || '—';
  };

  const xuat = () => exportPanelExcel({
    title: `Theo dõi PO — ${def.ten}`,
    subtitle: `${view.length} phần in${q ? ` · tìm "${q}"` : ''}`,
    fileName: `kpi-ready-${ma.toLowerCase()}`,
    rows: view,
    cols: cot.map((c) => ({
      header: c.header, num: !!c.so && !c.val,
      value: (r) => (c.val ? c.val(r) : c.ngayGio ? (r[c.key] ? fmtDateTime(r[c.key]) : '') : (r[c.key] ?? '')),
    })),
  });

  return (
    <Modal open={!!ma} onClose={onClose} title={def.ten} size="full" lapDay
      footer={<Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>}>
      <div className="shrink-0 space-y-2 pb-3">
        <p className="text-sm text-ink-soft">{def.moTa}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm khách, đơn, mã hàng, code phần, màu..."
            className="h-10 w-full max-w-xs rounded-control border border-line px-3 text-base outline-none focus:border-primary md:text-sm" />
          {chipDs && (
            <div className="-mb-4"><ChipTabs value={chip} onChange={setChip} counts={counts}
              tabs={chipDs.map(([v, label]) => ({ v, label }))} /></div>
          )}
          <Badge tone="info">{fmtNum(view.length)} phần in</Badge>
          {def.tong && view.length > 0 && <Badge tone="default">{def.tong(view)}</Badge>}
          <div className="ml-auto">
            <Button chiXemOk variant="secondary" icon="file-spreadsheet" onClick={xuat} disabled={!view.length}>
              Excel ({view.length})
            </Button>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-control border border-line">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-surface-muted">
            <tr>
              <th className="whitespace-nowrap px-2 py-2 font-semibold">STT</th>
              {cot.map((c) => (
                <th key={c.key} className={`whitespace-nowrap px-2 py-2 font-semibold ${c.so ? 'text-right' : ''}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.length === 0 ? (
              <tr><td colSpan={cot.length + 1} className="px-3 py-8 text-center text-ink-soft">Không có phần in nào</td></tr>
            ) : view.map((r, i) => (
              <tr key={r.phan_in_id} className="border-t border-line hover:bg-surface-muted/60">
                <td className="px-2 py-1.5 tabular-nums text-ink-soft">{i + 1}</td>
                {cot.map((c) => (
                  <td key={c.key} className={`whitespace-nowrap px-2 py-1.5 ${c.so ? 'text-right tabular-nums' : ''} ${c.className || ''}`}>
                    {c.key === '_kq'
                      ? <Badge tone={readyTruoc(r) ? 'success' : 'danger'}>{giaTri(r, c)}</Badge>
                      : giaTri(r, c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

