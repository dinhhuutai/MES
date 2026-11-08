import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import { Field, Input } from '../../../components/common/controls';
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
// Cài ca RIÊNG theo loại chuyền (mig 112, 07/10/2026) — gương backend `utils/ca.js NHOM_CA_RIENG`. `KHAC` (09/10/2026)
// = mọi loại chuyền còn lại (Gia công, Máy tròn, Logo, Ép…): mặc định HÀNH CHÍNH, KHÔNG theo ca chung.
const NHOM_KHAC = 'KHAC';
const CA_KHAC_MAC_DINH = 'HANH_CHINH';
const LOAI_CHUYEN = [
  { v: 'MAY', label: 'Máy', title: 'Các chuyền Máy + chuyền Bàn 1A1B (chạy theo ca của Máy)' },
  { v: 'BAN', label: 'Bàn' },
  { v: 'ROBOT', label: 'Robot' },
  { v: NHOM_KHAC, label: 'Khác', cot: 'Chuyền khác', title: 'Gia công · Máy tròn · Logo · Ép' },
];
// Nút chọn (áp cho loại chuyền / loại ca): co giãn đều nhưng không nhỏ hơn chữ — hẹp thì xuống dòng, không tràn.
const nutChon = (bat) => `min-w-[5.5rem] flex-1 whitespace-nowrap rounded-control border px-3 py-2.5 text-sm font-semibold transition ${
  bat ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft hover:border-primary/40'
}`;
const toneCa = (ca) => (ca === 'DAI' ? 'warning' : ca === 'HANH_CHINH' ? 'success' : 'info');
// CA ĐÊM "CA TRƯỚC / CA SAU" (08/11/2026, mig 125) — ca qua nửa đêm (Ca 3 Ngắn 22h–6h · Ca 2 Dài 18h–6h) thuộc ngày nào.
//   Gương backend `utils/ca.js` (CA_DEM). Hành chính không có ca đêm ⇒ không áp.
const CA_DEM_OPTIONS = [
  { v: 'SAU', label: 'Ca sau', title: 'Ca đêm thuộc NGÀY BẮT ĐẦU — ngày 08/11: D1 6h–18h ngày 08 · D2 18h ngày 08 → 6h ngày 09' },
  { v: 'TRUOC', label: 'Ca trước', title: 'Ca đêm thuộc NGÀY KẾT THÚC — ngày 08/11: D2 18h ngày 07 → 6h ngày 08 · D1 6h–18h ngày 08' },
];
const coCaDem = (ca) => ca === 'NGAN' || ca === 'DAI';

// THỪA HƯỞNG TUẦN TRƯỚC (21/10/2026) — GƯƠNG backend `utils/ca.js loaiCaChiTiet` (sửa 1 bên phải sửa bên kia):
//   tuần chưa cài cho nhóm ⇒ tuần GẦN NHẤT TRƯỚC ĐÓ có cài; chưa từng cài ⇒ mặc định (Ngắn · Khác = Hành chính).
//   "Có cài cho nhóm": Máy/Bàn/Robot = riêng ⇒ chung · Khác = riêng Khác · '' (chung) = chung.
// Trả { ca, dem: 'SAU' | 'TRUOC', nguon: 'TUAN' | 'THUA_HUONG' | 'MAC_DINH', nam, tuan } — `dem` lấy CÙNG dòng với `ca`.
function caHieuLuc(tuanRows, nam, tuan, nhom = '') {
  const ord = nam * 100 + tuan;
  const khoa = (r) => (nhom === NHOM_KHAC ? NHOM_KHAC : (nhom && r.rieng[nhom] ? nhom : ''));
  const giaTri = (r) => { const k = khoa(r); return k ? r.rieng[k] : (nhom === NHOM_KHAC ? null : r.chung); };
  const ds = tuanRows.filter((r) => giaTri(r) && r.nam * 100 + r.tuan <= ord)
    .sort((a, b) => (b.nam * 100 + b.tuan) - (a.nam * 100 + a.tuan));
  if (!ds.length) return { ca: nhom === NHOM_KHAC ? CA_KHAC_MAC_DINH : 'NGAN', dem: 'SAU', nguon: 'MAC_DINH' };
  const r = ds[0];
  const k = khoa(r);
  return {
    ca: giaTri(r), dem: (k ? r.demRieng[k] : r.demChung) === 'TRUOC' ? 'TRUOC' : 'SAU',
    nguon: r.nam === nam && r.tuan === tuan ? 'TUAN' : 'THUA_HUONG', nam: r.nam, tuan: r.tuan,
  };
}
const nhanNguon = (h) => (h.nguon === 'TUAN' ? 'cài tuần này'
  : h.nguon === 'THUA_HUONG' ? `thừa hưởng tuần ${h.tuan}/${h.nam}` : 'mặc định (chưa từng cài)');

