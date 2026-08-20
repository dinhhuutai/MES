import { useCallback, useEffect, useState } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import Icon from '../../../components/common/Icon';
import LoaiDotVaiBadge from './LoaiDotVaiBadge';
import PhuongAnInBadge from '../../../components/common/PhuongAnInBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import { getPhanIn } from '../../../services/orderService';
import { fmtNum, fmtDate } from '../../../utils/format';
import { hienDsMa } from '../../../utils/maPhanIn';

// ─────────────────────────────────────────────────────────────────────────────
// TRA CỨU 1 PHẦN IN TỪ "DANH SÁCH RELEASE" — trả lời đúng câu người dùng hay bị hỏi:
// *"Kế hoạch release ngày 15/08 có 51 phần, mà Release 2 chỉ còn 4, Test Run 29 — sao không khớp?"*
//
// ⚠⚠ KHÔNG KHỚP LÀ ĐÚNG BẢN CHẤT, không phải lỗi: danh sách release là ẢNH CHỤP lúc RELEASE, còn
// Release 2 / Test Run là chỗ hàng ĐANG ĐỨNG **bây giờ**. Sau khi release, mỗi phần in tự chạy tiếp
// (Test Run → Release 2 → Sản xuất → …) nên tổng ở 2 màn kia luôn NHỎ HƠN. Panel này cho thấy từng
// phần in giờ đang ở đâu ⇒ tự cộng lại đối chiếu được, khỏi phải đi hỏi.
//
// ⚠ Giai đoạn hiển thị lấy từ `giai_doan_ten` do BACKEND tính bằng CHÍNH `dominantStageScalar` mà
//   dashboard + màn Đơn hàng dùng ⇒ không bao giờ ra 2 con số đá nhau.
// ─────────────────────────────────────────────────────────────────────────────

const fmtDt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '—');

function Dong({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="truncate text-sm text-ink">{children ?? '—'}</div>
    </div>
  );
}

