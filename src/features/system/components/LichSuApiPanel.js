import { useCallback, useEffect, useState } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Spinner from '../../../components/common/Spinner';
import { inputClass } from '../../../components/common/controls';
import { lichSuApi } from '../../../services/caiDatApiService';

// ─────────────────────────────────────────────────────────────────────────────
// LỊCH SỬ GỌI API ERP — dựng theo đúng khuôn màn *Đồng bộ ERP* (bảng + lọc ngày + phân trang +
// bấm 1 dòng để xem dữ liệu gốc), nhưng thêm 2 thứ mà màn kia không cần:
//   · cột **IDMES** đứng ngay sau thời gian — đây là KHÓA ĐỐI SOÁT MES ↔ ERP, có nút copy;
//   · ô tìm theo IDMES / mã tem, vì lúc đối soát người dùng cầm đúng 2 mã đó trên tay.
// ─────────────────────────────────────────────────────────────────────────────

const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');

// Ô mã cần copy nhanh (IDMES / mã tem): 1 chạm là có thể dán sang màn tra cứu của ERP.
function MaCopy({ v, manh }) {
  const [xong, setXong] = useState(false);
  if (!v) return <span className="text-ink-soft">—</span>;
  const chep = (e) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(String(v));
      setXong(true);
      setTimeout(() => setXong(false), 1200);
    } catch { /* trình duyệt chặn clipboard — bỏ qua, người dùng vẫn bôi đen chép tay được */ }
  };
  return (
    <button type="button" onClick={chep} title="Bấm để chép"
      className={`group inline-flex items-center gap-1 font-mono ${manh ? 'font-semibold text-ink' : 'text-ink-soft'} hover:text-primary`}>
      {v}
      <Icon name={xong ? 'check' : 'copy'} size={12}
        className={xong ? 'text-success' : 'opacity-0 transition-opacity group-hover:opacity-100'} />
    </button>
  );
}

function KhoiJson({ nhan, giaTri }) {
  if (giaTri == null || giaTri === '') return null;
  const text = typeof giaTri === 'string' ? giaTri : JSON.stringify(giaTri, null, 2);
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{nhan}</p>
      <pre className="max-h-[40vh] overflow-auto rounded-control border border-line bg-surface-muted p-3 text-xs leading-relaxed text-ink whitespace-pre-wrap break-all">
        {text}
      </pre>
    </div>
  );
}

