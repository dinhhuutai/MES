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

export default function HienThiPainPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canEdit = can('WORKFLOW_MANAGE');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listHienThiPain();
      setRows(res.data.items || []);
      setDirty(false);
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); } finally { setLoading(false); }
  }, [show]);
  useEffect(() => { load(); }, [load]);

  // Gom theo MODULE, giữ đúng thứ tự backend trả về (thứ tự dòng chảy: Kế hoạch → … → Dashboard).
  const nhomTheoModule = useMemo(() => {
    const out = [];
    rows.forEach((r) => {
      let g = out.find((x) => x.module === r.module);
      if (!g) { g = { module: r.module, items: [] }; out.push(g); }
      g.items.push(r);
    });
    return out;
  }, [rows]);

  const setTrang = (ma, key, val) => {
    setRows((rs) => rs.map((r) => (r.ma === ma ? { ...r, [key]: val } : r)));
    setDirty(true);
  };
  // Toggle ở DÒNG MODULE → áp cho MỌI trang con của module đó (yêu cầu: "toggle con đi theo").
  const setModule = (module, key, val) => {
    setRows((rs) => rs.map((r) => (r.module === module ? { ...r, [key]: val } : r)));
    setDirty(true);
  };
  // Trạng thái toggle của module: bật khi MỌI trang con đang bật (tắt 1 cái là module tắt).
  const moduleOn = (g, key) => g.items.length > 0 && g.items.every((r) => r[key]);
  const moduleMixed = (g, key) => g.items.some((r) => r[key]) && !g.items.every((r) => r[key]);

  const doSave = async () => {
    setSaving(true);
    try {
      const res = await saveHienThiPain(rows.map((r) => ({
        ma_trang: r.ma, may: !!r.may, ban: !!r.ban, robot: !!r.robot, khac: !!r.khac,
      })));
      setRows(res.data.items || rows);
      setDirty(false);
      show('Đã lưu cấu hình hiển thị — áp dụng ngay cho mọi người');
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); } finally { setSaving(false); }
  };

  const tatCount = rows.reduce((s, r) => s + NHOM_PAIN.filter((n) => !r[n.key]).length, 0);

  return (
    <div>
      <Toolbar title="Hiển thị theo phương án in"
        subtitle="Mỗi trang có dòng chảy phần in là 1 dòng — bật/tắt từng nhóm phương án in. Tắt nhóm nào thì phần in nhóm đó KHÔNG hiện ở trang đó nữa.">
        {canEdit && (
          <Button onClick={doSave} loading={saving} disabled={!dirty} icon="check">Lưu cấu hình</Button>
        )}
      </Toolbar>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={tatCount ? 'warning' : 'success'}>
          {tatCount ? `Đang ẩn ${tatCount} nhóm/trang` : 'Đang hiện tất cả'}
        </Badge>
        <span className="text-ink-soft">
          <b>Khác</b> = phần in chưa xác định phương án in (Pain 0) hoặc chưa có hồ sơ kỹ thuật.
        </span>
      </div>

      {loading ? (
        <div className="card p-10 text-center"><Spinner size={22} className="mx-auto" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-15rem)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-muted text-left text-xs font-semibold uppercase text-ink-soft">
                <tr>
                  <th className="px-3 py-2">Trang</th>
                  {NHOM_PAIN.map((n) => <th key={n.key} className="px-3 py-2 text-center w-24">{n.label}</th>)}
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
                      {NHOM_PAIN.map((n) => (
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
                        {NHOM_PAIN.map((n) => (
                          <td key={n.key} className="px-3 py-2 text-center">
                            <Toggle on={!!r[n.key]} disabled={!canEdit}
                              onChange={(v) => setTrang(r.ma, n.key, v)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dirty && canEdit && (
        <p className="mt-2 text-xs text-amber-600">Có thay đổi chưa lưu — bấm <b>Lưu cấu hình</b> để áp dụng.</p>
      )}
      <Toast toast={toast} />
    </div>
  );
}
