import React, { useMemo, useState } from 'react';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import { Field, Input, Select } from '../../../components/common/controls';

// ─────────────────────────────────────────────────────────────────────────────
// PANEL THUỘC TÍNH 1 Ô — nội dung (chữ cố định + trường dữ liệu) · kiểu ô (chữ/QR/mã vạch) ·
// cỡ chữ & tự co · in đậm/nghiêng/gạch · canh ngang–dọc · nền · màu chữ · xuống dòng · viền 4 cạnh
// · định dạng ngày · bề rộng cột / chiều cao hàng.
// ─────────────────────────────────────────────────────────────────────────────

const NUT = ({ bat, onClick, title, children }) => (
  <button type="button" title={title} onClick={onClick}
    className={`h-8 min-w-8 rounded-control border px-2 text-sm ${bat ? 'border-primary bg-primary/10 text-primary' : 'border-line text-ink-soft hover:text-ink'}`}>
    {children}
  </button>
);

export default function TemOPanel({ khoa, o, dm, hang, cot, onDoiO, onDoiHang, onDoiCot }) {
  const [chuMoi, setChuMoi] = useState('');
  const [truongMoi, setTruongMoi] = useState('');
  const phan = Array.isArray(o?.phan) ? o.phan : [];
  const vien = o?.vien || {};
  const truongMap = useMemo(
    () => Object.fromEntries((dm?.truong || []).map((t) => [t.ma, t])), [dm]
  );
  // Ô có mảnh trường kiểu NGÀY thì mới hiện ô "Định dạng ngày".
  const iNgay = phan.findIndex((p) => p.loai === 'truong' && (p.kieu || truongMap[p.ma]?.kieu) === 'ngay');

  const datPhan = (moi) => onDoiO({ phan: moi });
  const themChu = () => { if (chuMoi) { datPhan([...phan, { loai: 'chu', gia_tri: chuMoi }]); setChuMoi(''); } };
  const themTruong = () => {
    if (!truongMoi) return;
    const t = truongMap[truongMoi];
    datPhan([...phan, {
      loai: 'truong', ma: truongMoi, kieu: t?.kieu || 'chu',
      ...(t?.kieu === 'ngay' ? { dinh_dang: 'DD/MM/YY HH:mm' } : {}),
    }]);
    setTruongMoi('');
  };
  const xoaPhan = (i) => datPhan(phan.filter((_, j) => j !== i));

  const laMa = o?.kieu === 'qr' || o?.kieu === 'barcode';
  const nhomTruong = useMemo(() => {
    const g = {};
    (dm?.truong || []).forEach((t) => { (g[t.nhom] = g[t.nhom] || []).push(t); });
    return g;
  }, [dm]);

  return (
    <div className="space-y-3 rounded-control border border-line p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Ô đang chọn</span>
        <span className="text-xs text-ink-soft">hàng {Number(khoa.split(',')[0]) + 1} · cột {Number(khoa.split(',')[1]) + 1}
          {o?.cs > 1 || o?.rs > 1 ? ` · gộp ${o.rs || 1}×${o.cs || 1}` : ''}</span>
      </div>

      {/* KIỂU Ô */}
      <Field label="Kiểu ô">
        <Select value={o?.kieu || 'chu'} onChange={(e) => onDoiO({ kieu: e.target.value })}>
          <option value="chu">Chữ / dữ liệu</option>
          <option value="qr">Mã QR</option>
          <option value="barcode">Mã vạch (CODE128)</option>
        </Select>
      </Field>

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
        <>
          {/* NỘI DUNG: ghép nhiều mảnh (chữ cố định + trường) */}
          <div>
            <div className="mb-1 text-xs font-medium text-ink">Nội dung ô</div>
            {phan.length === 0 && <div className="mb-1 text-xs text-ink-soft">Ô trống (để công nhân ghi tay)</div>}
            <div className="mb-2 space-y-1">
              {phan.map((p, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="flex items-center gap-1.5 rounded-control bg-surface-muted px-2 py-1 text-xs">
                  {p.loai === 'chu'
                    ? <><Icon name="type" size={12} className="text-ink-soft" /><span className="text-ink">“{p.gia_tri}”</span></>
                    : <><Icon name="database" size={12} className="text-primary" /><span className="text-ink">{truongMap[p.ma]?.ten || p.ma}</span></>}
                  <button type="button" className="ml-auto text-ink-soft hover:text-danger" onClick={() => xoaPhan(i)}>
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input placeholder="Chữ cố định…" value={chuMoi}
                onChange={(e) => setChuMoi(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); themChu(); } }} />
              <Button variant="secondary" onClick={themChu} disabled={!chuMoi}>Thêm</Button>
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <Select value={truongMoi} onChange={(e) => setTruongMoi(e.target.value)}>
                <option value="">— Chèn trường dữ liệu —</option>
                {Object.entries(nhomTruong).map(([nhom, ts]) => (
                  <optgroup key={nhom} label={nhom}>
                    {ts.map((t) => <option key={t.ma} value={t.ma}>{t.ten}</option>)}
                  </optgroup>
                ))}
              </Select>
              <Button variant="secondary" onClick={themTruong} disabled={!truongMoi}>Chèn</Button>
            </div>
          </div>

          {iNgay >= 0 && (
            <Field label="Định dạng ngày giờ">
              <Select value={phan[iNgay].dinh_dang || 'DD/MM/YY HH:mm'}
                onChange={(e) => datPhan(phan.map((p, j) => (j === iNgay ? { ...p, dinh_dang: e.target.value } : p)))}>
                {(dm?.dinh_dang_ngay || []).map((d) => <option key={d.ma} value={d.ma}>{d.ten}</option>)}
              </Select>
            </Field>
          )}
        </>
      )}

      {/* CHỮ */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Cỡ chữ (mm)">
          <Input type="number" step="0.1" min="1" max="10" value={o?.co_chu_mm ?? 2.2}
            onChange={(e) => onDoiO({ co_chu_mm: Number(e.target.value) })} />
        </Field>
        <Field label="Màu chữ">
          <input type="color" className="h-11 w-full rounded-control border border-line"
            value={o?.mau_chu || '#000000'} onChange={(e) => onDoiO({ mau_chu: e.target.value })} />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" className="mt-0.5" checked={!!o?.tu_co} onChange={(e) => onDoiO({ tu_co: e.target.checked })} />
        <span>Tự co cỡ chữ cho vừa ô
          <span className="block text-xs text-ink-soft">Nội dung dài thì thu nhỏ dần khi in (tối đa còn 45% cỡ gốc) để không bị cắt mất chữ.</span>
        </span>
      </label>

      <div className="flex flex-wrap gap-1.5">
        <NUT bat={!!o?.dam} title="Đậm" onClick={() => onDoiO({ dam: !o?.dam })}><b>B</b></NUT>
        <NUT bat={!!o?.nghieng} title="Nghiêng" onClick={() => onDoiO({ nghieng: !o?.nghieng })}><i>I</i></NUT>
        <NUT bat={!!o?.gach_chan} title="Gạch chân" onClick={() => onDoiO({ gach_chan: !o?.gach_chan })}><u>U</u></NUT>
        <span className="mx-1 w-px bg-line" />
        {[['left', '⟸'], ['center', '≡'], ['right', '⟹']].map(([v, ic]) => (
          <NUT key={v} bat={(o?.ngang || 'center') === v} title={`Canh ${v}`} onClick={() => onDoiO({ ngang: v })}>{ic}</NUT>
        ))}
        <span className="mx-1 w-px bg-line" />
        {[['top', '↑'], ['middle', '↕'], ['bottom', '↓']].map(([v, ic]) => (
          <NUT key={v} bat={(o?.doc || 'middle') === v} title={`Canh dọc ${v}`} onClick={() => onDoiO({ doc: v })}>{ic}</NUT>
        ))}
        <span className="mx-1 w-px bg-line" />
        <NUT bat={o?.xuong_dong !== false} title="Cho xuống dòng"
          onClick={() => onDoiO({ xuong_dong: o?.xuong_dong === false })}>↵</NUT>
      </div>

      <Field label="Màu nền">
        <div className="flex gap-1.5">
          <input type="color" className="h-11 w-16 rounded-control border border-line"
            value={o?.nen || '#ffffff'} onChange={(e) => onDoiO({ nen: e.target.value })} />
          <Button variant="ghost" onClick={() => onDoiO({ nen: null })}>Không nền</Button>
          <Button variant="ghost" onClick={() => onDoiO({ nen: '#f1f1f1' })}>Xám nhạt</Button>
        </div>
      </Field>

      {/* VIỀN — tắt cạnh nào thì cạnh đó không in ra (trên lưới thiết kế hiện nét đứt mờ để còn thấy) */}
      <div>
        <div className="mb-1 text-xs font-medium text-ink">Đường kẻ (viền)</div>
        <div className="flex flex-wrap gap-1.5">
          {[['tren', 'Trên'], ['duoi', 'Dưới'], ['trai', 'Trái'], ['phai', 'Phải']].map(([k, nhan]) => (
            <NUT key={k} bat={vien[k] !== false} title={`Viền ${nhan.toLowerCase()}`}
              onClick={() => onDoiO({ vien: { [k]: vien[k] === false } })}>{nhan}</NUT>
          ))}
          <Button variant="ghost"
            onClick={() => onDoiO({ vien: { tren: true, duoi: true, trai: true, phai: true } })}>Kẻ hết</Button>
          <Button variant="ghost"
            onClick={() => onDoiO({ vien: { tren: false, duoi: false, trai: false, phai: false } })}>Ẩn hết</Button>
        </div>
      </div>

      {/* KÍCH THƯỚC HÀNG / CỘT */}
      <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
        <Field label="Cao hàng (mm)" hint="Để trống = tự giãn">
          <Input type="number" step="0.1" min="1" value={hang?.cao_mm ?? ''}
            onChange={(e) => onDoiHang({ cao_mm: e.target.value === '' ? null : Number(e.target.value) })} />
        </Field>
        <Field label="Rộng cột (mm)" hint="Để trống = chia đều">
          <Input type="number" step="0.1" min="1" value={cot?.rong_mm ?? ''}
            onChange={(e) => onDoiCot({ rong_mm: e.target.value === '' ? null : Number(e.target.value) })} />
        </Field>
      </div>
    </div>
  );
}
