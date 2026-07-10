import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import SearchableSelect from '../../../components/common/SearchableSelect';
import useToast from '../../../hooks/useToast';
import { getActivity } from '../../../services/presenceService';
import { listUsers } from '../../../services/userService';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');

// Loại thao tác + màu badge.
const LOAI_LIST = ['Điều hướng', 'Thao tác', 'Xác nhận', 'Release', 'Bắt đầu SX', 'In tem', 'KCS', 'Sửa', 'OQC', 'QC in-line', 'Giao'];
const LOAI_TONE = {
  'Điều hướng': 'default', 'Thao tác': 'danger', 'Xác nhận': 'info', Release: 'info',
  'Bắt đầu SX': 'info', 'In tem': 'default', KCS: 'warning', Sửa: 'warning', OQC: 'success',
  'QC in-line': 'info', Giao: 'success',
};
const LIMIT = 20;

export default function ActivityLogPage() {
  const { toast, show } = useToast();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(todayStr);
  const [userId, setUserId] = useState('');
  const [loai, setLoai] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => { listUsers({ limit: 500 }).then((r) => setUsers(r.data.items || r.data || [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getActivity({
        date: date || undefined, userId: userId || undefined,
        loai: loai || undefined, search: search || undefined, page, limit: LIMIT,
      });
      setRows(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      show(e.message || 'Lỗi tải nhật ký', 'error');
    } finally {
      setLoading(false);
    }
  }, [date, userId, loai, search, page, show]);

  // Đổi bộ lọc → về trang 1.
  useEffect(() => { setPage(1); }, [date, userId, loai, search]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / LIMIT)), [total]);
  const hasFilter = date || userId || loai || search;
  const clearAll = () => { setDate(''); setUserId(''); setLoai(''); setSearch(''); };

  const columns = [
    { key: 'tg', header: 'Thời gian', className: 'whitespace-nowrap tabular-nums text-ink-soft', render: (r) => fmtDt(r.tg) },
    { key: 'nguoi', header: 'Người dùng', className: 'font-medium text-ink', render: (r) => (
      <div className="leading-tight">
        <div>{r.nguoi || '—'}</div>
        {r.username && <div className="text-[10px] text-ink-soft">@{r.username}</div>}
      </div>
    ) },
    { key: 'loai', header: 'Loại', render: (r) => <Badge tone={LOAI_TONE[r.loai] || 'default'}>{r.loai}</Badge> },
    { key: 'doi_tuong', header: 'Đối tượng / Trang', className: 'text-ink', render: (r) => (
      <span className="block max-w-[280px] truncate" title={r.doi_tuong}>{r.doi_tuong || '—'}</span>
    ) },
    { key: 'hanh_dong', header: 'Hành động', render: (r) => r.hanh_dong || '—' },
    { key: 'chi_tiet', header: 'Chi tiết (nhập gì)', render: (r) => (
      r.chi_tiet
        ? <span className="block max-w-[320px] truncate font-mono text-[11px] text-ink-soft" title={r.chi_tiet}>{r.chi_tiet}</span>
        : <span className="text-ink-soft">—</span>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Nhật ký thao tác" subtitle="Lịch sử thao tác toàn hệ thống — ai, làm gì, ở trang nào, nhập gì, lúc nào"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm đối tượng, hành động, chi tiết, tên người...">
        <Badge tone="info">{total} lượt</Badge>
      </Toolbar>

      <div className="mb-3 card p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Ngày</label>
            <div className="flex items-center gap-1.5">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="h-10 w-full rounded-input border border-line bg-surface px-3 text-sm" />
              {date && <button type="button" onClick={() => setDate('')} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Người dùng</label>
            <SearchableSelect value={userId} onChange={setUserId} options={users}
              getValue={(u) => u.id} getLabel={(u) => `${u.ho_ten || u.ten_dang_nhap}${u.ten_dang_nhap ? ' (@' + u.ten_dang_nhap + ')' : ''}`}
              placeholder="Tất cả người dùng" emptyLabel="Tất cả người dùng" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Loại thao tác</label>
            <select value={loai} onChange={(e) => setLoai(e.target.value)}
              className="h-10 w-full rounded-input border border-line bg-surface px-3 text-sm">
              <option value="">Tất cả loại</option>
              {LOAI_LIST.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            {hasFilter && (
              <button type="button" onClick={clearAll}
                className="inline-flex h-10 items-center gap-1 text-xs font-medium text-ink-soft underline hover:text-danger">
                <Icon name="x" size={14} /> Xóa tất cả lọc
              </button>
            )}
          </div>
        </div>
        {!date && (
          <p className="mt-2 text-[11px] text-amber-600">Chưa lọc ngày → tải toàn bộ lịch sử (có thể chậm). Nên chọn ngày để nhanh hơn.</p>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="_k"
        emptyText="Không có thao tác nào khớp bộ lọc" />
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />

      <Toast toast={toast} />
    </div>
  );
}
