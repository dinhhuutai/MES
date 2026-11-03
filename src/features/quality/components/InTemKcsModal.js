import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import SearchableSelect from '../../../components/common/SearchableSelect';
import { listUserOptions } from '../../../services/userService';
import { fmtNum, fmtDateTime } from '../../../utils/format';

// MODAL IN TEM GIAO Ở SIDEBAR "ĐÃ HOÀN THÀNH" MÀN KCS (03/11/2026, người dùng yêu cầu): 1 dòng / lượt KCS, mỗi dòng nhập
// NGƯỜI KIỂM (bắt buộc; lưu TÊN nên người chưa có tài khoản vẫn gõ được). Nhập nhanh nhiều dòng:
//   · ↓ ở ô tên: sang dòng dưới, dòng dưới ĐANG TRỐNG thì lấy tên dòng này (dòng đã có tên khác thì giữ nguyên); ↑ lên dòng.
//   · Kéo ô vuông nhỏ ở góc ô tên lên / xuống: chép tên sang mọi dòng kéo qua (GHI ĐÈ, như kéo ô Excel).
const O_NGUOI_MIN = 230;
const SAT_MEP_PX = 36; // kéo gần sát mép vùng cuộn thì tự cuộn tiếp
const BUOC_CUON_PX = 24;
const THU_DAT_CON_TRO = 20;

