import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Pagination from '../../../components/common/Pagination';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import Icon from '../../../components/common/Icon';
import HistoryPanel from '../../../components/common/HistoryPanel';
import { Field, Input, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import {
  listRelease1Candidates, createRelease1, listChuyen, release1History,
  listReleaseSets, releaseSet,
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

const TH = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft';
const TD = 'px-4 py-3 align-middle';

// Các ô dữ liệu chung cho cả row lẻ lẫn member của set.
function DataCells({ r }) {
  return (
    <>
      <td className={`${TD} font-medium text-ink`}>{r.ten_khach_hang || '—'}</td>
      <td className={TD}>{r.ma_don_hang || '—'}</td>
      <td className={TD}>{r.ma_hang || '—'}</td>
      <td className={TD}>{r.mau_vai || '—'}</td>
      <td className={TD}>{r.kich_vai || '—'}</td>
      <td className={TD}>{r.kich_phim || '—'}</td>
      <td className={`${TD} text-right tabular-nums`}>{fmtNum(r.so_luong_don_hang)}</td>
      <td className={`${TD} text-right tabular-nums`}>{fmtNum(r.so_luong_vai_ve)}</td>
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
  const [selected, setSelected] = useState({});      // dot_vai_id -> row (lẻ)
  const [selectedSets, setSelectedSets] = useState(() => new Set()); // set id
  const [chuyen, setChuyen] = useState([]);
  const [histOpen, setHistOpen] = useState(false);

  const [detail, setDetail] = useState(null);        // row lẻ đang xem
  const [form, setForm] = useState({ chuyenId: '', soLuongRelease: '', ngayKeHoach: '' });
  const [releaseOpen, setReleaseOpen] = useState(false); // modal release gộp
  const [relForm, setRelForm] = useState({ chuyenId: '', ngayKeHoach: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, setRes] = await Promise.all([
        listRelease1Candidates({ search, page, limit: 50 }),
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
    setForm({ chuyenId: chuyen[0]?.id || '', soLuongRelease: String(row.so_luong_vai_ve || ''), ngayKeHoach: dateOffsetStr(1) });
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

  const colCount = 11;

  return (
    <div>
      <Toolbar title="Release 1" subtitle="Phần in đã READY — chọn đợt vải/set & chuyền để release"
        search={search} onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm code phần, mã hàng, màu, kích...">
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{meta.total} đợt vải · {sets.length} set</Badge>
      </Toolbar>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-left">
                <th className={`${TH} w-10`}>
                  <SelectAllCheckbox checked={allChecked} indeterminate={!allChecked && someChecked} onChange={toggleAll} />
                </th>
                <th className={TH}>Khách hàng</th>
                <th className={TH}>Đơn hàng</th>
                <th className={TH}>Mã hàng</th>
                <th className={TH}>Màu vải</th>
                <th className={TH}>Kích vải</th>
                <th className={TH}>Kích phim</th>
                <th className={`${TH} text-right`}>SLĐH</th>
                <th className={`${TH} text-right`}>SLNV</th>
                <th className={TH}>Ngày nhận vải</th>
                <th className={TH}>Hạn giao</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colCount} className="px-4 py-12 text-center text-ink-soft"><Icon name="loader" size={22} className="mx-auto animate-spin" /></td></tr>
              ) : (sets.length === 0 && rows.length === 0) ? (
                <tr><td colSpan={colCount} className="px-4 py-12 text-center text-ink-soft">Không có đợt vải nào sẵn sàng Release 1</td></tr>
              ) : (
                <>
                  {/* Các SET — gộp nhóm như 1 khối, 1 checkbox hợp nhất */}
                  {sets.map((s) => s.members.map((m, i) => {
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
                        <DataCells r={m} />
                      </tr>
                    );
                  }))}

                  {/* Đợt vải lẻ */}
                  {rows.map((r) => (
                    <tr key={r.dot_vai_id} onClick={() => openDetail(r)}
                      className="cursor-pointer border-b border-line/70 transition hover:bg-surface-muted/40">
                      <td className={TD}>
                        <input type="checkbox" checked={!!selected[r.dot_vai_id]}
                          onClick={(e) => e.stopPropagation()} onChange={() => toggle(r)}
                          className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
                      </td>
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
          <Select value={relForm.chuyenId} onChange={(e) => setRelForm({ ...relForm, chuyenId: e.target.value })}>
            <option value="">— Chọn chuyền —</option>
            {chuyen.map((c) => <option key={c.id} value={c.id}>{c.ma_chuyen} — {c.ten_chuyen}</option>)}
          </Select>
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
              <Info label="Ngày nhận vải" value={fmtDate(detail.ngay_vai_ve)} />
              <Info label="Hạn giao" value={fmtDate(detail.han_giao_hang)} />
            </div>
            <div className="space-y-3 border-t border-line pt-4">
              <Field label="Chuyền in" required>
                <Select value={form.chuyenId} onChange={(e) => setForm({ ...form, chuyenId: e.target.value })}>
                  <option value="">— Chọn chuyền —</option>
                  {chuyen.map((c) => <option key={c.id} value={c.id}>{c.ma_chuyen} — {c.ten_chuyen}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-x-4">
                <Field label="Số lượng release">
                  <Input type="number" value={form.soLuongRelease} onChange={(e) => setForm({ ...form, soLuongRelease: e.target.value })} />
                </Field>
                <Field label="Ngày kế hoạch">
                  <Input type="date" value={form.ngayKeHoach} onChange={(e) => setForm({ ...form, ngayKeHoach: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)} title="Lịch sử Release 1" fetcher={release1History} />
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
