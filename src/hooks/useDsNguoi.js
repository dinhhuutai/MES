import { useEffect, useMemo, useState } from 'react';
import { listUserOptions } from '../services/userService';

// DANH SÁCH NGƯỜI CHO Ô CHỌN LƯU TÊN (người kiểm KCS, người sửa — 09/11/2026). Tách từ modal In tem KCS (03/11/2026):
//   · `dsTen` = mỗi HỌ TÊN 1 dòng (prod có tài khoản trùng họ tên — hiện 2 lần là React báo trùng khóa);
//   · `idTheoTen` = Map(tên → id tài khoản | null khi trùng họ tên — KHÔNG đoán tài khoản).
// `bat` = false thì chưa tải (modal chưa mở). Lỗi tải ⇒ danh sách rỗng, ô vẫn gõ tên tay được (`chapNhanTuDo`).
export const tenNguoi = (u) => u.ho_ten || u.ten_dang_nhap || '';
export const timNguoi = (u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`;

export default function useDsNguoi(bat = true) {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (!bat || users.length) return;
    listUserOptions({ limit: 500 }).then((r) => setUsers(r.data || [])).catch(() => { /* vẫn gõ tên tay được */ });
  }, [bat, users.length]);
  return useMemo(() => {
    const dem = new Map();
    users.forEach((u) => {
      const ten = tenNguoi(u);
      if (ten) dem.set(ten, dem.has(ten) ? null : u.id);
    });
    const daCo = new Set();
    const dsTen = users.filter((u) => {
      const ten = tenNguoi(u);
      if (!ten || daCo.has(ten)) return false;
      daCo.add(ten);
      return true;
    });
    return { dsTen, idTheoTen: dem };
  }, [users]);
}

// NHỚ TÊN VỪA NHẬP trên máy này (localStorage) — điền sẵn cho lượt xác nhận sau (quét liên tục không phải gõ lại).
//   Riêng từng chỗ (`khoa`), lỗi storage (chế độ riêng tư…) ⇒ bỏ qua.
export const nhoTen = {
  lay: (khoa) => { try { return localStorage.getItem(khoa) || ''; } catch { return ''; } },
  dat: (khoa, ten) => { try { if (String(ten || '').trim()) localStorage.setItem(khoa, String(ten).trim()); } catch { /* bỏ qua */ } },
};
export const KHOA_NGUOI_KIEM = 'kcs.nguoiKiem';
export const KHOA_NGUOI_SUA = 'sua.nguoiSua';
