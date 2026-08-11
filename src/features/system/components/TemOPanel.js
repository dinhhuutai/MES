import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import { Field, Input, Select, inputClass } from '../../../components/common/controls';
import { hienChuMa, giaTriMa, HE_MA_VACH, heMaCuaO } from '../../production/utils/renderMauTem';
import { tenCot } from './TemGrid';

// ─────────────────────────────────────────────────────────────────────────────
// PANEL BÊN PHẢI — NỘI DUNG của ô neo + kích thước hàng/cột.
// Định dạng (đậm/canh/viền/màu/cỡ chữ) đã dời lên THANH CÔNG CỤ vì nó áp cho cả vùng chọn;
// ở đây chỉ còn thứ chỉ có nghĩa với MỘT ô: nội dung ghép nối, trường mã QR, định dạng ngày.
// ─────────────────────────────────────────────────────────────────────────────

// Ô nhập nhỏ cho bảng luật rút gọn — KHÔNG dùng `Input` của controls (đã có w-full + h-11, class
// truyền thêm vô tác dụng vì Tailwind sinh .w-full sau .w-24 — bẫy §6 Hồ sơ kỹ thuật).
const O_NHO = 'h-7 w-24 rounded-control border border-line bg-surface px-1.5 text-base md:text-xs outline-none focus:border-primary';
const O_SO = 'h-7 w-12 rounded-control border border-line bg-surface px-1 text-base md:text-xs outline-none focus:border-primary';
const SEL_NHO = 'h-7 rounded-control border border-line bg-surface px-1 text-base md:text-xs outline-none focus:border-primary';

// KIỂU LUẬT đổi cách hiển thị — khớp `apDungThay` ở features/production/utils/renderMauTem.js.
// Thiếu `kieu` (dữ liệu cũ) = THAY.
const KIEU_LUAT = [
  { ma: 'THAY', ten: 'Tìm & thay' },
  { ma: 'VITRI', ten: 'Thay tại vị trí' },
  { ma: 'DAU', ten: 'Thêm vào đầu' },
  { ma: 'CUOI', ten: 'Thêm vào cuối' },
];

// Luật đã đủ thông tin để có tác dụng chưa (dùng cho badge + dòng tóm tắt, không dùng để LỌC BỎ —
// lọc bỏ khi đang gõ sẽ làm dòng luật biến mất giữa chừng).
const luatCoNghia = (r) => {
  if (!r) return false;
  if (r.kieu === 'DAU' || r.kieu === 'CUOI') return !!r.thanh;
  if (r.kieu === 'VITRI') return Number(r.vi_tri) > 0;
  return !!r.tu;
};

const moTaLuat = (r) => {
  const t = r.thanh || '';
  if (r.kieu === 'DAU') return `thêm đầu “${t}”`;
  if (r.kieu === 'CUOI') return `thêm cuối “${t}”`;
  if (r.kieu === 'VITRI') {
    const vt = Number(r.vi_tri) || 1;
    const n = Number(r.so_kt) || 0;
    const pham = n > 1 ? `ký tự ${vt}–${vt + n - 1}` : (n === 1 ? `ký tự ${vt}` : `chèn trước ký tự ${vt}`);
    return `${pham} → “${t}”`;
  }
  return `“${r.tu || ''}”→“${t}”`;
};

