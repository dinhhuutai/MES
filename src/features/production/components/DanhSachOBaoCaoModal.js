import { useMemo } from 'react';
import Modal from '../../../components/common/Modal';
import DataTable from '../../../components/common/DataTable';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import exportCheckpointExcel from '../../../utils/exportCheckpointExcel';
import { fmtNum, fmtDateTime } from '../../../utils/format';
import { hienNgay } from './BangBaoCaoSanXuat';

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH SAU 1 Ô BÁO CÁO SẢN XUẤT (26/10/2026, người dùng: "bấm vào kế hoạch thì hiện danh sách kế hoạch, bấm
// vào thực tế thì hiện danh sách tem in"). Trang lọc sẵn `ds_kh` / `ds_tem` của API theo dòng + ca của ô (cùng phép
// cộng backend `utils/baoCaoSanXuat.js` ⇒ Σ cột SL = số trên ô). `o` = { loai: 'KH'|'TT', ca, nhan, rows }.
//   · KH: mỗi dòng = phần SL kế hoạch của 1 lệnh × phần in. Ca của KH = ca chứa GIỜ BẮT ĐẦU KẾ HOẠCH (26/10/2026
//     người dùng chốt); thiếu giờ KH ⇒ ca lúc bấm Xác nhận chạy đầu / hoạt động đầu ngày (lệnh chạy tiếp).
//   · TT: mỗi dòng = 1 tem; ca = 2 ký tự cuối mã ngày ca người in nhập (HC · C1/D1 · C2/D2 · C3).
// ─────────────────────────────────────────────────────────────────────────────

const TEN_CA = { TONG: 'mọi ca', HC: 'HC', CA1: 'CA1', CA2: 'CA2', CA3: 'CA3', D1: 'D1', D2: 'D2' };
const CA_THEO = { GIO_KH: 'Giờ KH bắt đầu', BAM_CHAY: 'Bấm chạy', HOAT_DONG: 'Hoạt động đầu ngày' };
const gioVN = (v) => (v ? fmtDateTime(v) : '');
const khoangGio = (a, b) => [a, b].filter(Boolean).join(' – ');
const txt = (v) => (v == null ? '' : String(v));

const COT_CHUNG = [
  { key: 'ma_chuyen', header: 'Chuyền' },
  { key: 'ma_lenh', header: 'Mã lệnh' },
  { key: 'ma_phan', header: 'Code phần', render: (r) => <span className="whitespace-nowrap">{r.ma_phan || '—'}</span> },
  { key: 'khach', header: 'Khách hàng' },
  { key: 'po', header: 'PO' },
  { key: 'ma_hang', header: 'Mã hàng' },
  { key: 'mau_vai', header: 'Màu vải' },
  { key: 'kich', header: 'Kích vải / phim', render: (r) => [r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—' },
];

const COT_KH = [
  ...COT_CHUNG,
  { key: 'ca', header: 'Ca' },
  { key: 'sl', header: 'SL kế hoạch', className: 'text-right tabular-nums', render: (r) => fmtNum(r.sl) },
  {
    key: 'kieu', header: 'Tính vào ca theo',
    // 26/10/2026: ca của KH = ca chứa GIỜ BẮT ĐẦU KẾ HOẠCH; lệnh thiếu giờ KH lùi về lúc bấm chạy / hoạt động đầu.
    render: (r) => (
      <span className="whitespace-nowrap">
        <Badge tone={r.ca_theo === 'GIO_KH' ? 'success' : 'info'}>{CA_THEO[r.ca_theo] || 'Bấm chạy'}</Badge> {gioVN(r.moc_ca)}
        {r.kieu === 'CHAY_TIEP' && <span className="ml-1"><Badge tone="warning">Chạy tiếp</Badge></span>}
      </span>
    ),
  },
  { key: 'gio_kh', header: 'Giờ kế hoạch', render: (r) => <span className="whitespace-nowrap">{khoangGio(gioVN(r.tg_bd_kh), gioVN(r.tg_kt_kh)) || '—'}</span> },
  { key: 'ngay_kh', header: 'Ngày SX KH', render: (r) => (r.ngay_kh ? hienNgay(r.ngay_kh) : '—') },
];

const COT_TT = [
  { key: 'ma_tem', header: 'Mã tem', render: (r) => <span className="font-mono">{r.ma_tem || '—'}</span> },
  ...COT_CHUNG,
  { key: 'ca', header: 'Ca' },
  { key: 'ma_ngay_ca', header: 'Mã ngày ca', render: (r) => <span className="font-mono">{r.ma_ngay_ca || '—'}</span> },
  { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
  { key: 'gio_sx', header: 'Giờ SX (ô In tem)', render: (r) => khoangGio(r.gio_sx_bd, r.gio_sx_kt) || '—' },
  { key: 'tg_in', header: 'Lúc in', render: (r) => <span className="whitespace-nowrap">{gioVN(r.tg_in) || '—'}</span> },
  { key: 'nguoi_in', header: 'Người in' },
];

const XUAT_CHUNG = [
  { header: 'Chuyền', width: 10, value: (r) => txt(r.ma_chuyen) },
  { header: 'Mã lệnh', width: 12, value: (r) => txt(r.ma_lenh) },
  { header: 'Code phần', width: 26, value: (r) => txt(r.ma_phan) },
  { header: 'Khách hàng', width: 18, value: (r) => txt(r.khach) },
  { header: 'PO', width: 18, value: (r) => txt(r.po) },
  { header: 'Mã hàng', width: 22, value: (r) => txt(r.ma_hang) },
  { header: 'Màu vải', width: 14, value: (r) => txt(r.mau_vai) },
  { header: 'Kích vải', width: 10, value: (r) => txt(r.kich_vai) },
  { header: 'Kích phim', width: 10, value: (r) => txt(r.kich_phim) },
  { header: 'Ca', width: 7, center: true, value: (r) => txt(r.ca) },
];
const XUAT_KH = [
  ...XUAT_CHUNG,
  { header: 'SL kế hoạch', width: 12, num: true, value: (r) => Number(r.sl) || 0 },
  { header: 'Tính vào ca theo', width: 18, value: (r) => CA_THEO[r.ca_theo] || 'Bấm chạy' },
  { header: 'Chạy tiếp từ ngày trước', width: 12, center: true, value: (r) => (r.kieu === 'CHAY_TIEP' ? 'Có' : '') },
  { header: 'Mốc', width: 18, value: (r) => gioVN(r.moc_ca) },
  { header: 'Giờ KH bắt đầu', width: 18, value: (r) => gioVN(r.tg_bd_kh) },
  { header: 'Giờ KH kết thúc', width: 18, value: (r) => gioVN(r.tg_kt_kh) },
  { header: 'Ngày SX KH', width: 12, center: true, value: (r) => (r.ngay_kh ? hienNgay(r.ngay_kh) : '') },
];
const XUAT_TT = [
  { header: 'Mã tem', width: 16, value: (r) => txt(r.ma_tem) },
  ...XUAT_CHUNG,
  { header: 'Mã ngày ca', width: 12, value: (r) => txt(r.ma_ngay_ca) },
  { header: 'SL in', width: 10, num: true, value: (r) => Number(r.so_luong) || 0 },
  { header: 'Từ giờ', width: 8, center: true, value: (r) => txt(r.gio_sx_bd) },
  { header: 'Đến giờ', width: 8, center: true, value: (r) => txt(r.gio_sx_kt) },
  { header: 'Lúc in', width: 18, value: (r) => gioVN(r.tg_in) },
  { header: 'Người in', width: 22, value: (r) => txt(r.nguoi_in) },
];

export default function DanhSachOBaoCaoModal({ o, ngay, onClose }) {
  const laKh = o && o.loai === 'KH';
  const rows = useMemo(() => ((o && o.rows) || []).map((r, i) => ({ ...r, _k: i })), [o]);
  const tong = rows.reduce((a, r) => a + (Number(laKh ? r.sl : r.so_luong) || 0), 0);
  const tieuDe = o
    ? `${laKh ? 'Kế hoạch' : 'Tem in thực tế'} · ${o.nhan} · ${TEN_CA[o.ca] || o.ca} · ngày ${hienNgay(ngay)}`
    : '';
  const xuat = () => exportCheckpointExcel({
    cols: laKh ? XUAT_KH : XUAT_TT, rows, title: tieuDe,
    fileName: `bao-cao-sx-${laKh ? 'ke-hoach' : 'tem'}-${ngay}`,
  });
  return (
    <Modal open={!!o} onClose={onClose} size="full" lapDay title={tieuDe}
      footer={<Button variant="ghost" onClick={onClose}>Đóng</Button>}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-primary-wash px-3 py-1 font-semibold text-primary">
            {laKh ? 'SL kế hoạch' : 'SL in thực tế'}: {fmtNum(tong)}
          </span>
          <span className="text-ink-soft">{fmtNum(rows.length)} {laKh ? 'dòng kế hoạch' : 'tem'}</span>
          <div className="ml-auto">
            <Button variant="secondary" chiXemOk onClick={xuat} disabled={!rows.length}>Xuất Excel</Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-card border border-line">
          <DataTable columns={laKh ? COT_KH : COT_TT} rows={rows} rowKey="_k" sttStart={0} pageSize={0}
            emptyText={laKh ? 'Ô này không có kế hoạch' : 'Ô này không có tem'} />
        </div>
      </div>
    </Modal>
  );
}
