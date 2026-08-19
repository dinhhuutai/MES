import client from './axiosClient';

// Hệ thống > Cài đặt tính năng (mig 087): bật/tắt LUẬT NGHIỆP VỤ ngay trên giao diện.
// (Khác `caiDatApiService` — trang đó bật/tắt API gọi sang ERP, chuyện kỹ thuật.)
//
// `list` trả `{ items: [{ ma, ten, mo_ta, khi_tat, canh_bao, bat, theo_mac_dinh, mac_dinh,
//                          ghi_chu, nguoi_sua, tg_sua }] }`.
//   · `theo_mac_dinh = true` ⇒ chưa ai đụng tới, đang chạy theo mặc định khai trong code.
export const listCaiDatTinhNang = () => client.get('/cai-dat-tinh-nang');

// `save` trả `{ items, hau_qua: [{ ma, loai, tong, da_duyet, loi[] }] }`.
//   · `hau_qua` chỉ có khi vừa TẮT công tắc duyệt ⇒ hàng đợi được duyệt sạch.
export const saveCaiDatTinhNang = (items) => client.put('/cai-dat-tinh-nang', { items });

// ─── Trạng thái rút gọn `{ma: bool}` cho các màn thao tác ────────────────────────────────────────
// ⚠ ĐÂY CHỈ LÀ CỜ HIỂN THỊ (hiện đúng chữ, có bắt nhập lý do hay không). Chốt chặn thật nằm ở
//   backend — FE cầm cờ cũ cũng không lách được luật, cùng lắm là hiện nhầm chữ trong ≤ TTL.
//
// ⚠ CACHE Ở MỨC MODULE + TTL: `PhuongAnInCell` render **mỗi dòng một ô** (bảng READY 20–30 dòng),
//   không cache thì mở trang là bắn ngần ấy request giống hệt nhau.
const TTL_MS = 60000;
let _cache = null;
let _han = 0;
let _dangGoi = null;   // gộp các lời gọi song song thành 1 request

export function xoaCacheTinhNang() { _cache = null; _han = 0; }

export function layTrangThaiTinhNang() {
  const now = Date.now();
  if (_cache && now < _han) return Promise.resolve(_cache);
  if (!_dangGoi) {
    _dangGoi = client.get('/cai-dat-tinh-nang/trang-thai')
      .then((res) => { _cache = res.data || {}; _han = Date.now() + TTL_MS; return _cache; })
      // ⚠ FAIL-OPEN THEO MẶC ĐỊNH: lỗi mạng ⇒ trả `{}` ⇒ nơi gọi dùng `?? true` = coi như BẬT
      //   (giữ nguyên luật, hiện đúng chữ "chờ duyệt"). Cache rỗng trong TTL để khỏi spam request.
      .catch(() => { _cache = {}; _han = Date.now() + TTL_MS; return _cache; })
      .finally(() => { _dangGoi = null; });
  }
  return _dangGoi;
}
