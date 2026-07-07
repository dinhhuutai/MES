// Danh mục các FORM (mẫu tem/phiếu) để lưu lại + xuất Excel cho người dùng chỉnh sửa.
// Mỗi tem mô tả dạng lưới ô (rows × cells) — dùng để dựng file Excel có ô gộp/viền.
// Cell: { t: nội dung, cs: colspan (mặc định 1), k: kiểu 'lbl'|'val'|'hd'|'th'|'blank' }.

const L = (t, cs) => ({ t, k: 'lbl', ...(cs ? { cs } : {}) });   // nhãn (nền xám, đậm)
const V = (t, cs) => ({ t, k: 'val', ...(cs ? { cs } : {}) });   // giá trị / placeholder
const H = (t, cs) => ({ t, k: 'hd', ...(cs ? { cs } : {}) });    // tiêu đề tem
const TH = (t) => ({ t, k: 'th' });                              // ô header lưới
const B = (cs) => ({ t: '', k: 'blank', ...(cs ? { cs } : {}) }); // ô trống (ghi tay)

// ---- Tem trái: PHIẾU GIAO HÀNG (4 cột) ----
const temTrai = {
  ten: 'Tem trái - PHIẾU GIAO HÀNG (B3)',
  cols: 4,
  rows: [
    [L('THLA'), H('PHIẾU GIAO HÀNG', 2), V('<Ngày giờ in>')],
    [V('<QR>'), B(3)],
    [V('<Khách hàng>', 3), V('<Chuyền in>')],
    [L('PO'), V('<PO>', 3)],
    [L('MH'), V('<Mã hàng>', 3)],
    [L('MV'), V('<Màu vải>', 3)],
    [L('KV'), V('<Kích vải>', 3)],
    [L('KP'), V('<Kích phim>', 3)],
    [V('<Số lượng pcs tổng của phần in>', 2), V('<Thời gian bắt đầu phơi>'), V('<Thời gian phơi xong>')],
    [L('IN'), V('<Số lượng pcs in xong>', 3)],
    [L('Lo'), B(), B(), B()],
    [L('SL Giao'), B(), B(), B()],
    [L('KCS'), B(), B(), B()],
    [L('N Kiểm'), B(), B(), B()],
    [B(3), L('104-THLA-CM I-011 B3')],
  ],
};

// ---- Tem phải: IN-K (5 cột) ----
const temPhai = {
  ten: 'Tem phải - IN-K (B2)',
  cols: 5,
  rows: [
    [L('THLA'), H('IN-K', 3), V('<Ngày giờ in>')],
    [V('<QR>', 2), B(3)],
    [V('<Khách hàng>', 2), V('<PO>', 3)],
    [V('<Mã hàng>', 5)],
    [V('<Màu vải>', 5)],
    [V('<Kích vải>', 2), V('<Kích phim>', 3)],
    [V('<Số lượng pcs tổng của phần in>', 2), V('<Chuyền in>', 3)],
    [TH('IN'), TH('KIỂM'), TH('ĐẠT'), TH('SỬA'), TH('HỦY')],
    [V('<Số lượng pcs in xong>'), B(), B(), B(), B()],
    [L('LOẠI LỖI', 2), L('SL'), L('S.ĐẠT'), L('S.HỦY')],
    [B(2), B(), B(), B()],
    [B(2), B(), B(), B()],
    [B(4), L('104-THLA-CM I-011 B2')],
  ],
};

export const FORM_TEMPLATES = [
  {
    id: 'tem-san-xuat',
    ten: 'Tem sản xuất (Phiếu giao hàng + IN-K)',
    moTa: 'In cùng lúc 2 nhãn khi in tem ở màn Sản xuất: Phiếu giao hàng (B3) và IN-K (B2).',
    kichThuoc: [
      'Cả tờ (2 tem): 110 × 80 mm',
      'Mỗi tem (khung): 55 × 80 mm',
      'Vùng nội dung mỗi tem: 51 × 76 mm (căn lề 2 mm mỗi cạnh)',
      '2 tem cách nhau 4 mm (2 mm mỗi bên) — QR mã hóa MÃ TEM',
    ],
    huongDan: [
      'File này là MẪU để chỉnh sửa bố cục tem. Sửa trực tiếp ở sheet "Tem trái"/"Tem phải" rồi gửi lại — không cần vẽ lại.',
      'Ô dạng <...> là chỗ hệ thống tự đổ dữ liệu (placeholder) — giữ nguyên tên trong ngoặc nếu muốn tự điền.',
      'Ô trống (Lo, SL Giao, KCS, N Kiểm, các ô trong lưới KIỂM...) là chỗ để trống ghi tay khi vận hành.',
      'Excel chỉ mô phỏng BỐ CỤC, không đúng tỉ lệ mm tuyệt đối. Kích thước in thật xem ở sheet "Hướng dẫn".',
      'Mã form (B3 / B2) ở góc dưới phải mỗi tem — dùng để tra cứu phiên bản form.',
    ],
    truong: [
      ['<Ngày giờ in>', 'Thời điểm in tem'],
      ['<Khách hàng>', 'Tên khách hàng'],
      ['<Chuyền in>', 'Chuyền in (mã/tên)'],
      ['<PO>', 'Mã đơn hàng (PO)'],
      ['<Mã hàng>', 'Mã hàng'],
      ['<Màu vải> / <Kích vải> / <Kích phim>', 'Thuộc tính phần in'],
      ['<Số lượng pcs tổng của phần in>', 'SL đơn hàng của phần in'],
      ['<Số lượng pcs in xong>', 'SL của tem này (đã in)'],
      ['<Thời gian bắt đầu phơi> / <Thời gian phơi xong>', 'Mốc phơi của tem'],
    ],
    tems: [temTrai, temPhai],
  },
];
