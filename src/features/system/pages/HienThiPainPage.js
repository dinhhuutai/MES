import { Fragment, useEffect, useState, useMemo, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listHienThiPain, saveHienThiPain, NHOM_PAIN } from '../../../services/hienThiPainService';

// Công tắc gạt (không dùng thư viện) — đủ rõ ở cả 2 chế độ sáng/tối.
function Toggle({ on, onChange, disabled, title }) {
  return (
    <button type="button" title={title} disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
        ${on ? 'bg-primary' : 'bg-line'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <span className={`inline-block h-4.5 w-4.5 h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform
        ${on ? 'translate-x-[22px]' : 'translate-x-1'}`} />
    </button>
  );
}

// ⚠ Cấu hình LOẠI CHUYỀN lưu JSONB `{ma_loai: bool}` với luật **THIẾU KHÓA = BẬT** (thêm loại chuyền
// mới thì không tự dưng bị ẩn, khỏi migration/seed) ⇒ đọc phải qua helper này, đừng `!!r.loai_chuyen[k]`.
const lcOn = (r, key) => (r.loai_chuyen || {})[key] !== false;

export default function HienThiPainPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canEdit = can('WORKFLOW_MANAGE');

  const [rows, setRows] = useState([]);
  const [nhomLoai, setNhomLoai] = useState([]);   // danh mục loại chuyền (động, từ bảng `loai_chuyen`)
  const [che_do, setCheDo] = useState('pain');    // 'pain' = phương án in · 'loai' = loại chuyền
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listHienThiPain();
      setRows(res.data.items || []);
      setNhomLoai(res.data.nhom_loai_chuyen || []);
      setDirty(false);
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); } finally { setLoading(false); }
  }, [show]);
  useEffect(() => { load(); }, [load]);

  const theoLoai = che_do === 'loai';
  // Cột hiện tại theo chế độ đang xem — bảng dùng chung 1 khung, chỉ đổi bộ cột.
  const cols = theoLoai ? nhomLoai : NHOM_PAIN;

  // Gom theo MODULE, giữ đúng thứ tự backend trả về (thứ tự dòng chảy: Đơn hàng → … → Dashboard).
  // Chế độ LOẠI CHUYỀN: chỉ giữ trang áp được (mức lệnh/phiếu) — trang trước release chưa có chuyền.
  const nhomTheoModule = useMemo(() => {
    const out = [];
    rows.filter((r) => !theoLoai || r.co_loai_chuyen).forEach((r) => {
      let g = out.find((x) => x.module === r.module);
      if (!g) { g = { module: r.module, items: [] }; out.push(g); }
      g.items.push(r);
    });
    return out;
  }, [rows, theoLoai]);

  const soTrangBoQua = rows.length - rows.filter((r) => r.co_loai_chuyen).length;

  const getOn = (r, key) => (theoLoai ? lcOn(r, key) : !!r[key]);
  const setOn = (r, key, val) => (theoLoai
    ? { ...r, loai_chuyen: { ...(r.loai_chuyen || {}), [key]: val } }
    : { ...r, [key]: val });

  const setTrang = (ma, key, val) => {
    setRows((rs) => rs.map((r) => (r.ma === ma ? setOn(r, key, val) : r)));
    setDirty(true);
  };
  // Toggle ở DÒNG MODULE → áp cho MỌI trang con ĐANG HIỆN của module đó.
  // ⚠ Ở chế độ loại chuyền phải bỏ qua trang không áp dụng, nếu không sẽ ghi cấu hình rác cho
  // các trang trước release (chúng bị lọc khỏi bảng nên người dùng không hề thấy).
  const setModule = (module, key, val) => {
    setRows((rs) => rs.map((r) => (
      r.module === module && (!theoLoai || r.co_loai_chuyen) ? setOn(r, key, val) : r
    )));
    setDirty(true);
  };
  // Trạng thái toggle của module: bật khi MỌI trang con đang bật (tắt 1 cái là module tắt).
  const moduleOn = (g, key) => g.items.length > 0 && g.items.every((r) => getOn(r, key));
  const moduleMixed = (g, key) => g.items.some((r) => getOn(r, key)) && !g.items.every((r) => getOn(r, key));

  const doSave = async () => {
    setSaving(true);
    try {
      const res = await saveHienThiPain(rows.map((r) => ({
        ma_trang: r.ma, may: !!r.may, ban: !!r.ban, robot: !!r.robot, khac: !!r.khac,
        loai_chuyen: r.loai_chuyen || {},
      })));
      setRows(res.data.items || rows);
      setNhomLoai(res.data.nhom_loai_chuyen || nhomLoai);
      setDirty(false);
      show('Đã lưu cấu hình hiển thị — áp dụng ngay cho mọi người');
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); } finally { setSaving(false); }
  };

  // Đếm số nhóm ĐANG TẮT của cả 2 chiều (biết ngay hệ đang lọc hay đang hiện tất cả).
  const tatPain = rows.reduce((s, r) => s + NHOM_PAIN.filter((n) => !r[n.key]).length, 0);
  const tatLoai = rows.filter((r) => r.co_loai_chuyen)
    .reduce((s, r) => s + nhomLoai.filter((n) => !lcOn(r, n.key)).length, 0);
  const tatCount = theoLoai ? tatLoai : tatPain;

  return (
    <div>
      <Toolbar title="Hiển thị theo phương án in / loại chuyền"
        subtitle="Mỗi trang có dòng chảy phần in là 1 dòng — bật/tắt từng nhóm. Tắt nhóm nào thì hàng thuộc nhóm đó KHÔNG hiện ở trang đó nữa. Hai chiều lọc độc lập và kết hợp AND.">
        {canEdit && (
          <Button onClick={doSave} loading={saving} disabled={!dirty} icon="check">Lưu cấu hình</Button>
        )}
      </Toolbar>

      {/* Nút chuyển đổi 2 chiều cấu hình — cùng 1 bảng, chỉ đổi bộ cột. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-control border border-line p-0.5">
          {[{ v: 'pain', label: 'Theo phương án in' }, { v: 'loai', label: 'Theo loại chuyền' }].map((o) => (
            <button key={o.v} type="button" onClick={() => setCheDo(o.v)}
              className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors ${
                che_do === o.v ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
        <Badge tone={tatCount ? 'warning' : 'success'}>
          {tatCount ? `Đang ẩn ${tatCount} nhóm/trang` : 'Đang hiện tất cả'}
        </Badge>
        {/* Chiều còn lại vẫn đang lọc thì phải nói ra — nếu không sẽ tưởng "hiện tất cả" mà hàng vẫn bị ẩn. */}
        {(theoLoai ? tatPain : tatLoai) > 0 && (
          <Badge tone="info">
            {theoLoai ? `Phương án in đang ẩn ${tatPain} nhóm` : `Loại chuyền đang ẩn ${tatLoai} nhóm`}
          </Badge>
        )}
        <span className="text-sm text-ink-soft">
          {theoLoai
            ? <><b>Khác</b> = lệnh chưa gán chuyền / chuyền không có loại.</>
            : <><b>Khác</b> = phần in chưa xác định phương án in (Pain 0) hoặc chưa có hồ sơ kỹ thuật.</>}
        </span>
      </div>

      {theoLoai && soTrangBoQua > 0 && (
        <p className="mb-3 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30">
          Loại chuyền là thuộc tính của <b>đợt sản xuất</b> (lệnh → chuyền) nên chỉ áp được cho các trang
          <b> từ Release 2 trở đi</b>. {soTrangBoQua} trang trước release (READY, Gom set, Release 1,
          Kế hoạch tạm, Đơn hàng, Dashboard) chưa có chuyền nên không hiện ở đây.
        </p>
      )}

      {loading ? (
        <div className="card p-10 text-center"><Spinner size={22} className="mx-auto" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-17rem)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-muted text-left text-xs font-semibold uppercase text-ink-soft">
                <tr>
                  <th className="px-3 py-2">Trang</th>
                  {cols.map((n) => <th key={n.key} className="w-24 px-3 py-2 text-center">{n.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {nhomTheoModule.map((g) => (
                  <Fragment key={g.module}>
                    {/* DÒNG MODULE — gạt ở đây thì mọi trang con đi theo. */}
                    <tr className="border-t border-line bg-surface-muted/60">
                      <td className="px-3 py-2 font-semibold text-ink">
                        {g.module} <span className="text-xs font-normal text-ink-soft">({g.items.length} trang)</span>
                      </td>
                      {cols.map((n) => (
                        <td key={n.key} className="px-3 py-2 text-center">
                          <Toggle on={moduleOn(g, n.key)} disabled={!canEdit}
                            title={moduleMixed(g, n.key) ? 'Đang bật một phần — gạt để bật/tắt cả module' : ''}
                            onChange={(v) => setModule(g.module, n.key, v)} />
                          {moduleMixed(g, n.key) && <div className="text-[10px] text-amber-600">một phần</div>}
                        </td>
                      ))}
                    </tr>
                    {g.items.map((r) => (
                      <tr key={r.ma} className="border-t border-line/70 hover:bg-surface-muted/40">
                        <td className="px-3 py-2 pl-8 text-ink">{r.ten}</td>
                        {cols.map((n) => (
                          <td key={n.key} className="px-3 py-2 text-center">
                            <Toggle on={getOn(r, n.key)} disabled={!canEdit}
                              onChange={(v) => setTrang(r.ma, n.key, v)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {nhomTheoModule.length === 0 && (
                  <tr><td colSpan={cols.length + 1} className="px-3 py-8 text-center text-ink-soft">
                    Không có trang nào áp dụng.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dirty && canEdit && (
        <p className="mt-2 text-xs text-amber-600">
          Có thay đổi chưa lưu — bấm <b>Lưu cấu hình</b> để áp dụng (lưu 1 lần cho cả 2 chiều).
        </p>
      )}
      <Toast toast={toast} />
    </div>
  );
}
