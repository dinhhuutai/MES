import { useCallback, useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import DateRangePicker from '../../../components/common/DateRangePicker';
import HuyLyDoModal from '../../../components/common/HuyLyDoModal';
import { Input, Select } from '../../../components/common/controls';
import usePermissions from '../../../hooks/usePermissions';
import { lichSuHoanTat, moLaiTuLichSu, listChuyen } from '../../../services/productionService';
import { fmtNum, fmtDateTime, ngayLocalISO } from '../../../utils/format';
import { hienDsMa } from '../../../utils/maPhanIn';

// ─────────────────────────────────────────────────────────────────────────────
// LỊCH SỬ CHẠY HOÀN TẤT (28/10/2026, người dùng: "cho thêm lịch sử phần in bấm đã hoàn tất, bấm để mở lại, có bộ lọc,
// lọc theo barcode đầy đủ") — nút ở màn Xác nhận chạy. 1 dòng / PHIẾU đã hoàn tất (BE `production.repository
// listLichSuHoanTat`, lọc + phân trang server, 20 dòng/trang).
//   · Ô "Barcode" = khớp CHÍNH XÁC (quét được, Enter): mã tem (nhãn 15/16/17 cùng tem) · code phần · mã TDTHĐH ·
//     mã HSKT · mã đợt READY · mã lệnh · mã phiếu. Có barcode ⇒ BỎ lọc ngày (tìm mọi ngày).
//   · Ô tìm = gần đúng (code phần, mã hàng, màu, kích, khách, đơn/PO, mã lệnh, chuyền) + chọn chuyền + khoảng ngày hoàn tất.
//   · "Mở lại" (quyền PROD_RUN, lý do bắt buộc, không hạn ngày) ⇒ phiếu về Đang chạy, lệnh về Sản xuất. Chỉ phiếu mới nhất
//     của lệnh, lệnh chưa hủy, không có phiếu khác đang chạy (BE kiểm lại trong transaction).
// ─────────────────────────────────────────────────────────────────────────────
const KIEU = {
  HOAN_TAT: { nhan: 'Chạy hoàn tất', tone: 'success' },
  NGUNG: { nhan: 'Ngừng lệnh chạy', tone: 'warning' },
  TRA_VE: { nhan: 'Trả về Kế hoạch', tone: 'info' },
};
const LIMIT = 20;

export default function LichSuHoanTatModal({ open, onClose, show, onDaMoLai }) {
  const { can } = usePermissions();
  const homNay = ngayLocalISO(new Date());
  const [khoang, setKhoang] = useState({ from: homNay, to: homNay });
  const [barcode, setBarcode] = useState('');
  const [barcodeLoc, setBarcodeLoc] = useState('');
  const [tim, setTim] = useState('');
  const [timLoc, setTimLoc] = useState('');
  const [chuyenId, setChuyenId] = useState('');
  const [dsChuyen, setDsChuyen] = useState([]);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [moLai, setMoLai] = useState(null);

  useEffect(() => {
    if (!open) return;
    listChuyen().then((r) => setDsChuyen((r.data || []).filter((c) => c.ma_loai_chuyen !== 'GIA_CONG'))).catch(() => setDsChuyen([]));
  }, [open]);

  // Ô tìm gần đúng chờ 350 ms mới tải.
  useEffect(() => {
    const h = setTimeout(() => { setTimLoc(tim.trim()); setPage(1); }, 350);
    return () => clearTimeout(h);
  }, [tim]);

  const tu = khoang.from || homNay;
  const den = khoang.to || khoang.from || homNay;
  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await lichSuHoanTat({
        tuNgay: tu, denNgay: den, barcode: barcodeLoc || undefined, search: timLoc || undefined,
        chuyenId: chuyenId || undefined, page, limit: LIMIT,
      });
      setRows(res.data?.items || []);
      setMeta(res.data?.meta || { total: 0, totalPages: 1 });
    } catch (e) {
      show(e.message || 'Không tải được lịch sử hoàn tất', 'error');
    } finally { setLoading(false); }
  }, [open, tu, den, barcodeLoc, timLoc, chuyenId, page, show]);
  useEffect(() => { load(); }, [load]);

  const chotBarcode = () => { setBarcodeLoc(barcode.trim()); setPage(1); };

  const xacNhanMoLai = async (muc, lyDo) => {
    try {
      await moLaiTuLichSu(muc.phieu_id, lyDo);
      show(`Đã mở lại ${muc.ma_lenh_san_xuat} — lệnh về Đang chạy`);
      setMoLai(null);
      load();
      if (onDaMoLai) onDaMoLai(muc);
    } catch (e) {
      show(e.message || 'Mở lại thất bại', 'error');
      throw e;
    }
  };

  const columns = [
    { key: 'tg_kt', header: 'Giờ hoàn tất', render: (r) => fmtDateTime(r.tg_kt) },
    { key: 'kieu', header: 'Kết thúc bằng', render: (r) => { const k = KIEU[r.kieu] || KIEU.HOAN_TAT; return <Badge tone={k.tone}>{k.nhan}</Badge>; } },
    { key: 'ma_lenh_san_xuat', header: 'Lệnh / phiếu', render: (r) => (
      <div><div className="font-medium text-ink">{r.ma_lenh_san_xuat}</div><div className="text-xs text-ink-soft">{r.ma_phieu_san_xuat}</div></div>
    ) },
    { key: 'ma_chuyen', header: 'Chuyền', render: (r) => r.ma_chuyen || r.ten_chuyen || '—' },
    { key: 'ma_phan', header: 'Code phần', render: (r) => (
      <div><div className="text-ink">{r.ds_ma_phan || r.ma_phan || '—'}</div>
        {r.ma_vach_pin && <div className="text-xs text-ink-soft">{hienDsMa(r.ma_vach_pin, '')}</div>}</div>
    ) },
    { key: 'ten_khach_hang', header: 'Khách · Đơn', render: (r) => (
      <div><div className="text-ink">{r.ten_khach_hang || '—'}</div><div className="text-xs text-ink-soft">{r.ma_don_hang || ''}</div></div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu · Kích vải / phim', render: (r) => [r.mau_vai, [r.kich_vai, r.kich_phim].filter(Boolean).join(' / ')].filter(Boolean).join(' · ') || '—' },
    { key: 'target', header: 'SL release', render: (r) => fmtNum(r.target) },
    { key: 'printed', header: 'Đã in', render: (r) => `${fmtNum(r.printed)}${r.so_tem ? ` (${fmtNum(r.so_tem)} tem)` : ''}` },
    { key: 'nguoi_hoan_tat', header: 'Người', render: (r) => r.nguoi_hoan_tat || '—' },
    { key: '_mo', header: '', render: (r) => (can('PROD_RUN') && r.mo_lai_duoc
      ? <Button variant="secondary" icon="undo" onClick={(e) => { e.stopPropagation(); setMoLai(r); }}>Mở lại</Button>
      : <span className="text-xs text-ink-soft">{r.lenh_trang_thai === 'HUY' ? 'Lệnh đã hủy' : (r.mo_lai_duoc ? '' : 'Có phiếu mới hơn')}</span>) },
  ];

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay title={`Lịch sử chạy hoàn tất (${fmtNum(meta.total)})`}
      footer={<Button chiXemOk variant="secondary" onClick={onClose}>Đóng</Button>}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-60">
            <Input value={barcode} placeholder="Barcode đầy đủ — quét rồi Enter"
              onChange={(e) => { setBarcode(e.target.value); if (!e.target.value.trim() && barcodeLoc) { setBarcodeLoc(''); setPage(1); } }}
              onKeyDown={(e) => { if (e.key === 'Enter') chotBarcode(); }} />
          </div>
          <div className="w-64">
            <Input value={tim} placeholder="Tìm code phần, mã hàng, màu, kích, khách, đơn, lệnh…" onChange={(e) => setTim(e.target.value)} />
          </div>
          <div className="w-48">
            <Select value={chuyenId} onChange={(e) => { setChuyenId(e.target.value); setPage(1); }}>
              <option value="">Mọi chuyền</option>
              {dsChuyen.map((c) => <option key={c.id} value={c.id}>{c.ma_chuyen || c.ten_chuyen}</option>)}
            </Select>
          </div>
          <div className={barcodeLoc ? 'pointer-events-none opacity-50' : ''}>
            <DateRangePicker value={khoang} placeholder="Ngày hoàn tất"
              onChange={(v) => { setKhoang(v); setPage(1); }} />
          </div>
          {barcodeLoc && (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              Đang lọc barcode <b>{barcodeLoc}</b> — tìm mọi ngày.{' '}
              <button type="button" className="underline" onClick={() => { setBarcode(''); setBarcodeLoc(''); setPage(1); }}>Bỏ</button>
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <DataTable columns={columns} rows={rows} loading={loading} rowKey="phieu_id" pageSize={0}
            sttStart={(page - 1) * LIMIT} emptyText="Không có phiếu hoàn tất nào khớp bộ lọc" />
        </div>
        <Pagination page={page} totalPages={meta.totalPages || 1} total={meta.total || 0} onPage={setPage} />
      </div>
      <HuyLyDoModal muc={moLai} onClose={() => setMoLai(null)} onXacNhan={xacNhanMoLai}
        tieuDe="Mở lại phiếu sản xuất" nhanNut="Mở lại" nhanLyDo="Lý do mở lại" kieuNut="primary"
        goiY="Vì sao mở lại (vd: bấm hoàn tất nhầm, còn in tiếp)..."
        moTa={(m) => `${m.ma_lenh_san_xuat} · ${m.ds_ma_phan || m.ma_phan || ''} · ${m.ma_chuyen || ''} — đã in ${fmtNum(m.printed)}/${fmtNum(m.target)}`}
        hauQua="Phiếu về Đang chạy (giữ nguyên tem đã in), lệnh về Sản xuất để in tiếp / chạy hoàn tất lại."
        ghiChuErp="" />
    </Modal>
  );
}
