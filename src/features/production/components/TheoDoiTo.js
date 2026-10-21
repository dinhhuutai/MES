import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import useSocketReload from '../../../hooks/useSocketReload';
import { getTheoDoiTo } from '../../../services/productionService';
import { ngayLocalISO } from '../../../utils/format';
import { dungTheoDoiTo, phanTram, GIO_NGAY_SX } from '../utils/theoDoiTo';

// ─────────────────────────────────────────────────────────────────────────────
// THEO DÕI SẢN XUẤT THEO TỔ (21/10/2026, người dùng gửi ảnh) — 2 chế độ nằm cạnh "Chuyền đang chạy" trên đầu modal
// *Theo dõi chuyền in*: "Tổng nhà máy" (bảng các tổ) · "Theo tổ" (chọn tổ → bảng chuyền → bấm chuyền → bảng lệnh +
// sơ đồ kế hoạch/thực tế theo giờ). Kế hoạch = lệnh có ngày SX KH (Release 1) = ngày xem; thực tế = tem của ngày SX
// (cùng luật Báo cáo sản xuất). Luật số: backend `production/theoDoiTo.js` + hàm thuần `utils/theoDoiTo.js`.
// Tự tải lại mỗi 30 giây + theo socket (tải ngầm, không spinner).
// ─────────────────────────────────────────────────────────────────────────────

