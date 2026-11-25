// ─────────────────────────────────────────────────────────────────────────────
// THÊM ĐỢT VẢI TAY + ĐẶT VÀO MÀN (19/11/2026, người dùng: "phần in có ép rồi mà ERP lỗi không lên được phần in … không chỉ
//   kiếng mà logo hay ép hay in đều thêm được, cho nhập nhanh theo code phần"). Mở từ Quản trị phần in › Luồng sản xuất và
//   Nhập tay › "Thêm đợt theo code phần".
//   · ⚠ 25/11/2026 (người dùng: "cho phép đánh dấu đợt đó là in hay kiếng hay logo hay ép gì cũng đều được"; mig 139): CÔNG ĐOẠN
//     chọn TỰ DO bằng 5 nút In · In kiếng · Logo · Ép · Cả 2 — chỉ công đoạn phần in đang có bấm được (thiếu ⇒ "Thêm 1 công đoạn");
//     LOẠI đợt (số lượng / bổ sung / mẫu…) chọn riêng, không còn quyết định công đoạn. BE lưu `dot_vai_ve.cong_doan_dot`. Chưa chạy
//     mig 139 (`co_cot_cong_doan` false) ⇒ giao diện cũ: công đoạn theo loại đợt (kiếng ủi 4I = In kiếng, loại khác = Ép).
//   · SL / hạn giao / mã phiếu ready mặc định theo 1 đợt đang có, sửa được. Đặt màn: READY Kỹ thuật · READY chờ QA · Release 1
//     · Test Run · Chờ chạy (2 màn sau lập lệnh ngay; In + Logo chọn công đoạn lập lệnh).
//   · ERP sau này gửi đợt thật ⇒ vào như đợt mới (đợt tạo tay thừa hủy ở tab Hủy đợt vải). Luật: BE
//     `phaninadmin.service themDotVai`.
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
import { fmtNum, ngayLocalISO } from '../../../utils/format';
import { laChuyenGiaCong } from '../../planning/utils/chuyenGiaCong';
import { themDotVaiQt } from '../../../services/quanTriPhanInService';
import { TEN_TT_LENH } from './QuanTriToanCanh';

const mkTs = (ngay, gio) => (ngay && gio ? `${ngay}T${gio}:00` : null);
const LAP_LENH = new Set(['TEST_RUN', 'CHO_CHAY']);
const DICH = [
  { v: 'READY_KT', ten: 'READY — Kỹ thuật', moTa: 'Đợt lên READY như ERP gửi (KTCankiemtra = 1): Kỹ thuật xác nhận rồi QA.' },
  { v: 'READY_QA', ten: 'READY — chờ QA', moTa: 'Coi như Kỹ thuật đã xong, đợt nằm ở QC READY chờ QA xác nhận.' },
  { v: 'RELEASE_1', ten: 'Release 1', moTa: 'Coi như đã Ready (như KTCankiemtra = 0) — đợt hiện ở Release 1 cho Kế hoạch lập.' },
  { v: 'TEST_RUN', ten: 'Test Run', moTa: 'Ready + lập lệnh ngay — lệnh In vào Test Run (lệnh Ép/Logo vào thẳng Chờ chạy).' },
  { v: 'CHO_CHAY', ten: 'Chờ chạy', moTa: 'Ready + lập lệnh ngay và bỏ qua Test Run (quản trị, có ghi vết) — vào thẳng Chờ chạy.' },
];
// 5 nút công đoạn — `nut` khớp BE `phaninadmin.service luaChonCongDoan`.
const NUT_CD = [
  { nut: 'IN', ten: 'In' }, { nut: 'KIENG', ten: 'In kiếng' }, { nut: 'LOGO', ten: 'Logo' }, { nut: 'EP', ten: 'Ép' },
  { nut: 'CA_HAI', ten: 'Cả 2 công đoạn' },
];
const LOAI_TU_DONG = new Set(['SO_LUONG', 'IN_KIENG']); // loại đợt do nút công đoạn tự đặt (người chọn loại khác thì giữ)

function TheChon({ chon, onChon, ten, moTa, tat }) {
  return (
    <label className={`flex flex-col gap-1 rounded-control border px-3 py-2 text-sm transition
      ${tat ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
      ${chon ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-line hover:border-primary/40'}`}>
      <span className="flex items-center gap-2 font-medium text-ink">
        <input type="radio" className="h-4 w-4 accent-primary" checked={chon} disabled={tat} onChange={onChon} />
        {ten}
      </span>
      {moTa && <span className="text-xs leading-snug text-ink-soft">{moTa}</span>}
    </label>
  );
}

