import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import SidePanel from '../../../components/common/SidePanel';
import Pagination from '../../../components/common/Pagination';
import DateRangePicker from '../../../components/common/DateRangePicker';
import ChipTabs from '../../../components/common/ChipTabs';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import { avatarFor } from '../../../utils/brand';
import { layThongBao, danhDauDoc, layCaiDatCuaToi } from '../../../services/thongBaoService';
import {
  duongDanThongBao, nhanThoiGian, luongThongBao, laThongBaoDuyet, doiPhuongAnIn, tieuDeThongBao,
} from '../../../utils/thongBaoHienThi';

// ─────────────────────────────────────────────────────────────────────────────
// TRANG THÔNG BÁO (mig 085) — bản đầy đủ của cái chuông.
// Hiện CHI TIẾT phần in + THÔNG TIN ĐẦY ĐỦ người trả về; bấm dòng → panel chi tiết, trong panel
// bấm tiếp để sang màn READY Kỹ thuật có sẵn code phần trong ô tìm.
//
// ⚠ Trang này KHÔNG khai `perm` ở menu: người không thuộc diện nhận sẽ thấy danh sách rỗng
//   (backend trả `co_quyen=false` + items rỗng) — giống hệt cách cái chuông tự ẩn.
// ─────────────────────────────────────────────────────────────────────────────

const LIMIT = 20;

