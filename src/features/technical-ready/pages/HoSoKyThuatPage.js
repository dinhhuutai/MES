import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import QrScanner from '../../../components/common/QrScanner';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import LoaiDotVaiBadge from '../../planning/components/LoaiDotVaiBadge';
import { Input, Select } from '../../../components/common/controls';
import FieldFilters, { FilterToggle } from '../../../components/common/FieldFilters';
import DateRangePicker from '../../../components/common/DateRangePicker';
import Pagination from '../../../components/common/Pagination';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listHskt, getHskt, getHsktByBarcode, changePhuongAnIn } from '../../../services/hsktService';
// Nguồn nhãn phương án in DUY NHẤT (có key 0 = "Chưa xác định"). Bản trùng ở `hsktService` đã bỏ:
// nó thiếu key 0 nên Pain=0 bị in ra số `0` trần.
import { PHUONG_AN_IN } from '../../../components/common/PhuongAnInBadge';
import { fmtNum } from '../../../utils/format';

const COLS = 14; // số cột bảng (cho colSpan hàng trống)
// Ô lọc dạng CHỮ (khớp `FILTER_KEYS` ở hskt.controller — lọc chạy ở server, xem load()).
const HSKT_FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần' },
  { key: 'khach', label: 'Khách hàng' },
  { key: 'don', label: 'Đơn hàng' },
  { key: 'maHang', label: 'Mã hàng' },
  { key: 'mauVai', label: 'Màu vải' },
  { key: 'kichVai', label: 'Kích vải' },
  { key: 'kichPhim', label: 'Kích phim' },
  { key: 'loaiDotVai', label: 'Loại đợt vải' },
];
const HSKT_TEXT_KEYS = HSKT_FILTER_FIELDS.map((f) => f.key);
// GOM SET: ERP `Inset` ≠ 0 = có gom set; các phần in dùng CHUNG 1 barcode HSKT là gom chung
// ⇒ danh sách phần in của HSKT CHÍNH LÀ nhóm gom set (không cần tra thêm bảng nào).
const laGomSet = (h) => h && h.inset != null && Number(h.inset) !== 0;
// SỐ CUỐI mã vạch HSKT = phương án in (1 Bàn · 2 Máy · 3 Robot, 0 = chưa xác định — ERP CÓ gửi
// Pain=0) — khớp `backend/src/utils/hskt.js`.
// Chỉ đổi được khi mã vạch đúng dạng 11 số + số cuối 0..3; sai dạng thì giữ nguyên.
const BARCODE_PA_RE = /^\d{11}[0-3]$/;
const maVachTheoPa = (barcode, pa) => (BARCODE_PA_RE.test(String(barcode || ''))
  ? String(barcode).slice(0, 11) + String(Number(pa)) : null);
const gomSetBadge = (h, soPhanIn) => (laGomSet(h)
  ? <Badge tone="warning">Gom set {h.inset}{soPhanIn > 1 ? ` · ${soPhanIn} phần in` : ''}</Badge>
  : <Badge tone="default">Không</Badge>);