// BẢNG LUẬT ĐỔI CÁCH HIỂN THỊ — DÙNG CHUNG cho mảnh trường của ô chữ VÀ cho ô QR/mã vạch.
// ⚠ Khai ở MỨC MODULE, không lồng trong `TemOPanel`: component lồng bị dựng lại mỗi lần cha render ⇒
//   ô đang gõ MẤT FOCUS (bẫy §9 "Flicker" — đã mắc ở `RunPanel`).
function BangLuat({ thay, onDoi }) {
  const list = Array.isArray(thay) ? thay : [];
  // KHÔNG lọc bỏ luật rỗng: đang gõ dở mà dòng biến mất là mất thao tác.
  // Luật thiếu thông tin được `apDungThay` bỏ qua im lặng lúc in; bỏ hẳn thì bấm ✕.
  const doiLuat = (j, v) => onDoi(list.map((x, k) => (k === j ? { ...x, ...v } : x)));
  return (
    <div className="space-y-1.5">
      {list.map((r, j) => {
        const kieu = r.kieu || 'THAY';
        return (
          // eslint-disable-next-line react/no-array-index-key
          <div key={j} className="rounded-control border border-line px-1.5 py-1">
            <div className="flex items-center gap-1">
              <select value={kieu} className={SEL_NHO}
                onChange={(e) => {
                  const k = e.target.value;
                  // Đổi kiểu thì nạp mặc định hợp lý: VITRI mặc định thay ĐÚNG 1 ký tự.
                  doiLuat(j, k === 'VITRI'
                    ? { kieu: k, vi_tri: r.vi_tri || 1, so_kt: r.so_kt == null ? 1 : r.so_kt }
                    : { kieu: k });
                }}>
                {KIEU_LUAT.map((k) => <option key={k.ma} value={k.ma}>{k.ten}</option>)}
              </select>
              <button type="button" title="Bỏ luật" className="ml-auto text-ink-soft hover:text-danger"
                onClick={() => onDoi(list.filter((_, k) => k !== j))}><Icon name="x" size={12} /></button>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-ink-soft">
              {kieu === 'THAY' && (
                <>
                  <input value={r.tu || ''} placeholder="Ca " className={O_NHO}
                    onChange={(e) => doiLuat(j, { tu: e.target.value })} />
                  <span>→</span>
                  <input value={r.thanh || ''} placeholder="C" className={O_NHO}
                    onChange={(e) => doiLuat(j, { thanh: e.target.value })} />
                </>
              )}
              {kieu === 'VITRI' && (
                <>
                  <span>từ ký tự</span>
                  <input type="number" min="1" value={r.vi_tri ?? 1} className={O_SO}
                    onChange={(e) => doiLuat(j, { vi_tri: e.target.value === '' ? '' : Number(e.target.value) })} />
                  <span>, lấy</span>
                  <input type="number" min="0" value={r.so_kt ?? 1} className={O_SO}
                    onChange={(e) => doiLuat(j, { so_kt: e.target.value === '' ? '' : Number(e.target.value) })} />
                  <span>ký tự →</span>
                  <input value={r.thanh || ''} placeholder="để trống = xóa" className={O_NHO}
                    onChange={(e) => doiLuat(j, { thanh: e.target.value })} />
                  <span className="basis-full text-[10px]">
                    Đếm từ 1. Số ký tự = 0 thì chỉ chèn thêm, không xóa gì.
                  </span>
                </>
              )}
              {(kieu === 'DAU' || kieu === 'CUOI') && (
                <>
                  <span>{kieu === 'DAU' ? 'thêm vào đầu:' : 'thêm vào cuối:'}</span>
                  <input value={r.thanh || ''} placeholder={kieu === 'DAU' ? 'PO ' : ' m'} className={O_NHO}
                    onChange={(e) => doiLuat(j, { thanh: e.target.value })} />
                </>
              )}
            </div>
          </div>
        );
      })}
      <button type="button" className="text-[11px] font-medium text-primary hover:underline"
        onClick={() => onDoi([...list, { kieu: 'THAY', tu: '', thanh: '' }])}>+ Thêm luật</button>
    </div>
  );
}

