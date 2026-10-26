import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import Spinner from '../../../components/common/Spinner';
import ChipTabs from '../../../components/common/ChipTabs';
import SearchableSelect from '../../../components/common/SearchableSelect';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import useChiXem from '../../../hooks/useChiXem';
import usePermissions from '../../../hooks/usePermissions';
import useSocketReload from '../../../hooks/useSocketReload';
import DateRangePicker from '../../../components/common/DateRangePicker';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import { Input } from '../../../components/common/controls';
import { fmtNum, ngayLocalISO } from '../../../utils/format';
import { khopTungTu } from '../../../utils/timKiem';
import {
  getDsReleaseSx, getNhatKyIn, luuDongDsReleaseSx, getChuyenThemDsRelease, luuChuyenThemDsRelease, listChuyen,
} from '../../../services/productionService';
import {
  COT_DS_RELEASE_SX, COT_NHAT_KY_IN, LOC_DS_RELEASE, tieuDeNhom, locDsRelease, tongDsRelease, tongNhatKy, tongDong, clDong,
  ganTruongLoc, chuoiTim, TABS_DS_RELEASE, hopChipDs, demChipDs, nhanChipDs,
} from '../utils/dsReleaseSx';
import exportDsReleaseSx from '../utils/exportDsReleaseSx';

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH RELEASE CỦA SẢN XUẤT (26/10/2026, người dùng gửi mẫu "DANH SÁCH RELEASE BÀN 10/26/2026") — nút ở màn
// *Xác nhận chạy*. ⚠ 26/10/2026 chiều (người dùng: "lấy theo ngày là ngày in tem"): theo khoảng NGÀY IN TEM — lệnh có
//   tem gốc in trong khoảng (backend `dsReleaseSx`; SL IN = tem in trong kỳ, SL ĐÃ IN = in trước kỳ).
//   · Nút chuyển **Danh sách release / Nhật ký in** — Nhật ký in = 1 dòng / tem in trong kỳ, cột theo mẫu ERP "DANH SÁCH
//     NHẬT KÝ IN" (`COT_NHAT_KY_IN`). Chip khu, chuyền thêm, ô tìm, bộ lọc áp CHUNG cho cả hai.
//   · Ô tìm (không dấu, khớp từng từ) + Bộ lọc trường (Code phần · Khách · Đơn/PO · Mã hàng · Màu · Chuyền · Thợ · Lệnh).
//   · Chip KHU / loại chuyền (`LOAI_TABS`) + "Thêm chuyền" vào khu đang xem (vd khu Máy thêm Bàn 10A) — danh sách chuyền
//     thêm LƯU RIÊNG từng người theo từng chip (`/production/ds-release/chuyen-them`), lần sau mở là có; bấm ✕ để bỏ.
//   · DM + TEST và Ghi chú NHẬP TAY ngay trên bảng (lưu khi rời ô, theo lệnh × phần in). Tổng = SL IN + vải hư + vải
//     thiếu + DM+TEST · CL = Tổng − SL release.
//   · Excel = đúng các dòng đang hiện (kể cả chuyền thêm) — `exportDsReleaseSx`.
// ─────────────────────────────────────────────────────────────────────────────

const ngayHien = (iso) => String(iso || '').split('-').reverse().join('/');
const CHE_DO = [
  { v: 'RELEASE', label: 'Danh sách release' },
  { v: 'NHAT_KY', label: 'Nhật ký in' },
];
// Chú thích ô (rê chuột): `tip` của cột, hoặc phần do script hệ thống tạo, không thì chính giá trị.
const tieuDeO = (c, r) => {
  if (c.ht && c.ht(r) > 0) {
    return `${c.value(r)} — trong đó ${c.ht(r)} pcs do script hệ thống "chạy đến giao" ghi (tem HT-), không phải tem in thật`;
  }
  return c.tip ? c.tip(r) : String(c.value(r) ?? '');
};
const docLs = (k, md) => { try { return localStorage.getItem(k) || md; } catch { return md; } };
const ghiLs = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };

