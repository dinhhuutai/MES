import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import { listPhanIn, getPhanIn } from '../../../services/orderService';
import { fmtNum, fmtDate, fmtCurrency } from '../../../utils/format';

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export default function PhanInListPage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPhanIn({ search, page, limit: 20 });
      setRows(res.data.items);
      setMeta(res.data.meta);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = async (row) => {
    setLoadingDetail(true);
    setDetail({ id: row.id });
    try {
      const res = await getPhanIn(row.id);
      setDetail(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải chi tiết', 'error');
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const columns = [
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'min-w-[140px]',
      render: (r) => <span className="font-medium text-ink">{r.ten_khach_hang}</span> },
    { key: 'ma_don_hang', header: 'Đơn hàng',
      render: (r) => <div><div className="text-ink">{r.ma_don_hang}</div><div className="text-xs text-ink-soft">{r.so_po}</div></div> },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'ma_phan', header: 'Code phần', render: (r) => <Badge tone="info">{r.ma_phan}</Badge> },
    { key: 'mau_vai', header: 'Màu vải' },
    { key: 'kich_vai', header: 'Kích vải' },
    { key: 'kich_phim', header: 'Kích phim' },
    { key: 'so_luong_don_hang', header: 'SL đơn', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong_don_hang) },
    { key: 'tong_vai_ve', header: 'SL vải về', className: 'text-right tabular-nums', render: (r) => fmtNum(r.tong_vai_ve) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'ngay_vai_ve', header: 'Ngày vải về', render: (r) => fmtDate(r.ngay_vai_ve) },
    { key: 'loi_nhuan', header: 'Lợi nhuận', className: 'text-right',
      render: (r) => r.loi_nhuan == null ? <Badge tone="warning">Chưa có</Badge> : <span className="font-medium text-emerald-600">{fmtCurrency(r.loi_nhuan)}</span> },
  ];

  return (
    <div>
      <Toolbar title="Danh sách phần in" subtitle="Thông tin phần in theo đơn hàng / đợt vải"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, mã hàng, màu/kích vải, kích phim..." />

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openDetail}
        emptyText="Chưa có phần in" />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.ma_phan ? `Phần in ${detail.ma_phan}` : 'Chi tiết phần in'}
        subtitle={detail?.ten_khach_hang}
      >
        {loadingDetail || !detail?.ma_phan ? (
          <div className="py-10 text-center text-ink-soft">Đang tải...</div>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Đơn hàng</h3>
              <Row label="Khách hàng" value={detail.ten_khach_hang} />
              <Row label="Đơn hàng" value={`${detail.ma_don_hang} · ${detail.so_po || '—'}`} />
              <Row label="Mã hàng" value={`${detail.ma_hang} — ${detail.ten_ma_hang || ''}`} />
            </section>
            <section className="border-t border-line pt-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Thông số phần in</h3>
              <Row label="Code phần" value={detail.ma_phan} />
              <Row label="Màu vải" value={detail.mau_vai || '—'} />
              <Row label="Kích vải" value={detail.kich_vai || '—'} />
              <Row label="Kích phim" value={detail.kich_phim || '—'} />
              <Row label="Tính chất in" value={detail.tinh_chat_in || '—'} />
              <Row label="Độ in / Màu in" value={`${detail.do_in || '—'} / ${detail.mau_in || '—'}`} />
              <Row label="SL đơn hàng" value={fmtNum(detail.so_luong_don_hang)} />
              <Row label="Lợi nhuận" value={detail.loi_nhuan == null ? 'Chưa có' : fmtCurrency(detail.loi_nhuan)} />
            </section>
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                Đợt vải về ({detail.dot_vai?.length || 0})
              </h3>
              {detail.dot_vai?.length ? (
                <div className="space-y-2">
                  {detail.dot_vai.map((dv) => (
                    <div key={dv.id} className="rounded-control border border-line p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">{dv.ma_dot_vai}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-ink-soft">
                        <span>SL vải về: <b className="text-ink">{fmtNum(dv.so_luong_vai_ve)}</b></span>
                        <span>Loại: {dv.loai_dot_vai || '—'}</span>
                        <span>Ngày về: {fmtDate(dv.ngay_vai_ve)}</span>
                        <span>Hạn giao: {fmtDate(dv.han_giao_hang)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-soft">Chưa có đợt vải về.</p>
              )}
            </section>
          </div>
        )}
      </SidePanel>

      <Toast toast={toast} />
    </div>
  );
}
