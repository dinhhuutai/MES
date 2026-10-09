import { useEffect, useState, useCallback } from 'react';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import TimeSelect from '../../../components/common/TimeSelect';
import { Field, Input, Textarea } from '../../../components/common/controls';
import useSocketReload from '../../../hooks/useSocketReload';
import { fmtDateTime } from '../../../utils/format';
import { listSlaTheoGio, saveSlaTheoGio } from '../../../services/wfconfigService';

// ─────────────────────────────────────────────────────────────────────────────
// Khối "SLA theo giờ" (mig 109, 30/09/2026) — GHI CHÚ + SỬA 4 luật SLA không cố định (READY theo hạn giao,
// READY theo giờ lên MES, QC READY theo giờ KT xong, Test Run theo giờ SX). Nguồn luật BE
// `utils/slaTheoGio.js`; câu chữ ở đây DỰNG TỪ SỐ ĐANG CHẠY (kể cả SLA dự phòng của trạm/checklist) nên
// sửa số là ghi chú tự đổi theo — đừng viết cứng con số vào câu.
// ─────────────────────────────────────────────────────────────────────────────

const TIEU_DE = {
  QC_READY_THEO_GIO: 'QC READY — tính từ lúc Kỹ thuật xác nhận xong',
  READY_THEO_HAN_GIAO: 'READY Kỹ thuật (Khuôn / Film / Mực) — theo hạn giao của đợt',
  READY_THEO_GIO: 'READY Kỹ thuật — đợt không có hạn giao (theo giờ đợt lên MES)',
  TEST_RUN_THEO_GIO_SX: 'Test Run — theo giờ sản xuất kế hoạch',
};
const THU_TU = ['QC_READY_THEO_GIO', 'READY_THEO_HAN_GIAO', 'READY_THEO_GIO', 'TEST_RUN_THEO_GIO_SX'];

