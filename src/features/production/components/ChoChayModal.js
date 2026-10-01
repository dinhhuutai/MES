import { useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import GomBadge from '../../../components/common/GomBadge';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import ChipTabs from '../../../components/common/ChipTabs';
import DateRangePicker from '../../../components/common/DateRangePicker';
import { Field, Input } from '../../../components/common/controls';
import { slaRowClass } from '../../../utils/sla';
import { fmtNum, fmtDate } from '../../../utils/format';
import { LOAI_TABS, nhanChip, demChip } from '../../../utils/khuChuyen';
import exportCheckpointExcel, { COT_LENH, moTaBoLoc } from '../../../utils/exportCheckpointExcel';
import { locLenhChay, coLoc, LOC_TRONG } from '../utils/locLenhChay';

// ─────────────────────────────────────────────────────────────────────────────
// PANEL LỌC dùng chung bảng *Đang chạy* (trang) và modal *Chờ chạy* — 6 ô phần in + ô chuyền.
// ─────────────────────────────────────────────────────────────────────────────
export function LocLenhPanel({ loc, setLoc, chuyen }) {
  const o = (k, nhan, ph) => (
    <Field label={nhan}>
      <Input value={loc[k]} onChange={(e) => setLoc({ ...loc, [k]: e.target.value })} placeholder={ph} />
    </Field>
  );
  return (
    <div className="mb-3 rounded-card border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        {o('khach', 'Khách hàng', 'Lọc khách...')}
        {o('don', 'Đơn hàng', 'Lọc đơn...')}
        {o('maHang', 'Mã hàng', 'Lọc mã hàng...')}
        {o('mauVai', 'Màu vải', 'Lọc màu...')}
        {o('kichVai', 'Kích vải', 'Lọc kích vải...')}
        {o('kichPhim', 'Kích phim', 'Lọc kích phim...')}
        <Field label="Chuyền">
          <select value={loc.chuyenId} onChange={(e) => setLoc({ ...loc, chuyenId: e.target.value })}
            className="h-9 w-full rounded-input border border-line bg-surface px-2 text-sm">
            <option value="">Tất cả chuyền</option>
            {(chuyen || []).map((c) => <option key={c.id} value={c.id}>{c.ten_chuyen || c.ma_chuyen}</option>)}
          </select>
        </Field>
      </div>
      {coLoc(loc) && (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={() => setLoc(LOC_TRONG)} className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-danger">
            <Icon name="x" size={14} /> Xóa lọc
          </button>
        </div>
      )}
    </div>
  );
}

// Lệnh GOM SET → tách 1 dòng / phần in (cột mức lệnh `merge`).
const subRows = (r) => (r.phan_in_list ? r.phan_in_list.map((p) => ({ ...p, __sub: true })) : null);

// ─────────────────────────────────────────────────────────────────────────────
// MODAL "CHỜ CHẠY" (01/10/2026) — trước là bảng thứ hai ngay dưới *Đang chạy*; người dùng muốn trang gọn
// ⇒ chuyển vào modal mở từ nút "Chờ chạy (N)". Bộ lọc RIÊNG của modal (ô tìm + 7 ô + chip + ngày SX KH),
// không dính bộ lọc bảng Đang chạy. Nút Xác nhận chạy / Trả về KT gọi ngược ra trang (modal xác nhận ở đó).
// ─────────────────────────────────────────────────────────────────────────────
export default function ChoChayModal({ open, onClose, rows, loading, chuyen, canRun, statusLenh, onConfirm, onTraVe }) {
  const [search, setSearch] = useState('');
  const [loc, setLoc] = useState(LOC_TRONG);
  const [moLoc, setMoLoc] = useState(false);
  const [loai, setLoai] = useState('');
  const [ngay, setNgay] = useState({ from: '', to: '' });

  const hien = useMemo(
    () => locLenhChay(rows, { search, loc, chuyen, loai, ngay: [{ cot: 'ngay_ke_hoach', ...ngay }] }),
    [rows, search, loc, chuyen, ngay, loai]
  );
  // Số trên chip = tập đã qua mọi bộ lọc TRỪ chính chip.
  const soChip = useMemo(
    () => demChip(locLenhChay(rows, { search, loc, chuyen, boChip: true, ngay: [{ cot: 'ngay_ke_hoach', ...ngay }] })),
    [rows, search, loc, chuyen, ngay]
  );

  const selChuyen = (chuyen || []).find((x) => x.id === loc.chuyenId);
  const doExcel = () => exportCheckpointExcel({
    cols: [...COT_LENH, { header: 'Đã in trước đó', width: 13, num: true, value: (r) => r.da_in_truoc || null }],
    rows: hien, title: 'Đang chờ chạy', fileName: 'cho-chay',
    moTaLoc: moTaBoLoc({
      'tìm kiếm': search, khách: loc.khach, đơn: loc.don, 'mã hàng': loc.maHang, 'màu vải': loc.mauVai,
      'kích vải': loc.kichVai, 'kích phim': loc.kichPhim, chuyền: selChuyen ? (selChuyen.ten_chuyen || selChuyen.ma_chuyen) : '',
      'loại chuyền': nhanChip(loai), 'ngày SX kế hoạch': [ngay.from, ngay.to].filter(Boolean).join(' → '),
    }),
  });

  const cols = [
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => (
      <div>
        <div className="text-ink">{r.ma_hang || '—'}</div>
        {!r.__sub && r.giai_doan === 'EP_UI' && <Badge tone="info">Ép ủi (in kiếng)</Badge>}
        {!r.__sub && <GomBadge soDotVai={r.so_dot_vai} soPhanIn={r.so_phan_in} />}
        {!r.__sub && Number(r.da_in_truoc) > 0 && (
          <div className="mt-0.5">
            <Badge tone="warning">
              Đã in {fmtNum(r.da_in_truoc)}{r.tg_ngung ? ` · ngừng ${new Date(r.tg_ngung).toLocaleString('vi-VN')}` : ''} → in tiếp
            </Badge>
          </div>
        )}
      </div>
    ) },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'ma_chuyen', header: 'Chuyền', merge: true, render: (r) => r.ten_chuyen || '—' },
    { key: 'nha_gia_cong', header: 'Nhà gia công', merge: true, render: (r) => r.nha_gia_cong || '—' },
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', merge: true, render: (r) => fmtNum(r.so_luong_release) },
    { key: 'ngay_ke_hoach', header: 'Ngày SX KH', merge: true, render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', merge: true, render: (r) =>
      canRun && (
        <div className="flex flex-col items-stretch gap-1">
          <Button className="px-2.5 py-1 text-xs" onClick={() => onConfirm(r)}>Xác nhận chạy</Button>
          <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => onTraVe(r)}>Trả về Kỹ thuật</Button>
        </div>
      ) },
  ];

  return (
    <Modal open={open} onClose={onClose} size="full" canhTren={8} lapDay
      title={`Chờ chạy (${hien.length}${hien.length !== (rows || []).length ? `/${(rows || []).length}` : ''})`}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[16rem] flex-1">
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã lệnh, code phần, mã vạch TDTHĐH / HSKT, mã hàng, màu/kích, đơn..." />
          </div>
          <DateRangePicker value={ngay} onChange={setNgay} placeholder="Ngày SX kế hoạch" />
          <Button chiXemOk variant={moLoc || coLoc(loc) ? 'secondary' : 'ghost'} icon="filter" onClick={() => setMoLoc((v) => !v)}>
            Bộ lọc{coLoc(loc) ? ' ●' : ''}
          </Button>
          <Button chiXemOk variant="secondary" icon="download" onClick={doExcel} disabled={!hien.length}>
            Excel ({hien.length})
          </Button>
        </div>
        {moLoc && <LocLenhPanel loc={loc} setLoc={setLoc} chuyen={chuyen} />}
        <ChipTabs tabs={LOAI_TABS} value={loai} counts={soChip} onChange={setLoai} />
        <div className="mt-2 min-h-0 flex-1 overflow-auto">
          <DataTable columns={cols} rows={hien} loading={loading} sttStart={0}
            subRows={subRows} rowClassName={(r) => slaRowClass(statusLenh(r.id))}
            emptyText="Không có lệnh nào chờ chạy" />
        </div>
      </div>
    </Modal>
  );
}
