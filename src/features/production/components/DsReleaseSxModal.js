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
import { fmtNum, ngayLocalISO } from '../../../utils/format';
import { LOAI_TABS, demChip, hopChipChuyen, nhanChip } from '../../../utils/khuChuyen';
import {
  getDsReleaseSx, luuDongDsReleaseSx, getChuyenThemDsRelease, luuChuyenThemDsRelease, listChuyen,
} from '../../../services/productionService';
import {
  COT_DS_RELEASE_SX, tieuDeNhom, locDsRelease, tongDsRelease, tongDong, clDong,
} from '../utils/dsReleaseSx';
import exportDsReleaseSx from '../utils/exportDsReleaseSx';

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH RELEASE CỦA SẢN XUẤT (26/10/2026, người dùng gửi mẫu "DANH SÁCH RELEASE BÀN 10/26/2026") — nút ở màn
// *Xác nhận chạy*. Theo NGÀY SX KẾ HOẠCH (cùng tập dòng Danh sách release của Kế hoạch, bỏ chuyền gia công) — CHỈ lệnh
//   ĐÃ XÁC NHẬN CHẠY (có phiếu sản xuất, người dùng chốt 26/10/2026; lọc ở backend).
//   · Chip KHU / loại chuyền (`LOAI_TABS`) + "Thêm chuyền" vào khu đang xem (vd khu Máy thêm Bàn 10A) — danh sách chuyền
//     thêm LƯU RIÊNG từng người theo từng chip (`/production/ds-release/chuyen-them`), lần sau mở là có; bấm ✕ để bỏ.
//   · DM + TEST và Ghi chú NHẬP TAY ngay trên bảng (lưu khi rời ô, theo lệnh × phần in). Tổng = SL IN + vải hư + vải
//     thiếu + DM+TEST · CL = Tổng − SL release.
//   · Excel = đúng các dòng đang hiện (kể cả chuyền thêm) — `exportDsReleaseSx`.
// ─────────────────────────────────────────────────────────────────────────────

