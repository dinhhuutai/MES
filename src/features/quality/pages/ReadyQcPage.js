import { useEffect, useState, useCallback, useMemo } from 'react';
import NghenListModal, { NghenButton } from '../../../components/common/NghenListModal';
import useSiSoLoc from '../../../hooks/useSiSoLoc';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import OwnerHint from '../../../components/common/OwnerHint';
import TraVeBadge from '../../../components/common/TraVeBadge';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNow from '../../../hooks/useNow';
import useSocketReload from '../../../hooks/useSocketReload';
import taiHetTrang, { LIMIT_TAI_LON } from '../../../utils/taiHetTrang';
import { evalSla, slaRowClass } from '../../../utils/sla';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Field, Textarea } from '../../../components/common/controls';
import { listReadyQcCandidates, getReadyDetail, confirmReadyQC, confirmReadyQcBatch, readyHistory, readyDone, returnReadyToTech, traCuuMaQuet } from '../../../services/readyService';
import LoaiDotVaiBadge from '../../planning/components/LoaiDotVaiBadge';
import HanGiaoCell from '../../../components/common/HanGiaoCell';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import PhuongAnInCell from '../../../components/common/PhuongAnInCell';
import exportReadyQcExcel from '../utils/exportReadyQcExcel';
import { khuonRequired } from '../../technical-ready/constants';

// Thứ tự hiển thị: FILM → KHUÔN → MỰC (HSKT đã bỏ khỏi checklist READY).
const TECH_ITEMS = [
  { ma: 'FILM', label: 'Film' },
  { ma: 'KHUON', label: 'Khuôn' },
  { ma: 'MUC', label: 'Mực' },
];