// Gom dòng `cai_dat_ca_tuan` (1 dòng / tuần × loại chuyền) thành 1 dòng / tuần: { chung, rieng: {MAY…} }.
function gomTheoTuan(rows) {
  const m = new Map();
  rows.forEach((r) => {
    const k = `${r.nam}-${r.tuan}`;
    if (!m.has(k)) m.set(k, { id: k, nam: r.nam, tuan: r.tuan, chung: null, rieng: {}, demChung: 'SAU', demRieng: {}, ghi_chu: null });
    const g = m.get(k);
    if (r.loai_chuyen) { g.rieng[r.loai_chuyen] = r.loai_ca; g.demRieng[r.loai_chuyen] = r.ca_dem || 'SAU'; }
    else { g.chung = r.loai_ca; g.demChung = r.ca_dem || 'SAU'; g.ghi_chu = r.ghi_chu; }
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
  const [caDem, setCaDem] = useState('SAU');
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
  const tenApCho = apCho.length ? LOAI_CHUYEN.filter((x) => apCho.includes(x.v)).map((x) => x.cot || x.label).join(', ') : 'tất cả chuyền';

  const submit = async () => {
    setSaving(true);
    try {
      await saveCaTuan({ nam: wk.nam, tuan: wk.tuan, loaiCa, ghiChu, loaiChuyen: apCho, ...(coCaDem(loaiCa) ? { caDem } : {}) });
      show(`Đã lưu ca ${CA_LABEL[loaiCa]}${coCaDem(loaiCa) && caDem === 'TRUOC' ? ' · ca trước' : ''} cho ${tenApCho} — tuần ${wk.tuan}/${wk.nam}`);
      setGhiChu('');
      load();
    } catch (e) { show(e.message || 'Lưu thất bại', 'error'); } finally { setSaving(false); }
  };

  // Ước lượng 1 ngày trong tuần (nam/tuan) để hiện khoảng ngày ở bảng.
  const dateOfWeek = (nam, tuan) => {
    // Mốc 04/01 luôn thuộc tuần ISO 1 (mốc 01/01 lệch 1 tuần ở năm bắt đầu bằng Thứ 6–CN, vd 2027).
    const simple = new Date(Date.UTC(nam, 0, 4 + (tuan - 1) * 7));
    const day = simple.getUTCDay() || 7;
    simple.setUTCDate(simple.getUTCDate() - day + 1 + 3); // Thứ 5 trong tuần ISO
    return simple;
  };
  // Bấm 1 dòng tuần ⇒ form chuyển sang ĐÚNG tuần đó (bản cũ về hôm nay ⇒ sửa nhầm sang tuần hiện tại).
  const ngayTrongTuan = (nam, tuan) => {
    const d = dateOfWeek(nam, tuan);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  };

  // Ô của 1 loại chuyền = ca ĐANG ÁP DỤNG của tuần (riêng ⇒ chung ⇒ thừa hưởng tuần trước ⇒ mặc định); dòng chữ mờ
  // nói nguồn. Nhóm "Chuyền khác" không theo chung.
  const oHieuLuc = (h, rieng) => (
    <div className="flex flex-col items-start gap-0.5">
      <span className="flex flex-wrap items-center gap-1">
        <Badge tone={rieng ? toneCa(h.ca) : 'default'}>{CA_LABEL[h.ca] || h.ca}</Badge>
        {coCaDem(h.ca) && h.dem === 'TRUOC' && <Badge tone={rieng ? 'danger' : 'default'}>Ca trước</Badge>}
      </span>
      {!rieng && <span className="text-[11px] text-ink-soft">{h.nguon === 'TUAN' ? 'theo chung' : nhanNguon(h)}</span>}
    </div>
  );
  const oLoai = (r, lc) => oHieuLuc(caHieuLuc(tuanRows, r.nam, r.tuan, lc), !!r.rieng[lc]);
  const columns = [
    { key: 'tuan', header: 'Tuần', render: (r) => <span className="font-medium text-ink">Tuần {r.tuan}/{r.nam}</span> },
    { key: 'khoang', header: 'Khoảng ngày', render: (r) => weekRange(dateOfWeek(r.nam, r.tuan)) },
    { key: 'chung', header: 'Chung (mọi chuyền)', render: (r) => oHieuLuc(caHieuLuc(tuanRows, r.nam, r.tuan, ''), !!r.chung) },
    ...LOAI_CHUYEN.map((l) => ({ key: `lc_${l.v}`, header: l.cot || l.label, render: (r) => oLoai(r, l.v) })),
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
          Tuần chưa cài <b>thừa hưởng tuần gần nhất trước đó đã cài</b> — chỉ vào sửa khi đổi ca; chưa từng cài thì đi ca
          <b> Ngắn</b>. Chuyền Máy / Bàn / Robot cài riêng thì theo cài riêng, không thì theo
          ca <b>chung</b> của tuần. <b>Chuyền khác</b> (Gia công, Máy tròn, Logo, Ép) mặc định <b>Hành chính</b>, không theo
          ca chung — đổi thì chọn "Khác". Lưu cho <b>tất cả chuyền</b> sẽ đưa các cài riêng Máy / Bàn / Robot của tuần
          đó về cùng loại ca (không đụng "Khác"). <b>Ca sau / Ca trước</b>: ca đêm (Ca 3 Ngắn · Ca 2 Dài) tính cho ngày nó
          bắt đầu (ca sau — như trước giờ) hay ngày nó kết thúc (ca trước) — quyết định mã ngày ca đầu ca khi in tem
          (vd 20h ngày 07/11: ca sau <b>261107D2</b>, ca trước <b>261108D2</b>) và ngày ca gửi ERP.
        </span>
      </div>

      {canEdit && (
        <div className="mb-5 card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Cài ca cho tuần</h3>
          {/* ⚠ 21/10/2026: bản cũ dồn 5 ô vào `lg:grid-cols-5` ⇒ 5 nút loại chuyền + 3 nút loại ca tràn đè ô bên cạnh.
              Nay 2 hàng: (ngày · tuần · ghi chú) rồi (áp cho · loại ca), nút xuống dòng khi hẹp. */}
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Chọn 1 ngày trong tuần">
              <Input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
            </Field>
            <Field label="Tuần">
              <div className="flex min-h-11 items-center rounded-input border border-line bg-surface-muted px-3 py-2 text-sm text-ink">
                Tuần {wk.tuan}/{wk.nam} · {weekRange(new Date(ngay))}
              </div>
            </Field>
            <div className="sm:col-span-2 lg:col-span-1">
              <Field label="Ghi chú (tùy chọn)">
                <Input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú..." />
              </Field>
            </div>
          </div>
          <div className="grid gap-x-4 lg:grid-cols-2">
            <Field label="Áp cho loại chuyền">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setApCho([])} className={nutChon(!apCho.length)}>Tất cả</button>
                {LOAI_CHUYEN.map((o) => (
                  <button key={o.v} type="button" onClick={() => batLoai(o.v)} title={o.title}
                    className={nutChon(apCho.includes(o.v))}>{o.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Loại ca">
              <div className="flex flex-wrap gap-2">
                {CA_OPTIONS.map((o) => (
                  <button key={o.v} type="button" onClick={() => setLoaiCa(o.v)}
                    className={nutChon(loaiCa === o.v)}>{o.label}</button>
                ))}
              </div>
            </Field>
          </div>
          {coCaDem(loaiCa) && (
            <Field label={`Ca đêm (${loaiCa === 'DAI' ? 'Ca 2: 18h–6h' : 'Ca 3: 22h–6h'}) tính cho ngày`}>
              <div className="flex flex-wrap items-center gap-2">
                {CA_DEM_OPTIONS.map((o) => (
                  <button key={o.v} type="button" onClick={() => setCaDem(o.v)} title={o.title}
                    className={`${nutChon(caDem === o.v)} max-w-[10rem]`}>{o.label}</button>
                ))}
                <span className="text-xs text-ink-soft">
                  {caDem === 'TRUOC'
                    ? `Ngày 08/11: ${loaiCa === 'DAI' ? 'D2 18h ngày 07 → 6h ngày 08, D1 6h–18h ngày 08' : 'C3 22h ngày 07 → 6h ngày 08, C1 · C2 6h–22h ngày 08'}`
                    : `Ngày 08/11: ${loaiCa === 'DAI' ? 'D1 6h–18h ngày 08, D2 18h ngày 08 → 6h ngày 09' : 'C1 · C2 6h–22h ngày 08, C3 22h ngày 08 → 6h ngày 09'}`}
                </span>
              </div>
            </Field>
          )}
          <div className="flex justify-end">
            <Button onClick={submit} loading={saving}>Lưu ca {tenApCho} · tuần {wk.tuan}/{wk.nam}</Button>
          </div>
        </div>
      )}

      {/* Ca ĐANG ÁP DỤNG cho tuần đang chọn ở ô ngày (mặc định tuần này) — kể cả khi tuần đó chưa cài (thừa hưởng). */}
      <div className="mb-5 card p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">Đang áp dụng · tuần {wk.tuan}/{wk.nam} · {weekRange(new Date(ngay))}</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {LOAI_CHUYEN.map((l) => {
            const h = caHieuLuc(tuanRows, wk.nam, wk.tuan, l.v);
            return (
              <div key={l.v} className="rounded-control border border-line p-3">
                <div className="mb-1 text-xs font-semibold text-ink-soft">{l.cot || l.label}</div>
                <span className="flex flex-wrap items-center gap-1">
                  <Badge tone={toneCa(h.ca)}>{CA_LABEL[h.ca] || h.ca}</Badge>
                  {coCaDem(h.ca) && <Badge tone={h.dem === 'TRUOC' ? 'danger' : 'default'}>{h.dem === 'TRUOC' ? 'Ca trước' : 'Ca sau'}</Badge>}
                </span>
                <div className={`mt-1 text-[11px] ${h.nguon === 'MAC_DINH' ? 'text-warning' : 'text-ink-soft'}`}>{nhanNguon(h)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Các tuần đã cài</div>
      <DataTable columns={columns} rows={tuanRows} loading={loading} rowKey="id"
        onRowClick={(r) => { setLoaiCa(r.chung || 'NGAN'); setCaDem(r.demChung || 'SAU'); setApCho([]); setGhiChu(r.ghi_chu || ''); setNgay(ngayTrongTuan(r.nam, r.tuan)); }}
        emptyText="Chưa cài ca cho tuần nào (mặc định Ngắn)" />

      <Toast toast={toast} />
    </div>
  );
}
