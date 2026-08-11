import React, { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// LƯỚI TEM (màn thiết kế) — bảng tính kiểu Excel vẽ ĐÚNG TỈ LỆ THẬT để "xem sao in vậy":
//   · header cột A,B,C… + header hàng 1,2,3… + ô góc "chọn tất cả"
//   · KÉO CHỌN nhiều ô · Shift+bấm để nới vùng · bấm header chọn cả hàng/cột
//   · KÉO MÉP header để đổi bề rộng cột / chiều cao hàng (xem trước tại chỗ, chốt khi thả chuột)
//
// ⚠ KHÔNG dùng `renderKhung` (bộ render lúc in) ở đây: màn thiết kế cần từng ô là 1 phần tử React
//   bấm/kéo được, còn bộ render in trả về CHUỖI HTML. Hai bên chia nhau đúng một luật duy nhất là
//   hình dạng `bo_cuc_json` — nội dung ô lấy qua `noiDungO` dùng chung để không lệch.
//
// ⚠ Header nằm TRONG CÙNG <table> với dữ liệu (không tách div riêng): hàng có `cao_mm: null` tự giãn
//   nên JS không biết trước chiều cao — chỉ khi cùng một bảng thì header hàng mới luôn khớp dòng.
// ─────────────────────────────────────────────────────────────────────────────

import { noiDungO, cssChuDoc, caoHangMm } from '../../production/utils/renderMauTem';
import { RONG_MM, CAO_MM } from '../utils/temLuoi';

// Chuỗi CSS "a:b;c:d" → object cho React style.
const cssSangObj = (s) => Object.fromEntries((s || '').split(';').filter(Boolean).map((c) => {
  const i = c.indexOf(':');
  const ten = c.slice(0, i).trim().replace(/-([a-z])/g, (_, k) => k.toUpperCase());
  return [ten, c.slice(i + 1).trim()];
}));

const HDR_W = 26; // bề rộng cột header (px)
const HDR_H = 18; // chiều cao hàng header (px)
const XANH = '#0058be';

// Ô bị GỘP che → không vẽ (bản đồ dựng từ cs/rs của ô gốc). Dùng chung cách tính với bộ render in.
export function mapBiChe(khung) {
  const che = new Set();
  const o = (khung && khung.o) || {};
  for (const [k, cell] of Object.entries(o)) {
    const [r, c] = k.split(',').map(Number);
    const cs = Math.max(1, Number(cell.cs) || 1);
    const rs = Math.max(1, Number(cell.rs) || 1);
    for (let i = r; i < r + rs; i += 1) {
      for (let j = c; j < c + cs; j += 1) if (!(i === r && j === c)) che.add(`${i},${j}`);
    }
  }
  return che;
}

// Tên cột kiểu Excel: A…Z, AA…
export function tenCot(i) {
  let s = ''; let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

const vienCss = (v = {}) => {
  // Tắt viền → nét đứt mờ để còn THẤY lưới mà thao tác (khi in thì cạnh đó không ra giấy).
  const net = (b) => (b === false ? '1px dashed #d1d5db' : '1px solid #111827');
  return {
    borderTop: net(v.tren), borderBottom: net(v.duoi), borderLeft: net(v.trai), borderRight: net(v.phai),
  };
};

const thBase = 'select-none text-[10px] font-medium leading-none';

export default function TemGrid({
  khung, data, tiLe = 8, nhan,
  vung, neo, dangSua = true,
  onChon,           // (ben, tu{r,c}, den{r,c}, opts{giuNeo}) — cha tự chuẩn hóa + nới theo ô gộp
  onChonHet,        // (ben)
  onDoiRongCot,     // (c, mm)
  onDoiCaoHang,     // (r, mm)
  ben = 'trai',
}) {
  // Trạng thái KÉO: chọn vùng (o/hang/cot) hoặc kéo mép đổi kích thước.
  const keo = useRef(null);
  const [xemTruoc, setXemTruoc] = useState(null); // { loai:'cot'|'hang', i, mm } — chỉ để vẽ, chưa ghi
  const boc = useRef(null);

  // Kết thúc mọi thao tác kéo ở cấp DOCUMENT: thả chuột ngoài bảng vẫn phải dừng, nếu không lưới
  // sẽ "dính" chuột và tự chọn tiếp khi người dùng rê qua.
  useEffect(() => {
    const ketThuc = () => {
      const k = keo.current;
      keo.current = null;
      if (k && k.loai === 'rong' && k.mm != null) onDoiRongCot(k.i, k.mm);
      if (k && k.loai === 'cao' && k.mm != null) onDoiCaoHang(k.i, k.mm);
      setXemTruoc(null);
    };
    const diChuyen = (e) => {
      const k = keo.current;
      if (!k || (k.loai !== 'rong' && k.loai !== 'cao')) return;
      const px = k.loai === 'rong' ? k.px0 + (e.clientX - k.x0) : k.px0 + (e.clientY - k.y0);
      const mm = Math.max(1, Math.round((px / tiLe) * 10) / 10);
      k.mm = mm;
      setXemTruoc({ loai: k.loai === 'rong' ? 'cot' : 'hang', i: k.i, mm });
    };
    document.addEventListener('mouseup', ketThuc);
    document.addEventListener('mousemove', diChuyen);
    return () => {
      document.removeEventListener('mouseup', ketThuc);
      document.removeEventListener('mousemove', diChuyen);
    };
  }, [tiLe, onDoiRongCot, onDoiCaoHang]);

  if (!khung || !khung.so_cot) {
    return <div className="rounded-card border border-dashed border-line p-6 text-center text-sm text-ink-soft">Khung trống</div>;
  }

  const soCot = Number(khung.so_cot);
  const hang = Array.isArray(khung.hang) ? khung.hang : [];
  const cot = Array.isArray(khung.cot) ? khung.cot : [];
  const o = khung.o || {};
  const che = mapBiChe(khung);
  const soHang = hang.length;

  // Bề rộng cột: cột đặt cứng dùng đúng mm, phần còn lại chia đều (giống colgroup lúc in).
  const rongMm = (i) => {
    if (xemTruoc && xemTruoc.loai === 'cot' && xemTruoc.i === i) return xemTruoc.mm;
    return Number(cot[i]?.rong_mm) || null;
  };
  const caoMm = (i) => {
    if (xemTruoc && xemTruoc.loai === 'hang' && xemTruoc.i === i) return xemTruoc.mm;
    return Number(hang[i]?.cao_mm) || null;
  };
  let rongCung = 0; let nTuDo = 0;
  for (let i = 0; i < soCot; i += 1) { const w = rongMm(i); if (w) rongCung += w; else nTuDo += 1; }
  const rongTuDo = Math.max(0.5, (RONG_MM - rongCung) / (nTuDo || 1));
  const pxCot = (i) => (rongMm(i) || rongTuDo) * tiLe;

  // ⚠ Chiều cao hàng tính bằng CHÍNH hàm của bản in (`caoHangMm`) — hàng "tự giãn" chia đều phần
  //   trống còn lại. Trước đây chỉ đặt `height` cho hàng có `cao_mm` rồi để trình duyệt tự chia phần
  //   còn lại THEO NỘI DUNG ⇒ lưới thiết kế và bản in ra hai kiểu khác nhau (hàng trống bị bóp).
  //   Truyền `caoMm(i)` để lúc KÉO MÉP vẫn xem trước được tại chỗ.
  const caoHang = caoHangMm({ hang: hang.map((_, i) => ({ cao_mm: caoMm(i) })) });
  const pxHang = (i) => caoHang[i] * tiLe;

  const trongVung = (r, c) => !!vung && dangSua && r >= vung.r1 && r <= vung.r2 && c >= vung.c1 && c <= vung.c2;

  // ── Sự kiện chọn ───────────────────────────────────────────────────────────
  const bamO = (e, r, c) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (e.shiftKey && neo) {
      const [nr, nc] = neo.split(',').map(Number);
      keo.current = { loai: 'o', r: nr, c: nc };
      onChon(ben, { r: nr, c: nc }, { r, c }, { giuNeo: true });
      return;
    }
    keo.current = { loai: 'o', r, c };
    onChon(ben, { r, c }, { r, c });
  };
  const reO = (r, c) => {
    const k = keo.current;
    if (!k || k.loai !== 'o') return;
    onChon(ben, { r: k.r, c: k.c }, { r, c }, { giuNeo: true });
  };
  const bamHeaderCot = (e, c) => {
    if (e.button !== 0) return;
    e.preventDefault();
    keo.current = { loai: 'cot', c };
    onChon(ben, { r: 0, c }, { r: soHang - 1, c });
  };
  const reHeaderCot = (c) => {
    const k = keo.current;
    if (!k || k.loai !== 'cot') return;
    onChon(ben, { r: 0, c: k.c }, { r: soHang - 1, c }, { giuNeo: true });
  };
  const bamHeaderHang = (e, r) => {
    if (e.button !== 0) return;
    e.preventDefault();
    keo.current = { loai: 'hang', r };
    onChon(ben, { r, c: 0 }, { r, c: soCot - 1 });
  };
  const reHeaderHang = (r) => {
    const k = keo.current;
    if (!k || k.loai !== 'hang') return;
    onChon(ben, { r: k.r, c: 0 }, { r, c: soCot - 1 }, { giuNeo: true });
  };

  // ── Kéo mép đổi kích thước ─────────────────────────────────────────────────
  // Đo bề rộng/chiều cao THẬT từ DOM (hàng `cao_mm: null` tự giãn nên JS không tính trước được).
  const batDauKeoRong = (e, i) => {
    e.preventDefault(); e.stopPropagation();
    const th = e.currentTarget.parentElement;
    keo.current = { loai: 'rong', i, x0: e.clientX, px0: th ? th.getBoundingClientRect().width : pxCot(i), mm: null };
  };
  const batDauKeoCao = (e, i) => {
    e.preventDefault(); e.stopPropagation();
    const th = e.currentTarget.parentElement;
    keo.current = { loai: 'cao', i, y0: e.clientY, px0: th ? th.getBoundingClientRect().height : 3 * tiLe, mm: null };
  };

  return (
    <div className="inline-block">
      {nhan && (
        <div className={`mb-1 text-xs font-semibold uppercase tracking-wide ${dangSua ? 'text-primary' : 'text-ink-soft'}`}>
          {nhan}
        </div>
      )}
      <div ref={boc} className="relative inline-block bg-white" style={{ width: HDR_W + RONG_MM * tiLe }}>
        <table
          style={{
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            width: HDR_W + RONG_MM * tiLe,
            height: HDR_H + CAO_MM * tiLe,
          }}
        >
          <colgroup>
            <col style={{ width: HDR_W }} />
            {Array.from({ length: soCot }, (_, i) => <col key={i} style={{ width: pxCot(i) }} />)}
          </colgroup>
          <tbody>
            {/* Hàng header cột */}
            <tr style={{ height: HDR_H }}>
              <th
                className={`${thBase} border border-line bg-surface-muted text-ink-soft`}
                title="Chọn tất cả"
                onMouseDown={(e) => { e.preventDefault(); onChonHet(ben); }}
                style={{ cursor: 'pointer' }}
              />
              {Array.from({ length: soCot }, (_, c) => {
                const chonCaCot = !!vung && dangSua && vung.c1 <= c && c <= vung.c2;
                return (
                  <th
                    key={c}
                    className={`${thBase} relative border border-line ${chonCaCot ? 'bg-primary/20 text-primary' : 'bg-surface-muted text-ink-soft'}`}
                    style={{ cursor: 'pointer' }}
                    title={`Cột ${tenCot(c)} — ${(rongMm(c) || rongTuDo).toFixed(1)}mm${rongMm(c) ? '' : ' (tự chia)'}`}
                    onMouseDown={(e) => bamHeaderCot(e, c)}
                    onMouseEnter={() => reHeaderCot(c)}
                  >
                    {tenCot(c)}
                    {/* Tay nắm kéo bề rộng — nằm ở MÉP PHẢI của header cột, như Excel */}
                    <span
                      role="presentation"
                      onMouseDown={(e) => batDauKeoRong(e, c)}
                      className="absolute right-0 top-0 h-full w-[5px] hover:bg-primary/50"
                      style={{ cursor: 'col-resize' }}
                    />
                  </th>
                );
              })}
            </tr>

            {hang.map((h, r) => {
              const chonCaHang = !!vung && dangSua && vung.r1 <= r && r <= vung.r2;
              const hMm = caoMm(r);
              return (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={r} style={{ height: pxHang(r) }}>
                  <th
                    className={`${thBase} relative border border-line ${chonCaHang ? 'bg-primary/20 text-primary' : 'bg-surface-muted text-ink-soft'}`}
                    style={{ cursor: 'pointer' }}
                    title={`Hàng ${r + 1}${hMm ? ` — ${hMm}mm` : ' — tự giãn'}`}
                    onMouseDown={(e) => bamHeaderHang(e, r)}
                    onMouseEnter={() => reHeaderHang(r)}
                  >
                    {r + 1}
                    <span
                      role="presentation"
                      onMouseDown={(e) => batDauKeoCao(e, r)}
                      className="absolute bottom-0 left-0 w-full h-[5px] hover:bg-primary/50"
                      style={{ cursor: 'row-resize' }}
                    />
                  </th>

                  {Array.from({ length: soCot }, (_, c) => {
                    const khoa = `${r},${c}`;
                    if (che.has(khoa)) return null;
                    const cell = o[khoa] || {};
                    const cs = Math.max(1, Number(cell.cs) || 1);
                    const rs = Math.max(1, Number(cell.rs) || 1);
                    const laMa = cell.kieu === 'qr' || cell.kieu === 'barcode';
                    const chon = trongVung(r, c);
                    const laNeo = dangSua && neo === khoa;
                    const txt = laMa ? (cell.kieu === 'qr' ? '▣ QR' : '▮▮ Mã vạch') : noiDungO(cell, data);

                    // Viền vùng chọn vẽ bằng box-shadow inset (không đụng `border` của thiết kế).
                    // Thứ tự quan trọng: các cạnh vẽ TRƯỚC, lớp phủ xanh nhạt vẽ CUỐI (nằm dưới).
                    const bong = [];
                    if (chon) {
                      if (r === vung.r1) bong.push(`inset 0 2px 0 0 ${XANH}`);
                      if (r + rs - 1 === vung.r2) bong.push(`inset 0 -2px 0 0 ${XANH}`);
                      if (c === vung.c1) bong.push(`inset 2px 0 0 0 ${XANH}`);
                      if (c + cs - 1 === vung.c2) bong.push(`inset -2px 0 0 0 ${XANH}`);
                      if (!laNeo) bong.push('inset 0 0 0 999px rgba(0,88,190,0.12)');
                    }

                    return (
                      <td
                        key={khoa}
                        colSpan={cs > 1 ? cs : undefined}
                        rowSpan={rs > 1 ? rs : undefined}
                        onMouseDown={(e) => bamO(e, r, c)}
                        onMouseEnter={() => reO(r, c)}
                        title={`${tenCot(c)}${r + 1}${cs > 1 || rs > 1 ? ` · gộp ${rs}×${cs}` : ''}`}
                        style={{
                          ...vienCss(cell.vien),
                          background: cell.nen || 'transparent',
                          boxShadow: bong.length ? bong.join(',') : undefined,
                          color: cell.mau_chu || '#111827',
                          fontSize: Math.max(5, (Number(cell.co_chu_mm) || 2.2) * tiLe * 0.92),
                          fontWeight: cell.dam ? 700 : 400,
                          fontStyle: cell.nghieng ? 'italic' : 'normal',
                          textDecoration: cell.gach_chan ? 'underline' : 'none',
                          letterSpacing: Number(cell.gian_chu_mm) ? Number(cell.gian_chu_mm) * tiLe : undefined,
                          textAlign: cell.ngang || 'center',
                          verticalAlign: cell.doc || 'middle',
                          whiteSpace: cell.xuong_dong === false ? 'nowrap' : 'normal',
                          wordBreak: cell.xuong_dong === false ? 'normal' : 'break-word',
                          overflow: 'hidden',
                          padding: '0 1px',
                          cursor: 'cell',
                          lineHeight: 1.05,
                          userSelect: 'none',
                        }}
                      >
                        {(() => {
                          if (laMa) return <span className="text-[10px] text-ink-soft">{txt}</span>;
                          const doc = cssChuDoc(cell.xoay);
                          return doc ? <span style={cssSangObj(doc)}>{txt}</span> : txt;
                        })()}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Ranh giới vùng nội dung thật của tem (49×78mm) — chỉ để nhìn, không chắn chuột */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: HDR_W, top: HDR_H, width: RONG_MM * tiLe, height: CAO_MM * tiLe,
            border: `2px solid ${dangSua ? 'rgba(0,88,190,.55)' : 'rgba(148,163,184,.6)'}`,
          }}
        />
      </div>
    </div>
  );
}
