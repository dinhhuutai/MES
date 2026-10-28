import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import DataTable from '../../../components/common/DataTable';
import DateRangePicker from '../../../components/common/DateRangePicker';
import { Input } from '../../../components/common/controls';
import { listTemDaIn } from '../../../services/productionService';
import useSocketReload from '../../../hooks/useSocketReload';
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';
import { fmtNum, fmtDateTime, ngayLocalISO } from '../../../utils/format';
import { khopTungTu } from '../../../utils/timKiem';
import exportCheckpointExcel, { moTaBoLoc } from '../../../utils/exportCheckpointExcel';
import { TT, ttBadge } from './DanhSachTemView';

// ─────────────────────────────────────────────────────────────────────────────
// TEM CỦA TÔI (28/10/2026, người dùng yêu cầu) — nút ở màn Xác nhận chạy. Danh sách PHẦN IN mà tài khoản đang đăng
// nhập đã in tem + các tem của từng phần in. Nguồn = CHÍNH `GET /production/tem/danh-sach` với `cuaToi=1` (BE lọc
// `tem.created_by` = người đăng nhập, id lấy từ token) + khoảng NGÀY IN TEM (mặc định hôm nay), tải hết rồi gom ở FE.
//   · 1 BẢN GHI = 1 phần in (phần in đại diện của lệnh — như Danh sách tem in), mỗi tem 1 dòng; thông tin phần in
//     (cột `merge`) hợp nhất ô khi phần in có nhiều tem. Mọi ô 1 hàng (`whitespace-nowrap`), bảng cuộn ngang.
//   · Tổng SL / số tem KHÔNG tính tem đã hủy (tem hủy vẫn hiện để đối chiếu, trừ khi tích "Ẩn tem đã hủy").
// ─────────────────────────────────────────────────────────────────────────────
const NW = 'whitespace-nowrap';
const chu = (v) => (v == null || v === '' ? '—' : v);
const khoaPhan = (t) => t.phan_in_id || `${t.ma_phan || ''}|${t.ma_lenh_san_xuat || ''}`;

// Gom tem theo phần in — phần in có tem in gần nhất đứng đầu, tem trong phần in mới nhất trên cùng.
function gomTheoPhanIn(tems) {
  const m = new Map();
  tems.forEach((t) => {
    const k = khoaPhan(t);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  });
  return [...m.entries()].map(([k, ds]) => {
    const sap = [...ds].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    const song = sap.filter((t) => t.trang_thai !== 'HUY');
    return {
      ...sap[0],                      // bản ghi 1 tem ⇒ DataTable vẽ 1 dòng bằng chính bản ghi (cần trường của tem)
      _k: k,
      _tems: sap,
      _so_tem: song.length,
      _so_huy: sap.length - song.length,
      _tong_sl: song.reduce((s, t) => s + (Number(t.so_luong) || 0), 0),
      _moi_nhat: sap[0].created_date,
    };
  }).sort((a, b) => new Date(b._moi_nhat) - new Date(a._moi_nhat));
}

const chuoiTim = (t) => [t.ma_tem, t.ma_phan, t.ma_hang, t.ten_khach_hang, t.ma_don_hang, t.mau_vai, t.kich_vai,
  t.kich_phim, t.ma_lenh_san_xuat, t.ma_chuyen, t.ten_chuyen, t.ma_ngay_ca, t.ma_lo].filter(Boolean).join(' ');

