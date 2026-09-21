import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import DateRangePicker from '../../../components/common/DateRangePicker';
import { layBangTheoDoi } from '../../../services/siSoService';
import { fmtNum } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// BẢNG THEO DÕI THỰC HIỆN CỦA CÁC CHECK POINT (Dashboard → Tổng quan, 20/09/2026)
//
// Dựng lại đúng tờ giấy xưởng đang dùng: 10 dòng × 5 cụm (TỒN ĐẦU · NHẬN · XONG · TỒN CUỐI · NGHẼN),
// mỗi cụm có **Phần** (số phần in) và **SL** (pcs). Nguồn số = engine sĩ số (`utils/siSoTram.js`) nên
// 4 ô đầu KHỚP TUYỆT ĐỐI với dải "Theo dõi" của 12 màn xác nhận.
//
// ⚠⚠ Σ 10 DÒNG LỚN HƠN TỔNG SỐ PHẦN IN LÀ ĐÚNG — MES đi theo ĐỢT VẢI nên một code phần có thể nằm ở
//   nhiều checkpoint cùng lúc (release một phần ⇒ vừa còn Release 1 vừa đã sang Test Run). Đây KHÔNG
//   phải các ô "Tổng quan giai đoạn" ngay dưới (mỗi phần in đúng 1 trạm). Đừng "sửa cho khớp".
// ⚠ Cột SL đổi đại lượng theo trạm (vải → tem) — tooltip của từng dòng ghi rõ đang đo gì.
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
// Ngày VN — ⚠ KHÔNG `toISOString()` (giờ VN trước 07:00 sẽ lùi 1 ngày).
const homNayVN = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const TH1 = 'border border-line px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide';
const TH2 = 'border border-line px-2 py-1 text-center text-[11px] font-semibold';
const TD = 'border border-line px-2 py-1 text-right text-xs tabular-nums';

// Ô % — rỗng (mẫu số 0) hiện "—" chứ KHÔNG phải 0%: "0% trên 0 mẫu" khác hẳn "0% trên 100 mẫu".
const Pt = ({ v, canhBao }) => {
  if (v === null || v === undefined) return <span className="text-ink-soft">—</span>;
  return <span className={canhBao && v > 0 ? 'font-semibold text-danger' : ''}>{Math.round(v * 10) / 10}%</span>;
};

