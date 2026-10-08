import { useCallback, useEffect, useState } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import SearchableSelect from '../../../components/common/SearchableSelect';
import TimeSelect from '../../../components/common/TimeSelect';
import { Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  getRun, printTemBatch, getTemLabel, savePhanCong, listToIn, listLyDoNgung, stopLine, resumeLine,
} from '../../../services/productionService';
import { listUserOptions } from '../../../services/userService';
import printTemLabel, { printTemLabelNhieu, moSanCuaSoIn, dongCuaSoIn } from '../utils/printTemLabel';
import { fmtNum } from '../../../utils/format';
import { TemMetaFields, PhanCongInline, META_MAC_DINH, metaGuiDi, gioHienTai } from './RunPanel';

// ─────────────────────────────────────────────────────────────────────────────
// SẢN XUẤT NHIỀU LỆNH CÙNG LÚC (08/10/2026, người dùng chốt) — mở từ nút "Mở (N)" của bảng Đang chạy khi đã
// quét/tích ≥ 2 lệnh (1 lệnh ⇒ `RunPanel` như cũ). Mỗi lệnh vẫn là 1 phiếu riêng; panel làm 1 lần cho TẤT CẢ:
//   · IN TEM: modal danh sách phần in (Đơn hàng → Kích phim + ô Số lượng) ⇒ 1 nút in mọi dòng có số lượng
//     (dòng để trống bỏ qua), 1 dòng = 1 tem ⇒ `printTemBatch` từng phiếu (giữ trần 110% lệnh/đợt, xin mã ERP
//     trước transaction) ⇒ MỌI tem in trong 1 cửa sổ mở sẵn ngay trong cú bấm, mỗi tem 1 tờ cặp 15 | 16
//     (`printTemLabelNhieu` = bố cục SX). Lệnh gom set cũ (nhiều phần in / 1 lệnh) tách 1 dòng / đợt vải.
//     Phiếu lỗi không chặn phiếu khác: tem đã tạo vẫn in, dòng lỗi giữ số để sửa.
//   · PHÂN CÔNG: lưu 1 lần ⇒ `savePhanCong` mọi phiếu.
//   · NGỪNG CHUYỀN: ghi 1 lần ⇒ `stopLine` mọi phiếu chưa ngừng; "Hoạt động lại" ⇒ `resumeLine` mọi phiếu đang ngừng.
//   · Việc riêng từng lệnh (vải hủy/thiếu, bổ sung, tem đã in, đổi chuyền, trả về KT, chạy hoàn tất) ⇒ nút "Mở".
// ─────────────────────────────────────────────────────────────────────────────

const numCls = 'w-24 rounded-control border border-line bg-surface px-2 py-1.5 text-right text-base md:text-sm text-ink outline-none focus:border-primary';
const TH = 'whitespace-nowrap px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft';
const TD = 'whitespace-nowrap px-2.5 py-2 text-sm text-ink';
const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

const dangChay = (run) => run?.phieu?.trang_thai === 'DANG_CHAY';
// Còn in được của LỆNH (trần 110% SL release, trừ đã in). Không có SL release ⇒ null (không chặn).
const conDuocIn = (run) => {
  const target = Number(run?.lenh?.so_luong_release) || 0;
  return target > 0 ? Math.max(0, Math.floor(target * 1.1) - (Number(run.printed) || 0)) : null;
};
const tenLenh = (run) => run?.lenh?.phan_list || run?.lenh?.ma_lenh_san_xuat || '';
const khoaPc = (pc) => [pc?.ca_truong_id || '', pc?.chuyen_truong || '', pc?.tho_in || '', pc?.to_in_id || ''].join('|');

// Dòng in tem: lệnh thường ⇒ 1 dòng (không gửi đợt vải, như ô "Số lượng in" của RunPanel); lệnh gom set cũ ⇒
// 1 dòng / đợt vải (gửi `dotVaiId`, như modal In tem gom set).
function dongInTem(runs) {
  const out = [];
  runs.forEach((run) => {
    const dots = run.dot_vai || [];
    if (run.co_gom_set) {
      dots.forEach((d) => out.push({ key: `${run.lenh.id}|${d.dot_vai_ve_id}`, run, dotVaiId: d.dot_vai_ve_id, info: d,
        capDot: Math.floor((Number(d.sl_vao_sx) || 0) * 1.1) }));
    } else {
      out.push({ key: run.lenh.id, run, dotVaiId: null, info: dots[0] || {}, capDot: 0 });
    }
  });
  return out;
}

