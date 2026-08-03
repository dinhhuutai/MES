import client from './axiosClient';

// Hồ sơ kỹ thuật (HSKT). Xem [[thla-mes]] — mô hình nhiều–nhiều + phiên bản.
export const listHskt = (params) => client.get('/hskt', { params });
export const getHskt = (id) => client.get(`/hskt/${id}`);
export const getHsktByPhanIn = (phanInId) => client.get(`/hskt/phan-in/${phanInId}`);
// `kieu`: 'qr' = nội dung là CODE PHẦN · 'barcode' = barcode HSKT (server so 11 SỐ ĐẦU) · bỏ trống = tự dò.
export const getHsktByBarcode = (barcode, kieu) =>
  client.get(`/hskt/by-barcode/${encodeURIComponent(barcode)}`, { params: kieu ? { kieu } : undefined });
export const changePhuongAnIn = (id, phuongAnIn) =>
  client.patch(`/hskt/${id}/phuong-an-in`, { phuong_an_in: phuongAnIn });

// Phương án in (Pain): 1 Bàn, 2 Máy, 3 Robot.
export const PHUONG_AN_IN = { 1: 'Bàn', 2: 'Máy', 3: 'Robot' };