const nf = (n) => Number(n || 0).toLocaleString('vi-VN');
const pad = (n) => String(n).padStart(2, '0');
const ngayVn = (iso) => { const [y, m, d] = String(iso || '').split('-'); return y ? `${d}/${m}/${y}` : '—'; };
const gioPhut = (t) => { if (!t) return ''; const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const chuPt = (p) => (p == null ? '—' : `${(Math.round(p * 10) / 10).toLocaleString('vi-VN')}%`);
const mauPt = (p) => (p == null ? 'text-ink-soft' : p >= 100 ? 'text-success' : 'text-danger');
const chenh = (tt, kh) => tt - kh;
const mauChenh = (v) => (v < 0 ? 'text-danger' : 'text-success');
const coDau = (v) => (v > 0 ? `+${nf(v)}` : nf(v));

// Tiêu đề lớn 2 dòng (tên bảng + ngày) như ảnh mẫu.
const TieuDe = ({ ten, ngay }) => (
  <div className="mb-3 text-center">
    <div className="text-lg font-bold uppercase tracking-wide text-primary sm:text-xl">{ten}</div>
    <div className="text-sm font-semibold text-danger">NGÀY: {ngayVn(ngay)}</div>
  </div>
);

// 1 dòng của bảng 5 cột (khai ở MỨC MODULE — bẫy component lồng §9 CLAUDE.md).
function DongTong({ r, dam, onChon }) {
  const o = 'px-3 py-2.5 text-center tabular-nums text-lg font-bold sm:text-2xl';
  const pt = phanTram(r.tt, r.kh);
  const c = chenh(r.tt, r.kh);
  const bam = onChon && r.chon !== false;
  return (
    <tr onClick={bam ? () => onChon(r) : undefined}
      className={`border-b border-line/70 ${dam ? 'bg-primary/5' : 'odd:bg-surface even:bg-surface-muted/40'} ${bam ? 'cursor-pointer hover:bg-primary/10' : ''}`}>
      <td className={`${o} text-ink`}>{r.ten}</td>
      <td className={`${o} text-ink`}>{nf(r.kh)}</td>
      <td className={`${o} text-ink`}>{nf(r.tt)}</td>
      <td className={`${o} ${mauPt(pt)}`}>{chuPt(pt)}</td>
      <td className={`${o} ${mauChenh(c)}`}>{coDau(c)}</td>
    </tr>
  );
}

// Bảng 5 cột Tên · Kế hoạch · Thực tế · % tiến độ · Chênh SL (dùng cho Tổng nhà máy + Chi tiết tổ).
function BangTong({ nhanCot, dong, tongDong, onChon }) {
  const th = 'bg-primary/10 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-primary sm:text-sm';
  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-[520px]">
        <thead>
          <tr>{[nhanCot, 'Kế hoạch', 'Thực tế', '% Tiến độ', 'Chênh SL'].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {tongDong && <DongTong r={tongDong} dam onChon={onChon} />}
          {dong.map((r) => <DongTong key={r.key} r={r} onChon={onChon} />)}
        </tbody>
      </table>
    </div>
  );
}

// Bảng 1 chuyền: cột = từng lệnh + Tổng; dòng = thông tin lệnh + số (khuôn ảnh "Bảng theo dõi sản xuất chuyền").
function BangChuyen({ c }) {
  const ds = c.lenh;
  const th = 'bg-primary/10 px-2 py-2 text-center text-xs font-bold uppercase text-primary';
  const nhan = 'bg-primary/5 px-2 py-2 text-center text-xs font-bold uppercase text-primary';
  // ⚠ `o` KHÔNG mang cỡ chữ / màu chữ — ô số tự thêm cỡ + màu; để chung là 2 lớp cùng loại đè nhau theo thứ tự CSS
  //   (đã gặp: ô Tổng ra chữ nhỏ, "0%" ra màu đen thay vì đỏ).
  const o = 'border-l border-line/60 px-2 py-2 text-center';
  const oChu = `${o} text-sm text-ink`;
  const dongChu = [
    ['Khách hàng', (l) => l.ten_khach_hang], ['Đơn hàng', (l) => l.ma_don_hang], ['Mã hàng', (l) => l.ma_hang],
    ['Code phần', (l) => l.ma_phan], ['Màu vải', (l) => l.mau_vai], ['Kích vải', (l) => l.kich_vai],
    ['Kích film', (l) => l.kich_phim],
    ['Thời gian SX', (l) => (l.tg_bd_kh || l.tg_kt_kh ? `${gioPhut(l.tg_bd_kh) || '?'} – ${gioPhut(l.tg_kt_kh) || '?'}` : '')],
  ];
  const so = (k, cls) => (
    <tr className="border-b border-line/70">
      <td className={nhan}>{k === 'kh' ? 'SL kế hoạch' : 'SL thực tế'}</td>
      {ds.map((l) => <td key={l.lenh_id} className={`${o} text-xl font-bold ${cls}`}>{nf(l[k])}</td>)}
      <td className={`${o} bg-primary/10 text-3xl font-extrabold ${cls}`}>{nf(c[k])}</td>
    </tr>
  );
  const ptTong = phanTram(c.tt, c.kh);
  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Lệnh</th>
            {ds.map((l, i) => (
              <th key={l.lenh_id} className={th}>
                <div>Lệnh {i + 1}</div>
                <div className="font-mono text-[11px] font-medium normal-case text-ink-soft">{l.ma_lenh_san_xuat}</div>
                {!l.la_ke_hoach && (
                  <div className="mt-0.5 normal-case"><Badge tone="warning">KH ngày {ngayVn(l.ngay_kh)}</Badge></div>
                )}
              </th>
            ))}
            <th className={th}>Tổng</th>
          </tr>
        </thead>
        <tbody>
          {dongChu.map(([ten, f]) => (
            <tr key={ten} className="border-b border-line/70">
              <td className={nhan}>{ten}</td>
              {ds.map((l) => <td key={l.lenh_id} className={oChu}>{f(l) || '—'}</td>)}
              <td className={`${o} text-sm text-ink-soft`}>—</td>
            </tr>
          ))}
          {so('kh', 'text-primary')}
          {so('tt', 'text-ink')}
          <tr className="border-b border-line/70">
            <td className={nhan}>Tiến độ thực hiện</td>
            {ds.map((l) => { const p = phanTram(l.tt, l.kh); return <td key={l.lenh_id} className={`${o} text-xl font-bold ${mauPt(p)}`}>{chuPt(p)}</td>; })}
            <td className={`${o} bg-primary/10 text-2xl font-extrabold ${mauPt(ptTong)}`}>{chuPt(ptTong)}</td>
          </tr>
          <tr>
            <td className={nhan}>Chênh lệch</td>
            {ds.map((l) => <td key={l.lenh_id} className={`${o} text-xl font-bold ${mauChenh(chenh(l.tt, l.kh))}`}>{coDau(chenh(l.tt, l.kh))}</td>)}
            <td className={`${o} bg-primary/10 text-2xl font-extrabold ${mauChenh(chenh(c.tt, c.kh))}`}>{coDau(chenh(c.tt, c.kh))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Sơ đồ kế hoạch / thực tế theo GIỜ của 1 lệnh — 24 ô 06:00 → 05:00. Giờ có kế hoạch ĐÃ QUA (`daQua`) mới chấm
// ✓ (thực tế ≥ kế hoạch) / ✗; giờ chưa tới để trống dấu.
function SoDoGio({ l, i, daQua }) {
  const o = 'min-w-[46px] border border-line/70 px-1 py-1 text-center text-xs tabular-nums';
  return (
    <div className="mb-4">
      <div className="mb-1 text-center text-xs font-semibold text-primary">
        Lệnh {i + 1} · {l.ma_lenh_san_xuat}{l.tg_bd_kh ? ` (${gioPhut(l.tg_bd_kh)} – ${gioPhut(l.tg_kt_kh)})` : ''}
      </div>
      <div className="overflow-x-auto">
        <table className="mx-auto border-collapse">
          <tbody>
            <tr><td className={`${o} bg-primary/5 font-bold text-primary`}>Giờ</td>
              {GIO_NGAY_SX.map((g) => <td key={g} className={`${o} bg-primary/5 font-semibold text-ink`}>{pad(g)}:00</td>)}</tr>
            <tr><td className={`${o} bg-primary/5 font-bold text-primary`}>Kế hoạch</td>
              {GIO_NGAY_SX.map((g) => <td key={g} className={o}>{l.khGio && l.khGio[g] ? nf(l.khGio[g]) : '-'}</td>)}</tr>
            <tr><td className={`${o} bg-primary/5 font-bold text-primary`}>Thực tế</td>
              {GIO_NGAY_SX.map((g) => {
                const kh = (l.khGio && l.khGio[g]) || 0;
                const tt = l.ttGio[g] || 0;
                const cham = kh > 0 && daQua(g);
                return (
                  <td key={g} className={o}>
                    <div className={tt ? 'font-semibold text-ink' : 'text-ink-soft'}>{kh || tt ? nf(tt) : '-'}</div>
                    {cham && <div className={tt >= kh ? 'text-success' : 'text-danger'}>{tt >= kh ? '✓' : '✗'}</div>}
                  </td>
                );
              })}</tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TheoDoiTo({ cheDo, onCheDo }) {
  const [ngay, setNgay] = useState(() => ngayLocalISO(new Date()));
  const [data, setData] = useState(null);
  const [loi, setLoi] = useState('');
  const [toId, setToId] = useState(undefined);   // tổ đang xem ở "Theo tổ" (undefined = tổ đầu)
  const [chuyenId, setChuyenId] = useState(null); // chuyền đang xem chi tiết

  const tai = useCallback(async () => {
    try {
      const res = await getTheoDoiTo(ngay);
      setData(res.data); setLoi('');
    } catch (e) { setLoi(e.message || 'Lỗi tải dữ liệu'); }
  }, [ngay]);
  useEffect(() => { setData(null); tai(); const t = setInterval(tai, 30000); return () => clearInterval(t); }, [tai]);
  useSocketReload(['production:updated'], tai, 1500);

  const cay = useMemo(() => dungTheoDoiTo(data), [data]);
  const toDangXem = cay.to.find((t) => t.id === toId) || (toId === undefined ? cay.to[0] : null) || cay.to[0] || null;
  const chuyenDangXem = toDangXem && chuyenId ? toDangXem.chuyen.find((c) => c.id === chuyenId) : null;

  // Giờ đã qua của ngày SX đang xem (06:00 → 06:00 hôm sau). Ngày cũ ⇒ mọi giờ đã qua; ngày tới ⇒ chưa giờ nào.
  const daQua = (g) => {
    const [y, m, d] = ngay.split('-').map(Number);
    const ngayGio = g < 6 ? d + 1 : d;
    return new Date(y, m - 1, ngayGio, g + 1).getTime() <= Date.now();
  };

  const thanhNgay = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-soft">Ngày SX</span>
      <input type="date" value={ngay} onChange={(e) => { if (e.target.value) { setNgay(e.target.value); setChuyenId(null); } }}
        className="h-9 rounded-input border border-line bg-surface px-2 text-sm outline-none focus:border-primary" />
      {ngay !== ngayLocalISO(new Date()) && (
        <Button chiXemOk variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setNgay(ngayLocalISO(new Date()))}>Hôm nay</Button>
      )}
      {data && !data.co_cot_to && (
        <Badge tone="warning">Chưa chạy migration 117 — chưa có tổ của chuyền</Badge>
      )}
    </div>
  );

  if (!data) {
    return (
      <div>
        {thanhNgay}
        <div className="flex justify-center py-16">{loi ? <span className="text-danger">{loi}</span> : <Spinner size={28} />}</div>
      </div>
    );
  }

  if (cheDo === 'tong') {
    return (
      <div className="mx-auto max-w-4xl">
        {thanhNgay}
        <TieuDe ten="Tổng nhà máy" ngay={ngay} />
        <BangTong nhanCot="Bộ phận"
          tongDong={{ key: 'tong', ten: 'TỔNG', kh: cay.tong.kh, tt: cay.tong.tt, chon: false }}
          dong={cay.to.map((t) => ({ key: t.id || 'chua', ten: t.ten, kh: t.kh, tt: t.tt, id: t.id }))}
          onChon={(r) => { setToId(r.id); setChuyenId(null); onCheDo('to'); }} />
      </div>
    );
  }

  return (
    <div className={chuyenDangXem ? '' : 'mx-auto max-w-4xl'}>
      {thanhNgay}
      <div className="mb-3 flex flex-wrap gap-2">
        {cay.to.map((t) => (
          <button key={t.id || 'chua'} type="button" onClick={() => { setToId(t.id); setChuyenId(null); }}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${toDangXem && toDangXem.id === t.id
              ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink hover:border-primary'}`}>
            {t.ten}
          </button>
        ))}
      </div>
      {!toDangXem ? (
        <div className="py-16 text-center text-ink-soft">Chưa có chuyền nào được gán tổ</div>
      ) : chuyenDangXem ? (
        <div>
          <TieuDe ten={`Bảng theo dõi sản xuất chuyền ${chuyenDangXem.ma_chuyen}`} ngay={ngay} />
          {chuyenDangXem.lenh.length ? <BangChuyen c={chuyenDangXem} />
            : <div className="py-10 text-center text-ink-soft">Chuyền này không có lệnh kế hoạch / sản lượng trong ngày</div>}
          {chuyenDangXem.lenh.length > 0 && (
            <div className="mt-4 rounded-card border border-line p-3">
              <div className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-primary">
                Sơ đồ kế hoạch &amp; thực tế theo giờ (chia theo từng lệnh)
              </div>
              {chuyenDangXem.lenh.map((l, i) => <SoDoGio key={l.lenh_id} l={l} i={i} daQua={daQua} />)}
            </div>
          )}
          <div className="mt-3 text-center">
            <Button chiXemOk variant="secondary" onClick={() => setChuyenId(null)}>Quay lại {toDangXem.ten}</Button>
          </div>
        </div>
      ) : (
        <div>
          <TieuDe ten={`Chi tiết ${toDangXem.ten}`} ngay={ngay} />
          <BangTong nhanCot="Chuyền"
            dong={toDangXem.chuyen.map((c) => ({ key: c.id, ten: c.ma_chuyen, kh: c.kh, tt: c.tt, id: c.id }))}
            onChon={(r) => setChuyenId(r.id)} />
          <div className="mt-3 text-center">
            <Button chiXemOk variant="secondary" onClick={() => onCheDo('tong')}>Quay lại trang tổng</Button>
          </div>
        </div>
      )}
    </div>
  );
}
