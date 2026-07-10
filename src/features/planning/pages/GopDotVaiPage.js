import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import HistoryPanel from '../../../components/common/HistoryPanel';
import { Input } from '../../../components/common/controls';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import useToast from '../../../hooks/useToast';
import { listGopCandidates, gopDotVai, gopHistory } from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

// Gộp số lượng đợt vải: chọn đợt ĐÍCH (bấm đầu tiên) rồi các đợt NGUỒN của CÙNG phần in,
// nhập SL chuyển từ nguồn → đích để release 1 lần. Nguồn về 0 → ẩn khỏi hệ thống.
export default function GopDotVaiPage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [histOpen, setHistOpen] = useState(false);
  // sel = { phanInId, targetId, sources: { [dotId]: qtyString } }
  const [sel, setSel] = useState(null);
  const [merge, setMerge] = useState(null); // dữ liệu modal gộp
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listGopCandidates({ search });
      setRows(res.data.items || []);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // Gom theo phần in; chỉ hiện phần in có ≥2 đợt (mới gộp được).
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.phan_in_id)) m.set(r.phan_in_id, { phanIn: r, dots: [] });
      m.get(r.phan_in_id).dots.push(r);
    }
    return [...m.values()].filter((g) => g.dots.length >= 2);
  }, [rows]);

  const singleCount = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.phan_in_id, (m.get(r.phan_in_id) || 0) + 1));
    return [...m.values()].filter((n) => n < 2).length;
  }, [rows]);

  const dotState = (r) => {
    if (!sel || sel.phanInId !== r.phan_in_id) return null;
    if (sel.targetId === r.dot_vai_id) return 'dich';
    if (r.dot_vai_id in sel.sources) return 'nguon';
    return null;
  };

  // Bấm 1 đợt: đợt đầu tiên của 1 phần in = ĐÍCH; các đợt sau = NGUỒN. Bấm đợt khác phần in → chọn lại.
  const clickDot = (r) => {
    setSel((s) => {
      if (!s || s.phanInId !== r.phan_in_id) {
        return { phanInId: r.phan_in_id, targetId: r.dot_vai_id, sources: {} };
      }
      if (s.targetId === r.dot_vai_id) return null; // bỏ chọn đích → xóa hết
      const sources = { ...s.sources };
      if (r.dot_vai_id in sources) delete sources[r.dot_vai_id];
      else sources[r.dot_vai_id] = String(r.so_luong_vai_ve);
      return { ...s, sources };
    });
  };

  const selCount = sel ? Object.keys(sel.sources).length : 0;

  const openMerge = () => {
    if (!sel || selCount === 0) return;
    const g = groups.find((x) => x.phanIn.phan_in_id === sel.phanInId);
    if (!g) return;
    const target = g.dots.find((d) => d.dot_vai_id === sel.targetId);
    const sources = g.dots.filter((d) => d.dot_vai_id in sel.sources)
      .map((d) => ({ ...d, qty: sel.sources[d.dot_vai_id] }));
    setMerge({ phanIn: g.phanIn, target, sources });
  };

  const setMergeQty = (dotId, v) =>
    setMerge((m) => ({ ...m, sources: m.sources.map((s) => (s.dot_vai_id === dotId ? { ...s, qty: v } : s)) }));

  const totalMove = merge ? merge.sources.reduce((s, x) => s + (Number(x.qty) || 0), 0) : 0;
  const invalid = merge && merge.sources.some((s) => !(Number(s.qty) > 0) || Number(s.qty) > s.so_luong_vai_ve);

  const doMerge = async () => {
    setSaving(true);
    try {
      await gopDotVai({
        dotDichId: merge.target.dot_vai_id,
        nguon: merge.sources.map((s) => ({ dotVaiId: s.dot_vai_id, soLuong: Number(s.qty) })),
      });
      show(`Đã gộp ${merge.sources.length} đợt vào ${merge.target.ma_dot_vai} (+${fmtNum(totalMove)})`);
      setMerge(null);
      setSel(null);
      load();
    } catch (e) {
      show(e.message || 'Gộp thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Toolbar title="Gộp số lượng đợt vải" subtitle="Gộp nhiều đợt vải của cùng phần in để release 1 lần"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm code phần, khách, mã hàng, màu/kích...">
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử gộp</Button>
        <Badge tone="info">{groups.length} phần in gộp được</Badge>
      </Toolbar>

      <div className="mb-3 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
        Bấm <b>1 đợt vải</b> làm <b>đích</b> (nhận số lượng), rồi bấm các đợt khác <b>cùng phần in</b> làm <b>nguồn</b>.
        Bấm <b>Gộp số lượng</b> để nhập SL chuyển vào đích. Đợt nguồn về <b>0 sẽ ẩn khỏi hệ thống</b>.
        {singleCount > 0 && <span className="ml-1">({singleCount} phần in chỉ có 1 đợt — không hiện vì không gộp được.)</span>}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-ink-soft"><Icon name="loader" size={22} className="mx-auto animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="card p-10 text-center text-ink-soft">Không có phần in nào có ≥2 đợt vải chờ release để gộp.</div>
      ) : (
        <div className="max-h-[calc(100vh-15rem)] space-y-3 overflow-auto pr-1">
          {groups.map((g) => {
            const p = g.phanIn;
            const active = sel && sel.phanInId === p.phan_in_id;
            return (
              <div key={p.phan_in_id} className={`card p-4 ${active ? 'ring-2 ring-primary/40' : ''}`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">{p.ma_phan || '—'}</Badge>
                      <span className="truncate text-sm font-semibold text-ink">{p.ten_khach_hang || '—'}</span>
                      <span className="truncate text-xs text-ink-soft">{p.ma_don_hang} · {p.ma_hang}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-soft">
                      {p.mau_vai || '—'} · {[p.kich_vai, p.kich_phim].filter(Boolean).join(' / ') || '—'} · {g.dots.length} đợt
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {g.dots.map((d) => {
                    const st = dotState(d);
                    return (
                      <button key={d.dot_vai_id} type="button" onClick={() => clickDot(d)}
                        className={`rounded-control border px-3 py-2 text-left transition ${
                          st === 'dich' ? 'border-primary bg-primary-wash ring-1 ring-primary'
                          : st === 'nguon' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                          : 'border-line hover:border-primary/50 hover:bg-surface-muted/50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-ink">{d.ma_dot_vai}</span>
                          {st === 'dich' && <Badge tone="info">Đích</Badge>}
                          {st === 'nguon' && <Badge tone="warning">Nguồn</Badge>}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-xs text-ink-soft">
                          <span className="tabular-nums">SL <b className="text-ink">{fmtNum(d.so_luong_vai_ve)}</b></span>
                          <LoaiDotVaiBadge value={d.loai_dot_vai} />
                        </div>
                        <div className="text-[10px] text-ink-soft">Vải về {fmtDate(d.ngay_vai_ve)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sel && selCount > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-card border border-line bg-surface px-5 py-3 shadow-card-hover">
          <span className="text-sm text-ink">
            Gộp <b>{selCount}</b> đợt nguồn vào đợt đích đã chọn
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSel(null)}>Bỏ chọn</Button>
            <Button onClick={openMerge}>Gộp số lượng ({selCount})</Button>
          </div>
        </div>
      )}

      <Modal open={!!merge} onClose={() => setMerge(null)} title="Gộp số lượng vào đợt đích"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMerge(null)}>Hủy</Button>
            <Button onClick={doMerge} loading={saving} disabled={invalid || totalMove <= 0}>Xác nhận gộp</Button>
          </>
        }
      >
        {merge && (
          <div className="space-y-3">
            <div className="rounded-control bg-surface-muted px-3 py-2 text-sm">
              Đợt đích: <b className="text-primary">{merge.target.ma_dot_vai}</b> (SL hiện tại {fmtNum(merge.target.so_luong_vai_ve)})
              → sau gộp <b className="text-primary">{fmtNum(merge.target.so_luong_vai_ve + totalMove)}</b>
            </div>
            <div className="space-y-2">
              {merge.sources.map((s) => {
                const bad = !(Number(s.qty) > 0) || Number(s.qty) > s.so_luong_vai_ve;
                return (
                  <div key={s.dot_vai_id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{s.ma_dot_vai}</div>
                      <div className="text-xs text-ink-soft">Có {fmtNum(s.so_luong_vai_ve)}
                        {Number(s.qty) >= s.so_luong_vai_ve ? ' · gộp hết → ẩn đợt này' : ''}</div>
                    </div>
                    <div className="w-28">
                      <Input type="number" min="1" max={s.so_luong_vai_ve} value={s.qty}
                        onChange={(e) => setMergeQty(s.dot_vai_id, e.target.value)}
                        className={bad ? 'border-danger focus:border-danger' : ''} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-ink-soft">SL gộp mỗi đợt phải &gt; 0 và ≤ SL đợt đó. Tổng chuyển: <b>{fmtNum(totalMove)}</b>.</p>
          </div>
        )}
      </Modal>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)} title="Lịch sử gộp đợt vải" fetcher={gopHistory} />
      <Toast toast={toast} />
    </div>
  );
}
