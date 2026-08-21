import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Popover } from '@headlessui/react';
import Icon from '../common/Icon';
import Badge from '../common/Badge';
import Spinner from '../common/Spinner';
import useSocketReload from '../../hooks/useSocketReload';
import { getSocket } from '../../services/socket';
import { laySoChuaDoc, layThongBao, danhDauDoc } from '../../services/thongBaoService';
import { hienPopup, quyenHienTai, xinQuyen } from '../../utils/thongBaoThietBi';
import {
  duongDanThongBao, moTaThongBao, nhanThoiGian, luongThongBao, laThongBaoDuyet, doiPhuongAnIn, tieuDeThongBao,
} from '../../utils/thongBaoHienThi';

// ─────────────────────────────────────────────────────────────────────────────
// CHUÔNG THÔNG BÁO — cạnh avatar trên Topbar (mig 085).
//
// Giai đoạn 1: PHẦN IN BỊ TRẢ VỀ cho Kỹ thuật (QC · Release 1 · Test Run).
//
// ⚠⚠ TỰ ẨN nếu người dùng không thuộc diện nhận: backend trả `co_quyen=false` (không phải 403) ⇒
//   chuông biến mất hẳn thay vì hiện số 0 vô nghĩa cho cả nhà máy.
// ⚠ Số chưa đọc lấy bằng endpoint RIÊNG rất nhẹ; danh sách chỉ tải khi MỞ chuông.
// ⚠ Popup hệ điều hành chỉ bắn cho sự kiện ĐẾN TRONG LÚC ĐANG MỞ app (`thong-bao:moi`), KHÔNG bắn
//   lúc tải lại danh sách — nếu không thì mỗi lần F5 lại nổ một loạt popup của thông báo cũ.
// ─────────────────────────────────────────────────────────────────────────────

const SO_HIEN = 6; // hiện tối đa 6 cái trong panel, dư thì "Xem thêm" sang trang thông báo