// 1 trạm trong hành trình: tên trạm + các mốc xác nhận (người + giờ) + số lượng nếu có.
function TramNode({ t }) {
  const cl = t.checklists || [];
  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
      <span className="absolute left-[4.5px] top-4 h-full w-px bg-line" aria-hidden="true" />
      <div className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">{t.ten_tram || t.ma_tram}</span>
          {t.so_luong != null && <Badge tone="default">SL {fmtNum(t.so_luong)}</Badge>}
        </div>
        {t.tg && <div className="text-xs text-ink-soft">{fmtDt(t.tg)}{t.nguoi ? ` · ${t.nguoi}` : ''}</div>}
        {cl.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {cl.map((c, i) => (
              <li key={`${c.ma_checkpoint}-${i}`} className="text-xs text-ink-soft">
                <span className="text-ink">{c.ten_checkpoint || c.ma_checkpoint}</span>
                {c.gia_tri_text ? ` (${c.gia_tri_text})` : ''}
                {c.tg ? ` · ${fmtDt(c.tg)}` : ''}
                {c.nguoi ? ` · ${c.nguoi}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default function PhanInTraCuuPanel({ open, onClose, row }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loi, setLoi] = useState('');

  const load = useCallback(async () => {
    if (!open || !row?.phan_in_id) return;
    setLoading(true); setLoi(''); setData(null);
    try {
      const res = await getPhanIn(row.phan_in_id);
      setData(res.data);
    } catch (e) {
      // ⚠ Không ném ra ngoài: thiếu quyền ORDER_VIEW thì vẫn phải xem được thông tin của DÒNG
      //   (đã có sẵn từ danh sách release), chỉ mất phần hành trình.
      setLoi(e.message || 'Không tải được hành trình');
    } finally { setLoading(false); }
  }, [open, row]);
  useEffect(() => { load(); }, [load]);

  const tl = data?.timeline || {};
  const journeys = tl.journeys || [];

  return (
    <SidePanel open={open} onClose={onClose} width="max-w-3xl"
      title={row ? `${row.ma_phan || 'Phần in'}` : 'Phần in'}
      subtitle={row ? `${row.ten_khach_hang || ''} · ${row.ma_don_hang || ''} · ${row.ma_hang || ''}` : ''}>
      {!row ? null : (
        <div className="space-y-4">
          {/* GIAI ĐOẠN HIỆN TẠI — câu trả lời chính, để ngay đầu panel. */}
          <div className="rounded-card border border-primary/30 bg-primary-wash px-4 py-3">
            <div className="text-xs text-ink-soft">Checkpoint hiện tại của phần in</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-primary">{row.giai_doan_ten || '—'}</span>
              {row.lenh_trang_thai && <Badge tone="info">Lệnh: {row.lenh_trang_thai}</Badge>}
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">
              Đây là chỗ hàng đang đứng <b>bây giờ</b>. Danh sách release là ảnh chụp lúc release nên
              tổng ở Test Run / Release 2 luôn nhỏ hơn — phần đã chạy tiếp không còn nằm ở đó nữa.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Dong label="Đợt sản xuất">{row.ma_lenh_san_xuat}</Dong>
            <Dong label="Chuyền">{row.ten_chuyen}</Dong>
            <Dong label="Ngày kế hoạch">{fmtDate(row.ngay_ke_hoach)}</Dong>
            <Dong label="Code phần">{row.ma_phan}</Dong>
            <Dong label="Màu vải">{row.mau_vai}</Dong>
            <Dong label="Kích (vải/phim)">{[row.kich_vai, row.kich_phim].filter(Boolean).join(' · ')}</Dong>
            <Dong label="SL release (phần này)">{fmtNum(row.sl_release_phan)}</Dong>
            <Dong label="SL nhận vải">{fmtNum(row.slnv)}</Dong>
            <Dong label="SL đơn hàng">{fmtNum(row.so_luong_don_hang)}</Dong>
            <Dong label="Người release">{row.owner}</Dong>
            <Dong label="Giờ release">{fmtDt(row.created_date)}</Dong>
            <Dong label="Loại chuyền">{row.ten_loai_chuyen}</Dong>
          </div>

          {data && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-3 sm:grid-cols-3">
              <Dong label="Tính chất in"><TinhChatInCell value={data.tinh_chat_in} /></Dong>
              <Dong label="Phương án in"><PhuongAnInBadge value={data.phuong_an_in} /></Dong>
              <Dong label="Barcode TDTHĐH">{hienDsMa(data.barcode_phan_in, '')}</Dong>
            </div>
          )}

          {/* HÀNH TRÌNH — mỗi đợt SX 1 nhánh, đầu nhánh là READY của chính chu kỳ đó. */}
          <div className="border-t border-line pt-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon name="history" size={15} /> Hành trình phần in
            </h4>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner size={24} /></div>
            ) : loi ? (
              <p className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {loi}
              </p>
            ) : !data ? null : (
              <div className="space-y-4">
                {tl.ready && journeys.length === 0 && (
                  <ul className="space-y-0"><TramNode t={tl.ready} /></ul>
                )}
                {journeys.map((j, ji) => (
                  <div key={j.lenh_id || ji} className="rounded-card border border-line p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="info">Đợt SX {ji + 1}/{journeys.length}</Badge>
                      <span className="text-sm font-medium text-ink">{j.ma_lenh_san_xuat}</span>
                      {/* Đánh dấu đúng đợt SX của DÒNG đang bấm — phần in có thể có nhiều đợt SX. */}
                      {j.lenh_id === row.lenh_id && <Badge tone="success">dòng đang xem</Badge>}
                      {(j.dot_vai || []).map((d) => (
                        <span key={d.ma_dot_vai} className="text-xs text-ink-soft">
                          {d.ma_dot_vai} · SL {fmtNum(d.so_luong)}
                        </span>
                      ))}
                    </div>
                    <ul className="space-y-0">
                      {(j.trams || []).map((t, i) => <TramNode key={`${t.ma_tram}-${i}`} t={t} />)}
                    </ul>
                  </div>
                ))}
                {(tl.pending || []).length > 0 && (
                  <div className="rounded-card border border-dashed border-line p-3">
                    <div className="mb-1 text-sm font-medium text-ink-soft">Đợt vải chưa release</div>
                    {(tl.pending || []).map((p, i) => (
                      <div key={p.ma_dot_vai || i} className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                        <span>{p.ma_dot_vai}</span>
                        <LoaiDotVaiBadge value={p.loai_dot_vai} />
                        <span>SL {fmtNum(p.so_luong_vai_ve)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {journeys.length === 0 && !tl.ready && (tl.pending || []).length === 0 && (
                  <p className="py-4 text-center text-sm text-ink-soft">Chưa có dữ liệu hành trình.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </SidePanel>
  );
}
