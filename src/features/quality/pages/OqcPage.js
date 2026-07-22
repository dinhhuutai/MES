import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import OwnerHint from '../../../components/common/OwnerHint';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Field, Input, Textarea } from '../../../components/common/controls';
import SearchableSelect from '../../../components/common/SearchableSelect';
import QrScanner from '../../../components/common/QrScanner';
import DateRangePicker from '../../../components/common/DateRangePicker';
import TinhChatInCell from '../../../components/common/TinhChatInCell';
import HanGiaoCell from '../../../components/common/HanGiaoCell';
import FieldFilters, { FilterToggle } from '../../../components/common/FieldFilters';
import Icon from '../../../components/common/Icon';
import useToast from '../../../hooks/useToast';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import usePermissions from '../../../hooks/usePermissions';
import { listOqcCandidates, recordOqc, oqcHistory, oqcDone, returnOqcToKcs } from '../../../services/qualityService';
import { listUserOptions } from '../../../services/userService';
import { fmtNum, baseMaTem } from '../../../utils/format';

const FILTER_FIELDS = [
  { key: 'khach', label: 'Khách hàng' }, { key: 'don', label: 'Đơn hàng' }, { key: 'maHang', label: 'Mã hàng' },
  { key: 'mauVai', label: 'Màu vải' }, { key: 'kichVai', label: 'Kích vải' }, { key: 'kichPhim', label: 'Kích phim' },
];

