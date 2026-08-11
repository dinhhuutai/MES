import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '@headlessui/react';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import TemGrid, { tenCot } from './TemGrid';
import TemToolbar from './TemToolbar';
import OPanel from './TemOPanel';
import TemXemTruoc from './TemXemTruoc';
import { inThuMauTem } from '../../production/utils/printTemLabel';
import {
  themHangNhieu, xoaHangVung, themCotNhieu, xoaCotVung, chiaLaiLuoi,
  gopVung, tachVung, datO, datONhieu, datVienVung, xoaNoiDungO, xoaDinhDangO, layDinhDang,
  datRongCot, datCaoHang, oGoc, oTrongVung, chuanVung, moRongVung, moiODeu,
  tongRongCung, tongCaoCung, khoaO, tachKhoa,
  RONG_MM, CAO_MM, SO_COT_MAX, SO_HANG_MAX,
} from '../utils/temLuoi';

// ─────────────────────────────────────────────────────────────────────────────
// TRÌNH THIẾT KẾ TEM — MODAL TOÀN MÀN HÌNH kiểu bảng tính.
//   [header: tên mẫu · 2 khung · chép khung · Lưu · Đóng]
//   [thanh công cụ DÍNH ĐỈNH]
//   [canvas 2 khung tem (cuộn được)            │ panel nội dung ô]
//   [thanh trạng thái: ô đang chọn · tổng mm · cảnh báo tràn khổ]
//
// ⚠ Dialog KHÔNG đóng bằng Esc / bấm nền (`onClose` rỗng): đang thiết kế dở mà lỡ tay là mất công.
//   Chỉ đóng qua nút Đóng, và có hỏi lại nếu chưa lưu.
// ─────────────────────────────────────────────────────────────────────────────

const ZOOM_MIN = 5;
const ZOOM_MAX = 16;

// Kẹp vùng chọn vào trong lưới hiện tại — sau khi xóa hàng/cột, vùng cũ có thể trỏ ra ngoài.
function kepVung(khung, v) {
  const hMax = khung.hang.length - 1;
  const cMax = khung.so_cot - 1;
  if (v.r1 > hMax || v.c1 > cMax) return null;
  return {
    r1: Math.max(0, Math.min(v.r1, hMax)), r2: Math.max(0, Math.min(v.r2, hMax)),
    c1: Math.max(0, Math.min(v.c1, cMax)), c2: Math.max(0, Math.min(v.c2, cMax)),
  };
}