export default function NotificationBell() {
  const navigate = useNavigate();
  // ⚠ Token nằm trong REDUX (`state.auth`), KHÔNG phải localStorage — xem `services/axiosClient.js`.
  //   Lấy thẳng `user.id` cho gọn thay vì giải mã JWT.
  const myId = useSelector((s) => s.auth?.user?.id);
  const [soChuaDoc, setSoChuaDoc] = useState(0);
  const [coQuyen, setCoQuyen] = useState(false);
  const [rows, setRows] = useState([]);
  const [tong, setTong] = useState(0);
  const [dangTai, setDangTai] = useState(false);
  const [quyen, setQuyen] = useState(quyenHienTai());
  const daTai = useRef(false);
  // ⚠ SỐ CHƯA ĐỌC VỪA TĂNG → nháy MẠNH hơn trong ít giây rồi tự về nhịp nhẹ. Chuông vốn đã nháy nhẹ
  //   suốt thời gian còn tin chưa đọc, nên "có tin MỚI đến" cần một nhịp khác mới phân biệt được.
  const soTruoc = useRef(null);
  const [nhanManh, setNhanManh] = useState(false);

  const taiSo = useCallback(async () => {
    try {
      const r = await laySoChuaDoc();
      setSoChuaDoc(r.data.so_chua_doc || 0);
      setCoQuyen(!!r.data.co_quyen);
    } catch (e) { /* thông báo là phụ — không chặn, không toast */ }
  }, []);

  // ⚠ BỎ QUA LẦN TẢI ĐẦU (`soTruoc.current === null`): mở app mà số nhảy 0 → N là chuyện đương nhiên,
  //   nháy mạnh mỗi lần F5 thì thành nhiễu. Nhịp nhẹ vẫn chạy nên không mất thông tin nào.
  // ⚠ Số GIẢM (vừa đọc bớt) thì KHÔNG nhấn mạnh — đó là việc người dùng vừa tự làm.
  useEffect(() => {
    const truoc = soTruoc.current;
    soTruoc.current = soChuaDoc;
    if (truoc === null || soChuaDoc <= truoc) return undefined;
    setNhanManh(true);
    const t = setTimeout(() => setNhanManh(false), 6000);
    return () => clearTimeout(t);
  }, [soChuaDoc]);

  const taiDanhSach = useCallback(async () => {
    setDangTai(true);
    try {
      const r = await layThongBao({ page: 1, limit: SO_HIEN });
      setRows(r.data.items || []);
      setTong(r.data.meta?.total || 0);
      setSoChuaDoc(r.data.so_chua_doc || 0);
      daTai.current = true;
    } catch (e) { /* im lặng */ } finally { setDangTai(false); }
  }, []);

  useEffect(() => { taiSo(); }, [taiSo]);

  // Đổi cấu hình bật/tắt (của mình hoặc của hệ thống) → số phải tính lại ngay.
  useSocketReload(['thong-bao:cai-dat'], taiSo, 600);

  // ⚠ Sự kiện MỚI: cập nhật số + bắn popup hệ điều hành. Nghe TRỰC TIẾP (không qua useSocketReload)
  //   vì cần đọc payload để biết event có dành cho mình không.
  useEffect(() => {
    const s = getSocket();
    if (!s) return undefined;
    const onMoi = async (data) => {
      // Backend broadcast kèm `user_ids` (sockets/index.js không có room theo user) — client tự lọc.
      // ⚠ Không biết mình là ai (chưa nạp xong `/auth/me`) thì CỨ TẢI LẠI: thà tốn 1 request còn hơn
      //   bỏ sót thông báo. Số liệu backend trả về vẫn đúng theo quyền của chính người này.
      if (myId && Array.isArray(data?.user_ids) && !data.user_ids.includes(myId)) return;
      await taiSo();
      if (daTai.current) taiDanhSach();
      // Popup OS — chỉ khi người dùng đã cho phép. Nội dung lấy từ chính bản ghi vừa về.
      if (quyenHienTai() === 'granted') {
        try {
          const r = await layThongBao({ page: 1, limit: 1 });
          const t = (r.data.items || [])[0];
          if (t) {
            hienPopup({
              tieuDe: tieuDeThongBao(t),
              than: moTaThongBao(t),
              duongDan: duongDanThongBao(t),
              tag: `tb-${t.id}`,
            });
          }
        } catch (e) { /* im lặng */ }
      }
    };
    s.on('thong-bao:moi', onMoi);
    return () => s.off('thong-bao:moi', onMoi);
  }, [taiSo, taiDanhSach, myId]);

  const moChiTiet = async (t, dong) => {
    if (!t.da_doc) {
      try { const r = await danhDauDoc([t.id]); setSoChuaDoc(r.data.so_chua_doc || 0); } catch (e) { /* noop */ }
      setRows((ds) => ds.map((x) => (x.id === t.id ? { ...x, da_doc: true } : x)));
    }
    if (dong) dong();
    navigate(duongDanThongBao(t));
  };

  const docHet = async () => {
    try {
      const r = await danhDauDoc([]);
      setSoChuaDoc(r.data.so_chua_doc || 0);
      setRows((ds) => ds.map((x) => ({ ...x, da_doc: true })));
    } catch (e) { /* noop */ }
  };

  if (!coQuyen) return null;

  return (
    <Popover className="relative">
      {({ close }) => (
        <>
          {/* ⚠⚠ CHUÔNG ĐỨNG YÊN VÀ GIỮ MÀU BÌNH THƯỜNG (chốt 21/08/2026 — người dùng chốt lại):
              CHỈ **con số** nháy. Bản trước cho cả icon phình to–nhỏ + đổi sang màu đỏ, nhìn rối và
              đập vào mắt quá mức cho một thứ chạy suốt thời gian còn tin chưa đọc.
              ⚠ Vẫn KHÔNG dùng `motion-safe:` — tiền tố đó gói animation vào
              `@media (prefers-reduced-motion: no-preference)`, máy nào tắt hiệu ứng động của Windows
              (Cài đặt › Trợ năng › Hiệu ứng hình ảnh) sẽ **không thấy gì mà cũng không có lỗi**.
              ⚠ `focus:outline-none` — Headless UI `Popover.Button` là `<button>` thật, bấm vào là
              trình duyệt vẽ viền focus mặc định (người dùng: "hiện border xấu quá").
              ⚠ `ml-1` — chừa khoảng cách với avatar bên cạnh, trước đó bị dính sát. */}
          <Popover.Button
            onClick={() => { if (!daTai.current) taiDanhSach(); }}
            className="relative ml-1 mr-1 flex h-9 w-9 items-center justify-center rounded-control text-ink-soft outline-none transition hover:bg-surface-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title={soChuaDoc ? `${soChuaDoc} thông báo chưa đọc` : 'Thông báo'}
            aria-label={soChuaDoc ? `Thông báo — ${soChuaDoc} chưa đọc` : 'Thông báo'}
          >
            <Icon name="bell" size={20} />
            {soChuaDoc > 0 && (
              <>
                {/* Quầng lan ra rồi tắt — nằm DƯỚI badge nên không che con số; `pointer-events-none`
                    để không nuốt cú bấm vào chuông. */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute -right-0.5 -top-0.5 h-[18px] w-[18px] rounded-full bg-danger ${
                    nhanManh ? 'animate-chuong-quang-manh' : 'animate-chuong-quang'}`}
                />
                {/* ⚠⚠ CON SỐ PHẢI NẰM GIỮA VÒNG ĐỎ TRÊN MỌI MÀN HÌNH (fix 21/08/2026 — người dùng
                    báo "màn này ở giữa, màn kia lệch lên trên"). HAI nguyên nhân, sửa cả hai:
                    (1) Animation cũ có `transform: scale()` ngay trên chính badge CHỨA CHỮ ⇒ trình
                        duyệt rasterize lớp bị biến đổi rồi phóng bitmap, ở màn 125%/150% (tỉ lệ
                        Windows hay dùng) con số nhòe + xê dịch nửa pixel, nhìn như lệch. Nay
                        `chuong-nhay`/`chuong-manh` CHỈ đổi độ mờ; phần "phình to" giao hẳn cho quầng
                        phía sau (nó không có chữ nên phóng bao nhiêu cũng không nhòe).
                        ⚠ ĐỪNG nhét `scale` lại vào 2 keyframe đó.
                    (2) Chữ căn theo LINE BOX chứ không theo thân chữ số: độ lệch = (ascent − descent
                        − capHeight)/2 × cỡ chữ, tức PHỤ THUỘC FONT. Inter (nạp từ Google Fonts) ra
                        đúng 0; máy nào chặn mạng/không tải được Inter thì rơi về Segoe UI và lệch
                        ~0,6px. `text-box` cắt line box về đúng cap-height ⇒ căn theo THÂN CHỮ SỐ,
                        font nào cũng giữa. Trình duyệt chưa hỗ trợ thì bỏ qua dòng này, không hỏng.
                    ⚠ `h-[18px] min-w-[18px]` giữ nguyên: 1 chữ số = hình tròn thật, 2–3 chữ số nở
                    ngang thành viên thuốc. `tabular-nums` để mọi chữ số cùng bề rộng, số đổi
                    (8→9→10) không làm badge giật ngang. */}
                <span className={`absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-white ring-2 ring-surface ${
                  nhanManh ? 'animate-chuong-manh' : 'animate-chuong-nhay'}`}>
                  <span className="block text-[10px] font-bold leading-none tabular-nums [text-box:trim-both_cap_alphabetic]">
                    {soChuaDoc > 99 ? '99+' : soChuaDoc}
                  </span>
                </span>
              </>
            )}
          </Popover.Button>

          {/* ⚠ `z-50` chỉ có nghĩa TRONG stacking context của Topbar; thứ quyết định panel có bị trang
              che hay không là `z-[45]` của chính `<header>` Topbar — xem ghi chú ở `Topbar.js`. */}
          <Popover.Panel className="absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-control border border-line bg-surface shadow-card-hover sm:w-[26rem]">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <div className="text-sm font-semibold text-ink">
                Thông báo{soChuaDoc > 0 && <span className="ml-1.5 text-xs font-medium text-danger">{soChuaDoc} mới</span>}
              </div>
              {soChuaDoc > 0 && (
                <button type="button" onClick={docHet}
                  className="text-xs font-medium text-primary hover:underline">Đánh dấu đã đọc hết</button>
              )}
            </div>

            {/* ⚠ Mời bật popup NGAY TẠI ĐÂY: chôn trong trang cá nhân thì gần như không ai tìm ra,
                mà không cho phép thì sẽ không bao giờ thấy "thông báo như Zalo". Trình duyệt CHỈ
                cho xin quyền từ thao tác thật của người dùng nên phải là một NÚT BẤM. */}
            {quyen === 'default' && (
              <button
                type="button"
                onClick={async () => setQuyen(await xinQuyen())}
                className="flex w-full items-center gap-2 border-b border-line bg-primary/[0.06] px-4 py-2.5 text-left text-xs text-ink transition hover:bg-primary/10"
              >
                <Icon name="bell" size={15} className="shrink-0 text-primary" />
                <span>
                  <b>Bật thông báo ngoài màn hình</b> để không bỏ lỡ phần in bị trả về khi đang làm
                  việc khác.
                </span>
              </button>
            )}

            <div className="max-h-[24rem] overflow-y-auto">
              {dangTai && !rows.length && (
                <div className="flex justify-center py-8"><Spinner size={22} /></div>
              )}
              {!dangTai && !rows.length && (
                <div className="px-4 py-8 text-center text-sm text-ink-soft">Chưa có thông báo nào.</div>
              )}
              {rows.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => moChiTiet(t, close)}
                  className={`flex w-full gap-2.5 border-b border-line/60 px-4 py-3 text-left transition hover:bg-surface-muted ${t.da_doc ? '' : 'bg-primary/[0.04]'}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.da_doc ? 'bg-transparent' : 'bg-danger'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{t.ma_phan}</span>
                      <span className="shrink-0 text-[11px] text-ink-soft">{nhanThoiGian(t.tg)}</span>
                    </span>
                    {/* Nói RÕ đi từ đâu về đâu — "Release 1 → trả về READY Kỹ thuật".
                        Họ DUYỆT thì hiện thêm "Bàn → Máy" để biết ngay đổi sang phương án in nào. */}
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge tone={laThongBaoDuyet(t) ? 'info' : 'warning'}>{luongThongBao(t)}</Badge>
                      {doiPhuongAnIn(t) && (
                        <span className="text-[11px] font-medium text-primary">{doiPhuongAnIn(t)}</span>
                      )}
                      {t.checklist_list && <span className="text-[11px] text-ink-soft">{t.checklist_list}</span>}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-xs text-ink-soft">{t.ly_do}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-soft">— {t.nguoi_ho_ten || 'Không rõ'}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* "Xem thêm" khi còn nhiều hơn số hiện trong panel — sang trang thông báo đầy đủ. */}
            <button
              type="button"
              onClick={() => { close(); navigate('/thong-bao'); }}
              className="flex w-full items-center justify-center gap-1.5 border-t border-line px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-surface-muted"
            >
              {tong > rows.length ? `Xem thêm ${tong - rows.length} thông báo` : 'Xem tất cả thông báo'}
              <Icon name="chevron-right" size={15} />
            </button>
          </Popover.Panel>
        </>
      )}
    </Popover>
  );
}
