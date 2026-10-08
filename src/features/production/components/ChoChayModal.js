import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../../components/common/Modal';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import GomBadge from '../../../components/common/GomBadge';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import ChipTabs from '../../../components/common/ChipTabs';
import DateRangePicker from '../../../components/common/DateRangePicker';
import { Field, Input } from '../../../components/common/controls';
import { slaRowClass } from '../../../utils/sla';
import { fmtNum, fmtDate } from '../../../utils/format';
import { LOAI_TABS, nhanChip, demChip } from '../../../utils/khuChuyen';
import exportCheckpointExcel, { COT_LENH, moTaBoLoc } from '../../../utils/exportCheckpointExcel';
import { locLenhChay, coLoc, LOC_TRONG, timLenhTheoMa, chonLenhDeTich, khoaPinLenh } from '../utils/locLenhChay';

// Trần số lệnh 1 lần xác nhận chạy — gương BE `production.service TOI_DA_CHAY_MOT_LUOT`.
export const TOI_DA_CHAY_MOT_LUOT = 100;
// Máy cảm ứng KHÔNG tự đặt con trỏ (bật bàn phím ảo che màn hình) — cùng luật `hooks/useOTimKiem`.
const LA_CAM_UNG = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(pointer: coarse)').matches : false;

// ─────────────────────────────────────────────────────────────────────────────
// PANEL LỌC dùng chung bảng *Đang chạy* (trang) và modal *Chờ chạy* — 6 ô phần in + ô chuyền.
// ─────────────────────────────────────────────────────────────────────────────
export function LocLenhPanel({ loc, setLoc, chuyen }) {
  const o = (k, nhan, ph) => (
    <Field label={nhan}>
      <Input value={loc[k]} onChange={(e) => setLoc({ ...loc, [k]: e.target.value })} placeholder={ph} />
    </Field>
  );
  return (
    <div className="mb-3 rounded-card border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        {o('khach', 'Khách hàng', 'Lọc khách...')}
        {o('don', 'Đơn hàng', 'Lọc đơn...')}
        {o('maHang', 'Mã hàng', 'Lọc mã hàng...')}
        {o('mauVai', 'Màu vải', 'Lọc màu...')}
        {o('kichVai', 'Kích vải', 'Lọc kích vải...')}
        {o('kichPhim', 'Kích phim', 'Lọc kích phim...')}
        <Field label="Chuyền">
          <select value={loc.chuyenId} onChange={(e) => setLoc({ ...loc, chuyenId: e.target.value })}
            className="h-9 w-full rounded-input border border-line bg-surface px-2 text-sm">
            <option value="">Tất cả chuyền</option>
            {(chuyen || []).map((c) => <option key={c.id} value={c.id}>{c.ten_chuyen || c.ma_chuyen}</option>)}
          </select>
        </Field>
      </div>
      {coLoc(loc) && (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={() => setLoc(LOC_TRONG)} className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-danger">
            <Icon name="x" size={14} /> Xóa lọc
          </button>
        </div>
      )}
    </div>
  );
}

// Lệnh GOM SET → tách 1 dòng / phần in (cột mức lệnh `merge`).
const subRows = (r) => (r.phan_in_list ? r.phan_in_list.map((p) => ({ ...p, __sub: true })) : null);