export default function BangTheoDoi() {
  const [range, setRange] = useState(() => ({ from: homNayVN(), to: homNayVN() }));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loi, setLoi] = useState('');

  const khoa = `${range.from}|${range.to}`;
  const load = useCallback(async () => {
    setLoading(true);
    setLoi('');
    try {
      const r = await layBangTheoDoi({ tu: range.from || homNayVN(), den: range.to || range.from || homNayVN() });
      setData(r.data);
    } catch (e) {
      // ⚠ Bảng này là số liệu tổng hợp — hỏng nó KHÔNG được chặn phần còn lại của Dashboard.
      setLoi(e.message || 'Không tải được bảng theo dõi');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [khoa]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => data?.rows || [], [data]);
  const lech = useMemo(() => rows.filter((r) => !r.can).length, [rows]);

  // Dòng TỔNG — cộng dọc 10 checkpoint. ⚠ Con số này KHÔNG phải "tổng phần in của nhà máy" (một
  // phần in nằm ở nhiều trạm) mà là TỔNG LƯỢT VIỆC đang nằm trên 10 checkpoint.
  const tong = useMemo(() => {
    const c = (k, f) => rows.reduce((s, r) => s + (Number(r[k][f]) || 0), 0);
    // ⚠ % ở dòng Tổng tính theo cột **Phần** (giống hệt từng dòng) — backend cũng trả `pt_sl` nhưng
    //   bảng chỉ có MỘT ô % cho mỗi cụm, trộn 2 mẫu số vào một ô là không đọc ra được gì.
    const vao = c('ton_dau', 'phan') + c('nhan', 'phan');
    const pt = (t, m) => (m > 0 ? (t / m) * 100 : null);
    return {
      ton_dau: { phan: c('ton_dau', 'phan'), sl: c('ton_dau', 'sl') },
      nhan: { phan: c('nhan', 'phan'), sl: c('nhan', 'sl') },
      xong: { phan: c('xong', 'phan'), sl: c('xong', 'sl'), pt: pt(c('xong', 'phan'), vao) },
      ton_cuoi: { phan: c('ton_cuoi', 'phan'), sl: c('ton_cuoi', 'sl'), pt: pt(c('ton_cuoi', 'phan'), vao) },
      nghen: {
        phan: c('nghen', 'phan'), sl: c('nghen', 'sl'),
        pt: pt(c('nghen', 'phan'), c('ton_cuoi', 'phan')),
      },
    };
  }, [rows]);

  const oPhanSl = (o, key) => (
    <>
      <td className={`${TD} ${o.phan ? 'font-medium text-ink' : 'text-ink-soft'}`}>{fmtNum(o.phan)}</td>
      <td className={`${TD} ${o.sl ? '' : 'text-ink-soft'}`}>{fmtNum(o.sl)}</td>
      {key !== 'ton_dau' && key !== 'nhan' && (
        <td className={`${TD} ${key === 'nghen' ? '' : 'text-ink-soft'}`}>
          <Pt v={o.pt} canhBao={key === 'nghen'} />
        </td>
      )}
    </>
  );

  return (
    <div className="card mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Icon name="layout" size={15} className="text-ink-soft" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Bảng theo dõi thực hiện của các check point
        </span>
        <div className="ml-auto flex items-center gap-2">
          {loading && <Spinner size={15} />}
          {/* ⚠ `Badge` KHÔNG nhận prop `title` (chỉ có children/tone/className) ⇒ bọc `<span>` để
              người đọc còn biết "lệch" nghĩa là gì. */}
          {lech > 0 && (
            <span title="Tồn đầu + Nhận − Xong ≠ Tồn cuối ở dòng đó — dữ liệu có mốc ra sớm hơn mốc vào">
              <Badge tone="warning">⚠ {lech} dòng lệch</Badge>
            </span>
          )}
          <DateRangePicker value={range} onChange={(v) => setRange({
            from: v.from || homNayVN(), to: v.to || v.from || homNayVN(),
          })} />
        </div>
      </div>

      {loi ? (
        <div className="px-3 py-6 text-center text-sm text-ink-soft">{loi}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-surface-muted text-ink">
              <tr>
                <th rowSpan={2} className={TH1}>STT</th>
                <th rowSpan={2} className={`${TH1} text-left`}>Check point</th>
                <th colSpan={2} className={TH1}>Tồn đầu</th>
                <th colSpan={2} className={TH1}>Nhận</th>
                <th colSpan={3} className={TH1}>Xong</th>
                <th colSpan={3} className={TH1}>Tồn cuối</th>
                <th colSpan={3} className={TH1}>Nghẽn</th>
                <th rowSpan={2} className={`${TH1} text-left`}>Ghi chú</th>
              </tr>
              <tr>
                {['Phần', 'SL', 'Phần', 'SL'].map((t, i) => <th key={`a${i}`} className={TH2}>{t}</th>)}
                {['Phần', 'SL', '%', 'Phần', 'SL', '%', 'Phần', 'SL', '%'].map((t, i) => (
                  <th key={`b${i}`} className={TH2}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.ma} className="hover:bg-surface-muted/60">
                  <td className={`${TD} text-center text-ink-soft`}>{i + 1}</td>
                  <td className="border border-line px-2 py-1 text-xs font-semibold text-ink">
                    {r.ten}
                    {!r.can && <span className="ml-1 text-danger" title="4 ô không cân — xem lại dữ liệu mốc">⚠</span>}
                  </td>
                  {oPhanSl(r.ton_dau, 'ton_dau')}
                  {oPhanSl(r.nhan, 'nhan')}
                  {oPhanSl(r.xong, 'xong')}
                  {oPhanSl(r.ton_cuoi, 'ton_cuoi')}
                  {oPhanSl(r.nghen, 'nghen')}
                  <td className="border border-line px-2 py-1 text-[11px] leading-snug text-ink-soft">
                    <span title={r.ghi_chu || ''}>
                      SL = {r.don_vi_sl}
                      {r.sla_phut ? ` · SLA ${fmtNum(r.sla_phut)}p` : ' · chưa đặt SLA'}
                    </span>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr>
                  {/* 16 cột = STT + Check point + (2+2+3+3+3) + Ghi chú. Đổi bộ cột thì sửa kèm số này. */}
                  <td colSpan={16} className="px-3 py-8 text-center text-sm text-ink-soft">Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-surface-muted font-semibold text-ink">
                <tr>
                  <td className={`${TD} text-center`} colSpan={2}>Tổng 10 check point</td>
                  {oPhanSl(tong.ton_dau, 'ton_dau')}
                  {oPhanSl(tong.nhan, 'nhan')}
                  {oPhanSl(tong.xong, 'xong')}
                  {oPhanSl(tong.ton_cuoi, 'ton_cuoi')}
                  {oPhanSl(tong.nghen, 'nghen')}
                  <td className="border border-line px-2 py-1 text-[11px] font-normal text-ink-soft">
                    Cộng dọc lượt việc — KHÔNG phải tổng phần in (1 phần in có thể ở nhiều check point)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <p className="border-t border-line px-3 py-1.5 text-[11px] text-ink-soft">
        Xong% · Tồn cuối% chia (Tồn đầu + Nhận) — cộng lại = 100% · Nghẽn% chia Tồn cuối (nghẽn = đang tồn &amp; quá SLA của trạm).
        Số liệu làm mới tối đa mỗi 30 giây.
      </p>
    </div>
  );
}