export default function LichSuApiPanel({ open, onClose, ma, ten, laGhiInTem }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [chon, setChon] = useState(null); // dòng đang mở chi tiết

  const load = useCallback(async () => {
    if (!open || !ma) return;
    setLoading(true);
    try {
      const res = await lichSuApi(ma, { date: date || undefined, search: search || undefined, page, limit: 20 });
      setRows(res.data.items || []);
      setMeta(res.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch {
      setRows([]);
    } finally { setLoading(false); }
  }, [open, ma, date, search, page]);
  useEffect(() => { load(); }, [load]);

  // Mở panel cho API khác / đóng rồi mở lại ⇒ về trang 1, bỏ chi tiết đang xem.
  useEffect(() => { if (open) { setPage(1); setChon(null); } }, [open, ma]);

  const columns = [
    { key: 'thoi_gian', header: 'Thời gian', render: (r) => fmtDt(r.thoi_gian) },
    {
      key: 'thanh_cong',
      header: 'Kết quả',
      render: (r) => (r.thanh_cong
        ? <Badge tone="success">Thành công</Badge>
        : <Badge tone="danger">Lỗi</Badge>),
    },
    // IDMES đứng ngay sau kết quả — thứ người dùng cần nhất khi đối soát 2 bên.
    { key: 'id_mes', header: 'IDMES', render: (r) => <MaCopy v={r.id_mes} manh /> },
    { key: 'ma_tem', header: 'Mã tem', render: (r) => <MaCopy v={r.ma_tem} /> },
    {
      key: 'thoi_gian_ms',
      header: 'Mất',
      className: 'text-right tabular-nums',
      render: (r) => (r.thoi_gian_ms == null ? '—' : `${(r.thoi_gian_ms / 1000).toFixed(1)}s`),
    },
    {
      key: 'so_lan_thu',
      header: 'Lần thử',
      className: 'text-right tabular-nums',
      render: (r) => (r.so_lan_thu == null ? '—' : r.so_lan_thu),
    },
    { key: 'nguoi', header: 'Người', render: (r) => r.nguoi || '—' },
    {
      key: 'loi',
      header: 'Lỗi',
      render: (r) => (r.loi
        ? <span className="line-clamp-2 text-xs text-danger" title={r.loi}>{r.loi}</span>
        : <span className="text-ink-soft">—</span>),
    },
  ];

  return (
    <SidePanel open={open} onClose={onClose} width="max-w-6xl"
      title={`Lịch sử: ${ten || ''}`}
      subtitle={laGhiInTem
        ? 'Mỗi dòng = 1 lượt MES gửi lên ERP. Bấm 1 dòng để xem đủ 20 trường đã gửi và phản hồi nhận về.'
        : 'Mỗi dòng = 1 lần MES xin mã tem từ ERP. Mỗi lần gọi là TIÊU một mã của ERP.'}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span>Ngày</span>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }}
              className="h-9 rounded-input border border-line bg-surface px-2 text-sm outline-none focus:border-primary" />
            {date && (
              <button type="button" onClick={() => { setDate(''); setPage(1); }}
                className="text-ink-soft hover:text-danger" aria-label="Xóa lọc ngày">
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm theo IDMES hoặc mã tem…" className={`${inputClass} max-w-xs`} />
          <Badge tone="info">{meta.total} lượt gọi</Badge>
          <Button variant="secondary" icon="loader" loading={loading} onClick={load} className="ml-auto px-3 py-1.5">
            Tải lại
          </Button>
        </div>

        <DataTable columns={columns} rows={rows} loading={loading} rowKey="id"
          pageSize={0} onRowClick={setChon}
          sttStart={(meta.page - 1) * 20}
          emptyText={date || search
            ? 'Không có lượt gọi nào khớp bộ lọc'
            : 'Chưa có lượt gọi nào được ghi lại'} />
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

        {chon && (
          <div className="space-y-3 rounded-card border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-ink">Chi tiết lượt gọi</h4>
                {chon.thanh_cong ? <Badge tone="success">Thành công</Badge> : <Badge tone="danger">Lỗi</Badge>}
                <span className="text-xs text-ink-soft">{fmtDt(chon.thoi_gian)}</span>
              </div>
              <button type="button" onClick={() => setChon(null)} className="text-ink-soft hover:text-danger">
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-ink-soft">IDMES: </span><MaCopy v={chon.id_mes} manh /></div>
              <div><span className="text-ink-soft">Mã tem: </span><MaCopy v={chon.ma_tem} /></div>
            </div>
            {chon.url && <p className="break-all font-mono text-xs text-ink-soft">{chon.url}</p>}

            {chon.loi && (
              <div className="flex items-start gap-2 rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <Icon name="alert-triangle" size={16} className="mt-0.5 shrink-0" />
                <span className="break-all">{chon.loi}</span>
              </div>
            )}

            <KhoiJson nhan="Đã gửi lên ERP" giaTri={chon.chi_tiet?.gui} />
            <KhoiJson nhan="ERP trả về" giaTri={chon.chi_tiet?.nhan} />
            {/* Dòng ghi TRƯỚC 15/08/2026 có hình dạng cũ (payload nằm ở khóa `payload`) — vẫn xem được. */}
            <KhoiJson nhan="Dữ liệu gốc (bản ghi cũ)" giaTri={chon.chi_tiet?.payload} />
          </div>
        )}

        {loading && !rows.length && <div className="flex justify-center py-8"><Spinner size={24} /></div>}
      </div>
    </SidePanel>
  );
}