const hhmm = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const gio = (p) => { const x = ((p % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
function thoiLuong(phut) {
  const p = Number(phut) || 0;
  if (p < 60) return `${p} phút`;
  const h = Math.floor(p / 60); const m = p % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}
// Giờ "hành chính" đầu tiên (08:00 → 16:00) KHÔNG rơi vào khung nào — làm ví dụ cho SLA dự phòng.
function gioNgoaiKhung(khung) {
  for (let p = 480; p <= 960; p += 30) if (!khung.some((k) => p >= hhmm(k.tu) && p < hhmm(k.den))) return p;
  return null;
}

// Câu ghi chú của từng luật — dựng từ số đang chạy.
function ghiChu(it, duPhong) {
  const g = it.gia_tri || {};
  const ready = duPhong.find((d) => d.ma_tram === 'READY') || {};
  const test = duPhong.find((d) => d.ma_tram === 'TEST_RUN') || {};
  const dong = [];
  if (it.ma === 'QC_READY_THEO_GIO') {
    const qc = ready.qc_sla; const cb = ready.qc_cb;
    (g.khung || []).forEach((k) => dong.push(`KT xong từ ${k.tu} đến ${k.den === '24:00' ? '24:00 (hết ngày)' : k.den} ⇒ QC có ${thoiLuong(k.phut)} rồi mới báo nghẽn.`));
    dong.push(`Các giờ còn lại ⇒ SLA checklist "QC xác nhận": ${qc != null ? thoiLuong(qc) : 'chưa cấu hình'}${cb ? ` (vàng trước ${cb} phút)` : ''}.`);
    const vd = gioNgoaiKhung(g.khung || []);
    if (qc != null && vd != null) {
      dong.push(`Ví dụ: KT xong lúc ${gio(vd)} ⇒ ${cb ? `vàng lúc ${gio(vd + qc - cb)}, ` : ''}nghẽn lúc ${gio(vd + qc)} nếu QC chưa xác nhận.`);
    }
    dong.push('Tính theo giờ đồng hồ liên tục — không trừ giờ nghỉ trưa / ngoài ca.');
  } else if (it.ma === 'READY_THEO_HAN_GIAO') {
    dong.push(`Chưa xác nhận đủ mục KT ⇒ ĐỎ (nghẽn) từ 00:00 ngày (hạn giao − ${g.do_ngay}), VÀNG từ 00:00 ngày (hạn giao − ${g.vang_ngay}).`);
    dong.push(`Ví dụ hạn giao ngày 26 ⇒ vàng từ ngày ${26 - g.vang_ngay}, đỏ từ ngày ${26 - g.do_ngay}.`);
    dong.push('Đợt không có hạn giao ⇒ dùng luật "theo giờ đợt lên MES" bên dưới.');
  } else if (it.ma === 'READY_THEO_GIO') {
    (g.khung || []).forEach((k) => dong.push(`Đợt lên MES từ ${k.tu} đến ${k.den} ⇒ Kỹ thuật có ${thoiLuong(k.phut)}.`));
    dong.push(`Ngoài các khung trên ⇒ SLA checkpoint READY: ${ready.tram_sla != null ? thoiLuong(ready.tram_sla) : 'chưa cấu hình'}${ready.tram_cb ? ` (vàng trước ${ready.tram_cb} phút)` : ''}.`);
  } else if (it.ma === 'TEST_RUN_THEO_GIO_SX') {
    dong.push(`Nghẽn từ ${thoiLuong(g.truoc_sx_phut)} trước giờ SX kế hoạch; vàng từ ${thoiLuong(g.truoc_sx_phut + g.canh_bao_phut)} trước.`);
    if (g.toi_thieu_phut > 0) {
      dong.push(`Nhưng luôn có ít nhất ${thoiLuong(g.toi_thieu_phut)} kể từ lúc Release 1 đưa lệnh xuống rồi mới báo nghẽn (lệnh release sát hoặc trễ giờ SX).`);
      dong.push(`Lệnh bị Test Run trả về Kế hoạch ⇒ ${thoiLuong(g.toi_thieu_phut)} này tính lại từ lúc Kế hoạch xác nhận Release 1 lại.`);
    }
    dong.push(`Lệnh chưa đặt giờ SX ⇒ lấy ngày kế hoạch lúc ${g.gio_sx_mac_dinh}; không có cả ngày ⇒ SLA checkpoint TEST_RUN: ${test.tram_sla != null ? thoiLuong(test.tram_sla) : 'chưa cấu hình'}.`);
  }
  return dong;
}

function tatNoi(it, duPhong) {
  const ready = duPhong.find((d) => d.ma_tram === 'READY') || {};
  const test = duPhong.find((d) => d.ma_tram === 'TEST_RUN') || {};
  if (it.ma === 'QC_READY_THEO_GIO') return `Luật đang TẮT ⇒ QC luôn dùng SLA checklist "QC xác nhận" (${ready.qc_sla != null ? thoiLuong(ready.qc_sla) : 'chưa cấu hình'}).`;
  if (it.ma === 'READY_THEO_HAN_GIAO') return 'Luật đang TẮT ⇒ mọi đợt tính theo giờ đợt lên MES.';
  if (it.ma === 'READY_THEO_GIO') return `Luật đang TẮT ⇒ dùng SLA checkpoint READY (${ready.tram_sla != null ? thoiLuong(ready.tram_sla) : 'chưa cấu hình'}).`;
  return `Luật đang TẮT ⇒ dùng SLA checkpoint TEST_RUN (${test.tram_sla != null ? thoiLuong(test.tram_sla) : 'chưa cấu hình'}).`;
}

// Ô "đến": giờ thường hoặc 24:00 (hết ngày) — TimeSelect không có 24h.
function DenGio({ value, onChange }) {
  const hetNgay = value === '24:00';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hetNgay && <TimeSelect value={value} onChange={onChange} />}
      <label className="flex items-center gap-1.5 text-sm text-ink-soft">
        <input type="checkbox" checked={hetNgay} onChange={(e) => onChange(e.target.checked ? '24:00' : '23:00')} />
        Hết ngày (24:00)
      </label>
    </div>
  );
}

function SuaModal({ it, onClose, onSaved }) {
  const [bat, setBat] = useState(it.bat);
  const [g, setG] = useState(() => JSON.parse(JSON.stringify(it.gia_tri)));
  const [note, setNote] = useState(it.ghi_chu || '');
  const [saving, setSaving] = useState(false);
  const [loi, setLoi] = useState('');
  const coKhung = it.ma === 'READY_THEO_GIO' || it.ma === 'QC_READY_THEO_GIO';

  const datKhung = (i, patch) => setG((x) => ({ ...x, khung: x.khung.map((k, j) => (j === i ? { ...k, ...patch } : k)) }));
  const save = async () => {
    setSaving(true); setLoi('');
    try {
      const giaTri = coKhung
        ? { khung: g.khung.map((k) => ({ ...k, phut: Number(k.phut) })) }
        : Object.fromEntries(Object.entries(g).map(([k, v]) => [k, k === 'gio_sx_mac_dinh' ? v : Number(v)]));
      const res = await saveSlaTheoGio(it.ma, { bat, giaTri, ghiChu: note.trim() || null });
      onSaved(res.data);
    } catch (e) { setLoi(e.message || 'Lưu thất bại'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Sửa luật SLA: ${TIEU_DE[it.ma]}`} size="lg"
      footer={<>
        <Button chiXemOk variant="ghost" onClick={onClose}>Hủy</Button>
        <Button variant="ghost" onClick={() => setG(JSON.parse(JSON.stringify(it.mac_dinh)))}>Về mặc định</Button>
        <Button onClick={save} loading={saving}>Lưu</Button>
      </>}>
      <label className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" checked={bat} onChange={(e) => setBat(e.target.checked)} />
        Bật luật này
      </label>

      {coKhung && (
        <div className="mb-4 space-y-2">
          {(g.khung || []).map((k, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-3">
              <Field label="Từ"><TimeSelect value={k.tu} onChange={(v) => datKhung(i, { tu: v })} /></Field>
              <Field label="Đến"><DenGio value={k.den} onChange={(v) => datKhung(i, { den: v })} /></Field>
              <div className="w-32">
                <Field label="Số phút" hint={k.phut ? thoiLuong(Number(k.phut)) : ''}>
                  <Input type="number" min="1" value={k.phut} onChange={(e) => datKhung(i, { phut: e.target.value })} />
                </Field>
              </div>
              <Button variant="ghost" className="mb-4 px-3 py-1.5" onClick={() => setG((x) => ({ ...x, khung: x.khung.filter((_, j) => j !== i) }))}>Xóa khung</Button>
            </div>
          ))}
          <Button variant="secondary" className="px-3 py-1.5" disabled={(g.khung || []).length >= 6}
            onClick={() => setG((x) => ({ ...x, khung: [...(x.khung || []), { tu: '08:00', den: '17:00', phut: 60 }] }))}>
            Thêm khung giờ
          </Button>
        </div>
      )}

      {it.ma === 'READY_THEO_HAN_GIAO' && (
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Đỏ từ 00:00 ngày (hạn − N)" hint="N ngày"><Input type="number" min="0" value={g.do_ngay} onChange={(e) => setG({ ...g, do_ngay: e.target.value })} /></Field>
          <Field label="Vàng từ 00:00 ngày (hạn − N)" hint="N ngày, ≥ ngày đỏ"><Input type="number" min="0" value={g.vang_ngay} onChange={(e) => setG({ ...g, vang_ngay: e.target.value })} /></Field>
        </div>
      )}

      {it.ma === 'TEST_RUN_THEO_GIO_SX' && (
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Nghẽn trước giờ SX (phút)"><Input type="number" min="0" value={g.truoc_sx_phut} onChange={(e) => setG({ ...g, truoc_sx_phut: e.target.value })} /></Field>
          <Field label="Vàng sớm hơn mốc nghẽn (phút)"><Input type="number" min="0" value={g.canh_bao_phut} onChange={(e) => setG({ ...g, canh_bao_phut: e.target.value })} /></Field>
          <Field label="Giờ SX mặc định (lệnh chưa đặt giờ)"><TimeSelect value={g.gio_sx_mac_dinh} onChange={(v) => setG({ ...g, gio_sx_mac_dinh: v })} /></Field>
          <Field label="Tối thiểu từ lúc Release 1 đưa xuống (phút)" hint={Number(g.toi_thieu_phut) > 0 ? thoiLuong(Number(g.toi_thieu_phut)) : 'Không gia hạn'}>
            <Input type="number" min="0" value={g.toi_thieu_phut ?? ''} onChange={(e) => setG({ ...g, toi_thieu_phut: e.target.value })} />
          </Field>
        </div>
      )}

      <Field label="Ghi chú (lý do đổi)">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {loi && <div className="text-sm text-rose-600">{loi}</div>}
    </Modal>
  );
}

export default function SlaTheoGioPanel({ canManage, show }) {
  const [data, setData] = useState(null);
  const [sua, setSua] = useState(null);

  const load = useCallback(async () => {
    try { setData((await listSlaTheoGio()).data); } catch { /* tải ngầm — lỗi thì giữ dữ liệu cũ */ }
  }, []);
  useEffect(() => { load(); }, [load]);
  useSocketReload(['workflow:config-updated'], load);

  if (!data) return null;
  const duPhong = data.du_phong || [];
  const items = THU_TU.map((ma) => data.items.find((x) => x.ma === ma)).filter(Boolean);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-semibold text-ink">SLA theo giờ</h2>
        {!data.co_bang && <Badge tone="warning">Chưa chạy migration 109 — đang dùng mặc định, chưa sửa được</Badge>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.ma} className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="font-medium text-ink">{TIEU_DE[it.ma]}</div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge tone={it.bat ? 'success' : 'danger'}>{it.bat ? 'Bật' : 'Tắt'}</Badge>
                {canManage && data.co_bang && <Button variant="ghost" className="px-3 py-1" onClick={() => setSua(it)}>Sửa</Button>}
              </div>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
              {(it.bat ? ghiChu(it, duPhong) : [tatNoi(it, duPhong)]).map((d) => <li key={d}>{d}</li>)}
            </ul>
            {(it.ghi_chu || it.nguoi_sua) && (
              <div className="mt-2 text-xs text-ink-soft">
                {it.ghi_chu && <span>Ghi chú: {it.ghi_chu}. </span>}
                {it.nguoi_sua && <span>Sửa bởi {it.nguoi_sua}{it.tg_sua ? ` · ${fmtDateTime(it.tg_sua)}` : ''}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      {sua && (
        <SuaModal it={sua} onClose={() => setSua(null)}
          onSaved={(d) => { setData(d); setSua(null); show('Đã lưu luật SLA'); }} />
      )}
    </div>
  );
}
