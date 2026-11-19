// ═════════════════════════════════════════════════════════════════════════════
// ROBOT của Agent MES THLA (19/11/2026) — SVG 3D bóng: đầu to, mặt kính đen, mắt đèn vàng, tay nổi, ăng-ten là
// bông hoa 5 cánh nhụy nâu đúng logo MES. KHÔNG viền tròn. 2 MẪU cùng dáng, mỗi người tự chọn ở Thông tin cá nhân
// (lưu `nguoi_dung.ai_mau_robot`, mặc định Vàng Nắng — gương BE `modules/ai/ai.service.js MAU_ROBOT`).
// Trạng thái (`data-state`): chao (vẫy tay) · nghi (đang tra dữ liệu) · noi (đang trả lời) · vui (nhún nhảy) · yen (rảnh,
//   chỉ chớp mắt). Khung chat đổi trạng thái theo việc đang làm — `AgentMesThla.js datCamXuc`.
// Id gradient / class đều mang tiền tố `agt` để không đụng SVG khác của app. CSS chuyển động: `agent.css`.
// Component React bọc chuỗi này: `RobotAgent.js` (⚠ đừng đặt tên `Robot.js` — Windows không phân biệt hoa thường).
// ═════════════════════════════════════════════════════════════════════════════

export const MAU_ROBOT = [
  { ma: 'VANG_NANG', ten: 'Vàng Nắng', mo_ta: 'Vỏ vàng bóng toàn thân, đúng màu chủ đạo của logo.' },
  { ma: 'VANG_KEM', ten: 'Vàng Kem', mo_ta: 'Vỏ trắng kem, vàng ở tai, tay, bụng và bông hoa. Nhẹ mắt hơn.' },
];
export const MAU_MAC_DINH = 'VANG_NANG';

const BANG_MAU = {
  VANG_NANG: {
    k: 'A', hd: ['#FFF9CC', '#FFE352', '#FFC800', '#EDA200'], shade: '#A35C00', bezel: ['#D08A00', '#FFD84A'],
    ear: ['#F7B500', '#D98E00'], earIn: '#FFF4C8', hand: ['#FFF4A8', '#F6B700'], belly: ['#FFFFFF', '#FFF0BC'],
    bellyRing: '#EFB000', canhBung: null, stem: '#C98600',
  },
  VANG_KEM: {
    k: 'B', hd: ['#FFFFFF', '#FFFDF7', '#F3ECDA', '#DCCFAE'], shade: '#7C6635', bezel: ['#C4B48C', '#F7F1E2'],
    ear: ['#FFD635', '#EBA800'], earIn: '#FFF7D6', hand: ['#FFF0A0', '#F2B400'], belly: ['#FFE869', '#F0B000'],
    bellyRing: '#E5A800', canhBung: '#FFFDF5', stem: '#C9A24A',
  },
};
const mauCua = (ma) => BANG_MAU[ma] || BANG_MAU[MAU_MAC_DINH];

const giamChuyenDong = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};

function defsMau(p) {
  const k = p.k;
  return `
<radialGradient id="agtHd${k}" cx=".36" cy=".26" r=".95" fx=".3" fy=".18"><stop offset="0" stop-color="${p.hd[0]}"/><stop offset=".3" stop-color="${p.hd[1]}"/><stop offset=".72" stop-color="${p.hd[2]}"/><stop offset="1" stop-color="${p.hd[3]}"/></radialGradient>
<linearGradient id="agtSh${k}" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="${p.shade}" stop-opacity="0"/><stop offset="1" stop-color="${p.shade}" stop-opacity=".32"/></linearGradient>
<linearGradient id="agtBz${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.bezel[0]}"/><stop offset="1" stop-color="${p.bezel[1]}"/></linearGradient>
<linearGradient id="agtEr${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.ear[0]}"/><stop offset="1" stop-color="${p.ear[1]}"/></linearGradient>
<radialGradient id="agtHn${k}" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="${p.hand[0]}"/><stop offset="1" stop-color="${p.hand[1]}"/></radialGradient>
<radialGradient id="agtBl${k}" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="${p.belly[0]}"/><stop offset="1" stop-color="${p.belly[1]}"/></radialGradient>`;
}

