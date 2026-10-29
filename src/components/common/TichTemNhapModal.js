import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import ConfirmDialog from './ConfirmDialog';
import SearchableSelect from './SearchableSelect';
import Icon from './Icon';
import { fmtNum } from '../../utils/format';

// ─── TÍCH TEM — QUÉT + NHẬP NHIỀU TEM THEO DÒNG (29/10/2026, người dùng: "có nút tích → modal gần full màn hình,
//   dạng bảng, cột đầu ô tích, rồi khách · đơn · mã · màu · kích · kích film, rồi các ô nhập; mở lên con trỏ ở ô quét,
//   quét ra thông tin thì con trỏ tới ô số lượng đạt, Enter qua ô kế; mũi tên xuống thêm 1 dòng, con trỏ tự vào;
//   nút xác nhận cùng lúc nhiều phần — KCS, Phân loại lỗi, Sửa đều như vậy") ───
// Dùng chung cho 3 màn: màn khai `traMa` (tra 1 mã ⇒ dòng dữ liệu), `truong` (các ô nhập), `formMoi` / `danhGia` / `luu`
//   (GƯƠNG luật BE của màn — chốt chặn thật vẫn ở BE). Mỗi dòng tích đi ĐÚNG API lẻ của màn, TUẦN TỰ, dòng lỗi không chặn
//   dòng sau; dòng lưu được rời bảng, dòng lỗi ở lại kèm câu lỗi.
// Phím: ô quét Enter = tra mã · ô nhập Enter = sang ô kế (ô cuối ⇒ dòng dưới, chưa có thì thêm) · ↓ / ↑ = dòng dưới / trên
//   (dòng cuối bấm ↓ ⇒ thêm 1 dòng mới, con trỏ vào ô quét). Ô chọn (danh mục) giữ ↑↓ cho danh sách thả xuống.
// `truong`: [{ k, label, kieu: 'so' | 'chon', options, getSearch, placeholder, minW }].
const TOI_DA_DONG = 100;
const n = (v) => Math.max(0, Math.trunc(Number(v) || 0));

const O_SO = 'h-9 w-full min-w-[64px] rounded-input border border-line bg-surface px-2 text-right text-sm tabular-nums focus:border-primary focus:outline-none disabled:opacity-50';
const O_MA = 'h-9 w-full min-w-[150px] rounded-input border border-line bg-surface px-2 font-mono text-sm focus:border-primary focus:outline-none';

let demId = 0;
const dongTrong = () => { demId += 1; return { id: `d${demId}`, ma: '', tt: 'TRONG', row: null, f: {}, tich: false, chu: '' }; };

