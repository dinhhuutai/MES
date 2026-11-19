// ─────────────────────────────────────────────────────────────────────────────
// QUẢN TRỊ PHẦN IN › THÊM 1 CÔNG ĐOẠN + ĐẶT CÔNG ĐOẠN MỚI VÀO MÀN NÀO (19/11/2026, người dùng chốt).
//   · In thường + Ép/Logo ⇒ In + Logo · In kiếng + Ép ⇒ kiếng ủi · Logo + In ⇒ In + Logo (lệnh Logo đang có thành công đoạn
//     Logo) — `utils/luongSanXuat.luongSauKhiThem`.
//   · Màn đích: Release 1 (Kế hoạch tự lập) · READY (KT / QA xác nhận lại — chỉ khi phần in chưa có lệnh) · Test Run (chỉ
//     công đoạn In) · Chờ chạy — 2 màn sau lập lệnh ngay (chuyền / ngày / giờ / SL / thợ in).
//   · Mở modal ⇒ BE dựng kế hoạch (`xemTruoc`, dựng lại khi đổi thứ tự công đoạn); có dòng CHẶN thì không bấm được. Luật: BE
//     `phaninadmin.service themCongDoan`.
// ⚠ Component con khai ở MỨC MODULE (luật §9).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import Spinner from '../../../components/common/Spinner';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import TimeSelect from '../../../components/common/TimeSelect';
import NhieuNguoiSelect from '../../../components/common/NhieuNguoiSelect';
import { Field, Input, Textarea } from '../../../components/common/controls';
import { PHUONG_AN_IN } from '../../../components/common/PhuongAnInBadge';
import { fmtNum, ngayLocalISO } from '../../../utils/format';
import { GD_IN, giaCongDuoc } from '../../../utils/luongSanXuat';
import { laChuyenGiaCong } from '../../planning/utils/chuyenGiaCong';
import { themCongDoanQt } from '../../../services/quanTriPhanInService';
import { TEN_TT_LENH } from './QuanTriToanCanh';

const mkTs = (ngay, gio) => (ngay && gio ? `${ngay}T${gio}:00` : null);
const LAP_LENH = new Set(['TEST_RUN', 'CHO_CHAY']);

function moTaDich(v, ke) {
  const cd = ke.nhan_them;
  if (v === 'RELEASE_1') return `Đợt đã Ready hiện thêm dòng ${cd} ở Release 1 — Kế hoạch tự lập lệnh.`;
  if (v === 'READY') return 'Đưa các đợt vải về READY để Kỹ thuật / QA xác nhận lại rồi mới lập kế hoạch.';
  if (v === 'TEST_RUN') return `Lập lệnh ${cd} ngay — vào Test Run chờ QA test.`;
  return ke.them === GD_IN
    ? 'Lập lệnh In ngay và bỏ qua Test Run (quản trị, có ghi vết) — vào thẳng Chờ chạy.'
    : `Lập lệnh ${cd} ngay — vào thẳng Chờ chạy.`;
}
const DICH = [
  { v: 'RELEASE_1', ten: 'Release 1' }, { v: 'READY', ten: 'READY' },
  { v: 'TEST_RUN', ten: 'Test Run' }, { v: 'CHO_CHAY', ten: 'Chờ chạy' },
];

function viecLenh(l, ke) {
  const v = [];
  if (l.doi_gd) v.push(`thành lệnh công đoạn ${ke.nhan_giu}`);
  if (l.viec === 'DOI') v.push(l.dau ? 'thành công đoạn đầu — tem in sau không vào KCS' : 'thôi là công đoạn đầu');
  if (l.viec === 'GIU') v.push(`đã in ${fmtNum(l.so_tem)} tem — giữ đi KCS (tem đã in không kéo lại)`);
  if (l.nha_tem > 0) v.push(`${l.nha_tem} tem chờ công đoạn sau → vào KCS`);
  return v.length ? v.join(' · ') : 'giữ nguyên';
}

function KhoiBao({ ds, loai }) {
  const cls = loai === 'chan'
    ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300';
  return (ds || []).map((c) => (
    <p key={c} className={`rounded-control border px-3 py-2 text-xs ${cls}`}>{loai === 'chan' ? '⛔' : '⚠'} {c}</p>
  ));
}

