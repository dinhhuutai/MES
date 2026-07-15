import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import { Field, Input, Select, inputClass } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import { searchKhach, searchDon, searchMaHang, searchPhanIn, listLoaiDotVai, createManualChain } from '../../../services/manualEntryService';

// Ô tìm-chọn "có sẵn" (server-search, debounce). onSelect(item|null). resetKey đổi → nạp lại.
function AsyncPicker({ fetcher, resetKey, selected, onSelect, placeholder, renderLabel, disabled }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (disabled) return undefined;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try { const r = await fetcher(q); if (alive) setOpts(r.data || []); } catch { if (alive) setOpts([]); } finally { if (alive) setLoading(false); }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, disabled, resetKey]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-input border border-primary/40 bg-primary-wash px-3 py-2 text-sm">
        <span className="font-medium text-primary">{renderLabel(selected)}</span>
        <button type="button" className="text-ink-soft hover:text-danger" onClick={() => { onSelect(null); setQ(''); }} aria-label="Bỏ chọn">
          <Icon name="x" size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input className={inputClass} placeholder={placeholder} value={q} disabled={disabled}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && !disabled && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-input border border-line bg-surface shadow-card">
          {loading ? (
            <div className="px-3 py-2 text-sm text-ink-soft">Đang tìm...</div>
          ) : opts.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-soft">Không có kết quả</div>
          ) : opts.map((o) => (
            <button key={o.id} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(o); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted">
              {renderLabel(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 1 cấp: radio "Có sẵn" / "Tạo mới". modeDisabled=true → khóa "Có sẵn" (khi cấp cha là tạo mới).
function LevelTabs({ mode, onMode, existingDisabled }) {
  return (
    <div className="mb-2 inline-flex rounded-control border border-line bg-surface p-0.5 text-xs font-medium">
      <button type="button" disabled={existingDisabled} onClick={() => onMode('existing')}
        className={`rounded-control px-3 py-1 transition ${mode === 'existing' ? 'bg-primary-wash text-primary' : 'text-ink-soft hover:text-ink'} ${existingDisabled ? 'cursor-not-allowed opacity-40' : ''}`}>
        Có sẵn
      </button>
      <button type="button" onClick={() => onMode('new')}
        className={`rounded-control px-3 py-1 transition ${mode === 'new' ? 'bg-primary-wash text-primary' : 'text-ink-soft hover:text-ink'}`}>
        Tạo mới
      </button>
    </div>
  );
}

const emptyDot = () => ({ ma_dot_vai: '', so_luong_vai_ve: '', ngay_vai_ve: '', han_giao_hang: '', loai_dot_vai_id: '' });

// Đặt NGOÀI component: nếu định nghĩa trong ManualEntryPage, mỗi lần gõ (setState → re-render)
// sẽ tạo hàm Section mới → React remount cả section → input MẤT FOCUS sau 1 ký tự.
function Section({ n, title, children }) {
  return (
    <section className="card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-wash text-xs font-bold text-primary">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function ManualEntryPage() {
  const { toast, show } = useToast();
  const [mode, setMode] = useState({ khach: 'new', don: 'new', maHang: 'new', phanIn: 'new' });
  const [sel, setSel] = useState({ khach: null, don: null, maHang: null, phanIn: null });
  const [khach, setKhach] = useState({ ma_khach_hang: '', ten_khach_hang: '' });
  const [don, setDon] = useState({ ma_don_hang: '', so_po: '', ten_don_hang: '', ngay_dat_hang: '' });
  const [maHang, setMaHang] = useState({ ma_hang: '', ten_ma_hang: '' });
  const [phanIn, setPhanIn] = useState({ ma_phan: '', mau_vai: '', kich_vai: '', kich_phim: '', tinh_chat_in: '', do_in: '', mau_in: '', so_luong_don_hang: '', la_in_kieng: false, thoi_gian_cho_kho_phut: '' });
  const [dots, setDots] = useState([emptyDot()]);
  const [loaiList, setLoaiList] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { listLoaiDotVai().then((r) => setLoaiList(r.data || [])).catch(() => {}); }, []);

  // Cấp cha "tạo mới" → cấp con buộc "tạo mới" (không thể chọn đơn/mã hàng/phần in có sẵn khi cấp cha là mới).
  const parentNew = { don: mode.khach === 'new' || !sel.khach, maHang: mode.don === 'new' || !sel.don, phanIn: mode.maHang === 'new' || !sel.maHang };
  useEffect(() => { if (parentNew.don && mode.don === 'existing') { setMode((m) => ({ ...m, don: 'new' })); setSel((s) => ({ ...s, don: null })); } }, [parentNew.don, mode.don]);
  useEffect(() => { if (parentNew.maHang && mode.maHang === 'existing') { setMode((m) => ({ ...m, maHang: 'new' })); setSel((s) => ({ ...s, maHang: null })); } }, [parentNew.maHang, mode.maHang]);
  useEffect(() => { if (parentNew.phanIn && mode.phanIn === 'existing') { setMode((m) => ({ ...m, phanIn: 'new' })); setSel((s) => ({ ...s, phanIn: null })); } }, [parentNew.phanIn, mode.phanIn]);

  const setDot = (i, k, v) => setDots((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const addDot = () => setDots((ds) => [...ds, emptyDot()]);
  const removeDot = (i) => setDots((ds) => (ds.length > 1 ? ds.filter((_, j) => j !== i) : ds));

  const donFetcher = useCallback((q) => searchDon(sel.khach?.id || '', q), [sel.khach]);
  const maHangFetcher = useCallback((q) => searchMaHang(sel.don?.id || '', q), [sel.don]);
  const phanInFetcher = useCallback((q) => searchPhanIn(sel.maHang?.id || '', q), [sel.maHang]);

  const reset = () => {
    setMode({ khach: 'new', don: 'new', maHang: 'new', phanIn: 'new' });
    setSel({ khach: null, don: null, maHang: null, phanIn: null });
    setKhach({ ma_khach_hang: '', ten_khach_hang: '' });
    setDon({ ma_don_hang: '', so_po: '', ten_don_hang: '', ngay_dat_hang: '' });
    setMaHang({ ma_hang: '', ten_ma_hang: '' });
    setPhanIn({ ma_phan: '', mau_vai: '', kich_vai: '', kich_phim: '', tinh_chat_in: '', do_in: '', mau_in: '', so_luong_don_hang: '', la_in_kieng: false, thoi_gian_cho_kho_phut: '' });
    setDots([emptyDot()]);
  };

  const phanInExisting = mode.phanIn === 'existing';

  const submit = async () => {
    // Validate FE nhẹ.
    if (dots.some((d) => d.so_luong_vai_ve === '' || Number(d.so_luong_vai_ve) < 0)) { show('Mỗi đợt vải cần SL vải về ≥ 0', 'error'); return; }

    const num = (v) => (v === '' || v == null ? null : Number(v));
    // Chọn phần in CÓ SẴN → chỉ thêm đợt vải vào phần in đó (backend bỏ qua khách/đơn/mã hàng).
    if (phanInExisting) {
      if (!sel.phanIn) { show('Chọn phần in có sẵn hoặc chuyển sang Tạo mới', 'error'); return; }
    } else {
      if (mode.khach === 'existing' && !sel.khach) { show('Chọn khách hàng có sẵn hoặc chuyển sang Tạo mới', 'error'); return; }
      if (mode.khach === 'new' && !khach.ten_khach_hang.trim()) { show('Nhập tên khách hàng mới', 'error'); return; }
      if (mode.don === 'existing' && !sel.don) { show('Chọn đơn hàng có sẵn hoặc chuyển sang Tạo mới', 'error'); return; }
      if (mode.maHang === 'existing' && !sel.maHang) { show('Chọn mã hàng có sẵn hoặc chuyển sang Tạo mới', 'error'); return; }
    }

    const dotVai = dots.map((d) => ({ ma_dot_vai: d.ma_dot_vai.trim() || null, so_luong_vai_ve: num(d.so_luong_vai_ve) ?? 0, ngay_vai_ve: d.ngay_vai_ve || null, han_giao_hang: d.han_giao_hang || null, loai_dot_vai_id: d.loai_dot_vai_id || null }));
    const payload = phanInExisting ? { phanIn: { id: sel.phanIn.id }, dotVai } : {
      khach: mode.khach === 'existing' ? { id: sel.khach.id } : { ma_khach_hang: khach.ma_khach_hang.trim() || null, ten_khach_hang: khach.ten_khach_hang.trim() },
      don: mode.don === 'existing' ? { id: sel.don.id } : { ma_don_hang: don.ma_don_hang.trim() || null, so_po: don.so_po.trim() || null, ten_don_hang: don.ten_don_hang.trim() || null, ngay_dat_hang: don.ngay_dat_hang || null },
      maHang: mode.maHang === 'existing' ? { id: sel.maHang.id } : { ma_hang: maHang.ma_hang.trim() || null, ten_ma_hang: maHang.ten_ma_hang.trim() || null },
      phanIn: {
        ma_phan: phanIn.ma_phan.trim() || null, mau_vai: phanIn.mau_vai.trim() || null, kich_vai: phanIn.kich_vai.trim() || null,
        kich_phim: phanIn.kich_phim.trim() || null, tinh_chat_in: phanIn.tinh_chat_in.trim() || null, do_in: phanIn.do_in.trim() || null,
        mau_in: phanIn.mau_in.trim() || null, so_luong_don_hang: num(phanIn.so_luong_don_hang), la_in_kieng: phanIn.la_in_kieng,
        thoi_gian_cho_kho_phut: num(phanIn.thoi_gian_cho_kho_phut),
      },
      dotVai,
    };

    setSaving(true);
    try {
      const r = await createManualChain(payload);
      show(`✓ ${r.message || 'Đã tạo'} — phần in ${r.data.ma_phan}`);
      reset();
    } catch (e) {
      show(e.message || 'Tạo thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Toolbar title="Nhập tay đơn hàng → đợt vải" subtitle="Tạo thủ công chuỗi Khách hàng → Đơn hàng → Mã hàng → Phần in → Đợt vải (thay ERP). Mỗi cấp chọn có sẵn hoặc tạo mới; để trống mã = tự sinh.">
        <Button variant="ghost" onClick={reset}>Làm mới</Button>
        <Button icon="plus" loading={saving} onClick={submit}>{phanInExisting ? 'Thêm đợt vải vào phần in' : 'Tạo phần in + đợt vải'}</Button>
      </Toolbar>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 1. Khách hàng */}
        <Section n={1} title="Khách hàng">
          <LevelTabs mode={mode.khach} onMode={(m) => { setMode((s) => ({ ...s, khach: m })); if (m === 'new') setSel((s) => ({ ...s, khach: null })); }} />
          {mode.khach === 'existing' ? (
            <AsyncPicker fetcher={searchKhach} selected={sel.khach} onSelect={(o) => setSel((s) => ({ ...s, khach: o, don: null, maHang: null }))}
              placeholder="Tìm mã / tên khách hàng..." renderLabel={(o) => `${o.ten_khach_hang} (${o.ma_khach_hang})`} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tên khách hàng" required><Input value={khach.ten_khach_hang} onChange={(e) => setKhach((s) => ({ ...s, ten_khach_hang: e.target.value }))} placeholder="VD: Công ty ABC" /></Field>
              <Field label="Mã khách hàng" hint="trống = tự sinh"><Input value={khach.ma_khach_hang} onChange={(e) => setKhach((s) => ({ ...s, ma_khach_hang: e.target.value }))} placeholder="tự sinh" /></Field>
            </div>
          )}
        </Section>

        {/* 2. Đơn hàng */}
        <Section n={2} title="Đơn hàng">
          <LevelTabs mode={mode.don} existingDisabled={parentNew.don} onMode={(m) => { setMode((s) => ({ ...s, don: m })); if (m === 'new') setSel((s) => ({ ...s, don: null })); }} />
          {mode.don === 'existing' ? (
            <AsyncPicker fetcher={donFetcher} resetKey={sel.khach?.id} selected={sel.don} onSelect={(o) => setSel((s) => ({ ...s, don: o, maHang: null }))}
              placeholder="Tìm mã đơn / PO..." renderLabel={(o) => `${o.ma_don_hang}${o.so_po ? ` · ${o.so_po}` : ''}`} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mã đơn hàng" hint="trống = tự sinh"><Input value={don.ma_don_hang} onChange={(e) => setDon((s) => ({ ...s, ma_don_hang: e.target.value }))} placeholder="tự sinh" /></Field>
              <Field label="Số PO"><Input value={don.so_po} onChange={(e) => setDon((s) => ({ ...s, so_po: e.target.value }))} /></Field>
              <Field label="Tên đơn hàng"><Input value={don.ten_don_hang} onChange={(e) => setDon((s) => ({ ...s, ten_don_hang: e.target.value }))} /></Field>
              <Field label="Ngày đặt hàng"><Input type="date" value={don.ngay_dat_hang} onChange={(e) => setDon((s) => ({ ...s, ngay_dat_hang: e.target.value }))} /></Field>
            </div>
          )}
        </Section>

        {/* 3. Mã hàng */}
        <Section n={3} title="Mã hàng">
          <LevelTabs mode={mode.maHang} existingDisabled={parentNew.maHang} onMode={(m) => { setMode((s) => ({ ...s, maHang: m })); if (m === 'new') setSel((s) => ({ ...s, maHang: null })); }} />
          {mode.maHang === 'existing' ? (
            <AsyncPicker fetcher={maHangFetcher} resetKey={sel.don?.id} selected={sel.maHang} onSelect={(o) => setSel((s) => ({ ...s, maHang: o }))}
              placeholder="Tìm mã hàng..." renderLabel={(o) => `${o.ma_hang}${o.ten_ma_hang ? ` · ${o.ten_ma_hang}` : ''}`} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mã hàng" hint="trống = tự sinh"><Input value={maHang.ma_hang} onChange={(e) => setMaHang((s) => ({ ...s, ma_hang: e.target.value }))} placeholder="tự sinh" /></Field>
              <Field label="Tên mã hàng"><Input value={maHang.ten_ma_hang} onChange={(e) => setMaHang((s) => ({ ...s, ten_ma_hang: e.target.value }))} /></Field>
            </div>
          )}
        </Section>

        {/* 4. Phần in */}
        <Section n={4} title="Phần in">
          <LevelTabs mode={mode.phanIn} existingDisabled={parentNew.phanIn} onMode={(m) => { setMode((s) => ({ ...s, phanIn: m })); if (m === 'new') setSel((s) => ({ ...s, phanIn: null })); }} />
          {parentNew.phanIn && (
            <p className="mb-2 text-xs text-ink-soft">Chọn <b>Mã hàng có sẵn</b> ở trên để có thể chọn phần in có sẵn của mã hàng đó.</p>
          )}
          {phanInExisting ? (
            <AsyncPicker fetcher={phanInFetcher} resetKey={sel.maHang?.id} selected={sel.phanIn} onSelect={(o) => setSel((s) => ({ ...s, phanIn: o }))}
              placeholder="Tìm code phần / màu / kích..." renderLabel={(o) => `${o.ma_phan}${[o.mau_vai, o.kich_vai, o.kich_phim].filter(Boolean).length ? ` · ${[o.mau_vai, o.kich_vai, o.kich_phim].filter(Boolean).join(' · ')}` : ''}`} />
          ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code phần" hint="trống = tự sinh"><Input value={phanIn.ma_phan} onChange={(e) => setPhanIn((s) => ({ ...s, ma_phan: e.target.value }))} placeholder="tự sinh" /></Field>
            <Field label="SL đơn hàng"><Input type="number" min="0" value={phanIn.so_luong_don_hang} onChange={(e) => setPhanIn((s) => ({ ...s, so_luong_don_hang: e.target.value }))} /></Field>
            <Field label="Màu vải"><Input value={phanIn.mau_vai} onChange={(e) => setPhanIn((s) => ({ ...s, mau_vai: e.target.value }))} /></Field>
            <Field label="Kích vải"><Input value={phanIn.kich_vai} onChange={(e) => setPhanIn((s) => ({ ...s, kich_vai: e.target.value }))} /></Field>
            <Field label="Kích phim"><Input value={phanIn.kich_phim} onChange={(e) => setPhanIn((s) => ({ ...s, kich_phim: e.target.value }))} /></Field>
            <Field label="Tính chất in"><Input value={phanIn.tinh_chat_in} onChange={(e) => setPhanIn((s) => ({ ...s, tinh_chat_in: e.target.value }))} /></Field>
            <Field label="Độ in"><Input value={phanIn.do_in} onChange={(e) => setPhanIn((s) => ({ ...s, do_in: e.target.value }))} /></Field>
            <Field label="Màu in"><Input value={phanIn.mau_in} onChange={(e) => setPhanIn((s) => ({ ...s, mau_in: e.target.value }))} /></Field>
            <Field label="Thời gian chờ khô (phút)"><Input type="number" min="0" value={phanIn.thoi_gian_cho_kho_phut} onChange={(e) => setPhanIn((s) => ({ ...s, thoi_gian_cho_kho_phut: e.target.value }))} placeholder="mặc định 60" /></Field>
            <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={phanIn.la_in_kieng} onChange={(e) => setPhanIn((s) => ({ ...s, la_in_kieng: e.target.checked }))} />
              In kiếng (tạo thêm đợt ép ủi khi lên KH)
            </label>
          </div>
          )}
        </Section>
      </div>

      {/* 5. Đợt vải */}
      <section className="card mt-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-wash text-xs font-bold text-primary">5</span>
            Đợt vải về <Badge tone="default">{dots.length}</Badge>
          </h3>
          <Button variant="ghost" icon="plus" onClick={addDot}>Thêm đợt</Button>
        </div>
        <div className="space-y-3">
          {dots.map((d, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 rounded-control border border-line p-3 md:grid-cols-6">
              <Field label="SL vải về" required><Input type="number" min="0" value={d.so_luong_vai_ve} onChange={(e) => setDot(i, 'so_luong_vai_ve', e.target.value)} /></Field>
              <Field label="Ngày vải về"><Input type="date" value={d.ngay_vai_ve} onChange={(e) => setDot(i, 'ngay_vai_ve', e.target.value)} /></Field>
              <Field label="Hạn giao"><Input type="date" value={d.han_giao_hang} onChange={(e) => setDot(i, 'han_giao_hang', e.target.value)} /></Field>
              <Field label="Loại đợt vải">
                <Select value={d.loai_dot_vai_id} onChange={(e) => setDot(i, 'loai_dot_vai_id', e.target.value)}>
                  <option value="">—</option>
                  {loaiList.map((l) => <option key={l.id} value={l.id}>{l.ten_loai}</option>)}
                </Select>
              </Field>
              <Field label="Mã đợt vải" hint="trống = tự sinh"><Input value={d.ma_dot_vai} onChange={(e) => setDot(i, 'ma_dot_vai', e.target.value)} placeholder="tự sinh" /></Field>
              <div className="flex items-end">
                <Button variant="ghost" className="!text-danger" icon="trash-2" onClick={() => removeDot(i)} disabled={dots.length <= 1}>Xóa</Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">Đợt vải tạo ở trạng thái <b>NHAN_VAI</b> — tự vào dòng chảy (READY / Kế hoạch) như đồng bộ ERP.</p>
      </section>

      <div className="mt-4 flex justify-end">
        <Button icon="plus" loading={saving} onClick={submit}>{phanInExisting ? 'Thêm đợt vải vào phần in' : 'Tạo phần in + đợt vải'}</Button>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
