import { useCallback, useEffect, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import usePermissions from '../../../hooks/usePermissions';
import { fmtNum, fmtDateTime } from '../../../utils/format';
import { listChoNhanSua } from '../../../services/qualityService';
import NhanSuaModal from '../../quality/components/NhanSuaModal';
import LuotNhanSuaBang from '../../quality/components/LuotNhanSuaBang';

// ─────────────────────────────────────────────────────────────────────────────
// CHỜ NHẬN SỬA (mig 132, 14/11/2026 — người dùng chốt) — chốt giữa Phân loại lỗi và màn Sửa, cùng kiểu "Chờ GN tích"
// (giữa OQC và Giao). Tem đã phân loại lỗi còn phần CHƯA NHẬN nằm ở đây với số "Chờ nhận" cập nhật theo từng lượt nhận;
// tổ sửa bấm "Nhận sửa" (màn Sửa hoặc nút trên trang này) để đưa đúng số nhận hôm nay lên màn Sửa.
//   · Tab "Lịch sử nhận" = `LuotNhanSuaBang` (dùng chung với trang Sửa): Hủy lượt / Mở lại (quyền SUA, lý do bắt buộc).
//     Lượt "Dữ liệu cũ" = mig 132 ghi cho tem đã ở màn Sửa trước khi có Nhận sửa — hủy để đưa tem về chờ nhận.
// Luật: BE `utils/choSua.js` + `quality/nhansua.service.js`.
// ─────────────────────────────────────────────────────────────────────────────
export default function ChoNhanSuaPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canSua = can('SUA');

  const [tab, setTab] = useState('cho');
  const [rows, setRows] = useState([]);
  const [coCot, setCoCot] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [nhanOpen, setNhanOpen] = useState(false);

  const lichSu = tab === 'ls';

  const load = useCallback(async (silent = false) => {
    if (lichSu) return;
    if (!silent) setLoading(true);
    try {
      const res = await listChoNhanSua({ search: search || undefined });
      setRows(res.data?.items || []);
      setCoCot(res.data?.co_cot !== false);
    } catch (e) {
      if (!silent) show(e.message || 'Lỗi tải danh sách', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [lichSu, search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useSocketReload(['quality:updated'], () => load(true));

  const cotCho = [
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
    { key: 'tg_phan_loai', header: 'Phân loại lúc', render: (r) => (r.tg_phan_loai ? fmtDateTime(r.tg_phan_loai) : '—') },
    { key: 'con_sua_tong', header: 'Cần sửa', className: 'text-right tabular-nums', render: (r) => fmtNum(r.con_sua_tong) },
    { key: 'da_nhan', header: 'Đã nhận', className: 'text-right tabular-nums', render: (r) => fmtNum(r.da_nhan) },
    { key: 'dang_sua', header: 'Đang sửa', className: 'text-right tabular-nums', render: (r) => fmtNum(r.dang_sua) },
    { key: 'cho_nhan', header: 'Còn chờ nhận', className: 'text-right tabular-nums font-semibold text-primary',
      render: (r) => fmtNum(r.cho_nhan) },
  ];

  const tongCho = rows.reduce((s, r) => s + (Number(r.cho_nhan) || 0), 0);

  return (
    <div>
      <Toolbar
        title="Chờ nhận sửa"
        subtitle="Hàng đã phân loại lỗi chờ tổ sửa nhận — chỉ phần đã nhận mới lên màn Sửa"
        search={search} onSearch={setSearch} searchPlaceholder={lichSu ? 'Mã tem / code phần / mã hàng (mọi ngày)...' : 'Mã tem / code phần / mã hàng...'}
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

      {lichSu ? (
        <LuotNhanSuaBang show={show} cheDo="ls" search={search} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="ml-auto text-xs text-ink-soft">
              {fmtNum(rows.length)} tem · tổng chờ nhận <b className="text-ink">{fmtNum(tongCho)}</b> pcs
            </span>
          </div>
          <DataTable columns={cotCho} rows={rows} loading={loading} rowKey="tem_id" emptyText="Không có tem nào chờ nhận sửa" />
        </>
      )}

      <NhanSuaModal open={nhanOpen} onClose={() => setNhanOpen(false)} show={show} onDone={() => load(true)} />
      <Toast toast={toast} />
    </div>
  );
}
