import React, { useMemo, useState } from 'react';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import { Field, Input, Select } from '../../../components/common/controls';
import { tenCot } from './TemGrid';

// ─────────────────────────────────────────────────────────────────────────────
// PANEL BÊN PHẢI — NỘI DUNG của ô neo + kích thước hàng/cột.
// Định dạng (đậm/canh/viền/màu/cỡ chữ) đã dời lên THANH CÔNG CỤ vì nó áp cho cả vùng chọn;
// ở đây chỉ còn thứ chỉ có nghĩa với MỘT ô: nội dung ghép nối, trường mã QR, định dạng ngày.
// ─────────────────────────────────────────────────────────────────────────────

// Ô nhập nhỏ cho bảng luật rút gọn — KHÔNG dùng `Input` của controls (đã có w-full + h-11, class
// truyền thêm vô tác dụng vì Tailwind sinh .w-full sau .w-24 — bẫy §6 Hồ sơ kỹ thuật).
const O_NHO = 'h-7 w-24 rounded-control border border-line bg-surface px-1.5 text-base md:text-xs outline-none focus:border-primary';

export default function TemOPanel({
  khoa, o, dm, hang, cot, vung, soO,
  onDoiO, onDoiHang, onDoiCot,
}) {
  const [chuMoi, setChuMoi] = useState('');
  const [moThay, setMoThay] = useState(null);   // chỉ số mảnh đang mở bảng "tìm & thay"
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
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={o?.hien_ma !== false}
              onChange={(e) => onDoiO({ hien_ma: e.target.checked })} />
            Hiện chữ mã bên dưới hình
          </label>
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
              const datThay = (list) => doiPhan(i, { thay: list.filter((x) => x && (x.tu || x.thanh)) });
              return (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="rounded-control bg-surface-muted px-2 py-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    {p.loai === 'chu'
                      ? <><Icon name="type" size={12} className="text-ink-soft" /><span className="text-ink">“{p.gia_tri}”</span></>
                      : <><Icon name="database" size={12} className="text-primary" /><span className="text-ink">{truongMap[p.ma]?.ten || p.ma}</span></>}
                    <div className="ml-auto flex items-center gap-0.5">
                      {p.loai === 'truong' && (
                        <button type="button" title="Rút gọn cách hiển thị (tìm & thay)"
                          className={thay.length ? 'text-primary' : 'text-ink-soft hover:text-primary'}
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

                  {/* Tóm tắt luật rút gọn khi đang đóng */}
                  {p.loai === 'truong' && thay.length > 0 && moThay !== i && (
                    <div className="mt-0.5 text-[11px] text-primary">
                      rút gọn: {thay.map((r) => `“${r.tu}”→“${r.thanh || ''}”`).join(' · ')}
                    </div>
                  )}

                  {/* TÌM & THAY — đổi cách hiển thị mà KHÔNG đụng dữ liệu gốc.
                      vd "Ca 1" → luật “Ca ”→“C” ra "C1"; "Chuyền M4A-4B" → luật “Chuyền M”→“” ra "4A-4B". */}
                  {p.loai === 'truong' && moThay === i && (
                    <div className="mt-1.5 space-y-1 border-t border-line pt-1.5">
                      <div className="text-[11px] text-ink-soft">
                        Rút gọn khi in: thay chữ bên trái bằng chữ bên phải (để trống = xóa hẳn).
                      </div>
                      {thay.map((r, j) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <div key={j} className="flex items-center gap-1">
                          <input value={r.tu || ''} placeholder="Ca " className={O_NHO}
                            onChange={(e) => datThay(thay.map((x, k) => (k === j ? { ...x, tu: e.target.value } : x)))} />
                          <span className="text-ink-soft">→</span>
                          <input value={r.thanh || ''} placeholder="C" className={O_NHO}
                            onChange={(e) => datThay(thay.map((x, k) => (k === j ? { ...x, thanh: e.target.value } : x)))} />
                          <button type="button" title="Bỏ luật" className="text-ink-soft hover:text-danger"
                            onClick={() => datThay(thay.filter((_, k) => k !== j))}><Icon name="x" size={12} /></button>
                        </div>
                      ))}
                      <button type="button" className="text-[11px] font-medium text-primary hover:underline"
                        onClick={() => doiPhan(i, { thay: [...thay, { tu: '', thanh: '' }] })}>+ Thêm luật</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <Input placeholder="Chữ cố định…" value={chuMoi}
              onChange={(e) => setChuMoi(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); themChu(); } }} />
            <Button variant="secondary" onClick={themChu} disabled={!chuMoi}>Thêm</Button>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">Chèn trường dữ liệu bằng ô “+ Chèn trường…” trên thanh công cụ.</p>

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