export default function InTemKcsModal({ open, rows, busy, onClose, onIn }) {
  const [dong, setDong] = useState([]);
  const [users, setUsers] = useState([]);
  const [keo, setKeo] = useState(null); // { tu, den } khi đang kéo ô vuông
  const oNhap = useRef([]);
  const vungCuon = useRef(null);
  const keoRef = useRef(null);
  const dangKeo = !!keo;

  useEffect(() => {
    if (open) setDong((rows || []).map((r) => ({ ...r, nguoiKiem: r.nguoi_kiem || '' })));
  }, [open, rows]);

  useEffect(() => {
    if (!open || users.length) return;
    listUserOptions({ limit: 500 }).then((r) => setUsers(r.data || [])).catch(() => { /* vẫn gõ tên tay được */ });
  }, [open, users.length]);

  // Ô chọn lưu TÊN ⇒ 1 tên chỉ hiện 1 lần (prod có tài khoản trùng họ tên); tên trùng thì không đoán tài khoản.
  const { dsTen, idTheoTen } = useMemo(() => {
    const dem = new Map();
    users.forEach((u) => {
      const ten = u.ho_ten || u.ten_dang_nhap || '';
      if (ten) dem.set(ten, dem.has(ten) ? null : u.id);
    });
    const daCo = new Set();
    return {
      dsTen: users.filter((u) => {
        const ten = u.ho_ten || u.ten_dang_nhap || '';
        if (!ten || daCo.has(ten)) return false;
        daCo.add(ten);
        return true;
      }),
      idTheoTen: dem,
    };
  }, [users]);

  const datTen = (i, ten) => setDong((ds) => ds.map((x, j) => (j === i ? { ...x, nguoiKiem: ten } : x)));

  const muiTen = (i, huong, ten) => {
    const j = huong === 'xuong' ? i + 1 : i - 1;
    if (j < 0 || j >= dong.length) return;
    if (huong === 'xuong' && ten) {
      setDong((ds) => ds.map((x, k) => (k === j && !String(x.nguoiKiem || '').trim() ? { ...x, nguoiKiem: ten } : x)));
    }
    // Danh sách gợi ý vừa đóng thì các ô khác có thể còn bị khóa thêm vài nhịp ⇒ đặt con trỏ tới khi nhận mới thôi.
    const datConTro = (lan) => {
      const el = oNhap.current[j];
      if (!el) return;
      el.focus();
      if (document.activeElement !== el) {
        if (lan < THU_DAT_CON_TRO) setTimeout(() => datConTro(lan + 1), 16);
        return;
      }
      el.select(); // dòng đã có tên: gõ là thay luôn, khỏi xóa tay
    };
    setTimeout(() => datConTro(0), 0);
  };

  const batDauKeo = (e, i) => {
    e.preventDefault();
    keoRef.current = { tu: i, den: i };
    setKeo(keoRef.current);
  };

  useEffect(() => {
    if (!dangKeo) return undefined;
    const khiDi = (e) => {
      const vung = vungCuon.current;
      if (vung) {
        const r = vung.getBoundingClientRect();
        if (e.clientY > r.bottom - SAT_MEP_PX) vung.scrollTop += BUOC_CUON_PX;
        else if (e.clientY < r.top + SAT_MEP_PX) vung.scrollTop -= BUOC_CUON_PX;
      }
      const tr = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-dong-kiem]');
      if (!tr) return;
      const den = Number(tr.getAttribute('data-dong-kiem'));
      if (keoRef.current && den !== keoRef.current.den) {
        keoRef.current = { ...keoRef.current, den };
        setKeo(keoRef.current);
      }
    };
    const khiTha = () => {
      const k = keoRef.current;
      keoRef.current = null;
      setKeo(null);
      if (!k || k.tu === k.den) return;
      const [a, b] = k.tu < k.den ? [k.tu, k.den] : [k.den, k.tu];
      setDong((ds) => ds.map((x, j) => (j >= a && j <= b ? { ...x, nguoiKiem: ds[k.tu].nguoiKiem } : x)));
    };
    window.addEventListener('pointermove', khiDi);
    window.addEventListener('pointerup', khiTha);
    window.addEventListener('pointercancel', khiTha);
    return () => {
      window.removeEventListener('pointermove', khiDi);
      window.removeEventListener('pointerup', khiTha);
      window.removeEventListener('pointercancel', khiTha);
    };
  }, [dangKeo]);

  const trongKeo = (i) => keo && i >= Math.min(keo.tu, keo.den) && i <= Math.max(keo.tu, keo.den);
  const soThieu = dong.filter((r) => !String(r.nguoiKiem || '').trim()).length;
  const soTo = Math.ceil(dong.length / 2);
  const inNgay = () => onIn(dong.map((r) => {
    const ten = String(r.nguoiKiem).trim();
    return { ...r, nguoiKiem: ten, nguoiKiemId: idTheoTen.get(ten) || null };
  }));

  return (
    <Modal open={open} onClose={onClose} size="full" title={`In tem giao — ${fmtNum(dong.length)} tem`}
      footer={<>
        <span className={`mr-auto text-xs ${soThieu ? 'text-danger' : 'text-ink-soft'}`}>
          {soThieu ? `Còn ${fmtNum(soThieu)} dòng chưa nhập người kiểm` : `${fmtNum(soTo)} tờ · mỗi tờ 2 tem`}
        </span>
        <Button chiXemOk variant="ghost" onClick={onClose}>Hủy</Button>
        <Button icon="printer" loading={busy} disabled={busy || soThieu > 0 || !dong.length} onClick={inNgay}>In tem</Button>
      </>}>
      <div ref={vungCuon} className="max-h-[60vh] overflow-auto rounded-card border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-2 py-2 w-8">#</th>
              <th className="px-2 py-2" style={{ minWidth: O_NGUOI_MIN }}
                title="↓ sang dòng dưới và lấy tên nếu dòng đó trống · kéo ô vuông ở góc để chép tên sang nhiều dòng">
                Người kiểm <span className="text-danger">*</span>
              </th>
              <th className="px-2 py-2">Tem</th>
              <th className="px-2 py-2">Khách hàng</th>
              <th className="px-2 py-2">Mã hàng</th>
              <th className="px-2 py-2">Code phần</th>
              <th className="px-2 py-2">Màu · Kích</th>
              <th className="px-2 py-2 text-right">SL kiểm</th>
              <th className="px-2 py-2 text-right">SL đạt</th>
              <th className="px-2 py-2">Giờ kiểm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {dong.map((r, i) => (
              <tr key={r.kcs_id || i} data-dong-kiem={i} className={`align-top ${trongKeo(i) ? 'bg-primary-wash' : ''}`}>
                <td className="px-2 py-2 text-ink-soft">{i + 1}</td>
                <td className="px-2 py-2">
                  <div className="relative">
                    <SearchableSelect chapNhanTuDo
                      inputRef={(el) => { oNhap.current[i] = el; }}
                      value={r.nguoiKiem}
                      onChange={(v) => datTen(i, v)}
                      onMuiTen={(huong, ten) => muiTen(i, huong, ten)}
                      options={dsTen}
                      getValue={(u) => u.ho_ten || u.ten_dang_nhap || ''}
                      getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''}
                      getSearch={(u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`}
                      placeholder="Chọn hoặc gõ tên người kiểm..." />
                    {dong.length > 1 && String(r.nguoiKiem || '').trim() && (
                      <span role="presentation" title="Kéo lên / xuống để chép tên sang các dòng khác"
                        data-keo-ten={i} onPointerDown={(e) => batDauKeo(e, i)}
                        className="absolute -bottom-1 -right-1 h-3.5 w-3.5 cursor-ns-resize touch-none rounded-sm border-2 border-surface bg-primary" />
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-2"><Badge tone="info">{r.ma || '—'}</Badge></td>
                <td className="px-2 py-2">{r.ten_khach_hang || '—'}</td>
                <td className="px-2 py-2">{r.ma_hang || '—'}</td>
                <td className="px-2 py-2">{r.ma_phan || '—'}</td>
                <td className="px-2 py-2">
                  <div>{r.mau_vai || '—'}</div>
                  <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtNum(r.so_luong_kiem)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtNum(r.so_luong)}</td>
                <td className="whitespace-nowrap px-2 py-2 tabular-nums">{r.tg ? fmtDateTime(r.tg) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