export default function ThemDotVaiModal({ phanInId, mo, onClose, onDone, show, chuyen, users }) {
  const [ke, setKe] = useState(null);
  const [loaiDot, setLoaiDot] = useState('SO_LUONG');
  const [nutCd, setNutCd] = useState('');        // nút công đoạn đang chọn (chế độ chọn tự do)
  const [nguon, setNguon] = useState('');
  const [sl, setSl] = useState('');
  const [hanGiao, setHanGiao] = useState('');
  const [barcode, setBarcode] = useState('');
  const [dich, setDich] = useState('READY_KT');
  const [cdLap, setCdLap] = useState('CA_HAI');
  const [f, setF] = useState({ chuyenId: '', ngay: ngayLocalISO(new Date()), gioBd: '', gioKt: '', thoIn: '' });
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);

  const apNguon = (d) => {
    setNguon(d ? d.id : '');
    setSl(d ? String(d.so_luong || '') : '');
    setHanGiao(d?.han_giao_hang || '');
    setBarcode(d?.barcode || '');
  };

  useEffect(() => {
    if (!mo || !phanInId) return undefined;
    let song = true;
    setKe(null); setDich('READY_KT'); setCdLap('CA_HAI'); setLyDo('');
    setF({ chuyenId: '', ngay: ngayLocalISO(new Date()), gioBd: '', gioKt: '', thoIn: '' });
    themDotVaiQt(phanInId, { xemTruoc: true })
      .then((r) => {
        if (!song) return;
        const d = r.data;
        setKe(d);
        const md = (d.cong_doan_chon || []).find((c) => c.ma === d.cong_doan_mac_dinh) || (d.cong_doan_chon || [])[0];
        setNutCd(md ? md.nut : '');
        setLoaiDot((md && md.loai_goi_y) || (d.nhanh && d.nhanh[0] && d.nhanh[0].ma) || 'SO_LUONG');
        apNguon((d.dot || []).find((x) => x.id === d.goi_y_nguon) || null);
      })
      .catch((e) => { if (song) { show(e.message || 'Không đọc được phần in', 'error'); onClose(); } });
    return () => { song = false; };
  }, [mo, phanInId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loai = (ke?.loai_dot || []).find((l) => l.ma === loaiDot);
  const dsChuyen = useMemo(() => (chuyen || []).filter((c) => !laChuyenGiaCong(chuyen, c.id)), [chuyen]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const lapLenh = LAP_LENH.has(dich);
  const slSo = Number(sl);
  // Chế độ chọn công đoạn tự do (BE mới + mig 139; phần in 1 công đoạn không cần cột). Không ⇒ công đoạn theo loại đợt như cũ.
  const dsChon = ke?.cong_doan_chon || [];
  const haiCd = dsChon.length > 1;
  const tuDo = dsChon.length > 0 && (!haiCd || !!ke?.co_cot_cong_doan);
  const cd = tuDo ? dsChon.find((c) => c.nut === nutCd) : null;
  const gdChon = tuDo ? (cd ? cd.gd : []) : (loai ? loai.gd : []);
  const tenCd = tuDo ? (cd ? cd.ten : '') : (loai ? loai.cong_doan : '');
  const quaTestRun = tuDo ? !!(cd && cd.qua_test_run) : !!(loai && loai.qua_test_run);
  const lapHaiCd = gdChon.length > 1; // đợt mang cả 2 công đoạn ⇒ chọn công đoạn lập lệnh
  const tenGd = (g) => (dsChon.find((c) => c.gd.length === 1 && c.gd[0] === g) || {}).ten || (g === 'IN' ? 'In' : 'Ép/Logo');
  const CD_LAP = [{ v: 'CA_HAI', ten: 'Cả 2 công đoạn' }, { v: 'IN', ten: `Chỉ ${tenGd('IN')}` }, { v: 'EP_UI', ten: `Chỉ ${tenGd('EP_UI')}` }];
  const chonCd = (c) => {
    setNutCd(c.nut);
    if (LOAI_TU_DONG.has(loaiDot) && c.loai_goi_y) setLoaiDot(c.loai_goi_y);
  };
  // Test Run chỉ có nghĩa khi có công đoạn In được lập (Ép/Logo không qua Test Run).
  const coIn = gdChon.includes('IN') && (!lapHaiCd || cdLap !== 'EP_UI') && quaTestRun;
  const thieu = !ke || !loai || (tuDo && !cd) || !lyDo.trim() || !Number.isInteger(slSo) || slSo <= 0
    || (lapLenh && (!f.chuyenId || !f.ngay)) || (dich === 'TEST_RUN' && !coIn);

  const lam = async () => {
    setBusy(true);
    try {
      const r = await themDotVaiQt(phanInId, {
        loaiDot, dotNguonId: nguon || null, soLuong: slSo, hanGiao: hanGiao || null, barcode: barcode.trim(), dich, lyDo: lyDo.trim(),
        ...(tuDo && haiCd && cd ? { congDoanDot: cd.ma } : {}),
        ...(lapLenh ? {
          congDoanLap: cdLap, chuyenId: f.chuyenId, ngayKeHoach: f.ngay, tgBdKh: mkTs(f.ngay, f.gioBd), tgKtKh: mkTs(f.ngay, f.gioKt), thoIn: f.thoIn,
        } : {}),
      });
      const k = r.data?.ket_qua || {};
      const phan = [];
      if (k.dich?.lenh?.length) phan.push(`lập ${k.dich.lenh.map((l) => `${l.ma} (${TEN_TT_LENH[l.trang_thai] || l.trang_thai})`).join(', ')}`);
      if (k.dich?.ke_hoach_tam) phan.push(`${k.dich.ke_hoach_tam} kế hoạch tạm`);
      const loi = k.dich?.loi ? [`đợt đã tạo nhưng chưa đặt được vào màn đích: ${k.dich.loi}`] : [];
      show([r.message || 'Đã thêm đợt vải', ...phan, ...loi].join(' · '), loi.length ? 'error' : undefined);
      onDone();
    } catch (e) { show(e.message || 'Thêm đợt vải thất bại', 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!mo} onClose={onClose} size="lg" title={ke ? `Thêm đợt vải — ${ke.ma_phan}` : 'Thêm đợt vải'}
      footer={(
        <>
          <Button chiXemOk variant="secondary" onClick={onClose}>Đóng</Button>
          <Button loading={busy} disabled={thieu || busy} onClick={lam}>Thêm đợt vải</Button>
        </>
      )}>
      {!ke ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-control bg-surface-muted px-3 py-2 text-sm">
            <span className="text-ink-soft">Luồng</span><Badge tone="warning">{ke.ten_luong}</Badge>
            {ke.tinh_chat_in && <span className="text-xs text-ink-soft">({ke.tinh_chat_in})</span>}
            <span className="w-full text-xs text-ink-soft">
              ERP lỗi không gửi đợt ⇒ tạo tay ở đây. Sau này ERP gửi đợt thật thì vào như đợt mới — đợt tạo tay thừa hủy ở tab Hủy đợt vải.
              Phần in chưa có công đoạn cần thêm ⇒ dùng "Thêm 1 công đoạn".
            </span>
          </div>
          {(ke.canh_bao || []).map((c) => (
            <p key={c} className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">⚠ {c}</p>
          ))}

          {tuDo ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label="Công đoạn của đợt" required
                hint={cd ? `Đợt này là công đoạn ${cd.ten}${cd.gd.length > 1 ? ' — Release 1 tách 2 dòng, mỗi công đoạn 1 lệnh' : ''}` : 'Chọn 1 công đoạn'}>
                <div className="flex flex-wrap gap-2">
                  {NUT_CD.filter((n) => n.nut !== 'CA_HAI' || haiCd).map((n) => {
                    const c = dsChon.find((x) => x.nut === n.nut);
                    return (
                      <Button key={n.nut} variant={c && nutCd === n.nut ? 'primary' : 'secondary'} disabled={!c}
                        title={c ? c.ten : `Phần in ${ke.ten_luong} chưa có công đoạn ${n.ten} — dùng "Thêm 1 công đoạn" ở Quản trị phần in`}
                        onClick={() => c && chonCd(c)}>{n.nut === 'CA_HAI' && c ? c.ten : n.ten}</Button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Loại đợt vải" hint="Số lượng / bổ sung / mẫu… — không đổi công đoạn">
                <select className="h-10 w-full rounded-input border border-line bg-surface px-2 text-sm" value={loaiDot}
                  onChange={(e) => setLoaiDot(e.target.value)} aria-label="Loại đợt vải">
                  {ke.loai_dot.map((l) => <option key={l.ma} value={l.ma}>{l.ten}</option>)}
                </select>
              </Field>
            </div>
          ) : (
            <Field label="Công đoạn của đợt" required hint={loai ? `Loại đợt ${loai.ten} ⇒ ${loai.cong_doan}` : ''}>
              <div className="flex flex-wrap gap-2">
                {ke.nhanh.map((n) => (
                  <Button key={n.ma} variant={loaiDot === n.ma ? 'primary' : 'secondary'} onClick={() => setLoaiDot(n.ma)}>{n.ten}</Button>
                ))}
                <select className="h-10 rounded-input border border-line bg-surface px-2 text-sm" value={loaiDot}
                  onChange={(e) => setLoaiDot(e.target.value)} aria-label="Loại đợt vải">
                  {ke.loai_dot.map((l) => <option key={l.ma} value={l.ma}>{l.ten} → {l.cong_doan}</option>)}
                </select>
              </div>
              {haiCd && !ke.co_cot_cong_doan && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Chưa chạy migration 139 — công đoạn đi theo loại đợt.</p>
              )}
            </Field>
          )}

          <div className="rounded-control border border-line">
            <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">Đợt vải đang có — chọn 1 đợt làm số mặc định</div>
            {!ke.dot.length ? <p className="px-3 py-2 text-sm text-ink-soft">Phần in không còn đợt vải sống.</p> : (
              <ul className="max-h-48 divide-y divide-line overflow-auto">
                {ke.dot.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm">
                    <input type="radio" className="h-4 w-4 accent-primary" checked={nguon === d.id} onChange={() => apNguon(d)} />
                    <b className="text-ink">{d.ma_dot_vai}</b>
                    <Badge tone="default">{d.cong_doan}</Badge>
                    <span className="text-xs text-ink-soft">{d.loai || '—'} · vải {fmtNum(d.so_luong)} · hạn giao {d.han_giao_hang || '—'} · {d.tao_luc}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="SL vải của đợt" required>
              <Input type="number" min={1} value={sl} onChange={(e) => setSl(e.target.value)} />
            </Field>
            <Field label="Hạn giao">
              <Input type="date" value={hanGiao} onChange={(e) => setHanGiao(e.target.value)} />
            </Field>
            <Field label="Mã phiếu ready (IDDotReady)" hint="Gửi ERP khi in tem — mặc định của đợt chọn">
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </Field>
          </div>

          <Field label="Đặt đợt vào màn" required>
            <div className="grid gap-2 sm:grid-cols-2">
              {DICH.map((o) => (
                <TheChon key={o.v} chon={dich === o.v} onChon={() => setDich(o.v)} ten={o.ten}
                  tat={o.v === 'TEST_RUN' && !!tenCd && !quaTestRun}
                  moTa={o.v === 'TEST_RUN' && !!tenCd && !quaTestRun ? `${tenCd} không qua Test Run — chọn Chờ chạy` : o.moTa} />
              ))}
            </div>
          </Field>

          {lapLenh && (
            <div className="space-y-3 rounded-control border border-line p-3">
              <div className="text-sm font-semibold text-ink">Kế hoạch lệnh (hết SL đợt {fmtNum(slSo || 0)})</div>
              {lapHaiCd && (
                <Field label="Công đoạn lập lệnh">
                  <div className="flex flex-wrap gap-2">
                    {CD_LAP.map((c) => (
                      <TheChon key={c.v} chon={cdLap === c.v} onChon={() => setCdLap(c.v)} ten={c.ten} />
                    ))}
                  </div>
                </Field>
              )}
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
              <Field label="Thợ in kế hoạch">
                <NhieuNguoiSelect value={f.thoIn} onChange={(v) => set('thoIn', v)} options={users} placeholder="Gõ tên hoặc MSNV để tìm rồi chọn / Enter..." />
              </Field>
            </div>
          )}

          <Field label="Lý do" required hint="Ghi vào nhật ký phần in + đợt vải tạo tay">
            <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Vd: ERP lỗi không gửi đợt vải" />
          </Field>
        </div>
      )}
    </Modal>
  );
}
