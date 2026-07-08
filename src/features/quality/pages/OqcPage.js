import { useEffect, useState, useCallback } from 'react';
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
import Icon from '../../../components/common/Icon';
import useToast from '../../../hooks/useToast';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import usePermissions from '../../../hooks/usePermissions';
import { listOqcCandidates, recordOqc, oqcHistory, oqcDone, listGiaoDacBietActive, returnOqcToKcs } from '../../../services/qualityService';
import { listUsers } from '../../../services/userService';
import { fmtNum } from '../../../utils/format';

export default function OqcPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const canOqc = can('OQC');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ngay, setNgay] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ soLuongKiem: '', soLuongDat: '', soLuongLoi: '', ketQua: 'DAT', ownerChoGiaoId: '', truongHopGiaoId: '', lyDoChoGiao: '' });
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [truongHopList, setTruongHopList] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnMode, setReturnMode] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => { listUsers({ limit: 500 }).then((r) => setUsers(r.data.items || r.data || [])).catch(() => {}); }, []);
  useEffect(() => { listGiaoDacBietActive().then((r) => setTruongHopList(r.data || [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOqcCandidates({ search, ngay: ngay || undefined });
      setRows(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, ngay, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const open = (row) => {
    setEditing(row);
    setReturnMode(false);
    setReturnReason('');
    const con = row.con_oqc ?? row.so_luong ?? '';
    setForm({ soLuongKiem: String(con), soLuongDat: String(con), soLuongLoi: '', ketQua: 'DAT', ownerChoGiaoId: '', truongHopGiaoId: '', lyDoChoGiao: '' });
  };

  // Quét QR (ma_tem) → tra tem đang chờ OQC → mở modal nhập.
  const onScan = async (maTem) => {
    setScanOpen(false);
    const code = (maTem || '').trim();
    if (!code) return;
    try {
      const res = await listOqcCandidates({ search: code });
      const row = (res.data || []).find((r) => (r.ma_tem || '').toLowerCase() === code.toLowerCase());
      if (row) open(row);
      else show(`Tem ${code} không có phần chờ OQC`, 'error');
    } catch (e) { show(e.message || 'Không tra được tem', 'error'); }
  };

  const doReturnKcs = async () => {
    if (!returnReason.trim()) { show('Nhập lý do trả về KCS', 'error'); return; }
    setSaving(true);
    try {
      await returnOqcToKcs(editing.tem_id, { lyDo: returnReason.trim() });
      show(`Đã trả tem ${editing.ma_tem} về KCS`);
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
      const r = await recordOqc(editing.tem_id, form);
      const map = {
        OQC_DAT: 'OQC đạt ✓ → sẵn sàng giao',
        CHO_GIAO_NGOAI_LE: 'không đạt → CHO GIAO NGOẠI LỆ (có owner)',
        GIU_OQC: 'không đạt → nằm lại OQC (chưa có owner cho giao)',
      };
      show(`OQC ${editing.ma_tem}: ${map[r.data.next] || r.data.next}`, r.data.next === 'GIU_OQC' ? 'warning' : 'success');
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone="info">{r.ma_tem}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'con_oqc', header: 'Còn OQC', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.con_oqc) },
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
          <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)}
            className="h-9 rounded-input border border-line bg-surface px-2 text-sm" />
          {ngay && <button type="button" onClick={() => setNgay('')} className="text-ink-soft hover:text-danger" aria-label="Xóa lọc ngày"><Icon name="x" size={14} /></button>}
        </div>
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{rows.length} tem chờ OQC</Badge>
      </Toolbar>

      <OwnerHint tram="OQC" className="mb-3" />

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="tem_id"
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có tem nào chờ OQC" />

      <SidePanel
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`OQC — ${editing?.ma_tem || ''}`}
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
          <span className="ml-1 font-semibold text-primary">· còn chờ OQC {fmtNum(editing?.con_oqc)}</span>
        </div>
        <div className="grid grid-cols-3 gap-x-4">
          <Field label="SL kiểm">
            <Input type="number" min="0" value={form.soLuongKiem} onChange={(e) => setForm({ ...form, soLuongKiem: e.target.value })} />
          </Field>
          <Field label="SL đạt">
            <Input type="number" min="0" value={form.soLuongDat} onChange={(e) => setForm({ ...form, soLuongDat: e.target.value })} />
          </Field>
          <Field label="SL lỗi">
            <Input type="number" min="0" value={form.soLuongLoi} onChange={(e) => setForm({ ...form, soLuongLoi: e.target.value })} />
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
              Không đạt: muốn <b>vẫn cho giao</b> (giao đặc biệt) thì chọn <b>owner cho giao</b> + <b>trường hợp</b> + nhập <b>lý do</b>.
              Bỏ trống owner → tem <b>nằm lại OQC</b>.
            </p>
            <Field label="Owner cho giao (chịu trách nhiệm)">
              <SearchableSelect
                value={form.ownerChoGiaoId}
                onChange={(v) => setForm({ ...form, ownerChoGiaoId: v })}
                options={users}
                getValue={(u) => u.id}
                getLabel={(u) => u.ho_ten || u.ten_dang_nhap || ''}
                placeholder="Gõ tên để tìm người..."
              />
            </Field>
            <Field label="Trường hợp giao đặc biệt" hint="Bắt buộc khi cho giao (chọn owner)">
              <SearchableSelect
                value={form.truongHopGiaoId}
                onChange={(v) => setForm({ ...form, truongHopGiaoId: v })}
                options={truongHopList}
                getValue={(t) => t.id}
                getLabel={(t) => t.ten || ''}
                placeholder="Chọn trường hợp (Ban giám đốc ký, Trễ hạn KH...)"
              />
            </Field>
            <Field label="Lý do cho giao">
              <Textarea rows={2} value={form.lyDoChoGiao} onChange={(e) => setForm({ ...form, lyDoChoGiao: e.target.value })}
                placeholder="Vì sao cho giao dù không đạt..." />
            </Field>
          </div>
        )}

        <p className="text-xs text-ink-soft">Đạt → sẵn sàng giao. Không đạt: có owner + trường hợp + lý do → cho giao ngoại lệ; không có → nằm lại OQC.</p>

        {/* Trả về KCS (kèm lý do) */}
        <div className="mt-3 border-t border-line pt-3">
          {!returnMode ? (
            <button type="button" onClick={() => setReturnMode(true)}
              className="text-xs font-medium text-danger hover:underline">↩ Trả về KCS</button>
          ) : (
            <div className="rounded-control border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/40">
              <p className="mb-2 text-xs font-medium text-rose-700 dark:text-rose-300">Trả tem về KCS để kiểm/khắc phục lại (kèm lý do bắt buộc).</p>
              <Field label="Lý do trả về KCS" required>
                <Textarea rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Vì sao trả về KCS..." />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" className="px-3 py-1.5" onClick={() => { setReturnMode(false); setReturnReason(''); }}>Hủy</Button>
                <Button variant="danger" className="px-3 py-1.5" onClick={doReturnKcs} loading={saving} disabled={!returnReason.trim()}>Trả về KCS</Button>
              </div>
            </div>
          )}
        </div>
      </SidePanel>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử OQC" fetcher={oqcHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Tem đã OQC" maHeader="Tem" fetcher={oqcDone} />

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={onScan} />

      <Toast toast={toast} />
    </div>
  );
}
