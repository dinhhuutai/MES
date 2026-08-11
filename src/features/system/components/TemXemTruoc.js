import React, { useEffect, useRef, useState } from 'react';
import Spinner from '../../../components/common/Spinner';
import {
  KHO, renderKhung, dungAnhMa, khungPhai, SHEET_CSS_MAU, JS_TU_CO,
} from '../../production/utils/renderMauTem';
import { temCode } from '../../production/utils/printTemLabel';

// ─────────────────────────────────────────────────────────────────────────────
// XEM TRƯỚC BẢN IN — "xem sao in vậy".
//
// ⚠⚠ CỐ Ý DÙNG <iframe srcDoc>, KHÔNG nhúng thẳng HTML vào trang:
//   1. CSS của app (Tailwind preflight: reset bảng, cỡ chữ gốc, box-sizing…) sẽ đè lên bố cục tem nếu
//      nhúng thẳng ⇒ xem một kiểu, in một kiểu — đúng thứ màn này sinh ra để tránh.
//   2. Trong iframe mới chạy được **đúng vòng thu chữ `JS_TU_CO` của cửa sổ in** (đo `scrollWidth`
//      thật sau khi trình duyệt dựng xong bảng) ⇒ thấy đúng cỡ chữ sẽ in ra, không phải đoán.
//   3. `@page` + đơn vị mm trong iframe được tính y như lúc in.
//
// PHÓNG TO: nội dung dựng ở kích thước THẬT (110×80mm) rồi `transform: scale` ra ngoài — thu chữ vẫn
// đo trên kích thước thật nên phóng to bao nhiêu cũng không đổi kết quả.
// ─────────────────────────────────────────────────────────────────────────────

const PX_MM = 96 / 25.4;   // 1mm = bao nhiêu px CSS ở tỉ lệ 100%

export default function TemXemTruoc({ boCuc, data, tiLe, tienTo }) {
  const [html, setHtml] = useState('');
  const [loi, setLoi] = useState(null);
  const [dangDung, setDangDung] = useState(true);
  const lan = useRef(0);

  useEffect(() => {
    const t = lan.current + 1;
    lan.current = t;
    let huy = false;
    setDangDung(true);
    (async () => {
      try {
        const kTrai = boCuc && boCuc.trai;
        if (!kTrai) { setLoi('Bố cục trống'); setDangDung(false); return; }
        const kPhai = khungPhai(boCuc);
        // Mã tem của TỪNG khung khác nhau (vd tem sản xuất: trái 15 · phải 16) — giống hệt lúc in thật.
        const dTrai = { ...data, ma_tem: temCode(data.ma_tem, tienTo && tienTo.trai) };
        const dPhai = { ...data, ma_tem: temCode(data.ma_tem, tienTo && tienTo.phai) };
        const [aTrai, aPhai] = await Promise.all([dungAnhMa(kTrai, dTrai), dungAnhMa(kPhai, dPhai)]);
        if (huy || lan.current !== t) return;
        const trai = renderKhung(kTrai, dTrai, aTrai);
        const phai = renderKhung(kPhai, dPhai, aPhai);
        setHtml(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
<style>${SHEET_CSS_MAU}</style></head>
<body><div class="sheet"><div class="label">${trai}</div><div class="label">${phai}</div></div>
<script>
  ${JS_TU_CO}
  function go(){ try { thuChu(); } catch(e){} }
  var imgs = Array.prototype.slice.call(document.images);
  var chua = imgs.filter(function(i){ return !i.complete; });
  if (chua.length) { var con = chua.length;
    chua.forEach(function(i){ i.onload = i.onerror = function(){ if (--con === 0) setTimeout(go, 10); }; });
  } else { setTimeout(go, 30); }
</script></body></html>`);
        setLoi(null);
      } catch (e) {
        if (!huy) setLoi(e.message || 'Không dựng được bản xem trước');
      } finally {
        if (!huy) setDangDung(false);
      }
    })();
    return () => { huy = true; };
  }, [boCuc, data, tienTo]);

  const rongPx = KHO.toRong * tiLe;
  const caoPx = KHO.toCao * tiLe;

  if (loi) {
    return <div className="rounded-card border border-danger/40 bg-danger/5 p-4 text-sm text-danger">{loi}</div>;
  }

  return (
    <div className="inline-block">
      <div className="relative bg-white shadow-sm ring-1 ring-line" style={{ width: rongPx, height: caoPx }}>
        {dangDung && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <Spinner size={24} />
          </div>
        )}
        <iframe
          title="Xem trước bản in tem"
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
    </div>
  );
}