export const ROBOT_DEFS = `${defsMau(BANG_MAU.VANG_NANG)}${defsMau(BANG_MAU.VANG_KEM)}
<linearGradient id="agtVsr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E3649"/><stop offset="1" stop-color="#0D111B"/></linearGradient>
<linearGradient id="agtVsrG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="agtPtl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF27E"/><stop offset="1" stop-color="#FFD300"/></linearGradient>
<radialGradient id="agtCore" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#A88D6C"/><stop offset="1" stop-color="#6A543F"/></radialGradient>
<radialGradient id="agtHov"><stop offset="0" stop-color="#FFD84A" stop-opacity=".75"/><stop offset="1" stop-color="#FFD84A" stop-opacity="0"/></radialGradient>
<filter id="agtEyeGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="b"/><feFlood flood-color="#FFC21A" flood-opacity=".95"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="agtSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.3"/></filter>
<filter id="agtAo" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="4"/></filter>
<clipPath id="agtVsrClip"><rect x="59" y="67" width="122" height="84" rx="40"/></clipPath>
<clipPath id="agtBodyClip"><ellipse cx="120" cy="207" rx="42" ry="36"/></clipPath>
<path id="agtPtlP" d="M0,-4 C-7,-6 -11.5,-12 -10,-17 C-8.5,-22 8.5,-22 10,-17 C11.5,-12 7,-6 0,-4 Z"/>`;

function hoa(cx, cy, s, xoay, mauCanh) {
  const canh = [0, 72, 144, 216, 288].map((a) => `<use href="#agtPtlP" transform="rotate(${a})" fill="${mauCanh || 'url(#agtPtl)'}" stroke="#E2AE00" stroke-width="1"/>`).join('');
  const anim = xoay && !giamChuyenDong() ? '<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="20s" repeatCount="indefinite"/>' : '';
  return `<g transform="translate(${cx} ${cy}) scale(${s})"><g>${anim}${canh}</g><circle r="6.6" fill="url(#agtCore)"/><circle cx="-2.2" cy="-2.4" r="1.9" fill="#fff" opacity=".45"/></g>`;
}

function mat() {
  const G = ' filter="url(#agtEyeGlow)"';
  const C = '#FFF6D2';
  const mat1 = (x) => `<g class="agt-eye"><rect x="${x - 8}" y="93" width="16" height="26" rx="8" fill="${C}"/></g>`;
  const cung = (x) => `<path d="M${x - 10} 112 Q${x} 92 ${x + 10} 112"/>`;
  return `<g class="agt-f agt-f-eyes"${G}>${mat1(100)}${mat1(140)}</g>`
    + `<g class="agt-f agt-f-happy"${G} fill="none" stroke="${C}" stroke-width="5.5" stroke-linecap="round">${cung(100)}${cung(140)}</g>`
    + `<g class="agt-f agt-f-think"${G}><circle cx="104" cy="101" r="7.5" fill="${C}"/><circle cx="144" cy="99" r="7.5" fill="${C}"/></g>`
    + `<g class="agt-f agt-f-smile"${G}><path d="M110 129 Q120 136 130 129" fill="none" stroke="${C}" stroke-width="3.6" stroke-linecap="round"/></g>`
    + `<g class="agt-f agt-f-big"${G}><path d="M108 125 Q120 141 132 125 Z" fill="${C}"/></g>`
    + `<g class="agt-f agt-f-talk"${G}><rect class="agt-mouth" x="112" y="125" width="16" height="10" rx="5" fill="${C}"/></g>`
    + `<g class="agt-f agt-f-dots"${G}>${[109, 120, 131].map((x) => `<circle cx="${x}" cy="131" r="3" fill="${C}"/>`).join('')}</g>`;
}

