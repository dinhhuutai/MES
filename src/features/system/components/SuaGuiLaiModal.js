import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Spinner from '../../../components/common/Spinner';
import { Field, Input, Textarea } from '../../../components/common/controls';
import { xemSuaGuiLaiApi, suaGuiLaiApi } from '../../../services/caiDatApiService';

// ─────────────────────────────────────────────────────────────────────────────
// HỘP "SỬA & GỬI LẠI" của 1 dòng *Cài đặt API › Lịch sử* (21/10/2026). Danh sách trường + luật (kiểu, độ dài,
// trường khóa, trường gương) do backend trả (`caidatapi/suaGuiLai.js`) — FE không chép luật.
//   · Trường khóa (ID kết nối): hiện để đối chiếu, không sửa — đổi IDMES là đẻ phiếu thứ hai bên ERP.
//   · Trường gương (vd `BarcodeSua17` = `BarcodeIn`): tự đi theo trường nguồn.
//   · Chỉ gửi trường ĐÃ ĐỔI; lý do bắt buộc. Lỗi 422 hiện ngay dưới từng ô.
// ─────────────────────────────────────────────────────────────────────────────

const chuoi = (v) => (v == null ? '' : String(v));
const laDai = (t) => (t.dai || 0) >= 255 || /^Ds/.test(t.truong);

export default function SuaGuiLaiModal({ ma, dong, onClose, onXong }) {
  const [truong, setTruong] = useState([]);
  const [kieuNgay, setKieuNgay] = useState('Z');
  const [giaTri, setGiaTri] = useState({});
  const [lyDo, setLyDo] = useState('');
  const [loi, setLoi] = useState({});
  const [loiChung, setLoiChung] = useState('');
  const [dangTai, setDangTai] = useState(false);
  const [dangGui, setDangGui] = useState(false);

  useEffect(() => {
    if (!dong) return undefined;
    let huy = false;
    setTruong([]); setGiaTri({}); setLyDo(''); setLoi({}); setLoiChung(''); setDangTai(true);
    xemSuaGuiLaiApi(ma, dong.id)
      .then((res) => {
        if (huy) return;
        const ds = res.data?.truong || [];
        setTruong(ds);
        setKieuNgay(res.data?.kieu_ngay || 'Z');
        setGiaTri(Object.fromEntries(ds.map((t) => [t.truong, chuoi(t.gia_tri)])));
      })
      .catch((e) => { if (!huy) setLoiChung(e.message || 'Không đọc được dữ liệu đã gửi'); })
      .finally(() => { if (!huy) setDangTai(false); });
    return () => { huy = true; };
  }, [ma, dong]);

  const daDoi = useMemo(
    () => truong.filter((t) => !t.khoa && !t.guong && giaTri[t.truong] !== chuoi(t.gia_tri)).map((t) => t.truong),
    [truong, giaTri],
  );

  const gui = async () => {
    if (!daDoi.length || !lyDo.trim() || dangGui) return;
    setDangGui(true); setLoi({}); setLoiChung('');
    try {
      await suaGuiLaiApi(ma, dong.id, Object.fromEntries(daDoi.map((k) => [k, giaTri[k]])), lyDo.trim());
      onXong(`Đã sửa ${daDoi.length} trường và gửi lại sang ERP`);
    } catch (e) {
      const ds = Array.isArray(e.details) ? e.details : [];
      setLoi(Object.fromEntries(ds.filter((d) => d && d.truong).map((d) => [d.truong, d.loi])));
      setLoiChung(e.message || 'Gửi lại thất bại');
    } finally { setDangGui(false); }
  };

  const goiYNgay = kieuNgay === 'VN' ? '2026/10/21 08:30:00' : '2026-10-21 08:30:00';

  const oNhap = (t) => {
    const v = t.guong ? giaTri[t.guong] ?? '' : giaTri[t.truong] ?? '';
    const khoa = t.khoa || !!t.guong;
    const doi = daDoi.includes(t.truong);
    const nhap = (e) => setGiaTri((s) => ({ ...s, [t.truong]: e.target.value }));
    const cls = doi ? 'border-amber-400 bg-amber-50' : '';
    return laDai(t) && !khoa
      ? <Textarea rows={3} value={v} onChange={nhap} className={`font-mono ${cls}`} />
      : (
        <Input value={v} onChange={nhap} disabled={khoa}
          inputMode={t.kieu === 'so' ? 'numeric' : undefined}
          placeholder={t.kieu === 'ngay' ? goiYNgay : undefined}
          className={`font-mono ${cls}`} />
      );
  };

  const nhanPhu = (t) => {
    if (t.khoa) return 'khóa — không sửa';
    if (t.guong) return `= ${t.guong}`;
    const p = [t.kieu === 'so' ? 'số' : t.kieu === 'ngay' ? 'ngày giờ' : 'chữ'];
    if (t.dai) p.push(`tối đa ${t.dai}`);
    if (t.ma_tem) p.push('mã tem 12 số');
    return p.join(' · ');
  };

  return (
    <Modal open={!!dong} onClose={onClose} title="Sửa dữ liệu & gửi lại ERP" size="xl"
      footer={
        <>
          <span className="mr-auto text-xs text-ink-soft">{daDoi.length ? `Đã đổi ${daDoi.length} trường` : 'Chưa đổi trường nào'}</span>
          <Button variant="ghost" chiXemOk onClick={onClose}>Đóng</Button>
          <Button icon="rotate-cw" onClick={gui} loading={dangGui} disabled={!daDoi.length || !lyDo.trim() || dangTai}>
            Gửi lại ERP
          </Button>
        </>
      }>
      {dong && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-soft">ID kết nối</span>
            <span className="font-mono font-semibold text-ink">{dong.id_mes || '—'}</span>
            {dong.ma_tem && <><span className="text-ink-soft">·</span><span className="font-mono text-ink">{dong.ma_tem}</span></>}
            {dong.thanh_cong ? <Badge tone="success">Thành công</Badge> : <Badge tone="danger">Lỗi</Badge>}
          </div>
          <p className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Chỉ đổi dữ liệu gửi sang ERP, không đổi dữ liệu trong MES. Bấm "Gửi lại ERP" thường sau này sẽ dựng lại từ MES.
          </p>

          {dangTai && <div className="flex justify-center py-8"><Spinner size={24} /></div>}

          {!!truong.length && (
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {truong.map((t) => (
                <div key={t.truong} className={laDai(t) && !t.khoa ? 'sm:col-span-2' : ''}>
                  <div className="mb-0.5 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-ink">{t.truong}</span>
                    <span className="text-[11px] text-ink-soft">{nhanPhu(t)}</span>
                  </div>
                  {oNhap(t)}
                  {daDoi.includes(t.truong) && (
                    <p className="mt-0.5 break-all text-[11px] text-ink-soft">Cũ: <span className="font-mono">{chuoi(t.gia_tri) || '(trống)'}</span></p>
                  )}
                  {loi[t.truong] && <p className="mt-0.5 text-[11px] text-danger">{loi[t.truong]}</p>}
                </div>
              ))}
            </div>
          )}

          {!dangTai && !!truong.length && (
            <Field label="Lý do sửa" required>
              <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)} maxLength={300}
                placeholder="Vì sao sửa (vd: ERP báo sai mã nhân viên, nhập nhầm số lượng)..." />
            </Field>
          )}

          {loiChung && (
            <div className="flex items-start gap-2 rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <Icon name="alert-triangle" size={16} className="mt-0.5 shrink-0" />
              <span className="break-all">{loiChung}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
