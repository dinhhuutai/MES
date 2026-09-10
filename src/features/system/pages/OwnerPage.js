import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Select } from '../../../components/common/controls';
import SearchableSelect from '../../../components/common/SearchableSelect';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useVersions from '../../../hooks/useVersions';
import {
  tramOptions, listCheckpoints,
  listTramOwners, addTramOwner, removeTramOwner,
  listCheckpointOwners, addCheckpointOwner, removeCheckpointOwner,
} from '../../../services/wfconfigService';
import { listPhongBan, listRoleOptions } from '../../../services/systemService';
import { listUsers } from '../../../services/userService';
import { getFlowOwners } from '../../../services/dashboardService';
import { getKpiCot } from '../../../services/kpiReadyService';

const LOAI_LABEL = { CHIU_TRACH_NHIEM: 'Chịu trách nhiệm', XU_LY: 'Xử lý' };

function OwnerRow({ o, canManage, onRemove }) {
  return (
    <div className="flex items-center justify-between rounded-control border border-line px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={o.loai === 'CHIU_TRACH_NHIEM' ? 'warning' : 'info'}>{LOAI_LABEL[o.loai] || 'Xử lý'}</Badge>
        {o.ho_ten && <Badge tone="default">{o.ho_ten}</Badge>}
        {o.ten_role && <Badge tone="default">Role: {o.ten_role}</Badge>}
        {o.ten_phong_ban && <Badge tone="default">PB: {o.ten_phong_ban}</Badge>}
        {o.bat_buoc && <Badge tone="danger">Bắt buộc</Badge>}
      </div>
      {canManage && <button onClick={() => onRemove(o)} className="text-xs font-medium text-danger hover:underline">Xóa</button>}
    </div>
  );
}

function OwnerList({ title, owners, onAdd, onRemove, canManage }) {
  const tn = owners.filter((o) => o.loai === 'CHIU_TRACH_NHIEM');
  const xl = owners.filter((o) => o.loai !== 'CHIU_TRACH_NHIEM');
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {canManage && onAdd && <Button className="px-3 py-1.5" onClick={onAdd}>+ Thêm owner</Button>}
      </div>
      {owners.length === 0 && <p className="text-sm text-ink-soft">Chưa gán owner.</p>}
      {tn.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-ink-soft">Chịu trách nhiệm</div>
          <div className="space-y-2">{tn.map((o) => <OwnerRow key={o.id} o={o} canManage={canManage} onRemove={onRemove} />)}</div>
        </div>
      )}
      {xl.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-ink-soft">Xử lý</div>
          <div className="space-y-2">{xl.map((o) => <OwnerRow key={o.id} o={o} canManage={canManage} onRemove={onRemove} />)}</div>
        </div>
      )}
    </div>
  );
}

