import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// LƯỚI TEM (màn thiết kế) — vẽ 1 khung tem ĐÚNG TỈ LỆ THẬT để "xem sao in vậy".
//
// ⚠ KHÔNG dùng `renderKhung` (bộ render lúc in) ở đây: màn thiết kế cần từng ô là 1 phần tử React
//   bấm được / kéo chọn được, còn bộ render in trả về CHUỖI HTML. Hai bên chia nhau đúng một luật
//   duy nhất là hình dạng `bo_cuc_json` — nội dung ô lấy qua `noiDungO` dùng chung để không lệch.
// ─────────────────────────────────────────────────────────────────────────────

import { noiDungO } from '../../production/utils/renderMauTem';

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

const vienCss = (v = {}, mau = '#111827') => {
  const net = (b) => (b === false ? '1px dashed #d1d5db' : `1px solid ${mau}`); // tắt viền → nét đứt mờ để còn thấy lưới mà sửa
  return {
    borderTop: net(v.tren), borderBottom: net(v.duoi), borderLeft: net(v.trai), borderRight: net(v.phai),
  };
};

// `tiLe` = số px cho 1mm (khung 49mm rộng → tiLe ~ 8 cho dễ nhìn).
export default function TemGrid({ khung, data, chon, onChonO, tiLe = 8, nhan }) {
  if (!khung || !khung.so_cot) {
    return <div className="rounded-card border border-dashed border-line p-6 text-center text-sm text-ink-soft">Khung trống</div>;
  }
  const soCot = Number(khung.so_cot);
  const hang = Array.isArray(khung.hang) ? khung.hang : [];
  const cot = Array.isArray(khung.cot) ? khung.cot : [];
  const o = khung.o || {};
  const che = mapBiChe(khung);
  // Bề rộng còn lại chia đều cho các cột không đặt bề rộng cứng (giống colgroup lúc in).
  const rongCung = cot.reduce((s, c) => s + (Number(c?.rong_mm) || 0), 0);
  const soCotTuDo = cot.filter((c) => !Number(c?.rong_mm)).length || soCot;
  const rongTuDo = Math.max(0.5, (49 - rongCung) / soCotTuDo);

  return (
    <div className="inline-block">
      {nhan && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{nhan}</div>}
      {/* Khung ngoài = đúng vùng nội dung 49×78mm của tem thật */}
      <div className="border-2 border-primary/40 bg-white" style={{ width: 49 * tiLe, height: 78 * tiLe }}>
        <table className="h-full w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {Array.from({ length: soCot }, (_, i) => (
              <col key={i} style={{ width: (Number(cot[i]?.rong_mm) || rongTuDo) * tiLe }} />
            ))}
          </colgroup>
          <tbody>
            {hang.map((h, r) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={r} style={{ height: h?.cao_mm ? h.cao_mm * tiLe : 'auto' }}>
                {Array.from({ length: soCot }, (_, c) => {
                  const khoa = `${r},${c}`;
                  if (che.has(khoa)) return null;
                  const cell = o[khoa] || {};
                  const laMa = cell.kieu === 'qr' || cell.kieu === 'barcode';
                  const dangChon = chon === khoa;
                  const txt = laMa ? (cell.kieu === 'qr' ? '▣ QR' : '▮▮ Mã vạch') : noiDungO(cell, data);
                  return (
                    <td
                      key={khoa}
                      colSpan={cell.cs > 1 ? cell.cs : undefined}
                      rowSpan={cell.rs > 1 ? cell.rs : undefined}
                      onClick={() => onChonO && onChonO(khoa)}
                      title={`Ô ${khoa}`}
                      style={{
                        ...vienCss(cell.vien),
                        background: dangChon ? '#dbeafe' : (cell.nen || 'transparent'),
                        outline: dangChon ? '2px solid #0058be' : 'none',
                        color: cell.mau_chu || '#111827',
                        fontSize: Math.max(5, (Number(cell.co_chu_mm) || 2.2) * tiLe * 0.92),
                        fontWeight: cell.dam ? 700 : 400,
                        fontStyle: cell.nghieng ? 'italic' : 'normal',
                        textDecoration: cell.gach_chan ? 'underline' : 'none',
                        textAlign: cell.ngang || 'center',
                        verticalAlign: cell.doc || 'middle',
                        whiteSpace: cell.xuong_dong === false ? 'nowrap' : 'normal',
                        wordBreak: cell.xuong_dong === false ? 'normal' : 'break-word',
                        overflow: 'hidden',
                        padding: '0 1px',
                        cursor: 'pointer',
                        lineHeight: 1.05,
                      }}
                    >
                      {laMa ? <span className="text-[10px] text-ink-soft">{txt}</span> : txt}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
