import React, { useEffect, useMemo, useState } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Badge from '../../../components/common/Badge';
import SearchableSelect from '../../../components/common/SearchableSelect';
import { fmtDateTime, temCode } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// SIDEPANEL PHÂN LOẠI LỖI của 1 tem — thông tin tem đầy đủ + bảng nhập lỗi.
//
// ⚠⚠ LUẬT SỐ LƯỢNG (chốt 10/08/2026): Σ(sửa + hủy) của mọi dòng phải **BẰNG ĐÚNG** SL hư mà KCS
//   đã ghi (`sl_hu`). Lưu xong, 2 con số này GHI ĐÈ `tem.sl_kcs_sua` / `sl_kcs_huy` — đây là nguồn
//   CHÍNH THỨC. Panel chặn nút Lưu khi còn lệch để người dùng thấy ngay, backend vẫn kiểm lại.
//
// ⚠ Ô nhập khai class riêng, KHÔNG dùng `Input` của controls: `inputClass` có sẵn `w-full`+`h-11`
//   mà Tailwind sinh `.w-full` SAU `.w-20` ⇒ class truyền thêm vô tác dụng (bẫy §6 Hồ sơ kỹ thuật).
//
// ⚠ MÃ TEM hiện với TIỀN TỐ **16** (nhãn hàng LỖI dán túi sửa) — đúng nhãn mà người phân loại đang
//   cầm trên tay. DB vẫn lưu mã gốc tiền tố 15 (KCS đạt); chỉ đổi phần HIỂN THỊ.
// ─────────────────────────────────────────────────────────────────────────────

const O_SO = 'h-9 w-20 rounded-control border border-line bg-surface px-2 text-right text-base md:text-sm outline-none focus:border-primary';
const O_CHU = 'h-9 w-full rounded-control border border-line bg-surface px-2 text-base md:text-sm outline-none focus:border-primary';

const so = (v) => Math.max(0, Math.trunc(Number(v) || 0));
const dongMoi = () => ({ loaiLoiId: '', bienPhapId: '', soLuongSua: 0, soLuongHuy: 0, ghiChu: '' });

function O({ nhan, children }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-soft">{nhan}</div>
      <div className="text-sm font-medium text-ink">{children ?? '—'}</div>
    </div>
  );
}

