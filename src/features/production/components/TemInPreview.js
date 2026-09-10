import { useEffect, useRef, useState } from 'react';
import Spinner from '../../../components/common/Spinner';
import { KHO } from '../utils/renderMauTem';
import { htmlToTem } from '../utils/printTemLabel';

// ─────────────────────────────────────────────────────────────────────────────
// XEM TRƯỚC TỜ TEM ĐÚNG NHƯ LÚC IN — dùng ở SidePanel *Danh sách tem in* (Sản xuất) và
// *Danh sách tem gia công* (Kế hoạch).
//
// ⚠⚠ DỰNG BẰNG CHÍNH ĐƯỜNG IN (`toTemSanXuat` / `toTemGiaCongVe` → `htmlToTem`): mẫu đã gắn thì ra
//   mẫu, chưa gắn thì ra bố cục CỨNG — y hệt lúc bấm nút In. Viết một bộ dựng riêng cho màn xem là
//   sớm muộn "xem một kiểu, in một kiểu" (bài học đã ghi ở `TemXemTruoc` của trình thiết kế).
//
// ⚠⚠ PHẢI dùng <iframe srcDoc>, KHÔNG nhúng thẳng HTML vào trang:
//   1. Tailwind preflight của app sẽ đè lên bố cục tem (reset bảng, cỡ chữ, box-sizing) ⇒ hỏng đúng
//      thứ màn này sinh ra để tránh.
//   2. Vòng thu chữ `JS_TU_CO` chỉ đo được kích thước THẬT khi chạy trong tài liệu riêng.
//   3. `@page` + đơn vị mm được tính y như lúc in.
//
// ⚠ `htmlToTem(to, title, false)` → KHÔNG tự gọi `print()`, chỉ chạy vòng thu chữ. Đừng truyền `true`
//   ở đây, người dùng chỉ đang XEM.
//
// PHÓNG TO: nội dung dựng ở kích thước THẬT (110×80mm) rồi `transform: scale` ở ngoài ⇒ vòng thu chữ
// vẫn đo trên kích thước thật, phóng bao nhiêu cũng không đổi kết quả.
// ─────────────────────────────────────────────────────────────────────────────

const PX_MM = 96 / 25.4;   // 1mm = bao nhiêu px CSS ở tỉ lệ 100%

export default function TemInPreview({ dungTo, tieuDe = 'Tem', tiLe = 4.6 }) {
  const [html, setHtml] = useState('');
  const [loi, setLoi] = useState(null);
  const [dangDung, setDangDung] = useState(true);
  const [theoMau, setTheoMau] = useState(null);
  const lan = useRef(0);

  useEffect(() => {
    const t = lan.current + 1;
    lan.current = t;
    let huy = false;
    setDangDung(true);
    setLoi(null);
    (async () => {
      try {
        const to = await dungTo();
        if (huy || lan.current !== t) return;
        if (!to) { setLoi('Không dựng được bản xem trước'); return; }
        setTheoMau(!!to.theoMau);
        setHtml(htmlToTem(to, tieuDe, false));
      } catch (e) {
        if (!huy) setLoi(e.message || 'Không dựng được bản xem trước');
      } finally {
        if (!huy) setDangDung(false);
      }
    })();
    return () => { huy = true; };
  }, [dungTo, tieuDe]);

  if (loi) {
    return <div className="rounded-card border border-danger/40 bg-danger/5 p-3 text-sm text-danger">{loi}</div>;
  }

  const rongPx = KHO.toRong * tiLe;
  const caoPx = KHO.toCao * tiLe;

  return (
    <div>
      <div className="relative bg-white shadow-sm ring-1 ring-line" style={{ width: rongPx, height: caoPx }}>
        {dangDung && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <Spinner size={22} />
          </div>
        )}
        <iframe
          title={`Xem trước bản in — ${tieuDe}`}
          srcDoc={html}
          scrolling="no"
          style={{
            width: `${KHO.toRong}mm`, height: `${KHO.toCao}mm`, border: 0,
            transform: `scale(${tiLe / PX_MM})`, transformOrigin: 'top left',
          }}
        />
        {/* Mép cắt giữa 2 nhãn — trên giấy là chỗ dao cắt, trong iframe không có gì đánh dấu. */}
        <div className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-primary/50"
          style={{ left: KHO.temRong * tiLe }} />
      </div>
      {!dangDung && (
        <div className="mt-1 text-xs text-ink-soft">
          Tờ decal {KHO.toRong}×{KHO.toCao}mm · 2 nhãn ·{' '}
          {theoMau ? 'dựng theo MẪU đã gắn ở Hệ thống → Thiết kế tem' : 'bố cục mặc định (chưa gắn mẫu)'}
        </div>
      )}
    </div>
  );
}