const ngayHien = (iso) => String(iso || '').split('-').reverse().join('/');

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
  const [ngay, setNgay] = useState(() => ngayLocalISO(new Date()));
  const [items, setItems] = useState([]);
  const [dangTai, setDangTai] = useState(false);
  const [chip, setChip] = useState(() => { try { return localStorage.getItem('dsrsx.chip') || 'MAY'; } catch { return 'MAY'; } });
  const [them, setThem] = useState([]);            // mã chuyền thêm vào khu đang xem
  const [dsChuyen, setDsChuyen] = useState([]);
  const [dangXuat, setDangXuat] = useState(false);

  const tai = useCallback(async (ngam = false) => {
    if (!open) return;
    if (!ngam) setDangTai(true);
    try {
      const r = await getDsReleaseSx(ngay);
      setItems((r.data && r.data.items) || []);
    } catch (e) { if (!ngam) show(e.message || 'Không tải được danh sách release', 'error'); }
    finally { if (!ngam) setDangTai(false); }
  }, [open, ngay, show]);
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

  const doiChip = (v) => { setChip(v); try { localStorage.setItem('dsrsx.chip', v); } catch { /* bỏ qua */ } };
  const luuThem = async (ds) => {
    setThem(ds);
    try { await luuChuyenThemDsRelease(chip, ds); } catch (e) { show(e.message || 'Không lưu được chuyền thêm', 'error'); }
  };

  const rows = useMemo(() => locDsRelease(items, chip, them), [items, chip, them]);
  const tong = useMemo(() => tongDsRelease(rows), [rows]);
  const counts = useMemo(() => demChip(items), [items]);
  // Chuyền chọn thêm được = chuyền KHÔNG thuộc chip đang xem và chưa thêm.
  const chuyenChon = useMemo(() => dsChuyen
    .filter((c) => !them.includes(c.ma_chuyen) && !hopChipChuyen({ ma_chuyen: c.ma_chuyen, ma_loai_chuyen: c.ma_loai_chuyen }, chip))
    .map((c) => ({ id: c.ma_chuyen, label: `${c.ma_chuyen}${c.ten_chuyen && c.ten_chuyen !== c.ma_chuyen ? ` · ${c.ten_chuyen}` : ''}` })), [dsChuyen, them, chip]);
  const tieuDe = `DANH SÁCH RELEASE ${(nhanChip(chip) || 'TẤT CẢ').toUpperCase()}${them.length ? ` + ${them.join(', ')}` : ''} ${ngayHien(ngay)}`;

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
    try { await exportDsReleaseSx(rows, { tieuDe, ngay }); } catch (e) { show(e.message || 'Xuất Excel thất bại', 'error'); }
    finally { setDangXuat(false); }
  };

  const nhom = tieuDeNhom();
  const th = 'border border-line bg-[#e2efda] px-1.5 py-1 text-[11px] font-semibold text-ink dark:bg-emerald-950/40';
  const o = (c, r) => {
    if (c.key === 'dm_test') return <ONhap giaTri={r.dm_test} kieu="so" khoa={!ghiDuoc} onLuu={(v) => luuDong(r, 'dmTest', v)} />;
    if (c.key === 'ghi_chu') return <ONhap giaTri={r.ghi_chu_sx} khoa={!ghiDuoc} onLuu={(v) => luuDong(r, 'ghiChu', v)} />;
    const v = c.value(r);
    if (c.key === 'tong') return fmtNum(tongDong(r));
    if (c.key === 'cl') { const cl = clDong(r); return cl ? <span className={cl < 0 ? 'text-danger' : 'text-success'}>{cl > 0 ? `+${fmtNum(cl)}` : fmtNum(cl)}</span> : '-'; }
    return c.num && typeof v === 'number' ? fmtNum(v) : v;
  };

  return (
    <Modal open={open} onClose={onClose} size="full" lapDay title="Danh sách release sản xuất">
      <div className="shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-soft">Ngày SX kế hoạch</span>
            <input type="date" value={ngay} onChange={(e) => e.target.value && setNgay(e.target.value)}
              className="h-9 rounded-input border border-line bg-surface px-2 text-sm outline-none focus:border-primary" />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button chiXemOk variant="secondary" icon="download" loading={dangXuat} disabled={!rows.length} onClick={xuat}>
              Xuất Excel ({fmtNum(rows.length)})
            </Button>
          </div>
        </div>
        <ChipTabs tabs={LOAI_TABS} value={chip} counts={counts} onChange={doiChip} />
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
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-ink-soft">
          <span>Tổng đơn release <b className="text-ink">{fmtNum(tong.tong_don)}</b></span>
          <span>Tổng mã release <b className="text-ink">{fmtNum(tong.tong_ma)}</b></span>
          <span>Tổng phần release <b className="text-ink">{fmtNum(tong.tong_phan)}</b></span>
          <span>SL release <b className="text-ink">{fmtNum(tong.sl_release)}</b></span>
          <span className="rounded bg-amber-100 px-1.5 dark:bg-amber-900/40">SL in <b className="text-ink">{fmtNum(tong.sl_in)}</b></span>
        </div>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-card border border-line">
        {dangTai && !items.length ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : !rows.length ? (
          <div className="py-16 text-center text-sm text-ink-soft">Không có lệnh nào kế hoạch ngày {ngayHien(ngay)} đã xác nhận chạy ở khu này.</div>
        ) : (
          <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                {nhom.map((h) => (
                  <th key={h.nhan + h.tuCot} colSpan={h.colSpan} rowSpan={h.rowSpan} className={`${th} text-center`}>{h.nhan}</th>
                ))}
              </tr>
              <tr>
                {COT_DS_RELEASE_SX.filter((c) => c.nhom).map((c) => <th key={c.key} className={`${th} text-center`}>{c.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.lenh_id}|${r.phan_in_id}`} className="hover:bg-surface-muted/40">
                  {COT_DS_RELEASE_SX.map((c) => (
                    <td key={c.key} title={c.nhap ? '' : String(c.value(r) ?? '')}
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
