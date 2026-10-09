import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '../../../components/common/Icon';
import { ngayLocalISO } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// THÀNH PHẦN BẢNG BÁO CÁO SẢN XUẤT — trang *Sản xuất › Báo cáo sản xuất* (tách file 09/10/2026; khối báo cáo trên
// Dashboard dùng chung đã GỠ cùng ngày — người dùng: báo cáo chỉ nằm ở trang Báo cáo sản xuất). Mỗi cột-nhóm (Tổng · HC · CA1 · CA2 · CA3): SL kế hoạch · SL in thực tế · % (= TT / KH) · Số giờ KH ·
// Số giờ TT · C.lệch giờ (= TT − KH). Luật tính ở backend `utils/baoCaoSanXuat.js`.
// ─────────────────────────────────────────────────────────────────────────────

export const NHOM_CA = [
  { k: 'TONG', l: 'Tổng' }, { k: 'HC', l: 'HC' }, { k: 'CA1', l: 'CA1' }, { k: 'CA2', l: 'CA2' }, { k: 'CA3', l: 'CA3' },
];
const COT_SO = ['SL kế hoạch', 'SL in thực tế', '%', 'Số giờ KH', 'Số giờ TT', 'C.lệch giờ'];
export const TEN_CA = { NGAN: 'Ca ngắn · CA1–CA3', DAI: 'Ca dài · CA1–CA2', HANH_CHINH: 'Hành chính' };
export const TEN_LOAI_CA_RIENG = { MAY: 'Chuyền Máy', BAN: 'Chuyền Bàn', ROBOT: 'Chuyền Robot', KHAC: 'Chuyền khác' };

const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nhoXiu = (v) => Math.abs(Number(v) || 0) < 0.005;
const Gach = () => <span className="text-ink-soft/50">-</span>;

// Nền nhẹ xen kẽ cho từng cột-nhóm ca ⇒ mắt bám đúng cột trên bảng rất rộng.
const NEN_NHOM = {
  TONG: 'bg-primary-wash/40', HC: '', CA1: 'bg-surface-muted/40', CA2: '', CA3: 'bg-surface-muted/40',
};

// 'YYYY-MM-DD' → 'DD/MM/YYYY' bằng tách chuỗi (dựng Date từ chuỗi ISO là hiểu theo UTC ⇒ có thể lệch ngày).
export const hienNgay = (iso) => String(iso || '').split('-').reverse().join('/');

export const doiNgay = (iso, soNgay) => {
  const [y, m, d] = iso.split('-').map(Number);
  return ngayLocalISO(new Date(y, m - 1, d + soNgay));
};

