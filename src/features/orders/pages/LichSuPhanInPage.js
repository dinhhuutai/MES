import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import ChipTabs from '../../../components/common/ChipTabs';
import Spinner from '../../../components/common/Spinner';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import PhuongAnInBadge from '../../../components/common/PhuongAnInBadge';
import useToast from '../../../hooks/useToast';
import useSocketReload from '../../../hooks/useSocketReload';
import { fmtNum } from '../../../utils/format';
import { khopNhieu } from '../../../utils/timKiem';
import { timPhanInLichSu, getLichSuPhanIn } from '../../../services/lichSuPhanInService';
import exportPanelExcel from '../../../components/common/exportPanelExcel';

// ─────────────────────────────────────────────────────────────────────────────
// LỊCH SỬ PHẦN IN (16/11/2026, người dùng: "1 trang xem được toàn bộ lịch sử thao tác của 1 phần in, kể cả tự động thay
//   đổi, bất cứ điều gì thay đổi hay thao tác trả về"). BE `modules/lichsuphanin` gom MỌI nguồn (audit, READY, lệnh, test,
//   phiếu, tem, phơi, KCS / Sửa / OQC, giao, trả về, HSKT, đồng bộ ERP, gửi ERP…) thành 1 dòng thời gian; trang chỉ lọc
//   + hiện. URL `?id=<phần in>` hoặc `?q=<mã>` mở thẳng (link từ Danh sách release / hành trình).
// ─────────────────────────────────────────────────────────────────────────────