// ─────────────────────────────────────────────────────────────────────────────
// MODAL "CHỜ CHẠY" (01/10/2026) — trước là bảng thứ hai ngay dưới *Đang chạy*; người dùng muốn trang gọn
// ⇒ chuyển vào modal mở từ nút "Chờ chạy (N)". Bộ lọc RIÊNG của modal (ô tìm + 7 ô + chip + ngày SX KH),
// không dính bộ lọc bảng Đang chạy. Nút Xác nhận chạy / Trả về KT gọi ngược ra trang (modal xác nhận ở đó).
// ─────────────────────────────────────────────────────────────────────────────
// `onTraVeGn` (06/10/2026): thông tin phần in SAI ⇒ trả Giao nhận sửa; lệnh GIỮ NGUYÊN, tạm rời Chờ chạy.
//
// ⚠⚠ TÍCH NHIỀU + QUÉT LIÊN TỤC (08/10/2026, người dùng chốt): mở modal ⇒ con trỏ nằm sẵn ở ô tìm; đầu đọc mã
//   vạch gõ mã + Enter ⇒ lệnh khớp được TÍCH và đưa LÊN ĐẦU bảng, ô tìm tự xóa, con trỏ ở lại ô ⇒ quét tiếp;
//   bấm "Xác nhận chạy (N)" ở chân modal ⇒ trang mở hộp xác nhận + gọi `POST /production/start-batch`.
//   · Luật khớp/chọn lệnh: `utils/locLenhChay.js timLenhTheoMa` + `chonLenhDeTich` (KHÔNG đoán khi mã khớp
//     lệnh của nhiều phần in ⇒ bảng chỉ còn các lệnh đó, chip "Đang lọc theo mã" để người dùng tự tích).
//   · Danh sách tích (`chon` = mảng id lệnh, mới tích đứng đầu) + lỗi chạy từng lệnh (`loiChay`) do TRANG giữ
//     — đóng modal không mất, trang gỡ dòng đã chạy được và giữ dòng lỗi.
//   · Dòng đã tích LUÔN hiện ở đầu bảng, kể cả khi bộ lọc/chip/ngày đang loại nó (quét không phụ thuộc bộ lọc).
//   · `datConTro` (số đếm) — trang tăng khi hộp xác nhận đóng mà chưa chạy ⇒ con trỏ quay lại ô tìm.
export default function ChoChayModal({
  open, onClose, rows, loading, chuyen, canRun, statusLenh, onConfirm, onTraVe, onTraVeGn,
  chon = [], setChon, loiChay = {}, onToast, onChayNhieu, datConTro = 0,
}) {
  const [search, setSearch] = useState('');
  const [loc, setLoc] = useState(LOC_TRONG);
  const [moLoc, setMoLoc] = useState(false);
  const [loai, setLoai] = useState('');
  const [ngay, setNgay] = useState({ from: '', to: '' });
  const [locQuet, setLocQuet] = useState(null); // { ma, ids:Set } — mã quét khớp lệnh của nhiều phần in
  const oTimRef = useRef(null);
  const henRef = useRef([]);
  const toast = useCallback((m, t) => { if (onToast) onToast(m, t); }, [onToast]);

  // Đặt con trỏ vào ô tìm ở vài nhịp: Headless UI tự focus phần tử đầu tiên lúc mở / trả focus về nút
  // đã mở hộp con khi nó đóng — xảy ra SAU lúc đổi state.
  const datConTroTim = useCallback(() => {
    if (LA_CAM_UNG) return;
    henRef.current.forEach(clearTimeout);
    henRef.current = [0, 120, 350].map((ms) => setTimeout(() => {
      const el = oTimRef.current;
      if (!el || !el.isConnected || document.activeElement === el) return;
      try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
    }, ms));
  }, []);
  useEffect(() => { if (open) datConTroTim(); }, [open, datConTroTim]);
  useEffect(() => { if (open && datConTro) datConTroTim(); }, [datConTro, open, datConTroTim]);
  useEffect(() => () => henRef.current.forEach(clearTimeout), []);
  useEffect(() => { if (!open) setLocQuet(null); }, [open]);

  const chonSet = useMemo(() => new Set(chon), [chon]);
  const theoId = useMemo(() => new Map((rows || []).map((r) => [r.id, r])), [rows]);
  // Dòng đã tích còn trong danh sách chờ chạy (lệnh người khác vừa chạy / hủy thì tự rơi ra).
  const daChon = useMemo(() => chon.map((id) => theoId.get(id)).filter(Boolean), [chon, theoId]);

  const hien = useMemo(
    () => locLenhChay(rows, { search, loc, chuyen, loai, ngay: [{ cot: 'ngay_ke_hoach', ...ngay }] }),
    [rows, search, loc, chuyen, ngay, loai]
  );
  // Bảng = [đã tích (mới nhất trên cùng)] + [phần còn lại theo bộ lọc]; có "lọc theo mã quét" thì phần còn lại
  // chỉ là các lệnh mã đó khớp (bỏ qua bộ lọc khác — quét tìm trên TOÀN BỘ danh sách).
  const bang = useMemo(() => {
    const nen = locQuet ? (rows || []).filter((r) => locQuet.ids.has(r.id)) : hien;
    return [...daChon, ...nen.filter((r) => !chonSet.has(r.id))];
  }, [locQuet, rows, hien, daChon, chonSet]);

  const dat = useCallback((ids) => setChon && setChon(ids), [setChon]);
  const tichLenh = useCallback((r) => {
    if (chonSet.has(r.id)) { dat([r.id, ...chon.filter((x) => x !== r.id)]); return true; }
    if (chon.length >= TOI_DA_CHAY_MOT_LUOT) {
      toast(`Tối đa ${TOI_DA_CHAY_MOT_LUOT} lệnh mỗi lần xác nhận chạy`, 'error');
      return false;
    }
    dat([r.id, ...chon]);
    return true;
  }, [chon, chonSet, dat, toast]);
  const doiTich = (r) => {
    if (chonSet.has(r.id)) dat(chon.filter((x) => x !== r.id));
    else tichLenh(r);
    datConTroTim(); // bấm ô tích xong ⇒ con trỏ về ô tìm cho lần quét kế
  };

  // ENTER ở ô tìm = 1 lần quét.
  const quet = () => {
    const ma = search.trim();
    if (!ma || !canRun) return;
    const { luot, ds } = timLenhTheoMa(rows, ma);
    const kq = chonLenhDeTich(ds, chonSet);
    setSearch('');
    datConTroTim();
    if (kq.kieu === 'KHONG') {
      setLocQuet(null);
      toast(`Không có lệnh chờ chạy nào khớp «${ma}»`, 'error');
      return;
    }
    if (kq.kieu === 'NHIEU') {
      const soPin = new Set(ds.map(khoaPinLenh)).size;
      setLocQuet({ ma, ids: new Set(ds.map((r) => r.id)) });
      toast(`«${ma}» khớp ${ds.length} lệnh của ${soPin} phần in${luot === 2 ? ' (mã HSKT dùng chung)' : ''} — tích tay dòng cần chạy`, 'info');
      return;
    }
    setLocQuet(null);
    const ten = `${kq.lenh.ma_lenh_san_xuat || ''}${kq.lenh.ma_phan ? ` · ${kq.lenh.ma_phan}` : ''}`;
    if (kq.kieu === 'DA_TICH') {
      tichLenh(kq.lenh);
      toast(`${ten} đã tích rồi`, 'info');
      return;
    }
    if (tichLenh(kq.lenh)) {
      toast(`Đã tích ${ten}${kq.conLai ? ` — phần in còn ${kq.conLai} lệnh chờ chạy khác, quét lại để tích tiếp` : ''}`);
    }
  };
  // Số trên chip = tập đã qua mọi bộ lọc TRỪ chính chip.
  const soChip = useMemo(
    () => demChip(locLenhChay(rows, { search, loc, chuyen, boChip: true, ngay: [{ cot: 'ngay_ke_hoach', ...ngay }] })),
    [rows, search, loc, chuyen, ngay]
  );

  const selChuyen = (chuyen || []).find((x) => x.id === loc.chuyenId);
  const doExcel = () => exportCheckpointExcel({
    cols: [...COT_LENH, { header: 'Đã in trước đó', width: 13, num: true, value: (r) => r.da_in_truoc || null }],
    rows: hien, title: 'Đang chờ chạy', fileName: 'cho-chay',
    moTaLoc: moTaBoLoc({
      'tìm kiếm': search, khách: loc.khach, đơn: loc.don, 'mã hàng': loc.maHang, 'màu vải': loc.mauVai,
      'kích vải': loc.kichVai, 'kích phim': loc.kichPhim, chuyền: selChuyen ? (selChuyen.ten_chuyen || selChuyen.ma_chuyen) : '',
      'loại chuyền': nhanChip(loai), 'ngày SX kế hoạch': [ngay.from, ngay.to].filter(Boolean).join(' → '),
    }),
  });

  const cols = [
    ...(canRun ? [{ key: 'chon', header: '', selection: true, render: (r) => (
      <input type="checkbox" className="h-4 w-4 cursor-pointer accent-primary" aria-label="Tích để xác nhận chạy"
        checked={chonSet.has(r.id)} onChange={() => doiTich(r)} />
    ) }] : []),
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => (
      <div>
        <div className="text-ink">{r.ma_hang || '—'}</div>
        {!r.__sub && loiChay[r.id] && <Badge tone="danger">Chưa chạy được: {loiChay[r.id]}</Badge>}
        {!r.__sub && r.giai_doan === 'EP_UI' && <Badge tone="info">Ép ủi (in kiếng)</Badge>}
        {!r.__sub && <GomBadge soDotVai={r.so_dot_vai} soPhanIn={r.so_phan_in} />}
        {!r.__sub && Number(r.da_in_truoc) > 0 && (
          <div className="mt-0.5">
            <Badge tone="warning">
              Đã in {fmtNum(r.da_in_truoc)}{r.tg_ngung ? ` · ngừng ${new Date(r.tg_ngung).toLocaleString('vi-VN')}` : ''} → in tiếp
            </Badge>
          </div>
        )}
      </div>
    ) },
    { key: 'ma_phan', header: 'Code phần', render: (r) => r.ma_phan || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'ma_chuyen', header: 'Chuyền', merge: true, render: (r) => r.ten_chuyen || '—' },
    { key: 'nha_gia_cong', header: 'Nhà gia công', merge: true, render: (r) => r.nha_gia_cong || '—' },
    { key: 'so_luong_release', header: 'SL release', className: 'text-right tabular-nums', merge: true, render: (r) => fmtNum(r.so_luong_release) },
    { key: 'ngay_ke_hoach', header: 'Ngày SX KH', merge: true, render: (r) => fmtDate(r.ngay_ke_hoach) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => fmtDate(r.han_giao_hang) },
    { key: 'actions', header: '', className: 'text-right whitespace-nowrap', merge: true, render: (r) =>
      canRun && (
        <div className="flex flex-col items-stretch gap-1">
          <Button className="px-2.5 py-1 text-xs" onClick={() => onConfirm(r)}>Xác nhận chạy</Button>
          <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => onTraVe(r)}>Trả về Kỹ thuật</Button>
          {onTraVeGn && (
            <Button variant="secondary" className="px-2.5 py-1 text-xs text-danger" onClick={() => onTraVeGn(r)}>Trả về GN</Button>
          )}
        </div>
      ) },
  ];

  // Đã tích: nền xanh nhạt — trừ khi đang nghẽn/sắp nghẽn (giữ màu SLA, sắp phải nhập lý do).
  const lopDong = (r) => slaRowClass(statusLenh(r.id)) || (chonSet.has(r.id) ? 'bg-primary/5' : '');

  const chanModal = canRun && (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-ink-soft">
        {daChon.length ? <>Đã tích <b className="text-ink">{fmtNum(daChon.length)}</b> lệnh</> : 'Chưa tích lệnh nào'}
      </span>
      <div className="flex flex-wrap gap-2">
        {daChon.length > 0 && (
          <Button variant="ghost" onClick={() => { dat([]); datConTroTim(); }}>Bỏ tích hết</Button>
        )}
        <Button icon="play" disabled={!daChon.length} onClick={() => onChayNhieu && onChayNhieu(daChon)}>
          Xác nhận chạy ({fmtNum(daChon.length)})
        </Button>
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} size="full" canhTren={8} lapDay footer={chanModal}
      title={`Chờ chạy (${hien.length}${hien.length !== (rows || []).length ? `/${(rows || []).length}` : ''})`}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[16rem] flex-1">
            <Input ref={oTimRef} data-autofocus value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quet(); } }}
              placeholder={canRun
                ? 'Quét mã vạch TDTHĐH / HSKT hoặc gõ mã rồi Enter để tích — gõ để tìm mã lệnh, code phần, mã hàng, màu/kích, đơn...'
                : 'Tìm mã lệnh, code phần, mã vạch TDTHĐH / HSKT, mã hàng, màu/kích, đơn...'} />
          </div>
          <DateRangePicker value={ngay} onChange={setNgay} placeholder="Ngày SX kế hoạch" />
          <Button chiXemOk variant={moLoc || coLoc(loc) ? 'secondary' : 'ghost'} icon="filter" onClick={() => setMoLoc((v) => !v)}>
            Bộ lọc{coLoc(loc) ? ' ●' : ''}
          </Button>
          <Button chiXemOk variant="secondary" icon="download" onClick={doExcel} disabled={!hien.length}>
            Excel ({hien.length})
          </Button>
        </div>
        {moLoc && <LocLenhPanel loc={loc} setLoc={setLoc} chuyen={chuyen} />}
        <ChipTabs tabs={LOAI_TABS} value={loai} counts={soChip} onChange={setLoai} />
        {locQuet && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-control border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm text-ink">
            <span>Mã <b>{locQuet.ma}</b> khớp {fmtNum(locQuet.ids.size)} lệnh của nhiều phần in</span>
            <button type="button" onClick={() => { setLocQuet(null); datConTroTim(); }}
              className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-danger">
              <Icon name="x" size={14} /> Bỏ lọc
            </button>
          </div>
        )}
        <div className="mt-2 min-h-0 flex-1 overflow-auto">
          <DataTable columns={cols} rows={bang} loading={loading} sttStart={0}
            subRows={subRows} rowClassName={lopDong}
            emptyText="Không có lệnh nào chờ chạy" />
        </div>
      </div>
    </Modal>
  );
}