export default function TemCuaToiModal({ open, onClose, show }) {
  const homNay = ngayLocalISO(new Date());
  const [khoang, setKhoang] = useState({ from: homNay, to: homNay });
  const [tim, setTim] = useState('');
  const [anHuy, setAnHuy] = useState(true);
  const [tems, setTems] = useState([]);
  const [loading, setLoading] = useState(false);

  const tu = khoang.from || homNay;
  const den = khoang.to || khoang.from || homNay;
  const load = useCallback(async (ngam = false) => {
    if (!open) return;
    if (!ngam) setLoading(true);
    try {
      const { items, thieu, total } = await taiHetTrang(
        (p) => listTemDaIn({ cuaToi: 1, ngayTu: tu, ngayDen: den, ...p }), { limit: LIMIT_TAI_LON }
      );
      setTems(items);
      if (thieu && !ngam) show(`Chỉ tải được ${items.length}/${total} tem — thu hẹp khoảng ngày`, 'error');
    } catch (e) {
      if (!ngam) show(e.message || 'Không tải được tem của tôi', 'error');
    } finally {
      if (!ngam) setLoading(false);
    }
  }, [open, tu, den, show]);
  useEffect(() => { load(); }, [load]);
  // In tem / hủy tem ở sidebar ⇒ tải ngầm (giữ bảng, không spinner).
  useSocketReload(['production:updated'], () => load(true));

  const temLoc = useMemo(() => tems.filter((t) => (!anHuy || t.trang_thai !== 'HUY') && khopTungTu(chuoiTim(t), tim)),
    [tems, anHuy, tim]);
  const nhom = useMemo(() => gomTheoPhanIn(temLoc), [temLoc]);
  const tong = useMemo(() => ({
    phan: nhom.length,
    tem: nhom.reduce((s, g) => s + g._so_tem, 0),
    sl: nhom.reduce((s, g) => s + g._tong_sl, 0),
  }), [nhom]);

  const columns = [
    // ── thông tin PHẦN IN (hợp nhất ô) ──
    { key: 'ma_phan', header: 'Code phần', merge: true, className: `${NW} font-medium text-ink`, render: (r) => chu(r.ma_phan) },
    { key: 'ten_khach_hang', header: 'Khách hàng', merge: true, className: NW, render: (r) => chu(r.ten_khach_hang) },
    { key: 'ma_don_hang', header: 'Đơn hàng', merge: true, className: NW, render: (r) => chu(r.ma_don_hang) },
    { key: 'ma_hang', header: 'Mã hàng', merge: true, className: NW, render: (r) => chu(r.ma_hang) },
    { key: 'mau_vai', header: 'Màu vải', merge: true, className: NW, render: (r) => chu(r.mau_vai) },
    { key: 'kich_vai', header: 'Kích vải', merge: true, className: NW, render: (r) => chu(r.kich_vai) },
    { key: 'kich_phim', header: 'Kích phim', merge: true, className: NW, render: (r) => chu(r.kich_phim) },
    { key: 'tinh_chat_in', header: 'Tính chất in', merge: true, className: NW, render: (r) => chu(r.tinh_chat_in) },
    { key: 'so_luong_don_hang', header: 'SLĐH', merge: true, className: `${NW} text-right tabular-nums`, headerClassName: 'text-right',
      render: (r) => fmtNum(r.so_luong_don_hang) },
    { key: '_so_tem', header: 'Số tem', merge: true, className: `${NW} text-right tabular-nums`, headerClassName: 'text-right',
      render: (r) => (
        <span>{fmtNum(r._so_tem)}{r._so_huy ? <span className="ml-1 text-xs text-danger">(+{fmtNum(r._so_huy)} hủy)</span> : null}</span>
      ) },
    { key: '_tong_sl', header: 'Tổng SL in', merge: true, className: `${NW} text-right font-semibold tabular-nums text-ink`, headerClassName: 'text-right',
      render: (r) => fmtNum(r._tong_sl) },
    // ── từng TEM ──
    { key: 'ma_tem', header: 'Mã tem', className: `${NW} font-mono text-ink`, render: (r) => chu(r.ma_tem) },
    { key: 'so_luong', header: 'SL in', className: `${NW} text-right tabular-nums`, headerClassName: 'text-right',
      render: (r) => (r.trang_thai === 'HUY' ? <span className="text-ink-soft line-through">{fmtNum(r.so_luong)}</span> : fmtNum(r.so_luong)) },
    { key: 'trang_thai', header: 'Trạng thái', className: NW, render: (r) => ttBadge(r.trang_thai) },
    { key: 'created_date', header: 'Giờ in tem', className: `${NW} text-ink-soft`, render: (r) => fmtDateTime(r.created_date) },
    { key: 'ma_ngay_ca', header: 'Ngày ca', className: NW, render: (r) => chu(r.ma_ngay_ca) },
    { key: 'gio_sx', header: 'Giờ SX', className: NW,
      render: (r) => (r.gio_sx_bd || r.gio_sx_kt ? `${chu(r.gio_sx_bd)} → ${chu(r.gio_sx_kt)}` : '—') },
    { key: 'ma_chuyen', header: 'Chuyền', className: NW, render: (r) => chu(r.ma_chuyen || r.ten_chuyen) },
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', className: NW, render: (r) => chu(r.ma_lenh_san_xuat) },
    { key: 'ma_lo', header: 'Mã lô', className: NW, render: (r) => chu(r.ma_lo) },
    { key: 'vai', header: 'Hủy / Thiếu', className: `${NW} text-right tabular-nums`, headerClassName: 'text-right',
      render: (r) => (Number(r.sl_vai_huy_tem) || Number(r.sl_vai_thieu_tem)
        ? <span><span className="text-danger">{fmtNum(r.sl_vai_huy_tem)}</span> / <span className="text-warning">{fmtNum(r.sl_vai_thieu_tem)}</span></span>
        : <span className="text-ink-soft">—</span>) },
  ];

  // Excel: 1 dòng / tem (thông tin phần in lặp lại), đúng tập đang xem.
  const doExcel = () => exportCheckpointExcel({
    cols: [
      { header: 'Code phần', width: 26, value: (t) => t.ma_phan || '' },
      { header: 'Khách hàng', width: 16, value: (t) => t.ten_khach_hang || '' },
      { header: 'Đơn hàng', width: 18, value: (t) => t.ma_don_hang || '' },
      { header: 'Mã hàng', width: 22, value: (t) => t.ma_hang || '' },
      { header: 'Màu vải', width: 16, value: (t) => t.mau_vai || '' },
      { header: 'Kích vải', width: 12, value: (t) => t.kich_vai || '' },
      { header: 'Kích phim', width: 12, value: (t) => t.kich_phim || '' },
      { header: 'Tính chất in', width: 13, value: (t) => t.tinh_chat_in || '' },
      { header: 'SLĐH', width: 10, num: true, value: (t) => (t.so_luong_don_hang == null ? null : Number(t.so_luong_don_hang)) },
      { header: 'Mã tem', width: 16, value: (t) => t.ma_tem || '' },
      { header: 'SL in', width: 10, num: true, value: (t) => (t.so_luong == null ? null : Number(t.so_luong)) },
      { header: 'Trạng thái', width: 13, value: (t) => (TT[t.trang_thai] || [t.trang_thai || ''])[0] },
      { header: 'Giờ in tem', width: 18, center: true, value: (t) => (t.created_date ? new Date(t.created_date).toLocaleString('vi-VN') : '') },
      { header: 'Ngày ca', width: 12, value: (t) => t.ma_ngay_ca || '' },
      { header: 'Giờ SX', width: 14, center: true, value: (t) => [t.gio_sx_bd, t.gio_sx_kt].filter(Boolean).join(' → ') },
      { header: 'Chuyền', width: 12, value: (t) => t.ma_chuyen || t.ten_chuyen || '' },
      { header: 'Mã đợt SX', width: 14, value: (t) => t.ma_lenh_san_xuat || '' },
      { header: 'Mã lô', width: 22, value: (t) => t.ma_lo || '' },
      { header: 'Vải hủy', width: 10, num: true, value: (t) => Number(t.sl_vai_huy_tem) || null },
      { header: 'Vải thiếu', width: 10, num: true, value: (t) => Number(t.sl_vai_thieu_tem) || null },
    ],
    rows: nhom.flatMap((g) => g._tems),
    title: 'Tem của tôi',
    fileName: 'tem-cua-toi',
    moTaLoc: moTaBoLoc({ 'ngày in tem': tu === den ? tu : `${tu} → ${den}`, 'tìm kiếm': tim, 'ẩn tem đã hủy': anHuy ? 'có' : '' }),
  });

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay canhTren={16} title="Tem của tôi"
      footer={<Button chiXemOk variant="secondary" onClick={onClose}>Đóng</Button>}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-72">
            <Input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm code phần, mã tem, mã hàng, đơn..." />
          </div>
          <DateRangePicker value={khoang} onChange={(v) => setKhoang({ from: v.from || '', to: v.to || '' })} placeholder="Ngày in tem" />
          <label className="inline-flex h-10 cursor-pointer select-none items-center gap-2 rounded-control border border-line px-3 text-sm text-ink hover:bg-surface-muted">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={anHuy} onChange={(e) => setAnHuy(e.target.checked)} />
            Ẩn tem đã hủy
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge tone="info">{fmtNum(tong.phan)} phần in</Badge>
            <Badge tone="info">{fmtNum(tong.tem)} tem</Badge>
            <Badge tone="success">{fmtNum(tong.sl)} pcs</Badge>
            <Button chiXemOk variant="secondary" icon="download" onClick={doExcel} disabled={!nhom.length}>Excel</Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <DataTable columns={columns} rows={nhom} loading={loading} rowKey="_k" sttStart={0} pageSize={0}
            subRows={(g) => g._tems}
            emptyText={tim ? 'Không có tem khớp ô tìm' : 'Bạn chưa in tem nào trong khoảng ngày này'} />
        </div>
      </div>
    </Modal>
  );
}
