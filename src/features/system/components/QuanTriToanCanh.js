import { useEffect, useMemo, useState } from 'react';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import SearchableSelect from '../../../components/common/SearchableSelect';
import NhieuNguoiSelect from '../../../components/common/NhieuNguoiSelect';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import TimeSelect from '../../../components/common/TimeSelect';
import Spinner from '../../../components/common/Spinner';
import { Field, Input, Textarea } from '../../../components/common/controls';
import { fmtNum, fmtDateTime, fmtDate } from '../../../utils/format';
import { laChuyenGiaCong } from '../../planning/utils/chuyenGiaCong';
import {
  luiVeTram, huyLeQt, luuPhanCongQt, getKeHoachLenhQt, suaKeHoachLenhQt, suaKeHoachTamQt,
} from '../../../services/quanTriPhanInService';

// ─────────────────────────────────────────────────────────────────────────────
// QUẢN TRỊ PHẦN IN — khối "Lệnh · phiếu · tem · xác nhận" + 3 modal (19/10/2026, người dùng chốt: trang điều chỉnh
// được TOÀN BỘ của 1 phần in — lùi về trạm bất kỳ, hủy tem / phiếu / phân công / phân loại lỗi / mọi xác nhận).
// Mọi nút gọi API Quản trị phần in ⇒ backend gọi lại ĐÚNG service hủy đang chạy ngoài giao diện (guard + báo ERP).
// Dữ liệu = `chiTiet().toan_canh` (BE `phaninadmin.repository.toanCanh`).
// ⚠ Component con khai ở MỨC MODULE (luật §9).
// ─────────────────────────────────────────────────────────────────────────────

export const TEN_TT_LENH = {
  RELEASE_1: 'Release 1 / Test Run', RELEASE_2: 'Release 2 (chờ chạy)', SAN_XUAT: 'Đang sản xuất', HOAN_TAT: 'Chạy hoàn tất',
  GIA_CONG: 'Gia công', CHO_IN_XONG: 'Chờ in xong (ép ủi)',
};
const TEN_TT_TEM = {
  IN: 'Mới in', DANG_PHOI: 'Đang phơi', DA_KHO: 'Đã khô (chờ KCS)', CHO_SUA: 'Chờ sửa', CHO_OQC: 'Chờ OQC',
  OQC_DAT: 'Qua OQC (chờ giao)', DA_GIAO: 'Đã giao', HUY: 'Đã hủy',
};
const TONE_TEM = { HUY: 'danger', DA_GIAO: 'success', OQC_DAT: 'success', CHO_SUA: 'warning', CHO_OQC: 'info' };
// Ngày / giờ trong ngày theo giờ máy (VN) — đổ sẵn ô sửa kế hoạch; ghép lại `${ngày}T${giờ}:00` như màn Lập lại kế hoạch.
const pad2 = (n) => String(n).padStart(2, '0');
const ngayStr = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : ''; };
const gioStr = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : ''; };
const mkTs = (ngay, gio) => (ngay && gio ? `${ngay}T${gio}:00` : null);
const khoangGio = (bd, kt) => (bd || kt ? `${gioStr(bd) || '—'} → ${gioStr(kt) || '—'}` : '');
const th = 'whitespace-nowrap px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-ink-soft';
const td = 'px-2 py-1.5 text-sm text-ink align-top';

function NutHuy({ onClick, children = 'Hủy', tone = 'danger' }) {
  return (
    <Button variant={tone === 'danger' ? 'ghost' : 'secondary'} onClick={onClick}
      className={`px-2 py-1 text-xs ${tone === 'danger' ? 'text-danger hover:bg-danger/10' : ''}`}>{children}</Button>
  );
}

