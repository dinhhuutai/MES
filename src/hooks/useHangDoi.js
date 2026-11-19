import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectAuth } from '../store/authSlice';
import { getSocket } from '../services/socket';
import useSocketReload from './useSocketReload';
import { dsHangDoi, xepHangDoi, HANG_DOI_SAU_MS } from '../services/hangDoiService';

// ─── HÀNG ĐỢI TÍCH TEM cho 1 màn (19/11/2026) ───
// `useHangDoi(loai, { show, bat, onXongLo })` ⇒ { cho, loi, tai, hangDoi(mapItem, nguon) }:
//   · `cho` / `loi` = số mục đang chờ / lỗi của LOẠI này (vẽ nút Hàng đợi) — tải lại theo socket `hang-doi:cap-nhat`.
//   · `hangDoi(mapItem)` = prop `hangDoi` cho `TichTemNhapModal` / modal nhiều tem: `mapItem({ row, f, fs })` ⇒ { temId, body }.
//   · Lô của CHÍNH người này chạy xong (socket `hang-doi:xong-lo`) ⇒ toast `show` ("đã chạy thành công") + gọi `onXongLo`.
export default function useHangDoi(loai, { show, bat = true, onXongLo } = {}) {
  const { user } = useSelector(selectAuth);
  const myId = user && user.id;
  const [dem, setDem] = useState({ cho: 0, loi: 0 });
  const tai = useCallback(() => {
    if (!bat) return;
    dsHangDoi({ loai, soGio: 24 })
      .then((r) => { const t = (r.data?.theo_loai || {})[loai] || {}; setDem({ cho: t.CHO || 0, loi: t.LOI || 0 }); })
      .catch(() => {});
  }, [bat, loai]);
  useEffect(() => { tai(); }, [tai]);
  useSocketReload(['hang-doi:cap-nhat'], tai, 800);

  const ref = useRef({ show, onXongLo });
  ref.current = { show, onXongLo };
  useEffect(() => {
    const s = getSocket();
    if (!s || !bat) return undefined;
    const nghe = (p) => {
      if (!p || p.loai !== loai || (myId && p.user_id !== myId)) return;
      const { show: sh, onXongLo: cb } = ref.current;
      if (sh) {
        sh(p.so_loi
          ? `Hàng đợi ${p.ten}: ${p.so_ok}/${p.so_ok + p.so_loi} tem đã chạy xong · ${p.so_loi} lỗi (${p.tem_loi || ''}) — xem nút Hàng đợi`
          : `Hàng đợi ${p.ten}: đã chạy thành công ${p.so_ok} tem`, p.so_loi ? 'error' : undefined);
      }
      if (cb) cb(p);
    };
    s.on('hang-doi:xong-lo', nghe);
    return () => s.off('hang-doi:xong-lo', nghe);
  }, [bat, loai, myId]);

  const hangDoi = useCallback((mapItem, nguon = 'TICH_TEM') => ({
    sauMs: HANG_DOI_SAU_MS,
    xep: async (ds) => {
      const res = await xepHangDoi(loai, ds.map(mapItem), nguon);
      tai();
      return { so: res.data?.so || 0, bo_qua: (res.data?.bo_qua || []).map((b) => ({ khoa: b.tem_id, ly_do: b.ly_do })) };
    },
  }), [loai, tai]);

  return useMemo(() => ({ ...dem, tai, hangDoi }), [dem, tai, hangDoi]);
}
