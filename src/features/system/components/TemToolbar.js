import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/common/Icon';
import { SO_COT_MAX, SO_HANG_MAX, RONG_MM, CAO_MM } from '../utils/temLuoi';

// ─────────────────────────────────────────────────────────────────────────────
// THANH CÔNG CỤ trình Thiết kế tem — kiểu Google Sheets, DÍNH ĐỈNH modal.
// Mọi nút ở đây áp cho TOÀN BỘ VÙNG ĐANG CHỌN (trừ nhóm "Nội dung" — áp cho ô neo).
//
// ⚠⚠ KHÔNG dùng `Input`/`Select` của `components/common/controls`: `inputClass` đã có `w-full` + `h-11`,
//   mà Tailwind sinh `.w-full`/`.h-11` SAU `.w-24`/`.h-8` ⇒ class truyền thêm VÔ TÁC DỤNG, mỗi ô ăn
//   trọn bề rộng và rớt xuống dòng riêng (bẫy đã ghi ở CLAUDE.md §6 Hồ sơ kỹ thuật). Ở đây khai
//   class riêng nên không dính.
// ⚠ Cỡ chữ ô nhập giữ 16px trên mobile (`text-base md:text-sm`) — iOS tự phóng to trang khi focus
//   vào input < 16px và KHÔNG tự thu lại.
// ─────────────────────────────────────────────────────────────────────────────

const O_NHAP = 'h-8 rounded-control border border-line bg-surface px-2 text-base md:text-sm outline-none focus:border-primary';

function Nut({ bat, onClick, title, disabled, children }) {
  return (
    <button
      type="button" title={title} disabled={disabled} onClick={onClick}
      className={`inline-flex h-8 min-w-[2rem] items-center justify-center gap-1 rounded-control border px-2 text-xs font-medium transition
        disabled:cursor-not-allowed disabled:opacity-40
        ${bat ? 'border-primary bg-primary/10 text-primary' : 'border-line text-ink-soft hover:bg-surface-muted hover:text-ink'}`}
    >
      {children}
    </button>
  );
}

const Nhom = ({ children }) => (
  <div className="flex items-center gap-1 border-r border-line pr-2 last:border-r-0 last:pr-0">{children}</div>
);