const MAU_NHOM = {
  DON_HANG: 'bg-blue-500', READY: 'bg-amber-500', KE_HOACH: 'bg-indigo-500', TEST_RUN: 'bg-violet-500',
  SAN_XUAT: 'bg-emerald-500', CHAT_LUONG: 'bg-teal-500', GIAO_HANG: 'bg-green-600', TRA_VE: 'bg-rose-500',
  ERP: 'bg-slate-400', HE_THONG: 'bg-gray-500',
};
const THU_NGAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const pad = (n) => String(n).padStart(2, '0');
const ngayKhoa = (v) => { const d = new Date(v); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nhanNgay = (v) => { const d = new Date(v); return `${THU_NGAY[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const gio = (v) => { const d = new Date(v); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const ngayGio = (v) => (v ? `${pad(new Date(v).getDate())}/${pad(new Date(v).getMonth() + 1)}/${new Date(v).getFullYear()} ${gio(v)}` : '');
const BUOC = 300; // hiện dần — phần in nhiều tem có thể ra vài nghìn sự kiện
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ô "Chi tiết" — vết gốc (giá trị cũ / mới) dạng JSON gọn.
function VetGoc({ e }) {
  if (!e.cu && !e.moi) return null;
  return (
    <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
      {e.cu && (
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-ink-soft">Trước</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-control bg-surface-muted p-2 text-[11px] text-ink-soft">{JSON.stringify(e.cu, null, 1)}</pre>
        </div>
      )}
      {e.moi && (
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-ink-soft">{e.cu ? 'Sau' : 'Nội dung'}</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-control bg-surface-muted p-2 text-[11px] text-ink-soft">{JSON.stringify(e.moi, null, 1)}</pre>
        </div>
      )}
    </div>
  );
}

const DongSuKien = memo(function DongSuKien({ e, tenNhom }) {
  const [mo, setMo] = useState(false);
  const coVet = !!(e.cu || e.moi);
  return (
    <li className="relative flex gap-3 border-b border-line/60 px-3 py-2.5 last:border-b-0 sm:px-4">
      <div className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-ink-soft sm:w-16">{gio(e.tg)}</div>
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${MAU_NHOM[e.nhom] || 'bg-gray-400'}`} title={tenNhom} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-sm font-medium ${e.loi ? 'text-danger' : 'text-ink'}`}>{e.tieu_de}</span>
          {e.doi_tuong && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft">{e.doi_tuong}</span>}
          {e.tra_ve && <Badge tone="danger">Trả về</Badge>}
          {e.huy && <Badge tone="warning">Hủy</Badge>}
          {e.loi && <Badge tone="danger">Lỗi</Badge>}
          {e.tu_dong && <Badge>Tự động</Badge>}
        </div>
        {e.chi_tiet && <div className="mt-0.5 whitespace-pre-wrap break-words text-xs text-ink-soft">{e.chi_tiet}</div>}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-ink-soft">
          <span className="inline-flex items-center gap-1">
            <Icon name={e.nguoi ? 'user' : 'settings'} size={11} />
            {e.nguoi || (e.tu_dong ? 'Hệ thống' : '—')}
          </span>
          <span>{tenNhom}</span>
          {coVet && (
            <button type="button" onClick={() => setMo((v) => !v)} className="font-medium text-primary hover:underline">
              {mo ? 'Ẩn chi tiết' : 'Chi tiết'}
            </button>
          )}
        </div>
        {mo && <VetGoc e={e} />}
      </div>
    </li>
  );
});

function KetQuaTim({ ds, onChon }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line px-4 py-2 text-xs text-ink-soft">{ds.length > 20 ? 'Hơn 20 phần in khớp — gõ cụ thể hơn' : `${ds.length} phần in khớp — chọn 1 phần in`}</div>
      <ul>
        {ds.slice(0, 20).map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onChon(p.id)}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-line/60 px-4 py-2.5 text-left last:border-b-0 hover:bg-surface-muted">
              <span className="font-medium text-ink">{p.ma_phan}</span>
              {p.mau_in && <span className="text-xs text-ink-soft">mực {p.mau_in}</span>}
              <span className="text-xs text-ink-soft">{[p.ten_khach_hang, p.ma_don_hang, p.ma_hang, p.mau_vai, p.kich_vai, p.kich_phim].filter(Boolean).join(' · ')}</span>
              {!p.dang_hoat_dong && <Badge tone="warning">Đã ẩn / hủy</Badge>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LichSuPhanInPage() {
  const { toast, show } = useToast();
  const [params, setParams] = useSearchParams();
  const idUrl = params.get('id') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const [ketQua, setKetQua] = useState(null); // danh sách tìm
  const [dangTim, setDangTim] = useState(false);
  const [data, setData] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [nhom, setNhom] = useState('');
  const [chiTuDong, setChiTuDong] = useState(false);
  const [chiTraVeHuy, setChiTraVeHuy] = useState(false);
  const [anErp, setAnErp] = useState(false);
  const [tim2, setTim2] = useState('');
  const [cuTruoc, setCuTruoc] = useState(false);
  const [soHien, setSoHien] = useState(BUOC);
  const idRef = useRef(idUrl);
  idRef.current = idUrl;

  const chon = useCallback((id) => {
    setKetQua(null);
    setParams((p) => { const n = new URLSearchParams(p); n.set('id', id); n.delete('q'); return n; });
  }, [setParams]);

  // TÌM: gõ ≥ 3 ký tự, chờ 400 ms. Đúng 1 phần in ⇒ mở luôn. Ô tìm đang là code phần của phần in đang xem ⇒ không tìm.
  const maDangXem = useRef('');
  maDangXem.current = (data && data.phan_in && data.phan_in.ma_phan) || '';
  useEffect(() => {
    const ma = q.trim();
    if (ma.length < 3) { setKetQua(null); return undefined; }
    if (ma === maDangXem.current) return undefined;
    const t = setTimeout(async () => {
      setDangTim(true);
      try {
        const r = await timPhanInLichSu(ma);
        const ds = r.data || [];
        if (ds.length === 1) chon(ds[0].id); else setKetQua(ds);
      } catch (e) { show(e.message || 'Lỗi tìm', 'error'); } finally { setDangTim(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [q, chon, show]);

  const tai = useCallback(async (ngam = false) => {
    const id = idRef.current;
    if (!UUID.test(id)) { setData(null); return; }
    if (!ngam) setDangTai(true);
    try {
      const r = await getLichSuPhanIn(id);
      setData(r.data || null);
      if (!ngam && r.data && r.data.phan_in) setQ(r.data.phan_in.ma_phan);
    } catch (e) {
      if (!ngam) { show(e.message || 'Lỗi tải lịch sử', 'error'); setData(null); }
    } finally { if (!ngam) setDangTai(false); }
  }, [show]);
  useEffect(() => { setSoHien(BUOC); tai(); }, [idUrl, tai]);
  useSocketReload(['workflow:updated', 'production:updated', 'quality:updated', 'delivery:updated', 'ready:confirmed'],
    () => { if (idRef.current) tai(true); }, 1500);

  const tenNhom = useMemo(() => (data && data.nhom) || {}, [data]);
  const suKien = useMemo(() => (data && data.su_kien) || [], [data]);
  // Lọc (trừ chip nhóm) ⇒ đếm chip trên tập này.
  const truocChip = useMemo(() => suKien.filter((e) => (!chiTuDong || e.tu_dong)
    && (!chiTraVeHuy || e.tra_ve || e.huy || e.loi) && (!anErp || e.nhom !== 'ERP')
    && (!tim2.trim() || khopNhieu([e.tieu_de, e.chi_tiet, e.doi_tuong, e.nguoi, tenNhom[e.nhom]], tim2))),
  [suKien, chiTuDong, chiTraVeHuy, anErp, tim2, tenNhom]);
  const dem = useMemo(() => {
    const m = { '': truocChip.length };
    truocChip.forEach((e) => { m[e.nhom] = (m[e.nhom] || 0) + 1; });
    return m;
  }, [truocChip]);
  const dsLoc = useMemo(() => {
    const ds = nhom ? truocChip.filter((e) => e.nhom === nhom) : truocChip;
    return cuTruoc ? [...ds].reverse() : ds;
  }, [truocChip, nhom, cuTruoc]);
  const tabs = useMemo(() => [{ v: '', label: 'Tất cả' },
    ...Object.entries(tenNhom).filter(([k]) => (data?.dem || {})[k]).map(([v, label]) => ({ v, label }))], [tenNhom, data]);

  // Gom theo ngày (trên phần đang hiện).
  const theoNgay = useMemo(() => {
    const out = [];
    dsLoc.slice(0, soHien).forEach((e) => {
      const k = ngayKhoa(e.tg);
      if (!out.length || out[out.length - 1].k !== k) out.push({ k, tg: e.tg, ds: [] });
      out[out.length - 1].ds.push(e);
    });
    return out;
  }, [dsLoc, soHien]);

  const xuatExcel = () => {
    const p = data.phan_in;
    exportPanelExcel({
      title: `LỊCH SỬ PHẦN IN ${p.ma_phan}`,
      subtitle: [p.ten_khach_hang, p.ma_don_hang, p.ma_hang, p.mau_vai, p.kich_vai, p.kich_phim].filter(Boolean).join(' · '),
      fileName: `lich-su-${p.ma_phan}`,
      rows: dsLoc,
      cols: [
        { header: 'Thời gian', width: 20, value: (e) => ngayGio(e.tg) },
        { header: 'Nhóm', width: 18, value: (e) => tenNhom[e.nhom] || e.nhom },
        { header: 'Thao tác', width: 44, value: (e) => e.tieu_de },
        { header: 'Đối tượng', width: 18, value: (e) => e.doi_tuong || '' },
        { header: 'Chi tiết', width: 70, value: (e) => e.chi_tiet || '' },
        { header: 'Người', width: 22, value: (e) => e.nguoi || (e.tu_dong ? 'Hệ thống' : '') },
        { header: 'Tự động', width: 9, center: true, value: (e) => (e.tu_dong ? 'x' : '') },
        { header: 'Trả về / Hủy', width: 12, center: true, value: (e) => [e.tra_ve && 'Trả về', e.huy && 'Hủy', e.loi && 'Lỗi'].filter(Boolean).join(', ') },
      ],
    }).catch((e) => show(e.message || 'Lỗi xuất Excel', 'error'));
  };

  const p = data && data.phan_in;
  const pv = data && data.pham_vi;
  return (
    <div>
      <Toolbar title="Lịch sử phần in" search={q} onSearch={setQ}
        searchPlaceholder="Code phần · mã TDTHĐH · mã tem · mã lệnh LSX (≥ 3 ký tự)">
        {p && (
          <>
            <Button chiXemOk variant="secondary" icon="rotate-cw" onClick={() => tai()}>Tải lại</Button>
            <Button chiXemOk variant="secondary" icon="download" disabled={!dsLoc.length} onClick={xuatExcel}>Excel</Button>
          </>
        )}
      </Toolbar>

      {dangTim && <div className="py-4"><Spinner /></div>}
      {!dangTim && ketQua && ketQua.length === 0 && (
        <div className="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft">Không tìm thấy phần in</div>
      )}
      {!dangTim && ketQua && ketQua.length > 1 && <div className="mb-4"><KetQuaTim ds={ketQua} onChon={chon} /></div>}

      {dangTai && <div className="py-10"><Spinner /></div>}
      {!dangTai && !p && !ketQua && (
        <div className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-ink-soft">
          Nhập code phần, mã TDTHĐH, mã tem hoặc mã lệnh để xem toàn bộ lịch sử của phần in.
        </div>
      )}

      {!dangTai && p && (
        <>
          <div className="mb-3 rounded-card border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-ink">{p.ma_phan}</span>
              {p.mau_in && <span className="text-xs text-ink-soft">mực {p.mau_in}</span>}
              <PhuongAnInBadge value={p.phuong_an_in} />
              {!p.dang_hoat_dong && <Badge tone="warning">Phần in đang ẩn / đã hủy</Badge>}
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              {[p.ten_khach_hang, p.ma_don_hang, p.ma_hang, p.ten_ma_hang, p.mau_vai, p.kich_vai, p.kich_phim, p.tinh_chat_in,
                p.so_luong_don_hang != null && `SLĐH ${fmtNum(p.so_luong_don_hang)}`].filter(Boolean).join(' · ')}
            </div>
            {pv && (
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                <span><b className="text-ink">{fmtNum(pv.so_dot)}</b> đợt vải</span>
                <span title={(pv.lenh || []).join(', ')}><b className="text-ink">{fmtNum(pv.so_lenh)}</b> lệnh (kể cả đã hủy / gộp)</span>
                <span><b className="text-ink">{fmtNum(pv.so_tem)}</b> tem</span>
                <span><b className="text-ink">{fmtNum(suKien.length)}</b> sự kiện</span>
              </div>
            )}
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input value={tim2} onChange={(e) => setTim2(e.target.value)} placeholder="Lọc trong lịch sử: thao tác, mã lệnh, mã tem, người…"
                className="h-9 w-full rounded-input border border-line bg-surface pl-8 pr-3 text-base outline-none focus:border-primary md:text-sm" />
            </div>
            {[[chiTuDong, setChiTuDong, 'Chỉ tự động'], [chiTraVeHuy, setChiTraVeHuy, 'Chỉ trả về / hủy / lỗi'], [anErp, setAnErp, 'Ẩn lượt gửi ERP']].map(([v, set, nhan]) => (
              <label key={nhan} className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink">
                <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} />{nhan}
              </label>
            ))}
            <button type="button" onClick={() => setCuTruoc((v) => !v)}
              className="inline-flex items-center gap-1 rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink hover:bg-surface-muted">
              <Icon name="chevrons-up-down" size={13} />{cuTruoc ? 'Cũ nhất trước' : 'Mới nhất trước'}
            </button>
          </div>
          <ChipTabs tabs={tabs} value={nhom} counts={dem} onChange={setNhom} />

          {dsLoc.length === 0 ? (
            <div className="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft">Không có sự kiện khớp bộ lọc</div>
          ) : (
            <div className="space-y-3">
              {theoNgay.map((g) => (
                <div key={g.k} className="overflow-hidden rounded-card border border-line bg-surface">
                  <div className="sticky top-0 z-[1] border-b border-line bg-surface-muted px-4 py-1.5 text-xs font-semibold text-ink">
                    {nhanNgay(g.tg)} <span className="font-normal text-ink-soft">· {g.ds.length} sự kiện</span>
                  </div>
                  <ul>{g.ds.map((e) => <DongSuKien key={e.id} e={e} tenNhom={tenNhom[e.nhom] || e.nhom} />)}</ul>
                </div>
              ))}
              {dsLoc.length > soHien && (
                <div className="text-center">
                  <Button chiXemOk variant="secondary" onClick={() => setSoHien((n) => n + BUOC)}>
                    Hiện thêm ({fmtNum(dsLoc.length - soHien)} sự kiện)
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <Toast toast={toast} />
    </div>
  );
}
