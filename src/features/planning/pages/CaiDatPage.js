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
const CA_LABEL = { NGAN: 'Ngắn (3 ca)', DAI: 'Dài (2 ca)', HANH_CHINH: 'Hành chính' };
const CA_OPTIONS = [
  { v: 'NGAN', label: 'Ngắn' },
  { v: 'DAI', label: 'Dài' },
  { v: 'HANH_CHINH', label: 'Hành chính' },
];
// Cài ca RIÊNG theo loại chuyền (mig 112, 07/10/2026) — gương backend `utils/ca.js LOAI_CHUYEN_CA`. Loại
// khác (Máy tròn, Logo, Ép, Gia công) luôn theo ca CHUNG của tuần.
const LOAI_CHUYEN = [
  { v: 'MAY', label: 'Máy' },
  { v: 'BAN', label: 'Bàn' },
  { v: 'ROBOT', label: 'Robot' },
];
const toneCa = (ca) => (ca === 'DAI' ? 'warning' : ca === 'HANH_CHINH' ? 'success' : 'info');

// Gom dòng `cai_dat_ca_tuan` (1 dòng / tuần × loại chuyền) thành 1 dòng / tuần: { chung, rieng: {MAY…} }.
function gomTheoTuan(rows) {
  const m = new Map();
  rows.forEach((r) => {
    const k = `${r.nam}-${r.tuan}`;
    if (!m.has(k)) m.set(k, { id: k, nam: r.nam, tuan: r.tuan, chung: null, rieng: {}, ghi_chu: null });
    const g = m.get(k);
    if (r.loai_chuyen) g.rieng[r.loai_chuyen] = r.loai_ca;
    else { g.chung = r.loai_ca; g.ghi_chu = r.ghi_chu; }
    if (!g.ghi_chu && r.ghi_chu) g.ghi_chu = r.ghi_chu;
  });
  return [...m.values()].sort((a, b) => b.nam - a.nam || b.tuan - a.tuan);
}

