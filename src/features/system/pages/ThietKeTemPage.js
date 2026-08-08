import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Spinner from '../../../components/common/Spinner';
import { Field, Input, Select, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import Toast from '../../../components/common/Toast';
import TemGrid from '../components/TemGrid';
import OPanel from '../components/TemOPanel';
import {
  layDanhMucMauTem, listMauTem, getMauTem, taoMauTem, nhanBanMauTem,
  suaMauTem, xoaMauTem, ganMauTem,
} from '../../../services/mauTemService';
import {
  themHang, xoaHang, themCot, xoaCot, gopO, tachO, datO, oGoc, khungRong, tachKhoa,
} from '../utils/temLuoi';

// Dữ liệu MẪU để xem trước (không gọi API tem thật — màn thiết kế phải mở được cả khi chưa in tem nào).
const DATA_XEM_TRUOC = {
  ma_tem: '152608057689', ma_lenh_san_xuat: 'LSX0450', trang_thai: 'IN',
  ten_khach_hang: 'SL-GLOVIS', ma_don_hang: 'SG26-SPG-006', ma_hang: 'A01-F01',
  ma_phan: 'GL-2606-005-A01-F01-C01', so_luong_don_hang: 1200,
  mau_vai: 'ĐEN', kich_vai: '1.5 x 2.0', kich_phim: '40 x 60', gc_mau_vai: 'GC ĐEN',
  so_luong: 504, ma_chuyen: 'M4A-4B', ten_chuyen: 'Chuyền M4A-4B', ca: 'Ca 1',
  ma_ngay_ca: '260808C1', nguoi_in: 'Nguyễn Văn A', nha_gia_cong: 'KK',
  created_date: new Date().toISOString(), tg_bd_in: new Date().toISOString(),
  tg_bd_phoi: new Date().toISOString(), tg_kt_phoi: new Date(Date.now() + 36e5).toISOString(),
  gio_sx_bd: '07:30', gio_sx_kt: '11:45', ngay_ca: new Date().toISOString(),
};

export default function ThietKeTemPage() {
  const { toast, show } = useToast();
  const [dm, setDm] = useState(null);            // danh mục: khổ tem · vị trí in · trường · định dạng ngày
  const [ds, setDs] = useState([]);              // danh sách mẫu
  const [dangTai, setDangTai] = useState(true);
  const [mau, setMau] = useState(null);          // mẫu đang mở (đã tải chi tiết)
  const [boCuc, setBoCuc] = useState(null);      // bố cục đang sửa (bản nháp)
  const [ben, setBen] = useState('trai');        // khung đang sửa
  const [chon, setChon] = useState(null);        // khóa ô đang chọn "r,c"
  const [neo, setNeo] = useState(null);          // ô neo để GỘP (bấm ô 1 → Gộp tới ô 2)
  const [luu, setLuu] = useState(false);
  // Ngăn xếp HOÀN TÁC / LÀM LẠI — mỗi phần tử là 1 ảnh chụp `boCuc` TRƯỚC khi sửa.
  // Giữ tối đa 50 bước (bố cục là JSON nhỏ, nhưng đừng để phình vô hạn khi sửa cả buổi).
  const [lichSu, setLichSu] = useState([]);
  const [lamLai, setLamLai] = useState([]);
  const [moTao, setMoTao] = useState(false);
  const [xacNhanXoa, setXacNhanXoa] = useState(null);
  const [form, setForm] = useState({ ma_mau: '', ten_mau: '', mo_ta: '' });

  const tai = useCallback(async () => {
    setDangTai(true);
    try {
      const [a, b] = await Promise.all([layDanhMucMauTem(), listMauTem()]);
      setDm(a.data); setDs(b.data.items || []);
    } catch (e) { show(e.message || 'Không tải được danh sách mẫu tem', 'error'); }
    setDangTai(false);
    // ⚠ deps là `show` (ổn định — useCallback([]) trong useToast), TUYỆT ĐỐI KHÔNG để cả object
    // `useToast()` vào đây: nó là object MỚI mỗi lần render ⇒ `tai` đổi mỗi render ⇒ useEffect([tai])
    // chạy lại vô hạn ⇒ bắn request không ngừng, trình duyệt trả ERR_INSUFFICIENT_RESOURCES.
  }, [show]);

  useEffect(() => { tai(); }, [tai]);


  const moMau = async (id) => {
    try {
      const res = await getMauTem(id);
      setMau(res.data);
      setBoCuc(JSON.parse(JSON.stringify(res.data.bo_cuc_json || {})));
      setBen('trai'); setChon(null); setNeo(null); setLichSu([]); setLamLai([]);
    } catch (e) { show(e.message || 'Không mở được mẫu', 'error'); }
  };

  // Khung đang sửa. `phai: null` = in 2 nhãn giống nhau → chỉ sửa khung trái.
  const khung = boCuc ? (ben === 'trai' ? boCuc.trai : boCuc.phai) : null;
  const hai = !!(boCuc && boCuc.phai);

  // ⚠⚠ ĐỌC TRẠNG THÁI QUA REF, KHÔNG LỒNG setState TRONG UPDATER của setState khác.
  // Updater phải THUẦN; React 18 StrictMode gọi updater 2 LẦN ở môi trường dev ⇒ nếu đẩy lịch sử
  // bên trong updater thì mỗi thao tác ghi 2 bản, bấm Hoàn tác 1 lần trông như không có tác dụng.
  // Ref luôn giữ giá trị mới nhất nên các hàm dưới đây khai deps rỗng vẫn đọc đúng.
  const boCucRef = useRef(null); boCucRef.current = boCuc;
  const lichSuRef = useRef([]); lichSuRef.current = lichSu;
  const lamLaiRef = useRef([]); lamLaiRef.current = lamLai;

  // MỌI thay đổi bố cục PHẢI đi qua đây để tự lưu ảnh chụp cho nút Hoàn tác.
  const capNhat = useCallback((fn) => {
    const truoc = boCucRef.current;
    if (!truoc) return;
    setLichSu((h) => [...h.slice(-49), JSON.stringify(truoc)]); // giữ tối đa 50 bước
    setLamLai([]);                                              // sửa mới → bỏ nhánh "làm lại" cũ
    setBoCuc(fn(truoc));
  }, []);

  const hoanTac = useCallback(() => {
    const h = lichSuRef.current;
    if (!h.length || !boCucRef.current) return;
    setLamLai((r) => [...r, JSON.stringify(boCucRef.current)]);
    setBoCuc(JSON.parse(h[h.length - 1]));
    setLichSu(h.slice(0, -1));
    setChon(null); setNeo(null);
  }, []);

  const lamLaiFn = useCallback(() => {
    const r = lamLaiRef.current;
    if (!r.length || !boCucRef.current) return;
    setLichSu((h) => [...h, JSON.stringify(boCucRef.current)]);
    setBoCuc(JSON.parse(r[r.length - 1]));
    setLamLai(r.slice(0, -1));
    setChon(null); setNeo(null);
  }, []);

  // Phím tắt Ctrl+Z / Ctrl+Y (và Ctrl+Shift+Z) — bỏ qua khi đang gõ trong ô nhập để không nuốt
  // thao tác hoàn tác CHỮ của chính ô đó.
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const t = e.target || {};
      const tag = (t.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      const k = (e.key || '').toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); hoanTac(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); lamLaiFn(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hoanTac, lamLaiFn]);

  const datKhung = (k) => capNhat((b) => ({ ...b, [ben]: k }));
  const oDangChon = khung && chon ? (khung.o[chon] || {}) : null;

  // `benBam` = khung vừa được bấm. Truyền tường minh vì `ben` trong cùng lần render có thể chưa kịp đổi.
  // Khung PHẢI khi đang ở chế độ "2 nhãn giống nhau" chỉ là bản chép → mọi thao tác quy về khung TRÁI.
  const bamO = (khoa, benBam) => {
    const bThat = benBam === 'phai' && !hai ? 'trai' : benBam;
    const k = bThat === 'trai' ? boCuc.trai : boCuc.phai;
    if (!k) return;
    const [r, c] = tachKhoa(khoa);
    const goc = oGoc(k, r, c);
    if (bThat !== ben) { setBen(bThat); setChon(goc); setNeo(null); return; } // bấm sang khung khác
    if (neo && neo !== goc) {                                                 // đang gộp → ô này là ô đích
      capNhat((b) => ({ ...b, [bThat]: gopO(k, neo, goc) }));
      setNeo(null); setChon(neo); return;
    }
    setChon(goc);
  };

  const doiO = (thayDoi) => { if (chon) datKhung(datO(khung, chon, thayDoi)); };

  const luuMau = async () => {
    if (!mau) return;
    setLuu(true);
    try {
      await suaMauTem(mau.id, { ten_mau: mau.ten_mau, mo_ta: mau.mo_ta, bo_cuc: boCuc });
      show('Đã lưu mẫu tem');
      await tai();
    } catch (e) {
      // BE trả `details` = danh sách lỗi bố cục → hiện đúng chỗ sai thay vì "Lỗi hệ thống".
      show(e.message || 'Lưu mẫu thất bại', 'error');
    }
    setLuu(false);
  };

  const doGan = async (maViTri, mauTemId) => {
    try {
      await ganMauTem(maViTri, mauTemId);
      show(mauTemId ? 'Đã gắn mẫu vào nút in' : 'Đã gỡ — nút in dùng lại bố cục mặc định');
      await tai();
    } catch (e) { show(e.message || 'Gắn mẫu thất bại', 'error'); }
  };

  const doTao = async () => {
    try {
      const body = { ...form, bo_cuc: { v: 1, trai: khungRong(), phai: null } };
      const res = await taoMauTem(body);
      setMoTao(false); setForm({ ma_mau: '', ten_mau: '', mo_ta: '' });
      await tai(); await moMau(res.data.id);
      show('Đã tạo mẫu mới — thiết kế rồi bấm Lưu');
    } catch (e) { show(e.message || 'Tạo mẫu thất bại', 'error'); }
  };

  const doNhanBan = async (m) => {
    try {
      const ma = `${m.ma_mau}_COPY${Math.floor(Math.random() * 900 + 100)}`;
      const res = await nhanBanMauTem(m.id, { ma_mau: ma, ten_mau: `${m.ten_mau} (bản sao)` });
      await tai(); await moMau(res.data.id);
      show('Đã nhân bản — sửa bản sao này không ảnh hưởng mẫu đang in');
    } catch (e) { show(e.message || 'Nhân bản thất bại', 'error'); }
  };

  const doXoa = async () => {
    try {
      await xoaMauTem(xacNhanXoa.id);
      setXacNhanXoa(null);
      if (mau && mau.id === xacNhanXoa.id) { setMau(null); setBoCuc(null); }
      await tai(); show('Đã xóa mẫu tem');
    } catch (e) { setXacNhanXoa(null); show(e.message || 'Xóa thất bại', 'error'); }
  };

  // Chép TOÀN BỘ khung trái sang khung phải (và ngược lại) — yêu cầu "copy cấu hình từ tem này qua tem kia".
  const chepKhung = (tu) => {
    if (!boCuc) return;
    const nguon = tu === 'trai' ? boCuc.trai : boCuc.phai;
    if (!nguon) return;
    const dich = tu === 'trai' ? 'phai' : 'trai';
    capNhat((b) => ({ ...b, [dich]: JSON.parse(JSON.stringify(nguon)) }));
    show(`Đã chép khung ${tu === 'trai' ? 'TRÁI → PHẢI' : 'PHẢI → TRÁI'}`);
  };

  // Bật/tắt "2 khung khác nhau". Tắt = in 2 nhãn GIỐNG hệt nhau (phai = null).
  const doiCheDoHaiKhung = () => {
    if (!boCuc) return;
    if (hai) { capNhat((b) => ({ ...b, phai: null })); setBen('trai'); }
    else capNhat((b) => ({ ...b, phai: JSON.parse(JSON.stringify(b.trai)) }));
  };

  const viTriList = useMemo(() => (dm?.vi_tri_in || []), [dm]);

  if (dangTai) return <div className="flex justify-center py-16"><Spinner size={28} /></div>;

  if (dm && dm.co_bang === false) {
    return (
      <div className="rounded-card border border-warning/40 bg-warning/5 p-6 text-sm text-ink">
        <div className="mb-1 font-semibold">Chưa chạy migration 073</div>
        Module Thiết kế tem cần bảng <code>mau_tem</code> / <code>gan_mau_tem</code>. Chạy
        {' '}<code>database/migrations/073_mau_tem_thiet_ke.sql</code> bằng user <code>postgres</code> rồi tải lại trang.
        Trong lúc đó các nút in tem vẫn chạy bình thường bằng bố cục mặc định.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── GẮN MẪU VÀO NÚT IN ─────────────────────────────────────────────── */}
      <div className="rounded-card border border-line bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="printer" size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-ink">Nút in tem trong hệ thống</h2>
          <span className="text-xs text-ink-soft">— chọn mẫu cho từng nút; để trống = dùng bố cục mặc định trong code</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2">Nút in</th>
                <th className="px-3 py-2">Màn hình</th>
                <th className="px-3 py-2">Kiểu</th>
                <th className="px-3 py-2 w-72">Mẫu đang dùng</th>
              </tr>
            </thead>
            <tbody>
              {viTriList.map((v) => (
                <tr key={v.ma} className="border-t border-line">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{v.ten}</div>
                    <div className="text-xs text-ink-soft">{v.mo_ta}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-soft">{v.man_hinh}</td>
                  <td className="px-3 py-2">
                    <Badge tone={v.hai_khung_khac_nhau ? 'info' : 'default'}>
                      {v.hai_khung_khac_nhau ? '2 nhãn khác nhau' : '2 nhãn giống nhau'}
                    </Badge>
                    <div className="mt-0.5 text-[11px] text-ink-soft">tiền tố {v.tien_to.trai}{v.tien_to.phai !== v.tien_to.trai ? ` / ${v.tien_to.phai}` : ''}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-64">
                      <Select value={v.mau_tem_id || ''} onChange={(e) => doGan(v.ma, e.target.value)}>
                        <option value="">— Bố cục mặc định (code) —</option>
                        {ds.map((m) => <option key={m.id} value={m.id}>{m.ten_mau}</option>)}
                      </Select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DANH SÁCH MẪU ──────────────────────────────────────────────────── */}
      <div className="rounded-card border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="layout" size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-ink">Mẫu tem ({ds.length})</h2>
          </div>
          <Button icon="plus" onClick={() => setMoTao(true)}>Tạo mẫu mới</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ds.map((m) => (
            <div key={m.id}
              className={`rounded-control border px-3 py-2 ${mau?.id === m.id ? 'border-primary bg-primary/5' : 'border-line'}`}>
              <button type="button" className="text-left" onClick={() => moMau(m.id)}>
                <div className="text-sm font-medium text-ink">{m.ten_mau}</div>
                <div className="text-xs text-ink-soft">{m.ma_mau}</div>
              </button>
              <div className="mt-1.5 flex items-center gap-1.5">
                {m.la_mac_dinh && <Badge tone="default">Mẫu gốc</Badge>}
                {m.vi_tri_list && <Badge tone="success">Đang dùng</Badge>}
                <button type="button" title="Nhân bản" className="text-ink-soft hover:text-primary"
                  onClick={() => doNhanBan(m)}><Icon name="copy" size={14} /></button>
                {!m.la_mac_dinh && (
                  <button type="button" title="Xóa" className="text-ink-soft hover:text-danger"
                    onClick={() => setXacNhanXoa(m)}><Icon name="trash" size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TRÌNH THIẾT KẾ ─────────────────────────────────────────────────── */}
      {mau && boCuc && (
        <div className="rounded-card border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">{mau.ten_mau}</h2>
              <p className="text-xs text-ink-soft">
                Khổ tem cố định {dm.kho_tem.to_rong_mm}×{dm.kho_tem.to_cao_mm}mm · mỗi tem {dm.kho_tem.tem_rong_mm}×{dm.kho_tem.tem_cao_mm}mm
                {' '}· vùng nội dung {dm.kho_tem.noi_dung_rong_mm}×{dm.kho_tem.noi_dung_cao_mm}mm
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" icon="undo" onClick={hoanTac} disabled={!lichSu.length}
                title="Hoàn tác (Ctrl+Z)">Hoàn tác{lichSu.length ? ` (${lichSu.length})` : ''}</Button>
              <Button variant="ghost" icon="redo" onClick={lamLaiFn} disabled={!lamLai.length}
                title="Làm lại (Ctrl+Y)">Làm lại</Button>
              <Button variant="secondary" icon="copy" onClick={() => chepKhung(ben)} disabled={!hai}>
                Chép khung {ben === 'trai' ? 'trái → phải' : 'phải → trái'}
              </Button>
              <Button onClick={luuMau} loading={luu} icon="save">Lưu mẫu</Button>
            </div>
          </div>

          <label className="mb-3 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={hai} onChange={doiCheDoHaiKhung} />
            2 khung KHÁC nhau (bỏ tick = in 2 nhãn giống hệt nhau)
          </label>

          <div className="flex flex-wrap items-start gap-5">
            {/* Lưới 2 khung — luôn hiện CẢ HAI để nhìn đúng tờ in thật */}
            <div className="flex gap-3">
              {/* ⚠⚠ TUYỆT ĐỐI KHÔNG bọc lưới trong <button>: click vào Ô sẽ NỔI BỌT lên nút cha, mà nút
                  cha lại setChon(null) ⇒ chọn xong bị bỏ chọn ngay ⇒ KHÔNG bấm được ô, không gộp được,
                  không mở được panel thuộc tính (lỗi đã gặp thật 08/08/2026). Việc chuyển khung nay do
                  chính `bamO` lo: bấm ô ở khung nào thì tự nhảy sang khung đó. */}
              {['trai', 'phai'].map((b) => {
                const k = b === 'trai' ? boCuc.trai : (boCuc.phai || boCuc.trai);
                const laBanChep = b === 'phai' && !hai;
                const dangSua = ben === b || (laBanChep && ben === 'trai');
                return (
                  <div key={b} className={`rounded-card p-1.5 ${dangSua ? 'ring-2 ring-primary' : 'ring-1 ring-line'}`}>
                    <TemGrid
                      nhan={`${b === 'trai' ? 'Nhãn TRÁI' : 'Nhãn PHẢI'}${laBanChep ? ' (chép theo trái)' : ''}`}
                      khung={k} data={DATA_XEM_TRUOC}
                      chon={dangSua ? chon : null}
                      onChonO={(khoa) => bamO(khoa, b)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Panel thuộc tính ô + thao tác lưới */}
            <div className="min-w-[22rem] flex-1 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  ['Thêm hàng trên', () => datKhung(themHang(khung, chon ? tachKhoa(chon)[0] : 0))],
                  ['Thêm hàng dưới', () => datKhung(themHang(khung, chon ? tachKhoa(chon)[0] + 1 : khung.hang.length))],
                  ['Xóa hàng', () => { if (chon) { datKhung(xoaHang(khung, tachKhoa(chon)[0])); setChon(null); } }],
                  ['Thêm cột trái', () => datKhung(themCot(khung, chon ? tachKhoa(chon)[1] : 0))],
                  ['Thêm cột phải', () => datKhung(themCot(khung, chon ? tachKhoa(chon)[1] + 1 : khung.so_cot))],
                  ['Xóa cột', () => { if (chon) { datKhung(xoaCot(khung, tachKhoa(chon)[1])); setChon(null); } }],
                ].map(([nhan, fn]) => (
                  <Button key={nhan} variant="ghost" onClick={fn} disabled={!khung}>{nhan}</Button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button variant={neo ? 'primary' : 'secondary'} disabled={!chon}
                  onClick={() => setNeo(neo ? null : chon)}>
                  {neo ? 'Đang gộp — bấm ô đích' : 'Gộp ô…'}
                </Button>
                <Button variant="secondary" disabled={!chon}
                  onClick={() => { datKhung(tachO(khung, chon)); }}>Tách ô</Button>
                {neo && <Button variant="ghost" onClick={() => setNeo(null)}>Hủy gộp</Button>}
              </div>

              {chon && khung ? (
                <OPanel
                  khoa={chon} o={oDangChon} dm={dm}
                  hang={khung.hang[tachKhoa(chon)[0]]}
                  cot={(khung.cot || [])[tachKhoa(chon)[1]]}
                  onDoiO={doiO}
                  onDoiHang={(v) => {
                    const k = JSON.parse(JSON.stringify(khung));
                    k.hang[tachKhoa(chon)[0]] = { ...k.hang[tachKhoa(chon)[0]], ...v };
                    datKhung(k);
                  }}
                  onDoiCot={(v) => {
                    const k = JSON.parse(JSON.stringify(khung));
                    k.cot = Array.isArray(k.cot) ? k.cot : [];
                    const c = tachKhoa(chon)[1];
                    k.cot[c] = { ...(k.cot[c] || {}), ...v };
                    datKhung(k);
                  }}
                />
              ) : (
                <div className="rounded-control border border-dashed border-line p-4 text-center text-sm text-ink-soft">
                  Bấm vào một ô trên lưới để sửa nội dung và định dạng.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tạo mẫu mới */}
      <Modal open={moTao} onClose={() => setMoTao(false)} title="Tạo mẫu tem mới"
        footer={<><Button variant="ghost" onClick={() => setMoTao(false)}>Hủy</Button>
          <Button onClick={doTao} disabled={!form.ma_mau.trim() || !form.ten_mau.trim()}>Tạo</Button></>}>
        <Field label="Mã mẫu" required hint="Chữ HOA, số và gạch dưới — vd TEM_SX_MOI">
          <Input value={form.ma_mau} onChange={(e) => setForm({ ...form, ma_mau: e.target.value })} />
        </Field>
        <Field label="Tên mẫu" required>
          <Input value={form.ten_mau} onChange={(e) => setForm({ ...form, ten_mau: e.target.value })} />
        </Field>
        <Field label="Mô tả">
          <Textarea rows={2} value={form.mo_ta} onChange={(e) => setForm({ ...form, mo_ta: e.target.value })} />
        </Field>
        <p className="text-xs text-ink-soft">Mẫu mới tạo ra là lưới trống 12 hàng × 20 cột — thiết kế xong nhớ gắn vào nút in.</p>
      </Modal>

      <Toast toast={toast} />

      <ConfirmDialog
        open={!!xacNhanXoa} onClose={() => setXacNhanXoa(null)} onConfirm={doXoa}
        title="Xóa mẫu tem?" variant="danger" confirmText="Xóa"
        message={xacNhanXoa ? `Xóa mẫu "${xacNhanXoa.ten_mau}"? Nút in nào đang dùng mẫu này sẽ quay về bố cục mặc định trong code.` : ''}
      />
    </div>
  );
}
