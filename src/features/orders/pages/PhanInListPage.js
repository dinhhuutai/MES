import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import useToast from '../../../hooks/useToast';
import { listVaiVe, getPhanIn } from '../../../services/orderService';
import { fmtNum, fmtDate, fmtCurrency } from '../../../utils/format';

const LIMIT = 20;
const TH = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft';
const TD = 'px-4 py-3 align-top';

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
      const res = await listVaiVe({ search, page, limit: LIMIT });
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

  const openDetail = async (phanInId) => {
    setLoadingDetail(true);
    setDetail({ id: phanInId });
    try {
      const res = await getPhanIn(phanInId);
      setDetail(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải chi tiết', 'error');
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const sttStart = (meta.page - 1) * LIMIT;
  const COLS = 13;

  return (
    <div>
      <Toolbar title="Danh sách phần in vải về" subtitle="Từ khách hàng → đơn hàng → mã hàng → phần in → đợt vải về"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, mã hàng, màu/kích vải, kích phim, mã đợt vải...">
        <Badge tone="default">Tổng {meta.total}</Badge>
      </Toolbar>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-left">
                <th className={`${TH} w-12 text-right`}>STT</th>
                <th className={TH}>Khách hàng</th>
                <th className={TH}>Đơn hàng</th>
                <th className={TH}>Mã hàng</th>
                <th className={TH}>Code phần</th>
                <th className={TH}>Màu vải</th>
                <th className={TH}>Kích vải</th>
                <th className={TH}>Kích phim</th>
                <th className={`${TH} text-right`}>SL đơn hàng</th>
                <th className={`${TH} text-right border-r border-line/60`}>Lợi nhuận</th>
                <th className={`${TH} text-right`}>SL vải về</th>
                <th className={TH}>Ngày vải về</th>
                <th className={TH}>Hạn giao</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLS} className="px-4 py-12 text-center text-ink-soft">
                  <Icon name="loader" size={22} className="mx-auto animate-spin" />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLS} className="px-4 py-12 text-center text-ink-soft">Chưa có phần in / đợt vải về</td></tr>
              ) : (
                rows.map((g, gi) => {
                  const dots = g.dot_vai && g.dot_vai.length ? g.dot_vai : [null];
                  const n = dots.length;
                  const stt = sttStart + gi + 1;
                  return dots.map((dv, di) => (
                    <tr
                      key={`${g.phan_in_id}-${dv?.dot_vai_id || 'none'}`}
                      onClick={() => openDetail(g.phan_in_id)}
                      className={`cursor-pointer transition hover:bg-surface-muted/40 ${di === n - 1 ? 'border-b border-line/70' : ''}`}
                    >
                      {di === 0 && (
                        <>
                          <td rowSpan={n} className={`${TD} text-right tabular-nums text-ink-soft`}>{stt}</td>
                          <td rowSpan={n} className={`${TD} font-medium text-ink`}>{g.ten_khach_hang}</td>
                          <td rowSpan={n} className={TD}>
                            <div className="text-ink">{g.ma_don_hang}</div>
                            <div className="text-xs text-ink-soft">{g.so_po}</div>
                          </td>
                          <td rowSpan={n} className={TD}>{g.ma_hang}</td>
                          <td rowSpan={n} className={TD}>
                            <Badge tone="info">{g.ma_phan}</Badge>
                            {g.so_dot > 1 && <div className="mt-1"><Badge tone="warning">{g.so_dot} đợt vải</Badge></div>}
                          </td>
                          <td rowSpan={n} className={TD}>{g.mau_vai || '—'}</td>
                          <td rowSpan={n} className={TD}>{g.kich_vai || '—'}</td>
                          <td rowSpan={n} className={TD}>{g.kich_phim || '—'}</td>
                          <td rowSpan={n} className={`${TD} text-right tabular-nums`}>{fmtNum(g.so_luong_don_hang)}</td>
                          <td rowSpan={n} className={`${TD} text-right border-r border-line/60`}>
                            {g.loi_nhuan == null
                              ? <Badge tone="warning">Chưa có</Badge>
                              : <span className="font-medium text-emerald-600">{fmtCurrency(g.loi_nhuan)}</span>}
                          </td>
                        </>
                      )}
                      <td className={`${TD} text-right tabular-nums`}>
                        {dv ? fmtNum(dv.so_luong_vai_ve) : <span className="text-xs italic text-ink-soft">Chưa có vải về</span>}
                      </td>
                      <td className={TD}>{dv ? fmtDate(dv.ngay_vai_ve) : '—'}</td>
                      <td className={TD}>{dv ? fmtDate(dv.han_giao_hang) : '—'}</td>
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
