// ─────────────────────────────────────────────────────────────────────────────
// QUẢN TRỊ PHẦN IN › LUỒNG SẢN XUẤT (mig 126, 09/11/2026, người dùng chốt).
//   · Luồng tự nhận theo *Hệ thống › Tính chất in* khi phần in về từ ERP; sửa tay ở đây (ghi đè, không bị phân loại
//     tính chất in đổi theo nữa).
//   · In kiếng / In + ép = 2 CÔNG ĐOẠN ⇒ tích vào là Kế hoạch có thêm phần ÉP ỦI cho mỗi đợt vải (dòng ngay dưới dòng in ở
//     Release 1); bỏ về In thường / Logo là phần ép ủi rời Kế hoạch — kiểu BTP: đã lập lệnh ép thì phải hủy lệnh trước.
//   · "Ép ủi trước, in sau": đổi công đoạn ĐẦU (tem của nó không vào KCS) — áp cho lệnh chưa in tem; lệnh đã in tem thôi là
//     công đoạn đầu ⇒ tem chờ công đoạn sau được nhả vào KCS.
//   · BỎ 1 CÔNG ĐOẠN (11/11/2026): 2 nút ở phần in 2 công đoạn ⇒ `BoCongDoanModal` (xem trước rồi mới làm — tự hủy lệnh /
//     kế hoạch tạm của công đoạn bị bỏ chưa in tem).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { Field, Textarea } from '../../../components/common/controls';
import { LUONG_SX, laHaiCongDoan, tenLuong, GD_IN, GD_EP } from '../../../utils/luongSanXuat';
import { fmtDate } from '../../../utils/format';
import BoCongDoanModal from './BoCongDoanModal';

const MO_TA = {
  THUONG: 'Luồng hiện tại: Kỹ thuật → IQC → Release 1 → Test Run → Release 2 → In → KCS → OQC → Giao.',
  IN_KIENG: '2 công đoạn: in kiếng + ép ủi — 2 tờ kế hoạch (2 lệnh), tem in kiếng nhập loại kiếng + hệ số, tem in không vào KCS.',
  IN_EP: '2 công đoạn: in + ép ủi — 2 tờ kế hoạch (2 lệnh), tem công đoạn đầu không vào KCS.',
  LOGO: 'Không qua Kỹ thuật / IQC / Test Run / Release 2: vào thẳng Kế hoạch, release xong vào Chờ chạy (Tổ Logo).',
  KIENG_KHONG_EP: '1 công đoạn in kiếng (đã bỏ ép ủi) — như In thường nhưng tem in vẫn nhập loại / SL / hệ số kiếng.',
};

export default function KhoiLuongSanXuat({ pin, dangLuu, onLuu, show, onXong }) {
  const [luong, setLuong] = useState(pin.luong_sx || 'THUONG');
  const [epTruoc, setEpTruoc] = useState(!!pin.ep_truoc);
  const [lyDo, setLyDo] = useState('');
  const [bo, setBo] = useState(null); // 'IN' | 'EP_UI' — modal bỏ công đoạn
  useEffect(() => { setLuong(pin.luong_sx || 'THUONG'); setEpTruoc(!!pin.ep_truoc); setLyDo(''); }, [pin.id, pin.luong_sx, pin.ep_truoc]);
  const doi = luong !== (pin.luong_sx || 'THUONG') || (laHaiCongDoan(luong) && epTruoc !== !!pin.ep_truoc);
  const luu = async () => { if (await onLuu({ luong, epTruoc: laHaiCongDoan(luong) && epTruoc, lyDo: lyDo.trim() })) setLyDo(''); };

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">Luồng sản xuất</h3>
        <Badge tone={laHaiCongDoan(pin.luong_sx) ? 'warning' : pin.luong_sx === 'LOGO' ? 'success' : pin.luong_sx === 'KIENG_KHONG_EP' ? 'info' : 'default'}>{tenLuong(pin.luong_sx)}</Badge>
        {laHaiCongDoan(pin.luong_sx) && pin.ep_truoc && <Badge tone="info">Ép trước, in sau</Badge>}
        <span className="text-xs text-ink-soft">
          {pin.luong_sx_sua_tay ? 'Đã sửa tay' : 'Tự nhận theo tính chất in'}{pin.tinh_chat_in ? ` (${pin.tinh_chat_in})` : ''}
          {pin.luong_sx_tg ? ` · ${fmtDate(pin.luong_sx_tg)}` : ''}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {LUONG_SX.map((l) => (
          <label key={l.ma}
            className={`flex cursor-pointer flex-col gap-1 rounded-control border px-3 py-2 text-sm transition
              ${luong === l.ma ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-line hover:border-primary/40'}`}>
            <span className="flex items-center gap-2 font-medium text-ink">
              <input type="radio" name="luong-sx" className="h-4 w-4 accent-primary" checked={luong === l.ma}
                onChange={() => setLuong(l.ma)} />
              {l.ten}
            </span>
            <span className="text-xs leading-snug text-ink-soft">{MO_TA[l.ma]}</span>
          </label>
        ))}
      </div>
      {laHaiCongDoan(luong) && (
        <label className="mt-3 flex items-start gap-2 rounded-control border border-line px-3 py-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={epTruoc} onChange={(e) => setEpTruoc(e.target.checked)} />
          <span>
            <b className="text-ink">Ép ủi trước, in sau</b>
            <span className="block text-xs text-ink-soft">
              Mặc định in trước rồi ép. Tích khi hàng này ép trước: tem lệnh ÉP không vào KCS, tem lệnh IN mới đi KCS → OQC → giao.
              Áp cho lệnh chưa in tem.
            </span>
          </span>
        </label>
      )}
      {doi && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {laHaiCongDoan(pin.luong_sx) && !laHaiCongDoan(luong) && (
            <p className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              Bỏ công đoạn ép ủi: phần ép ủi rời Kế hoạch. Đã lập lệnh ép thì dùng nút <b>Bỏ công đoạn Ép ủi</b> bên dưới (tự hủy lệnh ép chưa in tem).
            </p>
          )}
          {!laHaiCongDoan(pin.luong_sx) && laHaiCongDoan(luong) && (
            <p className="rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
              Thêm công đoạn ép ủi: mỗi đợt vải sống của phần in hiện thêm 1 dòng <b>Ép ủi</b> ở Release 1 (ngay dưới dòng in).
            </p>
          )}
          <Field label="Lý do đổi luồng" required>
            <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Vì sao đổi (vd: tính chất in ERP ghi sai)" />
          </Field>
          <div className="flex justify-end">
            <Button loading={dangLuu} disabled={!lyDo.trim()} onClick={luu}>Lưu luồng sản xuất</Button>
          </div>
        </div>
      )}
      {laHaiCongDoan(pin.luong_sx) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Bỏ 1 công đoạn</span>
          <Button variant="secondary" onClick={() => setBo(GD_IN)}>
            Bỏ công đoạn {pin.luong_sx === 'IN_KIENG' ? 'In kiếng' : 'In'} — chỉ giữ ép ủi
          </Button>
          <Button variant="secondary" onClick={() => setBo(GD_EP)}>Bỏ công đoạn Ép ủi — chỉ giữ in</Button>
        </div>
      )}
      <BoCongDoanModal phanInId={pin.id} bo={bo} show={show} onClose={() => setBo(null)}
        onDone={() => { setBo(null); if (onXong) onXong(); }} />
    </div>
  );
}
