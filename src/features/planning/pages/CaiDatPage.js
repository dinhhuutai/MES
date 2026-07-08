import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import { Field, Input, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listCaTuan, saveCaTuan } from '../../../services/planningService';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ISO 8601 week + year (khớp EXTRACT(WEEK/ISOYEAR) của Postgres).
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { nam: isoYear, tuan: week };
}
// Khoảng Thứ 2 – Chủ nhật của tuần chứa `date`.
function weekRange(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const f = (x) => `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`;
  return `${f(mon)} – ${f(sun)}`;
}
const CA_LABEL = { NGAN: 'Ngắn (3 ca)', DAI: 'Dài (2 ca)' };

export default function CaiDatPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canEdit = can('RELEASE1') || can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ngay, setNgay] = useState(todayStr());
  const [loaiCa, setLoaiCa] = useState('NGAN');
  const [ghiChu, setGhiChu] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCaTuan();
      setRows(res.data || []);
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); } finally { setLoading(false); }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const wk = isoWeek(new Date(ngay));

  const submit = async () => {
    setSaving(true);
    try {
      await saveCaTuan({ nam: wk.nam, tuan: wk.tuan, loaiCa, ghiChu });
      show(`Đã lưu ca ${CA_LABEL[loaiCa]} cho tuần ${wk.tuan}/${wk.nam}`);
      setGhiChu('');
      load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); } finally { setSaving(false); }
  };

  // Ước lượng 1 ngày trong tuần (nam/tuan) để hiện khoảng ngày ở bảng.
  const dateOfWeek = (nam, tuan) => {
    const simple = new Date(Date.UTC(nam, 0, 1 + (tuan - 1) * 7));
    const day = simple.getUTCDay() || 7;
    simple.setUTCDate(simple.getUTCDate() - day + 1 + 3); // Thứ 5 trong tuần ISO
    return simple;
  };

  const columns = [
    { key: 'tuan', header: 'Tuần', render: (r) => <span className="font-medium text-ink">Tuần {r.tuan}/{r.nam}</span> },
    { key: 'khoang', header: 'Khoảng ngày', render: (r) => weekRange(dateOfWeek(r.nam, r.tuan)) },
    { key: 'loai_ca', header: 'Loại ca', render: (r) => (
      <Badge tone={r.loai_ca === 'DAI' ? 'warning' : 'info'}>{CA_LABEL[r.loai_ca] || r.loai_ca}</Badge>
    ) },
    { key: 'ghi_chu', header: 'Ghi chú', render: (r) => r.ghi_chu || '—' },
  ];

  return (
    <div>
      <Toolbar title="Cài đặt ca sản xuất" subtitle="Chọn tuần đi ca Ngắn hay Dài — ca của tem suy theo giờ sản xuất + loại ca tuần đó" />

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-control border border-line bg-surface p-3 text-xs">
          <div className="mb-1 font-semibold text-ink">Ca Ngắn (3 ca)</div>
          <div className="text-ink-soft">Ca 1: 6h–14h · Ca 2: 14h–22h · Ca 3: 22h–6h</div>
        </div>
        <div className="rounded-control border border-line bg-surface p-3 text-xs">
          <div className="mb-1 font-semibold text-ink">Ca Dài (2 ca)</div>
          <div className="text-ink-soft">Ca 1: 6h–18h · Ca 2: 18h–6h</div>
        </div>
        <div className="rounded-control border border-line bg-surface p-3 text-xs">
          <div className="mb-1 font-semibold text-ink">Ghi chú</div>
          <div className="text-ink-soft">Tuần chưa cài mặc định đi ca <b>Ngắn</b>. Sản xuất chỉ theo Ngắn/Dài.</div>
        </div>
      </div>

      {canEdit && (
        <div className="mb-5 card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Cài ca cho tuần</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Chọn 1 ngày trong tuần">
              <Input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
            </Field>
            <Field label="Tuần">
              <div className="flex h-11 items-center rounded-input border border-line bg-surface-muted px-3 text-sm text-ink">
                Tuần {wk.tuan}/{wk.nam} · {weekRange(new Date(ngay))}
              </div>
            </Field>
            <Field label="Loại ca">
              <div className="flex gap-2">
                {['NGAN', 'DAI'].map((v) => (
                  <button key={v} type="button" onClick={() => setLoaiCa(v)}
                    className={`flex-1 rounded-control border px-3 py-2.5 text-sm font-semibold transition ${
                      loaiCa === v ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft'
                    }`}>{v === 'NGAN' ? 'Ngắn' : 'Dài'}</button>
                ))}
              </div>
            </Field>
            <Field label="Ghi chú (tùy chọn)">
              <Textarea rows={1} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú..." />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={submit} loading={saving}>Lưu cài đặt tuần {wk.tuan}/{wk.nam}</Button>
          </div>
        </div>
      )}

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Các tuần đã cài</div>
      <DataTable columns={columns} rows={rows} loading={loading} rowKey="id"
        onRowClick={(r) => { setLoaiCa(r.loai_ca); setGhiChu(r.ghi_chu || ''); setNgay(todayStr()); }}
        emptyText="Chưa cài ca cho tuần nào (mặc định Ngắn)" />

      <Toast toast={toast} />
    </div>
  );
}