const Dong = ({ nhan, giaTri }) => (
  <div className="flex gap-2 py-1 text-sm">
    <span className="w-36 shrink-0 text-ink-soft">{nhan}</span>
    <span className="min-w-0 flex-1 break-words font-medium text-ink">{giaTri || '—'}</span>
  </div>
);

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [tong, setTong] = useState(0);
  const [chuaDoc, setChuaDoc] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chiChuaDoc, setChiChuaDoc] = useState(false);
  const [ngay, setNgay] = useState({});      // { from, to } — ngày TRẢ VỀ
  const [loai, setLoai] = useState('');      // chip theo luồng trả về
  const [tabs, setTabs] = useState([]);
  const [demChip, setDemChip] = useState({});
  const [xem, setXem] = useState(null);

  // Chip lấy từ chính danh mục backend ⇒ thêm loại thông báo mới KHÔNG phải sửa trang này.
  // ⚠⚠ `ChipTabs` đọc **`t.label`**, KHÔNG phải `t.ten` — truyền sai khóa thì chip ra RỖNG, chỉ còn
  //   mỗi số trong ngoặc (lỗi thật, người dùng bắt được 18/08/2026).
  useEffect(() => {
    layCaiDatCuaToi()
      .then((r) => setTabs([{ v: '', label: 'Tất cả' },
        ...(r.data.loai || []).map((l) => ({ v: l.ma_loai, label: l.ten }))]))
      .catch(() => setTabs([]));
  }, []);

  const tai = useCallback(async (ngam = false) => {
    if (!ngam) setLoading(true);
    try {
      const r = await layThongBao({
        page, limit: LIMIT, timKiem: search, chuaDoc: chiChuaDoc,
        tuNgay: ngay.from || '', denNgay: ngay.to || '', maLoai: loai,
      });
      setRows(r.data.items || []);
      setTong(r.data.meta?.total || 0);
      setChuaDoc(r.data.so_chua_doc || 0);
      // ⚠ `ChipTabs` LUÔN in `({n})` — không truyền `counts` thì mọi chip hiện "(0)", trông như hỏng.
      setDemChip(r.data.dem_chip || {});
    } catch (e) {
      if (!ngam) show(e.message || 'Không tải được thông báo', 'error');
    } finally { if (!ngam) setLoading(false); }
  }, [page, search, chiChuaDoc, ngay.from, ngay.to, loai, show]);

  useEffect(() => { tai(); }, [tai]);
  // ⚠ Đổi bộ lọc phải về trang 1: đang ở trang 5 mà lọc còn 2 trang thì bảng rỗng trong khi
  //   tổng vẫn báo có dòng — người dùng tưởng mất dữ liệu.
  useEffect(() => { setPage(1); }, [search, chiChuaDoc, ngay.from, ngay.to, loai]);
  useSocketReload(['thong-bao:moi', 'thong-bao:cai-dat'], () => tai(true), 800);

  // Mở panel = coi như đã đọc (đúng kiểu Zalo: xem là hết chấm đỏ).
  const moXem = async (t) => {
    setXem(t);
    if (t.da_doc) return;
    try {
      const r = await danhDauDoc([t.id]);
      setChuaDoc(r.data.so_chua_doc || 0);
      setRows((ds) => ds.map((x) => (x.id === t.id ? { ...x, da_doc: true } : x)));
    } catch (e) { /* im lặng — không chặn việc xem */ }
  };

  const docHet = async () => {
    try {
      const r = await danhDauDoc([]);
      setChuaDoc(r.data.so_chua_doc || 0);
      setRows((ds) => ds.map((x) => ({ ...x, da_doc: true })));
      show('Đã đánh dấu đã đọc tất cả');
    } catch (e) { show(e.message || 'Thất bại', 'error'); }
  };

  const columns = [
    { key: 'tg', header: 'Thời gian', className: 'whitespace-nowrap', render: (r) => (
      <div className="leading-tight">
        <div className={`text-sm ${r.da_doc ? 'text-ink' : 'font-semibold text-ink'}`}>{nhanThoiGian(r.tg)}</div>
        <div className="text-[11px] text-ink-soft">
          {new Date(r.tg).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    ) },
    { key: 'trang_thai', header: '', className: 'w-6', render: (r) => (
      !r.da_doc ? <span className="block h-2 w-2 rounded-full bg-danger" title="Chưa đọc" /> : null
    ) },
    // Nói RÕ luồng: "Release 1 → trả về READY Kỹ thuật" (yêu cầu 18/08/2026), không chỉ tên trạm nguồn.
    // ⚠ 2 HỌ thông báo dùng CHUNG bảng này: 'trả về' (mig 085) và 'duyệt phương án in' (mig 086)
    //   ⇒ nhãn cột phải trung tính, và họ duyệt hiện thêm "Bàn → Máy" mới biết đổi sang cái gì.
    { key: 'nhan_luong', header: 'Nội dung', className: 'whitespace-nowrap',
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone={laThongBaoDuyet(r) ? 'info' : 'warning'}>{luongThongBao(r)}</Badge>
          {doiPhuongAnIn(r) && <span className="text-xs font-medium text-primary">{doiPhuongAnIn(r)}</span>}
        </div>
      ) },
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => r.ma_phan },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'checklist_list', header: 'Mục bị rớt', render: (r) => r.checklist_list || '—' },
    { key: 'ly_do', header: 'Lý do', className: 'max-w-[22rem]', render: (r) => (
      <span className="block whitespace-normal break-words text-ink">{r.ly_do}</span>
    ) },
    { key: 'nguoi', header: 'Người trả về', render: (r) => (
      <div className="flex items-center gap-2">
        <img src={avatarFor({ avatarUrl: r.nguoi_avatar, gioiTinh: null })} alt=""
          className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-line" />
        <div className="leading-tight">
          <div className="text-ink">{r.nguoi_ho_ten || '—'}</div>
          <div className="text-[11px] text-ink-soft">{r.nguoi_chuc_vu || r.nguoi_phong_ban || `@${r.nguoi_username || ''}`}</div>
        </div>
      </div>
    ) },
    { key: 'da_xu_ly', header: 'Tình trạng', render: (r) => (r.da_xu_ly
      ? <Badge tone="success">Đã làm lại</Badge>
      : <Badge tone="danger">Chờ kỹ thuật</Badge>) },
  ];

  return (
    <div>
      <Toolbar title="Thông báo" subtitle="Phần in bị trả về cho Kỹ thuật · Yêu cầu đổi phương án in"
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm code phần, khách, đơn, mã hàng, màu, lý do, người gửi...">
        {/* Lọc theo NGÀY TRẢ VỀ — 1 ô chọn cả từ→đến, cùng component với các màn khác. */}
        <DateRangePicker value={ngay} onChange={setNgay} placeholder="Ngày trả về" />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-soft">
          <input type="checkbox" checked={chiChuaDoc} onChange={(e) => setChiChuaDoc(e.target.checked)} />
          Chỉ chưa đọc
        </label>
        {chuaDoc > 0 && (
          <Button variant="secondary" icon="check-circle" onClick={docHet}>
            Đánh dấu đã đọc hết ({chuaDoc})
          </Button>
        )}
        <Badge tone={chuaDoc ? 'danger' : 'info'}>{chuaDoc ? `${chuaDoc} chưa đọc / ` : ''}{tong} thông báo</Badge>
      </Toolbar>

      {tabs.length > 1 && <ChipTabs tabs={tabs} value={loai} counts={demChip} onChange={setLoai} />}

      <DataTable columns={columns} rows={rows} loading={loading} sttStart={(page - 1) * LIMIT}
        onRowClick={moXem} pageSize={0}
        rowClassName={(r) => (r.da_doc ? '' : 'bg-primary/[0.04]')}
        emptyText={chiChuaDoc ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo nào'} />

      {/* ⚠ `Pagination` nhận `totalPages` + `onPage` (KHÔNG phải pageSize/onChange) — xem component. */}
      <div className="mt-3">
        <Pagination page={page} total={tong} totalPages={Math.ceil(tong / LIMIT)} onPage={setPage} />
      </div>

      <SidePanel open={!!xem} onClose={() => setXem(null)} width="max-w-xl"
        title={xem ? `${tieuDeThongBao(xem)} — ${xem.ma_phan}` : ''}
        footer={xem && (
          <Button icon="arrow-right" onClick={() => navigate(duongDanThongBao(xem))}>
            {laThongBaoDuyet(xem) ? 'Mở danh sách phần in vải về' : 'Mở màn READY Kỹ thuật'}
          </Button>
        )}>
        {xem && (
          <div className="space-y-5">
            <div className="rounded-control border border-warning/40 bg-warning/5 p-3">
              <div className="flex items-center gap-2">
                <Icon name="alert-triangle" size={16} className="text-warning" />
                <span className="text-sm font-semibold text-ink">{luongThongBao(xem)}</span>
                <span className="ml-auto text-xs text-ink-soft">{nhanThoiGian(xem.tg)}</span>
              </div>
              {xem.checklist_list && (
                <div className="mt-2 text-sm"><span className="text-ink-soft">Mục bị rớt: </span>
                  <span className="font-medium text-ink">{xem.checklist_list}</span></div>
              )}
              <div className="mt-1 whitespace-pre-wrap text-sm text-ink">{xem.ly_do}</div>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-soft">Phần in</h3>
              <Dong nhan="Code phần" giaTri={xem.ma_phan} />
              <Dong nhan="Khách hàng" giaTri={xem.ten_khach_hang} />
              <Dong nhan="Đơn hàng" giaTri={xem.ma_don_hang} />
              <Dong nhan="Mã hàng" giaTri={xem.ma_hang} />
              <Dong nhan="Màu vải" giaTri={xem.mau_vai} />
              <Dong nhan="Kích vải" giaTri={xem.kich_vai} />
              <Dong nhan="Kích phim" giaTri={xem.kich_phim} />
              <Dong nhan="Tính chất in" giaTri={xem.tinh_chat_in} />
              <Dong nhan="SL đơn hàng" giaTri={xem.so_luong_don_hang} />
            </div>

            {/* "thông tin đầy đủ của người trả về" — yêu cầu 18/08/2026. */}
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Người trả về</h3>
              <div className="flex items-center gap-3 rounded-control border border-line p-3">
                <img src={avatarFor({ avatarUrl: xem.nguoi_avatar, gioiTinh: null })} alt=""
                  className="h-12 w-12 rounded-full object-cover ring-1 ring-line" />
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{xem.nguoi_ho_ten || 'Không rõ'}</div>
                  <div className="text-xs text-ink-soft">@{xem.nguoi_username || '—'}</div>
                </div>
              </div>
              <div className="mt-2">
                <Dong nhan="Chức vụ" giaTri={xem.nguoi_chuc_vu} />
                <Dong nhan="Phòng ban" giaTri={xem.nguoi_phong_ban} />
                <Dong nhan="Email" giaTri={xem.nguoi_email} />
                <Dong nhan="Điện thoại" giaTri={xem.nguoi_sdt} />
                <Dong nhan="Thời điểm trả về" giaTri={new Date(xem.tg).toLocaleString('vi-VN')} />
                <Dong nhan="Tình trạng" giaTri={xem.da_xu_ly ? 'Đã làm lại xong' : 'Đang chờ kỹ thuật làm lại'} />
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      <Toast toast={toast} />
    </div>
  );
}