const fmt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' }, { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' }, { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' }, { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];

export default function ReadyQcPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canQC = can('READY_QC');
  // Đổi phương án in ngay tại cột — khớp đúng rbac của `PATCH /hskt/:id/phuong-an-in`
  // (`READY_KHUON | READY_FILM | READY_MUC | READY_QC`). Vai trò QA chỉ có `READY_QC` nên
  // KHÔNG được rút gọn thành `permItems.length > 0` như bên màn READY của Kỹ thuật.
  const canDoiPain = canQC || can('READY_KHUON') || can('READY_FILM') || can('READY_MUC');
  const now = useNow(1000);

  const [rows, setRows] = useState([]);
  const [nghenOpen, setNghenOpen] = useState(false); // modal "Danh sách nghẽn"
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // ⚠ ĐÃ BỎ state `page` + thanh `Pagination` phân trang SERVER: trang tải-hết rồi để `DataTable` tự
  //   phân trang 20/trang ở CLIENT. Giữ cả hai là 2 thanh phân trang chồng nhau trên cùng một bảng.

  const [editing, setEditing] = useState(null); // phần in row
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // id phần in đã tích
  const [batching, setBatching] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  // Trả về kỹ thuật (chọn checklist rớt + lý do)
  const [returnMode, setReturnMode] = useState(false);
  const [returnChecklists, setReturnChecklists] = useState(() => new Set());
  const [returnReason, setReturnReason] = useState('');
  const [filters, setFilters] = useState({});

  // Dải "Theo dõi" (sĩ số) bám ĐÚNG ô tìm + panel lọc của màn này — xem hooks/useSiSoLoc.js.
  useSiSoLoc({ timKiem: search, ...filters });
  const [showFilters, setShowFilters] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;
  const filtered = useMemo(() => filterRows(rows, filters, FILTER_FIELDS), [rows, filters]);

  // GOM SET hiển thị GIỐNG MÀN RELEASE 1: các phần in cùng set xếp LIỀN NHAU thành một khối
  // (ô set bên trái + viền trái xanh). (1 dòng ở đây = 1 PHẦN IN, còn Release 1 = 1 đợt vải —
  // nên gom theo `gom_set_list` của phần in.)
  // ⚠ GOM TẠI CHỖ, KHÔNG đẩy set lên đầu bảng: đẩy lên đầu thì trang 1 toàn phần in chưa đủ mục
  // (không có checkbox chọn) ⇒ trông như "mất cột checkbox". Giữ nguyên thứ tự cũ, chỉ kéo các
  // thành viên còn lại của set lên ngay sau thành viên ĐẦU TIÊN xuất hiện.
  const viewRows = useMemo(() => {
    const bySet = new Map();
    filtered.forEach((r) => {
      const k = (r.gom_set_list || '').trim();
      if (!k) return;
      if (!bySet.has(k)) bySet.set(k, []);
      bySet.get(k).push(r);
    });
    const done = new Set();
    const out = [];
    filtered.forEach((r) => {
      const k = (r.gom_set_list || '').trim();
      if (!k) { out.push(r); return; }
      if (done.has(k)) return;      // đã đổ cả nhóm ở vị trí thành viên đầu tiên
      done.add(k);
      const list = bySet.get(k);
      const chuaDu = list.filter((x) => x.tech_done !== true).length;
      list.forEach((m, i) => out.push({
        ...m, _set: k, _setFirst: i === 0, _setSize: list.length, _setChuaQc: chuaDu,
      }));
    });
    return out;
  }, [filtered]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Tải-hết để lọc client trọn vẹn; DataTable tự phân trang 20/trang.
      // ⚠⚠ `limit: 500` cũ bị `getPaging` cắt còn 200 mà KHÔNG báo gì. Màn này mới 166 dòng nên chưa
      //   lộ, nhưng vượt 200 là QC quét mã không ra hàng và bộ lọc chỉ soi 200 dòng đầu — đúng sự cố
      //   Test Run - QA 19/08/2026 (658 lệnh, màn chỉ thấy 200).
      const { items, total, thieu } = await taiHetTrang((p) => listReadyQcCandidates({ search, ...p }), { limit: LIMIT_TAI_LON });
      setRows(items);
      setMeta({ total });
      if (thieu) show(`Chỉ tải được ${items.length}/${total} phần in — hãy thu hẹp bằng ô tìm kiếm`, 'error');
      setSelected(new Set());
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // ⚠ TẢI LẠI NGẦM khi kỹ thuật xác nhận Khuôn/Film/Mực ở MÁY KHÁC — trước đây màn này không nghe
  // socket nên giữ mãi dữ liệu lúc mở trang: KT vừa xác nhận xong mà QC quét mã vẫn báo
  // "chưa đủ mục kỹ thuật" (lỗi đã gặp thật 04/08/2026 với SD-2607-001-A25-F04-C01 — 3 mục đủ lúc
  // 16:24, quét lúc 16:27 vẫn báo thiếu). KHÔNG dùng `load` vì nó xóa các dòng đang tick.
  const refresh = useCallback(async () => {
    try {
      const { items, total } = await taiHetTrang((p) => listReadyQcCandidates({ search, ...p }), { limit: LIMIT_TAI_LON });
      setRows(items);
      setMeta({ total });
      // ⚠ Lượt tải NGẦM: cờ `thieu` CỐ Ý không báo — người dùng không hề bấm gì, bắn toast đỏ ở đây
      //   là quấy rầy giữa lúc họ đang tick chọn. Lượt `load()` có bấm/đổi tìm kiếm đã báo rồi.
    } catch (e) { /* nền: lỗi mạng thì giữ dữ liệu cũ, không quấy người dùng */ }
  }, [search]);
  useSocketReload(['ready:confirmed'], refresh);

  // Quét mã mà không khớp dòng nào → tra tiếp toàn hệ thống để nói RÕ vì sao (thường là phần in đã
  // được QC xác nhận xong nên rời danh sách — trước đây chỉ hiện "Không thấy", người quét tưởng hỏng).
  const giaiThichQuetTruot = useCallback(async (code) => {
    try {
      const res = await traCuuMaQuet(code);
      return res.data?.mo_ta || null;
    } catch (e) { return null; }
  }, []);

  const open = async (row, asReturn = false) => {
    setEditing(row);
    setDetail(null);
    setLoadingDetail(true);
    setReturnMode(asReturn);
    setReturnChecklists(new Set());
    setReturnReason('');
    try {
      const res = await getReadyDetail(row.id);
      setDetail(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải chi tiết', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleReturnItem = (ma) => setReturnChecklists((s) => {
    const next = new Set(s);
    if (next.has(ma)) next.delete(ma); else next.add(ma);
    return next;
  });

  const doReturn = async () => {
    if (returnChecklists.size === 0) { show('Chọn ít nhất 1 mục không đạt', 'error'); return; }
    if (!returnReason.trim()) { show('Nhập lý do trả về', 'error'); return; }
    setSaving(true);
    try {
      await returnReadyToTech(editing.id, { checklists: [...returnChecklists], lyDo: returnReason.trim() });
      show(`Đã trả ${editing.ma_phan} về kỹ thuật`);
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Trả về thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doConfirm = async () => {
    setSaving(true);
    try {
      await confirmReadyQC(editing.id);
      show(`QC xác nhận ${editing.ma_phan} — READY hoàn thành 🎉`);
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const byMa = (detail?.checkpoints || []).reduce((acc, c) => ({ ...acc, [c.ma_checkpoint]: c }), {});
  const techDone = detail?.state?.tech_done === true;

  // QC chỉ xác nhận được khi kỹ thuật đã ĐỦ MỤC (backend tính theo khách: II/AD chỉ cần Film+Mực).
  const isReady = (r) => r.tech_done === true;
  const readyRows = rows.filter(isReady);

  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = readyRows.length > 0 && readyRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(readyRows.map((r) => r.id))));

  const [exporting, setExporting] = useState(false);
  const doExport = async () => {
    if (filtered.length === 0) { show('Không có dòng nào để xuất', 'error'); return; }
    setExporting(true);
    try { await exportReadyQcExcel(filtered); }
    catch (e) { show(e.message || 'Xuất Excel thất bại', 'error'); }
    finally { setExporting(false); }
  };

  const doBatch = async () => {
    setBatching(true);
    try {
      const res = await confirmReadyQcBatch([...selected]);
      const { okCount, failedCount } = res.data;
      show(failedCount ? `QC xác nhận ${okCount} phần in, ${failedCount} lỗi` : `Đã QC xác nhận ${okCount} phần in 🎉`,
        failedCount ? 'error' : 'success');
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setBatching(false);
    }
  };

  const columns = [
    { key: 'sel', className: 'w-10', selection: true,
      header: canQC ? (
        <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả (đủ kỹ thuật)" />
      ) : '',
      // Phần in CHƯA đủ mục kỹ thuật vẫn hiện ô checkbox nhưng KHÓA (trước đây để trống hẳn nên
      // nhìn như bảng bị mất cột chọn) — kèm tooltip nói rõ vì sao chưa chọn được.
      render: (r) => canQC && (
        <input type="checkbox" checked={selected.has(r.id)} disabled={!isReady(r)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)}
          className="disabled:cursor-not-allowed disabled:opacity-40"
          title={isReady(r) ? 'Chọn phần in' : 'Chưa đủ mục kỹ thuật — QC chưa xác nhận được'}
          aria-label="Chọn phần in" />
      ) },
    // Ô GOM SET (giống Release 1): dòng đầu của set hiện mã set + số phần in in chung; dòng sau nối tiếp.
    { key: 'gom_set', header: 'Gom set', className: 'w-32', render: (r) => {
      if (!r._set) return <span className="text-ink-soft">—</span>;
      if (!r._setFirst) return <span className="block h-full border-l-2 border-primary/40 pl-2 text-[10px] text-primary/70">↳ cùng set</span>;
      return (
        <div className="flex flex-col items-start gap-1"
          title="Gom set: các phần in KHÁC NHAU (cùng màu) in chung 1 lần. Kế hoạch chỉ release được khi CẢ SET đã Ready.">
          <span className="flex items-center gap-1 text-xs font-bold text-primary">
            <Icon name="package" size={13} /> {r._set}
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {r._setSize} phần in · in chung
          </span>
          {r._setChuaQc > 0 && (
            <span className="text-[10px] font-medium text-amber-600">{r._setChuaQc} chưa đủ mục</span>
          )}
        </div>
      );
    } },
    { key: 'ma_phan', header: 'Code phần', className: 'font-medium text-ink', render: (r) => (
      <div>
        <div>{r.ma_phan || '—'}</div>
        {r.tra_ve_kh && <div className="mt-1"><TraVeBadge data={r.tra_ve_kh} label="Kế hoạch trả về" nguon="Kế hoạch (Release 1)" /></div>}
        {/* Test Run không đạt → QA trả về; modal hiện MỤC RỚT (Khuôn/Film/Mực) + lý do. */}
        {r.tra_ve_test && <div className="mt-1"><TraVeBadge data={r.tra_ve_test} label="Test Run trả về" nguon="Test Run (QA)" /></div>}
      </div>
    ) },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'loai_dot_vai', header: 'Loại đợt vải', render: (r) => <LoaiDotVaiBadge value={r.loai_dot_vai} /> },
    // Phương án in (ERP `Pain` trên HSKT): 1 Bàn · 2 Máy · 3 Robot.
    // Đổi được ngay tại chỗ như màn READY của Kỹ thuật: ⟳ xoay Bàn → Robot → Máy, ✓ mới ghi
    // (kèm đổi số cuối mã vạch HSKT + đặt `pa_in_sua_tay` để job ERP không đè lại).
    { key: 'phuong_an_in', header: 'Phương án in', render: (r) => (
      <PhuongAnInCell value={r.phuong_an_in} hsktId={r.hskt_id} barcode={r.barcode_hskt}
        disabled={!canDoiPain} show={show} onChanged={refresh} />
    ) },
    { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
    // ⚠ Film + Khuôn GỘP thành 1 nhãn "Film-Khuôn" (16/08/2026) — xác nhận Khuôn thì Film tự đạt
    // theo nên 2 nhãn riêng gần như luôn giống nhau. Bám theo KHUÔN (mục quyết định "đủ mục KT");
    // ca lẻ chỉ mới có Film thì hiện VÀNG để không giấu mất. Hàng gia công (II/AD) ẩn hẳn nhãn này.
    { key: 'tech', header: 'Kỹ thuật', render: (r) => (
      <div className="flex flex-wrap items-center gap-1">
        {khuonRequired(r.ten_khach_hang) && (
          r.khuon_done
            ? <Badge tone="success">Film-Khuôn</Badge>
            : <Badge tone={r.film_done ? 'warning' : 'default'}
                title={r.film_done ? 'Đã xác nhận Film, còn chờ Khuôn' : undefined}>Film-Khuôn</Badge>
        )}
        <Badge tone={r.muc_done ? 'success' : 'default'}>Mực</Badge>
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="QC chuẩn bị kỹ thuật" subtitle="Toàn bộ phần in ở READY — QC xác nhận khi đủ mục kỹ thuật (xác nhận Khuôn là Film tự đạt theo; hàng gia công II/AD chỉ cần Mực). SLA nghẽn QC chỉ tính sau khi kỹ thuật đủ mục."
        search={search} onSearch={setSearch}
        searchPlaceholder="Tìm code phần, mã hàng, màu/kích vải, kích phim...">
        {/* Làm tươi NGAY khi mở modal quét: phòng trường hợp tab để lâu / mất socket giữa chừng. */}
        {canQC && <Button variant="secondary" icon="scan-line" onClick={() => { refresh(); setScanOpen(true); }}>Quét / tích mã</Button>}
        {canQC && selected.size > 0 && (
          <Button loading={batching} onClick={doBatch}>QC xác nhận ({selected.size})</Button>
        )}
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="secondary" icon="file-spreadsheet" loading={exporting} onClick={doExport}>Excel ({filtered.length})</Button>
        <NghenButton rows={rows} trangThai={(r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status} onClick={() => setNghenOpen(true)} />
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{readyRows.length} đủ mục · {meta.total} ở READY</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      <DataTable columns={columns} rows={viewRows} loading={loading} onRowClick={(r) => open(r)} sttStart={0}
        rowClassName={(r) => `${slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)} ${r._set ? 'border-l-[3px] border-l-primary/60' : ''}`}
        emptyText="Không có phần in nào ở READY" />

      <SidePanel
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`QC READY — ${editing?.ma_phan || ''}`}
        subtitle={editing ? [editing.ten_khach_hang, editing.ma_don_hang, editing.ma_hang, editing.mau_vai].filter(Boolean).join(' · ') : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Đóng</Button>
            {returnMode ? (
              <Button variant="danger" onClick={doReturn} loading={saving}
                disabled={!canQC || loadingDetail || returnChecklists.size === 0 || !returnReason.trim()}>
                Trả về kỹ thuật ({returnChecklists.size})
              </Button>
            ) : (
              <Button onClick={doConfirm} loading={saving} disabled={!canQC || loadingDetail || !techDone}>
                QC xác nhận
              </Button>
            )}
          </>
        }
      >
        {loadingDetail ? (
          <div className="py-6 text-center text-ink-soft">Đang tải...</div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Kết quả kỹ thuật</h3>
              {canQC && (
                <button type="button" onClick={() => { setReturnMode((v) => !v); setReturnChecklists(new Set()); setReturnReason(''); }}
                  className={`text-xs font-medium ${returnMode ? 'text-ink-soft hover:underline' : 'text-danger hover:underline'}`}>
                  {returnMode ? '← QC xác nhận' : 'Trả về kỹ thuật'}
                </button>
              )}
            </div>
            {returnMode && (
              <p className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                Tick các mục <b>không đạt</b> để trả về cho bộ phận kỹ thuật làm lại (kèm lý do bắt buộc).
              </p>
            )}
            {TECH_ITEMS.filter((it) => it.ma !== 'KHUON' || detail?.state?.khuon_required !== false).map((it) => {
              const cp = byMa[it.ma];
              const done = cp?.trang_thai === 'DAT';
              return (
                <div key={it.ma} className="rounded-control border border-line px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      {returnMode && (
                        <input type="checkbox" checked={returnChecklists.has(it.ma)}
                          onChange={() => toggleReturnItem(it.ma)} aria-label={`Trả về ${it.label}`} />
                      )}
                      {it.label}
                      {cp?.gia_tri_text ? <span className="ml-2 font-normal text-ink-soft">({cp.gia_tri_text})</span> : null}
                    </span>
                    <div className="flex items-center gap-2">
                      {done && (cp?.nguoi_xac_nhan_ten || cp?.tg_xac_nhan) ? (
                        <span className="text-right text-xs text-ink-soft">
                          {cp.nguoi_xac_nhan_ten ? <span className="block font-medium text-ink">{cp.nguoi_xac_nhan_ten}</span> : null}
                          {cp.tg_xac_nhan ? <span className="block">{fmt(cp.tg_xac_nhan)}</span> : null}
                        </span>
                      ) : null}
                      <Badge tone={done ? 'success' : 'default'}>{done ? 'Đã xác nhận' : 'Chưa'}</Badge>
                    </div>
                  </div>
                  {!returnMode && !done && <OwnerHint checkpoint={it.ma} className="mt-1.5" />}
                </div>
              );
            })}
            {returnMode ? (
              <Field label="Lý do trả về" required>
                <Textarea rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Vì sao trả về kỹ thuật (vd: film mờ, sai khuôn...)" />
              </Field>
            ) : (
              <>
                {techDone && <OwnerHint checkpoint="QC_XAC_NHAN" className="pt-1" />}
                {techDone
                  ? <p className="pt-1 text-xs text-ink-soft">QC xác nhận → READY hoàn thành, cho phép Release 1.</p>
                  : <p className="pt-1 text-xs font-medium text-warning">Kỹ thuật chưa xác nhận đủ mục — QC chưa thể xác nhận.</p>}
              </>
            )}
          </div>
        )}
      </SidePanel>

      {/* Truyền ĐỦ `rows` (không phải `readyRows`) để quét phần in nào ĐANG HIỆN trên bảng cũng khớp;
          phần in chưa đủ mục kỹ thuật thì `canSelect` báo rõ lý do thay vì "Không thấy". */}
      <ScanCollectModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Quét / tích phần in — QC READY"
        rows={rows}
        getId={(r) => r.id}
        getCodes={(r) => [r.ma_phan]}
        getBarcodes={(r) => [r.barcode]}
        matchMultiple={false}
        canSelect={(r) => isReady(r) || 'chưa đủ mục kỹ thuật (Khuôn/Film/Mực) — QC chưa xác nhận được'}
        onNotFound={giaiThichQuetTruot}
        isSelected={(r) => selected.has(r.id)}
        onToggle={(r) => toggleOne(r.id)}
        primaryLabel={(r) => r.ma_phan || r.barcode || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.ma_hang, r.mau_vai].filter(Boolean).join(' · ')}
        rowAction={{ label: 'Trả về', icon: 'log-out', onClick: (r) => { setScanOpen(false); open(r, true); } }}
        onConfirm={() => { setScanOpen(false); doBatch(); }}
        confirmLabel="QC xác nhận"
      />

      <HistoryPanel
        open={histOpen}
        onClose={() => setHistOpen(false)}
        title="Lịch sử QC chuẩn bị kỹ thuật"
        fetcher={(date) => readyHistory(date, 'qc')}
      />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Phần in đã QC (READY hoàn thành)" maHeader="Phần in"
        fetcher={(date) => readyDone(date, 'qc')} />

      <NghenListModal open={nghenOpen} onClose={() => setNghenOpen(false)}
        tenMan="QC chuẩn bị kỹ thuật" rows={rows} trangThai={(r) => evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status} tenFile="nghen-qc-ready" />
      <Toast toast={toast} />
    </div>
  );
}