export default function OwnerPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canManage = can('WORKFLOW_MANAGE');
  const { versions, versionId, setVersionId } = useVersions();

  const [trams, setTrams] = useState([]);
  const [tramId, setTramId] = useState('');
  const [checkpoints, setCheckpoints] = useState([]);
  const [checkpointId, setCheckpointId] = useState('');
  const [tramOwners, setTramOwners] = useState([]);
  const [cpOwners, setCpOwners] = useState([]);

  const [overview, setOverview] = useState({ tram: {}, checkpoint: {} }); // tổng quan owner theo trạm (workflow hiện hành)
  const [cotKpi, setCotKpi] = useState([]);       // 23 cột của trang Dashboard → KPI READY
  const [phongBan, setPhongBan] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  // modal: { type: 'tram'|'checkpoint', tramId?, checkpointId?, tenDich? }
  // ⚠ Đích gán mang THEO MODAL (không đọc state `tramId`/`checkpointId` lúc lưu): khối "Owner cột KPI
  //   READY" gán thẳng vào trạm/checklist của CỘT được bấm, không phải cái đang chọn ở 2 ô Select.
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ loai: 'XU_LY', userId: '', roleId: '', phongBanId: '', batBuoc: false });
  const [saving, setSaving] = useState(false);

  const loadOverview = useCallback(() => {
    getFlowOwners().then((r) => setOverview(r.data || { tram: {}, checkpoint: {} })).catch(() => {});
  }, []);

  // Danh mục cột KPI + owner hiện tại. Lỗi thì NUỐT: đây là khối phụ, hỏng nó không được chặn việc
  // gán owner theo trạm/checklist ở phần dưới trang (và tài khoản thiếu quyền KPI vẫn dùng trang này).
  const loadCotKpi = useCallback(() => {
    getKpiCot().then((r) => setCotKpi((r.data && r.data.cot) || [])).catch(() => setCotKpi([]));
  }, []);

  useEffect(() => {
    listPhongBan().then((r) => setPhongBan(r.data)).catch(() => {});
    listRoleOptions().then((r) => setRoles(r.data)).catch(() => {});
    // Tải HẾT user (server cap limit=200/trang) — lặp trang để không sót ai khi tìm owner.
    (async () => {
      let page = 1; let all = []; let stop = false;
      while (!stop && page <= 25) {
        const r = await listUsers({ page, limit: 200 });
        const items = r.data.items || r.data || [];
        all = all.concat(items);
        const total = r.data.meta?.total;
        stop = items.length < 200 || (total != null && all.length >= total);
        page += 1;
      }
      setUsers(all);
    })().catch(() => {});
    loadOverview();
    loadCotKpi();
  }, [loadOverview, loadCotKpi]);

  useEffect(() => {
    if (!versionId) return;
    tramOptions(versionId).then((r) => { setTrams(r.data); setTramId(r.data[0]?.id || ''); }).catch(() => {});
  }, [versionId]);

  const loadTramOwners = useCallback(async () => {
    if (!tramId) { setTramOwners([]); setCheckpoints([]); return; }
    try {
      const [o, cps] = await Promise.all([listTramOwners(tramId), listCheckpoints(tramId)]);
      setTramOwners(o.data); setCheckpoints(cps.data); setCheckpointId(cps.data[0]?.id || '');
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); }
  }, [tramId, show]);

  useEffect(() => { loadTramOwners(); }, [loadTramOwners]);

  const loadCpOwners = useCallback(async () => {
    if (!checkpointId) { setCpOwners([]); return; }
    try { setCpOwners((await listCheckpointOwners(checkpointId)).data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
  }, [checkpointId, show]);

  useEffect(() => { loadCpOwners(); }, [loadCpOwners]);

  // `dich` (tùy chọn) = { tramId } hoặc { checkpointId } + `tenDich` — dùng khi gán từ khối cột KPI.
  const openAdd = (type, dich = {}) => {
    setForm({ loai: 'XU_LY', userId: '', roleId: '', phongBanId: '', batBuoc: false });
    setModal({ type, tramId, checkpointId, ...dich });
  };

  const save = async () => {
    if (!form.userId && !form.roleId && !form.phongBanId) { show('Chọn người / vai trò / phòng ban', 'error'); return; }
    setSaving(true);
    try {
      const base = { loai: form.loai, userId: form.userId || null, roleId: form.roleId || null, phongBanId: form.phongBanId || null };
      if (modal.type === 'tram') {
        await addTramOwner({ tramId: modal.tramId, ...base });
        if (modal.tramId === tramId) loadTramOwners();
      } else {
        await addCheckpointOwner({ checkpointId: modal.checkpointId, ...base, batBuoc: form.batBuoc });
        if (modal.checkpointId === checkpointId) loadCpOwners();
      }
      loadOverview();
      loadCotKpi();
      show('Đã thêm owner'); setModal(null);
    } catch (e) { show(e.message || 'Thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const removeTO = async (o) => {
    try { await removeTramOwner(o.id); show('Đã xóa'); loadTramOwners(); loadOverview(); loadCotKpi(); }
    catch (e) { show(e.message || 'Xóa thất bại (cần grant DELETE — migration 011)', 'error'); }
  };
  const removeCO = async (o) => {
    try { await removeCheckpointOwner(o.id); show('Đã xóa'); loadCpOwners(); loadOverview(); loadCotKpi(); }
    catch (e) { show(e.message || 'Xóa thất bại (cần grant DELETE — migration 011)', 'error'); }
  };

  // Bấm "+ Gán" ở khối cột KPI → mở modal với ĐÍCH LÀ trạm/checklist của CHÍNH cột đó.
  // ⚠ CỐ Ý KHÔNG đụng 2 ô Select bên dưới: đổi `tramId` sẽ kéo theo effect nạp lại checklist rồi
  //   ghi đè `checkpointId` về cái đầu tiên ⇒ đích gán nhảy lung tung. Đích đã nằm trong `modal`,
  //   và khối cột KPI tự làm mới sau khi lưu nên người dùng thấy ngay kết quả.
  const ganChoCot = (c) => {
    if (!c.dich_id) {
      show(`Cột "${c.ten}" trỏ tới ${c.owner_checkpoint ? 'checklist' : 'checkpoint'} `
        + `"${c.owner_checkpoint || c.owner_tram}" — không có trong workflow hiện hành`, 'error');
      return;
    }
    if (c.owner_checkpoint) openAdd('checkpoint', { checkpointId: c.dich_id, tenDich: `Checklist ${c.dich_ten}` });
    else openAdd('tram', { tramId: c.dich_id, tenDich: `Checkpoint ${c.dich_ten}` });
  };

  return (
    <div>
      <Toolbar title="Owner checkpoint / checklist" subtitle="Gán owner CHỊU TRÁCH NHIỆM CHÍNH & NGƯỜI XỬ LÝ TIẾP (khi nghẽn) cho từng checkpoint/checklist — hiển thị ở dashboard 'Tiến độ phần in theo checkpoint'." />

      {/* Tổng quan owner theo checkpoint (workflow hiện hành) — thấy ngay chỗ nào chưa gán */}
      <div className="card mb-4 overflow-hidden">
        <div className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">Tổng quan owner theo checkpoint</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-2 font-semibold">Checkpoint</th>
                <th className="px-4 py-2 font-semibold">Chịu trách nhiệm chính</th>
                <th className="px-4 py-2 font-semibold">Người xử lý tiếp (khi nghẽn)</th>
              </tr>
            </thead>
            <tbody>
              {trams.map((t) => {
                const o = overview.tram?.[t.ma_tram] || {};
                const tn = (o.chiu_trach_nhiem || []).join(', ');
                const xl = (o.xu_ly || []).join(', ');
                return (
                  <tr key={t.id} onClick={() => setTramId(t.id)}
                    className={`cursor-pointer border-b border-line/60 hover:bg-surface-muted ${tramId === t.id ? 'bg-primary-wash/40' : ''}`}>
                    <td className="px-4 py-2 font-medium text-ink">{t.ten_tram} <span className="text-xs text-ink-soft">{t.ma_tram}</span></td>
                    <td className="px-4 py-2">{tn ? <span className="text-ink">{tn}</span> : <Badge tone="danger">Chưa gán</Badge>}</td>
                    <td className="px-4 py-2">{xl ? <span className="text-ink">{xl}</span> : <span className="text-ink-soft">—</span>}</td>
                  </tr>
                );
              })}
              {trams.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-ink-soft">Chưa có checkpoint.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Owner theo TỪNG CỘT của trang Dashboard → KPI READY ═══════════════════════════════
          Bảng KPI có 23 cột nhưng chỉ trỏ tới 15 khóa owner (10 trạm + 5 checklist) ⇒ nhìn ở khối
          "Tổng quan owner theo checkpoint" phía trên KHÔNG biết cột nào ăn theo trạm nào. Khối này
          bày đủ 23 cột + chỉ rõ đích, bấm là gán thẳng.
          ⚠ Nhiều cột dùng CHUNG một trạm (4 cột nhóm KCS đều trỏ KIEM) ⇒ hiện CÙNG một owner —
            đúng nghiệp vụ đã chốt, không phải lỗi hiển thị. */}
      {cotKpi.length > 0 && (
        <div className="card mb-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="text-sm font-semibold text-ink">
              Owner từng cột của bảng KPI READY <span className="text-ink-soft">({cotKpi.length} cột)</span>
            </div>
            <div className="text-xs text-ink-soft">
              Owner gán vào <b>checkpoint / checklist</b> mà cột đó ăn theo — cột dùng chung một
              checkpoint thì dùng chung owner.
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Cột KPI</th>
                  <th className="px-3 py-2 font-semibold">Gán vào</th>
                  <th className="px-3 py-2 font-semibold">Chịu trách nhiệm chính</th>
                  <th className="px-3 py-2 font-semibold">Người xử lý tiếp</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {cotKpi.map((c, i) => (
                  <tr key={c.ma} className="border-b border-line/60 hover:bg-surface-muted">
                    <td className="px-3 py-2 text-xs text-ink-soft">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink">{c.ten}</div>
                      {c.ghi_chu && <div className="text-xs text-ink-soft">{c.ghi_chu}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {c.dich_id ? (
                        <div className="leading-tight">
                          <Badge tone={c.owner_checkpoint ? 'info' : 'default'}>
                            {c.owner_checkpoint ? 'Checklist' : 'Checkpoint'} {c.dich_ten}
                          </Badge>
                          <div className="mt-0.5 text-xs text-ink-soft">
                            {c.owner_checkpoint || c.owner_tram}
                            {c.dich_tram_ten ? ` · thuộc ${c.dich_tram_ten}` : ''}
                          </div>
                        </div>
                      ) : (
                        <Badge tone="warning">
                          Không có trong workflow: {c.owner_checkpoint || c.owner_tram || '—'}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {c.owner_chinh ? <span className="text-ink">{c.owner_chinh}</span> : <Badge tone="danger">Chưa gán</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      {c.owner_xu_ly ? <span className="text-ink">{c.owner_xu_ly}</span> : <span className="text-ink-soft">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canManage && (
                        <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => ganChoCot(c)}>
                          + Gán
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-4 grid max-w-2xl grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Phiên bản</label>
          <Select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.ma_version}{v.la_hien_hanh ? ' (hiện hành)' : ''}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Checkpoint</label>
          <Select value={tramId} onChange={(e) => setTramId(e.target.value)}>
            {trams.map((t) => <option key={t.id} value={t.id}>{t.ma_tram} — {t.ten_tram}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OwnerList title="Owner của checkpoint" owners={tramOwners} canManage={canManage}
          onAdd={() => openAdd('tram')} onRemove={removeTO} />

        <div>
          <div className="mb-2">
            <label className="mb-1 block text-xs font-medium text-ink-soft">Checklist</label>
            <Select value={checkpointId} onChange={(e) => setCheckpointId(e.target.value)}>
              {checkpoints.length === 0 && <option value="">— Checkpoint chưa có checklist —</option>}
              {checkpoints.map((c) => <option key={c.id} value={c.id}>{c.ma_checkpoint} — {c.ten_checkpoint}</option>)}
            </Select>
          </div>
          <OwnerList title="Owner của checklist" owners={cpOwners} canManage={canManage && !!checkpointId}
            onAdd={checkpointId ? () => openAdd('checkpoint') : null} onRemove={removeCO} />
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal?.tenDich ? `Thêm owner — ${modal.tenDich}` : 'Thêm owner'} size="sm"
        footer={<>
          <Button chiXemOk variant="ghost" onClick={() => setModal(null)}>Hủy</Button>
          <Button onClick={save} loading={saving}>Thêm</Button>
        </>}>
        <Field label="Phân loại">
          <Select value={form.loai} onChange={(e) => setForm({ ...form, loai: e.target.value })}>
            <option value="XU_LY">Xử lý</option>
            <option value="CHIU_TRACH_NHIEM">Chịu trách nhiệm</option>
          </Select>
        </Field>
        <Field label="Người (owner xử lý cụ thể)">
          <SearchableSelect
            value={form.userId}
            onChange={(v) => setForm({ ...form, userId: v })}
            options={users}
            getValue={(u) => u.id}
            getLabel={(u) => (u.ho_ten ? `${u.ho_ten} (@${u.ten_dang_nhap})` : `@${u.ten_dang_nhap}`)}
            getSearch={(u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`}
            placeholder="Gõ tên hoặc tên đăng nhập (không dấu cũng được)..."
          />
        </Field>
        <Field label="Vai trò">
          <Select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
            <option value="">— Không —</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.ten_role}</option>)}
          </Select>
        </Field>
        <Field label="Phòng ban">
          <Select value={form.phongBanId} onChange={(e) => setForm({ ...form, phongBanId: e.target.value })}>
            <option value="">— Không —</option>
            {phongBan.map((p) => <option key={p.id} value={p.id}>{p.ten_phong_ban}</option>)}
          </Select>
        </Field>
        {modal?.type === 'checkpoint' && (
          <Field label="Bắt buộc xác nhận">
            <button type="button" onClick={() => setForm({ ...form, batBuoc: !form.batBuoc })}
              className={`h-11 w-full rounded-input border text-sm font-medium ${form.batBuoc ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft'}`}>
              {form.batBuoc ? 'Bắt buộc' : 'Không bắt buộc'}
            </button>
          </Field>
        )}
        <p className="text-xs text-ink-soft">Chọn ít nhất người, vai trò, hoặc phòng ban. Owner <b>xử lý</b> dạng người sẽ được gán tự động khi đợt vải vào checkpoint.</p>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