export default function OqcPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const canOqc = can('OQC');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState(() => ({ from: '', to: '' }));
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ soLuongKiem: '', soLuongDat: '', ketQua: 'DAT', ownerChoGiaoId: '', lyDoChoGiao: '' });
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnMode, setReturnMode] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  // Danh sách người để chọn owner. Dùng /users/options (chỉ cần đăng nhập) — endpoint /users cũ đòi
  // quyền USER_VIEW mà role QA/OQC không có ⇒ 403 → combobox rỗng, gõ tên không ra ai.
  // Lỗi tải phải BÁO, không nuốt im lặng như trước.
  useEffect(() => {
    listUserOptions({ limit: 500 })
      .then((r) => setUsers(r.data || []))
      .catch((e) => show(e.message || 'Không tải được danh sách người dùng', 'error'));
  }, [show]);

  const rangeKey = useMemo(() => `${range.from || ''}|${range.to || ''}`, [range]);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const activeCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);
  const setField = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const clearFilters = () => setFilters({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOqcCandidates({ search, ...filters, ngayTu: range.from || undefined, ngayDen: range.to || undefined });
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filtersKey, rangeKey, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // row = display-row đã tách nguồn (có nguon + con_src + ma_tem_display).
  const open = (row) => {
    setEditing(row);
    setReturnMode(false);
    setReturnReason('');
    const con = row.con_src ?? row.con_oqc ?? row.so_luong ?? '';
    setForm({ soLuongKiem: String(con), soLuongDat: String(con), ketQua: 'DAT', ownerChoGiaoId: '', lyDoChoGiao: '' });
  };

  // Tách mỗi tem thành tối đa 2 dòng theo NGUỒN: KCS-đạt (tem 15-) & Sửa-đạt (tem 17-).
  const displayRows = rows.flatMap((r) => {
    const out = [];
    const kcs = Number(r.con_oqc_kcs) || 0;
    const sua = Number(r.con_oqc_sua) || 0;
    if (kcs > 0) out.push({ ...r, _key: `${r.tem_id}-KCS`, nguon: 'KCS', con_src: kcs, ma_tem_display: `15-${r.ma_tem}` });
    if (sua > 0) out.push({ ...r, _key: `${r.tem_id}-SUA`, nguon: 'SUA', con_src: sua, ma_tem_display: `17-${r.ma_tem}` });
    // Dữ liệu cũ (chưa chạy mig 047 → 2 cột null): fallback 1 dòng gộp coi như nguồn KCS.
    if (out.length === 0 && (Number(r.con_oqc) || 0) > 0) {
      out.push({ ...r, _key: `${r.tem_id}-KCS`, nguon: 'KCS', con_src: Number(r.con_oqc), ma_tem_display: `15-${r.ma_tem}` });
    }
    return out;
  });

  // Quét QR (ma_tem) → tra tem đang chờ OQC → mở modal nhập (ưu tiên nguồn KCS nếu còn).
  const onScan = async (maTem) => {
    setScanOpen(false);
    const code = baseMaTem(maTem); // QR có thể mã hóa '15-/17-TEM...'; tách lấy mã gốc
    if (!code) return;
    try {
      const res = await listOqcCandidates({ search: code });
      const r = (res.data || []).find((x) => (x.ma_tem || '').toLowerCase() === code.toLowerCase());
      if (!r) { show(`Tem ${code} không có phần chờ OQC`, 'error'); return; }
      const kcs = Number(r.con_oqc_kcs) || 0;
      const sua = Number(r.con_oqc_sua) || 0;
      if (kcs > 0) open({ ...r, nguon: 'KCS', con_src: kcs, ma_tem_display: `15-${r.ma_tem}` });
      else if (sua > 0) open({ ...r, nguon: 'SUA', con_src: sua, ma_tem_display: `17-${r.ma_tem}` });
      else open({ ...r, nguon: 'KCS', con_src: Number(r.con_oqc) || 0, ma_tem_display: `15-${r.ma_tem}` });
    } catch (e) { show(e.message || 'Không tra được tem', 'error'); }
  };

  // Trạm nhận tem trả về = trạm trước của nguồn đang mở.
  const returnTram = editing?.nguon === 'SUA' ? 'Sửa' : 'KCS';

  // Trả về ĐÚNG trạm trước theo nguồn: tem 15- (KCS) → KCS · tem 17- (đã sửa) → Sửa.
  const doReturn = async () => {
    if (!returnReason.trim()) { show(`Nhập lý do trả về ${returnTram}`, 'error'); return; }
    setSaving(true);
    try {
      await returnOqcToKcs(editing.tem_id, { lyDo: returnReason.trim(), nguon: editing.nguon });
      show(`Đã trả tem ${editing.ma_tem_display || editing.ma_tem} về ${returnTram}`);
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Trả về thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await recordOqc(editing.tem_id, { ...form, nguon: editing.nguon });
      const map = {
        OQC_DAT: 'OQC đạt ✓ → TOÀN BỘ lô qua giao',
        CHO_GIAO_NGOAI_LE: 'không đạt → CHO GIAO NGOẠI LỆ toàn bộ (có owner)',
        GIU_OQC: 'không đạt → cả lô nằm lại OQC (chưa có owner cho giao)',
      };
      show(`OQC ${editing.ma_tem_display || editing.ma_tem}: ${map[r.data.next] || r.data.next}`, r.data.next === 'GIU_OQC' ? 'warning' : 'success');
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'ma_tem', header: 'Tem', render: (r) => (
      <div className="flex items-center gap-1.5">
        <Badge tone={r.nguon === 'SUA' ? 'warning' : 'info'}>{r.ma_tem_display || r.ma_tem}</Badge>
        <span className="text-[11px] text-ink-soft">{r.nguon === 'SUA' ? 'đã sửa' : 'từ KCS'}</span>
      </div>
    ) },
    { key: 'khach_don', header: 'Khách hàng · Đơn hàng', render: (r) => (
      <div className="leading-tight">
        <div className="font-medium text-ink">{r.ten_khach_hang || '—'}</div>
        <div className="text-xs text-ink-soft">{r.ma_don_hang || '—'}</div>
      </div>
    ) },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_kich', header: 'Màu · Kích (vải/phim)', render: (r) => (
      <div className="leading-tight">
        <div className="text-ink">{r.mau_vai || '—'}</div>
        <div className="text-xs text-ink-soft">{[r.kich_vai, r.kich_phim].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    ) },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
    { key: 'nguoi_truoc', header: 'Người XN trạm trước', render: (r) => r.nguoi_truoc || '—' },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'con_src', header: 'Còn OQC', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.con_src ?? r.con_oqc) },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canOqc && <Button className="px-3 py-1.5" onClick={() => open(r)}>Kiểm OQC</Button> },
  ];

  return (
    <div>
      <Toolbar title="OQC — Kiểm cuối" subtitle="Kiểm cuối theo tem trước giao hàng"
        search={search} onSearch={setSearch} searchPlaceholder="Quét/nhập mã tem...">
        {canOqc && <Button variant="secondary" icon="scan-line" onClick={() => setScanOpen(true)}>Quét QR</Button>}
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span>Ngày in tem</span>
          <div className="w-60"><DateRangePicker value={range} onChange={setRange} placeholder="Chọn khoảng ngày in tem" /></div>
          {(range.from || range.to) && <button type="button" onClick={() => setRange({ from: '', to: '' })} className="text-ink-soft hover:text-danger" aria-label="Bỏ lọc ngày"><Icon name="x" size={14} /></button>}
        </div>
        <FilterToggle open={showFilters} count={activeCount} onClick={() => setShowFilters((v) => !v)} />
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{displayRows.length} dòng chờ OQC</Badge>
      </Toolbar>

      <FieldFilters fields={FILTER_FIELDS} values={filters} onField={setField} onClear={clearFilters} open={showFilters} />

      <OwnerHint tram="OQC" className="mb-3" />

      <DataTable columns={columns} rows={displayRows} loading={loading} rowKey="_key"
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có tem nào chờ OQC" />

      <SidePanel
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`OQC — ${editing?.ma_tem_display || editing?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving} variant={form.ketQua === 'DAT' ? 'primary' : 'danger'}>
              {form.ketQua === 'DAT'
                ? 'Xác nhận đạt'
                : form.ownerChoGiaoId ? 'Xác nhận cho giao' : 'Xác nhận (nằm lại OQC)'}
            </Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {editing?.ma_lenh_san_xuat} · {editing?.phan_list} · SL in {fmtNum(editing?.so_luong)}
          <span className="ml-1 font-semibold text-primary">· cả lô chờ OQC {fmtNum(editing?.con_src ?? editing?.con_oqc)}</span>
          <span className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${editing?.nguon === 'SUA' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
            {editing?.nguon === 'SUA' ? 'Nguồn đã sửa (17-)' : 'Nguồn từ KCS (15-)'}
          </span>
        </div>
        <div className="mb-1 rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
          Kiểm <b>bốc mẫu</b>: chọn <b>Đạt</b> → <b>toàn bộ {fmtNum(editing?.con_src ?? editing?.con_oqc)} pcs</b> của lô qua giao. Chọn <b>Không đạt</b> → cả lô không đạt.
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="SL bốc mẫu" hint="Số lấy mẫu ra kiểm (SL đạt tự nhảy theo)">
            <Input type="number" min="0" value={form.soLuongKiem}
              onChange={(e) => setForm({ ...form, soLuongKiem: e.target.value, soLuongDat: e.target.value })} />
          </Field>
          <Field label="SL đạt trong mẫu" hint="≤ SL bốc mẫu">
            <Input type="number" min="0" value={form.soLuongDat} onChange={(e) => setForm({ ...form, soLuongDat: e.target.value })} />
          </Field>
        </div>
        <Field label="Kết quả">
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...form, ketQua: 'DAT' })}
              className={`flex-1 rounded-control border px-4 py-2.5 text-sm font-semibold transition ${
                form.ketQua === 'DAT' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-line text-ink-soft'
              }`}>Đạt</button>
            <button type="button" onClick={() => setForm({ ...form, ketQua: 'KHONG_DAT' })}
              className={`flex-1 rounded-control border px-4 py-2.5 text-sm font-semibold transition ${
                form.ketQua === 'KHONG_DAT' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-line text-ink-soft'
              }`}>Không đạt</button>
          </div>
        </Field>

        {form.ketQua === 'KHONG_DAT' && (
          <div className="rounded-control border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
            <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              Không đạt: muốn <b>vẫn cho giao</b> (giao đặc biệt) thì chọn <b>owner chịu trách nhiệm</b> + nhập <b>lý do</b>.
              Bỏ trống owner → tem <b>nằm lại OQC</b>.
            </p>
            <Field label="Owner cho giao (chịu trách nhiệm)" required>
              <SearchableSelect
                value={form.ownerChoGiaoId}
                onChange={(v) => setForm({ ...form, ownerChoGiaoId: v })}
                options={users}
                getValue={(u) => u.id}
                getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''}
                getSearch={(u) => `${u.ho_ten || ''} ${u.ten_dang_nhap || ''}`}
                placeholder="Gõ tên hoặc tên đăng nhập để tìm..."
              />
            </Field>
            <Field label="Lý do cho giao" required>
              <Textarea rows={2} value={form.lyDoChoGiao} onChange={(e) => setForm({ ...form, lyDoChoGiao: e.target.value })}
                placeholder="Vì sao cho giao dù không đạt..." />
            </Field>
          </div>
        )}

        <p className="text-xs text-ink-soft">Đạt → toàn bộ lô qua giao. Không đạt: có <b>owner + lý do</b> → cho giao ngoại lệ toàn bộ; không có → cả lô nằm lại OQC.</p>

        {/* Trả về trạm trước theo nguồn — tem 15- về KCS, tem 17- về Sửa (kèm lý do) */}
        <div className="mt-3 border-t border-line pt-3">
          {!returnMode ? (
            <button type="button" onClick={() => setReturnMode(true)}
              className="text-xs font-medium text-danger hover:underline">↩ Trả về {returnTram}</button>
          ) : (
            <div className="rounded-control border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/40">
              <p className="mb-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                Trả <b>toàn bộ {fmtNum(editing?.con_src ?? editing?.con_oqc)} pcs</b> của lô{' '}
                {editing?.nguon === 'SUA' ? <>đã sửa (tem 17-) về <b>Sửa</b> để sửa lại</> : <>từ KCS (tem 15-) về <b>KCS</b> để kiểm lại</>} (kèm lý do bắt buộc).
              </p>
              <Field label={`Lý do trả về ${returnTram}`} required>
                <Textarea rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                  placeholder={`Vì sao trả về ${returnTram}...`} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" className="px-3 py-1.5" onClick={() => { setReturnMode(false); setReturnReason(''); }}>Hủy</Button>
                <Button variant="danger" className="px-3 py-1.5" onClick={doReturn} loading={saving} disabled={!returnReason.trim()}>Trả về {returnTram}</Button>
              </div>
            </div>
          )}
        </div>
      </SidePanel>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử OQC" fetcher={oqcHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Tem đã OQC" maHeader="Tem" fetcher={oqcDone}
        columns={[
          { key: 'ma', header: 'Tem', className: 'whitespace-nowrap', render: (r) => <Badge tone={r.nguon === 'SUA' ? 'warning' : 'info'}>{(r.nguon === 'SUA' ? '17-' : '15-') + (r.ma || '')}</Badge> },
          { key: 'nguon', header: 'Nguồn', render: (r) => (r.nguon === 'SUA' ? 'Sửa' : 'KCS') },
          { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
          { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
          { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
          { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
          { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
          { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
          { key: 'tinh_chat_in', header: 'Tính chất in', render: (r) => <TinhChatInCell value={r.tinh_chat_in} /> },
          { key: 'so_luong', header: 'SL đạt', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
          { key: 'sl_qua_giao', header: 'SL qua giao', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.sl_qua_giao) },
          { key: 'han_giao_hang', header: 'Hạn giao', render: (r) => <HanGiaoCell value={r.han_giao_hang} /> },
          { key: 'tg', header: 'Giờ HT', className: 'whitespace-nowrap tabular-nums', render: (r) => (r.tg ? new Date(r.tg).toLocaleTimeString('vi-VN') : '') },
          { key: 'nguoi', header: 'Người', render: (r) => r.nguoi || '—' },
        ]}
        excelColumns={[
          { header: 'Tem', value: (r) => (r.nguon === 'SUA' ? '17-' : '15-') + (r.ma || '') },
          { header: 'Nguồn', value: (r) => (r.nguon === 'SUA' ? 'Sửa' : 'KCS') },
          { header: 'Khách hàng', value: (r) => r.ten_khach_hang || '' },
          { header: 'Đơn hàng', value: (r) => r.ma_don_hang || '' },
          { header: 'Mã hàng', value: (r) => r.ma_hang || '' },
          { header: 'Màu vải', value: (r) => r.mau_vai || '' },
          { header: 'Kích vải', value: (r) => r.kich_vai || '' },
          { header: 'Kích phim', value: (r) => r.kich_phim || '' },
          { header: 'Tính chất in', value: (r) => r.tinh_chat_in || '' },
          { header: 'SL đạt', value: (r) => Number(r.so_luong) || 0, num: true },
          { header: 'SL qua giao', value: (r) => Number(r.sl_qua_giao) || 0, num: true },
          { header: 'Hạn giao', value: (r) => r.han_giao_hang || '', type: 'date' },
          { header: 'Người', value: (r) => r.nguoi || '' },
        ]} />

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={onScan} />

      <Toast toast={toast} />
    </div>
  );
}