export default function PhanLoaiLoiPanel({ open, onClose, data, loaiLoi, bienPhap, onLuu, dangLuu }) {
  const [dong, setDong] = useState([dongMoi()]);
  const [ghiChu, setGhiChu] = useState('');

  const tem = data?.tem || null;
  const phieu = data?.phieu || null;

  // Nạp lại mỗi khi mở tem khác. Đã có phiếu thì đổ dòng cũ ra để SỬA.
  useEffect(() => {
    if (!tem) return;
    if (phieu?.dong?.length) {
      setDong(phieu.dong.map((d) => ({
        loaiLoiId: d.loai_loi_id, bienPhapId: d.bien_phap_id || '',
        soLuongSua: d.so_luong_sua, soLuongHuy: d.so_luong_huy, ghiChu: d.ghi_chu || '',
      })));
    } else {
      setDong([dongMoi()]);
    }
    setGhiChu(phieu?.ghi_chu || '');
  }, [tem, phieu]);

  const slHu = Number(tem?.sl_hu || 0);
  const tongSua = useMemo(() => dong.reduce((s, d) => s + so(d.soLuongSua), 0), [dong]);
  const tongHuy = useMemo(() => dong.reduce((s, d) => s + so(d.soLuongHuy), 0), [dong]);
  const lech = tongSua + tongHuy - slHu;
  const thieuLoai = dong.some((d) => !d.loaiLoiId && (so(d.soLuongSua) > 0 || so(d.soLuongHuy) > 0));
  const hopLe = slHu > 0 && lech === 0 && !thieuLoai && (tongSua + tongHuy) > 0;

  const sua = (i, v) => setDong((ds) => ds.map((d, j) => (j === i ? { ...d, ...v } : d)));
  const boDong = (i) => setDong((ds) => (ds.length === 1 ? [dongMoi()] : ds.filter((_, j) => j !== i)));

  // ⚠ `SearchableSelect` mặc định `getValue = (o) => o.id` ⇒ khóa phải tên là `id`.
  const optLoi = useMemo(() => (loaiLoi || []).map((l) => ({
    id: l.id, label: `${l.ma_loi} — ${l.ten_loi}`, search: `${l.ma_loi} ${l.ten_loi} ${l.nhom_loi || ''}`,
  })), [loaiLoi]);
  const optBP = useMemo(() => (bienPhap || []).map((b) => ({
    id: b.id, label: b.ten_bien_phap, search: `${b.ma_bien_phap} ${b.ten_bien_phap}`,
  })), [bienPhap]);

  return (
    <SidePanel
      open={open} onClose={onClose} width="max-w-4xl"
      title={tem ? `Phân loại lỗi — tem ${temCode(tem.ma_tem, 16)}` : 'Phân loại lỗi'}
      subtitle={tem ? `${tem.ten_khach_hang || '—'} · ${tem.ma_phan || '—'}` : ''}
      footer={tem && (
        <>
          <div className="mr-auto text-xs">
            {slHu <= 0 ? (
              <span className="font-semibold text-danger">KCS chưa ghi SL hư cho tem này — không có gì để phân loại</span>
            ) : lech === 0 ? (
              <span className="font-semibold text-emerald-600">
                Khớp: sửa {tongSua} + hủy {tongHuy} = {slHu} hư
              </span>
            ) : (
              <span className="font-semibold text-danger">
                Lệch {lech > 0 ? `thừa ${lech}` : `thiếu ${-lech}`} — sửa {tongSua} + hủy {tongHuy} phải bằng {slHu}
              </span>
            )}
            {thieuLoai && <span className="ml-2 text-danger">· còn dòng chưa chọn loại lỗi</span>}
          </div>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button icon="save" loading={dangLuu} disabled={!hopLe}
            onClick={() => onLuu({ dong, ghiChu })}>Lưu phân loại</Button>
        </>
      )}
    >
      {!tem ? <div className="py-10 text-center text-sm text-ink-soft">Chưa chọn tem</div> : (
        <div className="space-y-4">
          {/* ── Thông tin tem ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 rounded-card border border-line bg-surface-muted p-3 sm:grid-cols-4">
            <O nhan="Khách hàng">{tem.ten_khach_hang}</O>
            <O nhan="Đơn hàng">{tem.ma_don_hang}</O>
            <O nhan="Mã hàng">{tem.ma_hang}</O>
            <O nhan="Code phần">{tem.ma_phan}</O>
            <O nhan="Màu vải">{tem.mau_vai}</O>
            <O nhan="Kích vải">{tem.kich_vai}</O>
            <O nhan="Kích phim">{tem.kich_phim}</O>
            <O nhan="Chuyền">{tem.ten_chuyen}</O>
            <O nhan="Lệnh SX">{tem.ma_lenh_san_xuat}</O>
            <O nhan="Giờ in tem">{fmtDateTime(tem.tg_in)}</O>
            <O nhan="Tính chất in">{tem.tinh_chat_in}</O>
            <O nhan="Trạng thái tem"><Badge tone="info">{tem.trang_thai}</Badge></O>
          </div>

          {/* ── Số lượng ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['SL in', tem.so_luong, ''],
              ['SL đạt (KCS)', tem.sl_kcs_dat, 'text-emerald-600'],
              ['SL hư (KCS)', slHu, 'text-danger'],
              ['Đang chờ kiểm', tem.con_kcs, 'text-amber-600'],
              ['Đã sửa xong', Number(tem.sl_sua_dat || 0) + Number(tem.sl_sua_huy || 0), 'text-ink-soft'],
            ].map(([nhan, v, mau]) => (
              <div key={nhan} className="rounded-card border border-line p-2.5 text-center">
                <div className="text-[11px] uppercase tracking-wide text-ink-soft">{nhan}</div>
                <div className={`text-lg font-bold ${mau || 'text-ink'}`}>{Number(v || 0).toLocaleString('vi-VN')}</div>
              </div>
            ))}
          </div>

          {phieu && (
            <div className="rounded-control bg-primary-wash/50 px-3 py-2 text-xs text-ink-soft">
              Đã phân loại lúc {fmtDateTime(phieu.updated_date || phieu.created_date)}
              {phieu.nguoi ? ` · ${phieu.nguoi}` : ''} — sửa lại rồi bấm Lưu sẽ ghi đè.
            </div>
          )}

          {/* ── Bảng nhập ────────────────────────────────────────────── */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Icon name="alert-triangle" size={14} className="text-danger" />
              <h3 className="text-sm font-semibold text-ink">Bảng phân loại lỗi</h3>
              <span className="text-xs text-ink-soft">— sửa + hủy phải bằng đúng {slHu} pcs hư</span>
            </div>
            <div className="overflow-auto rounded-card border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="w-8 px-2 py-2">#</th>
                    <th className="px-2 py-2" style={{ minWidth: 220 }}>Mã / tên lỗi</th>
                    <th className="px-2 py-2" style={{ minWidth: 190 }}>Biện pháp xử lý</th>
                    <th className="px-2 py-2 text-right">SL sửa</th>
                    <th className="px-2 py-2 text-right">SL hủy</th>
                    <th className="px-2 py-2" style={{ minWidth: 140 }}>Ghi chú</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {dong.map((d, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={i} className="border-t border-line align-top">
                      <td className="px-2 py-2 text-ink-soft">{i + 1}</td>
                      <td className="px-2 py-2">
                        <SearchableSelect
                          options={optLoi} value={d.loaiLoiId}
                          onChange={(v) => sua(i, { loaiLoiId: v })}
                          placeholder="Gõ mã hoặc tên lỗi…"
                          getSearch={(o) => o.search}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <SearchableSelect
                          options={optBP} value={d.bienPhapId}
                          onChange={(v) => sua(i, { bienPhapId: v })}
                          placeholder="Chọn biện pháp…"
                          getSearch={(o) => o.search}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input type="number" min="0" className={O_SO} value={d.soLuongSua}
                          onChange={(e) => sua(i, { soLuongSua: so(e.target.value) })} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input type="number" min="0" className={O_SO} value={d.soLuongHuy}
                          onChange={(e) => sua(i, { soLuongHuy: so(e.target.value) })} />
                      </td>
                      <td className="px-2 py-2">
                        <input className={O_CHU} value={d.ghiChu} placeholder="…"
                          onChange={(e) => sua(i, { ghiChu: e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        <button type="button" title="Bỏ dòng" className="text-ink-soft hover:text-danger"
                          onClick={() => boDong(i)}><Icon name="x" size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-line bg-surface-muted font-semibold">
                    <td />
                    <td className="px-2 py-2">
                      {/* Dấu + ở ĐÁY bảng để thêm hàng nhập tiếp */}
                      <button type="button" onClick={() => setDong((ds) => [...ds, dongMoi()])}
                        className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Icon name="plus" size={14} /> Thêm dòng
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right text-ink-soft">Tổng</td>
                    <td className={`px-2 py-2 text-right ${lech === 0 ? 'text-ink' : 'text-danger'}`}>{tongSua}</td>
                    <td className={`px-2 py-2 text-right ${lech === 0 ? 'text-ink' : 'text-danger'}`}>{tongHuy}</td>
                    <td colSpan={2} className="px-2 py-2 text-xs font-normal text-ink-soft">
                      {tongSua + tongHuy} / {slHu} pcs hư
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-ink">Ghi chú chung</div>
            <input className={O_CHU} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)}
              placeholder="Ghi chú cho phiếu phân loại này…" />
          </div>
        </div>
      )}
    </SidePanel>
  );
}
