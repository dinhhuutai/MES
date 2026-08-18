import { useCallback, useEffect, useMemo, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import ChipTabs from '../../../components/common/ChipTabs';
import SidePanel from '../../../components/common/SidePanel';
import Icon from '../../../components/common/Icon';
import { Field, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import { fmtDateTime } from '../../../utils/format';
import {
  layHangDoiDuyet, duyetYeuCau, tuChoiYeuCau, huyYeuCau,
} from '../../../services/duyetService';

// ─────────────────────────────────────────────────────────────────────────────
// HÀNG ĐỢI DUYỆT (mig 086) — trang DÙNG CHUNG cho mọi loại yêu cầu cần duyệt.
// Loại đầu tiên: ĐỔI PHƯƠNG ÁN IN. Thêm loại mới chỉ cần khai ở `backend/utils/duyet.js`
// (`LOAI_DUYET`) — trang này tự hiện chip + cột, KHÔNG phải sửa gì ở đây.
//
// ⚠ Người chỉ GỬI được (không có quyền duyệt) vẫn vào được trang và thấy yêu cầu CỦA CHÍNH MÌNH —
//   backend lo phần lọc, FE chỉ hiện banner giải thích để họ không tưởng là mất dữ liệu.
// ─────────────────────────────────────────────────────────────────────────────

const TONE_TT = { CHO: 'warning', DUYET: 'success', TU_CHOI: 'danger', HUY: 'default' };

export default function DuyetPage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [dm, setDm] = useState({ loai: [], trang_thai: [] });
  const [coQuyen, setCoQuyen] = useState(true);
  const [chiCuaToi, setChiCuaToi] = useState(false);
  const [demCho, setDemCho] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [tim, setTim] = useState('');
  const [tt, setTt] = useState('CHO'); // mặc định: việc CẦN LÀM
  const [loai, setLoai] = useState('');
  const [sel, setSel] = useState(null);      // dòng đang xem chi tiết
  const [tuChoi, setTuChoi] = useState(null); // { row } — modal nhập lý do từ chối
  const [lyDo, setLyDo] = useState('');
  const [saving, setSaving] = useState(false);

  const tai = useCallback(async (ngam = false) => {
    if (!ngam) setLoading(true);
    try {
      const r = await layHangDoiDuyet({
        timKiem: tim || undefined, trangThai: tt || undefined, loai: loai || undefined,
        page, limit: 20,
      });
      const d = r.data || {};
      setRows(d.items || []);
      setMeta(d.meta || { total: 0, page: 1, limit: 20 });
      setCoQuyen(d.co_quyen !== false);
      setChiCuaToi(!!d.chi_cua_toi);
      setDemCho(d.dem_cho || {});
      if (d.loai) setDm({ loai: d.loai, trang_thai: d.trang_thai || [] });
    } catch (e) {
      if (!ngam) show(e.message || 'Không tải được hàng đợi duyệt', 'error');
    } finally { if (!ngam) setLoading(false); }
  }, [tim, tt, loai, page, show]);

  useEffect(() => { const t = setTimeout(tai, 250); return () => clearTimeout(t); }, [tai]);
  // Người khác duyệt/gửi → tự cập nhật (tải NGẦM, không nháy bảng).
  useSocketReload(['duyet:updated'], () => tai(true));

  const doDuyet = async (r) => {
    setSaving(true);
    try {
      await duyetYeuCau(r.id);
      show(`Đã duyệt và áp dụng — ${r.mo_ta || ''}`);
      setSel(null); tai();
    } catch (e) { show(e.message || 'Duyệt thất bại', 'error'); } finally { setSaving(false); }
  };

  const doTuChoi = async () => {
    if (!lyDo.trim()) { show('Nhập lý do từ chối', 'error'); return; }
    setSaving(true);
    try {
      await tuChoiYeuCau(tuChoi.id, lyDo.trim());
      show('Đã từ chối yêu cầu');
      setTuChoi(null); setLyDo(''); setSel(null); tai();
    } catch (e) { show(e.message || 'Từ chối thất bại', 'error'); } finally { setSaving(false); }
  };

  const doHuy = async (r) => {
    setSaving(true);
    try {
      await huyYeuCau(r.id);
      show('Đã hủy yêu cầu');
      setSel(null); tai();
    } catch (e) { show(e.message || 'Hủy thất bại', 'error'); } finally { setSaving(false); }
  };

  // Chip TRẠNG THÁI (+ số đang chờ). ⚠ `ChipTabs` đọc `label` và LUÔN in `(n)` ⇒ phải truyền
  //   cả `label` lẫn `counts`, thiếu là chip ra rỗng / hiện "(0)" hàng loạt (bẫy đã ghi ở §8).
  const chipTt = useMemo(() => ([
    { v: 'CHO', label: 'Chờ duyệt' },
    { v: 'DUYET', label: 'Đã duyệt' },
    { v: 'TU_CHOI', label: 'Bị từ chối' },
    { v: '', label: 'Tất cả' },
  ]), []);
  const tongCho = Object.values(demCho).reduce((a, b) => a + b, 0);
  const countTt = useMemo(() => ({ CHO: tongCho }), [tongCho]);

  const columns = [
    {
      key: 'ten_loai',
      header: 'Loại yêu cầu',
      render: (r) => <Badge tone="info">{r.ten_loai || r.loai}</Badge>,
    },
    { key: 'mo_ta', header: 'Đối tượng', className: 'font-medium text-ink', render: (r) => r.mo_ta || '—' },
    {
      key: 'gia_tri',
      header: 'Đổi',
      render: (r) => (
        <span className="whitespace-nowrap">
          <span className="text-ink-soft">{r.nhan_gia_tri_cu || '—'}</span>
          <Icon name="arrow-right" size={12} className="mx-1 inline text-ink-soft" />
          <b className="text-primary">{r.nhan_gia_tri_moi || '—'}</b>
        </span>
      ),
    },
    { key: 'ly_do', header: 'Lý do', render: (r) => r.ly_do || '—' },
    {
      key: 'ten_nguoi_gui',
      header: 'Người gửi',
      render: (r) => (
        <div className="leading-tight">
          <div>{r.ten_nguoi_gui || '—'}</div>
          <div className="text-xs text-ink-soft">{fmtDateTime(r.tg_gui)}</div>
        </div>
      ),
    },
    {
      key: 'trang_thai',
      header: 'Trạng thái',
      render: (r) => (
        <div className="leading-tight">
          <Badge tone={TONE_TT[r.trang_thai] || 'default'}>
            {(dm.trang_thai.find((x) => x.ma === r.trang_thai) || {}).ten || r.trang_thai}
          </Badge>
          {r.ten_nguoi_duyet && (
            <div className="mt-0.5 text-xs text-ink-soft">{r.ten_nguoi_duyet}</div>
          )}
        </div>
      ),
    },
    {
      key: '_tt',
      header: '',
      render: (r) => (
        <div className="flex flex-col gap-1">
          {r.duyet_duoc && (
            <>
              <Button onClick={(e) => { e.stopPropagation(); doDuyet(r); }} disabled={saving}>Duyệt</Button>
              <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setTuChoi(r); setLyDo(''); }}
                disabled={saving}>Từ chối</Button>
            </>
          )}
          {!r.duyet_duoc && r.huy_duoc && (
            <Button variant="ghost" onClick={(e) => { e.stopPropagation(); doHuy(r); }} disabled={saving}>
              Hủy yêu cầu
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Toolbar title="Duyệt yêu cầu" subtitle="Hàng đợi các thay đổi cần người duyệt thông qua"
        search={tim} onSearch={(v) => { setTim(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, mã vạch HSKT, lý do, người gửi...">
        {dm.loai.length > 1 && (
          <select value={loai} onChange={(e) => { setLoai(e.target.value); setPage(1); }}
            className="h-9 rounded-control border border-line bg-surface px-2 text-base md:text-sm">
            <option value="">Mọi loại yêu cầu</option>
            {dm.loai.map((l) => <option key={l.ma} value={l.ma}>{l.ten}</option>)}
          </select>
        )}
        <Badge tone={tongCho ? 'warning' : 'default'}>{tongCho} chờ duyệt</Badge>
      </Toolbar>

      {!coQuyen && (
        <div className="mb-4 rounded-card border border-line bg-surface p-4 text-sm text-ink-soft">
          Bạn không thuộc diện gửi hoặc duyệt yêu cầu nào nên hàng đợi trống.
        </div>
      )}
      {coQuyen && chiCuaToi && (
        <div className="mb-4 rounded-card border border-line bg-primary/5 p-3 text-sm text-ink-soft">
          Bạn <b className="text-ink">chưa có quyền duyệt</b> nên chỉ thấy yêu cầu do chính bạn gửi.
          Cần quyền <b className="text-ink">Duyệt đổi phương án in</b> để duyệt cho người khác.
        </div>
      )}

      <ChipTabs tabs={chipTt} value={tt} onChange={(v) => { setTt(v); setPage(1); }} counts={countTt} />

      <DataTable columns={columns} rows={rows} loading={loading} pageSize={0}
        onRowClick={(r) => setSel(r)}
        rowClassName={(r) => (r.trang_thai === 'CHO' ? 'bg-amber-50/60 dark:bg-amber-950/20' : '')}
        emptyText={tt === 'CHO' ? 'Không có yêu cầu nào đang chờ duyệt 🎉' : 'Không có yêu cầu nào'} />
      <Pagination page={meta.page} totalPages={Math.ceil((meta.total || 0) / (meta.limit || 20))}
        total={meta.total} onPage={setPage} />

      {/* Chi tiết 1 yêu cầu */}
      {sel && (
        <SidePanel open onClose={() => setSel(null)} title={sel.ten_loai || 'Yêu cầu duyệt'}>
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Đối tượng</div>
              <div className="text-ink">{sel.mo_ta || '—'}</div>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <div className="text-xs text-ink-soft">Hiện tại</div>
                <div className="font-medium text-ink">{sel.nhan_gia_tri_cu || '—'}</div>
              </div>
              <Icon name="arrow-right" size={16} className="text-ink-soft" />
              <div>
                <div className="text-xs text-ink-soft">Đổi thành</div>
                <div className="font-semibold text-primary">{sel.nhan_gia_tri_moi || '—'}</div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Lý do</div>
              <div className="whitespace-pre-wrap text-ink">{sel.ly_do || '—'}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-ink-soft">Người gửi</div>
                <div className="text-ink">{sel.ten_nguoi_gui || '—'}</div>
                <div className="text-xs text-ink-soft">{fmtDateTime(sel.tg_gui)}</div>
              </div>
              {sel.ten_nguoi_duyet && (
                <div>
                  <div className="text-xs text-ink-soft">Người duyệt</div>
                  <div className="text-ink">{sel.ten_nguoi_duyet}</div>
                  <div className="text-xs text-ink-soft">{fmtDateTime(sel.tg_duyet)}</div>
                </div>
              )}
            </div>
            {sel.ghi_chu_duyet && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Ghi chú của người duyệt</div>
                <div className="whitespace-pre-wrap text-ink">{sel.ghi_chu_duyet}</div>
              </div>
            )}
            {sel.trang_thai === 'CHO' && sel.duyet_duoc && (
              <div className="rounded-card border border-line bg-surface-muted p-3 text-xs text-ink-soft">
                Duyệt xong hệ thống sẽ <b className="text-ink">áp dụng ngay</b>: tạo phiên bản hồ sơ
                kỹ thuật mới, đổi số cuối mã vạch HSKT và khóa không cho job ERP ghi đè.
                Hồ sơ dùng chung nhiều phần in thì <b className="text-ink">đổi cho cả nhóm</b>.
              </div>
            )}
            <div className="flex gap-2 pt-2">
              {sel.duyet_duoc && (
                <>
                  <Button onClick={() => doDuyet(sel)} loading={saving}>Duyệt & áp dụng</Button>
                  <Button variant="secondary" onClick={() => { setTuChoi(sel); setLyDo(''); }}>Từ chối</Button>
                </>
              )}
              {!sel.duyet_duoc && sel.huy_duoc && (
                <Button variant="ghost" onClick={() => doHuy(sel)} loading={saving}>Hủy yêu cầu</Button>
              )}
            </div>
          </div>
        </SidePanel>
      )}

      {/* Từ chối — LÝ DO BẮT BUỘC (người gửi phải biết vì sao bị bác mới sửa cho đúng được). */}
      <Modal open={!!tuChoi} onClose={() => setTuChoi(null)} size="md" title="Từ chối yêu cầu">
        <div className="space-y-3">
          <div className="text-sm text-ink-soft">{tuChoi?.mo_ta}</div>
          <Field label="Lý do từ chối" required>
            <Textarea value={lyDo} onChange={(e) => setLyDo(e.target.value)} rows={3}
              placeholder="Vì sao không đồng ý đổi phương án in..." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTuChoi(null)}>Đóng</Button>
            <Button variant="danger" onClick={doTuChoi} loading={saving}>Từ chối</Button>
          </div>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
