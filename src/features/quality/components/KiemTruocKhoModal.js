import { useCallback, useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import DateRangePicker from '../../../components/common/DateRangePicker';
import { listKiemTruocKho } from '../../../services/productionService';
import { fmtNum, fmtDateTime, ngayLocalISO } from '../../../utils/format';
import exportCheckpointExcel from '../../../utils/exportCheckpointExcel';

// ─── BÁO CÁO TEM KIỂM TRƯỚC GIỜ PHƠI XONG (27/10/2026, nút ở màn KCS) ──────────────────────────────────────────────
// 1 dòng / lượt KCS có giờ kiểm TRƯỚC giờ phơi xong DỰ KIẾN của phiên phơi (BE `production.repository listKiemTruocKho`),
//   kèm người + giờ + owner + lý do của lần "Xác nhận khô" sớm ở Xe phơi. Lọc theo NGÀY KCS, mặc định hôm nay.
const phut = (n) => {
  const v = Number(n) || 0;
  if (v < 60) return `${v} phút`;
  return `${Math.floor(v / 60)} giờ ${v % 60 ? `${v % 60} phút` : ''}`.trim();
};

const COT_EXCEL = [
  { header: 'Giờ KCS', width: 18, value: (r) => fmtDateTime(r.tg_kcs) },
  { header: 'Mã tem', width: 16, value: (r) => r.ma_tem || '' },
  { header: 'Code phần', width: 30, value: (r) => r.ma_phan || '' },
  { header: 'Khách hàng', width: 16, value: (r) => r.ten_khach_hang || '' },
  { header: 'Đơn hàng', width: 14, value: (r) => r.ma_don_hang || '' },
  { header: 'Mã hàng', width: 16, value: (r) => r.ma_hang || '' },
  { header: 'Màu vải', width: 14, value: (r) => r.mau_vai || '' },
  { header: 'Chuyền', width: 10, value: (r) => r.ma_chuyen || '' },
  { header: 'Lệnh', width: 12, value: (r) => r.ma_lenh_san_xuat || '' },
  { header: 'SL kiểm', width: 10, num: true, value: (r) => Number(r.so_luong_kiem) || 0 },
  { header: 'Bắt đầu phơi', width: 18, value: (r) => fmtDateTime(r.tg_bd_phoi) },
  { header: 'Phơi xong dự kiến', width: 18, value: (r) => fmtDateTime(r.tg_kho_du_kien) },
  { header: 'Kiểm sớm (phút)', width: 12, num: true, value: (r) => Number(r.som_phut) || 0 },
  { header: 'Xác nhận khô lúc', width: 18, value: (r) => (r.tg_xac_nhan_kho ? fmtDateTime(r.tg_xac_nhan_kho) : '') },
  { header: 'Người xác nhận khô', width: 20, value: (r) => r.nguoi_xac_nhan_kho || '' },
  { header: 'Owner cho khô', width: 22, value: (r) => r.owner_kho || '' },
  { header: 'Lý do', width: 30, value: (r) => r.ly_do_kho || '' },
  { header: 'Người KCS', width: 20, value: (r) => r.nguoi_kcs || '' },
];

export default function KiemTruocKhoModal({ open, onClose }) {
  const homNay = ngayLocalISO(new Date());
  const [range, setRange] = useState({ from: homNay, to: homNay });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loi, setLoi] = useState('');

  const tai = useCallback(async () => {
    setLoading(true); setLoi('');
    try {
      const res = await listKiemTruocKho({ tuNgay: range.from || undefined, denNgay: range.to || range.from || undefined });
      setRows(res.data?.items || []);
    } catch (e) { setLoi(e.message || 'Không tải được'); setRows([]); }
    finally { setLoading(false); }
  }, [range.from, range.to]);

  useEffect(() => { if (open) tai(); }, [open, tai]);

  const xuat = () => exportCheckpointExcel({
    cols: COT_EXCEL, rows,
    title: `Tem kiểm trước giờ phơi xong ${range.from || ''}${range.to && range.to !== range.from ? ` → ${range.to}` : ''}`,
    fileName: 'kiem-truoc-gio-phoi',
  });

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay title="Tem kiểm trước giờ phơi xong"
      footer={<Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-soft">Ngày KCS</span>
          <div className="w-64"><DateRangePicker value={range} onChange={setRange} placeholder="Chọn ngày KCS" /></div>
          <Badge tone={rows.length ? 'danger' : 'default'}>{rows.length} lượt</Badge>
          <div className="flex-1" />
          <Button chiXemOk variant="secondary" icon="download" onClick={xuat} disabled={!rows.length}>Excel ({rows.length})</Button>
        </div>
        {loi && <p className="text-sm text-danger">{loi}</p>}
        <div className="min-h-0 flex-1 overflow-auto rounded-card border border-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-surface-muted text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <tr>
                {['STT', 'Giờ KCS', 'Tem', 'Code phần · Khách · Mã hàng', 'Chuyền', 'SL kiểm', 'Phơi', 'Kiểm sớm', 'Xác nhận khô', 'Owner · Lý do', 'Người KCS']
                  .map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length ? (
                <tr><td colSpan={11} className="py-10 text-center"><Spinner size={22} className="mx-auto" /></td></tr>
              ) : !rows.length ? (
                <tr><td colSpan={11} className="py-10 text-center text-ink-soft">Không có tem nào kiểm trước giờ phơi xong</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.kcs_id} className="border-t border-line/70 align-top">
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink-soft">{i + 1}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fmtDateTime(r.tg_kcs)}</td>
                  <td className="px-2 py-1.5"><Badge tone="info">{r.ma_tem}</Badge></td>
                  <td className="px-2 py-1.5">
                    <div className="font-medium text-ink">{r.ma_phan || '—'}</div>
                    <div className="text-ink-soft">{[r.ten_khach_hang, r.ma_hang, r.mau_vai].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="px-2 py-1.5">{r.ma_chuyen || '—'}<div className="text-ink-soft">{r.ma_lenh_san_xuat}</div></td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(r.so_luong_kiem)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                    <div>Từ {fmtDateTime(r.tg_bd_phoi)}</div>
                    <div className="text-ink-soft">Xong dự kiến {fmtDateTime(r.tg_kho_du_kien)}</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-danger">{phut(r.som_phut)}</td>
                  <td className="px-2 py-1.5">
                    {r.tg_xac_nhan_kho
                      ? <><div className="tabular-nums">{fmtDateTime(r.tg_xac_nhan_kho)}</div><div className="text-ink-soft">{r.nguoi_xac_nhan_kho || ''}</div></>
                      : <span className="text-ink-soft">—</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="font-medium text-ink">{r.owner_kho || '—'}</div>
                    {r.ly_do_kho && <div className="text-ink-soft">{r.ly_do_kho}</div>}
                  </td>
                  <td className="px-2 py-1.5">{r.nguoi_kcs || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
