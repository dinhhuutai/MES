import { useEffect, useState, useCallback } from 'react';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import useNow from '../../../hooks/useNow';
import useSocketEvent from '../../../hooks/useSocketEvent';
import { evalSla, SLA_BADGE, fmtDur } from '../../../utils/sla';
import { fmtNum } from '../../../utils/format';
import {
  getTinhTrangSummary, listTinhTrangPhanIn, getTinhTrangPhanIn,
} from '../../../services/dashboardService';

const ROTATE_MS = 10000;
const fmtTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

function SummaryCard({ icon, label, value, tone, onClick }) {
  return (
    <div className={`card p-4 ${onClick ? 'cursor-pointer transition hover:shadow-card-hover' : ''}`}
      onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-control ${tone}`}>
        <Icon name={icon} size={18} />
      </div>
      <div className="text-3xl font-bold tabular-nums text-ink">{fmtNum(value)}</div>
      <div className="text-sm text-ink-soft">{label}{onClick ? ' →' : ''}</div>
    </div>
  );
}

// 1 node trạm trên đường kẻ ngang.
function StageNode({ title, when, nguoi, phut, live, current }) {
  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className={`min-w-[130px] rounded-control border px-3 py-2 text-center
        ${current ? 'border-primary bg-primary-wash shadow-card' : 'border-line bg-surface'}`}>
        <div className={`text-sm font-semibold ${current ? 'text-primary' : 'text-ink'}`}>{title}</div>
        {live != null && (
          <div className={`mt-0.5 text-xs font-medium ${live.status === 'NGHEN' ? 'text-danger' : live.status === 'SAP_NGHEN' ? 'text-warning' : 'text-ink-soft'}`}>
            Đã ở {fmtDur(live.phut)}
          </div>
        )}
        {when && <div className="mt-0.5 text-[11px] text-ink-soft">{fmtTime(when)}</div>}
        {phut != null && <div className="text-[11px] text-ink-soft">ở trạm trước {fmtDur(phut)}</div>}
        {nguoi && <div className="mt-0.5 text-[11px] font-medium text-ink">{nguoi}</div>}
      </div>
    </div>
  );
}

const Connector = () => (
  <div className="mx-1 mt-6 h-px w-6 shrink-0 self-start bg-line" />
);

// Nhánh KCS → (Sửa) → OQC của 1 tem.
function TemBranch({ tem }) {
  const chips = [];
  if (tem.kcs_ket_qua) {
    chips.push({ k: 'kcs', label: `KCS ${tem.kcs_ket_qua === 'DAT' ? 'đạt' : 'có lỗi'}`,
      sub: `đạt ${fmtNum(tem.kcs_dat)}${tem.kcs_loi ? ` · lỗi ${fmtNum(tem.kcs_loi)}` : ''}`, nguoi: tem.kcs_nguoi, tone: 'info' });
  }
  if (tem.sua_dat != null) {
    chips.push({ k: 'sua', label: 'Sửa', sub: `đạt ${fmtNum(tem.sua_dat)}`, nguoi: tem.sua_nguoi, tone: 'warning' });
  }
  if (tem.oqc_ket_qua) {
    chips.push({ k: 'oqc', label: `OQC ${tem.oqc_ket_qua === 'DAT' ? 'đạt' : 'không đạt'}${tem.oqc_cho_giao ? ' · cho giao' : ''}`,
      sub: '', nguoi: tem.oqc_nguoi, tone: tem.oqc_ket_qua === 'DAT' ? 'success' : 'danger' });
  }
  return (
    <div className="flex items-start gap-1">
      {chips.length === 0 && <span className="text-[11px] text-ink-soft">Chưa kiểm</span>}
      {chips.map((c, i) => (
        <div key={c.k} className="flex items-start gap-1">
          {i > 0 && <span className="mt-1.5 text-ink-soft">→</span>}
          <div className="rounded-control border border-line bg-surface px-2 py-1 text-center">
            <Badge tone={c.tone}>{c.label}</Badge>
            {c.sub && <div className="mt-0.5 text-[11px] text-ink-soft">{c.sub}</div>}
            {c.nguoi && <div className="text-[11px] font-medium text-ink">{c.nguoi}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

const TEM_TONE = {
  IN: 'default', DANG_PHOI: 'info', DA_KHO: 'info', CHO_SUA: 'warning',
  CHO_OQC: 'info', OQC_DAT: 'success', DA_GIAO: 'success', LOAI: 'danger', HUY: 'danger',
};

// Nhóm tem — rẽ nhánh DÍNH vào node trạm ở trên (đường kẻ dọc nối lên).
function TemGroup({ tems }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-4 w-px bg-primary/40" />
      <div className="rounded-control border border-dashed border-primary/40 bg-primary-wash/20 p-2">
        <div className="mb-1.5 text-center text-[11px] font-semibold text-ink-soft">Tem ({tems.length})</div>
        <div className="flex flex-wrap justify-center gap-2">
          {tems.map((tem) => (
            <div key={tem.tem_id} className="rounded-control border border-line bg-surface p-2.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-ink">{tem.ma_tem}</span>
                <Badge tone={TEM_TONE[tem.trang_thai] || 'default'}>{tem.trang_thai}</Badge>
                <span className="text-[11px] text-ink-soft">{fmtNum(tem.so_luong)} pcs</span>
              </div>
              <TemBranch tem={tem} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 1 đợt vải: đường kẻ ngang các trạm; tem rẽ nhánh dính vào node trạm hiện tại.
function DotVaiFlow({ dot, now }) {
  const cur = dot.current;
  const live = cur ? evalSla(cur.tg_vao, cur.sla_phut, cur.canh_bao_truoc_phut, now) : null;
  const hasTimeline = dot.timeline && dot.timeline.length > 0;
  // Node cuối được coi là "hiện tại" để dính nhánh tem (kể cả khi không khớp ton_tram).
  const lastIdx = hasTimeline ? dot.timeline.length - 1 : -1;
  const tems = dot.tems || [];

  return (
    <div className="rounded-card border border-line bg-surface-muted/40 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="info"><Icon name="git-branch" size={12} className="mr-1" />{dot.ma_dot_vai}</Badge>
        <span className="text-xs text-ink-soft">SLNV {fmtNum(dot.so_luong_vai_ve)}</span>
        {cur && live && <Badge tone={SLA_BADGE[live.status].tone}>{SLA_BADGE[live.status].label} · {cur.ten_tram}</Badge>}
        {!cur && <Badge tone="default">Chưa vào dòng chảy</Badge>}
      </div>

      <div className="flex items-start overflow-x-auto pb-2">
        {hasTimeline ? dot.timeline.map((t, i) => {
          const isLast = i === lastIdx;
          const isCur = cur && t.den_tram === cur.ma_tram;
          return (
            <div key={i} className="flex items-start">
              {i > 0 && <Connector />}
              <div className="flex flex-col items-center">
                <StageNode title={t.den_ten} when={t.tg_kt} nguoi={t.nguoi} phut={t.phut}
                  current={isCur} live={isCur ? live : null} />
                {isLast && tems.length > 0 && <TemGroup tems={tems} />}
              </div>
            </div>
          );
        }) : (
          <div className="flex flex-col items-center">
            <StageNode title={cur ? cur.ten_tram : 'Chưa vào trạm'} when={cur?.tg_vao} current={!!cur} live={live} />
            {tems.length > 0 && <TemGroup tems={tems} />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TinhTrangTramPage() {
  const { toast, show } = useToast();
  const now = useNow(1000);
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState([]);
  const [idx, setIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [paused, setPaused] = useState(false);
  const [nghenPanel, setNghenPanel] = useState(null); // null | 'NGHEN' | 'SAP_NGHEN'

  const loadList = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([getTinhTrangSummary(), listTinhTrangPhanIn({ search })]);
      setSummary(s.data);
      setList(l.data.items);
      setIdx((i) => (l.data.items.length ? Math.min(i, l.data.items.length - 1) : 0));
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); }
  }, [search, show]);

  useEffect(() => { const t = setTimeout(loadList, 250); return () => clearTimeout(t); }, [loadList]);
  useSocketEvent('dashboard:refresh', loadList);
  useSocketEvent('production:updated', loadList);

  const current = list[idx];

  useEffect(() => {
    if (!current) { setDetail(null); return undefined; }
    let alive = true;
    getTinhTrangPhanIn(current.id).then((r) => { if (alive) setDetail(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tự xoay sang phần in kế tiếp mỗi 10s.
  useEffect(() => {
    if (paused || list.length <= 1) return undefined;
    const t = setTimeout(() => setIdx((i) => (i + 1) % list.length), ROTATE_MS);
    return () => clearTimeout(t);
  }, [paused, idx, list.length]);

  const go = (delta) => setIdx((i) => (list.length ? (i + delta + list.length) % list.length : 0));

  // Bấm 1 phần in trong danh sách nghẽn → lọc tới nó (tạm dừng xoay).
  const pickPhanIn = (item) => { setSearch(item.ma_phan); setPaused(true); setNghenPanel(null); };
  const nghenItems = nghenPanel ? (summary?.danh_sach?.[nghenPanel] || []) : [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Tình trạng đơn hàng theo trạm</h1>
          <p className="text-sm text-ink-soft">Trình chiếu realtime — mỗi phần in hiển thị {ROTATE_MS / 1000}s rồi tự chuyển</p>
        </div>
        <Badge tone="success"><span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Realtime</Badge>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon="activity" label="Phần in đang chạy (chưa giao)" value={summary?.dang_chay_chua_giao || 0} tone="text-primary bg-primary-wash" />
        <SummaryCard icon="clock" label="Phần in sắp nghẽn" value={summary?.sap_nghen || 0}
          onClick={() => setNghenPanel('SAP_NGHEN')}
          tone={(summary?.sap_nghen || 0) > 0 ? 'text-amber-600 bg-amber-50' : 'text-ink-soft bg-surface-muted'} />
        <SummaryCard icon="alert-triangle" label="Phần in nghẽn" value={summary?.nghen || 0}
          onClick={() => setNghenPanel('NGHEN')}
          tone={(summary?.nghen || 0) > 0 ? 'text-rose-600 bg-rose-50' : 'text-ink-soft bg-surface-muted'} />
      </div>

      {/* Điều khiển + tìm kiếm */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm code phần / đơn / màu / kích vải / kích phim..."
            className="h-11 w-full rounded-input border border-line bg-surface pl-9 pr-3 text-sm" />
        </div>
        <button onClick={() => go(-1)} className="rounded-control border border-line px-3 py-2 text-sm hover:bg-surface-muted"><Icon name="chevron-left" size={16} /></button>
        <span className="text-sm text-ink-soft tabular-nums">{list.length ? idx + 1 : 0}/{list.length}</span>
        <button onClick={() => go(1)} className="rounded-control border border-line px-3 py-2 text-sm hover:bg-surface-muted"><Icon name="chevron-right" size={16} /></button>
        <button onClick={() => setPaused((p) => !p)}
          className={`rounded-control px-3 py-2 text-sm font-medium ${paused ? 'bg-primary text-white' : 'border border-line text-ink-soft hover:bg-surface-muted'}`}>
          {paused ? 'Tiếp tục' : 'Tạm dừng'}
        </button>
      </div>

      {/* Nội dung 1 phần in */}
      {!current ? (
        <div className="card p-12 text-center text-ink-soft">Không có phần in nào trong dòng chảy.</div>
      ) : !detail ? (
        <div className="card p-12 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="card p-5">
          {/* Node gốc phần in */}
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-primary/30 bg-primary-wash px-4 py-3">
            <Icon name="package" size={20} className="text-primary" />
            <div>
              <div className="text-lg font-bold text-ink">{detail.phan_in.ma_phan}</div>
              <div className="text-sm text-ink-soft">
                {[detail.phan_in.ten_khach_hang, detail.phan_in.ma_don_hang, detail.phan_in.ma_hang].filter(Boolean).join(' · ')}
              </div>
              <div className="text-xs text-ink-soft">
                {[detail.phan_in.mau_vai, detail.phan_in.kich_vai, detail.phan_in.kich_phim].filter(Boolean).join(' · ')}
              </div>
            </div>
            <Badge tone="info" className="ml-auto">{detail.dot_vai.length} đợt vải</Badge>
          </div>

          {/* Tổng hợp số lượng theo tem (hợp nhất theo phần in) */}
          {detail.tem_summary?.pcs_in > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge tone="default">{fmtNum(detail.tem_summary.pcs_in)} pcs · {fmtNum(detail.tem_summary.so_tem)} tem</Badge>
              {detail.tem_summary.sl_dat > 0 && <Badge tone="success">Đạt {fmtNum(detail.tem_summary.sl_dat)}</Badge>}
              {detail.tem_summary.sl_sua > 0 && <Badge tone="warning">Sửa {fmtNum(detail.tem_summary.sl_sua)}</Badge>}
              {detail.tem_summary.sl_sua_dat > 0 && <Badge tone="info">Sửa đạt {fmtNum(detail.tem_summary.sl_sua_dat)}</Badge>}
            </div>
          )}

          {/* Các đợt vải (rẽ nhánh) */}
          <div className="space-y-4">
            {detail.dot_vai.map((d) => <DotVaiFlow key={d.id} dot={d} now={now} />)}
          </div>
        </div>
      )}

      <SidePanel open={!!nghenPanel} onClose={() => setNghenPanel(null)}
        title={nghenPanel === 'NGHEN' ? 'Phần in đang nghẽn' : 'Phần in sắp nghẽn'}
        subtitle={`${nghenItems.length} phần in`} width="max-w-md">
        {nghenItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">Không có phần in nào.</p>
        ) : (
          <div className="space-y-2">
            {nghenItems.map((it) => (
              <button key={it.id} onClick={() => pickPhanIn(it)}
                className="w-full rounded-control border border-line p-3 text-left transition hover:bg-surface-muted">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{it.ma_phan}</span>
                  <Badge tone={SLA_BADGE[it.sla_status].tone}>{SLA_BADGE[it.sla_status].label}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-ink-soft">
                  {[it.ten_khach_hang, it.ma_don_hang, it.ma_hang].filter(Boolean).join(' · ')}
                </div>
                <div className="text-xs text-ink-soft">
                  {[it.mau_vai, it.kich_vai, it.kich_phim].filter(Boolean).join(' · ')} · đang ở <b>{it.ten_tram}</b>
                </div>
              </button>
            ))}
          </div>
        )}
      </SidePanel>

      <Toast toast={toast} />
    </div>
  );
}