export default function TemDesignerModal({ open, mau, dm, dataXemTruoc, onLuu, onClose }) {
  const [boCuc, setBoCuc] = useState(null);
  const [xemTruoc, setXemTruoc] = useState(false);   // false = thiết kế · true = xem bản in thật
  const [loiInThu, setLoiInThu] = useState(null);
  const [ben, setBen] = useState('trai');
  const [sel, setSel] = useState(null);          // { r1,c1,r2,c2, neo:"r,c" }
  // Đếm số lần BẤM CHỌN MỚI (không tăng khi kéo rê) — panel phải dựa vào đây để đưa con trỏ vào ô
  // nhập nội dung. Dùng bộ đếm thay vì `neo` để bấm LẠI đúng ô cũ vẫn lấy được con trỏ.
  const [lanChon, setLanChon] = useState(0);
  const [tiLe, setTiLe] = useState(8);
  const [luu, setLuu] = useState(false);
  const [dinhDangChep, setDinhDangChep] = useState(null);
  const [hoiDong, setHoiDong] = useState(false);
  // Ngăn xếp HOÀN TÁC / LÀM LẠI — mỗi phần tử là 1 ảnh chụp `boCuc` TRƯỚC khi sửa (giữ tối đa 50 bước).
  const [lichSu, setLichSu] = useState([]);
  const [lamLai, setLamLai] = useState([]);
  const [banDau, setBanDau] = useState('');

  // Nạp lại bố cục mỗi khi mở mẫu khác.
  useEffect(() => {
    if (!mau) { setBoCuc(null); return; }
    const bc = JSON.parse(JSON.stringify(mau.bo_cuc_json || {}));
    setBoCuc(bc); setBanDau(JSON.stringify(bc));
    setBen('trai'); setSel(null); setLichSu([]); setLamLai([]); setDinhDangChep(null);
    setXemTruoc(false); setLoiInThu(null);
  }, [mau]);

  // Tiền tố công đoạn của mẫu này khi in THẬT — lấy từ nút in đang gắn mẫu (vd tem sản xuất: trái 15,
  // phải 16). Chưa gắn nút nào thì lấy `15` cho cả 2 khung để vẫn thấy được dạng mã.
  const tienTo = useMemo(() => {
    const vt = (dm?.vi_tri_in || []).find((v) => mau && v.mau_tem_id === mau.id);
    return vt ? vt.tien_to : { trai: '15', phai: '15' };
  }, [dm, mau]);

  const hai = !!(boCuc && boCuc.phai);
  const khung = boCuc ? (ben === 'phai' && hai ? boCuc.phai : boCuc.trai) : null;
  const benThat = ben === 'phai' && hai ? 'phai' : 'trai';

  // ⚠⚠ ĐỌC TRẠNG THÁI QUA REF, KHÔNG LỒNG setState TRONG UPDATER của setState khác.
  // Updater phải THUẦN; React 18 StrictMode gọi updater 2 LẦN ở dev ⇒ đẩy lịch sử bên trong updater
  // sẽ ghi 2 bản, bấm Hoàn tác 1 lần trông như không có tác dụng.
  const boCucRef = useRef(null); boCucRef.current = boCuc;
  const lichSuRef = useRef([]); lichSuRef.current = lichSu;
  const lamLaiRef = useRef([]); lamLaiRef.current = lamLai;

  // MỌI thay đổi bố cục PHẢI đi qua đây để tự lưu ảnh chụp cho nút Hoàn tác.
  const capNhat = useCallback((fn) => {
    const truoc = boCucRef.current;
    if (!truoc) return;
    setLichSu((h) => [...h.slice(-49), JSON.stringify(truoc)]);
    setLamLai([]);
    setBoCuc(fn(truoc));
  }, []);

  // Sửa KHUNG đang mở (tiện dụng nhất — hầu hết thao tác đều ở dạng này).
  const datKhung = useCallback((k) => {
    if (!k) return;
    capNhat((b) => ({ ...b, [b.phai && ben === 'phai' ? 'phai' : 'trai']: k }));
  }, [capNhat, ben]);

  const hoanTac = useCallback(() => {
    const h = lichSuRef.current;
    if (!h.length || !boCucRef.current) return;
    setLamLai((r) => [...r, JSON.stringify(boCucRef.current)]);
    setBoCuc(JSON.parse(h[h.length - 1]));
    setLichSu(h.slice(0, -1));
  }, []);

  const lamLaiFn = useCallback(() => {
    const r = lamLaiRef.current;
    if (!r.length || !boCucRef.current) return;
    setLichSu((h) => [...h, JSON.stringify(boCucRef.current)]);
    setBoCuc(JSON.parse(r[r.length - 1]));
    setLamLai(r.slice(0, -1));
  }, []);

  // ── Vùng chọn (đã kẹp + nới theo ô gộp) ───────────────────────────────────
  const vung = useMemo(() => {
    if (!khung || !sel) return null;
    const v = kepVung(khung, sel);
    return v ? moRongVung(khung, v) : null;
  }, [khung, sel]);

  const khoas = useMemo(() => (khung && vung ? oTrongVung(khung, vung) : []), [khung, vung]);

  const neo = useMemo(() => {
    if (!khung || !vung) return null;
    const ung = sel?.neo;
    if (ung && khoas.includes(ung)) return ung;
    return oGoc(khung, vung.r1, vung.c1);
  }, [khung, vung, khoas, sel]);

  const oNeo = khung && neo ? (khung.o[neo] || {}) : null;
  const deu = useCallback((dk) => moiODeu(khung || { o: {} }, khoas, dk), [khung, khoas]);

  const chonVung = useCallback((benBam, tu, den, opts) => {
    if (!boCucRef.current) return;
    const b = boCucRef.current;
    const bThat = benBam === 'phai' && b.phai ? 'phai' : 'trai';
    const k = bThat === 'phai' ? b.phai : b.trai;
    if (!k) return;
    const doiKhung = bThat !== (ben === 'phai' && b.phai ? 'phai' : 'trai');
    if (doiKhung) setBen(bThat);
    if (!opts?.giuNeo) setLanChon((n) => n + 1);   // bấm chọn mới (kéo rê thì `giuNeo` = true)
    const v = moRongVung(k, chuanVung(tu, den));
    setSel((cu) => ({
      ...v,
      neo: (!doiKhung && opts?.giuNeo && cu?.neo) ? cu.neo : oGoc(k, tu.r, tu.c),
    }));
  }, [ben]);

  const chonHet = useCallback((benBam) => {
    const b = boCucRef.current;
    if (!b) return;
    const bThat = benBam === 'phai' && b.phai ? 'phai' : 'trai';
    const k = bThat === 'phai' ? b.phai : b.trai;
    if (!k) return;
    setBen(bThat);
    setLanChon((n) => n + 1);
    setSel({ r1: 0, c1: 0, r2: k.hang.length - 1, c2: k.so_cot - 1, neo: '0,0' });
  }, []);

  // ── Thao tác trên vùng ────────────────────────────────────────────────────
  const apDinhDang = useCallback((thayDoi) => {
    if (!khung || !khoas.length) return;
    datKhung(datONhieu(khung, khoas, thayDoi));
  }, [khung, khoas, datKhung]);

  const apVien = (kieu) => { if (khung && vung) datKhung(datVienVung(khung, vung, kieu)); };

  const doGop = () => {
    if (!khung || !vung) return;
    datKhung(gopVung(khung, vung));
    setSel({ ...vung, neo: khoaO(vung.r1, vung.c1) });
  };
  const doTach = () => { if (khung && vung) datKhung(tachVung(khung, vung)); };

  const doThemHang = (phia) => {
    if (!khung || !vung) return;
    const n = vung.r2 - vung.r1 + 1;
    datKhung(themHangNhieu(khung, phia === 'tren' ? vung.r1 : vung.r2 + 1, n));
  };
  const doXoaHang = () => {
    if (!khung || !vung) return;
    datKhung(xoaHangVung(khung, vung.r1, vung.r2));
    setSel(null);
  };
  const doThemCot = (phia) => {
    if (!khung || !vung) return;
    const n = vung.c2 - vung.c1 + 1;
    datKhung(themCotNhieu(khung, phia === 'trai' ? vung.c1 : vung.c2 + 1, n));
  };
  const doXoaCot = () => {
    if (!khung || !vung) return;
    datKhung(xoaCotVung(khung, vung.c1, vung.c2));
    setSel(null);
  };

  const doXoaNoiDung = useCallback(() => {
    if (khung && khoas.length) datKhung(xoaNoiDungO(khung, khoas));
  }, [khung, khoas, datKhung]);

  const doChenTruong = (ma) => {
    if (!khung || !neo) return;
    const t = (dm?.truong || []).find((x) => x.ma === ma);
    const phan = Array.isArray(oNeo?.phan) ? oNeo.phan : [];
    // ⚠ `kieu` LƯU THẲNG vào mảnh trường ⇒ bộ render tự đủ, không phải tra danh mục lúc in.
    //   Thiếu nó thì trường ngày in ra chuỗi ISO thô lên tem.
    datKhung(datO(khung, neo, {
      phan: [...phan, {
        loai: 'truong', ma, kieu: t?.kieu || 'chu',
        ...(t?.kieu === 'ngay' ? { dinh_dang: 'DD/MM/YY HH:mm' } : {}),
      }],
    }));
  };

  const doDoiKieuO = (kieu) => { if (khung && khoas.length) datKhung(datONhieu(khung, khoas, { kieu })); };

  // Chia lại lưới: hỏi lại vì ô nằm ngoài lưới mới sẽ MẤT (ô gộp tràn thì co lại).
  const [hoiChiaLai, setHoiChiaLai] = useState(null); // { h, c, mat }
  const xinChiaLaiLuoi = (h, c) => {
    if (!khung) return;
    const mat = Object.keys(khung.o || {}).filter((k) => {
      const [r, cc] = tachKhoa(k);
      return r >= h || cc >= c;
    }).length;
    if (!mat) { datKhung(chiaLaiLuoi(khung, h, c)); setSel(null); return; }
    setHoiChiaLai({ h, c, mat });
  };

  const doDoiRongCot = useCallback((c, mm) => {
    if (boCucRef.current) {
      const b = boCucRef.current;
      const bt = b.phai && ben === 'phai' ? 'phai' : 'trai';
      capNhat((x) => ({ ...x, [bt]: datRongCot(bt === 'phai' ? x.phai : x.trai, c, mm) }));
    }
  }, [capNhat, ben]);

  const doDoiCaoHang = useCallback((r, mm) => {
    if (boCucRef.current) {
      const b = boCucRef.current;
      const bt = b.phai && ben === 'phai' ? 'phai' : 'trai';
      capNhat((x) => ({ ...x, [bt]: datCaoHang(bt === 'phai' ? x.phai : x.trai, r, mm) }));
    }
  }, [capNhat, ben]);

  // Chép TOÀN BỘ khung trái sang khung phải (và ngược lại).
  const chepKhung = (tu) => {
    if (!boCuc) return;
    const nguon = tu === 'trai' ? boCuc.trai : boCuc.phai;
    if (!nguon) return;
    const dich = tu === 'trai' ? 'phai' : 'trai';
    capNhat((b) => ({ ...b, [dich]: JSON.parse(JSON.stringify(nguon)) }));
  };

  // Bật/tắt "2 khung khác nhau". Tắt = in 2 nhãn GIỐNG hệt nhau (phai = null).
  const doiCheDoHaiKhung = () => {
    if (!boCuc) return;
    if (hai) { capNhat((b) => ({ ...b, phai: null })); setBen('trai'); }
    else capNhat((b) => ({ ...b, phai: JSON.parse(JSON.stringify(b.trai)) }));
  };

  // ── Phím tắt ──────────────────────────────────────────────────────────────
  // Bỏ qua khi đang gõ trong ô nhập để không nuốt thao tác của chính ô đó.
  // ⚠⚠ NGOẠI LỆ: ô nhập nội dung của panel (`data-o-nhap`) LUÔN giữ con trỏ sau khi bấm chọn ô
  //   (TemGrid `preventDefault` mousedown nên focus không rời đi). Nếu chặn cứng theo thẻ INPUT thì
  //   mũi tên / Delete sẽ CHẾT hẳn sau lần bấm ô đầu tiên. Ô đó ĐANG TRỐNG ⇒ coi như không gõ gì,
  //   trả phím về cho lưới (đúng kiểu Excel: chọn ô, gõ chữ là nhập, bấm mũi tên là đi ô).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (xemTruoc) return;                 // chế độ xem trước: không sửa gì, phím tắt vô nghĩa
      const t = e.target || {};
      const tag = (t.tagName || '').toUpperCase();
      const oNhapTrong = tag === 'INPUT' && t.dataset && t.dataset.oNhap === '1' && !t.value;
      if (!oNhapTrong
        && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable)) return;
      const k = (e.key || '').toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); hoanTac(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); lamLaiFn(); }
        else if (k === 'a') { e.preventDefault(); chonHet(ben); }
        return;
      }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); doXoaNoiDung(); return; }
      const buoc = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] }[k];
      if (buoc && khung && sel) {
        e.preventDefault();
        const [nr, nc] = tachKhoa(neo || '0,0');
        if (e.shiftKey) {
          // Nới vùng từ ô neo tới góc đối diện đã dời.
          const r = Math.max(0, Math.min(khung.hang.length - 1, (buoc[0] < 0 ? sel.r1 : sel.r2) + buoc[0]));
          const c = Math.max(0, Math.min(khung.so_cot - 1, (buoc[1] < 0 ? sel.c1 : sel.c2) + buoc[1]));
          chonVung(ben, { r: nr, c: nc }, { r, c }, { giuNeo: true });
        } else {
          const r = Math.max(0, Math.min(khung.hang.length - 1, nr + buoc[0]));
          const c = Math.max(0, Math.min(khung.so_cot - 1, nc + buoc[1]));
          chonVung(ben, { r, c }, { r, c });
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, xemTruoc, hoanTac, lamLaiFn, chonHet, doXoaNoiDung, chonVung, ben, khung, sel, neo]);

  const doInThu = async () => {
    try { setLoiInThu(null); await inThuMauTem(boCuc, dataXemTruoc, tienTo); }
    catch (e) { setLoiInThu(e.message || 'Không mở được cửa sổ in'); }
  };

  const chuaLuu = !!boCuc && JSON.stringify(boCuc) !== banDau;

  const doLuu = async () => {
    setLuu(true);
    const ok = await onLuu(boCuc);
    if (ok) setBanDau(JSON.stringify(boCuc));
    setLuu(false);
  };

  const dong = () => { if (chuaLuu) setHoiDong(true); else onClose(); };

  if (!open || !mau || !boCuc || !khung) return null;

  const rongCung = tongRongCung(khung);
  const caoCung = tongCaoCung(khung);
  const traoRong = rongCung > RONG_MM + 0.01;
  const traoCao = caoCung > CAO_MM + 0.01;

  return (
    <>
      {/* onClose rỗng: KHÔNG cho Esc / bấm nền đóng — xem ghi chú đầu file */}
      <Dialog open={open} onClose={() => {}} className="relative z-50">
        <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        <div className="fixed inset-0">
          <Dialog.Panel className="flex h-full w-full flex-col bg-surface">
            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
              <Icon name="layout" size={18} className="text-primary" />
              <div className="min-w-0">
                <Dialog.Title className="truncate text-sm font-semibold text-ink">
                  {mau.ten_mau}
                  {chuaLuu && <span className="ml-2 text-xs font-normal text-warning">• chưa lưu</span>}
                </Dialog.Title>
                <p className="text-[11px] text-ink-soft">
                  Khổ tem {dm.kho_tem.to_rong_mm}×{dm.kho_tem.to_cao_mm}mm · mỗi tem {dm.kho_tem.tem_rong_mm}×{dm.kho_tem.tem_cao_mm}mm
                  {' '}· vùng nội dung {RONG_MM}×{CAO_MM}mm
                </p>
              </div>

              {/* CHUYỂN CHẾ ĐỘ — Thiết kế ↔ Xem trước bản in */}
              <div className="ml-2 flex overflow-hidden rounded-control border border-line">
                {[['Thiết kế', false, 'layout'], ['Xem trước', true, 'eye']].map(([ten, gt, ic]) => (
                  <button key={ten} type="button" onClick={() => setXemTruoc(gt)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${
                      xemTruoc === gt ? 'bg-primary text-white' : 'bg-surface text-ink-soft hover:text-ink'}`}>
                    <Icon name={ic} size={13} />{ten}
                  </button>
                ))}
              </div>

              {!xemTruoc && (
                <>
                  <label className="flex items-center gap-2 text-xs text-ink">
                    <input type="checkbox" checked={hai} onChange={doiCheDoHaiKhung} />
                    2 khung KHÁC nhau
                  </label>
                  <Button variant="ghost" icon="copy" disabled={!hai} onClick={() => chepKhung(ben)}>
                    Chép {ben === 'trai' ? 'trái → phải' : 'phải → trái'}
                  </Button>
                </>
              )}

              <div className="ml-auto flex items-center gap-2">
                <Button onClick={doLuu} loading={luu} icon="save" disabled={!chuaLuu}>Lưu mẫu</Button>
                <Button variant="ghost" icon="x" onClick={dong}>Đóng</Button>
              </div>
            </div>

            {/* ── THANH CÔNG CỤ (dính đỉnh) — chế độ xem trước không có gì để định dạng ─── */}
            <div className={`shrink-0 ${xemTruoc ? 'hidden' : ''}`}>
              <TemToolbar
                dm={dm} khung={khung} vung={vung} khoas={khoas} oNeo={oNeo} deu={deu}
                onDinhDang={apDinhDang} onVien={apVien} onGop={doGop} onTach={doTach}
                onThemHang={doThemHang} onXoaHang={doXoaHang} onThemCot={doThemCot} onXoaCot={doXoaCot}
                onXoaNoiDung={doXoaNoiDung}
                onXoaDinhDang={() => khung && khoas.length && datKhung(xoaDinhDangO(khung, khoas))}
                onChepDinhDang={() => setDinhDangChep(layDinhDang(oNeo || {}))}
                onDanDinhDang={() => dinhDangChep && apDinhDang(dinhDangChep)}
                daChepDinhDang={!!dinhDangChep}
                onHoanTac={hoanTac} onLamLai={lamLaiFn}
                coHoanTac={!!lichSu.length} coLamLai={!!lamLai.length}
                onChenTruong={doChenTruong} onDoiKieuO={doDoiKieuO} onChiaLaiLuoi={xinChiaLaiLuoi}
                tiLe={tiLe}
                onZoom={(d) => setTiLe((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + d)))}
              />
            </div>

            {/* ── THÂN: canvas + panel ───────────────────────────────────── */}
            {xemTruoc ? (
              <div className="min-h-0 flex-1 overflow-auto bg-surface-muted p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-soft">
                    Tờ in {dm.kho_tem.to_rong_mm}×{dm.kho_tem.to_cao_mm}mm — đúng những gì máy in nhận
                    (kể cả cỡ chữ đã tự co và mã QR/mã vạch thật). Vạch xanh nét đứt là mép cắt giữa 2 nhãn.
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" title="Thu nhỏ" disabled={tiLe <= ZOOM_MIN}
                      className="rounded-control border border-line p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                      onClick={() => setTiLe((z) => Math.max(ZOOM_MIN, z - 1))}><Icon name="zoom-out" size={14} /></button>
                    <span className="w-12 text-center text-xs text-ink-soft">{Math.round((tiLe / (96 / 25.4)) * 100)}%</span>
                    <button type="button" title="Phóng to" disabled={tiLe >= ZOOM_MAX}
                      className="rounded-control border border-line p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                      onClick={() => setTiLe((z) => Math.min(ZOOM_MAX, z + 1))}><Icon name="zoom-in" size={14} /></button>
                    <Button variant="secondary" icon="printer" onClick={doInThu} className="ml-1 px-3 py-1.5">In thử</Button>
                  </div>
                </div>
                {loiInThu && (
                  <div className="mb-3 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
                    {loiInThu}
                  </div>
                )}
                <TemXemTruoc boCuc={boCuc} data={dataXemTruoc} tiLe={tiLe} tienTo={tienTo} />
                <p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-ink-soft">
                  Dữ liệu ở đây là <b>số liệu mẫu</b> để canh bố cục — lúc in thật sẽ thay bằng dữ liệu của tem.
                  Mã tem xem trước dùng tiền tố <b>{tienTo.trai}</b>
                  {tienTo.phai !== tienTo.trai ? <> / <b>{tienTo.phai}</b></> : null}
                  {' '}theo nút in đang gắn mẫu này. Nút <b>In thử</b> mở đúng cửa sổ in thật (dữ liệu mẫu,
                  <b> không tiêu mã tem</b> nào của ERP).
                </p>
              </div>
            ) : (
            <div className="flex min-h-0 flex-1">
              <div className="flex-1 overflow-auto bg-surface-muted p-5">
                <div className="flex items-start gap-4">
                  {['trai', 'phai'].map((b) => {
                    const k = b === 'trai' ? boCuc.trai : (boCuc.phai || boCuc.trai);
                    const laBanChep = b === 'phai' && !hai;
                    const dangSua = benThat === b || (laBanChep && benThat === 'trai');
                    return (
                      <div key={b} className={`rounded-card bg-white p-2 ${dangSua ? 'ring-2 ring-primary' : 'ring-1 ring-line'}`}>
                        <TemGrid
                          ben={b}
                          nhan={`${b === 'trai' ? 'Nhãn TRÁI' : 'Nhãn PHẢI'}${laBanChep ? ' (chép theo trái)' : ''}`}
                          khung={k} data={dataXemTruoc} tiLe={tiLe}
                          vung={dangSua ? vung : null} neo={dangSua ? neo : null} dangSua={dangSua}
                          onChon={chonVung} onChonHet={chonHet}
                          onDoiRongCot={doDoiRongCot} onDoiCaoHang={doDoiCaoHang}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-ink-soft">
                  Bấm 1 ô là <b>gõ nội dung được ngay</b> (con trỏ tự vào ô nhập bên phải, Enter để thêm) ·
                  kéo chuột để chọn nhiều ô · Shift+bấm để nới vùng · bấm chữ <b>A/B/C…</b> hay số <b>1/2/3…</b> để chọn cả cột/hàng ·
                  kéo mép header để đổi bề rộng cột / chiều cao hàng · phím mũi tên để đi ô, <b>Delete</b> xóa nội dung,
                  <b> Ctrl+Z</b> hoàn tác.
                </p>
              </div>

              <aside className="w-[21rem] shrink-0 overflow-y-auto border-l border-line p-3">
                {neo ? (
                  <OPanel
                    khoa={neo} o={oNeo} dm={dm} vung={vung} soO={khoas.length} tinHieuChon={lanChon}
                    data={dataXemTruoc}
                    hang={khung.hang[tachKhoa(neo)[0]]}
                    cot={(khung.cot || [])[tachKhoa(neo)[1]]}
                    onDoiO={(v) => datKhung(datO(khung, neo, v))}
                    onDoiHang={(mm) => doDoiCaoHang(tachKhoa(neo)[0], mm)}
                    onDoiCot={(mm) => doDoiRongCot(tachKhoa(neo)[1], mm)}
                  />
                ) : (
                  <div className="rounded-control border border-dashed border-line p-4 text-center text-sm text-ink-soft">
                    Bấm (hoặc kéo chọn) trên lưới để sửa ô.
                  </div>
                )}
              </aside>
            </div>
            )}

            {/* ── THANH TRẠNG THÁI ───────────────────────────────────────── */}
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line px-4 py-1.5 text-[11px] text-ink-soft">
              <span>
                {xemTruoc
                  ? `Xem trước bản in — ${hai ? '2 nhãn khác nhau' : '2 nhãn giống nhau'}`
                  : (vung
                    ? `Đang chọn ${tenCot(vung.c1)}${vung.r1 + 1}${khoas.length > 1 ? `:${tenCot(vung.c2)}${vung.r2 + 1} (${khoas.length} ô)` : ''}`
                    : 'Chưa chọn ô nào')}
              </span>
              <span>·</span>
              <span>Lưới {khung.hang.length}/{SO_HANG_MAX} hàng × {khung.so_cot}/{SO_COT_MAX} cột</span>
              <span>·</span>
              <span className={traoRong ? 'font-semibold text-danger' : ''}>
                Bề rộng đặt cứng {rongCung.toFixed(1)}/{RONG_MM}mm
              </span>
              <span className={traoCao ? 'font-semibold text-danger' : ''}>
                · Chiều cao đặt cứng {caoCung.toFixed(1)}/{CAO_MM}mm
              </span>
              {(traoRong || traoCao) && (
                <Badge tone="danger">Vượt khổ tem — bản in sẽ bị cắt, hãy giảm bớt</Badge>
              )}
              <span className="ml-auto">{lichSu.length} bước có thể hoàn tác</span>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!hoiChiaLai} onClose={() => setHoiChiaLai(null)}
        onConfirm={() => {
          datKhung(chiaLaiLuoi(khung, hoiChiaLai.h, hoiChiaLai.c));
          setSel(null); setHoiChiaLai(null);
        }}
        title="Chia lại lưới?" variant="danger" confirmText="Chia lại"
        message={hoiChiaLai
          ? `Chia lại thành ${hoiChiaLai.h} hàng × ${hoiChiaLai.c} cột (ô ~${(RONG_MM / hoiChiaLai.c).toFixed(1)}×${(CAO_MM / hoiChiaLai.h).toFixed(1)}mm). `
            + `${hoiChiaLai.mat} ô nằm ngoài lưới mới sẽ bị xóa, ô gộp tràn ra ngoài sẽ co lại. Bấm Ctrl+Z để hoàn tác nếu không ưng.`
          : ''}
      />

      <ConfirmDialog
        open={hoiDong} onClose={() => setHoiDong(false)}
        onConfirm={() => { setHoiDong(false); onClose(); }}
        title="Đóng mà không lưu?" variant="danger" confirmText="Đóng, bỏ thay đổi"
        message="Bố cục đang có thay đổi chưa lưu. Đóng bây giờ sẽ mất các thay đổi đó."
      />
    </>
  );
}