// Hôm nay dạng 'YYYY-MM-DD' theo giờ LOCAL — KHÔNG dùng `toISOString()` thẳng vì nó quy về UTC,
// giờ VN (UTC+7) trước 07:00 sẽ ra NGÀY HÔM QUA.
const homNay = () => {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const fmtDateTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');
const paBadge = (v) => (v == null ? <span className="text-ink-soft">—</span>
  : <Badge tone={Number(v) === 0 ? 'default' : 'info'}>{PHUONG_AN_IN[Number(v)] || v}</Badge>);

// Danh sách phần in trong 1 HSKT.
function PhanInList({ rows }) {
  if (!rows || rows.length === 0) return <div className="py-6 text-center text-sm text-ink-soft">Không có phần in</div>;
  return (
    <div className="space-y-1.5">
      {rows.map((p) => (
        <div key={p.id} className="rounded-control border border-line px-3 py-2 text-sm">
          <div className="font-medium text-ink">{p.ma_phan} · {p.mau_vai || '—'}</div>
          <div className="truncate text-xs text-ink-soft">
            {p.ten_khach_hang || '—'} · {p.ma_hang} · Kích {p.kich_vai || '—'}/{p.kich_phim || '—'} · SLĐH {fmtNum(p.so_luong_don_hang)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HoSoKyThuatPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('READY_KHUON') || can('READY_FILM') || can('READY_MUC');

  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  // Vào trang mặc định lọc **NGÀY LÊN MES = HÔM NAY** (kỹ thuật chỉ quan tâm hồ sơ mới về trong ngày).
  // Bỏ lọc: bấm ô ngày → "Xóa", hoặc nút "Xóa lọc" trong panel Bộ lọc.
  const [filters, setFilters] = useState(() => ({ tuNgay: homNay(), denNgay: homNay() }));
  const [showFilter, setShowFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanVal, setScanVal] = useState('');

  const [detail, setDetail] = useState(null);      // { hskt, phan_in, lich_su }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [camOpen, setCamOpen] = useState(false);   // quét mã vạch HSKT bằng camera
  const [savingPa, setSavingPa] = useState(false);

  // Lọc + phân trang chạy Ở SERVER: trước đây tải `limit:100` không phân trang nên khi có nhiều HSKT
  // (thực tế >200) danh sách bị CẮT ÂM THẦM. Lọc client cũng sai vì chỉ lọc được trang đang xem.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listHskt({ search, page, limit: 20, ...filters });
      setRows(res.data.items);
      setMeta(res.data.meta || { page: 1, totalPages: 1, total: res.data.items.length });
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); } finally { setLoading(false); }
  }, [search, page, filters, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // Đổi ô lọc / ô tìm → về trang 1 (đang ở trang 5 mà lọc còn 2 trang thì sẽ ra bảng rỗng).
  const setField = (k, v) => { setFilters((s) => ({ ...s, [k]: v })); setPage(1); };
  // Khoảng ngày LÊN MES: 1 ô chọn cả từ→đến ⇒ set 2 khóa cùng lúc (server lọc `tuNgay`/`denNgay`).
  const setNgay = ({ from, to }) => {
    setFilters((s) => ({ ...s, tuNgay: from || '', denNgay: to || '' })); setPage(1);
  };
  const clearFilters = () => { setFilters({}); setPage(1); };
  // Bỏ `denNgay` khi đếm: khoảng ngày là MỘT bộ lọc, không phải hai.
  const filterCount = Object.entries(filters).filter(([k, v]) => v && k !== 'denNgay').length;
  const textFilters = Object.fromEntries(HSKT_TEXT_KEYS.map((k) => [k, filters[k] || '']));

  const openDetail = async (id) => {
    setLoadingDetail(true); setDetail({ hskt: { id } });
    try { const res = await getHskt(id); setDetail(res.data); }
    catch (e) { show(e.message || 'Lỗi tải chi tiết', 'error'); setDetail(null); }
    finally { setLoadingDetail(false); }
  };

  // Quét / nhập mã (đầu đọc USB, camera hoặc gõ tay) → MỞ THẲNG SidePanel của HSKT đó.
  // Camera trả kèm LOẠI MÃ: **QR = code phần** · **mã vạch = barcode HSKT (server so 11 SỐ ĐẦU** nên
  // phiếu giấy in mã CŨ — trước khi đổi phương án in — vẫn quét ra đúng hồ sơ). Gõ tay không rõ loại
  // → để server tự dò (barcode chính xác → 11 số đầu → code phần).
  const doScan = async (code, kieu) => {
    const bc = String(code || '').trim();
    if (!bc) return;
    setCamOpen(false);
    try {
      const res = await getHsktByBarcode(bc, kieu);
      setScanVal('');
      await openDetail(res.data.hskt.id);
    } catch (e) { show(e.message || 'Không tìm thấy HSKT', 'error'); }
  };

  // Deep-link từ nút Quét (bottom nav): ?bc=<barcode HSKT> → tự mở SidePanel HSKT đó.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const bc = searchParams.get('bc');
    if (bc) doScan(bc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Đổi phương án in KÉO THEO đổi số cuối mã vạch ⇒ phải hỏi xác nhận, vì phiếu giấy đã in mang mã
  // vạch CŨ sẽ không quét được nữa (chốt nghiệp vụ: chỉ khớp mã vạch mới).
  const [paConfirm, setPaConfirm] = useState(null); // { pa, maCu, maMoi }
  const onChangePa = (val) => {
    if (!detail?.hskt?.id) return;
    const pa = Number(val);
    if (!pa || pa === Number(detail.hskt.phuong_an_in)) return;
    setPaConfirm({ pa, maCu: detail.hskt.barcode_hskt || null, maMoi: maVachTheoPa(detail.hskt.barcode_hskt, pa) });
  };

  const doChangePa = async () => {
    const pa = paConfirm?.pa;
    if (!pa || !detail?.hskt?.id) return;
    setSavingPa(true);
    try {
      const res = await changePhuongAnIn(detail.hskt.id, pa);
      setDetail(res.data); load();
      const m = res.data?.barcode_moi;
      show(`Đã đổi phương án in (phiên bản mới)${m && m !== res.data?.barcode_cu ? ` · mã vạch → ${m}` : ''}`);
      setPaConfirm(null);
    } catch (e) { show(e.message || 'Đổi phương án in thất bại', 'error'); }
    finally { setSavingPa(false); }
  };

  return (
    <div>
      <Toolbar title="Hồ sơ kỹ thuật"
        subtitle="HSKT theo phần in (mới nhất). 1 HSKT có nhiều phần in (gom set); đổi phương án in tạo phiên bản mới, giữ lịch sử.">
        <div className="flex items-center gap-2">
          <Icon name="scan" size={16} className="text-ink-soft" />
          <Input value={scanVal} onChange={(e) => setScanVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doScan(scanVal); }}
            placeholder="Quét / nhập mã vạch HSKT hoặc code phần..." className="w-64" />
          <Button variant="secondary" icon="scan-line" onClick={() => setCamOpen(true)}>Quét camera</Button>
        </div>
      </Toolbar>

      {/* 1 HÀNG: tìm · khoảng ngày lên MES · 3 select (thu gọn) · bộ lọc chữ · tổng.
          ⚠⚠ BỀ RỘNG SELECT PHẢI ĐẶT Ở DIV BỌC NGOÀI, không truyền `w-36` vào `Select`:
          `inputClass` có sẵn **`w-full`** mà Tailwind sinh `.w-full` SAU `.w-36`/`.w-44` ⇒ class truyền
          thêm VÔ TÁC DỤNG, mỗi Select ăn 100% bề rộng và rớt xuống dòng riêng (đúng triệu chứng
          "3 ô lọc mỗi ô một dòng"). Cùng lý do: đừng chỉnh chiều cao bằng `h-10` (`.h-11` sinh sau). */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Tìm mã vạch HSKT / code phần..." className="max-w-xs" />
        {/* Ngày HSKT lên MES = ngày tạo PHIÊN BẢN ĐẦU (đổi phương án in không làm nhảy ngày). */}
        <DateRangePicker value={{ from: filters.tuNgay || '', to: filters.denNgay || '' }}
          onChange={setNgay} placeholder="Ngày lên MES" />
        {/* Select cho các trường có GIÁ TRỊ CỐ ĐỊNH — FieldFilters chỉ dựng ô nhập chữ. */}
        <div className="w-36 shrink-0">
          <Select value={filters.phuongAnIn || ''} onChange={(e) => setField('phuongAnIn', e.target.value)}>
            <option value="">PA in: tất cả</option>
            <option value="0">Chưa xác định</option>
            <option value="1">Bàn</option>
            <option value="2">Máy</option>
            <option value="3">Robot</option>
          </Select>
        </div>
        <div className="w-36 shrink-0">
          <Select value={filters.gomSet || ''} onChange={(e) => setField('gomSet', e.target.value)}>
            <option value="">Gom set: tất cả</option>
            <option value="co">Có gom set</option>
            <option value="khong">Không gom set</option>
          </Select>
        </div>
        <div className="w-36 shrink-0">
          <Select value={filters.suaTay || ''} onChange={(e) => setField('suaTay', e.target.value)}>
            <option value="">Sửa tay: tất cả</option>
            <option value="co">Đã sửa tay</option>
            <option value="khong">Chưa sửa tay</option>
          </Select>
        </div>
        <FilterToggle open={showFilter} count={filterCount} onClick={() => setShowFilter((v) => !v)} />
        <Badge tone="info">{meta.total} hồ sơ</Badge>
      </div>

      {/* Chỉ đưa ô CHỮ vào FieldFilters: 3 Select ở trên tự hiện nhãn, nếu để chung thì chip sẽ ra
          "Phương án in: 2" (giá trị thô) khó hiểu. Nút "Xóa lọc" vẫn xóa sạch cả 3 Select. */}
      <FieldFilters fields={HSKT_FILTER_FIELDS} values={textFilters} onField={setField}
        onClear={clearFilters} open={showFilter} />

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-16rem)]">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted text-left text-xs font-semibold uppercase text-ink-soft">
              <tr>
                <th className="px-3 py-2">STT</th>
                <th className="px-3 py-2">Mã vạch HSKT</th>
                <th className="px-3 py-2">Phương án in</th>
                <th className="px-3 py-2">Gom set</th>
                <th className="px-3 py-2 text-right">Số phần in</th>
                <th className="px-3 py-2">Code phần</th>
                <th className="px-3 py-2">Khách hàng</th>
                <th className="px-3 py-2">Đơn hàng</th>
                <th className="px-3 py-2">Mã hàng</th>
                <th className="px-3 py-2">Màu vải</th>
                <th className="px-3 py-2">Kích vải</th>
                <th className="px-3 py-2">Kích phim</th>
                <th className="px-3 py-2">Loại đợt vải</th>
                <th className="px-3 py-2">Ngày lên MES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLS} className="py-10 text-center text-ink-soft">Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLS} className="py-10 text-center text-ink-soft">
                  {filterCount || search ? 'Không có HSKT khớp bộ lọc' : 'Chưa có HSKT'}
                </td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} onClick={() => openDetail(r.id)}
                  className="cursor-pointer border-t border-line hover:bg-surface-muted/50">
                  <td className="px-3 py-2 text-ink-soft">{(meta.page - 1) * 20 + i + 1}</td>
                  <td className="px-3 py-2 font-medium text-ink">{r.barcode_hskt || '—'}</td>
                  <td className="px-3 py-2">{paBadge(r.phuong_an_in)}</td>
                  <td className="px-3 py-2">{gomSetBadge(r, r.so_phan_in)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.so_phan_in}</td>
                  {/* Có gom set → các code phần này in CHUNG 1 lần (cùng 1 HSKT). */}
                  <td className={`px-3 py-2 max-w-[18rem] truncate ${laGomSet(r) ? 'font-medium text-ink' : 'text-ink-soft'}`}>{r.code_phan_list || '—'}</td>
                  <td className="px-3 py-2 font-medium text-ink">{r.ten_khach_hang || '—'}</td>
                  <td className="px-3 py-2">{r.ma_don_hang || '—'}</td>
                  <td className="px-3 py-2">{r.ma_hang || '—'}</td>
                  <td className="px-3 py-2">{r.mau_vai || '—'}</td>
                  <td className="px-3 py-2">{r.kich_vai || '—'}</td>
                  <td className="px-3 py-2">{r.kich_phim || '—'}</td>
                  <td className="px-3 py-2"><LoaiDotVaiBadge value={r.loai_dot_vai} /></td>
                  {/* Ngày tạo PHIÊN BẢN ĐẦU — chính là khoảng ngày mà ô lọc phía trên đang dùng. */}
                  <td className="px-3 py-2 whitespace-nowrap text-ink-soft">{fmtDateTime(r.tg_len_mes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      {/* Chi tiết HSKT */}
      <SidePanel open={!!detail} onClose={() => setDetail(null)}
        title={detail?.hskt?.barcode_hskt ? `HSKT ${detail.hskt.barcode_hskt}` : 'Chi tiết HSKT'}
        subtitle={detail?.phan_in ? `${detail.phan_in.length} phần in · phiên bản ${detail.hskt.phien_ban}` : ''}
        width="max-w-2xl">
        {loadingDetail || !detail?.hskt?.id ? (
          <div className="py-10 text-center text-ink-soft">Đang tải...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-control border border-line p-3 text-sm">
              <div>
                <div className="text-xs text-ink-soft">Mã vạch HSKT</div>
                <div className="font-medium text-ink">{detail.hskt.barcode_hskt || '—'}</div>
                {/* Số cuối mã vạch = phương án in. Sau khi sửa tay, mã vạch LỆCH với mã ERP gửi sang
                    → hiện mã gốc để người dùng đối chiếu khi cần. */}
                {detail.hskt.barcode_hskt_goc && detail.hskt.barcode_hskt_goc !== detail.hskt.barcode_hskt && (
                  <div className="mt-0.5 text-xs text-ink-soft">Mã vạch gốc (ERP): {detail.hskt.barcode_hskt_goc}</div>
                )}
              </div>
              {/* ERP `Inset` ≠ 0 = có gom set; nhóm gom set = các phần in cùng HSKT này. */}
              <div><div className="text-xs text-ink-soft">Gom set</div><div className="mt-1">{gomSetBadge(detail.hskt, detail.phan_in?.length || 0)}</div></div>
              <div>
                <div className="text-xs text-ink-soft">Phương án in</div>
                <div className="mt-1 flex items-center gap-2">
                  {/* `?? ''` chứ KHÔNG `|| ''`: Pain = 0 (chưa xác định) là giá trị THẬT của ERP,
                      dùng `||` sẽ rơi về "— Chọn —" làm tưởng chưa có dữ liệu. Option 0 để `disabled`
                      vì không cho phép đặt ngược về "chưa xác định" (khớp `isValidPain` ở backend). */}
                  <Select value={detail.hskt.phuong_an_in ?? ''} disabled={!canManage || savingPa}
                    onChange={(e) => onChangePa(e.target.value)} className="w-40">
                    <option value="" disabled>— Chọn —</option>
                    <option value={0} disabled>Chưa xác định</option>
                    <option value={1}>Bàn</option>
                    <option value={2}>Máy</option>
                    <option value={3}>Robot</option>
                  </Select>
                  {savingPa && <span className="text-xs text-ink-soft">Đang lưu...</span>}
                  {detail.hskt.pa_in_sua_tay && <Badge tone="warning">Đã sửa tay</Badge>}
                </div>
                {detail.hskt.pa_in_sua_tay && (
                  <div className="mt-1 text-xs text-ink-soft">Đồng bộ ERP sẽ KHÔNG ghi đè phương án in này.</div>
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-ink">
                {laGomSet(detail.hskt) ? `Phần in GOM SET CHUNG (${detail.phan_in.length})` : `Phần in trong HSKT (${detail.phan_in.length})`}
              </h4>
              {laGomSet(detail.hskt) && (
                <div className="mb-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                  ERP báo <b>Inset = {detail.hskt.inset}</b> (có gom set) — {detail.phan_in.length} phần in dưới đây dùng CHUNG hồ sơ kỹ thuật này nên <b>in chung 1 lần</b>.
                  {detail.phan_in.length < 2 && ' Hiện mới nhận được 1 phần in — các phần in còn lại sẽ hiện ở đây khi ERP đồng bộ về cùng mã vạch HSKT.'}
                </div>
              )}
              <PhanInList rows={detail.phan_in} />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-ink">Lịch sử thao tác</h4>
              {(!detail.lich_su || detail.lich_su.length === 0) ? (
                <div className="text-sm text-ink-soft">Chưa có lịch sử</div>
              ) : (
                <div className="space-y-1.5">
                  {detail.lich_su.map((h, i) => (
                    <div key={i} className="rounded-control border border-line px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">{h.hanh_dong} <span className="text-ink-soft">v{h.phien_ban}</span></span>
                        <span className="text-ink-soft">{fmtDateTime(h.tg)}</span>
                      </div>
                      {h.chi_tiet && <div className="text-ink-soft">{h.chi_tiet}</div>}
                      <div className="text-ink-soft">{h.nguoi || '—'}{h.ma_phan ? ` · ${h.ma_phan}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SidePanel>

      {/* Camera: chế độ QR quét CODE PHẦN · chế độ Mã vạch quét BARCODE HSKT (so 11 số đầu) */}
      <QrScanner open={camOpen} onClose={() => setCamOpen(false)} onResult={doScan}
        title="Quét QR code phần / mã vạch HSKT" />

      {/* Xác nhận đổi phương án in — nêu RÕ mã vạch sẽ đổi + phiếu giấy cũ hết quét được. */}
      <ConfirmDialog
        open={!!paConfirm}
        onClose={() => setPaConfirm(null)}
        onConfirm={doChangePa}
        loading={savingPa}
        title="Đổi phương án in"
        confirmText="Đổi phương án in"
        message={!paConfirm ? '' : (
          <span className="block space-y-2">
            <span className="block">
              Đổi phương án in sang <b className="text-ink">{PHUONG_AN_IN[paConfirm.pa] || paConfirm.pa}</b> —
              tạo phiên bản mới, giữ lịch sử.
            </span>
            {paConfirm.maMoi ? (
              <span className="block">
                Số cuối mã vạch HSKT đổi theo: <b className="text-ink">{paConfirm.maCu}</b> → <b className="text-ink">{paConfirm.maMoi}</b>.
                <span className="block text-danger">Phiếu giấy đã in mã vạch cũ sẽ KHÔNG quét được nữa — cần in lại phiếu.</span>
              </span>
            ) : (
              <span className="block">Mã vạch HSKT giữ nguyên (không đúng định dạng 11 số + số cuối 0..3).</span>
            )}
            <span className="block">Sau khi sửa tay, đồng bộ ERP sẽ không ghi đè phương án in này nữa.</span>
          </span>
        )}
      />

      <Toast toast={toast} />
    </div>
  );
}
