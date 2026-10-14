import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import ChipTabs from '../../../components/common/ChipTabs';
import Icon from '../../../components/common/Icon';
import HanGiaoCell from '../../../components/common/HanGiaoCell';
import { listTonKcs } from '../../../services/deliveryService';
import { fmtNum, fmtDateTime, maTemNhan } from '../../../utils/format';
import { chuanTim } from '../../../utils/timKiem';
import exportCheckpointExcel, { cotTemChung, moTaBoLoc } from '../../../utils/exportCheckpointExcel';

// ─────────────────────────────────────────────────────────────────────────────
// TEM TỒN TỪ KCS (14/10/2026, người dùng yêu cầu) — "những tem đã xác nhận kiểm phẩm nhưng chưa giao".
// 1 dòng / tem (tem gốc 15 + tem sửa 17 riêng vì mang mã riêng); tồn chia 4 chặng sau KCS theo sổ cái
// (backend `delivery.repository.listTonKcs`): Chờ sửa · Chờ OQC · Chờ GN tích (OQC đạt, bán hàng chưa tích) · Chờ giao
// (đã tích, đang ở Danh sách tem giao). Hàng KCS/sửa HỦY không phải tồn. KHÔNG lọc theo *Hiển thị theo PA in* (số tồn).
// ─────────────────────────────────────────────────────────────────────────────

const CHANG = [
  { v: 'ALL', label: 'Tất cả' },
  { v: 'cho_sua', label: 'Chờ sửa' },
  { v: 'cho_oqc', label: 'Chờ OQC' },
  { v: 'cho_tich', label: 'Chờ GN tích' },
  { v: 'cho_giao', label: 'Chờ giao' },
];
const tongTon = (r) => (Number(r.cho_sua) || 0) + (Number(r.cho_oqc) || 0) + (Number(r.cho_tich) || 0) + (Number(r.cho_giao) || 0);
const maHien = (r) => maTemNhan(r.ma_tem, 15, null, r.la_tem_sua);
// Số ngày tồn = từ lượt KCS gần nhất tới hôm nay (theo NGÀY lịch, giờ trình duyệt).
const soNgayTon = (tg) => {
  if (!tg) return null;
  const a = new Date(tg); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b - a) / 86400000));
};
const TRUONG_TIM = (r) => [maHien(r), r.ma_tem, r.ten_khach_hang, r.ma_don_hang, r.ma_hang, r.ma_phan, r.mau_vai,
  r.kich_vai, r.kich_phim, r.ma_chuyen, r.ten_chuyen, r.ma_lenh_san_xuat].join(' ');

