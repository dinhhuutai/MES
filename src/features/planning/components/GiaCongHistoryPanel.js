import { useEffect, useState, useCallback, useRef } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import DataTable from '../../../components/common/DataTable';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useHuyLichSu from '../../../hooks/useHuyLichSu';
import { giaCongHistory, huyGiaCongTemLichSu } from '../../../services/planningService';
import { fmtNum, ngayLocalISO } from '../../../utils/format';

const todayStr = () => ngayLocalISO(new Date());
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN') : '');

// 3 loại sự kiện trong lịch sử gia công (audit_log.hanh_dong). Chỉ lượt NHẬN HÀNG mới in được tem TH VỀ.
const LOAI = {
  GIA_CONG_CHUYEN_OQC: { label: 'Nhận hàng → OQC', tone: 'success', inTem: true },
  OQC_TRA_VE_GIA_CONG: { label: 'OQC trả về', tone: 'danger', inTem: false },
  GIA_CONG_TRA_LAI: { label: 'Trả lại nhà gia công', tone: 'warning', inTem: false },
};

// Lịch sử gia công theo ngày: nhận hàng → OQC · OQC trả về · trả lại nhà gia công.
// Dòng NHẬN HÀNG có nút "In tem" (tem TH VỀ, đầu 13) + nút "Hủy" (14/10/2026): nhập lý do ⇒ backend hủy tem 13
// (SL trả lại cho lệnh gia công) rồi báo ERP hủy phiếu theo IDMES. Chỉ hiện khi tem còn sống và CHƯA qua OQC / giao.
// `onChanged` = trang cha tải lại bảng Gia công sau khi hủy.
export default function GiaCongHistoryPanel({ open, onClose, onPrint, onChanged }) {
  const { toast, show } = useToast();
  const { can } = usePermissions();
  const [date, setDate] = useState(todayStr);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const onPrintRef = useRef(onPrint);
  onPrintRef.current = onPrint;

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await giaCongHistory(date);
      setRows((res.data || []).map((r, i) => ({ ...r, _k: i })));
    } catch (e) {
      show(e.message || 'Lỗi tải lịch sử', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [open, date, show]);

  const huyLs = useHuyLichSu({
    goiHuy: (r, ly) => huyGiaCongTemLichSu(r.tem_id, ly),
    show,
    coQuyen: can('RELEASE1') || can('RELEASE2'),
    tieuDe: 'Hủy lượt nhận hàng gia công',
    moTa: (r) => <>Tem <b>{r.ma_tem}</b> · {r.ma_phan || r.ma_lenh_san_xuat} · {fmtNum(r.so_luong_lan_nay != null ? r.so_luong_lan_nay : r.so_luong_release)} pcs</>,
    hauQua: 'Tem 13 của lượt nhận bị hủy; số lượng trả lại cho lệnh gia công để nhận lại.',
    nhanNut: 'Hủy lượt nhận',
    baoXong: (r) => `Đã hủy lượt nhận hàng ${r.ma_tem || ''}`,
    sauKhiHuy: () => { if (onChanged) onChanged(); },
  });
  const { taiLai } = huyLs;

  useEffect(() => { load(); }, [load, taiLai]);

  const columns = [
    { key: 'tg', header: 'Giờ', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtTime(r.tg) },
    { key: 'loai', header: 'Sự kiện', render: (r) => {
      const c = LOAI[r.loai] || { label: r.loai || '—', tone: 'default' };
      return <Badge tone={c.tone}>{c.label}</Badge>;
    } },
    { key: 'ma_lenh_san_xuat', header: 'Mã đợt SX', render: (r) => <Badge tone="info">{r.ma_lenh_san_xuat}</Badge> },
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => r.ma_phan || '—' },
    { key: 'ten_khach_hang', header: 'Khách hàng', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_kich', header: 'Màu · Kích', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    // SL của ĐÚNG lượt đó (hàng về nhiều lần); lượt cũ không có khóa → lùi về SL release cả lệnh.
    { key: 'so_luong', header: 'SL', className: 'text-right tabular-nums',
      render: (r) => fmtNum(r.so_luong_lan_nay != null ? r.so_luong_lan_nay : r.so_luong_release) },
    { key: 'ly_do', header: 'Lý do / ghi chú', className: 'max-w-[16rem]',
      render: (r) => <span className="text-ink-soft">{r.ly_do || '—'}</span> },
    { key: 'nguoi', header: 'Người thực hiện', render: (r) => r.nguoi || '—' },
    { key: 'act', header: '', className: 'text-right whitespace-nowrap', render: (r) => (
      (LOAI[r.loai] || {}).inTem ? (
        <Button size="sm" variant="secondary" icon="printer"
          onClick={(e) => { e.stopPropagation(); onPrintRef.current && onPrintRef.current(r); }}>
          In tem
        </Button>
      ) : null
    ) },
    // Hủy được khi: là lượt NHẬN HÀNG, tem 13 còn sống, chưa có lượt OQC / chưa giao (backend chặn lại lần nữa).
    ...huyLs.taoCot((r) => r.loai === 'GIA_CONG_CHUYEN_OQC' && !!r.tem_id && r.tem_trang_thai !== 'HUY' && !r.tem_da_xu_ly),
  ];

  return (
    <SidePanel open={open} onClose={onClose} title="Lịch sử gia công"
      subtitle={`${rows.length} lượt trong ngày · nhận hàng · OQC trả về · trả lại nhà gia công`}
      width="max-w-5xl" side="left">
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium text-ink">Ngày</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-input border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} rowKey="_k" sttStart={0}
        emptyText="Không có hoạt động gia công nào trong ngày" />
      {huyLs.modal}
      <Toast toast={toast} />
    </SidePanel>
  );
}