// Các xác nhận (KCS / Sửa / OQC / Phân loại lỗi / phiếu giao / tích tem) của lệnh gộp 1 bảng theo thời gian.
function dongXacNhan(tc, temIds) {
  const maTem = new Map(tc.tem.map((t) => [t.id, t.ma_tem]));
  const co = (id) => temIds.has(id);
  const out = [];
  tc.kcs.filter((x) => co(x.tem_id)).forEach((x) => out.push({ loai: 'KCS', id: x.id, ten: 'KCS', tem: maTem.get(x.tem_id), tg: x.created_date, nguoi: x.nguoi,
    sl: `Kiểm ${fmtNum(x.so_luong_kiem)} · đạt ${fmtNum(x.so_luong_dat)} · hư ${fmtNum(x.so_luong_loi)}${x.so_luong_huy ? ` · hủy ${fmtNum(x.so_luong_huy)}` : ''}` }));
  tc.pll.filter((x) => co(x.tem_id)).forEach((x) => out.push({ loai: 'PLL', id: x.tem_id, ten: 'Phân loại lỗi', tem: maTem.get(x.tem_id), tg: x.tg,
    sl: `Sửa ${fmtNum(x.sl_sua_luc_luu)} · hủy ${fmtNum(x.sl_huy_luc_luu)}` }));
  tc.sua.filter((x) => co(x.tem_id)).forEach((x) => out.push({ loai: 'SUA', id: x.id, ten: 'Sửa', tem: maTem.get(x.tem_id), tg: x.created_date, nguoi: x.nguoi,
    sl: `Đạt ${fmtNum(x.so_luong_sua_dat)} · hủy ${fmtNum(x.so_luong_sua_huy)}` }));
  tc.oqc.filter((x) => co(x.tem_id)).forEach((x) => out.push({ loai: 'OQC', id: x.id, ten: `OQC${x.nguon ? ` (${x.nguon === 'SUA' ? 'Sửa' : 'KCS'})` : ''}`, tem: maTem.get(x.tem_id), tg: x.created_date, nguoi: x.nguoi,
    sl: `Mẫu ${fmtNum(x.so_luong_kiem)} · qua giao ${fmtNum(x.sl_qua_giao ?? x.so_luong_dat)}${x.ket_qua ? ` · ${x.ket_qua}` : ''}` }));
  tc.tem.filter((t) => co(t.id) && t.da_tich_giao).forEach((t) => out.push({ loai: 'TICH_GIAO', id: t.id, ten: 'GN đã tích tem', tem: t.ma_tem, tg: null, sl: '' }));
  tc.giao.filter((g) => (g.tem_ids || []).some(co)).forEach((g) => out.push({ loai: 'PHIEU_GIAO', id: g.id, ten: `Phiếu giao ${g.ma_phieu_giao}`, tem: '', tg: g.created_date,
    sl: `${fmtNum(g.so_luong)} pcs · ${g.trang_thai}` }));
  return out.sort((a, b) => new Date(a.tg || 0) - new Date(b.tg || 0));
}

