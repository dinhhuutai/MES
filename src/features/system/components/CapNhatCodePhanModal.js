import { useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { Field, Textarea } from '../../../components/common/controls';
import { xemTruocCodePhan, capNhatCodePhan } from '../../../services/erpService';
import { fmtNum, ngayLocalISO } from '../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// CẬP NHẬT LẠI DỮ LIỆU THEO CODE PHẦN + NGÀY TỪ ERP (21/09/2026) — Hệ thống › Đồng bộ ERP.
//
// 2 BƯỚC BẮT BUỘC: (1) Xem trước — gọi ERP, CHỈ ĐỌC, liệt kê MỌI dòng ERP của từng code phần kèm
// hiện trạng trong MES; (2) Cập nhật — người dùng CHỌN dòng ERP làm chuẩn, backend chạy lại nguyên
// luồng đồng bộ cho đúng các code phần đó rồi GÁN LẠI đơn hàng / mã hàng theo dòng đã chọn.
//
// ⚠ Vì sao cần: job 5 phút KHÔNG BAO GIỜ đổi đơn/mã hàng của phần in đã có ⇒ code phần mà ERP gửi
//   ở 2 đơn khác nhau bị giữ mãi đơn của dòng ĐẦU TIÊN (đo prod 20/09: 19 code phần).
// ─────────────────────────────────────────────────────────────────────────────

const SO_SANH = [
  ['khach', 'ma_khach_hang', 'Khách'],
  ['don_hang', 'ma_don_hang', 'Đơn hàng'],
  ['ma_hang', 'ma_hang', 'Mã hàng'],
  ['mau_vai', 'mau_vai', 'Màu vải'],
  ['kich_vai', 'kich_vai', 'Kích vải'],
  ['kich_phim', 'kich_phim', 'Kích phim'],
  ['so_luong_don_hang', 'so_luong_don_hang', 'SLĐH'],
  ['tinh_chat_in', 'tinh_chat_in', 'Tính chất in'],
  ['ddh_sub_id', 'ddh_sub_id', 'DDHSUBID'],
];
const PA = { 0: 'Chưa xác định', 1: 'Bàn', 2: 'Máy', 3: 'Robot' };
const s = (v) => (v == null || v === '' ? '' : String(v));
const ngayVN = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

export default function CapNhatCodePhanModal({ open, onClose, onDone, show }) {
  const [codes, setCodes] = useState('');
  const [ngay, setNgay] = useState(() => ngayLocalISO(new Date()));
  const [busy, setBusy] = useState(false);
  const [kq, setKq] = useState(null);          // kết quả xem trước
  const [chon, setChon] = useState({});        // { code: key dòng ERP }
  const [hoi, setHoi] = useState(false);
  const [xong, setXong] = useState(null);      // kết quả cập nhật

  const dong = () => { setKq(null); setChon({}); setXong(null); onClose(); };

  const doXemTruoc = async () => {
    setBusy(true); setXong(null);
    try {
      const res = await xemTruocCodePhan(codes, ngay);
      setKq(res.data);
      setChon(Object.fromEntries((res.data.items || []).filter((i) => i.chon_mac_dinh).map((i) => [i.code, i.chon_mac_dinh])));
    } catch (e) { show(e.message || 'Xem trước thất bại', 'error'); }
    setBusy(false);
  };

  const doCapNhat = async () => {
    setHoi(false); setBusy(true);
    try {
      const res = await capNhatCodePhan(kq.token, chon);
      setXong(res.data); setKq(null);
      show(res.message || 'Đã cập nhật');
      onDone?.();
    } catch (e) { show(e.message || 'Cập nhật thất bại', 'error'); }
    setBusy(false);
  };

  const soChon = Object.keys(chon).length;

  return (
    <Modal open={open} onClose={dong} size="full" lapDay
      title="Cập nhật lại dữ liệu theo code phần + ngày (ERP)"
      footer={
        <>
          <span className="mr-auto text-xs text-ink-soft">
            {kq ? `${kq.items.length} code phần · ERP trả ${fmtNum(kq.tong_erp)} dòng từ ${ngayVN(kq.ngay)} · phiên xem trước hết hạn sau ${kq.het_han_phut} phút`
              : 'Bấm Xem trước — bước này CHỈ ĐỌC, chưa ghi gì.'}
          </span>
          <Button chiXemOk variant="ghost" onClick={dong}>Đóng</Button>
          {kq && <Button loading={busy} disabled={!kq.items.length} onClick={() => setHoi(true)}>Cập nhật ({kq.items.length} code phần)</Button>}
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="shrink-0 space-y-3">
          <div className="rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            Chạy lại đồng bộ ERP cho <b>đúng các code phần nhập bên dưới</b> (từ ngày đã chọn tới hiện tại) và
            <b> GÁN LẠI đơn hàng / mã hàng</b> theo dòng ERP bạn chọn. ⚠ Mỗi code phần chỉ có <b>1 phần in thuộc
            1 đơn</b> trong MES — đợt vải của dòng ERP thuộc đơn khác vẫn nằm trong phần in này. Mọi thay đổi ghi
            audit <code>ERP_CAP_NHAT_CODE_PHAN</code> kèm giá trị cũ.
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_12rem_auto] md:items-end">
            <Field label="Code phần (ngăn bằng dấu phẩy / xuống dòng, tối đa 50)">
              <Textarea rows={2} value={codes} onChange={(e) => setCodes(e.target.value)}
                placeholder="DK-2609-008-A01-F03-C01, DK-2609-011-A01-F03-C01" />
            </Field>
            <Field label="Lấy ERP từ ngày">
              <input type="date" value={ngay} max={ngayLocalISO(new Date())} onChange={(e) => setNgay(e.target.value)}
                className="h-11 w-full rounded-input border border-line bg-surface px-3 text-base outline-none focus:border-primary md:text-sm" />
            </Field>
            <div className="pb-0.5">
              <Button icon="search" loading={busy && !kq} disabled={!codes.trim() || !ngay} onClick={doXemTruoc}>Xem trước</Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto">
          {xong && (
            <div className="rounded-card border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="font-medium text-emerald-800 dark:text-emerald-200">
                Đã cập nhật: {xong.soMoi} đợt vải mới · {xong.soCapNhat} cập nhật · {xong.soLoi} lỗi
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {(xong.ghi_de || []).map((g) => (
                  <li key={g.ma}>
                    <b>{g.ma}</b>: {g.doi
                      ? <>đơn <s className="text-ink-soft">{g.cu?.don_hang}</s> → <b>{g.moi?.don_hang}</b> · mã hàng <s className="text-ink-soft">{g.cu?.ma_hang}</s> → <b>{g.moi?.ma_hang}</b></>
                      : (g.ly_do || 'đơn/mã hàng không đổi (đã cập nhật quy cách)')}
                  </li>
                ))}
                {(xong.loi || []).map((l) => <li key={l} className="text-danger">{l}</li>)}
              </ul>
            </div>
          )}

          {kq && kq.items.map((it) => {
            const ht = it.hien_tai;
            const dc = it.dong_erp.find((d) => d.key === chon[it.code]);
            return (
              <div key={it.code} className="rounded-card border border-line bg-surface p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{it.code}</span>
                  {ht ? <Badge tone="info">Có trong MES</Badge> : <Badge tone="warning">Chưa có trong MES</Badge>}
                  <Badge tone="default">{it.dong_erp.length} dòng ERP</Badge>
                  {ht && <span className="text-xs text-ink-soft">{ht.so_dot_vai} đợt vải · {ht.so_lenh} lệnh · {ht.so_tem} tem · PA in {PA[ht.phuong_an_in] ?? '—'}</span>}
                </div>
                {it.canh_bao.length > 0 && (
                  <ul className="mb-2 list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">
                    {it.canh_bao.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                )}

                {ht && dc && (
                  <div className="mb-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-ink-soft">
                        <th className="px-2 py-1 text-left">Trường</th><th className="px-2 py-1 text-left">Đang lưu (MES)</th>
                        <th className="px-2 py-1 text-left">Theo dòng ERP đã chọn</th>
                      </tr></thead>
                      <tbody>
                        {SO_SANH.map(([kErp, kMes, ten]) => {
                          const cu = s(ht[kMes]); const moi = s(dc[kErp]);
                          const doi = cu !== moi && !(kErp === 'tinh_chat_in' && !moi) && !(kErp === 'ddh_sub_id' && !moi);
                          return (
                            <tr key={kErp} className={doi ? 'bg-amber-50 dark:bg-amber-950/30' : ''}>
                              <td className="px-2 py-1 text-ink-soft">{ten}</td>
                              <td className="px-2 py-1">{cu || '—'}</td>
                              <td className={`px-2 py-1 ${doi ? 'font-semibold text-amber-800 dark:text-amber-200' : ''}`}>{moi || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {it.dong_erp.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-line text-ink-soft">
                        <th className="px-2 py-1">Chọn</th><th className="px-2 py-1 text-left">Khách</th>
                        <th className="px-2 py-1 text-left">Đơn hàng</th><th className="px-2 py-1 text-left">Mã hàng</th>
                        <th className="px-2 py-1 text-left">SubID</th><th className="px-2 py-1 text-left">PA in</th>
                        <th className="px-2 py-1 text-left">Loại</th><th className="px-2 py-1 text-right">SL vải</th>
                        <th className="px-2 py-1 text-left">Ngày nhận vải</th><th className="px-2 py-1 text-left">Màu · Kích</th>
                        <th className="px-2 py-1 text-left">Tình trạng</th>
                      </tr></thead>
                      <tbody>
                        {it.dong_erp.map((d) => (
                          <tr key={d.key} className={`border-b border-line/60 ${d.bo_qua ? 'opacity-50' : 'cursor-pointer hover:bg-surface-muted'}`}
                            onClick={() => !d.bo_qua && setChon((m) => ({ ...m, [it.code]: d.key }))}>
                            <td className="px-2 py-1 text-center">
                              <input type="radio" name={`chon-${it.code}`} disabled={d.bo_qua}
                                checked={chon[it.code] === d.key} onChange={() => setChon((m) => ({ ...m, [it.code]: d.key }))} />
                            </td>
                            <td className="px-2 py-1">{d.khach}</td>
                            <td className="px-2 py-1 font-medium">{d.don_hang}</td>
                            <td className="px-2 py-1">{d.ma_hang}</td>
                            <td className="px-2 py-1">{d.ddh_sub_id || '—'}</td>
                            <td className="px-2 py-1">{PA[d.pain] ?? '—'}</td>
                            <td className="px-2 py-1">{d.loaikd || '—'}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{fmtNum(d.so_luong)}</td>
                            <td className="px-2 py-1">{ngayVN(d.ngay_nhan_vai)}</td>
                            <td className="px-2 py-1">{[d.mau_vai, d.kich_vai, d.kich_phim].filter(Boolean).join(' · ')}</td>
                            <td className="px-2 py-1">
                              {d.bo_qua ? <span className="text-danger">{d.ly_do_bo_qua}</span>
                                : d.da_co_trong_mes ? 'Đợt đã có' : <span className="text-emerald-600">Sẽ tạo đợt mới</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog open={hoi} onClose={() => setHoi(false)} onConfirm={doCapNhat} loading={busy}
        variant="danger" confirmText="Cập nhật"
        title="Cập nhật lại theo ERP?"
        message={`Chạy lại đồng bộ cho ${kq?.items.length || 0} code phần và gán lại đơn/mã hàng cho ${soChon} phần in theo dòng ERP đã chọn. Báo cáo cũ của các phần in này sẽ hiện theo đơn MỚI.`} />
    </Modal>
  );
}