function TheChon({ chon, tat, onChon, ten, moTa, lyDoKhong }) {
  return (
    <label className={`flex flex-col gap-1 rounded-control border px-3 py-2 text-sm transition
      ${tat ? 'cursor-not-allowed border-line opacity-60' : 'cursor-pointer'}
      ${chon ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : !tat ? 'border-line hover:border-primary/40' : ''}`}>
      <span className="flex items-center gap-2 font-medium text-ink">
        <input type="radio" className="h-4 w-4 accent-primary" checked={chon} disabled={tat} onChange={onChon} />
        {ten}
      </span>
      <span className="text-xs leading-snug text-ink-soft">{tat ? lyDoKhong : moTa}</span>
    </label>
  );
}

export default function ThemCongDoanModal({ phanInId, mo, onClose, onDone, show, chuyen, users }) {
  const [epTruoc, setEpTruoc] = useState(false);
  const [ke, setKe] = useState(null);
  const [dangXem, setDangXem] = useState(false);
  const [dich, setDich] = useState('RELEASE_1');
  const [readyKieu, setReadyKieu] = useState('READY_QA');
  const [paIn, setPaIn] = useState('');
  const [chonDot, setChonDot] = useState(new Set());
  const [f, setF] = useState({ chuyenId: '', ngay: ngayLocalISO(new Date()), gioBd: '', gioKt: '', soLuong: '', thoIn: '' });
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mo) return;
    setEpTruoc(false); setKe(null); setDich('RELEASE_1'); setReadyKieu('READY_QA'); setPaIn(''); setLyDo('');
    setF({ chuyenId: '', ngay: ngayLocalISO(new Date()), gioBd: '', gioKt: '', soLuong: '', thoIn: '' });
  }, [mo, phanInId]);
  useEffect(() => {
    if (!mo || !phanInId) return undefined;
    let song = true;
    setDangXem(true);
    themCongDoanQt(phanInId, { xemTruoc: true, epTruoc })
      .then((r) => {
        if (!song) return;
        const d = r.data;
        setKe(d);
        setChonDot(new Set((d.dot || []).filter((x) => x.lap_duoc).map((x) => x.id)));
        if (d.can_pa_in) setPaIn((p) => p || String(d.goi_y_pa || ''));
      })
      .catch((e) => { if (song) { setKe(null); show(e.message || 'Không dựng được kế hoạch', 'error'); } })
      .finally(() => { if (song) setDangXem(false); });
    return () => { song = false; };
  }, [mo, phanInId, epTruoc, show]);

  // Công đoạn không gia công được (Ép/Logo, kiếng) ⇒ bỏ chuyền gia công khỏi danh sách (BE cũng chặn 422 `KHONG_GIA_CONG`).
  const dsChuyen = useMemo(() => {
    if (!ke || giaCongDuoc(ke.luong_moi, ke.them)) return chuyen || [];
    return (chuyen || []).filter((c) => !laChuyenGiaCong(chuyen, c.id));
  }, [chuyen, ke]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const lapLenh = LAP_LENH.has(dich);
  const dotLap = (ke?.dot || []).filter((d) => d.lap_duoc);
  const tongChon = dotLap.filter((d) => chonDot.has(d.id)).reduce((s, d) => s + d.sl_moi, 0);
  const chan = ke?.chan || [];
  const dichKhong = ke?.dich_khong?.[dich];
  const thieu = !ke || chan.length > 0 || !!dichKhong || !lyDo.trim()
    || (ke.can_pa_in && !paIn)
    || (lapLenh && (!f.chuyenId || !f.ngay || !chonDot.size));

  const lam = async () => {
    setBusy(true);
    try {
      const r = await themCongDoanQt(phanInId, {
        epTruoc, dich, readyKieu, lyDo: lyDo.trim(), ...(ke.can_pa_in ? { paIn: Number(paIn) } : {}),
        ...(lapLenh ? {
          dotVaiIds: [...chonDot], chuyenId: f.chuyenId, ngayKeHoach: f.ngay, tgBdKh: mkTs(f.ngay, f.gioBd),
          tgKtKh: mkTs(f.ngay, f.gioKt), soLuong: f.soLuong === '' ? null : Number(f.soLuong), thoIn: f.thoIn,
        } : {}),
      });
      const k = r.data?.ket_qua || {};
      const phan = [];
      if (k.lenh_doi_gd?.length) phan.push(`${k.lenh_doi_gd.join(', ')} thành lệnh ${r.data.nhan_giu}`);
      if (k.dich?.lenh?.length) phan.push(`lập ${k.dich.lenh.map((l) => `${l.ma} (${TEN_TT_LENH[l.trang_thai] || l.trang_thai})`).join(', ')}`);
      if (k.dich?.dot_ready?.length) phan.push(`${k.dich.dot_ready.length} đợt về READY`);
      if (k.tem_nha_kcs) phan.push(`${k.tem_nha_kcs} tem vào KCS`);
      if (k.hskt?.doi) phan.push(`PA hồ sơ → ${PHUONG_AN_IN[k.hskt.phuong_an_in]}`);
      const loi = [k.dich?.loi && `chưa đặt được vào màn đích: ${k.dich.loi}`, k.hskt && !k.hskt.doi && `chưa đổi được PA hồ sơ: ${k.hskt.loi}`].filter(Boolean);
      show([r.message || 'Đã thêm công đoạn', ...phan, ...loi].join(' · '), loi.length ? 'error' : undefined);
      onDone();
    } catch (e) { show(e.message || 'Thêm công đoạn thất bại', 'error'); } finally { setBusy(false); }
  };

  const nhanIn = ke ? (ke.them === GD_IN ? ke.nhan_them : ke.nhan_giu) : 'In';
  const nhanEp = ke ? (ke.them === GD_IN ? ke.nhan_giu : ke.nhan_them) : 'Ép/Logo';
  return (
    <Modal open={!!mo} onClose={onClose} size="lg" title={ke ? `Thêm công đoạn ${ke.nhan_them} — ${ke.ma_phan}` : 'Thêm công đoạn'}
      footer={(
        <>
          <Button chiXemOk variant="secondary" onClick={onClose}>Đóng</Button>
          <Button loading={busy} disabled={thieu || busy || dangXem} onClick={lam}>
            {ke ? `Thêm công đoạn ${ke.nhan_them}` : 'Thêm công đoạn'}
          </Button>
        </>
      )}>
      {!ke ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className={`space-y-4 ${dangXem ? 'opacity-60' : ''}`}>
          <div className="rounded-control bg-surface-muted px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink-soft">Luồng</span>
              <Badge tone="default">{ke.ten_luong_cu}</Badge>
              <span className="text-ink-soft">→</span>
              <Badge tone="warning">{ke.ten_luong_moi}</Badge>
            </div>
          </div>
          <KhoiBao ds={chan} loai="chan" />
          <KhoiBao ds={ke.canh_bao} loai="canh_bao" />

          <Field label="Thứ tự công đoạn" hint="Tem công đoạn đầu không vào KCS — chỉ tem công đoạn sau đi KCS → OQC → giao">
            <div className="grid gap-2 sm:grid-cols-2">
              {[false, true].map((v) => (
                <TheChon key={String(v)} chon={epTruoc === v} onChon={() => setEpTruoc(v)}
                  ten={v ? `${nhanEp} trước → ${nhanIn} sau` : `${nhanIn} trước → ${nhanEp} sau`}
                  moTa={v ? `Công đoạn đầu: ${nhanEp}` : `Công đoạn đầu: ${nhanIn} (mặc định)`} />
              ))}
            </div>
          </Field>

          <Field label={`Đặt công đoạn ${ke.nhan_them} vào màn`} required>
            <div className="grid gap-2 sm:grid-cols-2">
              {DICH.map((o) => (
                <TheChon key={o.v} chon={dich === o.v} tat={!!ke.dich_khong?.[o.v]} lyDoKhong={ke.dich_khong?.[o.v]}
                  onChon={() => setDich(o.v)} ten={o.ten} moTa={moTaDich(o.v, ke)} />
              ))}
            </div>
          </Field>

          {dich === 'READY' && (
            <Field label="Đưa về READY để">
              <div className="grid gap-2 sm:grid-cols-2">
                <TheChon chon={readyKieu === 'READY_QA'} onChon={() => setReadyKieu('READY_QA')} ten="Chỉ QA xác nhận lại"
                  moTa="Giữ Khuôn / Film / Mực đã xác nhận, hủy QC READY của các đợt" />
                <TheChon chon={readyKieu === 'READY_KT'} onChon={() => setReadyKieu('READY_KT')} ten="Kỹ thuật làm lại"
                  moTa="Hủy cả Khuôn / Film / Mực + QC — kỹ thuật chuẩn bị lại từ đầu" />
              </div>
            </Field>
          )}

          {lapLenh && (
            <div className="space-y-3 rounded-control border border-line p-3">
              <div className="text-sm font-semibold text-ink">Kế hoạch lệnh {ke.nhan_them}</div>
              <Field label="Chuyền kế hoạch" required>
                <ChuyenPicker chuyen={dsChuyen} value={f.chuyenId} onChange={(id) => set('chuyenId', id)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Ngày SX kế hoạch" required>
                  <Input type="date" value={f.ngay} onChange={(e) => set('ngay', e.target.value)} />
                </Field>
                <Field label="Giờ bắt đầu"><TimeSelect value={f.gioBd} onChange={(v) => set('gioBd', v)} minuteStep={5} /></Field>
                <Field label="Giờ kết thúc"><TimeSelect value={f.gioKt} onChange={(v) => set('gioKt', v)} minuteStep={5} /></Field>
              </div>
              <Field label="SL release" hint={`Trống = hết phần của các đợt đã chọn (${fmtNum(tongChon)})`}>
                <Input type="number" min={1} max={tongChon || undefined} value={f.soLuong} onChange={(e) => set('soLuong', e.target.value)} />
              </Field>
              <Field label="Thợ in kế hoạch">
                <NhieuNguoiSelect value={f.thoIn} onChange={(v) => set('thoIn', v)} options={users} placeholder="Gõ tên hoặc MSNV để tìm rồi chọn / Enter..." />
              </Field>
            </div>
          )}

          <div className="rounded-control border border-line">
            <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">
              Đợt vải — phần của công đoạn {ke.nhan_them}{lapLenh ? ' (tích đợt lập lệnh)' : ''}
            </div>
            {!ke.dot.length ? <p className="px-3 py-2 text-sm text-ink-soft">Phần in không còn đợt vải sống.</p> : (
              <ul className="divide-y divide-line">
                {ke.dot.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm">
                    {lapLenh && (
                      <input type="checkbox" className="h-4 w-4 accent-primary" disabled={!d.lap_duoc} checked={chonDot.has(d.id)}
                        onChange={() => setChonDot((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} />
                    )}
                    <b className="text-ink">{d.ma_dot_vai}</b>
                    <span className="text-xs text-ink-soft">{d.loai || '—'} · vải {fmtNum(d.so_luong)}</span>
                    <Badge tone={d.ready ? 'success' : 'default'}>{d.ready ? 'Đã Ready' : 'Chưa Ready'}</Badge>
                    <span className="ml-auto text-xs tabular-nums text-ink">
                      {d.thuoc ? `${ke.nhan_them}: ${fmtNum(d.sl_moi)}` : `không thuộc công đoạn ${ke.nhan_them}`}
                    </span>
                    {d.ma_lenh && <span className="w-full text-xs text-ink-soft">Lệnh {ke.nhan_giu}: {d.ma_lenh}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-control border border-line">
            <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">Lệnh đang có — công đoạn {ke.nhan_giu}</div>
            {!ke.lenh.length && !ke.kht_doi_gd ? <p className="px-3 py-2 text-sm text-ink-soft">Chưa có lệnh nào.</p> : (
              <ul className="divide-y divide-line">
                {ke.lenh.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 text-sm">
                    <b className="text-ink">{l.ma}</b>
                    <span className="text-xs text-ink-soft">{TEN_TT_LENH[l.trang_thai] || l.trang_thai}{l.ma_chuyen ? ` · ${l.ma_chuyen}` : ''}</span>
                    <span className={`text-xs ${l.viec === 'GIU' ? 'text-amber-700 dark:text-amber-300' : 'text-ink-soft'}`}>— {viecLenh(l, ke)}</span>
                  </li>
                ))}
                {ke.kht_doi_gd > 0 && (
                  <li className="px-3 py-1.5 text-sm text-ink-soft">{ke.kht_doi_gd} kế hoạch tạm — thành kế hoạch tạm công đoạn {ke.nhan_giu}</li>
                )}
              </ul>
            )}
          </div>

          {ke.can_pa_in && (
            <Field label="Phương án in của công đoạn In" required
              hint={`Hồ sơ ${ke.hskt?.barcode_hskt || ''} đang ${PHUONG_AN_IN[ke.hskt?.phuong_an_in] || '—'} — công đoạn In đọc PA hồ sơ (gợi ý theo SL vải: ${PHUONG_AN_IN[ke.goi_y_pa] || '—'})`}>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((p) => (
                  <label key={p} className={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-1.5 text-sm ${String(p) === paIn ? 'border-primary bg-primary/5' : 'border-line'}`}>
                    <input type="radio" className="h-4 w-4 accent-primary" checked={String(p) === paIn} onChange={() => setPaIn(String(p))} />
                    {PHUONG_AN_IN[p]}
                  </label>
                ))}
              </div>
            </Field>
          )}

          <Field label="Lý do" required hint="Ghi vào nhật ký đổi luồng + lệnh / đợt được đặt vào màn đích">
            <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Vd: hàng cần thêm công đoạn logo sau khi in" />
          </Field>
        </div>
      )}
    </Modal>
  );
}