export default function TichTemNhapModal({
  open, onClose, title, nhanXacNhan, show,
  traMa, khoaDong, maHien, soCan, nhanSoCan, truong, formMoi, danhGia, luu,
  truocXacNhan, onXong, phuTro,
}) {
  const [dong, setDong] = useState(() => [dongTrong()]);
  const [dangLuu, setDangLuu] = useState(false);
  const [tienDo, setTienDo] = useState('');
  const [hoiDong, setHoiDong] = useState(false);
  const [muonFocus, setMuonFocus] = useState(null); // { id, k, n } — đặt con trỏ sau lần vẽ kế
  const dongRef = useRef(dong);
  dongRef.current = dong;
  const refs = useRef({});

  const keys = useMemo(() => truong.map((t) => t.k), [truong]);
  const oCua = (d) => (d.tt === 'OK' ? keys : ['ma']);
  const datConTro = useCallback((id, k) => setMuonFocus((m) => ({ id, k, n: (m?.n || 0) + 1 })), []);

  // Mở modal ⇒ bảng mới 1 dòng trống, con trỏ ở ô quét (Headless UI tự đặt focus lúc mở ⇒ đợi vài nhịp như các panel khác).
  useEffect(() => {
    if (!open) return undefined;
    const d0 = dongTrong();
    setDong([d0]); setTienDo(''); setHoiDong(false);
    const hen = [80, 250].map((ms) => setTimeout(() => datConTro(d0.id, 'ma'), ms));
    return () => hen.forEach(clearTimeout);
  }, [open, datConTro]);

  // Mỗi yêu cầu đặt con trỏ chỉ thực hiện 1 lần (đánh dấu `daDat`) — không thì gõ ở ô khác (đổi `dong`) bị kéo con trỏ về.
  const daDat = useRef(0);
  useEffect(() => {
    if (!muonFocus || daDat.current === muonFocus.n) return;
    const el = refs.current[`${muonFocus.id}|${muonFocus.k}`];
    const o = el && (el.tagName === 'INPUT' ? el : el.querySelector('input'));
    if (o) { daDat.current = muonFocus.n; o.focus(); if (o.select) o.select(); }
  }, [muonFocus, dong]);

  const sua = (id, patch) => setDong((ds) => ds.map((d) => (d.id === id ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)));
  const setF = (id, k, v) => sua(id, (d) => ({ f: { ...d.f, [k]: v }, kq: null }));

  // Thêm 1 dòng trống cuối bảng (dòng cuối đang trống thì dùng luôn dòng đó — không đẻ dòng trống liên tiếp).
  const themDong = () => {
    const ds = dongRef.current;
    const cuoi = ds[ds.length - 1];
    if (cuoi && cuoi.tt !== 'OK' && !cuoi.ma.trim()) { datConTro(cuoi.id, 'ma'); return; }
    if (ds.length >= TOI_DA_DONG) { show?.(`Tối đa ${TOI_DA_DONG} tem một lượt`, 'error'); return; }
    const moi = dongTrong();
    setDong((cu) => [...cu, moi]);
    datConTro(moi.id, 'ma');
  };

  const sang = (id, k, buoc) => {
    const ds = dongRef.current;
    const i = ds.findIndex((d) => d.id === id);
    const j = i + buoc;
    if (j < 0) return;
    if (j >= ds.length) { themDong(); return; }
    const dich = ds[j];
    datConTro(dich.id, oCua(dich).includes(k) ? k : oCua(dich)[0]);
  };

  const oKe = (id, k) => {
    const d = dongRef.current.find((x) => x.id === id);
    if (!d) return;
    const ds = oCua(d);
    const i = ds.indexOf(k);
    if (i >= 0 && i < ds.length - 1) datConTro(id, ds[i + 1]);
    else sang(id, ds[0], 1);
  };

  const tra = async (id) => {
    const d0 = dongRef.current.find((x) => x.id === id);
    const code = String(d0?.ma || '').trim();
    if (!code) return;
    sua(id, { tt: 'TRA', chu: 'Đang tra…' });
    let kq;
    try { kq = await traMa(code); } catch (e) { kq = { loi: e.message || 'Không tra được mã' }; }
    if (!kq?.row) {
      sua(id, { tt: 'LOI', chu: kq?.loi || 'Không tìm thấy tem' });
      datConTro(id, 'ma');
      return;
    }
    const khoa = khoaDong(kq.row);
    const ds = dongRef.current;
    const trung = ds.findIndex((x) => x.id !== id && x.tt === 'OK' && khoaDong(x.row) === khoa);
    if (trung >= 0) {
      sua(id, { tt: 'LOI', ma: '', chu: `Tem ${maHien(kq.row)} đã có ở dòng ${trung + 1}` });
      datConTro(ds[trung].id, keys[0]);
      return;
    }
    sua(id, { tt: 'OK', row: kq.row, f: formMoi(kq.row), tich: true, chu: '', kq: null });
    datConTro(id, keys[0]);
  };

  const boDong = (id) => setDong((ds) => {
    const con = ds.filter((d) => d.id !== id);
    return con.length ? con : [dongTrong()];
  });

  const phim = (e, d, k) => {
    if (e.nativeEvent?.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (k === 'ma') tra(d.id); else oKe(d.id, k);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); sang(d.id, k, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); sang(d.id, k, -1);
    }
  };

  const dgCua = (d) => (d.tt === 'OK' ? danhGia(d.row, d.f) : null);
  const dongTich = dong.filter((d) => d.tt === 'OK' && d.tich);
  const soSai = dongTich.filter((d) => !dgCua(d)?.ok).length;
  const dongOk = dong.filter((d) => d.tt === 'OK');
  const tichHet = dongOk.length > 0 && dongOk.every((d) => d.tich);
  const doiTichHet = () => setDong((ds) => ds.map((d) => (d.tt === 'OK' ? { ...d, tich: !tichHet } : d)));
  const tongSo = truong.filter((t) => t.kieu !== 'chon').map((t) => [t.label, dongTich.reduce((s, d) => s + n(d.f[t.k]), 0)]);

  // Áp 1 hàm cho mọi dòng đã tra được (nút phụ trợ của màn: "Đạt hết", "Mã lỗi chung"…).
  const apMoiDong = (fn) => setDong((ds) => ds.map((d) => (d.tt === 'OK' ? { ...d, f: fn(d.row, d.f), kq: null } : d)));

  const xacNhan = async () => {
    if (!dongTich.length) { show?.('Chưa tích dòng nào', 'error'); return; }
    if (soSai) { show?.(`Còn ${soSai} dòng chưa hợp lệ — sửa hoặc bỏ tích trước khi xác nhận`, 'error'); return; }
    if (truocXacNhan && !(await truocXacNhan(dongTich.map((d) => d.row)))) return;
    setDangLuu(true);
    const okIds = new Set(); const loi = []; const kq = {};
    for (let i = 0; i < dongTich.length; i += 1) {
      const d = dongTich[i];
      setTienDo(`Đang lưu ${i + 1}/${dongTich.length} · ${maHien(d.row)}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        await luu(d.row, d.f);
        okIds.add(d.id);
      } catch (e) {
        kq[d.id] = e.message || 'Lưu lỗi';
        loi.push(maHien(d.row));
      }
    }
    setTienDo('');
    setDangLuu(false);
    const con = dongRef.current.filter((d) => !okIds.has(d.id)).map((d) => (kq[d.id] ? { ...d, kq: kq[d.id] } : d));
    const conDong = con.length ? con : [dongTrong()];
    setDong(conDong);
    onXong?.(okIds.size, loi);
    if (loi.length) {
      const dauLoi = conDong.find((d) => d.kq);
      if (dauLoi) datConTro(dauLoi.id, keys[0]);
    }
  };

  const xinDong = () => {
    if (dangLuu) return;
    if (dong.some((d) => d.tt === 'OK')) { setHoiDong(true); return; }
    onClose();
  };

  if (!open) return null;
  return (
    <>
      <Modal open={open} onClose={xinDong} size="full" lapDay title={title}
        footer={(
          <>
            <span className="mr-auto text-sm text-ink-soft">
              {tienDo || (soSai > 0
                ? <span className="text-danger">{soSai} dòng tích chưa hợp lệ</span>
                : <>Đã tích <b className="text-ink">{dongTich.length}</b> dòng{tongSo.map(([l, v]) => (v ? <span key={l}> · {l.toLowerCase()} <b className="text-ink">{fmtNum(v)}</b></span> : null))}</>)}
            </span>
            <Button chiXemOk variant="ghost" onClick={xinDong} disabled={dangLuu}>Đóng</Button>
            <Button icon="check-circle" onClick={xacNhan} loading={dangLuu} disabled={!dongTich.length || soSai > 0}>
              {nhanXacNhan} ({dongTich.length})
            </Button>
          </>
        )}>
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2 text-sm">
            {phuTro && phuTro({ apMoiDong, dangLuu, coDong: dongOk.length > 0 })}
            <Button variant="secondary" icon="plus" onClick={themDong} disabled={dangLuu}>Thêm dòng (↓)</Button>
            <span className="text-xs text-ink-soft">Quét mã tem + Enter ⇒ tự nhảy sang ô nhập · Enter sang ô kế · ↓ thêm dòng / xuống dòng · ↑ lên dòng.</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-card border border-line">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 z-10 bg-surface-muted text-left text-[11px] uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="w-10 px-2 py-2 text-center">
                    <input type="checkbox" aria-label="Tích / bỏ tích mọi dòng" checked={tichHet}
                      ref={(el) => { if (el) el.indeterminate = dongTich.length > 0 && !tichHet; }}
                      onChange={doiTichHet} disabled={!dongOk.length || dangLuu} />
                  </th>
                  <th className="w-8 px-1 py-2 text-right">#</th>
                  <th className="px-2 py-2">Mã tem (quét)</th>
                  <th className="px-2 py-2">Khách hàng</th>
                  <th className="px-2 py-2">Đơn hàng</th>
                  <th className="px-2 py-2">Mã hàng</th>
                  <th className="px-2 py-2">Màu vải</th>
                  <th className="px-2 py-2">Kích vải</th>
                  <th className="px-2 py-2">Kích film</th>
                  <th className="px-2 py-2 text-right">{nhanSoCan}</th>
                  {truong.map((t) => (
                    <th key={t.k} className="px-2 py-2" style={t.minW ? { minWidth: t.minW } : { width: 96 }}>{t.label}</th>
                  ))}
                  <th className="px-2 py-2">Kiểm tra</th>
                  <th className="w-8 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {dong.map((d, i) => {
                  const r = d.row || {};
                  const ok = d.tt === 'OK';
                  const dg = dgCua(d);
                  return (
                    <tr key={d.id} className={`border-t border-line/70 align-middle ${d.kq ? 'bg-danger/5' : ''} ${ok && !d.tich ? 'opacity-60' : ''}`}>
                      <td className="px-2 py-1 text-center">
                        {ok && (
                          <input type="checkbox" aria-label="Tích dòng" checked={d.tich} disabled={dangLuu}
                            onChange={() => sua(d.id, { tich: !d.tich })} />
                        )}
                      </td>
                      <td className="px-1 py-1 text-right tabular-nums text-ink-soft">{i + 1}</td>
                      <td className="px-2 py-1">
                        {ok ? (
                          <span className="font-mono text-xs font-semibold text-primary">{maHien(r)}</span>
                        ) : (
                          <input ref={(el) => { refs.current[`${d.id}|ma`] = el; }} className={O_MA}
                            value={d.ma} placeholder="Quét / gõ mã tem…" disabled={d.tt === 'TRA' || dangLuu}
                            onChange={(e) => sua(d.id, { ma: e.target.value, tt: 'TRONG', chu: '' })}
                            onKeyDown={(e) => phim(e, d, 'ma')} />
                        )}
                      </td>
                      <td className="px-2 py-1 font-medium text-ink">{r.ten_khach_hang || ''}</td>
                      <td className="px-2 py-1">{r.ma_don_hang || ''}</td>
                      <td className="px-2 py-1 leading-tight">
                        <div>{r.ma_hang || ''}</div>
                        {r.ma_phan && <div className="text-[11px] text-ink-soft">{r.ma_phan}</div>}
                      </td>
                      <td className="px-2 py-1">{r.mau_vai || ''}</td>
                      <td className="px-2 py-1">{r.kich_vai || ''}</td>
                      <td className="px-2 py-1">{r.kich_phim || ''}</td>
                      <td className="px-2 py-1 text-right font-semibold tabular-nums text-primary">{ok ? fmtNum(soCan(r)) : ''}</td>
                      {truong.map((t) => (
                        <td key={t.k} className="px-1 py-1">
                          {ok && t.kieu === 'chon' && (
                            // ⚠ Ô chọn: Enter khi danh sách đang mở do Combobox xử lý (chọn mục, chặn nổi bọt) ⇒ `onChange` tự sang ô kế;
                            //   danh sách đóng thì Enter nổi lên đây ⇒ sang ô kế. ↑↓ để Combobox dùng.
                            <div ref={(el) => { refs.current[`${d.id}|${t.k}`] = el; }}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.defaultPrevented) { e.preventDefault(); oKe(d.id, t.k); } }}>
                              <SearchableSelect options={t.options} value={d.f[t.k] || ''} getSearch={t.getSearch}
                                placeholder={t.placeholder}
                                onChange={(v) => { setF(d.id, t.k, v); if (v) setTimeout(() => oKe(d.id, t.k), 80); }} />
                            </div>
                          )}
                          {ok && t.kieu !== 'chon' && (
                            <input ref={(el) => { refs.current[`${d.id}|${t.k}`] = el; }} type="number" min="0" inputMode="numeric"
                              className={O_SO} value={d.f[t.k] ?? ''} disabled={dangLuu}
                              onChange={(e) => setF(d.id, t.k, e.target.value)}
                              onKeyDown={(e) => phim(e, d, t.k)} />
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-xs">
                        {d.kq ? <span className="text-danger">✗ {d.kq}</span>
                          : d.tt === 'TRA' ? <span className="text-ink-soft">{d.chu}</span>
                            : d.tt === 'LOI' ? <span className="text-danger">{d.chu}</span>
                              : dg ? <span className={dg.ok ? (dg.motPhan ? 'text-amber-700 dark:text-amber-400' : 'text-success') : 'text-danger'}>{dg.chu}</span>
                                : null}
                      </td>
                      <td className="px-1 py-1 text-center">
                        {(ok || d.ma || dong.length > 1) && (
                          <button type="button" title="Bỏ dòng" className="text-ink-soft hover:text-danger disabled:opacity-40"
                            disabled={dangLuu} onClick={() => boDong(d.id)}><Icon name="x" size={14} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={hoiDong} onClose={() => setHoiDong(false)} variant="danger" confirmText="Đóng, bỏ dữ liệu"
        title="Đóng bảng tích tem?" message={`Còn ${dongOk.length} tem đã quét chưa xác nhận — đóng là bỏ số đã nhập.`}
        onConfirm={() => { setHoiDong(false); onClose(); }} />
    </>
  );
}
