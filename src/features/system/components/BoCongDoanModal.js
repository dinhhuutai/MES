// ─────────────────────────────────────────────────────────────────────────────
// QUẢN TRỊ PHẦN IN › BỎ 1 CÔNG ĐOẠN của phần in 2 công đoạn (11/11/2026, người dùng chốt).
//   · Bỏ In (chỉ giữ ép ủi) ⇒ luồng Logo (như hàng chỉ ép); bỏ Ép ủi ⇒ In kiếng (không ép) / In thường.
//   · Mở modal ⇒ BE dựng kế hoạch (`xemTruoc`) — từng lệnh / kế hoạch tạm / tem sẽ bị làm gì; có dòng CHẶN thì không bấm
//     được. Mọi bước BE gọi lại service thật (hủy lệnh = tab Hủy lệnh sản xuất, báo ERP). Luật: BE `phaninadmin.service
//     boCongDoan` + `utils/luongSanXuat.js luongSauKhiBo`.
// ⚠ Component con khai ở MỨC MODULE (luật §9).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import Spinner from '../../../components/common/Spinner';
import { Field, Textarea } from '../../../components/common/controls';
import { PHUONG_AN_IN } from '../../../components/common/PhuongAnInBadge';
import { boCongDoanQt } from '../../../services/quanTriPhanInService';
import { TEN_TT_LENH } from './QuanTriToanCanh';

const MO_TA_LUONG_MOI = {
  LOGO: 'Không qua Test Run / Release 2: release xong vào thẳng Chờ chạy; đợt mới từ ERP tự xác nhận READY.',
  KIENG_KHONG_EP: '1 công đoạn in kiếng — tem vẫn nhập loại / SL / hệ số kiếng, tem in đi KCS → OQC → giao.',
  THUONG: '1 công đoạn in thường — tem in đi KCS → OQC → giao.',
};

function DongViec({ ma, trangThai, chuyen, viec, tone = 'default' }) {
  const mau = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-ink-soft';
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 text-sm">
      <b className="text-ink">{ma}</b>
      {trangThai && <span className="text-xs text-ink-soft">{TEN_TT_LENH[trangThai] || trangThai}{chuyen ? ` · ${chuyen}` : ''}</span>}
      <span className={`text-xs ${mau}`}>— {viec}</span>
    </li>
  );
}

function KhoiViec({ tieuDe, rong, children }) {
  return (
    <div className="rounded-control border border-line">
      <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">{tieuDe}</div>
      {rong ? <p className="px-3 py-2 text-sm text-ink-soft">{rong}</p> : <ul className="divide-y divide-line">{children}</ul>}
    </div>
  );
}

const viecGiu = (l) => {
  const v = [];
  if (l.doi_gd) v.push('thành lệnh của công đoạn duy nhất · gửi ERP Release 1');
  if (l.sang_cho_chay) v.push('đang chờ Test Run → vào thẳng Chờ chạy');
  if (l.giu_test_run) v.push(`giữ ở Test Run (${l.giu_test_run})`);
  if (l.nha_tem > 0) v.push(`${l.nha_tem} tem chờ công đoạn sau → vào KCS`);
  return v.length ? v.join(' · ') : 'giữ nguyên';
};

