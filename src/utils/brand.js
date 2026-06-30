// Logo & avatar — ảnh đặt trong frontend/public/assets/ (xem README ở đó).
// Dùng đường dẫn public (không import) để thiếu file không làm vỡ build khi đang test.

const base = process.env.PUBLIC_URL || '';

export const LOGO_SRC = `${base}/assets/logo.png`;
export const AVATAR_NAM_SRC = `${base}/assets/avatar-nam.png`;
export const AVATAR_NU_SRC = `${base}/assets/avatar-nu.png`;

// Chọn avatar: ưu tiên avatar_url của user, nếu không có thì theo giới tính.
// Hỗ trợ cả dạng camelCase (từ auth /me) lẫn snake_case (từ list users).
export function avatarFor(user) {
  const url = user?.avatarUrl || user?.avatar_url;
  if (url) return url;
  const gioiTinh = user?.gioiTinh || user?.gioi_tinh;
  return gioiTinh === 'NU' ? AVATAR_NU_SRC : AVATAR_NAM_SRC; // NAM / null → avatar nam
}
