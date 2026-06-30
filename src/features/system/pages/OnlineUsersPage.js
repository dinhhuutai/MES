import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import useToast from '../../../hooks/useToast';
import useNow from '../../../hooks/useNow';
import useSocketEvent from '../../../hooks/useSocketEvent';
import { getOnline, getHistory } from '../../../services/presenceService';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('vi-VN') : '—');
const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');

// Khoảng thời gian online (ms) -> "1g 02p" / "45p" / "12s".
function fmtDur(ms) {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}g ${String(m).padStart(2, '0')}p`;
  if (m) return `${m}p ${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
}

export default function OnlineUsersPage() {
  const { toast, show } = useToast();
  const now = useNow(1000);

  const [online, setOnline] = useState([]);
  const [loadingOnline, setLoadingOnline] = useState(true);

  // Người dùng được chọn để xem lịch sử thao tác.
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(todayStr);
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  const loadOnline = useCallback(async () => {
    try {
      const res = await getOnline();
      setOnline(res.data || []);
    } catch (e) {
      show(e.message || 'Lỗi tải danh sách online', 'error');
    } finally {
      setLoadingOnline(false);
    }
  }, [show]);

  const loadHistory = useCallback(async () => {
    if (!selected) return;
    setLoadingHist(true);
    try {
      const res = await getHistory({ date, userId: selected.userId });
      setHistory((res.data || []).map((r, i) => ({ ...r, _k: i })));
    } catch (e) {
      show(e.message || 'Lỗi tải lịch sử', 'error');
      setHistory([]);
    } finally {
      setLoadingHist(false);
    }
  }, [selected, date, show]);

  useEffect(() => { loadOnline(); }, [loadOnline]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Realtime: có người vào/ra/đổi trang → refetch online; nếu đang xem 1 user thì cập nhật lịch sử.
  useSocketEvent('presence:updated', () => {
    loadOnline();
    if (selected && date === todayStr()) loadHistory();
  });

  const onlineCols = [
    { key: 'hoTen', header: 'Người dùng', className: 'font-medium text-ink',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
          <div>
            <div>{r.hoTen || r.username}</div>
            <div className="text-xs text-ink-soft">@{r.username}</div>
          </div>
        </div>
      ) },
    { key: 'title', header: 'Đang ở trang', render: (r) => (
      <div>
        <div className="text-ink">{r.title || '—'}</div>
        <div className="text-xs text-ink-soft">{r.page || ''}</div>
      </div>
    ) },
    { key: 'soTab', header: 'Tab', className: 'text-center tabular-nums',
      render: (r) => <Badge tone="info">{r.soTab}</Badge> },
    { key: 'since', header: 'Online', className: 'tabular-nums',
      render: (r) => fmtDur(now - r.since) },
    { key: 'lastSeen', header: 'Hoạt động cuối', className: 'tabular-nums', render: (r) => fmtTime(r.lastSeen) },
    { key: 'ip', header: 'IP', className: 'text-xs text-ink-soft', render: (r) => r.ip || '—' },
    { key: '_go', header: '', className: 'text-right text-ink-soft',
      render: () => <Icon name="chevron-right" size={16} /> },
  ];

  const histCols = [
    { key: 'thoi_gian', header: 'Thời gian', className: 'whitespace-nowrap tabular-nums', render: (r) => fmtDt(r.thoi_gian) },
    { key: 'tieu_de', header: 'Trang', className: 'text-ink', render: (r) => r.tieu_de || r.duong_dan },
    { key: 'duong_dan', header: 'Đường dẫn', className: 'text-xs text-ink-soft' },
    { key: 'dia_chi_ip', header: 'IP', className: 'text-xs text-ink-soft', render: (r) => r.dia_chi_ip || '—' },
  ];

  return (
    <div>
      <Toolbar title="Người dùng online" subtitle="Ai đang trực tuyến, đang ở trang nào — bấm vào một người để xem lịch sử thao tác">
        <Badge tone="success">{online.length} đang online</Badge>
      </Toolbar>

      <DataTable columns={onlineCols} rows={online} loading={loadingOnline} rowKey="userId"
        onRowClick={(r) => { setSelected(r); setDate(todayStr()); }}
        emptyText="Không có ai đang online" />

      <SidePanel
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Lịch sử thao tác — ${selected.hoTen || selected.username}` : 'Lịch sử thao tác'}
        subtitle={selected ? `@${selected.username}` : ''}
        width="max-w-2xl"
      >
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-medium text-ink">Ngày</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-input border border-line px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          <Badge tone="default">{history.length} lượt</Badge>
        </div>
        <DataTable columns={histCols} rows={history} loading={loadingHist} rowKey="_k"
          emptyText="Không có lượt truy cập nào trong ngày" />
      </SidePanel>

      <Toast toast={toast} />
    </div>
  );
}