export default function CaiDatPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canEdit = can('RELEASE1') || can('RELEASE2');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ngay, setNgay] = useState(todayStr());
  const [loaiCa, setLoaiCa] = useState('NGAN');
  const [apCho, setApCho] = useState([]); // [] = tất cả chuyền (CHUNG) · ['MAY', 'BAN'…] = riêng loại chuyền
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
  const tuanRows = gomTheoTuan(rows);
  const batLoai = (v) => setApCho((ds) => (ds.includes(v) ? ds.filter((x) => x !== v) : [...ds, v]));
  const tenApCho = apCho.length ? LOAI_CHUYEN.filter((x) => apCho.includes(x.v)).map((x) => x.label).join(', ') : 'tất cả chuyền';

  const submit = async () => {
    setSaving(true);
    try {
      await saveCaTuan({ nam: wk.nam, tuan: wk.tuan, loaiCa, ghiChu, loaiChuyen: apCho });
      show(`Đã lưu ca ${CA_LABEL[loaiCa]} cho ${tenApCho} — tuần ${wk.tuan}/${wk.nam}`);
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

  // Ô của 1 loại chuyền = ca riêng nếu có, không thì ca CHUNG (chữ mờ "theo chung"), không có gì ⇒ Ngắn mặc định.
  const oLoai = (r, lc) => {
    const ca = r.rieng[lc] || r.chung || 'NGAN';
    const rieng = !!r.rieng[lc];
    return (
      <div className="flex flex-col items-start gap-0.5">
        <Badge tone={rieng ? toneCa(ca) : 'default'}>{CA_LABEL[ca] || ca}</Badge>
        {!rieng && <span className="text-[11px] text-ink-soft">{r.chung ? 'theo chung' : 'mặc định'}</span>}
      </div>
    );
  };
  const columns = [
    { key: 'tuan', header: 'Tuần', render: (r) => <span className="font-medium text-ink">Tuần {r.tuan}/{r.nam}</span> },
    { key: 'khoang', header: 'Khoảng ngày', render: (r) => weekRange(dateOfWeek(r.nam, r.tuan)) },
    { key: 'chung', header: 'Chung (mọi chuyền)', render: (r) => (r.chung
      ? <Badge tone={toneCa(r.chung)}>{CA_LABEL[r.chung] || r.chung}</Badge>
      : <span className="text-xs text-ink-soft">Ngắn (mặc định)</span>) },
    ...LOAI_CHUYEN.map((l) => ({ key: `lc_${l.v}`, header: l.label, render: (r) => oLoai(r, l.v) })),
    { key: 'ghi_chu', header: 'Ghi chú', render: (r) => r.ghi_chu || '—' },
  ];

  return (
    <div>
      <Toolbar title="Cài đặt ca sản xuất" subtitle="Chọn tuần đi ca Ngắn / Dài / Hành chính cho cả xưởng hoặc riêng chuyền Máy / Bàn / Robot" />

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
          <div className="mb-1 font-semibold text-ink">Ca Hành chính</div>
          <div className="text-ink-soft">Hành chính: 7h30–16h30 · Tăng ca: 16h30–20h</div>
        </div>
      </div>
      <div className="mb-4 rounded-control border border-line bg-surface p-3 text-xs">
        <span className="font-semibold text-ink">Ghi chú: </span>
        <span className="text-ink-soft">
          Tuần chưa cài mặc định đi ca <b>Ngắn</b>. Chuyền Máy / Bàn / Robot cài riêng thì theo cài riêng, còn lại theo
          ca <b>chung</b> của tuần (Máy tròn, Logo, Ép, Gia công luôn theo chung). Lưu cho <b>tất cả chuyền</b> sẽ đưa
          cả các cài riêng của tuần đó về cùng loại ca.
        </span>
      </div>

      {canEdit && (
        <div className="mb-5 card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Cài ca cho tuần</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Chọn 1 ngày trong tuần">
              <Input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
            </Field>
            <Field label="Tuần">
              <div className="flex h-11 items-center rounded-input border border-line bg-surface-muted px-3 text-sm text-ink">
                Tuần {wk.tuan}/{wk.nam} · {weekRange(new Date(ngay))}
              </div>
            </Field>
            <Field label="Áp cho loại chuyền">
              <div className="flex gap-2">
                <button type="button" onClick={() => setApCho([])}
                  className={`flex-1 rounded-control border px-2 py-2.5 text-sm font-semibold transition ${
                    !apCho.length ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft'
                  }`}>Tất cả</button>
                {LOAI_CHUYEN.map((o) => (
                  <button key={o.v} type="button" onClick={() => batLoai(o.v)}
                    className={`flex-1 rounded-control border px-2 py-2.5 text-sm font-semibold transition ${
                      apCho.includes(o.v) ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft'
                    }`}>{o.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Loại ca">
              <div className="flex gap-2">
                {CA_OPTIONS.map((o) => (
                  <button key={o.v} type="button" onClick={() => setLoaiCa(o.v)}
                    className={`flex-1 rounded-control border px-2 py-2.5 text-sm font-semibold transition ${
                      loaiCa === o.v ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft'
                    }`}>{o.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Ghi chú (tùy chọn)">
              <Textarea rows={1} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú..." />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={submit} loading={saving}>Lưu ca {tenApCho} · tuần {wk.tuan}/{wk.nam}</Button>
          </div>
        </div>
      )}

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Các tuần đã cài</div>
      <DataTable columns={columns} rows={tuanRows} loading={loading} rowKey="id"
        onRowClick={(r) => { setLoaiCa(r.chung || 'NGAN'); setApCho([]); setGhiChu(r.ghi_chu || ''); setNgay(todayStr()); }}
        emptyText="Chưa cài ca cho tuần nào (mặc định Ngắn)" />

      <Toast toast={toast} />
    </div>
  );
}
