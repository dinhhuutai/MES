import { useCallback, useEffect, useMemo, useState } from 'react';
import useLyDoNghen from '../../hooks/useLyDoNghen';
import useChiXem from '../../hooks/useChiXem';
import ChipTabs from './ChipTabs';
import { listLyDoNghen } from '../../services/lyDoNghenService';
import { doNghen, dungMapLyDo, timLyDo, khoaMacDinh } from '../../utils/nghen';
import Modal from './Modal';
import Button from './Button';
import Badge from './Badge';
import Icon from './Icon';
import Toast from './Toast';
import useToast from '../../hooks/useToast';
import useNow from '../../hooks/useNow';
import exportPanelExcel from './exportPanelExcel';
import { fmtDur } from '../../utils/sla';
import { khop } from '../../utils/timKiem';
import { fmtDate, fmtDateTime } from '../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// "DANH SÁCH NGHẼN" — modal dùng chung cho 12 màn xác nhận (màn nào có dải "Theo dõi" thì có nút).
// Liệt kê ĐÚNG những hàng đang NGHẼN (quá SLA) CỦA CHÍNH MÀN ĐÓ.
//
// ⚠⚠ NGUỒN LÀ `rows` MÀN ĐÃ TẢI + ĐÚNG BIỂU THỨC SLA MÀN ĐANG DÙNG ĐỂ TÔ ĐỎ HÀNG (`trangThai`),
//   CỐ Ý KHÔNG viết endpoint đếm nghẽn riêng. Lý do: 12 màn này chia làm 2 họ tính SLA khác nhau —
//     · họ `evalSla(r.tg_vao, r.sla_phut, …)`  (READY · QC READY · KCS · Sửa · OQC · Giao)
//     · họ `useNghenMap` (`statusLenh`/`statusDot`, nguồn dashboard `flowRows`)
//   Viết query riêng thì gần như chắc chắn ra tập KHÁC với các hàng đang đỏ trên bảng ⇒ đúng họ lỗi
//   "2 con số trên cùng màn hình đá nhau". Lấy thẳng vị từ của trang thì khớp **theo cấu tạo**.
//
// ⚠ Mặc định CHỈ liệt kê `NGHEN` (quá SLA) — người dùng chốt 18/08/2026. Prop `loai="SAP_NGHEN"`
//   (25/09/2026) biến chính modal/nút này thành "Cảnh báo" (hàng VÀNG) — dùng ở màn READY Kỹ thuật,
//   cùng vị từ `trangThai` nên nút Cảnh báo và hàng vàng trên bảng luôn khớp nhau.
//
// ⚠ Nhận `rows` ĐẦY ĐỦ của màn (không phải `viewRows` đã lọc): đây là bức tranh nghẽn của cả trạm;
//   muốn thu hẹp thì dùng ô tìm NGAY TRONG modal (giống "Danh sách release").
// ─────────────────────────────────────────────────────────────────────────────

// Bộ cột mặc định — đọc theo tên trường CHUNG của 12 màn, thiếu thì để '—'.
// ⚠ Trang nào có tên trường khác (vd bảng theo tem) thì truyền `cols` riêng.
const COT_MAC_DINH = [
  { key: 'ten_khach_hang', header: 'Khách hàng' },
  { key: 'ma_don_hang', header: 'Đơn hàng' },
  { key: 'ma_hang', header: 'Mã hàng' },
  { key: 'ma_phan', header: 'Code phần' },
  { key: 'mau_vai', header: 'Màu vải' },
  { key: 'kich_vai', header: 'Kích vải' },
  { key: 'kich_phim', header: 'Kích phim' },
  { key: 'ten_chuyen', header: 'Chuyền' },
  { key: 'han_giao_hang', header: 'Hạn giao', kieu: 'ngay' },
];

// Nhãn/màu theo loại danh sách.
const LOAI = {
  NGHEN: { ten: 'nghẽn', tieuDe: 'Danh sách nghẽn', tone: 'danger', nut: 'Nghẽn', nen: 'bg-rose-50/60 dark:bg-rose-950/20',
    moTa: <>Chỉ liệt kê mục <b className="text-danger">đã quá SLA</b> của màn này — đúng những hàng đang tô đỏ trên bảng. Sắp xếp theo mức quá hạn nặng nhất trước.</>,
    rong: 'Không có mục nào đang nghẽn ở màn này 🎉' },
  SAP_NGHEN: { ten: 'cảnh báo', tieuDe: 'Danh sách cảnh báo', tone: 'warning', nut: 'Cảnh báo', nen: 'bg-amber-50/60 dark:bg-amber-950/20',
    moTa: <>Chỉ liệt kê mục <b className="text-warning">sắp quá SLA</b> (đang tô vàng trên bảng). Sắp xếp theo mục sắp tới hạn nhất trước.</>,
    rong: 'Không có mục nào đang cảnh báo ở màn này.' },
};