// Ô nhập tay — giữ chữ đang gõ, lưu khi rời ô / Enter nếu khác giá trị cũ.
function ONhap({ giaTri, kieu, onLuu, khoa }) {
  const [v, setV] = useState(giaTri == null ? '' : String(giaTri));
  useEffect(() => { setV(giaTri == null ? '' : String(giaTri)); }, [giaTri]);
  const luu = () => { if (v.trim() !== (giaTri == null ? '' : String(giaTri))) onLuu(v.trim()); };
  return (
    <input value={v} disabled={khoa} onChange={(e) => setV(kieu === 'so' ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}
      onBlur={luu} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      inputMode={kieu === 'so' ? 'numeric' : undefined}
      className={`w-full rounded border border-line bg-surface px-1.5 py-1 text-xs outline-none focus:border-primary disabled:bg-surface-muted ${kieu === 'so' ? 'text-right tabular-nums' : ''}`} />
  );
}

export default function DsReleaseSxModal({ open, onClose }) {
  const { toast, show } = useToast();
  const chiXem = useChiXem();
  const { can } = usePermissions();
  const ghiDuoc = !chiXem && can('PROD_RUN');
  // Khoảng NGÀY IN TEM — mặc định hôm nay; chỉ chọn 1 ngày (chưa có "đến") ⇒ đúng ngày đó.
  const [khoang, setKhoang] = useState(() => { const h = ngayLocalISO(new Date()); return { from: h, to: h }; });
  const ngay = khoang.from || ngayLocalISO(new Date());
  const denNgay = khoang.to || ngay;
  const [cheDo, setCheDo] = useState(() => docLs('dsrsx.cheDo', 'RELEASE'));
  const nhatKy = cheDo === 'NHAT_KY';
  const [items, setItems] = useState([]);          // Danh sách release (lệnh × phần in)
  const [tems, setTems] = useState([]);            // Nhật ký in (tem)
  const [dangTai, setDangTai] = useState(false);
  const [chip, setChip] = useState(() => docLs('dsrsx.chip', 'MAY'));
  const [them, setThem] = useState([]);            // mã chuyền thêm vào khu đang xem
  const [dsChuyen, setDsChuyen] = useState([]);
  const [dangXuat, setDangXuat] = useState(false);
  const [tim, setTim] = useState('');
  const [loc, setLoc] = useState({});
  const [moLoc, setMoLoc] = useState(false);

  // Chỉ tải nguồn của chế độ đang xem (Nhật ký in tải khi bấm sang).
  const tai = useCallback(async (ngam = false) => {
    if (!open) return;
    if (!ngam) setDangTai(true);
    try {
      if (nhatKy) {
        const r = await getNhatKyIn(ngay, denNgay);
        setTems(((r.data && r.data.items) || []).map(ganTruongLoc));
      } else {
        const r = await getDsReleaseSx(ngay, denNgay);
        setItems(((r.data && r.data.items) || []).map(ganTruongLoc));
      }
    } catch (e) { if (!ngam) show(e.message || (nhatKy ? 'Không tải được nhật ký in' : 'Không tải được danh sách release'), 'error'); }
    finally { if (!ngam) setDangTai(false); }
  }, [open, ngay, denNgay, nhatKy, show]);
  useEffect(() => { tai(); }, [tai]);
  useSocketReload(['production:updated'], () => { if (open) tai(true); }, 1500);

  useEffect(() => {
    if (!open) return;
    listChuyen().then((r) => setDsChuyen((r.data || []).filter((c) => c.ma_loai_chuyen !== 'GIA_CONG'))).catch(() => setDsChuyen([]));
  }, [open]);
  // Chuyền thêm đã lưu của khu đang chọn.
  useEffect(() => {
    if (!open) return;
    getChuyenThemDsRelease(chip).then((r) => setThem(r.data || [])).catch(() => setThem([]));
  }, [open, chip]);

  const doiChip = (v) => { setChip(v); ghiLs('dsrsx.chip', v); };
  const doiCheDo = (v) => { setCheDo(v); ghiLs('dsrsx.cheDo', v); };
  const luuThem = async (ds) => {
    setThem(ds);
    try { await luuChuyenThemDsRelease(chip, ds); } catch (e) { show(e.message || 'Không lưu được chuyền thêm', 'error'); }
  };

  // Ô tìm + bộ lọc trường — áp chung 2 chế độ; số trên chip tính SAU tìm/lọc (chip không tự áp chính nó).
  const nguon = nhatKy ? tems : items;
  const daLoc = useMemo(() => {
    const t = tim.trim();
    const quaTim = t ? nguon.filter((r) => khopTungTu(chuoiTim(r), t)) : nguon;
    return filterRows(quaTim, loc, LOC_DS_RELEASE);
  }, [nguon, tim, loc]);
  const rows = useMemo(() => locDsRelease(daLoc, chip, them), [daLoc, chip, them]);
  const tong = useMemo(() => tongDsRelease(rows), [rows]);
  const tongNk = useMemo(() => tongNhatKy(rows), [rows]);
  const counts = useMemo(() => demChipDs(daLoc), [daLoc]);
  const soLoc = Object.values(loc).filter(Boolean).length;
  const cols = nhatKy ? COT_NHAT_KY_IN : COT_DS_RELEASE_SX;
  // Chuyền chọn thêm được = chuyền KHÔNG thuộc chip đang xem và chưa thêm.
  const chuyenChon = useMemo(() => dsChuyen
    .filter((c) => !them.includes(c.ma_chuyen) && !hopChipDs({ ma_chuyen: c.ma_chuyen, ma_loai_chuyen: c.ma_loai_chuyen }, chip))
    .map((c) => ({ id: c.ma_chuyen, label: `${c.ma_chuyen}${c.ten_chuyen && c.ten_chuyen !== c.ma_chuyen ? ` · ${c.ten_chuyen}` : ''}` })), [dsChuyen, them, chip]);
  const khu = `${(nhanChipDs(chip) || 'TẤT CẢ').toUpperCase()}${them.length ? ` + ${them.join(', ')}` : ''}`;
  const ngayTieuDe = denNgay !== ngay ? `${ngayHien(ngay)} – ${ngayHien(denNgay)}` : ngayHien(ngay);
  const tieuDe = nhatKy ? `DANH SÁCH NHẬT KÝ IN ${khu}` : `DANH SÁCH RELEASE ${khu} ${ngayTieuDe}`;

  const luuDong = async (r, truong, v) => {
    const body = { lenhId: r.lenh_id, phanInId: r.phan_in_id, [truong]: v === '' ? null : (truong === 'dmTest' ? Number(v) : v) };
    try {
      const res = await luuDongDsReleaseSx(body);
      const d = res.data || {};
      // Chỉ cập nhật ĐÚNG trường vừa lưu — 2 lượt lưu liền nhau (DM+TEST rồi Ghi chú) có thể về không theo thứ tự.
      const capNhat = truong === 'dmTest' ? { dm_test: d.dm_test ?? null } : { ghi_chu_sx: d.ghi_chu ?? null };
      setItems((ds) => ds.map((x) => (x.lenh_id === r.lenh_id && x.phan_in_id === r.phan_in_id ? { ...x, ...capNhat } : x)));
    } catch (e) { show(e.message || 'Không lưu được', 'error'); }
  };

  const xuat = async () => {
    setDangXuat(true);
    try { await exportDsReleaseSx(rows, { tieuDe, ngay, denNgay, cheDo }); } catch (e) { show(e.message || 'Xuất Excel thất bại', 'error'); }
    finally { setDangXuat(false); }
  };

  const nhom = tieuDeNhom(cols);
  const th = 'border border-line bg-[#e2efda] px-1.5 py-1 text-[11px] font-semibold text-ink dark:bg-emerald-950/40';
  const o = (c, r) => {
    if (nhatKy) { const v = c.value(r); return c.num && typeof v === 'number' ? fmtNum(v) : v; }
    if (c.key === 'dm_test') return <ONhap giaTri={r.dm_test} kieu="so" khoa={!ghiDuoc} onLuu={(v) => luuDong(r, 'dmTest', v)} />;
    if (c.key === 'ghi_chu') return <ONhap giaTri={r.ghi_chu_sx} khoa={!ghiDuoc} onLuu={(v) => luuDong(r, 'ghiChu', v)} />;
    const v = c.value(r);
    if (c.key === 'tong') return fmtNum(tongDong(r));
    // Số có phần do script "chạy đến giao" tạo (tem HT-, không phải tem in thật) ⇒ dấu * màu cam.
    if (c.ht && c.ht(r) > 0) return <span>{fmtNum(v)}<span className="ml-0.5 font-bold text-amber-600">*</span></span>;
    if (c.key === 'cl') { const cl = clDong(r); return cl ? <span className={cl < 0 ? 'text-danger' : 'text-success'}>{cl > 0 ? `+${fmtNum(cl)}` : fmtNum(cl)}</span> : '-'; }
    return c.num && typeof v === 'number' ? fmtNum(v) : v;
  };

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay title="Danh sách release sản xuất">
      <div className="shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Danh sách release ⇄ Nhật ký in (26/10/2026). */}
          <div className="inline-flex rounded-full border border-line bg-surface-muted p-0.5" role="tablist" aria-label="Chế độ xem">
            {CHE_DO.map((x) => (
              <button key={x.v} type="button" role="tab" aria-selected={cheDo === x.v} onClick={() => doiCheDo(x.v)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${cheDo === x.v ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink'}`}>
                {x.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink-soft">Ngày in tem</span>
            <DateRangePicker value={khoang} placeholder="Ngày in tem"
              onChange={({ from, to }) => setKhoang({ from: from || ngayLocalISO(new Date()), to: to || '' })} />
          </div>
          <div className="w-64">
            <Input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm code phần / mã tem / lệnh / mã hàng..." />
          </div>
          <FilterToggle open={moLoc} count={soLoc} onClick={() => setMoLoc((v) => !v)} />
          <div className="ml-auto flex items-center gap-2">
            <Button chiXemOk variant="secondary" icon="download" loading={dangXuat} disabled={!rows.length} onClick={xuat}>
              Xuất Excel ({fmtNum(rows.length)})
            </Button>
          </div>
        </div>
        <FieldFilters fields={LOC_DS_RELEASE} values={loc} open={moLoc}
          onField={(k, v) => setLoc((s) => ({ ...s, [k]: v }))} onClear={() => setLoc({})} />
        <ChipTabs tabs={TABS_DS_RELEASE} value={chip} counts={counts} onChange={doiChip} />
        {/* Chuyền THÊM vào khu đang xem — lưu riêng từng người theo chip. */}
        <div className="-mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">Thêm chuyền vào danh sách:</span>
          {them.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-2.5 py-0.5 text-xs font-semibold text-primary">
              {m}
              <button type="button" aria-label={`Bỏ chuyền ${m}`} onClick={() => luuThem(them.filter((x) => x !== m))}
                className="text-primary/70 hover:text-danger"><Icon name="x" size={12} /></button>
            </span>
          ))}
          <div className="w-60">
            <SearchableSelect value="" options={chuyenChon} getValue={(x) => x.id} getLabel={(x) => x.label}
              getSearch={(x) => x.label} placeholder="+ Chọn chuyền thêm…" emptyLabel="— Chọn chuyền —"
              onChange={(ma) => { if (ma) luuThem([...them, ma]); }} />
          </div>
        </div>
        <div className="text-center text-base font-bold text-ink">{tieuDe}</div>
        {nhatKy ? (
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-ink-soft">
            <span>Từ ngày <b className="text-ink">{ngayHien(ngay)}</b> đến ngày <b className="text-ink">{ngayHien(denNgay)}</b></span>
            <span>Số tem <b className="text-ink">{fmtNum(tongNk.so_tem)}</b></span>
            <span>Số code phần <b className="text-ink">{fmtNum(tongNk.so_phan)}</b></span>
            <span className="rounded bg-amber-100 px-1.5 dark:bg-amber-900/40">SL in <b className="text-ink">{fmtNum(tongNk.sl_in)}</b></span>
            <span>Vải hư <b className="text-ink">{fmtNum(tongNk.vai_hu)}</b></span>
            <span>Vải thiếu <b className="text-ink">{fmtNum(tongNk.vai_thieu)}</b></span>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-ink-soft">
            <span>Tổng đơn release <b className="text-ink">{fmtNum(tong.tong_don)}</b></span>
            <span>Tổng mã release <b className="text-ink">{fmtNum(tong.tong_ma)}</b></span>
            <span>Tổng phần release <b className="text-ink">{fmtNum(tong.tong_phan)}</b></span>
            <span>SL release <b className="text-ink">{fmtNum(tong.sl_release)}</b></span>
            <span className="rounded bg-amber-100 px-1.5 dark:bg-amber-900/40">SL in <b className="text-ink">{fmtNum(tong.sl_in)}</b></span>
          </div>
        )}
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-card border border-line">
        {dangTai && !nguon.length ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : !rows.length ? (
          <div className="py-16 text-center text-sm text-ink-soft">
            {tim.trim() || soLoc ? 'Không có dòng khớp ô tìm / bộ lọc.'
              : `Không có ${nhatKy ? 'tem nào' : 'lệnh nào có tem'} in ngày ${ngayTieuDe} ở khu này.`}
          </div>
        ) : (
          <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                {nhom.map((h) => (
                  <th key={h.nhan + h.tuCot} colSpan={h.colSpan} rowSpan={h.rowSpan} className={`${th} text-center`}>{h.nhan}</th>
                ))}
              </tr>
              <tr>
                {cols.filter((c) => c.nhom).map((c) => <th key={c.key} className={`${th} text-center`}>{c.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={nhatKy ? r.id : `${r.lenh_id}|${r.phan_in_id}`} className="hover:bg-surface-muted/40">
                  {cols.map((c) => (
                    <td key={c.key} title={c.nhap ? '' : tieuDeO(c, r)}
                      className={`border-b border-r border-line/60 px-1.5 py-1 align-middle ${c.num ? 'text-right tabular-nums' : ''} ${c.key === 'tong' ? 'bg-indigo-50 font-semibold dark:bg-indigo-950/30' : ''} ${c.key === 'ma' ? 'max-w-[16rem] whitespace-normal' : 'whitespace-nowrap'} ${c.key === 'dm_test' ? 'w-20' : ''} ${c.key === 'ghi_chu' ? 'min-w-[14rem]' : ''}`}>
                      {o(c, r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Toast toast={toast} />
    </Modal>
  );
}