export default function TemToolbar({
  dm, khung, vung, khoas, oNeo,
  onDinhDang, onVien, onGop, onTach,
  onThemHang, onXoaHang, onThemCot, onXoaCot,
  onXoaNoiDung, onXoaDinhDang, onChepDinhDang, onDanDinhDang, daChepDinhDang,
  onHoanTac, onLamLai, coHoanTac, coLamLai,
  onChenTruong, onDoiKieuO, onChiaLaiLuoi,
  tiLe, onZoom,
  deu,                 // (dk) => mọi ô trong vùng đều thỏa dk — cho trạng thái bật/tắt của nút
}) {
  // Ô nhập "chia lại lưới" bám theo khung đang mở, nhưng để người dùng gõ số khác rồi mới Áp dụng.
  const [oHang, setOHang] = useState(String(khung?.hang?.length || ''));
  const [oCot, setOCot] = useState(String(khung?.so_cot || ''));
  useEffect(() => {
    setOHang(String(khung?.hang?.length || ''));
    setOCot(String(khung?.so_cot || ''));
  }, [khung?.hang?.length, khung?.so_cot]);

  const co = khoas.length > 0;
  const nhieu = khoas.length > 1 || (vung && (vung.r1 !== vung.r2 || vung.c1 !== vung.c2));
  const laMa = oNeo?.kieu === 'qr' || oNeo?.kieu === 'barcode';

  const nhomTruong = useMemo(() => {
    const g = {};
    (dm?.truong || []).forEach((t) => { (g[t.nhom] = g[t.nhom] || []).push(t); });
    return g;
  }, [dm]);

  // Cỡ chữ hiện tại: lấy của ô neo (Excel cũng hiện của ô neo khi vùng nhiều cỡ khác nhau).
  const coChu = Number(oNeo?.co_chu_mm) || 2.2;
  const gianChu = Number(oNeo?.gian_chu_mm) || 0;
  const ngang = oNeo?.ngang || 'center';
  const doc = oNeo?.doc || 'middle';

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
      {/* Hoàn tác */}
      <Nhom>
        <Nut title="Hoàn tác (Ctrl+Z)" disabled={!coHoanTac} onClick={onHoanTac}><Icon name="undo" size={14} /></Nut>
        <Nut title="Làm lại (Ctrl+Y)" disabled={!coLamLai} onClick={onLamLai}><Icon name="redo" size={14} /></Nut>
      </Nhom>

      {/* Gộp / tách */}
      <Nhom>
        <Nut title="Gộp ô đang chọn" disabled={!nhieu} onClick={onGop}>
          <Icon name="merge" size={14} /> Gộp
        </Nut>
        <Nut title="Tách ô đã gộp" disabled={!co} onClick={onTach}>
          <Icon name="unmerge" size={14} /> Tách
        </Nut>
      </Nhom>

      {/* Hàng / cột */}
      <Nhom>
        <Nut title="Chèn hàng phía TRÊN vùng chọn" disabled={!co} onClick={() => onThemHang('tren')}>
          <Icon name="rows" size={14} />+↑
        </Nut>
        <Nut title="Chèn hàng phía DƯỚI vùng chọn" disabled={!co} onClick={() => onThemHang('duoi')}>
          <Icon name="rows" size={14} />+↓
        </Nut>
        <Nut title="Xóa các hàng đang chọn" disabled={!co} onClick={onXoaHang}>
          <Icon name="rows" size={14} />−
        </Nut>
        <Nut title="Chèn cột bên TRÁI vùng chọn" disabled={!co} onClick={() => onThemCot('trai')}>
          <Icon name="columns" size={14} />+←
        </Nut>
        <Nut title="Chèn cột bên PHẢI vùng chọn" disabled={!co} onClick={() => onThemCot('phai')}>
          <Icon name="columns" size={14} />+→
        </Nut>
        <Nut title="Xóa các cột đang chọn" disabled={!co} onClick={onXoaCot}>
          <Icon name="columns" size={14} />−
        </Nut>
      </Nhom>

      {/* Chữ */}
      <Nhom>
        <input
          type="number" step="0.1" min="1" max="12" value={coChu} disabled={!co}
          title="Cỡ chữ (mm)"
          // Bỏ qua giá trị rỗng/0 khi người dùng đang xóa để gõ lại — ghi 0 vào bố cục thì lúc in
          // rơi về mặc định 2.2mm, người dùng tưởng máy tự đổi cỡ chữ.
          onChange={(e) => { const n = Number(e.target.value); if (n > 0) onDinhDang({ co_chu_mm: n }); }}
          className={`${O_NHAP} w-16`}
        />
        <span className="text-[10px] text-ink-soft">mm</span>
        <input
          type="number" step="0.05" min="-1" max="5" value={gianChu} disabled={!co}
          title="Giãn chữ — khoảng cách giữa các ký tự (mm). Số ÂM = bóp chữ lại cho vừa ô hẹp."
          onChange={(e) => onDinhDang({ gian_chu_mm: Number(e.target.value) || 0 })}
          className={`${O_NHAP} w-16`}
        />
        <span className="text-[10px] text-ink-soft" title="Giãn chữ (mm)">giãn</span>
        <Nut title="Đậm" bat={deu((o) => !!o.dam)} disabled={!co}
          onClick={() => onDinhDang({ dam: !deu((o) => !!o.dam) })}><Icon name="bold" size={14} /></Nut>
        <Nut title="Nghiêng" bat={deu((o) => !!o.nghieng)} disabled={!co}
          onClick={() => onDinhDang({ nghieng: !deu((o) => !!o.nghieng) })}><Icon name="italic" size={14} /></Nut>
        <Nut title="Gạch chân" bat={deu((o) => !!o.gach_chan)} disabled={!co}
          onClick={() => onDinhDang({ gach_chan: !deu((o) => !!o.gach_chan) })}><Icon name="underline" size={14} /></Nut>
        <label title="Màu chữ" className="inline-flex h-8 items-center gap-1 rounded-control border border-line px-1.5">
          <Icon name="baseline" size={14} className="text-ink-soft" />
          <input type="color" disabled={!co} value={oNeo?.mau_chu || '#000000'}
            onChange={(e) => onDinhDang({ mau_chu: e.target.value })}
            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
        </label>
        <label title="Màu nền" className="inline-flex h-8 items-center gap-1 rounded-control border border-line px-1.5">
          <Icon name="paint-bucket" size={14} className="text-ink-soft" />
          <input type="color" disabled={!co} value={oNeo?.nen || '#ffffff'}
            onChange={(e) => onDinhDang({ nen: e.target.value })}
            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
        </label>
        <Nut title="Bỏ màu nền" disabled={!co} onClick={() => onDinhDang({ nen: null })}>
          <Icon name="square-dashed" size={14} />
        </Nut>
      </Nhom>

      {/* Canh lề */}
      <Nhom>
        {[['left', 'align-left'], ['center', 'align-center'], ['right', 'align-right']].map(([v, ic]) => (
          <Nut key={v} title={`Canh ngang: ${v}`} bat={ngang === v} disabled={!co}
            onClick={() => onDinhDang({ ngang: v })}><Icon name={ic} size={14} /></Nut>
        ))}
        {[['top', 'align-top'], ['middle', 'align-middle'], ['bottom', 'align-bottom']].map(([v, ic]) => (
          <Nut key={v} title={`Canh dọc: ${v}`} bat={doc === v} disabled={!co}
            onClick={() => onDinhDang({ doc: v })}><Icon name={ic} size={14} /></Nut>
        ))}
        <Nut title="Cho xuống dòng (tắt = ép 1 dòng)" bat={deu((o) => o.xuong_dong !== false)} disabled={!co}
          onClick={() => onDinhDang({ xuong_dong: !deu((o) => o.xuong_dong !== false) })}>
          <Icon name="wrap-text" size={14} />
        </Nut>
        <Nut title="Tự co cỡ chữ cho vừa ô khi in" bat={deu((o) => !!o.tu_co)} disabled={!co}
          onClick={() => onDinhDang({ tu_co: !deu((o) => !!o.tu_co) })}>
          <Icon name="maximize-2" size={14} />
        </Nut>
      </Nhom>

      {/* Chiều chữ — ngang / dọc đọc từ trên xuống / dọc đọc từ dưới lên */}
      <Nhom>
        <Nut title="Chữ nằm NGANG (mặc định)" bat={deu((o) => !Number(o.xoay))} disabled={!co}
          onClick={() => onDinhDang({ xoay: 0 })}>A→</Nut>
        <Nut title="Chữ nằm DỌC — đọc từ trên xuống" bat={deu((o) => Number(o.xoay) === 90)} disabled={!co}
          onClick={() => onDinhDang({ xoay: 90 })}>A↓</Nut>
        <Nut title="Chữ nằm DỌC — đọc từ dưới lên" bat={deu((o) => Number(o.xoay) === 270)} disabled={!co}
          onClick={() => onDinhDang({ xoay: 270 })}>A↑</Nut>
      </Nhom>

      {/* Viền */}
      <Nhom>
        <Nut title="Kẻ hết đường viền" disabled={!co} onClick={() => onVien('tat_ca')}>
          <Icon name="square" size={14} /> Kẻ hết
        </Nut>
        <Nut title="Chỉ kẻ viền ngoài vùng chọn" disabled={!co} onClick={() => onVien('ngoai')}>Ngoài</Nut>
        <Nut title="Chỉ kẻ các đường bên trong vùng chọn" disabled={!nhieu} onClick={() => onVien('trong')}>Trong</Nut>
        <Nut title="Bỏ hết đường viền" disabled={!co} onClick={() => onVien('khong')}>Bỏ viền</Nut>
        <span className="mx-0.5 text-[10px] text-ink-soft">cạnh:</span>
        {[['tren', 'Trên'], ['duoi', 'Dưới'], ['trai', 'Trái'], ['phai', 'Phải']].map(([k, nhan]) => (
          <Nut key={k} title={`Bật/tắt viền ${nhan.toLowerCase()}`} disabled={!co}
            bat={deu((o) => (o.vien || {})[k] !== false)}
            onClick={() => onDinhDang({ vien: { [k]: !deu((o) => (o.vien || {})[k] !== false) } })}>
            {nhan}
          </Nut>
        ))}
      </Nhom>

      {/* Nội dung ô neo */}
      <Nhom>
        <select
          value={oNeo?.kieu || 'chu'} disabled={!co}
          onChange={(e) => onDoiKieuO(e.target.value)}
          title="Kiểu ô" className={`${O_NHAP} w-28`}
        >
          <option value="chu">Chữ / dữ liệu</option>
          <option value="qr">Mã QR</option>
          <option value="barcode">Mã vạch</option>
        </select>
        <select
          value="" disabled={!co || laMa}
          onChange={(e) => { if (e.target.value) { onChenTruong(e.target.value); e.target.value = ''; } }}
          title="Chèn trường dữ liệu vào ô đang chọn" className={`${O_NHAP} w-40`}
        >
          <option value="">+ Chèn trường…</option>
          {Object.entries(nhomTruong).map(([nhom, ts]) => (
            <optgroup key={nhom} label={nhom}>
              {ts.map((t) => <option key={t.ma} value={t.ma}>{t.ten}</option>)}
            </optgroup>
          ))}
        </select>
      </Nhom>

      {/* Dọn dẹp + chổi quét định dạng */}
      <Nhom>
        <Nut title="Xóa nội dung, giữ định dạng (phím Delete)" disabled={!co} onClick={onXoaNoiDung}>
          <Icon name="eraser" size={14} />
        </Nut>
        <Nut title="Xóa định dạng, giữ nội dung" disabled={!co} onClick={onXoaDinhDang}>
          <Icon name="eraser" size={14} /> ĐD
        </Nut>
        <Nut title="Chép định dạng của ô đang chọn" disabled={!co} onClick={onChepDinhDang}>
          <Icon name="paintbrush" size={14} />
        </Nut>
        <Nut title="Dán định dạng đã chép vào vùng chọn" bat={daChepDinhDang} disabled={!co || !daChepDinhDang}
          onClick={onDanDinhDang}>Dán ĐD</Nut>
      </Nhom>

      {/* Chia lại lưới — đổi số hàng × số cột của khung đang mở */}
      <Nhom>
        <span className="text-[10px] text-ink-soft">Lưới</span>
        <input type="number" min="1" max={SO_HANG_MAX} value={oHang} title="Số hàng"
          onChange={(e) => setOHang(e.target.value)} className={`${O_NHAP} w-14`} />
        <span className="text-[10px] text-ink-soft">×</span>
        <input type="number" min="1" max={SO_COT_MAX} value={oCot} title="Số cột"
          onChange={(e) => setOCot(e.target.value)} className={`${O_NHAP} w-14`} />
        <Nut title={`Chia lại lưới thành ${oHang} hàng × ${oCot} cột (ô ${(RONG_MM / (Number(oCot) || 1)).toFixed(1)}×${(CAO_MM / (Number(oHang) || 1)).toFixed(1)}mm)`}
          disabled={!khung || (Number(oHang) === khung.hang.length && Number(oCot) === khung.so_cot)}
          onClick={() => onChiaLaiLuoi(Number(oHang), Number(oCot))}>Chia lại</Nut>
      </Nhom>

      {/* Thu phóng */}
      <Nhom>
        <Nut title="Thu nhỏ" disabled={tiLe <= 5} onClick={() => onZoom(-1)}><Icon name="zoom-out" size={14} /></Nut>
        <span className="min-w-[3rem] text-center text-xs text-ink-soft">{Math.round((tiLe / 8) * 100)}%</span>
        <Nut title="Phóng to" disabled={tiLe >= 16} onClick={() => onZoom(1)}><Icon name="zoom-in" size={14} /></Nut>
      </Nhom>

      {khung && (
        <span className="ml-auto text-[11px] text-ink-soft">
          ô ~{(RONG_MM / khung.so_cot).toFixed(1)}×{(CAO_MM / khung.hang.length).toFixed(1)}mm
        </span>
      )}
    </div>
  );
}