const oGiaTri = (r, c) => {
  const v = typeof c.value === 'function' ? c.value(r) : r[c.key];
  if (v === undefined || v === null || v === '') return '';
  return c.kieu === 'ngay' ? fmtDate(v) : String(v);
};

export default function NghenListModal({
  open, onClose, tenMan = '', rows = [], trangThai, cols = COT_MAC_DINH, tenFile = 'danh-sach-nghen', loai = 'NGHEN',
  // 26/09/2026 — "nghẽn bao lâu + lý do nghẽn":
  //   · `maTrang` (mã màn, vd KT_READY) — có thì tải + ghi LÝ DO NGHẼN (mig 106).
  //   · `khoa(r)`  — khóa đối tượng để khớp lý do (mặc định đọc tên trường chung, `utils/nghen`).
  //   · `thoiGian(r)` — {phut, sla} cho họ `useNghenMap` (hàng không mang `tg_vao`/`sla_phut`).
  maTrang = '', khoa = khoaMacDinh, thoiGian,
  // 26/09/2026 — màn có dải chip LOẠI CHUYỀN / KHU (Test Run · Release 2 · Xác nhận chạy): modal có
  //   CÙNG dải chip, mở ra đã chọn sẵn chip trang đang đứng (`chipMacDinh`). `hopChip(r, v)` = đúng
  //   vị từ lọc chip của trang. Không truyền `chipTabs` ⇒ không có dải chip (màn khác y như cũ).
  chipTabs = null, chipMacDinh = '', hopChip,
}) {
  const [chip, setChip] = useState(chipMacDinh);
  useEffect(() => { if (open) setChip(chipMacDinh); }, [open, chipMacDinh]);
  const L = LOAI[loai] || LOAI.NGHEN;
  const laCanhBao = loai === 'SAP_NGHEN';
  const coLyDo = !!maTrang && !laCanhBao;
  const chiXem = useChiXem();
  const { toast, show } = useToast();
  const now = useNow(30000); // đồng hồ chậm: bảng này không cần nhảy từng giây
  const [tim, setTim] = useState('');
  const [xuat, setXuat] = useState(false);
  const [lyDoMap, setLyDoMap] = useState(() => new Map());
  const taiLyDo = useCallback(async () => {
    if (!coLyDo) return;
    try {
      const r = await listLyDoNghen({ maTrang });
      setLyDoMap(dungMapLyDo(r.data?.items || []));
    } catch { /* phần thêm — lỗi thì bảng vẫn hiện, chỉ thiếu cột lý do */ }
  }, [coLyDo, maTrang]);
  useEffect(() => { if (open) taiLyDo(); }, [open, taiLyDo]);
  const { hoiLyDoNghen, lyDoNghenModal } = useLyDoNghen({ maTrang, trangThai, khoa, thoiGian });
  const ghiLyDo = async (r) => {
    const ok = await hoiLyDoNghen([r], { batBuoc: true, hanhDong: 'GHI_TAY', lyDoMacDinh: r._lyDo?.ly_do || '' });
    if (ok) { show('Đã lưu lý do nghẽn'); taiLyDo(); }
  };

  // Hàng NGHẼN + số phút đã ở / quá hạn (luật chung `utils/nghen.doNghen`): hàng mang `tg_vao` +
  // `sla_phut` tự tính; họ `useNghenMap` lấy qua `thoiGian(r)`. Không có dữ kiện ⇒ cột thời gian ẩn.
  const dsNghen = useMemo(() => {
    const ds = (rows || []).filter((r) => trangThai && trangThai(r) === loai);
    const tinh = ds.map((r) => {
      const d = doNghen(r, thoiGian, now);
      return {
        ...r, _phut: d ? d.phut : null, _qua: d ? d.qua : null, _sla: d ? d.sla : null, _batDau: d ? d.batDau : null,
        _lyDo: coLyDo ? timLyDo(lyDoMap, khoa(r)) : null,
      };
    });
    // Nghẽn: quá hạn NẶNG NHẤT lên đầu · Cảnh báo: SẮP tới hạn nhất (còn ít phút nhất) lên đầu.
    return laCanhBao
      ? tinh.sort((a, b) => (b._qua ?? -Infinity) - (a._qua ?? -Infinity))
      : tinh.sort((a, b) => (b._qua ?? -1) - (a._qua ?? -1));
    // ⚠ `thoiGian`/`khoa` là hàm nội tuyến của trang (đổi mỗi render) — CỐ Ý không đưa vào deps; bảng
    //   vẫn tính lại theo `now` (30s) + `rows`, đủ tươi. Đưa vào deps là tính lại mỗi lần cha render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, trangThai, now, loai, laCanhBao, lyDoMap, coLyDo]);

  const coThoiGian = dsNghen.some((r) => r._phut != null);

  // Dải chip loại chuyền/khu: số trên chip = số mục nghẽn của chip đó (trước ô tìm).
  const coChip = !!(chipTabs && hopChip);
  const demChipNghen = useMemo(() => {
    if (!coChip) return {};
    const m = {};
    chipTabs.forEach((t) => { m[t.v] = t.v ? dsNghen.filter((r) => hopChip(r, t.v)).length : dsNghen.length; });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsNghen, coChip, chipTabs]);
  const dsTheoChip = useMemo(
    () => (coChip && chip ? dsNghen.filter((r) => hopChip(r, chip)) : dsNghen),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dsNghen, coChip, chip]
  );

  // Ô tìm quét mọi cột đang hiện — tìm KHÔNG DẤU (utils/timKiem).
  const ds = useMemo(() => {
    if (!tim.trim()) return dsTheoChip;
    return dsTheoChip.filter((r) => cols.some((c) => khop(oGiaTri(r, c), tim)));
  }, [dsTheoChip, tim, cols]);

  const doXuat = async () => {
    setXuat(true);
    try {
      await exportPanelExcel({
        title: `${L.tieuDe.toUpperCase()} — ${tenMan}`,
        subtitle: `${ds.length} mục ${laCanhBao ? 'sắp quá SLA' : 'quá SLA'} · xuất ${new Date().toLocaleString('vi-VN')}`
          + (tim.trim() ? ` · tìm "${tim.trim()}"` : ''),
        fileName: tenFile,
        // ⚠⚠ BẮT BUỘC truyền `rows` — thiếu là `exportPanelExcel` lấy mặc định [] ⇒ file chỉ có tiêu đề,
        //   KHÔNG báo lỗi gì (lỗi thật 25/09/2026: Excel của cả 12 màn nghẽn đều rỗng).
        rows: ds,
        cols: [
          ...cols.map((c) => ({
            header: c.header,
            type: c.kieu === 'ngay' ? 'date' : undefined,
            value: (r) => (c.kieu === 'ngay' ? r[c.key] : oGiaTri(r, c)),
          })),
          ...(coThoiGian ? [
            { header: 'Đã ở (phút)', num: true, value: (r) => r._phut },
            { header: 'SLA (phút)', num: true, value: (r) => r._sla || null },
            ...(laCanhBao ? [] : [{ header: 'Nghẽn từ', width: 18, value: (r) => (r._batDau ? fmtDateTime(r._batDau) : '') }]),
            laCanhBao
              ? { header: 'Còn lại tới đỏ (phút)', num: true, value: (r) => (r._qua != null ? -r._qua : null) }
              : { header: 'Nghẽn bao lâu (phút)', num: true, value: (r) => r._qua, red: () => true },
          ] : []),
          ...(coLyDo ? [
            { header: 'Lý do nghẽn', width: 40, value: (r) => r._lyDo?.ly_do || '' },
            { header: 'Người ghi lý do', width: 20, value: (r) => r._lyDo?.nguoi || '' },
          ] : []),
        ],
      });
    } catch (e) {
      show(e.message || 'Không xuất được Excel', 'error');
    } finally { setXuat(false); }
  };

  return (
    <>
      {/* `lapDay` = modal cao cố định, thân KHÔNG tự cuộn — bắt buộc với modal có BẢNG, nếu không
          sẽ có 2 thanh cuộn lồng nhau và khối đầu trôi mất khi kéo bảng. */}
      <Modal open={open} onClose={onClose} size="full" lapDay
        title={`${L.tieuDe}${tenMan ? ` — ${tenMan}` : ''}`}>
        <div className="flex h-full flex-col">
          <div className="shrink-0 space-y-3 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={L.tone}>{ds.length} mục đang {L.ten}</Badge>
              {tim.trim() && dsTheoChip.length !== ds.length && (
                <span className="text-xs text-ink-soft">({dsTheoChip.length} tổng, đang tìm)</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Icon name="search" size={14}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                  <input
                    value={tim}
                    onChange={(e) => setTim(e.target.value)}
                    placeholder="Tìm khách, mã hàng, code phần, chuyền..."
                    className="h-9 w-72 rounded-control border border-line bg-surface pl-8 pr-2 text-base outline-none focus:border-primary md:text-sm"
                  />
                </div>
                <Button variant="secondary" icon="file-spreadsheet" chiXemOk loading={xuat}
                  onClick={doXuat} disabled={!ds.length}>Excel ({ds.length})</Button>
              </div>
            </div>
            <p className="text-xs text-ink-soft">{L.moTa}</p>
            {coChip && (
              <div className="-mb-4">
                <ChipTabs tabs={chipTabs} value={chip} counts={demChipNghen} onChange={setChip} />
              </div>
            )}
          </div>

          {/* ⚠ `min-h-0` BẮT BUỘC: thiếu là bảng dài đẩy phồng ra ngoài modal thay vì cuộn trong. */}
          <div className="min-h-[10rem] flex-1 overflow-auto rounded-card border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-muted">
                <tr>
                  <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-ink-soft">STT</th>
                  {cols.map((c) => (
                    <th key={c.key || c.header}
                      className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-ink-soft">{c.header}</th>
                  ))}
                  {coThoiGian && (
                    <>
                      <th className="whitespace-nowrap px-2 py-2 text-right text-xs font-semibold text-ink-soft">Đã ở</th>
                      <th className="whitespace-nowrap px-2 py-2 text-right text-xs font-semibold text-ink-soft">SLA</th>
                      {!laCanhBao && <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-ink-soft">Nghẽn từ</th>}
                      <th className="whitespace-nowrap px-2 py-2 text-right text-xs font-semibold text-ink-soft">{laCanhBao ? 'Còn lại' : 'Nghẽn bao lâu'}</th>
                    </>
                  )}
                  {coLyDo && <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-ink-soft">Lý do nghẽn</th>}
                </tr>
              </thead>
              <tbody>
                {ds.map((r, i) => (
                  <tr key={r.id || r.tem_id || r.lenh_id || r.dot_vai_id || i}
                    className={`border-t border-line align-top ${L.nen}`}>
                    <td className="px-2 py-1.5 tabular-nums text-ink-soft">{i + 1}</td>
                    {cols.map((c) => (
                      <td key={c.key || c.header} className="px-2 py-1.5">
                        {oGiaTri(r, c) || <span className="text-ink-soft">—</span>}
                      </td>
                    ))}
                    {coThoiGian && (
                      <>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{fmtDur(r._phut)}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-ink-soft">
                          {r._sla ? fmtDur(r._sla) : '—'}
                        </td>
                        {!laCanhBao && (
                          <td className="whitespace-nowrap px-2 py-1.5 text-xs">{r._batDau ? fmtDateTime(r._batDau) : '—'}</td>
                        )}
                        <td className={`whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums ${laCanhBao ? 'text-warning' : 'text-danger'}`}>
                          {r._qua == null ? '—' : laCanhBao ? fmtDur(Math.max(0, -r._qua)) : `+${fmtDur(r._qua)}`}
                        </td>
                      </>
                    )}
                    {coLyDo && (
                      <td className="min-w-[14rem] px-2 py-1.5 text-xs">
                        {r._lyDo ? (
                          <div>
                            <div className="text-ink">{r._lyDo.ly_do}</div>
                            <div className="text-[11px] text-ink-soft">{r._lyDo.nguoi || '—'} · {fmtDateTime(r._lyDo.created_date)}</div>
                          </div>
                        ) : <span className="text-ink-soft">Chưa có</span>}
                        <button type="button" className="mt-0.5 text-[11px] font-semibold text-primary hover:underline disabled:opacity-40"
                          disabled={chiXem} onClick={() => ghiLyDo(r)}>
                          {r._lyDo ? 'Sửa lý do' : '+ Ghi lý do'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!ds.length && (
                  <tr>
                    <td colSpan={cols.length + 1 + (coThoiGian ? (laCanhBao ? 3 : 4) : 0) + (coLyDo ? 1 : 0)}
                      className="px-3 py-10 text-center text-sm text-ink-soft">
                      {dsTheoChip.length
                        ? 'Không có mục nào khớp từ khóa tìm.'
                        : dsNghen.length ? `Không có mục ${L.ten} ở loại chuyền / khu này.` : L.rong}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
      {lyDoNghenModal}
      <Toast toast={toast} />
    </>
  );
}

// Nút mở "Danh sách nghẽn" + số đếm. Hiện số ĐỎ khi có hàng nghẽn để nhìn là thấy ngay.
// ⚠ Đếm bằng CHÍNH `trangThai` của trang ⇒ số trên nút luôn khớp số dòng trong modal.
export function NghenButton({ rows = [], trangThai, onClick, loai = 'NGHEN' }) {
  const L = LOAI[loai] || LOAI.NGHEN;
  const n = useMemo(
    () => (rows || []).filter((r) => trangThai && trangThai(r) === loai).length,
    [rows, trangThai, loai]
  );
  return (
    <Button variant={n ? 'secondary' : 'ghost'} icon={loai === 'SAP_NGHEN' ? 'clock' : 'alert-triangle'} chiXemOk onClick={onClick}
      className={n ? (loai === 'SAP_NGHEN' ? 'text-warning' : 'text-danger') : undefined}>
      {L.nut}{n ? ` (${n})` : ''}
    </Button>
  );
}