// ⚠ MỨC MODULE (không lồng trong panel) — lồng là ô nhập mất focus khi đang gõ (luật §9).
function InTemNhieuModal({ open, onClose, runs, meta, setMeta, goiY, busy, onIn }) {
  const [sl, setSl] = useState({}); // key dòng → số lượng (chuỗi)
  useEffect(() => { if (open) setSl({}); }, [open]);
  const dong = dongInTem(runs);
  const so = (k) => Math.max(0, Math.trunc(Number(sl[k]) || 0));
  // Trần: Σ dòng của 1 lệnh ≤ còn in được của lệnh; dòng đợt vải ≤ 110% SL vào SX của đợt (backend chặn lại y vậy).
  const tongLenh = (lenhId) => dong.filter((d) => d.run.lenh.id === lenhId).reduce((s, d) => s + so(d.key), 0);
  const vuot = (d) => {
    const con = conDuocIn(d.run);
    return (con != null && tongLenh(d.run.lenh.id) > con) || (d.capDot > 0 && so(d.key) > d.capDot);
  };
  const coSo = dong.filter((d) => so(d.key) > 0);
  const coVuot = coSo.some(vuot);
  const chiLuu = !!meta.btpTruoc;

  return (
    <Modal open={open} onClose={onClose} size="xl" title={`${chiLuu ? 'Lưu' : 'In tem'} — ${fmtNum(dong.length)} phần in`}
      footer={<>
        <Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>
        <Button icon={chiLuu ? 'save' : 'printer'} loading={busy} disabled={busy || !coSo.length || coVuot}
          onClick={() => onIn(coSo.map((d) => ({ ...d, soLuong: so(d.key) })))}>
          {chiLuu ? `Lưu ${fmtNum(coSo.length)} tem` : `In ${fmtNum(coSo.length)} tem`}
        </Button>
      </>}>
      <div className="mb-3"><TemMetaFields meta={meta} setMeta={setMeta} goiY={goiY} /></div>
      <div className="overflow-auto rounded-card border border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              {['STT', 'Đơn hàng', 'Mã hàng', 'Code phần', 'Màu vải', 'Kích vải', 'Kích phim'].map((h) => <th key={h} className={TH}>{h}</th>)}
              <th className={`${TH} text-right`}>Còn in được</th>
              <th className={`${TH} text-right`}>Số lượng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {dong.map((d, i) => {
              const con = conDuocIn(d.run);
              return (
                <tr key={d.key}>
                  <td className={`${TD} text-center text-ink-soft`}>{i + 1}</td>
                  <td className={TD}>{d.info.ma_don_hang || '—'}</td>
                  <td className={TD}>{d.info.ma_hang || '—'}</td>
                  <td className={`${TD} font-medium`}>{d.info.ma_phan || tenLenh(d.run) || '—'}</td>
                  <td className={TD}>{d.info.mau_vai || '—'}</td>
                  <td className={TD}>{d.info.kich_vai || '—'}</td>
                  <td className={TD}>{d.info.kich_phim || '—'}</td>
                  <td className={`${TD} text-right tabular-nums text-ink-soft`}>{con == null ? '—' : fmtNum(con)}</td>
                  <td className={`${TD} text-right`}>
                    <input type="number" min="0" value={sl[d.key] || ''} placeholder="0"
                      onChange={(e) => setSl((s) => ({ ...s, [d.key]: e.target.value }))}
                      className={`${numCls} ${vuot(d) ? 'border-danger focus:border-danger' : ''}`} />
                    {vuot(d) && <div className="mt-0.5 text-[11px] text-danger">Vượt phần còn in được</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default function RunNhieuPanel({ lenhIds, onClose, onChanged, onMoLenh }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canRun = can('PROD_RUN');
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [temMeta, setTemMeta] = useState(META_MAC_DINH());
  const [inOpen, setInOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [toInDs, setToInDs] = useState([]);
  const [lyDoNgungDs, setLyDoNgungDs] = useState([]);
  const [stop, setStop] = useState({ lyDoId: '', ghiChu: '', gioBd: '', gioKt: '' });
  const [gioHoatDongLai, setGioHoatDongLai] = useState('');
  const khoaLenh = (lenhIds || []).join(',');

  const load = useCallback(async () => {
    const ids = khoaLenh ? khoaLenh.split(',') : [];
    if (!ids.length) return;
    setLoading(true);
    try {
      const ds = await Promise.all(ids.map(async (id) => {
        try { return (await getRun(id)).data; } catch (e) { return { loi: e.message || 'Lỗi tải', lenh: { id } }; }
      }));
      setRuns(ds);
      const g = (ds.find(dangChay) || {}).goi_y_tem;
      if (g) setTemMeta((m) => ({ ...m, ngayCa: m.ngayCa || g.ngay_ca || '', gioBd: m.gioBd || g.gio_bd || '', gioKt: m.gioKt || g.gio_kt || '' }));
    } finally {
      setLoading(false);
    }
  }, [khoaLenh]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setTemMeta((m) => (m._suaGioKt || m.gioKt === gioHienTai() ? m : metaGuiDi(m))), 20000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    listUserOptions({ limit: 500 }).then((r) => setUsers(r.data || [])).catch(() => {});
    listToIn().then((r) => setToInDs(r.data || [])).catch(() => setToInDs([]));
    listLyDoNgung().then((r) => setLyDoNgungDs(r.data || [])).catch(() => setLyDoNgungDs([]));
  }, []);

  const chay = runs.filter(dangChay);
  const dangNgung = chay.filter((r) => r.ngung_active);
  const chuaNgung = chay.filter((r) => !r.ngung_active);
  const chiLuu = !!temMeta.btpTruoc;

  // Làm 1 việc cho nhiều phiếu, TUẦN TỰ; lỗi phiếu nào báo phiếu đó (phiếu khác vẫn làm). Trả số phiếu lỗi.
  const lamTungPhieu = async (ds, viec, nhanXong) => {
    setBusy(true);
    const loi = [];
    for (const r of ds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await viec(r);
      } catch (e) { loi.push(`${tenLenh(r)}: ${e.message || 'lỗi'}`); }
    }
    setBusy(false);
    if (loi.length) show(`${nhanXong} — lỗi ở ${loi.length}/${ds.length} lệnh: ${loi.join(' · ')}`, 'error');
    else show(`${nhanXong} cho ${fmtNum(ds.length)} lệnh`);
    await load();
    onChanged?.();
    return loi.length;
  };

  const doSavePhanCong = async (body) => (await lamTungPhieu(chay, (r) => savePhanCong(r.phieu.id, body), 'Đã lưu phân công')) === 0;

  const doStop = async () => {
    if (!stop.lyDoId && !stop.ghiChu.trim()) {
      show(lyDoNgungDs.length ? 'Chọn lý do ngừng chuyền' : 'Nhập lý do ngừng chuyền', 'error');
      return;
    }
    const n = await lamTungPhieu(chuaNgung,
      (r) => stopLine(r.phieu.id, stop.ghiChu.trim(), stop.gioBd || null, stop.lyDoId || null, stop.gioKt || null),
      stop.gioKt ? `Đã ghi ngừng chuyền ${stop.gioBd || 'bây giờ'} → ${stop.gioKt}` : 'Đã ngừng chuyền');
    if (!n) setStop({ lyDoId: '', ghiChu: '', gioBd: '', gioKt: '' });
  };
  const doResume = async () => {
    const n = await lamTungPhieu(dangNgung, (r) => resumeLine(r.phieu.id, gioHoatDongLai || null), 'Chuyền hoạt động lại');
    if (!n) setGioHoatDongLai('');
  };

  // In nhãn mọi tem vào cửa sổ `w` mở sẵn. Lỗi in chỉ báo — tem đã tạo, in lại ở "Tem đã in" của từng lệnh.
  const inNhan = async (tems, w) => {
    if (!tems.length) { dongCuaSoIn(w); return; }
    try {
      const labels = await Promise.all(tems.map(async (t) => (await getTemLabel(t.tem_id, t.dot_vai_id || null)).data));
      if (labels.length === 1) await printTemLabel(labels[0], w);
      else await printTemLabelNhieu(labels, w);
    } catch (e) {
      dongCuaSoIn(w);
      show(`CHƯA in được nhãn tem: ${e.message || ''} — in lại ở "Tem đã in" của từng lệnh`, 'error');
    }
  };

  // `dong` = các dòng có số lượng của modal. ⚠ Mở SẴN cửa sổ in TRƯỚC mọi await (xin mã ERP xong mới mở là bị chặn popup).
  const doInNhieu = async (dong) => {
    let w = null;
    if (!chiLuu) {
      try { w = moSanCuaSoIn(); } catch (e) { show(e.message, 'error'); return; }
    }
    setBusy(true);
    // Gom theo phiếu, giữ thứ tự dòng ⇒ 1 lượt `printTemBatch` / phiếu.
    const theoPhieu = [];
    dong.forEach((d) => {
      let g = theoPhieu.find((x) => x.run === d.run);
      if (!g) { g = { run: d.run, items: [] }; theoPhieu.push(g); }
      g.items.push(d.dotVaiId ? { dotVaiId: d.dotVaiId, soLuong: d.soLuong } : { soLuong: d.soLuong });
    });
    const tems = [];
    const loi = [];
    const meta = metaGuiDi(temMeta);
    for (const g of theoPhieu) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await printTemBatch(g.run.phieu.id, g.items, meta);
        tems.push(...(res.data?.tems_in || []));
      } catch (e) {
        loi.push(`${tenLenh(g.run)}: ${e.message || 'lỗi'}`);
      }
    }
    try {
      if (!chiLuu) await inNhan(tems, w);
      if (tems.length) {
        show(`${chiLuu ? 'Đã lưu' : 'Đã in'} ${fmtNum(tems.length)} tem${chiLuu ? ' (BTP trước — không in nhãn)' : ''} — tự vào xe phơi${loi.length ? ` · LỖI: ${loi.join(' · ')}` : ''}`,
          loi.length ? 'error' : 'success');
      } else {
        show(`Chưa in được tem nào — ${loi.join(' · ')}`, 'error');
      }
      if (!loi.length) { setInOpen(false); setTemMeta(META_MAC_DINH()); }
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const pcDau = chay[0]?.phan_cong || null;
  const pcKhac = new Set(chay.map((r) => khoaPc(r.phan_cong))).size > 1;
  const dsChuyen = [...new Set(runs.map((r) => r?.lenh?.ma_chuyen).filter(Boolean))].join(', ') || '—';
  const tongTarget = runs.reduce((s, r) => s + (Number(r?.lenh?.so_luong_release) || 0), 0);
  const tongIn = runs.reduce((s, r) => s + (Number(r?.printed) || 0), 0);

  return (
    <SidePanel open={!!(lenhIds && lenhIds.length)} onClose={onClose}
      title={`Sản xuất — ${fmtNum(runs.length || (lenhIds || []).length)} lệnh`}
      subtitle={`Chuyền ${dsChuyen} · đã in ${fmtNum(tongIn)} / ${fmtNum(tongTarget)}`}>
      {loading && !runs.length ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          <section>
            <div className="overflow-hidden rounded-control border border-line">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line bg-surface-muted">
                    <th className={TH}>Code phần</th>
                    <th className={`${TH} text-right`}>Đã in / SL</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {runs.map((r) => (
                    <tr key={r.lenh.id}>
                      <td className="px-2.5 py-2 text-sm text-ink">
                        <div className="font-medium">{tenLenh(r) || '—'}</div>
                        <div className="text-xs text-ink-soft">
                          {[r.lenh.ma_lenh_san_xuat, r.phieu?.ma_phieu_san_xuat, r.lenh.ma_chuyen].filter(Boolean).join(' · ')}
                          {r.loi && <span className="text-danger"> · {r.loi}</span>}
                        </div>
                        {r.phieu && !dangChay(r) && <Badge tone="success">Đã hoàn tất</Badge>}
                        {r.ngung_active && <Badge tone="danger">Đang ngừng</Badge>}
                      </td>
                      <td className="px-2.5 py-2 text-right text-sm tabular-nums text-ink">{fmtNum(r.printed)} / {fmtNum(r.lenh.so_luong_release)}</td>
                      <td className="px-2.5 py-2 text-right">
                        <Button chiXemOk variant="ghost" className="px-2 py-1 text-xs" onClick={() => onMoLenh?.(r.lenh.id)}>Mở</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {canRun && chay.length > 0 && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">{chiLuu ? 'Lưu (BTP trước)' : 'In tem'}</h3>
              <Button className="w-full" icon={chiLuu ? 'save' : 'printer'} onClick={() => setInOpen(true)} disabled={busy}>
                Nhập số lượng &amp; {chiLuu ? 'lưu' : 'in tem'} ({fmtNum(dongInTem(chay).length)} phần in)…
              </Button>
            </section>
          )}

          {chay.length > 0 && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Phân công ({fmtNum(chay.length)} lệnh)</h3>
              {pcKhac && <p className="mb-2 text-xs text-amber-600">Các lệnh đang có phân công khác nhau — lưu ở đây sẽ áp chung cho tất cả.</p>}
              <PhanCongInline pc={pcDau} users={users} toIns={toInDs} onSave={doSavePhanCong} busy={busy} canRun={canRun}
                thoInKh={chay[0]?.lenh?.tho_in_kh || ''} />
            </section>
          )}

          {chay.length > 0 && (
            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Ngừng chuyền</h3>
              {dangNgung.length > 0 && (
                <div className="mb-3 rounded-control border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm dark:border-rose-900/60 dark:bg-rose-950/30">
                  <div className="font-semibold text-rose-700 dark:text-rose-300">⏸ {fmtNum(dangNgung.length)}/{fmtNum(chay.length)} lệnh đang ngừng</div>
                  {dangNgung.map((r) => (
                    <div key={r.lenh.id} className="mt-0.5 text-xs text-ink-soft">
                      {tenLenh(r)} · từ {fmtDt(r.ngung_active.tg_bd_ngung)}{r.ngung_active.ly_do ? ` · ${r.ngung_active.ly_do}` : ''}
                    </div>
                  ))}
                  {canRun && (
                    <div className="mt-2 space-y-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-ink-soft">Giờ hoạt động lại (bỏ trống = bây giờ)</span>
                        <TimeSelect value={gioHoatDongLai} onChange={setGioHoatDongLai} minuteStep={1} />
                      </label>
                      <Button className="w-full" onClick={doResume} loading={busy}>Hoạt động lại ({fmtNum(dangNgung.length)} lệnh)</Button>
                    </div>
                  )}
                </div>
              )}
              {canRun && chuaNgung.length > 0 && (
                <div className="space-y-2">
                  {lyDoNgungDs.length > 0 && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">Lý do ngừng</span>
                      <SearchableSelect moNgay value={stop.lyDoId} onChange={(v) => setStop((s) => ({ ...s, lyDoId: v }))}
                        options={lyDoNgungDs} getValue={(l) => l.id} getLabel={(l) => l.ten_ly_do || ''}
                        getSearch={(l) => `${l.ten_ly_do || ''} ${l.ma_ly_do || ''}`}
                        placeholder="Bấm để xem danh sách, hoặc gõ để tìm..." emptyLabel="— Chọn lý do —" />
                    </label>
                  )}
                  <Textarea rows={2} value={stop.ghiChu} onChange={(e) => setStop((s) => ({ ...s, ghiChu: e.target.value }))}
                    placeholder={lyDoNgungDs.length ? 'Ghi chú thêm (tùy chọn)' : 'Lý do ngừng chuyền (vd: hết mực, kẹt vải, đổi khuôn...)'} />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">Giờ bắt đầu (trống = bây giờ)</span>
                      <TimeSelect value={stop.gioBd} onChange={(v) => setStop((s) => ({ ...s, gioBd: v }))} minuteStep={1} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">Giờ kết thúc (trống = chưa xong)</span>
                      <TimeSelect value={stop.gioKt} onChange={(v) => setStop((s) => ({ ...s, gioKt: v }))} minuteStep={1} />
                    </label>
                  </div>
                  <Button variant="danger" className="w-full" onClick={doStop} loading={busy}
                    disabled={lyDoNgungDs.length ? !stop.lyDoId : !stop.ghiChu.trim()}>
                    {stop.gioKt ? 'Ghi lần ngừng (đã kết thúc)' : 'Ngừng chuyền'} ({fmtNum(chuaNgung.length)} lệnh)
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
      <InTemNhieuModal open={inOpen} onClose={() => setInOpen(false)} runs={chay} meta={temMeta} setMeta={setTemMeta}
        goiY={chay[0]?.goi_y_tem} busy={busy} onIn={doInNhieu} />
      <Toast toast={toast} />
    </SidePanel>
  );
}
