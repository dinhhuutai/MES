import { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import TimeSelect from '../../../components/common/TimeSelect';
import { Field, Input } from '../../../components/common/controls';
import { ngayLocalISO } from '../../../utils/format';

// Hộp xuất Excel "Danh sách phiếu nhật ký kiểm phẩm chưa kiểm" của màn KCS (10/11/2026): chọn tồn TỪ NGÀY + GIỜ → ĐẾN NGÀY +
//   GIỜ — ngày = NGÀY CHỨNG TỪ của tem, giờ = GIỜ IN TEM (ngày CT không có giờ; mốc tem = ngày CT + giờ in, BE
//   `tonChuaKiemKcs`); trống ngày = mọi ngày, trống giờ = 00:00 / 23:59; mặc định ngày = khoảng ngày đang lọc ở màn.
//   + GIỜ DỰ KIẾN (mặc định bây giờ — tem khô trước giờ này ghi "Cần tháo" = 2) + có gồm tem đang phơi (chưa tới KCS) không.
//   Mức module (luật §9).
const gioBayGio = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export default function XuatTonKcsModal({ open, onClose, busy, onXuat, tuNgayMacDinh = '', denNgayMacDinh = '' }) {
  const [ctTu, setCtTu] = useState('');
  const [ctDen, setCtDen] = useState('');
  const [gioTu, setGioTu] = useState('');
  const [gioDen, setGioDen] = useState('');
  const [ngay, setNgay] = useState(() => ngayLocalISO(new Date()));
  const [gio, setGio] = useState(gioBayGio);
  const [gomDangPhoi, setGomDangPhoi] = useState(true);
  useEffect(() => {
    if (open) {
      setNgay(ngayLocalISO(new Date())); setGio(gioBayGio());
      setCtTu(tuNgayMacDinh || ''); setCtDen(denNgayMacDinh || ''); setGioTu(''); setGioDen('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- chỉ nạp mặc định lúc MỞ hộp
  const saiKhoang = !!(ctTu && ctDen && `${ctTu} ${gioTu || '00:00'}` > `${ctDen} ${gioDen || '23:59'}`);
  // Giờ chỉ có nghĩa khi có ngày (mốc = ngày CT + giờ in tem).
  const gioTuThieuNgay = !!gioTu && !ctTu;
  const gioDenThieuNgay = !!gioDen && !ctDen;
  const gioDuKien = () => {
    const [y, m, d] = String(ngay || '').split('-').map(Number);
    const [hh, mm] = String(gio || '00:00').split(':').map(Number);
    return y && m && d ? new Date(y, m - 1, d, hh || 0, mm || 0) : new Date();
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Xuất Excel — phiếu chưa kiểm"
      footer={<>
        <Button chiXemOk variant="ghost" onClick={onClose}>Đóng</Button>
        <Button chiXemOk icon="download" loading={busy}
          disabled={busy || !ngay || saiKhoang || gioTuThieuNgay || gioDenThieuNgay}
          onClick={() => onXuat({
            gioDuKien: gioDuKien(), gomDangPhoi, ctTu: ctTu || null, ctDen: ctDen || null,
            gioTu: ctTu && gioTu ? gioTu : null, gioDen: ctDen && gioDen ? gioDen : null,
          })}>
          Xuất Excel
        </Button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tồn từ ngày CT" hint="Ngày chứng từ của tem · trống = mọi ngày">
          <Input type="date" value={ctTu} max={ctDen || undefined} onChange={(e) => setCtTu(e.target.value)} />
        </Field>
        <Field label="Từ giờ" hint="Giờ in tem · trống = 0:00" error={gioTuThieuNgay ? 'Chọn Từ ngày trước' : undefined}>
          <TimeSelect value={gioTu} onChange={setGioTu} minuteStep={1} />
        </Field>
        <Field label="Đến ngày CT" error={saiKhoang ? 'Mốc đến phải sau mốc từ' : undefined}>
          <Input type="date" value={ctDen} min={ctTu || undefined} onChange={(e) => setCtDen(e.target.value)} />
        </Field>
        <Field label="Đến giờ" hint="Trống = 23:59" error={gioDenThieuNgay ? 'Chọn Đến ngày trước' : undefined}>
          <TimeSelect value={gioDen} onChange={setGioDen} minuteStep={1} />
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Ngày dự kiến">
          <Input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
        </Field>
        <Field label="Giờ dự kiến">
          <TimeSelect value={gio} onChange={setGio} minuteStep={1} />
        </Field>
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input type="checkbox" className="h-4 w-4 rounded border-line text-primary focus:ring-primary/30"
          checked={gomDangPhoi} onChange={(e) => setGomDangPhoi(e.target.checked)} />
        Gồm tem đang phơi (chưa tới KCS)
      </label>
    </Modal>
  );
}