export default function TemOPanel({
  khoa, o, dm, hang, cot, vung, soO, tinHieuChon, data,
  onDoiO, onDoiHang, onDoiCot,
}) {
  const [chuMoi, setChuMoi] = useState('');
  const [moThay, setMoThay] = useState(null);   // chỉ số mảnh đang mở bảng luật hiển thị
  const oNhapRef = useRef(null);
  const phan = Array.isArray(o?.phan) ? o.phan : [];
  const truongMap = useMemo(
    () => Object.fromEntries((dm?.truong || []).map((t) => [t.ma, t])), [dm]
  );
  // Ô có mảnh trường kiểu NGÀY thì mới hiện ô "Định dạng ngày".
  const iNgay = phan.findIndex((p) => p.loai === 'truong' && (p.kieu || truongMap[p.ma]?.kieu) === 'ngay');

  const datPhan = (moi) => onDoiO({ phan: moi });
  const themChu = () => { if (chuMoi) { datPhan([...phan, { loai: 'chu', gia_tri: chuMoi }]); setChuMoi(''); } };
  const xoaPhan = (i) => datPhan(phan.filter((_, j) => j !== i));
  const doiPhan = (i, v) => datPhan(phan.map((p, j) => (j === i ? { ...p, ...v } : p)));
  const doiChoPhan = (i, buoc) => {
    const j = i + buoc;
    if (j < 0 || j >= phan.length) return;
    const moi = [...phan];
    [moi[i], moi[j]] = [moi[j], moi[i]];
    datPhan(moi);
  };

  const laMa = o?.kieu === 'qr' || o?.kieu === 'barcode';

  // BẤM VÀO Ô LÀ GÕ ĐƯỢC NGAY — tự đưa con trỏ vào ô nhập nội dung.
  // ⚠ `preventScroll` vì panel phải là vùng cuộn riêng: focus không preventScroll sẽ giật panel lên/xuống.
  // ⚠ Xóa luôn chữ đang gõ dở khi ĐỔI Ô — nếu không, gõ ở ô này rồi bấm ô khác và Enter là chữ rơi nhầm ô.
  // ⚠ `tinHieuChon` chỉ đổi khi bấm chọn MỚI (không đổi lúc kéo chọn) ⇒ không cướp focus giữa lúc kéo.
  useEffect(() => {
    setChuMoi('');
    setMoThay(null);
    if (laMa) return;
    if (oNhapRef.current) oNhapRef.current.focus({ preventScroll: true });
  }, [khoa, laMa, tinHieuChon]);

  const nhomTruong = useMemo(() => {
    const g = {};
    (dm?.truong || []).forEach((t) => { (g[t.nhom] = g[t.nhom] || []).push(t); });
    return g;
  }, [dm]);

  const [r, c] = khoa.split(',').map(Number);

  return (
    <div className="space-y-3">
      <div className="rounded-control border border-line bg-surface-muted px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Ô {tenCot(c)}{r + 1}</span>
          <span className="text-xs text-ink-soft">
            {soO > 1 ? `${soO} ô đang chọn` : (o?.cs > 1 || o?.rs > 1 ? `gộp ${o.rs || 1}×${o.cs || 1}` : '1 ô')}
          </span>
        </div>
        {soO > 1 && (
          <p className="mt-1 text-[11px] text-ink-soft">
            Vùng {tenCot(vung.c1)}{vung.r1 + 1}:{tenCot(vung.c2)}{vung.r2 + 1} — định dạng trên thanh công cụ áp cho
            cả vùng; phần nội dung dưới đây chỉ sửa ô {tenCot(c)}{r + 1}.
          </p>
        )}
      </div>

      {laMa ? (
        <>
          <Field label="Mã hóa trường nào" hint="Thường là Mã tem — đã gắn sẵn tiền tố công đoạn">
            <Select value={o?.ma_qr || 'ma_tem'} onChange={(e) => onDoiO({ ma_qr: e.target.value })}>
              {Object.entries(nhomTruong).map(([nhom, ts]) => (
                <optgroup key={nhom} label={nhom}>
                  {ts.map((t) => <option key={t.ma} value={t.ma}>{t.ten}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
          {/* ⚠ Mặc định KHÁC NHAU giữa 2 loại — luật chung ở `renderMauTem.hienChuMa`:
              mã vạch mặc định KHÔNG hiện số (vạch đã đủ dữ liệu, đỡ tốn chỗ), QR thì có. */}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={hienChuMa(o)}
              onChange={(e) => onDoiO({ hien_ma: e.target.checked })} />
            Hiện dãy chữ mã bên dưới hình
          </label>
          <p className="-mt-2 text-[11px] text-ink-soft">
            {o?.kieu === 'barcode'
              ? 'Mã vạch mặc định chỉ in vạch (không in số) — vạch chiếm trọn chiều cao ô.'
              : 'QR mặc định in kèm dãy mã để đối chiếu bằng mắt.'}
          </p>

          {/* HỆ MÃ VẠCH — cùng dãy số nhưng mỗi hệ vẽ ra hình vạch khác hẳn, nên tem MES có thể trông
              không giống tem cũ. Chỉ liệt kê hệ mà máy quét của chính MES đọc được (xem HE_MA_VACH). */}
          {o?.kieu === 'barcode' && (
            <Field label="Hệ mã vạch" hint={HE_MA_VACH.find((h) => h.ma === heMaCuaO(o))?.mo_ta}>
              <Select value={heMaCuaO(o)} onChange={(e) => onDoiO({ he_ma: e.target.value })}>
                {HE_MA_VACH.map((h) => <option key={h.ma} value={h.ma}>{h.ten}</option>)}
              </Select>
            </Field>
          )}

          {/* LUẬT ĐỔI CÁCH HIỂN THỊ cho ô mã — cùng bảng luật với mảnh trường của ô chữ.
              ⚠ Khác một điểm CỐT TỬ: ở đây luật đổi LUÔN nội dung được MÃ HÓA vào QR/vạch, nên phải
                cảnh báo. Vì vậy hiện kết quả thật ngay bên dưới để người thiết kế thấy mình vừa làm gì. */}
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-1 text-xs font-medium text-ink">Đổi cách hiển thị mã</div>
            <BangLuat thay={o?.thay} onDoi={(list) => onDoiO({ thay: list })} />
            {data && (
              <div className="mt-2 rounded-control bg-surface-muted px-2 py-1.5 text-[11px]">
                <div className="text-ink-soft">Với dữ liệu mẫu:</div>
                <div className="mt-0.5 break-all font-mono text-ink">
                  {giaTriMa({ ...o, thay: null }, data) || '—'}
                  {(o?.thay || []).length > 0 && (
                    <> → <span className="font-semibold text-primary">{giaTriMa(o, data) || '(rỗng)'}</span></>
                  )}
                </div>
              </div>
            )}
            {(o?.thay || []).some(luatCoNghia) && (
              <div className="mt-2 rounded-control border border-warning/40 bg-warning/5 px-2 py-1.5 text-[11px] text-ink">
                <b>Lưu ý:</b> luật ở ô mã đổi <b>chính nội dung được mã hóa</b> (không chỉ chữ hiện ra).
                Máy quét ở KCS/Sửa/OQC sẽ đọc ra đúng chuỗi mới này — cắt bớt ký tự của mã tem là quét
                không ra tem nữa. Dùng để <i>thêm tiền tố/hậu tố</i> hoặc đổi công đoạn thì an toàn.
              </div>
            )}
          </div>
        </>
      ) : (
        <div>
          <div className="mb-1 text-xs font-medium text-ink">Nội dung ô</div>
          {phan.length === 0 && (
            <div className="mb-1 rounded-control border border-dashed border-line px-2 py-1.5 text-xs text-ink-soft">
              Ô trống (để công nhân ghi tay)
            </div>
          )}
          <div className="mb-2 space-y-1">
            {phan.map((p, i) => {
              const thay = Array.isArray(p.thay) ? p.thay : [];
              // KHÔNG lọc bỏ luật rỗng ở đây: đang gõ dở mà dòng biến mất là mất thao tác.
              // Luật thiếu thông tin được `apDungThay` bỏ qua im lặng lúc in; bỏ hẳn thì bấm nút ✕.
              const datThay = (list) => doiPhan(i, { thay: list });
              const coLuat = thay.filter(luatCoNghia);
              return (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="rounded-control bg-surface-muted px-2 py-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    {p.loai === 'chu'
                      ? <><Icon name="type" size={12} className="text-ink-soft" /><span className="text-ink">“{p.gia_tri}”</span></>
                      : <><Icon name="database" size={12} className="text-primary" /><span className="text-ink">{truongMap[p.ma]?.ten || p.ma}</span></>}
                    <div className="ml-auto flex items-center gap-0.5">
                      {p.loai === 'truong' && (
                        <button type="button" title="Đổi cách hiển thị (thay chữ / thay theo vị trí / thêm đầu-cuối)"
                          className={coLuat.length ? 'text-primary' : 'text-ink-soft hover:text-primary'}
                          onClick={() => setMoThay(moThay === i ? null : i)}><Icon name="pencil" size={12} /></button>
                      )}
                      <button type="button" title="Lên" className="text-ink-soft hover:text-primary disabled:opacity-30"
                        disabled={i === 0} onClick={() => doiChoPhan(i, -1)}><Icon name="chevron-up" size={12} /></button>
                      <button type="button" title="Xuống" className="text-ink-soft hover:text-primary disabled:opacity-30"
                        disabled={i === phan.length - 1} onClick={() => doiChoPhan(i, 1)}><Icon name="chevron-down" size={12} /></button>
                      <button type="button" title="Bỏ" className="text-ink-soft hover:text-danger"
                        onClick={() => xoaPhan(i)}><Icon name="x" size={12} /></button>
                    </div>
                  </div>

                  {/* Tóm tắt luật khi đang đóng */}
                  {p.loai === 'truong' && coLuat.length > 0 && moThay !== i && (
                    <div className="mt-0.5 text-[11px] text-primary">
                      đổi hiển thị: {coLuat.map(moTaLuat).join(' · ')}
                    </div>
                  )}

                  {/* ĐỔI CÁCH HIỂN THỊ — chỉ đổi lúc IN, KHÔNG đụng dữ liệu gốc.
                      Chạy lần lượt từ trên xuống, luật sau ăn kết quả của luật trước. */}
                  {p.loai === 'truong' && moThay === i && (
                    <div className="mt-1.5 space-y-1.5 border-t border-line pt-1.5">
                      <div className="text-[11px] text-ink-soft">
                        Đổi cách hiển thị khi in (dữ liệu gốc giữ nguyên). Các luật chạy lần lượt từ trên xuống.
                      </div>
                      <BangLuat thay={thay} onDoi={datThay} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Ô NHẬP NỘI DUNG — tự có con trỏ ngay khi bấm chọn ô trên lưới (xem useEffect ở trên).
              ⚠ Dùng <input> thuần chứ không phải `Input` của controls: component hàm KHÔNG nhận `ref`
                (React cảnh báo "Function components cannot be given refs"). Vẫn xài `inputClass` để
                giữ nguyên kiểu dáng + cỡ chữ `text-base md:text-sm` (iOS khỏi phóng to).
              ⚠ `data-o-nhap` để `TemDesignerModal` biết: ô này ĐANG TRỐNG thì phím mũi tên/Delete vẫn
                điều khiển lưới như khi chưa focus. */}
          <div className="flex gap-1.5">
            <input ref={oNhapRef} data-o-nhap="1" className={inputClass}
              placeholder="Gõ nội dung rồi Enter…" value={chuMoi}
              onChange={(e) => setChuMoi(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); themChu(); } }} />
            <Button variant="secondary" onClick={themChu} disabled={!chuMoi}>Thêm</Button>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">
            Bấm ô trên lưới là gõ được ngay. Chèn trường dữ liệu bằng ô “+ Chèn trường…” trên thanh công cụ.
          </p>

          {iNgay >= 0 && (
            <div className="mt-3">
              <Field label="Định dạng ngày giờ">
                <Select value={phan[iNgay].dinh_dang || 'DD/MM/YY HH:mm'}
                  onChange={(e) => doiPhan(iNgay, { dinh_dang: e.target.value })}>
                  {(dm?.dinh_dang_ngay || []).map((d) => <option key={d.ma} value={d.ma}>{d.ten}</option>)}
                </Select>
              </Field>
            </div>
          )}
        </div>
      )}

      {/* KÍCH THƯỚC HÀNG / CỘT — kéo mép trên lưới cũng đổi được, ô này để nhập số chính xác */}
      <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
        <Field label={`Cao hàng ${r + 1} (mm)`} hint="Trống = tự giãn">
          <Input type="number" step="0.1" min="1" value={hang?.cao_mm ?? ''}
            onChange={(e) => onDoiHang(e.target.value === '' ? null : Number(e.target.value))} />
        </Field>
        <Field label={`Rộng cột ${tenCot(c)} (mm)`} hint="Trống = chia đều">
          <Input type="number" step="0.1" min="1" value={cot?.rong_mm ?? ''}
            onChange={(e) => onDoiCot(e.target.value === '' ? null : Number(e.target.value))} />
        </Field>
      </div>
    </div>
  );
}
