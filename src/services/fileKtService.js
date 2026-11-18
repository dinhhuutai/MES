import client from './axiosClient';

// Ghi nhận file phần in xuống Phòng KT (17/11/2026, mig 136) — BE `modules/filekt`.
export const listQuetFileKt = (params) => client.get('/file-kt/quet', { params });
export const listPhanInFileKt = (params) => client.get('/file-kt/phan-in', { params });
export const quetFileKt = (ma, ghiChu) => client.post('/file-kt/quet', { ma, ghiChu });
export const huyQuetFileKt = (id, lyDo) => client.post(`/file-kt/quet/${id}/huy`, { lyDo });
export const ghepLaiFileKt = () => client.post('/file-kt/ghep-lai');