// 6 ô số của 1 cột-nhóm ca.
export function OSo({ m, nhom, dam }) {
  const o = m || {};
  const kh = Number(o.kh) || 0;
  const tt = Number(o.tt) || 0;
  const lech = (Number(o.gt) || 0) - (Number(o.gk) || 0);
  const td = `px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${NEN_NHOM[nhom]} ${dam ? 'font-semibold' : ''}`;
  return (
    <>
      <td className={`${td} border-l border-line`}>{Math.round(kh) ? nf0.format(Math.round(kh)) : <Gach />}</td>
      <td className={td}>{tt ? nf0.format(tt) : <Gach />}</td>
      <td className={td}>{kh > 0 ? `${nf2.format((tt / kh) * 100)}%` : <Gach />}</td>
      <td className={td}>{nhoXiu(o.gk) ? <Gach /> : nf2.format(o.gk)}</td>
      <td className={td}>{nhoXiu(o.gt) ? <Gach /> : nf2.format(o.gt)}</td>
      <td className={`${td} ${lech > 0.005 ? 'text-rose-600 dark:text-rose-400' : lech < -0.005 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
        {nhoXiu(lech) ? <Gach /> : `${lech > 0 ? '+' : '−'}${nf2.format(Math.abs(lech))}`}
      </td>
    </>
  );
}

// 2 hàng tiêu đề: cột cố định (rowSpan 2) + 5 cột-nhóm ca × 6 cột số. Dính đầu bảng khi cuộn.
export function TieuDe({ cotTrai }) {
  const th = 'border-b border-line bg-surface-muted px-2 text-xs font-semibold text-ink whitespace-nowrap';
  return (
    <thead>
      <tr>
        {cotTrai.map((c) => (
          <th key={c.l} rowSpan={2} className={`${th} sticky top-0 z-30 h-[68px] text-left align-middle ${c.dinh || ''} ${c.w || ''}`}>{c.l}</th>
        ))}
        {NHOM_CA.map((n) => (
          <th key={n.k} colSpan={6} className={`${th} sticky top-0 z-20 h-8 border-l text-center ${n.k === 'TONG' ? 'text-primary' : ''}`}>{n.l}</th>
        ))}
      </tr>
      <tr>
        {NHOM_CA.map((n) => COT_SO.map((c, i) => (
          <th key={`${n.k}-${c}`} className={`${th} sticky top-8 z-20 h-9 text-right font-medium text-ink-soft ${i === 0 ? 'border-l' : ''}`}>{c}</th>
        )))}
      </tr>
    </thead>
  );
}

// Bảng tổng hợp 1 cột nhãn (nhóm chuyền / khách hàng…) + dòng Tổng cộng cuối bảng.
//   `dong` = [{ key, label, m }] · `tong` = m của Tổng cộng · `nhan` = tiêu đề cột nhãn · `rongNhan` = lớp bề rộng.
export function BangTong({ dong, tong, nhan = 'Chuyền', rongNhan = 'w-[84px] min-w-[84px] max-w-[84px]' }) {
  return (
    <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
      <TieuDe cotTrai={[{ l: nhan, dinh: 'left-0', w: rongNhan }]} />
      <tbody>
        {(dong || []).map((n) => (
          <tr key={n.key}>
            <td className={`sticky left-0 z-10 truncate border-b border-line/60 bg-surface px-2 py-1.5 text-ink ${rongNhan}`} title={n.label}>{n.label}</td>
            {NHOM_CA.map((c) => <OSo key={c.k} m={n.m[c.k]} nhom={c.k} />)}
          </tr>
        ))}
        <tr>
          <td className="sticky left-0 z-10 border-t-2 border-line bg-surface-muted px-2 py-2 font-bold text-ink">Tổng cộng</td>
          {NHOM_CA.map((n) => <OSo key={n.k} m={(tong || {})[n.k]} nhom={n.k} dam />)}
        </tr>
      </tbody>
    </table>
  );
}

// Dải chọn bảng — viên nền TRƯỢT theo nút đang chọn (đo vị trí thật của nút, không đoán bề rộng chữ).
//   `ds` = [{ v, label, icon }].
export function ChonBang({ ds, value, onChange }) {
  const refs = useRef({});
  const [vien, setVien] = useState(null);
  const do_ = useCallback(() => {
    const el = refs.current[value];
    if (el) setVien({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);
  useLayoutEffect(() => { do_(); }, [do_]);
  useEffect(() => {
    window.addEventListener('resize', do_);
    return () => window.removeEventListener('resize', do_);
  }, [do_]);
  return (
    <div role="tablist" className="relative inline-flex h-10 items-center rounded-full border border-line bg-surface-muted p-1">
      {vien && (
        <span aria-hidden="true"
          className="absolute bottom-1 top-1 rounded-full bg-surface shadow-sm ring-1 ring-line transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ left: vien.left, width: vien.width }} />
      )}
      {ds.map((b) => (
        <button key={b.v} type="button" role="tab" aria-selected={value === b.v}
          ref={(el) => { refs.current[b.v] = el; }}
          onClick={() => onChange(b.v)}
          className={`relative z-10 inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors duration-200 ${value === b.v ? 'text-primary' : 'text-ink-soft hover:text-ink'}`}>
          <Icon name={b.icon} size={15} />
          {b.label}
        </button>
      ))}
    </div>
  );
}

// Chọn ngày ‹ [date] › (không quá hôm nay).
export function ChonNgay({ ngay, setNgay, homNay }) {
  return (
    <div className="flex h-10 items-center rounded-input border border-line bg-surface">
      <button type="button" title="Ngày trước" onClick={() => setNgay((d) => doiNgay(d, -1))}
        className="flex h-full w-9 items-center justify-center text-ink-soft hover:text-ink">
        <Icon name="chevron-left" size={16} />
      </button>
      <input type="date" value={ngay} max={homNay}
        onChange={(e) => e.target.value && setNgay(e.target.value)}
        className="h-full border-x border-line bg-transparent px-2 text-sm text-ink outline-none" />
      <button type="button" title="Ngày sau" disabled={ngay >= homNay} onClick={() => setNgay((d) => doiNgay(d, 1))}
        className="flex h-full w-9 items-center justify-center text-ink-soft hover:text-ink disabled:opacity-30">
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  );
}

// Các nhãn loại ca của ngày (ca chung + loại chuyền cài riêng khác chung).
export function NhanLoaiCa({ data }) {
  if (!data) return null;
  return (
    <>
      <span className="rounded-full bg-surface-muted px-2 py-0.5" title={data.loai_ca_da_cai ? 'Theo cài đặt ca của tuần' : 'Tuần chưa cài loại ca — suy theo mã ca trên tem'}>
        {TEN_CA[data.loai_ca] || data.loai_ca}{data.loai_ca_da_cai ? '' : ' (theo tem)'}
      </span>
      {Object.entries(data.loai_ca_rieng || {}).map(([lc, ca]) => (
        <span key={lc} className="rounded-full bg-surface-muted px-2 py-0.5">
          {TEN_LOAI_CA_RIENG[lc] || lc}: {TEN_CA[ca] || ca}
        </span>
      ))}
    </>
  );
}
