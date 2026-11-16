import { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import DateRangePicker from '../../../components/common/DateRangePicker';
import HuyLyDoModal from '../../../components/common/HuyLyDoModal';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import { fmtNum, fmtDateTime, ngayLocalISO } from '../../../utils/format';
import { listChoNhanSua, lichSuNhanSua, huyNhanSua } from '../../../services/qualityService';
import NhanSuaModal from '../../quality/components/NhanSuaModal';

// ─────────────────────────────────────────────────────────────────────────────
// CHỜ NHẬN SỬA (mig 132, 14/11/2026 — người dùng chốt) — chốt giữa Phân loại lỗi và màn Sửa, cùng kiểu "Chờ GN tích"
// (giữa OQC và Giao). Tem đã phân loại lỗi còn phần CHƯA NHẬN nằm ở đây với số "Chờ nhận" cập nhật theo từng lượt nhận;
// tổ sửa bấm "Nhận sửa" (màn Sửa hoặc nút trên trang này) để đưa đúng số nhận hôm nay lên màn Sửa.
//   · Tab "Lịch sử nhận": các lượt nhận theo ngày; Hủy lượt (quyền SUA, lý do bắt buộc) chỉ khi phần đó chưa sửa ⇒ trả về
//     chờ nhận. Lượt "Dữ liệu cũ" = mig 132 ghi cho tem đã ở màn Sửa trước khi có Nhận sửa — hủy để đưa tem về chờ nhận.
// Luật: BE `utils/choSua.js` + `quality/nhansua.service.js`.
// ─────────────────────────────────────────────────────────────────────────────
export default function ChoNhanSuaPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canSua = can('SUA');
  const homNay = ngayLocalISO(new Date());

  const [tab, setTab] = useState('cho');
  const [rows, setRows] = useState([]);
  const [coCot, setCoCot] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [khoang, setKhoang] = useState({ from: homNay, to: homNay });
  const [nhanOpen, setNhanOpen] = useState(false);
  const [huy, setHuy] = useState(null);

  const lichSu = tab === 'ls';
  const tu = khoang.from || homNay;
  const den = khoang.to || khoang.from || homNay;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = lichSu
        ? await lichSuNhanSua({ tuNgay: tu, denNgay: den, search: search || undefined })
        : await listChoNhanSua({ search: search || undefined });
      setRows(res.data?.items || []);
      setCoCot(res.data?.co_cot !== false);
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải danh sách', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [lichSu, tu, den, search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useSocketReload(['quality:updated'], () => load(true));

  const xacNhanHuy = async (muc, lyDo) => {
    try {
      await huyNhanSua(muc.id, lyDo);
      show(`Đã hủy lượt nhận ${fmtNum(muc.so_luong)} pcs của tem ${muc.ma_tem} — về chờ nhận sửa`);
      setHuy(null);
      load(true);
    } catch (e) { show(e.message || 'Hủy lượt nhận thất bại', 'error'); throw e; }
  };

  const cotChung = [
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone="warning">{r.ma_tem}</Badge> },
    { key: 'khach', header: 'Khách hàng · Mã hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_hang || '—'}</div>
      </div>
    ) },
    { key: 'phan', header: 'Code phần', render: (r) => r.phan_list || r.ma_phan || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ma_chuyen || r.ten_chuyen || '—' },
  ];
  const cotCho = [
    ...cotChung,
    { key: 'tg_phan_loai', header: 'Phân loại lúc', render: (r) => (r.tg_phan_loai ? fmtDateTime(r.tg_phan_loai) : '—') },
    { key: 'con_sua_tong', header: 'Cần sửa', className: 'text-right tabular-nums', render: (r) => fmtNum(r.con_sua_tong) },
    { key: 'da_nhan', header: 'Đã nhận', className: 'text-right tabular-nums', render: (r) => fmtNum(r.da_nhan) },
    { key: 'dang_sua', header: 'Đang sửa', className: 'text-right tabular-nums', render: (r) => fmtNum(r.dang_sua) },
    { key: 'cho_nhan', header: 'Còn chờ nhận', className: 'text-right tabular-nums font-semibold text-primary',
      render: (r) => fmtNum(r.cho_nhan) },
  ];
  const cotLs = [
    { key: 'tg_nhan', header: 'Giờ nhận', render: (r) => fmtDateTime(r.tg_nhan) },
    ...cotChung,
    { key: 'so_luong', header: 'SL nhận', className: 'text-right tabular-nums font-semibold', render: (r) => fmtNum(r.so_luong) },
    { key: 'nguoi', header: 'Người nhận', render: (r) => (r.loai === 'CU' ? <Badge tone="default">Dữ liệu cũ</Badge> : (r.nguoi_nhan || '—')) },
    { key: 'ghi_chu', header: 'Ghi chú', render: (r) => (r.loai === 'CU' ? '' : (r.ghi_chu || '')) },
    { key: 'trang_thai', header: '', className: 'text-right', render: (r) => {
      if (r.da_huy) {
        return (
          <div className="text-right text-xs leading-tight">
            <Badge tone="danger">Đã hủy</Badge>
            <div className="mt-0.5 text-ink-soft">{[r.nguoi_huy, r.tg_huy && fmtDateTime(r.tg_huy)].filter(Boolean).join(' · ')}</div>
            {r.ly_do_huy && <div className="text-ink-soft">{r.ly_do_huy}</div>}
          </div>
        );
      }
      if (!canSua) return null;
      return r.huy_duoc
        ? <Button variant="ghost" className="px-2.5 py-1 text-xs" icon="x" onClick={() => setHuy(r)}>Hủy lượt</Button>
        : <span className="text-xs text-ink-soft" title="Đã sửa tới phần của lượt này">Đã sửa</span>;
    } },
  ];

  const tongCho = rows.reduce((s, r) => s + (Number(r.cho_nhan) || 0), 0);
  const tongNhan = rows.filter((r) => !r.da_huy).reduce((s, r) => s + (Number(r.so_luong) || 0), 0);

  return (
    <div>
      <Toolbar
        title="Chờ nhận sửa"
        subtitle="Hàng đã phân loại lỗi chờ tổ sửa nhận — chỉ phần đã nhận mới lên màn Sửa"
        search={search} onSearch={setSearch} searchPlaceholder="Mã tem / code phần / mã hàng..."
      >
        {canSua && coCot && <Button icon="package" onClick={() => setNhanOpen(true)}>Nhận sửa</Button>}
      </Toolbar>

      {!coCot && (
        <div className="mb-4 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <b>Chưa chạy migration 132.</b> Màn Sửa đang chạy như cũ (phân loại lỗi xong lên thẳng màn Sửa). Chạy
          <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900/60">database/migrations/132_nhan_sua.sql</code>
          bằng user <code>postgres</code> rồi tải lại trang.
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-control bg-surface-muted p-1">
        {[['cho', `Chờ nhận${lichSu ? '' : ` (${rows.length})`}`], ['ls', 'Lịch sử nhận']].map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setRows([]); }}
            className={`flex-1 rounded-[10px] px-4 py-2 text-sm font-semibold transition ${
              tab === k ? 'bg-surface text-primary shadow-card' : 'text-ink-soft'
            }`}>{label}</button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {lichSu && (
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span>Ngày nhận</span>
            <div className="w-64"><DateRangePicker value={khoang} onChange={setKhoang} placeholder="Chọn khoảng ngày nhận" /></div>
          </div>
        )}
        <span className="ml-auto text-xs text-ink-soft">
          {lichSu
            ? <>{fmtNum(rows.length)} lượt · tổng nhận <b className="text-ink">{fmtNum(tongNhan)}</b> pcs</>
            : <>{fmtNum(rows.length)} tem · tổng chờ nhận <b className="text-ink">{fmtNum(tongCho)}</b> pcs</>}
        </span>
      </div>

      <DataTable columns={lichSu ? cotLs : cotCho} rows={rows} loading={loading} rowKey={lichSu ? 'id' : 'tem_id'}
        emptyText={lichSu ? 'Chưa có lượt nhận sửa nào trong khoảng ngày này' : 'Không có tem nào chờ nhận sửa'} />

      <NhanSuaModal open={nhanOpen} onClose={() => setNhanOpen(false)} show={show} onDone={() => load(true)} />
      <HuyLyDoModal muc={huy} onClose={() => setHuy(null)} onXacNhan={xacNhanHuy} tieuDe="Hủy lượt nhận sửa"
        nhanNut="Hủy lượt nhận" ghiChuErp=""
        moTa={(m) => `Tem ${m.ma_tem} · nhận ${fmtNum(m.so_luong)} pcs lúc ${fmtDateTime(m.tg_nhan)}`}
        hauQua="Số này rời màn Sửa, quay về Chờ nhận sửa." goiY="Vì sao hủy (vd: nhập nhầm số lượng nhận)..." />
      <Toast toast={toast} />
    </div>
  );
}
