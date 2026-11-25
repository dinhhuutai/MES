import { useCallback, useEffect, useMemo, useState } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import ChipTabs from '../../../components/common/ChipTabs';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import { Field, Input, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useChiXem from '../../../hooks/useChiXem';
import { fmtNum, fmtDateTime } from '../../../utils/format';
import { khopTungTu } from '../../../utils/timKiem';
import { listTinhChatIn, saveTinhChatIn, addTinhChatIn, removeTinhChatIn } from '../../../services/tinhChatInService';

// ─────────────────────────────────────────────────────────────────────────────
// TÍNH CHẤT IN (mig 123, 04/11/2026, người dùng yêu cầu) — quản lý từng tính chất in: có những CÔNG ĐOẠN nào + có BỎ QUA khi
// đồng bộ ERP không. `bo_qua` có hiệu lực từ lượt đồng bộ kế tiếp nên lúc lưu có đổi bỏ qua thì phải hỏi lại.
// ⚠ 4 công tắc **In · In kiếng · Logo · Ép** (16/11/2026, người dùng chốt tách Logo khỏi Ép — bản 14/11 gộp "Ép/Logo"). Số
//   công đoạn của phần in = số công tắc bật. Luồng = tổ hợp công tắc — danh mục tổ hợp do BE trả (`luong[].cd`, nguồn
//   `utils/tinhChatIn.js LUONG`); client gửi `cong_doan`, server đổi ra mã luồng. Phần in 2 công đoạn ⇒ 2 dòng ở Kế hoạch
//   (kiếng ủi: mỗi đợt ERP là 1 công đoạn — 4I In kiếng, đợt khác Ép).
// ─────────────────────────────────────────────────────────────────────────────

const CONG_DOAN = [
  { k: 'in', ten: 'In' },
  { k: 'kieng', ten: 'In kiếng' },
  { k: 'logo', ten: 'Logo' },
  { k: 'ep', ten: 'Ép' },
];
const khoaCd = (cd) => CONG_DOAN.map((c) => (cd && cd[c.k] ? 1 : 0)).join('');
// Có công đoạn loại ép (Logo hoặc Ép) ⇒ mới có cột "Kỹ thuật Ép/Logo" / "Xác nhận HSKT" (gương BE `tinhChatIn.coCongDoanEp`).
const coEp = (cd) => !!(cd && (cd.ep || cd.logo));
// DÒNG SẢN PHẨM LOGO (18/11/2026, mig 137 — gương BE `tinhChatIn.epThanhLogo` / `khongInRoiEp`): bật "DSP Logo" ⇒ công tắc Ép
//   thành Logo (CoEp ⇒ công đoạn Logo); In + Ép ⇒ In + Logo = 1 phần in 2 công đoạn (2 dòng In + Logo ở Release 1, 2 lệnh độc
//   lập) — được lưu dù luật 17/11 "không có In rồi Ép".
const dspCua = (r) => r.dsp_logo === true;
const epThanhLogo = (cd) => ({ ...cd, logo: !!(cd && (cd.logo || cd.ep)), ep: false });

const LOC_BO_QUA = [
  { v: '', label: 'Tất cả' },
  { v: 'CO', label: 'Đang bỏ qua' },
  { v: 'KHONG', label: 'Không bỏ qua' },
];
const TOI_DA_LIET_KE = 12;

const ghiChuCua = (r) => String(r.ghi_chu ?? '').trim();
const cheDoCua = (r) => r.ready_che_do || 'RIENG';
// YÊU CẦU KỸ THUẬT (READY) CỦA CÔNG ĐOẠN ÉP/LOGO (16/11/2026, mig 133 — BE `utils/tech.js ktYcSql`): Logo / Ép qua KT nhưng chỉ
//   xác nhận Khuôn và/hoặc Mực (không Film); "Không qua KT" ⇒ KT coi như xong, đi thẳng QC (QA vẫn xác nhận). Chỉ tính chất có
//   công tắc Ép/Logo mới chọn được.
const KT_YC_CHON = [
  { v: 'KHUON_MUC', ten: 'Khuôn + Mực' },
  { v: 'KHUON', ten: 'Chỉ Khuôn' },
  { v: 'MUC', ten: 'Chỉ Mực' },
  { v: 'KHONG', ten: 'Không qua KT' },
];
const ktYcCua = (r) => r.kt_yeu_cau || 'KHUON_MUC';
// "Xác nhận HSKT" của công đoạn Ép/Logo (16/11/2026, mig 134 — BE `utils/tech.js ktHsktSql`): bật ⇒ dòng Ép/Logo ở READY phải
//   xác nhận thêm mục HSKT (quyền READY_HSKT). Còn công tắc tổng ở Hệ thống › Cài đặt tính năng.
const ktHsktCua = (r) => r.kt_hskt !== false;
// "CHỈ 1 TỜ TDTHĐH" (25/11/2026, mig 139 — BE `tinhchatin.service chuanDong` + `erpsync.repository datCaHaiTheoTinhChat`): tính
//   chất nhiều công đoạn mà ERP chỉ gửi lên MES 1 lần (1 tờ TDTHĐH) ⇒ đợt MỚI từ ERP mang CẢ 2 công đoạn (như In + Logo: Release 1
//   ra 2 dòng / đợt). Chỉ tính chất có luồng sản xuất mà ERP gửi THEO TỪNG CÔNG ĐOẠN (kiếng ủi — `luong[].sx` IN_KIENG) mới bật
//   được; In + Logo vốn đã 1 đợt mang 2 công đoạn ⇒ không cần. Đợt đã có giữ nguyên — đánh dấu từng đợt ở Quản trị phần in.
const SX_HAI_CD = new Set(['IN_KIENG']);
const motCua = (r) => r.mot_tdthdh === true;
const doiGoc = (r, g) => !!g && (r.luong !== g.luong || r.bo_qua !== g.bo_qua || ghiChuCua(r) !== ghiChuCua(g)
  || cheDoCua(r) !== cheDoCua(g) || ktYcCua(r) !== ktYcCua(g) || ktHsktCua(r) !== ktHsktCua(g) || dspCua(r) !== dspCua(g)
  || motCua(r) !== motCua(g));
// READY của tính chất NHIỀU công đoạn (14/11/2026, mig 131 — BE `utils/readyCongDoan.js`): mặc định mỗi công đoạn Ready
//   riêng (1 dòng / công đoạn từ READY). 2 công tắc loại trừ nhau: "Ready 1 lần" (MOT_LAN) · "Công đoạn sau không Ready"
//   (SAU_THEO_DAU — công đoạn sau theo READY của công đoạn đầu).
// ⚠ 17/11/2026 (người dùng chốt READY "dùng chung như bình thường"): bỏ bộ checklist riêng của Ép/Logo — mỗi đợt vải chỉ
//   1 công đoạn, READY 1 dòng / đợt ⇒ 2 công tắc này không còn tác dụng, ẩn khỏi bảng + Excel (cột `ready_che_do` giữ nguyên).
const CHE_DO_READY = [];
const gocTu = (items) => Object.fromEntries(items.map((r) => [r.ma_chuan, r]));

// Tên luồng sản xuất tạm của tổ hợp chưa có luồng riêng (`luong[].sx` — `phan_in.luong_sx`).
const TEN_SX = { THUONG: 'In thường', KIENG_KHONG_EP: 'In kiếng', LOGO: '1 công đoạn Logo/Ép', IN_EP: 'In + Ép', IN_KIENG: 'In kiếng + Ép' };

// Tính chất này hiện đang đi đâu trong MES — đọc `da_lam` / `tam` của tổ hợp công đoạn.
function hienTai(r, dsLuong) {
  if (r.bo_qua) return { ten: 'Không vào MES', tone: 'default' };
  const l = dsLuong.find((x) => x.ma === r.luong);
  // 17/11/2026: không có công đoạn In rồi Ép/Logo (BE `utils/tinhChatIn.js khongInRoiEp`) — lưu sẽ bị chặn. Trừ DSP Logo:
  //   In + Logo là 2 công đoạn độc lập (18/11/2026).
  const dspInLogo = dspCua(r) && l && l.cd && !l.cd.ep;
  if (l && l.khong_dung && !dspInLogo) return { ten: 'Không có In rồi Ép/Logo — chọn lại: bật In HOẶC Logo/Ép (In + Logo chỉ cho DSP Logo)', tone: 'danger' };
  if (dspInLogo && l.cd.in && l.cd.logo) return { ten: 'Vào MES · In + Logo (2 công đoạn độc lập)', tone: 'success' };
  if (l && l.tam) return { ten: `Vào MES · ${l.ten} chưa có luồng riêng — tạm chạy ${TEN_SX[l.sx] || 'In thường'}`, tone: 'warning' };
  if (l && l.da_lam) return { ten: 'Vào MES', tone: 'success' };
  return { ten: 'Vào MES · chưa bật công đoạn — tạm đi in thường', tone: 'warning' };
}

// Công tắc gạt — dựng lại y hệt `HienThiPainPage` để các trang cấu hình nhìn như một.
function Toggle({ on, onChange, disabled, title }) {
  return (
    <button type="button" title={title} disabled={disabled} aria-pressed={on} aria-label={title}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
        ${on ? 'bg-primary' : 'bg-line'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <span className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform
        ${on ? 'translate-x-[22px]' : 'translate-x-1'}`} />
    </button>
  );
}

// Khối liệt kê tên trong hộp xác nhận lưu (nhiều quá thì cắt, tránh hộp dài hết màn hình).
function DanhSachTen({ tieuDe, ds }) {
  if (!ds.length) return null;
  const hien = ds.slice(0, TOI_DA_LIET_KE);
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-sm font-semibold text-ink">{tieuDe}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
        {hien.map((r) => (
          <li key={r.ma_chuan}>
            {r.ten}{r.so_phan_in > 0 ? ` (${fmtNum(r.so_phan_in)} phần in trong MES)` : ''}
          </li>
        ))}
        {ds.length > hien.length && <li>… và {fmtNum(ds.length - hien.length)} tính chất khác</li>}
      </ul>
    </div>
  );
}

export default function TinhChatInPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const chiXem = useChiXem();                    // tài khoản khách / vào được nhờ HE_THONG_XEM
  const canEdit = can('WORKFLOW_MANAGE') && !chiXem;

  const [rows, setRows] = useState([]);
  const [goc, setGoc] = useState({});            // giá trị đang lưu trên server, theo `ma_chuan`
  const [dsLuong, setDsLuong] = useState([]);
  const [chuaMig, setChuaMig] = useState(false);
  const [coCheDo, setCoCheDo] = useState(false); // đã chạy mig 131 (lưu được chế độ READY)
  const [coKtYc, setCoKtYc] = useState(false);   // đã chạy mig 133 (lưu được yêu cầu KT Ép/Logo)
  const [coKtHskt, setCoKtHskt] = useState(false); // đã chạy mig 134 (lưu được "Xác nhận HSKT")
  const [coDsp, setCoDsp] = useState(false);       // đã chạy mig 137 (lưu được "DSP Logo")
  const [coMot, setCoMot] = useState(false);       // đã chạy mig 139 (lưu được "1 tờ TDTHĐH")
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [chip, setChip] = useState('');
  const [locBoQua, setLocBoQua] = useState('');
  const [search, setSearch] = useState('');
  const [chon, setChon] = useState(() => new Set());

  const [hoiLuu, setHoiLuu] = useState(false);
  const [them, setThem] = useState(null);        // form "Thêm tính chất"
  const [xoa, setXoa] = useState(null);          // dòng đang hỏi xóa

  const nap = useCallback((d) => {
    setRows(d.items || []);
    setGoc(gocTu(d.items || []));
    setDsLuong(d.luong || []);
    setChuaMig(!!d.chua_migration);
    setCoCheDo(!!d.co_che_do_ready);
    setCoKtYc(!!d.co_kt_yeu_cau);
    setCoKtHskt(!!d.co_kt_hskt);
    setCoDsp(!!d.co_dsp_logo);
    setCoMot(!!d.co_mot_tdthdh);
  }, []);

  useEffect(() => {
    let huy = false;
    (async () => {
      try {
        const res = await listTinhChatIn();
        if (!huy) nap(res.data);
      } catch (e) {
        if (!huy) show(e.message || 'Lỗi tải danh mục', 'error');
      } finally {
        if (!huy) setLoading(false);
      }
    })();
    return () => { huy = true; };
  }, [nap, show]);

  const suaDuoc = canEdit && !chuaMig;
  const tenLuong = useCallback((ma) => (dsLuong.find((l) => l.ma === ma) || {}).ten || ma, [dsLuong]);

  const dsDoi = useMemo(() => rows.filter((r) => doiGoc(r, goc[r.ma_chuan])), [rows, goc]);
  const dsMo = useMemo(() => dsDoi.filter((r) => goc[r.ma_chuan].bo_qua && !r.bo_qua), [dsDoi, goc]);
  const dsBoQuaMoi = useMemo(() => dsDoi.filter((r) => !goc[r.ma_chuan].bo_qua && r.bo_qua), [dsDoi, goc]);

  // Tập đang xét TRƯỚC khi áp chip luồng (số trên chip không tự áp chính chip đó).
  const truocChip = useMemo(() => rows.filter((r) => {
    if (locBoQua === 'CO' && !r.bo_qua) return false;
    if (locBoQua === 'KHONG' && r.bo_qua) return false;
    return khopTungTu(`${r.ten} ${r.ma_chuan} ${r.ghi_chu || ''} ${tenLuong(r.luong)}`, search);
  }), [rows, locBoQua, search, tenLuong]);
  const hien = useMemo(() => (chip ? truocChip.filter((r) => r.luong === chip) : truocChip), [truocChip, chip]);

  const counts = useMemo(() => {
    const c = { '': truocChip.length };
    truocChip.forEach((r) => { c[r.luong] = (c[r.luong] || 0) + 1; });
    return c;
  }, [truocChip]);
  // Tổ hợp ghép tự sinh (mã `CD_…`, ≥ 3 công đoạn…) chỉ hiện chip khi có tính chất mang nó.
  const tabs = useMemo(() => [{ v: '', label: 'Tất cả' },
    ...dsLuong.filter((l) => !String(l.ma).startsWith('CD_') || counts[l.ma] || chip === l.ma).map((l) => ({ v: l.ma, label: l.ten }))],
  [dsLuong, counts, chip]);

  // Số đang bỏ qua của luồng đang xem (không phụ thuộc ô lọc bỏ qua / ô tìm).
  const tongLuong = useMemo(() => (chip ? rows.filter((r) => r.luong === chip) : rows), [rows, chip]);
  const soBoQua = tongLuong.filter((r) => r.bo_qua).length;

  const doiDong = (ma, patch) => setRows((rs) => rs.map((r) => (r.ma_chuan === ma ? { ...r, ...patch } : r)));
  const doiNhieu = (patch) => setRows((rs) => rs.map((r) => (chon.has(r.ma_chuan) ? { ...r, ...patch } : r)));
  // Tổ hợp công đoạn ⇄ mã luồng (danh mục do BE trả).
  const luongTuCd = useCallback((cd) => (dsLuong.find((l) => khoaCd(l.cd) === khoaCd(cd)) || {}).ma || 'CHUA_PHAN_LOAI', [dsLuong]);
  const cdCua = (r) => r.cong_doan || (dsLuong.find((l) => l.ma === r.luong) || {}).cd || {};
  // Luồng SẢN XUẤT của dòng là kiếng ủi (ERP gửi mỗi công đoạn 1 lần) ⇒ mới có công tắc "1 tờ TDTHĐH". Đổi công đoạn khác ⇒
  //   công tắc ẩn và lưu false (BE cũng tự chuẩn hóa).
  const haiCdSx = (r) => SX_HAI_CD.has((dsLuong.find((l) => l.ma === r.luong) || {}).sx);
  const motHieuLuc = (r) => motCua(r) && haiCdSx(r);
  const doiCongDoan = (r, k, v) => {
    let cd = { ...cdCua(r), [k]: v };
    if (dspCua(r)) cd = epThanhLogo(cd); // DSP Logo: Ép tính là Logo
    doiDong(r.ma_chuan, { cong_doan: cd, luong: luongTuCd(cd) });
  };
  // Bật DSP Logo ⇒ Ép đang bật chuyển sang Logo ngay (tắt lại không tự đổi Logo về Ép — người dùng tự chọn).
  const doiDsp = (r, v) => {
    const cd = v ? epThanhLogo(cdCua(r)) : { ...cdCua(r) };
    doiDong(r.ma_chuan, { dsp_logo: v, cong_doan: cd, luong: luongTuCd(cd) });
  };
  const datLuongNhieu = (ma) => {
    const l = dsLuong.find((x) => x.ma === ma);
    if (!l) return;
    setRows((rs) => rs.map((r) => {
      if (!chon.has(r.ma_chuan)) return r;
      const cd = dspCua(r) ? epThanhLogo(l.cd) : { ...l.cd }; // DSP Logo: Ép tính là Logo
      return { ...r, cong_doan: cd, luong: luongTuCd(cd) };
    }));
  };

  const hienDaChon = hien.filter((r) => chon.has(r.ma_chuan)).length;
  const chonHet = hien.length > 0 && hienDaChon === hien.length;
  const doiTatCa = () => setChon(chon.size > 0 ? new Set() : new Set(hien.map((r) => r.ma_chuan)));
  const doiMot = (ma) => setChon((cu) => {
    const m = new Set(cu);
    if (m.has(ma)) m.delete(ma); else m.add(ma);
    return m;
  });

  // Xuất Excel (14/11/2026, người dùng yêu cầu): đúng các dòng đang xem (chip + lọc + ô tìm), kể cả thay đổi chưa lưu.
  //   3 cột công đoạn xuất 1/0 như cột CoIn / CoInKieng / CoEp của ERP để đối chiếu thẳng.
  const [dangXuat, setDangXuat] = useState(false);
  const xuatExcel = async () => {
    setDangXuat(true);
    try {
      const { default: exportPanelExcel } = await import('../../../components/common/exportPanelExcel');
      const so = (v) => (v ? 1 : 0);
      await exportPanelExcel({
        cols: [
          { header: 'Mã tính chất in', width: 22, value: (r) => r.ten || '' },
          { header: 'Tên tính chất in', width: 44, value: (r) => r.ghi_chu || '' },
          { header: 'DSP Logo', width: 10, center: true, value: (r) => (dspCua(r) ? 1 : 0) },
          { header: 'Có in', width: 9, center: true, value: (r) => so(cdCua(r).in) },
          { header: 'Có in kiếng', width: 11, center: true, value: (r) => so(cdCua(r).kieng) },
          { header: 'Có logo', width: 9, center: true, value: (r) => so(cdCua(r).logo) },
          { header: 'Có ép', width: 9, center: true, value: (r) => so(cdCua(r).ep) },
          ...CHE_DO_READY.map((c) => ({ header: c.ten, width: 14, center: true, value: (r) => so(cheDoCua(r) === c.v) })),
          { header: 'Kỹ thuật Ép/Logo', width: 16, value: (r) => (coEp(cdCua(r)) ? (KT_YC_CHON.find((k) => k.v === ktYcCua(r)) || {}).ten || '' : '') },
          { header: 'Xác nhận HSKT', width: 13, center: true, value: (r) => (coEp(cdCua(r)) && coKtHskt ? so(ktHsktCua(r)) : '') },
          { header: 'Số công đoạn', width: 12, center: true, value: (r) => CONG_DOAN.filter((c) => cdCua(r)[c.k]).length },
          { header: '1 tờ TDTHĐH', width: 12, center: true, value: (r) => (haiCdSx(r) ? so(motHieuLuc(r)) : '') },
          { header: 'Luồng', width: 24, value: (r) => tenLuong(r.luong) },
          { header: 'Bỏ qua khi đồng bộ ERP', width: 14, center: true, value: (r) => (r.bo_qua ? 'Có' : '') },
          { header: 'Phần in trong MES', width: 12, num: true, value: (r) => Number(r.so_phan_in) || 0 },
        ],
        rows: hien,
        title: 'Tính chất in',
        subtitle: `${fmtNum(hien.length)} tính chất${chip ? ` · ${tenLuong(chip)}` : ''}${search ? ` · tìm "${search}"` : ''}${dsDoi.length ? ' · có thay đổi CHƯA LƯU' : ''}`,
        fileName: 'tinh-chat-in',
      });
    } catch (e) {
      show(e.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setDangXuat(false);
    }
  };

  const luu = async () => {
    setSaving(true);
    const coDoiBoQua = dsMo.length + dsBoQuaMoi.length > 0;
    try {
      const res = await saveTinhChatIn(dsDoi.map((r) => ({ ten: r.ten, cong_doan: cdCua(r), bo_qua: r.bo_qua, ghi_chu: ghiChuCua(r),
        ready_che_do: cheDoCua(r), kt_yeu_cau: coEp(cdCua(r)) ? ktYcCua(r) : 'KHUON_MUC', kt_hskt: ktHsktCua(r), dsp_logo: dspCua(r),
        mot_tdthdh: motHieuLuc(r) })));
      nap(res.data);
      setChon(new Set());
      setHoiLuu(false);
      const nPin = Number(res.data && res.data.so_phan_in_doi_luong) || 0;
      show(`${coDoiBoQua ? 'Đã lưu — đồng bộ ERP áp dụng từ lượt kế tiếp' : 'Đã lưu danh mục tính chất in'}${nPin ? ` · ${fmtNum(nPin)} phần in đổi luồng` : ''}`);
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };
  const bamLuu = () => {
    if (dsMo.length + dsBoQuaMoi.length > 0) setHoiLuu(true);
    else luu();
  };

  // Thêm / xóa tải lại danh mục từ server nhưng GIỮ các dòng đang sửa dở chưa lưu.
  const napGiuSua = (d) => {
    const dangSua = new Map(dsDoi.map((r) => [r.ma_chuan, r]));
    setGoc(gocTu(d.items || []));
    setRows((d.items || []).map((r) => {
      const s = dangSua.get(r.ma_chuan);
      return s ? { ...r, luong: s.luong, cong_doan: s.cong_doan, bo_qua: s.bo_qua, ghi_chu: s.ghi_chu, ready_che_do: s.ready_che_do,
        kt_yeu_cau: s.kt_yeu_cau, kt_hskt: s.kt_hskt, dsp_logo: s.dsp_logo, mot_tdthdh: s.mot_tdthdh } : r;
    }));
  };
  const luuThem = async () => {
    setSaving(true);
    try {
      const res = await addTinhChatIn({ ten: them.ten, cong_doan: them.dsp_logo ? epThanhLogo(them.cong_doan) : them.cong_doan,
        bo_qua: them.bo_qua, ghi_chu: them.ghi_chu, dsp_logo: !!them.dsp_logo });
      napGiuSua(res.data);
      setThem(null);
      show('Đã thêm tính chất in');
    } catch (e) {
      show(e.message || 'Thêm thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };
  const luuXoa = async () => {
    setSaving(true);
    try {
      const res = await removeTinhChatIn(xoa.id);
      napGiuSua(res.data);
      setChon((cu) => { const m = new Set(cu); m.delete(xoa.ma_chuan); return m; });
      setXoa(null);
      show('Đã xóa tính chất in');
    } catch (e) {
      show(e.message || 'Xóa thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    ...(suaDuoc ? [{
      key: 'sel', selection: true,
      header: <input type="checkbox" aria-label="Chọn tất cả / bỏ tích tất cả" checked={chonHet}
        ref={(el) => { if (el) el.indeterminate = chon.size > 0 && !chonHet; }} onChange={doiTatCa} />,
      render: (r) => <input type="checkbox" aria-label={`Chọn ${r.ten}`} checked={chon.has(r.ma_chuan)} onChange={() => doiMot(r.ma_chuan)} />,
    }] : []),
    {
      key: 'ten', header: 'Tính chất in',
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-ink">{r.ten}</span>
          {r.moi && <Badge tone="info">Mới từ ERP</Badge>}
        </span>
      ),
    },
    {
      key: 'dsp_logo', header: 'DSP Logo', headerClassName: 'text-center', className: 'text-center',
      render: (r) => (
        <Toggle on={dspCua(r)} disabled={!suaDuoc || !coDsp}
          title={coDsp ? `Dòng sản phẩm Logo — Ép tính là Logo, In + Ép thành In + Logo (2 công đoạn) — ${r.ten}` : 'Chưa chạy migration 137'}
          onChange={(v) => doiDsp(r, v)} />
      ),
    },
    ...CONG_DOAN.map((c) => ({
      key: `cd_${c.k}`, header: c.ten, headerClassName: 'text-center', className: 'text-center',
      render: (r) => {
        const khoaEp = c.k === 'ep' && dspCua(r); // DSP Logo: không có công đoạn Ép (Ép = Logo)
        return (
          <Toggle on={!!cdCua(r)[c.k]} disabled={!suaDuoc || khoaEp}
            title={khoaEp ? `DSP Logo — công đoạn ép tính là Logo — ${r.ten}` : `${c.ten} — ${r.ten}`}
            onChange={(v) => doiCongDoan(r, c.k, v)} />
        );
      },
    })),
    {
      key: 'luong', header: 'Luồng',
      render: (r) => {
        const l = dsLuong.find((x) => x.ma === r.luong) || {};
        const n = CONG_DOAN.filter((c) => cdCua(r)[c.k]).length;
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5 whitespace-nowrap">
            <span className="text-ink">{tenLuong(r.luong)}</span>
            {n >= 2 && <Badge tone={l.tam ? 'warning' : 'info'}>{n} công đoạn</Badge>}
          </span>
        );
      },
    },
    {
      key: 'mot_tdthdh', header: '1 tờ TDTHĐH', headerClassName: 'text-center', className: 'text-center',
      render: (r) => {
        if (!haiCdSx(r)) {
          const sx = (dsLuong.find((l) => l.ma === r.luong) || {}).sx;
          return <span className="text-ink-soft" title={sx === 'IN_EP' ? 'In + Logo: mỗi đợt vốn đã mang cả 2 công đoạn' : undefined}>—</span>;
        }
        return (
          <Toggle on={motCua(r)} disabled={!suaDuoc || !coMot}
            title={coMot
              ? `Chỉ có 1 tờ TDTHĐH (ERP gửi lên MES 1 lần) — đợt mới từ ERP tự có cả 2 công đoạn — ${r.ten}`
              : 'Chưa chạy migration 139'}
            onChange={(v) => doiDong(r.ma_chuan, { mot_tdthdh: v })} />
        );
      },
    },
    ...CHE_DO_READY.map((c) => ({
      key: `cd_ready_${c.v}`, header: c.ten, headerClassName: 'text-center', className: 'text-center',
      render: (r) => {
        const nhieu = CONG_DOAN.filter((x) => cdCua(r)[x.k]).length >= 2;
        if (!nhieu) return <span className="text-ink-soft">—</span>;
        return (
          <Toggle on={cheDoCua(r) === c.v} disabled={!suaDuoc || !coCheDo}
            title={coCheDo ? `${c.moTa} — ${r.ten}` : 'Chưa chạy migration 131'}
            onChange={(v) => doiDong(r.ma_chuan, { ready_che_do: v ? c.v : 'RIENG' })} />
        );
      },
    })),
    {
      key: 'kt_yeu_cau', header: 'Kỹ thuật Ép/Logo',
      render: (r) => {
        if (!coEp(cdCua(r))) return <span className="text-ink-soft">—</span>;
        const v = ktYcCua(r);
        if (!suaDuoc || !coKtYc) {
          return (
            <span title={coKtYc ? undefined : 'Chưa chạy migration 133 — đang theo mặc định Khuôn + Mực'}>
              <Badge tone={v === 'KHONG' ? 'warning' : 'info'}>{(KT_YC_CHON.find((k) => k.v === v) || {}).ten}</Badge>
            </span>
          );
        }
        return (
          <div className="min-w-[9.5rem]">
            <Select aria-label={`Kỹ thuật Ép/Logo — ${r.ten}`} value={v}
              title="READY của công đoạn Ép/Logo: xác nhận Khuôn / Mực nào (không có Film). Không qua KT ⇒ đi thẳng QC."
              onChange={(e) => doiDong(r.ma_chuan, { kt_yeu_cau: e.target.value })}>
              {KT_YC_CHON.map((k) => <option key={k.v} value={k.v}>{k.ten}</option>)}
            </Select>
          </div>
        );
      },
    },
    {
      key: 'kt_hskt', header: 'Xác nhận HSKT', headerClassName: 'text-center', className: 'text-center',
      render: (r) => {
        if (!coEp(cdCua(r))) return <span className="text-ink-soft">—</span>;
        return (
          <Toggle on={coKtHskt && ktHsktCua(r)} disabled={!suaDuoc || !coKtHskt}
            title={coKtHskt ? `Dòng Ép/Logo ở READY phải xác nhận HSKT — ${r.ten}` : 'Chưa chạy migration 134'}
            onChange={(v) => doiDong(r.ma_chuan, { kt_hskt: v })} />
        );
      },
    },
    {
      key: 'bo_qua', header: 'Bỏ qua',
      render: (r) => (
        <Toggle on={r.bo_qua} disabled={!suaDuoc} title={`Bỏ qua ${r.ten}`}
          onChange={(v) => doiDong(r.ma_chuan, { bo_qua: v })} />
      ),
    },
    {
      key: 'hien_tai', header: 'Hiện tại',
      render: (r) => { const h = hienTai(r, dsLuong); return <Badge tone={h.tone}>{h.ten}</Badge>; },
    },
    { key: 'so_phan_in', header: 'Phần in trong MES', className: 'text-right tabular-nums', headerClassName: 'text-right', render: (r) => fmtNum(r.so_phan_in) },
    { key: 'so_dot_erp', header: 'Đợt ERP ~10 ngày', className: 'text-right tabular-nums', headerClassName: 'text-right', render: (r) => fmtNum(r.so_dot_erp) },
    {
      key: 'ghi_chu', header: 'Ghi chú',
      render: (r) => (suaDuoc ? (
        <div className="min-w-[16rem]">
          <Input aria-label={`Ghi chú của ${r.ten}`} value={r.ghi_chu || ''} maxLength={300}
            onChange={(e) => doiDong(r.ma_chuan, { ghi_chu: e.target.value })} />
        </div>
      ) : (r.ghi_chu || '—')),
    },
    {
      key: 'sua', header: 'Sửa gần nhất',
      render: (r) => (r.nguoi_sua
        ? <span className="text-xs text-ink-soft">{r.nguoi_sua}<br />{fmtDateTime(r.updated_date)}</span>
        : <span className="text-ink-soft">—</span>),
    },
    ...(suaDuoc ? [{
      key: 'xoa', header: '',
      render: (r) => (r.id && !r.bo_qua && !r.so_phan_in
        ? <Button variant="ghost" onClick={() => setXoa(r)}>Xóa</Button>
        : null),
    }] : []),
  ];

  return (
    <div>
      <Toolbar title="Tính chất in" search={search} onSearch={setSearch} searchPlaceholder="Tìm tính chất, ghi chú...">
        <Button variant="secondary" icon="download" chiXemOk loading={dangXuat} disabled={loading || !hien.length} onClick={xuatExcel}>
          Xuất Excel
        </Button>
        {suaDuoc && (
          <>
            <Button variant="secondary" icon="plus" onClick={() => setThem({
              ten: '', cong_doan: { ...((dsLuong.find((l) => l.ma === chip) || {}).cd || { in: false, kieng: false, logo: false, ep: false }) }, bo_qua: false, ghi_chu: '', dsp_logo: false,
            })}>
              Thêm tính chất
            </Button>
            <Button icon="check" loading={saving && !hoiLuu && !them && !xoa} disabled={!dsDoi.length} onClick={bamLuu}>
              Lưu thay đổi{dsDoi.length ? ` (${fmtNum(dsDoi.length)})` : ''}
            </Button>
          </>
        )}
      </Toolbar>

      {chuaMig && (
        <p className="mb-3 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          Chưa chạy migration 123 nên chưa lưu được. Đồng bộ ERP đang dùng danh sách bỏ qua mặc định.
        </p>
      )}

      <ChipTabs tabs={tabs} value={chip} counts={counts} onChange={setChip} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-control border border-line p-0.5">
          {LOC_BO_QUA.map((o) => (
            <button key={o.v || 'all'} type="button" onClick={() => setLocBoQua(o.v)}
              className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors ${
                locBoQua === o.v ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
        <Badge tone={soBoQua ? 'warning' : 'success'}>Đang bỏ qua {fmtNum(soBoQua)}/{fmtNum(tongLuong.length)}</Badge>

        {suaDuoc && chon.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-control border border-primary/40 bg-primary/5 px-2 py-1">
            <span className="text-sm font-medium text-ink">Đã chọn {fmtNum(chon.size)}</span>
            <div className="w-44">
              <Select aria-label="Đặt công đoạn cho các dòng đã chọn" value="" onChange={(e) => { if (e.target.value) datLuongNhieu(e.target.value); }}>
                <option value="">Đặt công đoạn…</option>
                {dsLuong.filter((l) => !String(l.ma).startsWith('CD_')).map((l) => <option key={l.ma} value={l.ma}>{l.ten}</option>)}
              </Select>
            </div>
            <Button variant="secondary" onClick={() => doiNhieu({ bo_qua: true })}>Bỏ qua</Button>
            <Button variant="secondary" onClick={() => doiNhieu({ bo_qua: false })}>Không bỏ qua</Button>
            <Button variant="ghost" onClick={() => setChon(new Set())}>Bỏ chọn</Button>
          </div>
        )}
      </div>

      <DataTable columns={columns} rows={hien} rowKey="ma_chuan" loading={loading} pageSize={0}
        emptyText="Không có tính chất in nào"
        rowClassName={(r) => (doiGoc(r, goc[r.ma_chuan]) ? 'bg-amber-50/70 dark:bg-amber-950/20' : '')} />

      <ConfirmDialog open={hoiLuu} onClose={() => setHoiLuu(false)} onConfirm={luu} loading={saving}
        title="Đổi tính chất bị bỏ qua khi đồng bộ ERP" variant="danger"
        confirmText={`Lưu ${fmtNum(dsDoi.length)} thay đổi`}
        message="Thay đổi này có hiệu lực từ lượt đồng bộ ERP kế tiếp.">
        <DanhSachTen tieuDe={`Không bỏ qua nữa (${fmtNum(dsMo.length)}): đợt mới vào MES, luồng riêng chưa làm thì đi luồng in thường`} ds={dsMo} />
        <DanhSachTen tieuDe={`Bắt đầu bỏ qua (${fmtNum(dsBoQuaMoi.length)}): đợt mới không vào MES, hàng đã có trong MES giữ nguyên`} ds={dsBoQuaMoi} />
      </ConfirmDialog>

      <ConfirmDialog open={!!xoa} onClose={() => setXoa(null)} onConfirm={luuXoa} loading={saving}
        title="Xóa tính chất in" variant="danger" confirmText="Xóa"
        message={xoa ? `Xóa "${xoa.ten}" khỏi danh mục?` : ''} />

      <Modal open={!!them} onClose={() => setThem(null)} title="Thêm tính chất in" size="sm"
        footer={(
          <>
            <Button variant="ghost" chiXemOk onClick={() => setThem(null)}>Hủy</Button>
            <Button onClick={luuThem} loading={saving} disabled={!them || !them.ten.trim()}>Thêm</Button>
          </>
        )}>
        {them && (
          <div className="space-y-3">
            <Field label="Tính chất in" required>
              <Input autoFocus maxLength={100} value={them.ten} onChange={(e) => setThem((s) => ({ ...s, ten: e.target.value }))} />
            </Field>
            <Field label="Công đoạn">
              <div className="flex flex-wrap gap-4 pt-1">
                {CONG_DOAN.map((c) => (
                  <label key={c.k} className="flex items-center gap-2 text-sm text-ink">
                    <Toggle on={!!them.cong_doan[c.k]} title={c.ten}
                      onChange={(v) => setThem((s) => ({ ...s, cong_doan: { ...s.cong_doan, [c.k]: v } }))} />
                    {c.ten}
                  </label>
                ))}
              </div>
              <div className="mt-1 text-xs text-ink-soft">Luồng: {tenLuong(luongTuCd(them.dsp_logo ? epThanhLogo(them.cong_doan) : them.cong_doan))}</div>
            </Field>
            {coDsp && (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={!!them.dsp_logo} onChange={(e) => setThem((s) => ({ ...s, dsp_logo: e.target.checked }))} />
                Dòng sản phẩm Logo (Ép tính là Logo, In + Ép thành In + Logo)
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={them.bo_qua} onChange={(e) => setThem((s) => ({ ...s, bo_qua: e.target.checked }))} />
              Bỏ qua khi đồng bộ ERP
            </label>
            <Field label="Ghi chú">
              <Input maxLength={300} value={them.ghi_chu} onChange={(e) => setThem((s) => ({ ...s, ghi_chu: e.target.value }))} />
            </Field>
          </div>
        )}
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
