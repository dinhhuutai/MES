// TẢI SƠ ĐỒ PHẦN IN RA PDF (05/11/2026, người dùng yêu cầu "tải sơ đồ về đầy đủ thông tin").
// Chụp ĐÚNG khối đang hiện thành ảnh rồi đặt lên 1 TRANG PDF vừa khít (sơ đồ cây rộng hơn khổ giấy, chia trang là cắt ngang ô)
// ⇒ phóng to xem được, in thì chọn "vừa trang". Thư viện nạp lười, chỉ tốn khi bấm nút.
//
// "Đầy đủ thông tin": lúc chụp mở hết các khối gập `<details>` (lần xác nhận / trả về · lượt KCS–Sửa–OQC) + bỏ cắt chữ `…`
// NGAY TRÊN TRANG (chữa ở bản sao là mũi tên trả về lệch: mũi tên SVG tính theo vị trí DOM thật), xong trả về như cũ.
const PX_RA_MM = 25.4 / 96;
const TRANG_TOI_DA_MM = 5000; // PDF giới hạn 14.400 pt ≈ 5.080 mm mỗi chiều
const CANH_TOI_DA = 16000; // cạnh canvas an toàn của trình duyệt

const doi = (ms) => new Promise((r) => { setTimeout(r, ms); });
// Tab nền / trình duyệt chạy ngầm không gọi requestAnimationFrame ⇒ có hẹn giờ dự phòng, không treo nút.
const haiKhung = () => new Promise((r) => {
  const t = setTimeout(r, 150);
  requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); r(); }));
});

const tenFileAnToan = (s) => String(s || 'so-do').replace(/[\\/:*?"<>|\s]+/g, '-');
const luc = () => new Date().toLocaleString('vi-VN', { hour12: false });

export default async function taiSoDoPdf({ khoi, maPhan, veLaiMuiTen }) {
  if (!khoi) throw new Error('Chưa có sơ đồ để tải');
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const details = [...khoi.querySelectorAll('details')];
  const dangMo = details.map((d) => d.open);
  khoi.classList.add('so-do-xuat-pdf');
  details.forEach((d) => { d.open = true; });
  try {
    // Đợi bố cục mới rồi mới đo lại mũi tên trả về (`recomputeArrows` setState ⇒ cần thêm 1 nhịp để React vẽ).
    await haiKhung();
    if (veLaiMuiTen) veLaiMuiTen();
    await haiKhung();
    await doi(60);

    const cuon = khoi.querySelector('[data-so-do-cuon]');
    const rong = Math.ceil(Math.max(khoi.scrollWidth, cuon ? cuon.scrollWidth + 48 : 0));
    const cao0 = Math.ceil(khoi.scrollHeight);
    // Chia nhỏ tỷ lệ khi sơ đồ quá lớn. iOS giới hạn canvas ~16,7 triệu px, máy khác nâng tới 120 triệu px.
    const dienTichMax = /iP(hone|ad|od)/.test(navigator.userAgent || '') ? 16e6 : 120e6;
    const CAO_DONG_DAU = 30; // dòng "Sơ đồ phần in · xuất lúc …" thêm vào bản sao
    const cao = cao0 + CAO_DONG_DAU;
    const tiLe = Math.min(2, CANH_TOI_DA / rong, CANH_TOI_DA / cao, Math.sqrt(dienTichMax / (rong * cao)));

    const chup = (foreignObjectRendering) => html2canvas(khoi, {
      foreignObjectRendering,
      scale: tiLe, backgroundColor: '#ffffff', logging: false, useCORS: true,
      // Khối sơ đồ được đưa ra góc trên-trái của bản sao (bỏ menu / đầu trang) ⇒ cắt từ (0, 0), 2 cách vẽ cùng toạ độ.
      x: 0, y: 0, width: rong, height: cao,
      windowWidth: Math.max(rong, window.innerWidth), windowHeight: Math.max(cao, window.innerHeight),
      scrollX: 0, scrollY: 0,
      onclone: (doc, el) => {
        // In màu sáng dù người dùng đang để giao diện tối.
        doc.documentElement.classList.remove('dark');
        doc.body.style.margin = '0';
        doc.body.style.background = '#ffffff';
        doc.body.replaceChildren(el);
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = '0';
        el.style.margin = '0';
        el.style.width = `${rong}px`;
        el.style.maxWidth = 'none';
        el.style.boxShadow = 'none';
        const c = el.querySelector('[data-so-do-cuon]');
        if (c) c.style.overflow = 'visible';
        const dau = doc.createElement('div');
        dau.style.cssText = `height:${CAO_DONG_DAU}px;font:600 13px Inter,Arial,sans-serif;color:#374151;display:flex;align-items:center;`;
        dau.textContent = `Sơ đồ phần in ${maPhan || ''} · THLA MES · xuất lúc ${luc()}`;
        el.insertBefore(dau, el.firstChild);
      },
    });
    // Vẽ chữ bằng chính trình duyệt (SVG foreignObject) ⇒ chữ y như trên màn hình; cách vẽ thường của html2canvas chèn khoảng
    //   trắng thừa trước ":" "/" và sau "-" ("19 :10 15 /07"). Safari từ chối xuất ảnh kiểu này ⇒ lùi về cách thường.
    let canvas;
    try {
      canvas = await chup(true);
      canvas.toDataURL('image/jpeg', 0.1);
    } catch {
      canvas = await chup(false);
    }

    let wMm = rong * PX_RA_MM;
    let hMm = cao * PX_RA_MM;
    const thuNho = Math.min(1, TRANG_TOI_DA_MM / wMm, TRANG_TOI_DA_MM / hMm);
    wMm *= thuNho; hMm *= thuNho;
    const pdf = new jsPDF({ orientation: wMm >= hMm ? 'landscape' : 'portrait', unit: 'mm', format: [wMm, hMm], compress: true });
    pdf.setProperties({ title: `Sơ đồ phần in ${maPhan || ''}`, creator: 'THLA MES' });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, wMm, hMm, undefined, 'FAST');
    pdf.save(`so-do-phan-in-${tenFileAnToan(maPhan)}.pdf`);
  } finally {
    details.forEach((d, i) => { d.open = dangMo[i]; });
    khoi.classList.remove('so-do-xuat-pdf');
    if (veLaiMuiTen) setTimeout(veLaiMuiTen, 0);
  }
}