function KhoiLenh({ tc, lenh, onLuiVe, onHuyLe, onPhanCong, onSuaKeHoach }) {
  const phieu = tc.phieu.filter((p) => p.lenh_san_xuat_id === lenh.id);
  const tems = tc.tem.filter((t) => t.lenh_san_xuat_id === lenh.id);
  const temSong = new Set(tems.filter((t) => t.trang_thai !== 'HUY').map((t) => t.id));
  const xn = dongXacNhan(tc, temSong);
  const tests = tc.test.filter((x) => x.lenh_san_xuat_id === lenh.id);
  const giaCong = lenh.trang_thai === 'GIA_CONG' || lenh.ma_loai_chuyen === 'GIA_CONG';
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{lenh.ma_lenh_san_xuat}</span>
          <Badge tone="info">{TEN_TT_LENH[lenh.trang_thai] || lenh.trang_thai}</Badge>
          <span className="text-xs text-ink-soft">{lenh.ma_chuyen || 'chưa gán chuyền'} · SL release {fmtNum(lenh.so_luong_release)}</span>
          {lenh.test_dat && <Badge tone="success">Đã test đạt</Badge>}
          {lenh.so_phan_in > 1 && <Badge tone="warning">Lệnh gom {lenh.so_phan_in} phần in</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onSuaKeHoach({ kieu: 'LENH', lenh })}>Sửa kế hoạch</Button>
          <Button variant="danger" onClick={() => onLuiVe(lenh)}>Lùi về trạm…</Button>
        </div>
      </div>
      {/* Kế hoạch hiện tại của lệnh (26/10/2026 — sửa được bằng nút "Sửa kế hoạch"). */}
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-soft">
        <span>Chuyền KH <b className="text-ink">{lenh.ma_chuyen || '—'}</b></span>
        <span>Ngày SX KH <b className="text-ink">{lenh.ngay_ke_hoach ? fmtDate(lenh.ngay_ke_hoach) : '—'}</b></span>
        <span>Giờ KH <b className="text-ink">{khoangGio(lenh.tg_bd_kh, lenh.tg_kt_kh) || '—'}</b></span>
        <span>Thợ in KH <b className="text-ink">{lenh.tho_in_kh || '—'}</b></span>
      </div>

      {tests.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-semibold text-ink-soft">Lần test</div>
          {tests.map((x) => (
            <div key={x.id} className="flex items-center justify-between border-b border-line/50 py-1 text-sm">
              <span>Lần {x.lan_test} · <b>{x.ket_qua || '—'}</b> · {fmtDateTime(x.created_date)}{x.ghi_chu ? ` · ${x.ghi_chu}` : ''}</span>
              <NutHuy onClick={() => onHuyLe({ loai: 'TEST_RUN', id: x.id, nhan: `Hủy lần test ${x.lan_test} của ${lenh.ma_lenh_san_xuat}` })} />
            </div>
          ))}
        </div>
      )}

      {phieu.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <div className="mb-1 text-xs font-semibold text-ink-soft">Phiếu sản xuất (lượt chạy) · phân công</div>
          <table className="w-full min-w-[720px]">
            <thead><tr className="border-b border-line">{['Phiếu', 'Trạng thái', 'Chạy', 'Phân công', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {phieu.map((p) => (
                <tr key={p.id} className="border-b border-line/50">
                  <td className={td}>{p.ma_phieu_san_xuat || '—'}<div className="text-xs text-ink-soft">{p.ma_chuyen || ''}</div></td>
                  <td className={td}><Badge tone={p.trang_thai === 'DANG_CHAY' ? 'info' : 'default'}>{p.trang_thai === 'DANG_CHAY' ? 'Đang chạy' : 'Hoàn tất'}</Badge></td>
                  <td className={`${td} text-xs`}>{fmtDateTime(p.tg_bd)}{p.tg_kt ? ` → ${fmtDateTime(p.tg_kt)}` : ''}</td>
                  <td className={`${td} text-xs`}>
                    <div>Ca trưởng: <b>{p.ca_truong || '—'}</b> · Chuyền trưởng: <b>{p.chuyen_truong || '—'}</b></div>
                    <div>Thợ in: <b>{p.tho_in || '—'}</b>{p.ma_to ? ` · Tổ ${p.ma_to}` : ''}</div>
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <NutHuy tone="secondary" onClick={() => onPhanCong(p)}>Phân công</NutHuy>
                    {p.trang_thai === 'DANG_CHAY' ? (
                      <>
                        <NutHuy tone="secondary" onClick={() => onHuyLe({ loai: 'CHAY_HOAN_TAT', id: p.id, nhan: `Chạy hoàn tất (đóng) phiếu ${p.ma_phieu_san_xuat || ''}` })}>Hoàn tất</NutHuy>
                        <NutHuy onClick={() => onHuyLe({ loai: 'HUY_CHAY', id: p.id, nhan: `Hủy xác nhận chạy phiếu ${p.ma_phieu_san_xuat || ''} (chỉ khi chưa còn tem sống)` })}>Hủy chạy</NutHuy>
                      </>
                    ) : (
                      <NutHuy tone="secondary" onClick={() => onHuyLe({ loai: 'MO_LAI_PHIEU', id: p.id, nhan: `Mở lại phiếu ${p.ma_phieu_san_xuat || ''} (về đang chạy)` })}>Mở lại</NutHuy>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tems.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <div className="mb-1 text-xs font-semibold text-ink-soft">Tem ({tems.length})</div>
          <table className="w-full min-w-[720px]">
            <thead><tr className="border-b border-line">{['Mã tem', 'SL in', 'Trạng thái', 'Sổ cái', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {tems.map((t) => (
                <tr key={t.id} className={`border-b border-line/50 ${t.trang_thai === 'HUY' ? 'opacity-60' : ''}`}>
                  <td className={`${td} font-mono`}>{t.ma_tem}{t.tem_goc_id ? <span className="ml-1 text-xs text-ink-soft">(tem 17)</span> : null}
                    {t.ma_lo && <div className="text-xs text-ink-soft">Lô {t.ma_lo}</div>}</td>
                  <td className={`${td} tabular-nums`}>{fmtNum(t.so_luong)}</td>
                  <td className={td}><Badge tone={TONE_TEM[t.trang_thai] || 'default'}>{TEN_TT_TEM[t.trang_thai] || t.trang_thai}</Badge></td>
                  <td className={`${td} text-xs tabular-nums`}>
                    KCS đạt {fmtNum(t.sl_kcs_dat)} · sửa {fmtNum(t.sl_kcs_sua)} · hủy {fmtNum(t.sl_kcs_huy)} · OQC {fmtNum(t.sl_oqc_dat)} · giao {fmtNum(t.sl_da_giao)}
                  </td>
                  <td className={`${td} text-right`}>
                    {t.trang_thai === 'HUY'
                      ? (t.mo_lai_duoc && <NutHuy tone="secondary" onClick={() => onHuyLe({ loai: 'MO_LAI_TEM', id: t.id, nhan: `Mở lại tem ${t.ma_tem}` })}>Mở lại</NutHuy>)
                      : !t.tem_goc_id && <NutHuy onClick={() => onHuyLe({ loai: giaCong ? 'TEM_GIA_CONG' : 'TEM', id: t.id, nhan: `Hủy tem ${t.ma_tem} (chỉ được khi chưa kiểm / giao)` })} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {xn.length > 0 && (
        <div className="overflow-x-auto">
          <div className="mb-1 text-xs font-semibold text-ink-soft">Xác nhận sau sản xuất ({xn.length}) — hủy từ dòng MỚI NHẤT trở lên</div>
          <table className="w-full min-w-[720px]">
            <thead><tr className="border-b border-line">{['Bước', 'Tem', 'Lúc', 'Người', 'Số lượng', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {xn.map((x) => (
                <tr key={`${x.loai}-${x.id}`} className="border-b border-line/50">
                  <td className={`${td} font-medium`}>{x.ten}</td>
                  <td className={`${td} font-mono text-xs`}>{x.tem || '—'}</td>
                  <td className={`${td} text-xs`}>{x.tg ? fmtDateTime(x.tg) : '—'}</td>
                  <td className={`${td} text-xs`}>{x.nguoi || '—'}</td>
                  <td className={`${td} text-xs`}>{x.sl}</td>
                  <td className={`${td} text-right`}>
                    <NutHuy onClick={() => onHuyLe({ loai: x.loai, id: x.id, nhan: `${x.loai === 'TICH_GIAO' ? 'Bỏ tích giao' : 'Hủy'} ${x.ten}${x.tem ? ` — tem ${x.tem}` : ''}` })}>
                      {x.loai === 'TICH_GIAO' ? 'Bỏ tích' : 'Hủy'}
                    </NutHuy>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!phieu.length && !tems.length && <div className="text-sm text-ink-soft">Lệnh chưa chạy — chưa có phiếu / tem.</div>}
    </div>
  );
}

// Kế hoạch tạm của các đợt chưa Ready (`ke_hoach_tam`) — sửa được (26/10/2026).
function KhoiKeHoachTam({ ds, onSuaKeHoach }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface p-4">
      <div className="mb-1 text-xs font-semibold text-ink-soft">Kế hoạch tạm (đợt chưa Ready — chưa có lệnh)</div>
      <table className="w-full min-w-[720px]">
        <thead><tr className="border-b border-line">{['Đợt vải', 'Chuyền', 'Ngày SX KH', 'Giờ', 'SL', 'Thợ in', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {ds.map((k) => (
            <tr key={k.id} className="border-b border-line/50">
              <td className={`${td} text-xs`}>{k.ma_dot_vai}<div className="text-ink-soft">vải {fmtNum(k.so_luong_vai_ve)}</div></td>
              <td className={td}>{k.ma_chuyen || '—'}</td>
              <td className={td}>{k.ngay_ke_hoach ? fmtDate(k.ngay_ke_hoach) : '—'}</td>
              <td className={`${td} text-xs`}>{khoangGio(k.tg_bd_kh, k.tg_kt_kh) || '—'}</td>
              <td className={`${td} tabular-nums`}>{fmtNum(k.so_luong)}</td>
              <td className={`${td} text-xs`}>{k.tho_in_kh || '—'}</td>
              <td className={`${td} text-right`}><NutHuy tone="secondary" onClick={() => onSuaKeHoach({ kieu: 'TAM', kt: k })}>Sửa</NutHuy></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ToanCanhLenh({ tc, onLuiVe, onHuyLe, onPhanCong, onSuaKeHoach }) {
  const coLenh = !!(tc && tc.lenh && tc.lenh.length);
  const kht = (tc && tc.ke_hoach_tam) || [];
  if (!coLenh && !kht.length) return null;
  return (
    <div className="space-y-3">
      {kht.length > 0 && <KhoiKeHoachTam ds={kht} onSuaKeHoach={onSuaKeHoach} />}
      {coLenh && <h3 className="text-sm font-semibold text-ink">Lệnh · phiếu · tem · xác nhận ({tc.lenh.length} lệnh)</h3>}
      {coLenh && tc.lenh.map((l) => (
        <KhoiLenh key={l.id} tc={tc} lenh={l} onLuiVe={onLuiVe} onHuyLe={onHuyLe} onPhanCong={onPhanCong} onSuaKeHoach={onSuaKeHoach} />
      ))}
    </div>
  );
}

// ─── Modal SỬA KẾ HOẠCH (26/10/2026) ────────────────────────────────────────────────────────────────────
// `muc` = { kieu: 'LENH', lenh } | { kieu: 'TAM', kt }. Lệnh ⇒ BE gọi CHÍNH "Lập lại kế hoạch" (`planning.replan`, nhận
//   cả lệnh đã chạy: chỉ sửa thông tin, không đổi chặng, không qua gia công; SL release trần theo vải + không dưới đã in;
//   báo ERP kế hoạch). Kế hoạch tạm ⇒ `planning.updateKeHoachTam`. Lý do bắt buộc.
// 28/10/2026 — dùng lại ở sidebar Danh sách release (Kế hoạch): truyền `apiXem(lenhId)` / `apiSua(lenhId, body)` (hàm
//   MỨC MODULE — nằm trong deps) thay API Quản trị phần in; kế hoạch hiện tại đổ lại từ `apiXem` (= `GET /replan/:id`).
export function KeHoachModal({ phanInId, muc, chuyen, users, onClose, onDone, show, apiXem = null, apiSua = null }) {
  const laLenh = muc?.kieu === 'LENH';
  const goc = laLenh ? muc?.lenh : muc?.kt;
  const [chiTiet, setChiTiet] = useState(null);
  const nguon = chiTiet || goc;
  const daChay = laLenh && !!nguon?.co_phieu && nguon?.trang_thai !== 'GIA_CONG';
  const [f, setF] = useState(null);
  const [dsDot, setDsDot] = useState([]);
  const [dangTai, setDangTai] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setChiTiet(null);
    if (!muc || !goc) { setF(null); setDsDot([]); return undefined; }
    const ngay = ngayStr(goc.ngay_ke_hoach);
    setF({
      chuyenId: goc.chuyen_id || '', ngayKeHoach: ngay, gioBd: gioStr(goc.tg_bd_kh), gioKt: gioStr(goc.tg_kt_kh),
      thoIn: goc.tho_in_kh || '', soLuong: laLenh ? '' : String(goc.so_luong ?? ''), slRelease: {}, lyDo: '',
    });
    setDsDot([]);
    if (!laLenh) return undefined;
    let song = true;
    setDangTai(true);
    (apiXem ? apiXem(goc.id) : getKeHoachLenhQt(phanInId, goc.id))
      .then((r) => {
        if (!song) return;
        const d0 = r.data || {};
        const ds = d0.dot_vai || [];
        setDsDot(ds);
        if (apiXem) setChiTiet(d0);
        setF((x) => (x ? {
          ...x,
          // Nguồn ngoài (Danh sách release) chỉ có dòng release ⇒ đổ lại kế hoạch đang lưu từ server.
          ...(apiXem ? {
            chuyenId: d0.chuyen_id || '', ngayKeHoach: ngayStr(d0.ngay_ke_hoach), gioBd: gioStr(d0.tg_bd_kh),
            gioKt: gioStr(d0.tg_kt_kh), thoIn: d0.tho_in_kh || '',
          } : {}),
          slRelease: Object.fromEntries(ds.map((d) => [d.dot_vai_id, String(d.so_luong)])),
        } : x));
      })
      .catch((e) => { if (song) show(e.message || 'Không tải được kế hoạch lệnh', 'error'); })
      .finally(() => { if (song) setDangTai(false); });
    return () => { song = false; };
  }, [muc, goc, laLenh, phanInId, show, apiXem]);

  // Lệnh đã chạy trong xưởng ⇒ bỏ chuyền gia công khỏi danh sách (BE cũng chặn 409 `DA_CHAY`).
  const dsChuyen = useMemo(() => (daChay ? (chuyen || []).filter((c) => !laChuyenGiaCong(chuyen, c.id)) : (chuyen || [])), [chuyen, daChay]);
  if (!muc || !f) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const slSai = laLenh && dsDot.some((d) => {
    const v = f.slRelease[d.dot_vai_id];
    const n = Number(v);
    return v === '' || v == null || !Number.isInteger(n) || n <= 0 || n > d.toi_da;
  });
  const tongSl = dsDot.reduce((a, d) => a + (Number(f.slRelease[d.dot_vai_id]) || 0), 0);

  const luu = async () => {
    if (!String(f.lyDo).trim()) { show('Nhập lý do', 'error'); return; }
    if (!f.ngayKeHoach) { show('Chọn ngày sản xuất kế hoạch', 'error'); return; }
    setBusy(true);
    try {
      const chung = {
        chuyenId: f.chuyenId || null, ngayKeHoach: f.ngayKeHoach, tgBdKh: mkTs(f.ngayKeHoach, f.gioBd), tgKtKh: mkTs(f.ngayKeHoach, f.gioKt),
        thoIn: f.thoIn, lyDo: f.lyDo.trim(),
      };
      const bodyLenh = {
        ...chung,
        slRelease: Object.fromEntries(dsDot.filter((d) => Number(f.slRelease[d.dot_vai_id]) !== d.so_luong)
          .map((d) => [d.dot_vai_id, Number(f.slRelease[d.dot_vai_id])])),
      };
      const r = laLenh
        ? await (apiSua ? apiSua(goc.id, bodyLenh) : suaKeHoachLenhQt(phanInId, goc.id, bodyLenh))
        : await suaKeHoachTamQt(phanInId, goc.id, { ...chung, soLuong: f.soLuong === '' ? null : Number(f.soLuong) });
      show(r.message || 'Đã sửa kế hoạch');
      onDone();
    } catch (e) { show(e.message || 'Sửa kế hoạch thất bại', 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!muc} onClose={onClose} size="md"
      title={laLenh ? `Sửa kế hoạch — lệnh ${goc.ma_lenh_san_xuat}` : `Sửa kế hoạch tạm — đợt ${goc.ma_dot_vai}`}
      footer={(
        <>
          <Button chiXemOk variant="secondary" onClick={onClose}>Đóng</Button>
          <Button loading={busy} disabled={busy || dangTai || slSai || !String(f.lyDo).trim() || (!laLenh && !f.chuyenId)} onClick={luu}>Lưu kế hoạch</Button>
        </>
      )}>
      <div className="space-y-3">
        {daChay && (
          <p className="rounded-control bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            Lệnh đã xác nhận chạy — chỉ sửa THÔNG TIN kế hoạch (chuyền KH, ngày, giờ, SL release, thợ in KH). Máy đang chạy thật của
            phiếu không đổi (muốn chuyển máy dùng "Đổi chuyền" ở Xác nhận chạy). SL release không được thấp hơn SL đã in.
          </p>
        )}
        <Field label="Chuyền kế hoạch" required={!laLenh}>
          <ChuyenPicker chuyen={dsChuyen} value={f.chuyenId} onChange={(id) => set('chuyenId', id)} />
        </Field>
        <Field label="Ngày sản xuất kế hoạch" required>
          <Input type="date" value={f.ngayKeHoach} onChange={(e) => set('ngayKeHoach', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giờ bắt đầu"><TimeSelect value={f.gioBd} onChange={(v) => set('gioBd', v)} minuteStep={5} /></Field>
          <Field label="Giờ kết thúc"><TimeSelect value={f.gioKt} onChange={(v) => set('gioKt', v)} minuteStep={5} /></Field>
        </div>
        {laLenh ? (
          dangTai ? <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner size={16} />Đang tải đợt vải…</div> : dsDot.length > 0 && (
            <div className="space-y-2 rounded-control border border-line bg-surface-muted/40 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
                <span>Số lượng release{dsDot.length > 1 ? ` (${dsDot.length} đợt vải)` : ''}</span>
                <span className="tabular-nums">Tổng: {fmtNum(tongSl)}</span>
              </div>
              {dsDot.map((d) => (
                <div key={d.dot_vai_id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate text-ink">{d.ma_dot_vai}</div>
                    <div className="truncate text-ink-soft">
                      {dsDot.length > 1 ? `${d.ma_phan} · ` : ''}vải về {fmtNum(d.so_luong_vai_ve)}
                      {d.da_release_khac > 0 ? ` · lệnh khác giữ ${fmtNum(d.da_release_khac)}` : ''} · tối đa {fmtNum(d.toi_da)}
                    </div>
                  </div>
                  <div className="w-28 shrink-0">
                    <Input type="number" min={1} max={d.toi_da} value={f.slRelease[d.dot_vai_id] ?? ''}
                      onChange={(e) => setF((x) => ({ ...x, slRelease: { ...x.slRelease, [d.dot_vai_id]: e.target.value } }))} />
                  </div>
                </div>
              ))}
              {slSai && <div className="text-xs font-medium text-danger">Có đợt để trống hoặc vượt mức tối đa.</div>}
            </div>
          )
        ) : (
          <Field label="Số lượng release dự kiến">
            <Input type="number" min={1} value={f.soLuong} onChange={(e) => set('soLuong', e.target.value)} />
          </Field>
        )}
        <Field label="Thợ in kế hoạch">
          <NhieuNguoiSelect value={f.thoIn} onChange={(v) => set('thoIn', v)} options={users} placeholder="Gõ tên hoặc MSNV để tìm rồi chọn / Enter..." />
        </Field>
        <Field label="Lý do" required hint={laLenh ? 'Lưu xong hệ thống báo lại kế hoạch lệnh sang ERP' : undefined}>
          <Textarea rows={2} value={f.lyDo} onChange={(e) => set('lyDo', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Modal LÙI VỀ TRẠM: chọn đích ⇒ xem trước danh sách bước (API xemTruoc) ⇒ lý do ⇒ chạy ───────────
export function LuiVeModal({ phanInId, lenh, dichList, onClose, onDone, show }) {
  const [dich, setDich] = useState('');
  const [ke, setKe] = useState(null);
  const [dangXem, setDangXem] = useState(false);
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);
  const [kq, setKq] = useState(null);
  useEffect(() => { setDich(''); setKe(null); setLyDo(''); setKq(null); }, [lenh]);
  useEffect(() => {
    if (!lenh || !dich) { setKe(null); return undefined; }
    let song = true;
    setDangXem(true);
    luiVeTram(phanInId, lenh.id, { dich, xemTruoc: true })
      .then((r) => { if (song) setKe(r.data); })
      .catch((e) => { if (song) { setKe(null); show(e.message || 'Không dựng được kế hoạch', 'error'); } })
      .finally(() => { if (song) setDangXem(false); });
    return () => { song = false; };
  }, [phanInId, lenh, dich, show]);

  const chay = async () => {
    if (!String(lyDo).trim()) { show('Nhập lý do', 'error'); return; }
    setBusy(true);
    try {
      const r = await luiVeTram(phanInId, lenh.id, { dich, lyDo });
      setKq(r.data);
      if (r.data?.loi) show(r.message, 'error'); else { show(r.message || 'Đã lùi'); onDone(); }
    } catch (e) { show(e.message || 'Lùi thất bại', 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!lenh} onClose={onClose} size="lg" title={`Lùi về trạm — lệnh ${lenh?.ma_lenh_san_xuat || ''}`}
      footer={(
        <>
          <Button chiXemOk variant="secondary" onClick={onClose}>Đóng</Button>
          <Button variant="danger" loading={busy} disabled={!ke || ke.dich !== dich || !ke.buoc?.length || busy || (kq && !kq.loi)} onClick={chay}>
            {ke?.buoc?.length ? `Chạy ${ke.buoc.length} bước` : 'Không có gì để hủy'}
          </Button>
        </>
      )}>
      <div className="space-y-3">
        <div className="rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          Đang: <b className="text-ink">{TEN_TT_LENH[lenh?.trang_thai] || lenh?.trang_thai}</b>. Hệ thống hủy lần lượt từ bước SAU CÙNG ngược về,
          mỗi bước dùng đúng nút Hủy của màn tương ứng (guard + báo ERP hủy). Lỗi ở bước nào thì dừng ở đó.
        </div>
        <Field label="Đưa về" required>
          <div className="grid gap-2 sm:grid-cols-2">
            {(dichList || []).map((o) => (
              <label key={o.v} className={`flex cursor-pointer items-start gap-2 rounded-control border px-3 py-2 hover:bg-surface-muted ${dich === o.v ? 'border-primary' : 'border-line'}`}>
                <input type="radio" name="dich-lui" className="mt-1" checked={dich === o.v} onChange={() => setDich(o.v)} />
                <span>
                  <span className="block text-sm font-medium text-ink">{o.ten}</span>
                  <span className="block text-xs text-ink-soft">{o.mo_ta}</span>
                </span>
              </label>
            ))}
          </div>
        </Field>
        {dich && (
          <div className="rounded-control border border-line">
            <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">
              {dangXem || !ke || ke.dich !== dich ? 'Đang dựng kế hoạch…' : `Các bước sẽ chạy (${ke.buoc?.length || 0})`}
            </div>
            {(ke?.canh_bao || []).map((c) => <div key={c} className="border-b border-line bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">⚠ {c}</div>)}
            <ol className="max-h-64 list-decimal space-y-0.5 overflow-auto py-2 pl-8 pr-3 text-sm">
              {(ke?.buoc || []).map((b, i) => {
                const xong = kq && kq.xong && i < kq.xong.length;
                const loi = kq && kq.loi && i === kq.xong.length;
                return (
                  <li key={`${b.loai}-${b.id}-${i}`} className={xong ? 'text-emerald-600' : loi ? 'font-semibold text-danger' : 'text-ink'}>
                    {b.nhan}{xong ? ' ✓' : ''}{loi ? ` — ${kq.loi.message}` : ''}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        <Field label="Lý do" required hint="Bắt buộc — ghi vào nhật ký của từng bước hủy">
          <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Modal HỦY LẺ 1 bản ghi (lý do bắt buộc) ─────────────────────────────────
export function HuyLeModal({ phanInId, viec, onClose, onDone, show }) {
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLyDo(''); }, [viec]);
  const lam = async () => {
    if (!String(lyDo).trim()) { show('Nhập lý do', 'error'); return; }
    setBusy(true);
    try { await huyLeQt(phanInId, { loai: viec.loai, id: viec.id, lyDo }); show('Đã thực hiện'); onDone(); }
    catch (e) { show(e.message || 'Không thực hiện được', 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!viec} onClose={onClose} size="sm" title={viec?.nhan || ''}
      footer={(
        <>
          <Button chiXemOk variant="secondary" onClick={onClose}>Đóng</Button>
          <Button variant="danger" loading={busy} disabled={!String(lyDo).trim()} onClick={lam}>Xác nhận</Button>
        </>
      )}>
      <p className="mb-3 text-sm text-ink-soft">Dùng đúng nút của màn tương ứng — bị chặn nếu bước sau đã đi tiếp (hủy bước sau trước).</p>
      <Field label="Lý do" required><Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)} /></Field>
    </Modal>
  );
}

// ─── Modal PHÂN CÔNG 1 phiếu (sửa / xóa). Phiếu đang chạy ⇒ áp luật phân công đầu ca theo chuyền. ─────
export function PhanCongModal({ phanInId, phieu, users, toIns, onClose, onDone, show }) {
  const [f, setF] = useState({ caTruongId: '', chuyenTruong: '', thoIn: '', toInId: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (phieu) setF({ caTruongId: phieu.ca_truong_id || '', chuyenTruong: phieu.chuyen_truong || '', thoIn: phieu.tho_in || '', toInId: phieu.to_in_id || '' });
  }, [phieu]);
  const luu = async (body) => {
    setBusy(true);
    try { await luuPhanCongQt(phanInId, phieu.id, body); show('Đã lưu phân công'); onDone(); }
    catch (e) { show(e.message || 'Lưu thất bại', 'error'); } finally { setBusy(false); }
  };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal open={!!phieu} onClose={onClose} size="md" title={`Phân công — phiếu ${phieu?.ma_phieu_san_xuat || ''}`}
      footer={(
        <>
          <Button chiXemOk variant="secondary" onClick={onClose}>Đóng</Button>
          <Button variant="danger" disabled={busy} onClick={() => luu({ caTruongId: null, chuyenTruong: '', thoIn: '', toInId: null })}>Xóa phân công</Button>
          <Button loading={busy} onClick={() => luu({ ...f, caTruongId: f.caTruongId || null, toInId: f.toInId || null })}>Lưu</Button>
        </>
      )}>
      <div className="space-y-3">
        {phieu?.trang_thai === 'DANG_CHAY' && (
          <p className="rounded-control bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            Phiếu đang chạy ⇒ lưu ở đây là phân công ĐẦU CA của chuyền: áp luôn cho các lệnh đang chạy cùng chuyền trong ca.
          </p>
        )}
        <Field label="Ca trưởng">
          <SearchableSelect value={f.caTruongId} onChange={(v) => set('caTruongId', v)} options={users}
            getValue={(u) => u.id} getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''} placeholder="Gõ tên để tìm..." />
        </Field>
        <Field label="Chuyền trưởng">
          <SearchableSelect chapNhanTuDo value={f.chuyenTruong} onChange={(v) => set('chuyenTruong', v)} options={users}
            getValue={(u) => u.ho_ten || u.ten_dang_nhap || ''} getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''} placeholder="Gõ tên để tìm..." />
        </Field>
        <Field label="Thợ in">
          <NhieuNguoiSelect value={f.thoIn} onChange={(v) => set('thoIn', v)} options={users} placeholder="Gõ tên thợ in rồi chọn / Enter..." />
        </Field>
        {toIns.length > 0 && (
          <Field label="Tổ in">
            <SearchableSelect moNgay value={f.toInId} onChange={(v) => set('toInId', v)} options={toIns}
              getValue={(t) => t.id} getLabel={(t) => `${t.ma_to} — ${t.ten_to}`} placeholder="Chọn tổ in..." />
          </Field>
        )}
      </div>
    </Modal>
  );
}