export default function TonKcsModal({ open, onClose, show }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chang, setChang] = useState('ALL');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTonKcs();
      setRows(res.data || []);
    } catch (e) {
      if (show) show(e.message || 'Lỗi tải tem tồn từ KCS', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);
  useEffect(() => { if (open) load(); }, [open, load]);

  // Ô tìm áp TRƯỚC, chip đếm trên tập đã tìm (chip không tự áp lên chính nó).
  const daTim = useMemo(() => {
    const tu = chuanTim(q);
    return tu ? rows.filter((r) => chuanTim(TRUONG_TIM(r)).includes(tu)) : rows;
  }, [rows, q]);
  const counts = useMemo(() => {
    const c = { ALL: daTim.length };
    CHANG.slice(1).forEach((x) => { c[x.v] = daTim.filter((r) => Number(r[x.v]) > 0).length; });
    return c;
  }, [daTim]);
  const view = useMemo(
    () => (chang === 'ALL' ? daTim : daTim.filter((r) => Number(r[chang]) > 0)), [daTim, chang]
  );
  const tong = useMemo(() => {
    const t = { cho_sua: 0, cho_oqc: 0, cho_tich: 0, cho_giao: 0 };
    view.forEach((r) => { Object.keys(t).forEach((k) => { t[k] += Number(r[k]) || 0; }); });
    return { ...t, ton: t.cho_sua + t.cho_oqc + t.cho_tich + t.cho_giao };
  }, [view]);

  const so = (k, mau) => (r) => (Number(r[k]) > 0 ? <span className={`font-medium ${mau}`}>{fmtNum(r[k])}</span> : <span className="text-ink-soft">—</span>);
  const columns = [
    { key: 'ma_tem', header: 'Tem', className: 'whitespace-nowrap', render: (r) => <Badge tone={r.la_tem_sua ? 'warning' : 'info'}>{maHien(r)}</Badge> },
    { key: 'khach', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'ma_phan', header: 'Code phần', className: 'whitespace-nowrap', render: (r) => r.ma_phan || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'ma_chuyen', header: 'Chuyền', render: (r) => r.ma_chuyen || '—' },
    { key: 'tg_kcs', header: 'KCS lần cuối', className: 'whitespace-nowrap', render: (r) => (
      <div className="leading-tight">
        <div>{fmtDateTime(r.tg_kcs)}</div>
        <div className="text-xs text-ink-soft">{soNgayTon(r.tg_kcs)} ngày · {r.nguoi_kcs || '—'}</div>
      </div>
    ) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
    { key: 'cho_sua', header: 'Chờ sửa', className: 'text-right tabular-nums', render: so('cho_sua', 'text-amber-600') },
    { key: 'cho_oqc', header: 'Chờ OQC', className: 'text-right tabular-nums', render: so('cho_oqc', 'text-sky-700') },
    { key: 'cho_tich', header: 'Chờ GN tích', className: 'text-right tabular-nums', render: so('cho_tich', 'text-violet-700') },
    { key: 'cho_giao', header: 'Chờ giao', className: 'text-right tabular-nums', render: so('cho_giao', 'text-primary') },
    { key: 'ton', header: 'Tổng tồn', className: 'text-right tabular-nums', render: (r) => <b>{fmtNum(tongTon(r))}</b> },
  ];

  const doExcel = () => exportCheckpointExcel({
    cols: [
      ...cotTemChung(maHien),
      { header: 'KCS lần cuối', width: 18, center: true, value: (r) => (r.tg_kcs ? new Date(r.tg_kcs).toLocaleString('vi-VN') : '') },
      { header: 'Số ngày tồn', width: 10, num: true, value: (r) => soNgayTon(r.tg_kcs) },
      { header: 'Người KCS', width: 18, value: (r) => r.nguoi_kcs || '' },
      { header: 'Hạn giao', width: 13, type: 'date', center: true, value: (r) => r.han_giao_hang },
      { header: 'Chờ sửa', width: 10, num: true, value: (r) => Number(r.cho_sua) || 0 },
      { header: 'Chờ OQC', width: 10, num: true, value: (r) => Number(r.cho_oqc) || 0 },
      { header: 'Chờ GN tích', width: 11, num: true, value: (r) => Number(r.cho_tich) || 0 },
      { header: 'Chờ giao', width: 10, num: true, value: (r) => Number(r.cho_giao) || 0 },
      { header: 'Tổng tồn', width: 10, num: true, value: (r) => tongTon(r) },
    ],
    rows: view,
    title: 'Tem tồn từ KCS — đã kiểm phẩm, chưa giao',
    fileName: 'tem-ton-tu-kcs',
    moTaLoc: moTaBoLoc({
      'chặng': chang === 'ALL' ? '' : (CHANG.find((x) => x.v === chang) || {}).label,
      'tìm': q.trim(),
    }),
  });

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay
      title={`Tem tồn từ KCS — đã kiểm phẩm, chưa giao (${view.length} tem · ${fmtNum(tong.ton)} pcs)`}
      footer={<Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm mã tem, khách, đơn, mã hàng, code phần, màu, kích, chuyền..."
              className="h-10 w-full rounded-input border border-line bg-surface pl-9 pr-3 text-base outline-none focus:border-primary md:text-sm" />
          </div>
          <Button chiXemOk variant="ghost" icon="rotate-cw" onClick={load} loading={loading}>Tải lại</Button>
          <Button chiXemOk variant="secondary" icon="download" onClick={doExcel} disabled={!view.length}>Excel ({view.length})</Button>
        </div>
        <ChipTabs tabs={CHANG} value={chang} counts={counts} onChange={setChang} />
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Chờ sửa <b>{fmtNum(tong.cho_sua)}</b></span>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">Chờ OQC <b>{fmtNum(tong.cho_oqc)}</b></span>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">Chờ GN tích <b>{fmtNum(tong.cho_tich)}</b></span>
          <span className="rounded-full bg-primary-wash px-3 py-1 text-primary">Chờ giao <b>{fmtNum(tong.cho_giao)}</b></span>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-ink">Tổng tồn <b>{fmtNum(tong.ton)}</b> pcs</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <DataTable columns={columns} rows={view} loading={loading} rowKey="tem_id" sttStart={0}
            emptyText={q ? 'Không có tem nào khớp ô tìm' : 'Không có tem nào tồn sau KCS'} />
        </div>
      </div>
    </Modal>
  );
}