function tay(cx, cy, rot, k) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="12" ry="14.5" transform="rotate(${rot} ${cx} ${cy})" fill="url(#agtHn${k})"/>`
    + `<ellipse cx="${cx - 3}" cy="${cy - 6}" rx="4" ry="2.4" transform="rotate(${rot - 20} ${cx - 3} ${cy - 6})" fill="#fff" opacity=".7" filter="url(#agtSoft)"/>`;
}

/** Chuỗi SVG robot. `dau` = chỉ phần đầu (ảnh đại diện / nút thu gọn). `mau` = VANG_NANG | VANG_KEM. */
export function robotSvg(trangThai = 'chao', dau = false, mau = MAU_MAC_DINH) {
  const p = mauCua(mau);
  const k = p.k;
  const vb = dau ? '22 -16 196 196' : '0 -16 240 286';
  const vay = dau ? '' : `<g class="agt-wave" style="transform-origin:196px 188px">${tay(207, 158, 28, k)}</g>`;
  const than = dau ? '' : `
    <ellipse cx="120" cy="252" rx="30" ry="6" fill="url(#agtHov)"/>
    <g>${tay(68, 212, -18, k)}</g>
    <g class="agt-arm-r">${tay(172, 212, 18, k)}</g>
    <ellipse cx="120" cy="207" rx="42" ry="36" fill="url(#agtHd${k})"/>
    <ellipse cx="120" cy="207" rx="42" ry="36" fill="url(#agtSh${k})"/>
    <g clip-path="url(#agtBodyClip)"><ellipse cx="120" cy="172" rx="38" ry="10" fill="${p.shade}" opacity=".35" filter="url(#agtAo)"/></g>
    <ellipse cx="98" cy="190" rx="9" ry="4.5" transform="rotate(-28 98 190)" fill="#fff" opacity=".75" filter="url(#agtSoft)"/>
    <circle cx="120" cy="212" r="17.5" fill="url(#agtBl${k})" stroke="${p.bellyRing}" stroke-width="1.5"/>
    ${hoa(120, 212, 0.5, false, p.canhBung)}`;
  return `<svg class="agt-bot${dau ? ' agt-bot-dau' : ''}" data-state="${trangThai}" viewBox="${vb}" role="img" aria-label="Robot Agent MES THLA" xmlns="http://www.w3.org/2000/svg">`
    + (dau ? '' : '<ellipse class="agt-shadow" cx="120" cy="263" rx="44" ry="5.5"/>')
    + `<g class="agt-float">${than}<g class="agt-headg">
      <g class="agt-ant">
        <path d="M120 40 Q117 24 121 10" fill="none" stroke="${p.stem}" stroke-width="3.6" stroke-linecap="round"/>
        ${hoa(121, 7, 0.95, true)}
        <rect x="110" y="34" width="20" height="12" rx="6" fill="url(#agtEr${k})"/>
      </g>
      <rect x="27" y="86" width="24" height="46" rx="12" fill="url(#agtEr${k})"/>
      <rect x="31.5" y="98" width="7" height="22" rx="3.5" fill="${p.earIn}" opacity=".9"/>
      <rect x="189" y="86" width="24" height="46" rx="12" fill="url(#agtEr${k})"/>
      <rect x="201.5" y="98" width="7" height="22" rx="3.5" fill="${p.earIn}" opacity=".9"/>
      <rect x="40" y="42" width="160" height="132" rx="58" fill="url(#agtHd${k})"/>
      <rect x="40" y="42" width="160" height="132" rx="58" fill="url(#agtSh${k})"/>
      <ellipse cx="84" cy="59" rx="24" ry="7.5" transform="rotate(-16 84 59)" fill="#fff" opacity=".85" filter="url(#agtSoft)"/>
      <ellipse cx="116" cy="50" rx="5" ry="2.6" fill="#fff" opacity=".7" filter="url(#agtSoft)"/>
      <rect x="55" y="63" width="130" height="92" rx="44" fill="url(#agtBz${k})"/>
      <rect x="59" y="67" width="122" height="84" rx="40" fill="url(#agtVsr)"/>
      <g clip-path="url(#agtVsrClip)"><ellipse cx="104" cy="60" rx="84" ry="34" fill="url(#agtVsrG)"/></g>
      <rect x="59.75" y="67.75" width="120.5" height="82.5" rx="39.25" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="1.5"/>
      <ellipse cx="81" cy="131" rx="8" ry="4.5" fill="#FF86A6" opacity=".5" filter="url(#agtSoft)"/>
      <ellipse cx="159" cy="131" rx="8" ry="4.5" fill="#FF86A6" opacity=".5" filter="url(#agtSoft)"/>
      ${mat()}
    </g>${vay}</g></svg>`;
}