export default function BoCongDoanModal({ phanInId, bo, onClose, onDone, show }) {
  const [ke, setKe] = useState(null);
  const [dangXem, setDangXem] = useState(false);
  const [lyDo, setLyDo] = useState('');
  const [doiPa, setDoiPa] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setKe(null); setLyDo(''); setDoiPa(true); }, [bo, phanInId]);
  useEffect(() => {
    if (!bo || !phanInId) return undefined;
    let song = true;
    setDangXem(true);
    boCongDoanQt(phanInId, { bo, xemTruoc: true })
      .then((r) => { if (song) setKe(r.data); })
      .catch((e) => { if (song) { setKe(null); show(e.message || 'Không dựng được kế hoạch', 'error'); } })
      .finally(() => { if (song) setDangXem(false); });
    return () => { song = false; };
  }, [phanInId, bo, show]);

  const lam = async () => {
    if (!lyDo.trim()) { show('Nhập lý do', 'error'); return; }
    setBusy(true);
    try {
      const r = await boCongDoanQt(phanInId, { bo, lyDo: lyDo.trim(), doiPa });
      const k = r.data?.ket_qua || {};
      const phan = [];
      if (k.lenh_huy?.length) phan.push(`hủy ${k.lenh_huy.join(', ')}`);
      if (k.lenh_sang_cho_chay?.length) phan.push(`${k.lenh_sang_cho_chay.join(', ')} vào Chờ chạy`);
      if (k.tem_nha_kcs) phan.push(`${k.tem_nha_kcs} tem vào KCS`);
      if (k.hskt?.doi) phan.push(`PA hồ sơ → Ép (${k.hskt.barcode_moi})`);
      const loiPa = k.hskt && !k.hskt.doi;
      if (loiPa) phan.push(`CHƯA đổi được PA hồ sơ: ${k.hskt.loi}`);
      show(`${r.message || 'Đã bỏ công đoạn'}${phan.length ? ` · ${phan.join(' · ')}` : ''}`, loiPa ? 'error' : undefined);
      onDone();
    } catch (e) { show(e.message || 'Bỏ công đoạn thất bại', 'error'); } finally { setBusy(false); }
  };

  const tieuDe = bo === 'IN' ? `Bỏ công đoạn ${ke?.nhan_bo || 'In'} — chỉ giữ ép ủi` : 'Bỏ công đoạn Ép ủi — chỉ giữ in';
  const chan = ke?.chan || [];
  return (
    <Modal open={!!bo} onClose={onClose} size="lg" title={tieuDe}
      footer={(
        <>
          <Button chiXemOk variant="secondary" onClick={onClose}>Đóng</Button>
          <Button variant="danger" loading={busy} disabled={!ke || chan.length > 0 || !lyDo.trim() || busy} onClick={lam}>
            {ke ? `Bỏ công đoạn ${ke.nhan_bo}` : 'Bỏ công đoạn'}
          </Button>
        </>
      )}>
      {dangXem || !ke ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-control bg-surface-muted px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink-soft">Luồng</span>
              <Badge tone="warning">{ke.ten_luong_cu}</Badge>
              <span className="text-ink-soft">→</span>
              <Badge tone={ke.luong_moi === 'LOGO' ? 'success' : 'info'}>{ke.ten_luong_moi}</Badge>
            </div>
            {MO_TA_LUONG_MOI[ke.luong_moi] && <p className="mt-1 text-xs text-ink-soft">{MO_TA_LUONG_MOI[ke.luong_moi]}</p>}
          </div>

          {chan.map((c) => (
            <p key={c} className="rounded-control border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">⛔ {c}</p>
          ))}
          {(ke.canh_bao || []).map((c) => (
            <p key={c} className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">⚠ {c}</p>
          ))}

          <KhoiViec tieuDe={`Công đoạn ${ke.nhan_bo} — bỏ`}
            rong={!ke.lenh_bo.length && !ke.kht_bo.length ? 'Chưa lập lệnh / kế hoạch tạm nào — không có gì phải hủy.' : null}>
            {ke.lenh_bo.map((l) => (
              <DongViec key={l.id} ma={l.ma} trangThai={l.trang_thai} chuyen={l.ma_chuyen}
                tone={l.viec === 'CHAN' ? 'danger' : 'warning'}
                viec={l.viec === 'CHAN' ? (l.so_tem ? `chặn: đã in ${l.so_tem} tem` : 'chặn: lệnh gom nhiều phần in')
                  : `hủy lệnh${l.huy_tuy_chon ? ' kèm phiếu chạy (chưa in tem)' : ''} · báo ERP hủy kế hoạch`} />
            ))}
            {ke.kht_bo.map((k) => (
              <DongViec key={k.id} ma={`Kế hoạch tạm đợt ${k.ma_dot_vai}`} chuyen={null} tone="warning"
                viec={`hủy (${k.so_luong} pcs${k.ma_chuyen ? ` · ${k.ma_chuyen}` : ''})`} />
            ))}
          </KhoiViec>

          <KhoiViec tieuDe={`Công đoạn ${ke.nhan_giu} — giữ lại`}
            rong={!ke.lenh_giu.length && !ke.kht_giu_doi ? 'Chưa có lệnh — các đợt vải lập kế hoạch ở Release 1 theo luồng mới.' : null}>
            {ke.lenh_giu.map((l) => (
              <DongViec key={l.id} ma={l.ma} trangThai={l.trang_thai} chuyen={l.ma_chuyen} viec={viecGiu(l)} />
            ))}
            {ke.kht_giu_doi > 0 && (
              <DongViec ma={`${ke.kht_giu_doi} kế hoạch tạm phần ép`} viec="thành kế hoạch tạm của công đoạn duy nhất" />
            )}
          </KhoiViec>

          {ke.hskt && (
            <div className="rounded-control border border-line px-3 py-2 text-sm">
              <div className="text-ink">
                Phương án in hồ sơ <b>{ke.hskt.barcode_hskt}</b>: <b>{PHUONG_AN_IN[ke.hskt.phuong_an_in] || ke.hskt.phuong_an_in}</b>
                {ke.hskt.dung_chung.length > 0 && <span className="text-xs text-ink-soft"> · dùng chung với {ke.hskt.dung_chung.join(', ')}</span>}
              </div>
              {ke.doi_pa_duoc && (
                <label className="mt-2 flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={doiPa} onChange={(e) => setDoiPa(e.target.checked)} />
                  <span>
                    Đổi phương án in hồ sơ sang <b>Ép</b>
                    <span className="block text-xs text-ink-soft">Lệnh của công đoạn duy nhất đọc PA hồ sơ (cột Phương án in, ERP Release 1).</span>
                  </span>
                </label>
              )}
            </div>
          )}

          <Field label="Lý do" required hint="Ghi vào nhật ký đổi luồng + từng lệnh / kế hoạch tạm bị hủy">
            <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Vd: khách đã in sẵn, chỉ ép ủi" />
          </Field>
        </div>
      )}
    </Modal>
  );
}
