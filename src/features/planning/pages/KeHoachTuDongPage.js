import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { autoPlanCandidates, createRelease1 } from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

const fmtDay = (s) => {
  if (!s) return '';
  const d = new Date(`${s}T00:00:00`);
  const wd = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
  return `${wd} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// 1 đợt vải trong kế hoạch của chuyền.
function PlanItem({ it, onConfirm, busy }) {
  const b = it.best_chuyen || {};
  return (
    <div className="rounded-control border border-line bg-surface p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{it.ma_phan}{it.ten_khach_hang ? ` · ${it.ten_khach_hang}` : ''}</div>
          <div className="truncate text-xs text-ink-soft">{[it.ma_hang, it.mau_vai, it.kich_vai, it.kich_phim].filter(Boolean).join(' · ')}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-soft">
            <Badge tone="info">{it.ma_dot_vai}</Badge>
            <span>SL vải {fmtNum(it.so_luong_vai_ve)}</span>
            <span>· NS {fmtNum(b.nang_suat_gio)}/giờ</span>
            <span>· ~{fmtNum(it.so_gio_sx)}h</span>
            {it.han_giao_hang && <span>· hạn {fmtDate(it.han_giao_hang)}</span>}
          </div>
          {it.tra_ve_ly_do && <div className="mt-1"><Badge tone="danger" title={it.tra_ve_ly_do}>Test Run trả về</Badge></div>}
        </div>
        <Button variant="secondary" className="!px-3 !py-1.5 !text-xs shrink-0" loading={busy}
          onClick={() => onConfirm(it)}>Xác nhận</Button>
      </div>
    </div>
  );
}

// 1 card chuyền: header + kế hoạch nhóm theo ngày.
function ChuyenCard({ chuyen, items, onConfirm, onConfirmAll, busyId, busyChuyen }) {
  const byDay = useMemo(() => {
    const m = {};
    items.forEach((it) => { (m[it.ngay_ke_hoach] = m[it.ngay_ke_hoach] || []).push(it); });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);
  const tongPcs = items.reduce((s, it) => s + (Number(it.so_luong_vai_ve) || 0), 0);

  return (
    <div className="flex w-[320px] shrink-0 flex-col rounded-card border border-line bg-surface-muted/40">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-ink">{chuyen.ten_chuyen}</div>
          <div className="text-[11px] text-ink-soft">{chuyen.so_pass} pass · {items.length} đợt · {fmtNum(tongPcs)} pcs</div>
        </div>
        {items.length > 0 && (
          <Button variant="primary" className="!px-3 !py-1.5 !text-xs shrink-0" loading={busyChuyen === chuyen.id}
            onClick={() => onConfirmAll(chuyen.id, items)}>Xác nhận cả chuyền</Button>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-2.5" style={{ maxHeight: '60vh' }}>
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-soft">Chưa có đợt vải phù hợp</div>
        ) : (
          byDay.map(([day, list]) => (
            <div key={day}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                <Icon name="calendar-days" size={13} /> {fmtDay(day)}
                <span className="text-ink-soft">· {list.length} đợt</span>
              </div>
              <div className="space-y-1.5">
                {list.map((it) => (
                  <PlanItem key={it.dot_vai_id} it={it} busy={busyId === it.dot_vai_id} onConfirm={onConfirm} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function KeHoachTuDongPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRelease = can('RELEASE1');

  const [chuyens, setChuyens] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const [busyId, setBusyId] = useState(null);       // dot_vai_id đang xác nhận
  const [busyChuyen, setBusyChuyen] = useState(null); // chuyen_id đang xác nhận cả chuyền

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await autoPlanCandidates({ search });
      setChuyens(res.data.chuyens || []);
      setItems(res.data.items || []);
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); } finally { setLoading(false); }
  }, [search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const itemsByChuyen = useMemo(() => {
    const m = {};
    items.forEach((it) => { const cid = it.best_chuyen && it.best_chuyen.chuyen_id; if (cid) (m[cid] = m[cid] || []).push(it); });
    return m;
  }, [items]);

  const confirmOne = async (it) => {
    if (!canRelease) return;
    setBusyId(it.dot_vai_id);
    try {
      await createRelease1({
        dotVaiIds: [it.dot_vai_id], chuyenId: it.best_chuyen.chuyen_id,
        soLuongRelease: it.so_luong_vai_ve, ngayKeHoach: it.ngay_ke_hoach,
      });
      setItems((prev) => prev.filter((x) => x.dot_vai_id !== it.dot_vai_id));
      show(`Đã xác nhận Release 1 — ${it.ma_phan} · ${it.ma_dot_vai}`);
    } catch (e) { show(e.message || 'Xác nhận thất bại', 'error'); } finally { setBusyId(null); }
  };

  const confirmAll = async (chuyenId, list) => {
    if (!canRelease) return;
    setBusyChuyen(chuyenId);
    let ok = 0; let fail = 0; const doneIds = [];
    for (const it of list) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await createRelease1({
          dotVaiIds: [it.dot_vai_id], chuyenId: it.best_chuyen.chuyen_id,
          soLuongRelease: it.so_luong_vai_ve, ngayKeHoach: it.ngay_ke_hoach,
        });
        ok += 1; doneIds.push(it.dot_vai_id);
      } catch (e) { fail += 1; }
    }
    setItems((prev) => prev.filter((x) => !doneIds.includes(x.dot_vai_id)));
    show(fail ? `Xác nhận ${ok} đợt, ${fail} lỗi` : `Đã xác nhận ${ok} đợt trên chuyền`, fail ? 'error' : 'success');
    setBusyChuyen(null);
  };

  const withItems = chuyens.filter((c) => (itemsByChuyen[c.id] || []).length > 0);
  const empty = chuyens.filter((c) => (itemsByChuyen[c.id] || []).length === 0);
  const visible = showEmpty ? [...withItems, ...empty] : withItems;

  return (
    <div>
      <Toolbar title="Kế hoạch tự động"
        subtitle="Hệ thống xếp đợt vải chờ Release 1 lên chuyền tối ưu theo năng suất & ngày — bấm Xác nhận = Release 1"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, mã hàng, màu/kích, đợt vải...">
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
          Hiện chuyền trống
        </label>
        <Badge tone="info">{items.length} đợt · {withItems.length}/{chuyens.length} chuyền</Badge>
      </Toolbar>

      <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        Thông số HSKT (vải/pass, số lần in, pass bỏ) & số pass mỗi chuyền hiện là <b>dữ liệu tạm</b> — sẽ lấy từ ERP.
      </div>

      {loading ? (
        <div className="py-16 text-center text-ink-soft">Đang tải...</div>
      ) : withItems.length === 0 && !showEmpty ? (
        <div className="card p-12 text-center text-ink-soft">Không có đợt vải nào chờ Release 1.</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {visible.map((c) => (
            <ChuyenCard key={c.id} chuyen={c} items={itemsByChuyen[c.id] || []}
              onConfirm={confirmOne} onConfirmAll={confirmAll} busyId={busyId} busyChuyen={busyChuyen} />
          ))}
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
