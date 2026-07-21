import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Pagination from '../../../components/common/Pagination';
import FieldFilters, { FilterToggle, filterRows } from '../../../components/common/FieldFilters';
import Badge from '../../../components/common/Badge';
import TraVeBadge from '../../../components/common/TraVeBadge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Field, Input } from '../../../components/common/controls';
import ChuyenPicker from '../../../components/common/ChuyenPicker';
import ScanCollectModal from '../../../components/common/ScanCollectModal';
import LoaiDotVaiBadge from '../components/LoaiDotVaiBadge';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import useToast from '../../../hooks/useToast';
import useNghenMap from '../../../hooks/useNghenMap';
import { slaRowClass } from '../../../utils/sla';
import {
  listRelease1Candidates, createRelease1, listChuyen, release1History,
  listReleaseSets, releaseSet, release1Done,
} from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

const dateOffsetStr = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function SelectAllCheckbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
  );
}

const TH = 'sticky top-0 z-20 bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft';
const TD = 'px-4 py-3 align-middle';

const FILTER_FIELDS = [
  { key: 'codePhan', label: 'Code phần', col: 'ma_phan' }, { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng', col: 'ma_don_hang' }, { key: 'maHang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mauVai', label: 'Màu vải', col: 'mau_vai' }, { key: 'kichVai', label: 'Kích vải', col: 'kich_vai' },
  { key: 'kichPhim', label: 'Kích phim', col: 'kich_phim' },
];

// Các ô dữ liệu chung cho cả row lẻ lẫn member của set.
function DataCells({ r }) {
  return (
    <>
      <td className={`${TD} font-medium text-ink`}>
        <div className="leading-tight">
          <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
          <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
        </div>
        {(r.tra_ve || r.tra_ve_ly_do) && <div className="mt-1"><TraVeBadge data={r.tra_ve || r.tra_ve_ly_do} label="Bị Test Run trả về" nguon="Test Run (QA)" /></div>}
      </td>
      <td className={TD}>{r.ma_hang || '—'}</td>
      <td className={TD}>
        <div className="leading-tight">
          <div className="text-ink">{r.mau_vai || '—'}</div>
          <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
        </div>
      </td>
      <td className={TD}><TinhChatInCell value={r.tinh_chat_in} /></td>
      <td className={TD}><LoaiDotVaiBadge value={r.loai_dot_vai} /></td>
      <td className={`${TD} text-right tabular-nums whitespace-nowrap`}>
        <b className="text-ink">{fmtNum(r.so_luong_vai_ve)}</b><span className="text-ink-soft"> / {fmtNum(r.so_luong_don_hang)}</span>
      </td>
      <td className={`${TD} text-right tabular-nums font-medium text-primary`}>{fmtNum(r.con_release ?? r.so_luong_vai_ve)}</td>
      <td className={TD}>{fmtDate(r.ngay_vai_ve)}</td>
      <td className={TD}>{fmtDate(r.han_giao_hang)}</td>
    </>
  );
}

export default function Release1Page() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState([]);
  const [sets, setSets] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { statusDot } = useNghenMap();
  const [selected, setSelected] = useState({});      // dot_vai_id -> row (lẻ)
  const [selectedSets, setSelectedSets] = useState(() => new Set()); // set id
  const [chuyen, setChuyen] = useState([]);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [onlyReturned, setOnlyReturned] = useState(false); // lọc đợt vải bị QC trả về
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const [detail, setDetail] = useState(null);        // row lẻ đang xem
  const [form, setForm] = useState({ chuyenId: '', soLuongRelease: '', ngayKeHoach: '' });
  const [releaseOpen, setReleaseOpen] = useState(false); // modal release gộp
  const [relForm, setRelForm] = useState({ chuyenId: '', ngayKeHoach: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, setRes] = await Promise.all([
        // Tải-hết (limit cao) để quét/tích khớp mọi đợt vải + lọc client trọn vẹn (mirror Release 2).
        listRelease1Candidates({ search, page, limit: 500 }),
        listReleaseSets({ search }),
      ]);
      setRows(res.data.items);
      setMeta(res.data.meta);
      setSets(setRes.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, show]);

  useEffect(() => { listChuyen().then((r) => setChuyen(r.data)).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // Lọc "chỉ hiện phần bị trả về": ẩn set (đợt vải bị trả về nằm ở pool lẻ), chỉ hiện đợt vải lẻ bị trả về.
  const activeCount = Object.values(filters).filter(Boolean).length;
  const viewSets = (onlyReturned || activeCount > 0) ? [] : sets;
  const viewRows = filterRows(onlyReturned ? rows.filter((r) => r.tra_ve_ly_do) : rows, filters, FILTER_FIELDS);

  const looseList = useMemo(() => Object.values(selected), [selected]);
  const selectedSetList = useMemo(() => sets.filter((s) => selectedSets.has(s.id)), [sets, selectedSets]);
  const tongVai = useMemo(() => looseList.reduce((s, r) => s + (Number(r.so_luong_vai_ve) || 0), 0), [looseList]);
  const totalSel = looseList.length + selectedSetList.length;

  const toggle = (row) => setSelected((s) => {
    const next = { ...s };
    if (next[row.dot_vai_id]) delete next[row.dot_vai_id]; else next[row.dot_vai_id] = row;
    return next;
  });
  // Chọn tất cả ở header = chọn cả đợt vải lẻ + các set (chỉ set đủ QC mới chọn được).
  const selectableSets = useMemo(() => sets.filter((s) => s.san_sang), [sets]);
  const looseAll = rows.length === 0 || rows.every((r) => selected[r.dot_vai_id]);
  const setsAll = selectableSets.length === 0 || selectableSets.every((s) => selectedSets.has(s.id));
  const allChecked = (rows.length > 0 || selectableSets.length > 0) && looseAll && setsAll;
  const someChecked = rows.some((r) => selected[r.dot_vai_id]) || selectableSets.some((s) => selectedSets.has(s.id));
  const toggleAll = () => {
    if (allChecked) {
      setSelected((s) => { const n = { ...s }; rows.forEach((r) => delete n[r.dot_vai_id]); return n; });
      setSelectedSets(new Set());
    } else {
      setSelected((s) => { const n = { ...s }; rows.forEach((r) => { n[r.dot_vai_id] = r; }); return n; });
      setSelectedSets(new Set(selectableSets.map((s) => s.id)));
    }
  };
  const toggleSet = (id) => setSelectedSets((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openDetail = (row) => {
    setDetail(row);
    // Mặc định release phần CÒN LẠI (SL vải về − đã release); release theo số lượng, giữ phần còn.
    setForm({ chuyenId: chuyen[0]?.id || '', soLuongRelease: String(row.con_release ?? row.so_luong_vai_ve ?? ''), ngayKeHoach: dateOffsetStr(1) });
  };

  // Release 1 phần in lẻ (từ side panel chi tiết)
  const submitRelease = async (dotVaiIds) => {
    setSaving(true);
    try {
      const res = await createRelease1({
        dotVaiIds, chuyenId: form.chuyenId,
        soLuongRelease: form.soLuongRelease ? Number(form.soLuongRelease) : null,
        ngayKeHoach: form.ngayKeHoach || null,
      });
      const skipped = res?.data?.skipped_test_count || 0;
      show(skipped > 0 ? `Đã tạo lệnh — ${skipped} đợt vải vào thẳng Release 2` : 'Đã Release 1 — tạo lệnh sản xuất');
      setSelected((s) => { const n = { ...s }; dotVaiIds.forEach((id) => delete n[id]); return n; });
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Release thất bại', 'error');
    } finally { setSaving(false); }
  };

  const openReleaseAll = () => {
    setRelForm({ chuyenId: chuyen[0]?.id || '', ngayKeHoach: dateOffsetStr(1) });
    setReleaseOpen(true);
  };

  // Release gộp: set → 1 lệnh chung mỗi set; đợt vải lẻ → mỗi đợt 1 lệnh.
  const doReleaseAll = async () => {
    setSaving(true);
    try {
      let okSets = 0; const errs = [];
      for (const s of selectedSetList) {
        try { await releaseSet(s.id, { chuyenId: relForm.chuyenId, ngayKeHoach: relForm.ngayKeHoach || null }); okSets += 1; }
        catch (e) { errs.push(`${s.ma_set}: ${e.message}`); }
      }
      let looseMsg = '';
      if (looseList.length) {
        const res = await createRelease1({
          dotVaiIds: looseList.map((r) => r.dot_vai_id),
          chuyenId: relForm.chuyenId, soLuongRelease: null, ngayKeHoach: relForm.ngayKeHoach || null,
        });
        looseMsg = ` · ${res?.data?.created_count || looseList.length} lệnh lẻ`;
      }
      show(errs.length
        ? `Release set lỗi: ${errs.join('; ')}`
        : `Đã release ${okSets} set${looseMsg}`, errs.length ? 'error' : 'success');
      setSelected({}); setSelectedSets(new Set()); setReleaseOpen(false);
      load();
    } catch (e) {
      show(e.message || 'Release thất bại', 'error');
    } finally { setSaving(false); }
  };

  const colCount = 11; // +1: cột "Tính chất in"

  return (
    <div>
      <Toolbar title="Release 1" subtitle="Phần in đã READY — chọn đợt vải/set & chuyền để release"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, mã hàng, màu, kích...">
        <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR code phần</Button>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={onlyReturned} onChange={(e) => setOnlyReturned(e.target.checked)} />
          Chỉ hiện phần bị trả về
        </label>
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{activeCount ? `${viewRows.length}/` : ''}{meta.total} đợt vải · {sets.length} set</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onClear={() => setFilters({})} open={showFilters} />

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-13rem)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-left">
                <th className={`${TH} w-10`}>
                  <SelectAllCheckbox checked={allChecked} indeterminate={!allChecked && someChecked} onChange={toggleAll} />
                </th>
                <th className={`${TH} w-12 text-right`}>STT</th>
                <th className={TH}>Khách hàng · Đơn hàng</th>
                <th className={TH}>Mã hàng</th>
                <th className={TH}>Màu · Kích (vải/phim)</th>
                <th className={TH}>Tính chất in</th>
                <th className={TH}>Loại đợt vải</th>
                <th className={`${TH} text-right`}>SL vải về / đơn</th>
                <th className={`${TH} text-right`}>Còn release</th>
                <th className={TH}>Ngày nhận vải</th>
                <th className={TH}>Hạn giao</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colCount} className="px-4 py-12 text-center text-ink-soft"><Icon name="loader" size={22} className="mx-auto animate-spin" /></td></tr>
              ) : (viewSets.length === 0 && viewRows.length === 0) ? (
                <tr><td colSpan={colCount} className="px-4 py-12 text-center text-ink-soft">Không có đợt vải nào sẵn sàng Release 1</td></tr>
              ) : (
                <>
                  {/* Các SET — gộp nhóm như 1 khối, 1 checkbox hợp nhất */}
                  {viewSets.map((s, si) => s.members.map((m, i) => {
                    const first = i === 0;
                    const last = i === s.members.length - 1;
                    const on = selectedSets.has(s.id);
                    return (
                      <tr key={m.dot_vai_id}
                        className={`bg-primary-wash/30 ${last ? 'border-b border-line' : ''} ${on ? 'bg-primary-wash/70' : ''}`}>
                        {first && (
                          <td rowSpan={s.members.length}
                            className={`w-28 border-l-[3px] px-2 py-3 align-middle text-center transition
                              ${on ? 'border-primary bg-primary-wash' : 'border-primary/50'}`}>
                            <label className={`flex flex-col items-center gap-1.5 ${s.san_sang ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                              <input type="checkbox" disabled={!s.san_sang} checked={on} onChange={() => toggleSet(s.id)}
                                className="h-4 w-4 rounded border-line text-primary focus:ring-primary disabled:opacity-40" />
                              <span className="flex items-center gap-1 text-xs font-bold text-primary">
                                <Icon name="package" size={13} /> {s.ma_set}
                              </span>
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                {s.so_dot_vai} đợt · in chung
                              </span>
                              {s.khac_mau && <span className="text-[10px] font-medium text-amber-600">⚠ khác màu</span>}
                              {!s.san_sang && <span className="text-[10px] text-amber-600">{s.so_chua_ready} chưa QC</span>}
                            </label>
                          </td>
                        )}
                        {first && (
                          <td rowSpan={s.members.length} className={`${TD} text-right tabular-nums text-ink-soft`}>{si + 1}</td>
                        )}
                        <DataCells r={m} />
                      </tr>
                    );
                  }))}

                  {/* Đợt vải lẻ */}
                  {viewRows.map((r, ri) => (
                    <tr key={r.dot_vai_id} onClick={() => openDetail(r)}
                      className={`cursor-pointer border-b border-line/70 transition hover:bg-surface-muted/40 ${slaRowClass(statusDot(r.dot_vai_id))}`}>
                      <td className={TD}>
                        <input type="checkbox" checked={!!selected[r.dot_vai_id]}
                          onClick={(e) => e.stopPropagation()} onChange={() => toggle(r)}
                          className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
                      </td>
                      <td className={`${TD} text-right tabular-nums text-ink-soft`}>{viewSets.length + ri + 1}</td>
                      <DataCells r={r} />
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      {totalSel > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-card border border-line bg-surface px-5 py-3 shadow-card-hover">
          <span className="text-sm text-ink">
            {selectedSetList.length > 0 && <>Đã chọn <b>{selectedSetList.length}</b> set</>}
            {selectedSetList.length > 0 && looseList.length > 0 && ' · '}
            {looseList.length > 0 && <>Đã chọn <b>{looseList.length}</b> đợt vải lẻ (SL {fmtNum(tongVai)})</>}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setSelected({}); setSelectedSets(new Set()); }}>Bỏ chọn</Button>
            <Button onClick={openReleaseAll}>Release ({totalSel})</Button>
          </div>
        </div>
      )}

      {/* Modal release gộp (set + lẻ) */}
      <Modal
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        title="Release 1"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReleaseOpen(false)}>Hủy</Button>
            <Button onClick={doReleaseAll} loading={saving} disabled={!relForm.chuyenId}>Xác nhận Release</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {selectedSetList.length > 0 && <div>{selectedSetList.length} set → mỗi set 1 lệnh chung</div>}
          {looseList.length > 0 && <div>{looseList.length} đợt vải lẻ → mỗi đợt 1 lệnh</div>}
        </div>
        <Field label="Chuyền in" required>
          <ChuyenPicker chuyen={chuyen} value={relForm.chuyenId} onChange={(id) => setRelForm({ ...relForm, chuyenId: id })} />
        </Field>
        <Field label="Ngày kế hoạch">
          <Input type="date" value={relForm.ngayKeHoach} onChange={(e) => setRelForm({ ...relForm, ngayKeHoach: e.target.value })} />
        </Field>
      </Modal>

      {/* Chi tiết / release 1 đợt vải lẻ */}
      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Release 1 — ${detail.ma_phan || ''}` : 'Chi tiết phần in'}
        subtitle={detail ? `${detail.ten_khach_hang || ''} · ${detail.mau_vai || ''}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>Đóng</Button>
            <Button onClick={() => submitRelease([detail.dot_vai_id])} loading={saving} disabled={!form.chuyenId}>Xác nhận Release 1</Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="Khách hàng" value={detail.ten_khach_hang} />
              <Info label="Đơn hàng" value={detail.ma_don_hang} />
              <Info label="Mã hàng" value={detail.ma_hang} />
              <Info label="Code phần" value={detail.ma_phan} />
              <Info label="Màu vải" value={detail.mau_vai} />
              <Info label="Đợt vải" value={detail.ma_dot_vai} />
              <Info label="Kích vải" value={detail.kich_vai} />
              <Info label="Kích phim" value={detail.kich_phim} />
              <Info label="SL đơn hàng" value={fmtNum(detail.so_luong_don_hang)} />
              <Info label="SL nhận vải" value={fmtNum(detail.so_luong_vai_ve)} />
              <Info label="Đã release" value={fmtNum(detail.da_release || 0)} />
              <Info label="Còn release" value={fmtNum(detail.con_release ?? detail.so_luong_vai_ve)} />
              <Info label="Ngày nhận vải" value={fmtDate(detail.ngay_vai_ve)} />
              <Info label="Hạn giao" value={fmtDate(detail.han_giao_hang)} />
            </div>
            <div className="space-y-3 border-t border-line pt-4">
              <Field label="Chuyền in" required>
                <ChuyenPicker chuyen={chuyen} value={form.chuyenId} onChange={(id) => setForm({ ...form, chuyenId: id })} />
              </Field>
              <div className="grid grid-cols-2 gap-x-4">
                <Field label="Số lượng release" hint={`Còn lại ${fmtNum(detail.con_release ?? detail.so_luong_vai_ve)} — release ít hơn thì đợt vẫn ở lại kế hoạch với phần còn`}>
                  <Input type="number" min="1" max={detail.con_release ?? detail.so_luong_vai_ve}
                    value={form.soLuongRelease} onChange={(e) => setForm({ ...form, soLuongRelease: e.target.value })} />
                </Field>
                <Field label="Ngày kế hoạch">
                  <Input type="date" value={form.ngayKeHoach} onChange={(e) => setForm({ ...form, ngayKeHoach: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      <ScanCollectModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Quét QR code phần — Release 1"
        help="Quét QR code phần để chọn đợt vải lẻ (mọi đợt chưa release của phần in đó). Quét nhiều rồi bấm Release để release tất cả cùng lúc."
        rows={rows}
        getId={(r) => r.dot_vai_id}
        getCodes={(r) => [r.ma_phan]}
        matchMultiple
        isSelected={(r) => !!selected[r.dot_vai_id]}
        onToggle={(r) => toggle(r)}
        primaryLabel={(r) => r.ma_phan || '—'}
        secondaryLabel={(r) => [r.ten_khach_hang, r.mau_vai, r.kich_vai].filter(Boolean).join(' · ')}
        onConfirm={() => { setScanOpen(false); openReleaseAll(); }}
        confirmLabel="Release"
      />

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)} title="Lịch sử Release 1" fetcher={release1History} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã Release 1" maHeader="Lệnh" fetcher={release1Done} />
      <Toast toast={toast} />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{value || '—'}</div>
    </div>
  );
}
