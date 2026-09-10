import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import Spinner from '../../../components/common/Spinner';
import Pagination from '../../../components/common/Pagination';
import useToast from '../../../hooks/useToast';
import { listDonHangKpi, saveDonHangKpi } from '../../../services/kpiReadyService';
import { fmtNum, fmtDate } from '../../../utils/format';

const PAGE_SIZE = 20;
const TH = 'whitespace-nowrap px-3 py-2 text-xs font-semibold text-ink-soft';
const TD = 'px-3 py-2 text-sm';

export default function KpiDonHangPage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [chiDaChon, setChiDaChon] = useState(false);
  const [page, setPage] = useState(1);
  // ⚠ `chon` là NGUỒN SỰ THẬT khi đang sửa; `banDau` giữ ảnh chụp lúc tải để biết có thay đổi chưa
  //   lưu hay không (nút Lưu chỉ sáng khi thật sự có gì để lưu).
  const [chon, setChon] = useState(() => new Set());
  const [banDau, setBanDau] = useState(() => new Set());
  // ⚠⚠ CHỈ nạp lựa chọn từ SERVER ở lần tải ĐẦU TIÊN. `search`/`chiDaChon` chỉ lọc DANH SÁCH HIỆN
  //   RA, còn lựa chọn áp cho MỌI đơn — nạp đè mỗi lần gõ ô tìm sẽ XÓA MẤT thứ người dùng vừa tích
  //   ở từ khóa trước (và họ không hề biết vì đơn đó đang bị bộ lọc ẩn đi).
  const daNapChon = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listDonHangKpi({ search, chiDaChon: chiDaChon ? '1' : '' });
      const ds = r.data || [];
      setRows(ds);
      if (!daNapChon.current) {
        const moi = new Set(ds.filter((x) => x.da_chon).map((x) => x.id));
        setChon(new Set(moi));
        setBanDau(moi);
        daNapChon.current = true;
      }
    } catch (e) {
      show(e.message || 'Lỗi tải danh sách đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, chiDaChon, show]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, chiDaChon]);

  const doiKhac = useMemo(() => {
    if (chon.size !== banDau.size) return true;
    for (const id of chon) if (!banDau.has(id)) return true;
    return false;
  }, [chon, banDau]);

  const toggle = (id) => setChon((cu) => {
    const s = new Set(cu);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tatCaTrang = pageRows.length > 0 && pageRows.every((r) => chon.has(r.id));

  const toggleTrang = () => setChon((cu) => {
    const s = new Set(cu);
    if (tatCaTrang) pageRows.forEach((r) => s.delete(r.id));
    else pageRows.forEach((r) => s.add(r.id));
    return s;
  });

  const doSave = async () => {
    setSaving(true);
    try {
      const r = await saveDonHangKpi([...chon]);
      setBanDau(new Set(chon));
      show(`Đã lưu — ${fmtNum(r.data.so_don)} đơn hàng đang lấy số liệu cho trang KPI READY`);
      load();
    } catch (e) {
      // ⚠ Thiếu migration 093 thì backend trả 409 THIEU_MIGRATION — báo rõ chứ đừng nuốt.
      show(e.message || 'Lỗi lưu danh sách', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Toolbar
        title="Chọn đơn hàng (KPI READY)"
        subtitle="Trang Dashboard → KPI READY chỉ lấy số liệu của những đơn hàng được tích ở đây."
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm mã đơn, PO, tên đơn, khách hàng...">
        <label className="flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm text-ink">
          <input type="checkbox" checked={chiDaChon} onChange={(e) => setChiDaChon(e.target.checked)}
            className="h-4 w-4 accent-[#0058be]" />
          Chỉ đơn đã chọn
        </label>
        <Button icon="save" onClick={doSave} loading={saving} disabled={!doiKhac}>
          Lưu ({fmtNum(chon.size)})
        </Button>
      </Toolbar>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={chon.size ? 'success' : 'warning'}>
          {chon.size ? `${fmtNum(chon.size)} đơn đang lấy số liệu` : 'Chưa chọn đơn nào'}
        </Badge>
        {doiKhac && <Badge tone="warning">Có thay đổi chưa lưu</Badge>}
        {loading && <Spinner size={16} />}
        <span className="text-ink-soft">Hiển thị {fmtNum(rows.length)} đơn</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="sticky top-0 z-10 bg-surface-muted">
                <th className={`${TH} w-10 text-center`}>
                  <input type="checkbox" checked={tatCaTrang} onChange={toggleTrang}
                    title="Chọn / bỏ chọn cả trang" className="h-4 w-4 accent-[#0058be]" />
                </th>
                <th className={`${TH} w-12 text-center`}>STT</th>
                <th className={TH}>Mã đơn hàng</th>
                <th className={TH}>PO</th>
                <th className={TH}>Tên đơn hàng</th>
                <th className={TH}>Khách hàng</th>
                <th className={TH}>Bộ phận BH</th>
                <th className={`${TH} text-right`}>Số phần in</th>
                <th className={TH}>Ngày đặt</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`cursor-pointer border-t border-line hover:bg-surface-muted/60 ${
                    chon.has(r.id) ? 'bg-primary/5' : ''}`}>
                  <td className={`${TD} text-center`} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={chon.has(r.id)} onChange={() => toggle(r.id)}
                      className="h-4 w-4 accent-[#0058be]" />
                  </td>
                  <td className={`${TD} text-center text-ink-soft`}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className={`${TD} font-medium text-ink`}>{r.ma_don_hang}</td>
                  <td className={`${TD} text-ink-soft`}>{r.so_po || '—'}</td>
                  <td className={`${TD} text-ink-soft`}>{r.ten_don_hang || '—'}</td>
                  <td className={TD}>{r.ten_khach_hang}</td>
                  <td className={`${TD} text-ink-soft`}>{r.bo_phan_bh || '—'}</td>
                  <td className={`${TD} text-right tabular-nums ${r.so_phan_in ? '' : 'text-ink-soft'}`}>
                    {fmtNum(r.so_phan_in)}
                  </td>
                  <td className={`${TD} text-ink-soft`}>{r.ngay_dat_hang ? fmtDate(r.ngay_dat_hang) : '—'}</td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-ink-soft">
                    {loading ? 'Đang tải...' : 'Không có đơn hàng nào khớp'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} total={rows.length} onPage={setPage} />
      <Toast toast={toast} />
    </div>
  );
}
