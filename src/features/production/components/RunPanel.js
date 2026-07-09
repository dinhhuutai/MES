import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import { Input, Textarea, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { getRun, printTem, reprintTem, getTemLabel, getTemLogs, finishRun, stopLine, resumeLine, addVaiHuy, pauseLenhChay, listProductionCandidates, startProduction } from '../../../services/productionService';
import printTemLabel from '../utils/printTemLabel';
import { fmtNum, fmtDate } from '../../../utils/format';

const TEM_TONE = { IN: 'warning', DANG_PHOI: 'info', DA_KHO: 'success', HUY: 'danger' };
const TEM_LABEL = { IN: 'Chờ phơi', DANG_PHOI: 'Đang phơi', DA_KHO: 'Đã khô', HUY: 'Đã hủy' };
const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

export default function RunPanel({ lenhId, onClose, onChanged }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRun = can('PROD_RUN');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [soLuong, setSoLuong] = useState('');
  const [stopReason, setStopReason] = useState('');
  const [reprint, setReprint] = useState(null); // tem đang in lại
  const [reprintReason, setReprintReason] = useState('');
  const [logsOpen, setLogsOpen] = useState(false);
  const [temLogs, setTemLogs] = useState([]);
  const [vhForm, setVhForm] = useState({ dotVaiId: '', soLuong: '', lyDo: '' });
  const [pauseOpen, setPauseOpen] = useState(false);   // modal ngừng lệnh chạy (in hàng gấp)
  const [swapList, setSwapList] = useState([]);        // phần in đang chờ sản xuất để hoán đổi
  const [swapLoading, setSwapLoading] = useState(false);

  const phieu = data?.phieu;
  const running = phieu?.trang_thai === 'DANG_CHAY';
  const ngungActive = data?.ngung_active || null;
  const ngungList = data?.ngung_list || [];
  const dotVaiList = data?.dot_vai || [];
  const vaiHuyList = data?.vai_huy || [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRun(lenhId);
      setData(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [lenhId, show]);

  useEffect(() => { load(); }, [load]);

  // Lấy dữ liệu nhãn tem rồi mở cửa sổ in (barcode Code128 = mã tem).
  const printLabelFor = async (temId) => {
    if (!temId) return;
    try { const res = await getTemLabel(temId); await printTemLabel(res.data); }
    catch (e) { show('Không lấy được dữ liệu tem để in', 'error'); }
  };

  const doPrint = async () => {
    setBusy(true);
    try {
      const res = await printTem(phieu.id, Number(soLuong));
      show(`Đã in tem ${fmtNum(soLuong)} — tự đưa vào xe phơi, đang đếm ngược`);
      setSoLuong('');
      await printLabelFor(res.data?.new_tem_id);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'In tem thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doFinish = async () => {
    setBusy(true);
    try {
      await finishRun(phieu.id);
      show('Đã hoàn tất chạy');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doStop = async () => {
    if (!stopReason.trim()) { show('Nhập lý do ngừng chuyền', 'error'); return; }
    setBusy(true);
    try {
      await stopLine(phieu.id, stopReason.trim());
      show('Đã ngừng chuyền');
      setStopReason('');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally { setBusy(false); }
  };

  const openLogs = async () => {
    setLogsOpen(true);
    try { const res = await getTemLogs(phieu.id); setTemLogs(res.data); }
    catch (e) { show(e.message || 'Lỗi tải lịch sử', 'error'); }
  };

  // Ngừng lệnh chạy để in hàng gấp: mở modal + nạp danh sách phần in đang chờ sản xuất (để hoán đổi).
  const openPause = async () => {
    setPauseOpen(true);
    setSwapLoading(true);
    try {
      const res = await listProductionCandidates({ limit: 50 });
      setSwapList((res.data.items || []).filter((r) => r.id !== lenhId)); // trừ chính lệnh đang mở
    } catch (e) {
      show(e.message || 'Lỗi tải danh sách chờ sản xuất', 'error');
    } finally { setSwapLoading(false); }
  };

  // Chỉ ngừng lệnh chạy (không hoán đổi) → lệnh về chờ chạy.
  const doPauseOnly = async () => {
    setBusy(true);
    try {
      await pauseLenhChay(phieu.id);
      show('Đã ngừng lệnh chạy — lệnh về chờ chạy để lập lại kế hoạch (giữ nguyên số lượng đã in)');
      setPauseOpen(false);
      onChanged?.();
      onClose?.();
    } catch (e) {
      show(e.message || 'Ngừng lệnh chạy thất bại', 'error');
    } finally { setBusy(false); }
  };

  // Hoán đổi: ngừng lệnh hiện tại rồi bắt đầu chạy phần in gấp hơn TRÊN CÙNG CHUYỀN.
  const doSwap = async (cand) => {
    setBusy(true);
    try {
      await pauseLenhChay(phieu.id);
      await startProduction(cand.id, data?.lenh?.chuyen_id || null);
      show(`Đã ngừng ${data?.lenh?.ma_lenh_san_xuat || ''} & chạy ${cand.ma_lenh_san_xuat} thay thế`);
      setPauseOpen(false);
      onChanged?.();
      onClose?.();
    } catch (e) {
      show(e.message || 'Hoán đổi thất bại', 'error');
    } finally { setBusy(false); }
  };

  // Ghi vải hủy theo phần in. Lệnh chỉ 1 phần in → tự chọn; nhiều phần in → phải chọn.
  const doVaiHuy = async () => {
    const qty = Number(vhForm.soLuong);
    if (!qty || qty <= 0) { show('Nhập số lượng vải hủy', 'error'); return; }
    if (dotVaiList.length > 1 && !vhForm.dotVaiId) { show('Chọn phần in cần ghi vải hủy', 'error'); return; }
    setBusy(true);
    try {
      await addVaiHuy(phieu.id, {
        dotVaiId: vhForm.dotVaiId || (dotVaiList.length === 1 ? dotVaiList[0].dot_vai_ve_id : null),
        soLuong: qty,
        lyDo: vhForm.lyDo.trim() || null,
      });
      show('Đã ghi vải hủy');
      setVhForm({ dotVaiId: '', soLuong: '', lyDo: '' });
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Ghi vải hủy thất bại', 'error');
    } finally { setBusy(false); }
  };

  const doReprint = async () => {
    if (!reprintReason.trim()) { show('Nhập lý do in lại', 'error'); return; }
    setBusy(true);
    try {
      const res = await reprintTem(reprint.id, reprintReason.trim());
      show(`Đã hủy tem ${reprint.ma_tem} & in tem mới`);
      setReprint(null); setReprintReason('');
      await printLabelFor(res.data?.new_tem_id);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'In lại thất bại', 'error');
    } finally { setBusy(false); }
  };

  const doResume = async () => {
    setBusy(true);
    try {
      await resumeLine(phieu.id);
      show('Chuyền hoạt động lại');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally { setBusy(false); }
  };

  const target = Number(data?.lenh?.so_luong_release) || 0;
  const printed = Number(data?.printed) || 0;
  const pct = target ? Math.min(100, Math.round((printed / target) * 100)) : 0;
  const maxTotal = target ? Math.floor(target * 1.1) : 0;       // trần 110% SL release
  const minFinish = target ? Math.ceil(target * 0.9) : 0;       // tối thiểu 90% SL release (cho -10%) mới hoàn tất được
  const remain = target ? Math.max(0, maxTotal - printed) : null; // còn được in
  const overMax = target > 0 && Number(soLuong) > remain;

  return (
    <SidePanel
      open={!!lenhId}
      onClose={onClose}
      title={data?.lenh ? `Sản xuất — ${data.lenh.ma_lenh_san_xuat}` : 'Sản xuất'}
      subtitle={data?.lenh ? `Chuyền ${data.lenh.ma_chuyen || '—'} · Phần ${data.lenh.phan_list || '—'}` : ''}
      footer={
        running && canRun && (
          <Button variant="danger" onClick={doFinish} loading={busy} disabled={printed < minFinish}>
            Chạy hoàn tất
          </Button>
        )
      }
    >
      {loading || !data ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          <section>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-soft">Đã in</span>
              <span className="font-semibold text-ink">{fmtNum(printed)} / {fmtNum(target)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-soft">
              <span>Phiếu {phieu?.ma_phieu_san_xuat}</span>
              <Badge tone={running ? 'info' : 'success'}>{running ? 'Đang chạy' : 'Hoàn tất'}</Badge>
            </div>
            {running && canRun && printed < minFinish && (
              <p className="mt-2 text-xs text-amber-600">
                Cần in tối thiểu 90% SL release ({fmtNum(minFinish)}) mới hoàn tất được — còn thiếu <b>{fmtNum(minFinish - printed)}</b>.
              </p>
            )}
          </section>

          {running && canRun && (
            <section className="border-t border-line pt-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-ink">Số lượng in (1 tem)</label>
                  <Input type="number" max={remain || undefined} value={soLuong}
                    onChange={(e) => setSoLuong(e.target.value)} placeholder="vd: 200"
                    className={overMax ? 'border-danger focus:border-danger focus:ring-danger/10' : ''} />
                </div>
                <Button onClick={doPrint} loading={busy}
                  disabled={!soLuong || Number(soLuong) <= 0 || overMax || remain === 0}>In tem</Button>
              </div>
              {target > 0 && (
                <p className={`mt-1.5 text-xs ${overMax ? 'text-danger' : 'text-ink-soft'}`}>
                  Trần 110% SL release: tối đa {fmtNum(maxTotal)} · còn được in <b>{fmtNum(remain)}</b>
                  {overMax ? ' — vượt giới hạn!' : ''}
                </p>
              )}
            </section>
          )}

          {/* Ngừng chuyền (downtime) */}
          {running && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Ngừng chuyền</h3>
              {ngungActive ? (
                <div className="rounded-control border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm">
                  <div className="font-semibold text-rose-700">⏸ Chuyền đang ngừng</div>
                  <div className="mt-0.5 text-xs text-ink-soft">Từ {fmtDt(ngungActive.tg_bd_ngung)}</div>
                  {ngungActive.ly_do && <div className="mt-0.5 text-xs text-ink">Lý do: {ngungActive.ly_do}</div>}
                  {canRun && (
                    <Button className="mt-2 w-full" onClick={doResume} loading={busy}>Chuyền hoạt động lại</Button>
                  )}
                </div>
              ) : canRun ? (
                <div className="space-y-2">
                  <Textarea rows={2} value={stopReason} onChange={(e) => setStopReason(e.target.value)}
                    placeholder="Lý do ngừng chuyền (vd: hết mực, kẹt vải, đổi khuôn...)" />
                  <Button variant="danger" className="w-full" onClick={doStop} loading={busy} disabled={!stopReason.trim()}>
                    Ngừng chuyền
                  </Button>
                </div>
              ) : null}

              {ngungList.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium text-ink-soft">Lịch ngừng ({ngungList.length})</div>
                  <div className="space-y-1.5">
                    {ngungList.map((n) => (
                      <div key={n.id} className="rounded-control border border-line px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-ink">{fmtDt(n.tg_bd_ngung)}{n.tg_kt_ngung ? ` → ${fmtDt(n.tg_kt_ngung)}` : ''}</span>
                          {n.trang_thai === 'DANG_NGUNG'
                            ? <Badge tone="danger">Đang ngừng</Badge>
                            : <Badge tone="default">{fmtNum(n.so_phut)} phút</Badge>}
                        </div>
                        {n.ly_do && <div className="mt-0.5 text-xs text-ink-soft">Lý do: {n.ly_do}{n.nguoi ? ` · ${n.nguoi}` : ''}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Ngừng lệnh chạy để in hàng gấp hơn (khác với "Ngừng chuyền" downtime) */}
          {running && canRun && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Ngừng lệnh chạy (in hàng gấp)</h3>
              <p className="mb-2 text-xs text-ink-soft">
                Ngừng phần in này để chạy phần in cần giao gấp hơn. Tem đã in <b>giữ nguyên</b>; lệnh quay về
                <b> chờ chạy</b> để lập lại kế hoạch (không cần test lại). Có thể <b>hoán đổi</b> ngay phần in đang chờ.
              </p>
              <Button variant="secondary" className="w-full" onClick={openPause} disabled={busy}>
                Ngừng lệnh chạy…
              </Button>
            </section>
          )}

          {/* Vải hủy trong sản xuất (theo phần in) */}
          <section className="border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Vải hủy (theo phần in)</h3>
            {canRun && phieu && (
              <div className="space-y-2">
                {dotVaiList.length > 1 && (
                  <Select value={vhForm.dotVaiId} onChange={(e) => setVhForm({ ...vhForm, dotVaiId: e.target.value })}>
                    <option value="">— Chọn phần in —</option>
                    {dotVaiList.map((d) => (
                      <option key={d.dot_vai_ve_id} value={d.dot_vai_ve_id}>
                        {d.ma_phan} · {d.mau_vai} · {d.kich_vai}/{d.kich_phim}
                      </option>
                    ))}
                  </Select>
                )}
                {dotVaiList.length === 1 && (
                  <div className="rounded-control bg-surface-muted px-3 py-1.5 text-xs text-ink-soft">
                    Phần in: <b className="text-ink">{dotVaiList[0].ma_phan}</b> · {dotVaiList[0].mau_vai}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-ink">Số lượng vải hủy</label>
                    <Input type="number" min="1" value={vhForm.soLuong}
                      onChange={(e) => setVhForm({ ...vhForm, soLuong: e.target.value })} placeholder="vd: 5" />
                  </div>
                  <Button variant="danger" onClick={doVaiHuy} loading={busy}
                    disabled={!vhForm.soLuong || Number(vhForm.soLuong) <= 0}>Ghi vải hủy</Button>
                </div>
                <Textarea rows={2} value={vhForm.lyDo} onChange={(e) => setVhForm({ ...vhForm, lyDo: e.target.value })}
                  placeholder="Lý do vải hủy (vd: lỗi vải, in hỏng, rách...)" />
              </div>
            )}
            {vaiHuyList.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-xs font-medium text-ink-soft">Đã ghi ({vaiHuyList.length})</div>
                {vaiHuyList.map((v) => (
                  <div key={v.id} className="rounded-control border border-line px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink">{v.ma_phan || '—'}{v.mau_vai ? ` · ${v.mau_vai}` : ''}</span>
                      <Badge tone="danger">{fmtNum(v.so_luong)}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-soft">
                      {v.nguoi ? `${v.nguoi} · ` : ''}{fmtDt(v.created_date)}{v.ly_do ? ` · ${v.ly_do}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Tem đã in ({data.tems.length})</h3>
              {data.tems.length > 0 && (
                <button onClick={openLogs} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Icon name="history" size={13} /> Lịch sử in
                </button>
              )}
            </div>
            {data.tems.length ? (
              <div className="space-y-1.5">
                {data.tems.map((t) => {
                  const huy = t.trang_thai === 'HUY';
                  return (
                    <div key={t.id}
                      className={`flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-sm ${huy ? 'border-line/60 bg-surface-muted/40 opacity-70' : 'border-line'}`}>
                      <span className={`flex items-center gap-1.5 font-medium ${huy ? 'text-ink-soft line-through' : 'text-ink'}`}>
                        {t.ma_tem}
                      </span>
                      <span className="text-ink-soft">{fmtNum(t.so_luong)}</span>
                      <div className="flex items-center gap-2">
                        <Badge tone={TEM_TONE[t.trang_thai] || 'default'}>{TEM_LABEL[t.trang_thai] || t.trang_thai}</Badge>
                        {canRun && !huy && (
                          <>
                            <button onClick={() => printLabelFor(t.id)} title="In lại tờ tem (giữ mã)"
                              className="text-ink-soft hover:text-primary"><Icon name="printer" size={15} /></button>
                            <button onClick={() => { setReprint(t); setReprintReason(''); }}
                              className="text-xs font-medium text-primary hover:underline">In lại</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Chưa in tem nào.</p>
            )}
          </section>
        </div>
      )}
      {/* Ngừng lệnh chạy + hoán đổi phần in gấp hơn */}
      <Modal open={pauseOpen} onClose={() => setPauseOpen(false)} title="Ngừng lệnh chạy — in hàng gấp" size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPauseOpen(false)}>Đóng</Button>
            <Button variant="danger" onClick={doPauseOnly} loading={busy}>Chỉ ngừng lệnh chạy</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30">
          Ngừng lệnh <b>{data?.lenh?.ma_lenh_san_xuat}</b> (đã in <b>{fmtNum(printed)}</b>/{fmtNum(target)}).
          Tem đã in đi tiếp <b>Chờ khô/kiểm</b> — số lượng giữ nguyên. Lệnh về <b>chờ chạy</b> để lập lại kế hoạch
          (không cần test lại). Chọn một phần in bên dưới để <b>hoán đổi</b> chạy ngay trên cùng chuyền.
        </div>
        <div className="mb-1 text-xs font-medium text-ink-soft">Đang chờ sản xuất — bấm để hoán đổi ({swapList.length})</div>
        {swapLoading ? (
          <div className="py-6 text-center text-sm text-ink-soft">Đang tải...</div>
        ) : swapList.length === 0 ? (
          <p className="py-4 text-sm text-ink-soft">Không có phần in nào đang chờ sản xuất để hoán đổi.</p>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {swapList.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge tone="info">{r.ma_lenh_san_xuat}</Badge>
                    <span className="truncate font-medium text-ink">{r.ten_khach_hang || '—'}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-soft">
                    {[r.ma_hang, r.mau_vai, r.kich_vai, r.kich_phim].filter(Boolean).join(' · ')}
                    {r.han_giao_hang ? ` · Hạn giao ${fmtDate(r.han_giao_hang)}` : ''}
                    {` · SL ${fmtNum(r.so_luong_release)}`}
                  </div>
                </div>
                <Button className="shrink-0 px-2.5 py-1 text-xs" onClick={() => doSwap(r)} loading={busy}>Hoán đổi</Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!reprint} onClose={() => setReprint(null)}
        title={reprint ? `In lại tem ${reprint.ma_tem}` : 'In lại tem'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReprint(null)}>Hủy</Button>
            <Button onClick={doReprint} loading={busy} disabled={!reprintReason.trim()}>In lại tem</Button>
          </>
        }
      >
        <div className="mb-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30">
          Sẽ <b>HỦY tem {reprint?.ma_tem}</b> (gỡ khỏi xe phơi) và tạo <b>tem mới</b> có mã/barcode mới để in lại.
        </div>
        <Textarea rows={3} value={reprintReason} onChange={(e) => setReprintReason(e.target.value)}
          placeholder="Lý do in lại (vd: tem rách, in mờ, mất tem...)" />
      </Modal>

      <Modal open={logsOpen} onClose={() => setLogsOpen(false)} title="Lịch sử in tem" size="lg"
        footer={<Button variant="ghost" onClick={() => setLogsOpen(false)}>Đóng</Button>}
      >
        {temLogs.length === 0 ? (
          <p className="text-sm text-ink-soft">Chưa có lượt in nào.</p>
        ) : (
          <div className="space-y-1.5">
            {temLogs.map((l) => {
              const huy = l.tem_trang_thai === 'HUY';
              return (
                <div key={l.id} className={`flex items-center justify-between rounded-control border px-3 py-2 text-sm ${huy ? 'border-danger/30 bg-danger/5' : 'border-line'}`}>
                  <span className={`flex items-center gap-2 font-medium ${huy ? 'text-ink-soft line-through' : 'text-ink'}`}>
                    {l.ma_tem}
                    {l.so_lan_in > 1 ? <Badge tone="warning">In lại lần {l.so_lan_in}</Badge> : <Badge tone="info">In lần đầu</Badge>}
                    {huy && <Badge tone="danger">Đã hủy</Badge>}
                  </span>
                  <div className="text-right text-xs text-ink-soft">
                    <div>{l.nguoi || '—'} · {fmtDt(l.tg_in)}</div>
                    {l.ly_do_in_lai && <div className="text-danger">Lý do in lại: {l.ly_do_in_lai}</div>}
                    {huy && (l.tg_huy || l.nguoi_huy || l.ly_do_huy) && (
                      <div className="mt-0.5 text-danger">
                        Hủy in tem{l.nguoi_huy ? ` · ${l.nguoi_huy}` : ''}{l.tg_huy ? ` · ${fmtDt(l.tg_huy)}` : ''}
                        {l.ly_do_huy ? <div>Lý do hủy: {l.ly_do_huy}</div> : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Toast toast={toast} />
    </SidePanel>
  );
}
