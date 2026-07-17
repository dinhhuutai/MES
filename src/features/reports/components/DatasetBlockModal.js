import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import { Field, Input, Select } from '../../../components/common/controls';

// Cấu hình 1 KHỐI DANH SÁCH đặt tại ô neo `oKey`:
//   ds = { nguon, loc:{...}, cot:[key...], gioi_han }
// Dữ liệu đổ từ ô neo: hàng đầu = tiêu đề cột, các hàng sau = dữ liệu (tự nở theo số dòng).
export default function DatasetBlockModal({ open, onClose, oKey, value, datasets, onSave, onRemove }) {
  const [ds, setDs] = useState({ nguon: '', loc: {}, cot: [], gioi_han: 100 });

  useEffect(() => {
    if (!open) return;
    setDs(value && value.nguon
      ? { gioi_han: 100, loc: {}, cot: [], ...value }
      : { nguon: datasets[0]?.ma || '', loc: {}, cot: [], gioi_han: 100 });
  }, [open, value, datasets]);

  const def = useMemo(() => datasets.find((d) => d.ma === ds.nguon), [datasets, ds.nguon]);

  // Đổi nguồn → reset cột về 8 cột đầu + xóa bộ lọc của nguồn cũ.
  const setNguon = (ma) => {
    const d = datasets.find((x) => x.ma === ma);
    setDs({ nguon: ma, loc: {}, gioi_han: 100, cot: (d?.cot || []).slice(0, 8).map((c) => c.key) });
  };
  const toggleCot = (key) => setDs((s) => ({
    ...s,
    cot: s.cot.includes(key) ? s.cot.filter((k) => k !== key) : [...s.cot, key],
  }));
  const moveCot = (i, d) => setDs((s) => {
    const a = [...s.cot];
    const j = i + d;
    if (j < 0 || j >= a.length) return s;
    [a[i], a[j]] = [a[j], a[i]];
    return { ...s, cot: a };
  });
  const setLoc = (ma, v) => setDs((s) => ({ ...s, loc: { ...s.loc, [ma]: v } }));

  const luu = () => {
    if (!ds.nguon) return;
    onSave({ ...ds, cot: ds.cot.length ? ds.cot : (def?.cot || []).slice(0, 8).map((c) => c.key) });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" title={`Khối danh sách tại ô ${oKey || ''}`}>
      <div className="space-y-4">
        <div className="rounded-control border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          Dữ liệu đổ ra từ ô <b>{oKey}</b>: hàng đầu là <b>tiêu đề cột</b>, các hàng dưới là dữ liệu —
          lưới <b>tự nở</b> đủ số dòng. Ở chế độ <b>Xem</b> mỗi cột có ô <b>lọc</b> riêng.
        </div>

        <Field label="Nguồn dữ liệu">
          <Select value={ds.nguon} onChange={(e) => setNguon(e.target.value)}>
            {datasets.map((d) => <option key={d.ma} value={d.ma}>{d.ten}</option>)}
          </Select>
        </Field>
        {def?.mo_ta && <p className="-mt-2 text-xs text-ink-soft">{def.mo_ta}</p>}

        {def?.loc?.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Bộ lọc</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {def.loc.map((f) => (
                <Field key={f.ma} label={f.ten} hint={f.mo_ta}>
                  {f.kieu === 'chon' ? (
                    <Select value={ds.loc[f.ma] || ''} onChange={(e) => setLoc(f.ma, e.target.value)}>
                      <option value="">— tất cả —</option>
                      {(f.chon || []).map((o) => <option key={o.v} value={o.v}>{o.ten}</option>)}
                    </Select>
                  ) : f.kieu === 'ngay' ? (
                    <div className="space-y-1">
                      <Select value={/^\d{4}-/.test(ds.loc[f.ma] || '') ? 'CU_THE' : (ds.loc[f.ma] || '')}
                        onChange={(e) => setLoc(f.ma, e.target.value === 'CU_THE' ? new Date().toISOString().slice(0, 10) : e.target.value)}>
                        <option value="">— mọi ngày —</option>
                        <option value="HOM_NAY">Hôm nay (tự đổi)</option>
                        <option value="CU_THE">Ngày cụ thể…</option>
                      </Select>
                      {/^\d{4}-/.test(ds.loc[f.ma] || '') && (
                        <Input type="date" value={ds.loc[f.ma]} onChange={(e) => setLoc(f.ma, e.target.value)} />
                      )}
                    </div>
                  ) : (
                    <Input value={ds.loc[f.ma] || ''} onChange={(e) => setLoc(f.ma, e.target.value)} placeholder="Để trống = không lọc" />
                  )}
                </Field>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Cột có sẵn — bấm để thêm/bỏ</span>
              <Badge tone="info">{ds.cot.length} cột đã chọn</Badge>
            </div>
            <div className="max-h-64 space-y-1 overflow-auto rounded-control border border-line p-2">
              {(def?.cot || []).map((c) => (
                <button key={c.key} type="button" onClick={() => toggleCot(c.key)}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm ${
                    ds.cot.includes(c.key) ? 'bg-primary-wash text-primary' : 'hover:bg-surface-muted'}`}>
                  <span>{c.ten}</span>
                  {ds.cot.includes(c.key) ? <Icon name="check" size={14} /> : <Icon name="plus" size={14} className="text-ink-soft" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Thứ tự cột hiển thị (trái → phải)</div>
            <div className="max-h-64 space-y-1 overflow-auto rounded-control border border-line p-2">
              {ds.cot.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-soft">Chưa chọn cột nào</p>}
              {ds.cot.map((k, i) => {
                const c = (def?.cot || []).find((x) => x.key === k);
                return (
                  <div key={k} className="flex items-center gap-1 rounded bg-surface-muted px-2 py-1 text-sm">
                    <span className="w-5 text-xs text-ink-soft">{i + 1}</span>
                    <span className="flex-1 truncate">{c?.ten || k}</span>
                    <button type="button" onClick={() => moveCot(i, -1)} disabled={i === 0}
                      className="px-1 text-ink-soft hover:text-primary disabled:opacity-30" aria-label="Lên"><Icon name="chevron-up" size={14} /></button>
                    <button type="button" onClick={() => moveCot(i, 1)} disabled={i === ds.cot.length - 1}
                      className="px-1 text-ink-soft hover:text-primary disabled:opacity-30" aria-label="Xuống"><Icon name="chevron-down" size={14} /></button>
                    <button type="button" onClick={() => toggleCot(k)}
                      className="px-1 text-ink-soft hover:text-danger" aria-label="Bỏ"><Icon name="x" size={14} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Field label="Giới hạn số dòng" hint="Tối đa 500 — chặn báo cáo phình quá lớn làm treo trình duyệt.">
          <Input type="number" min="1" max="500" value={ds.gioi_han}
            onChange={(e) => setDs((s) => ({ ...s, gioi_han: e.target.value }))} className="!w-40" />
        </Field>

        <div className="flex justify-between border-t border-line pt-3">
          <Button variant="ghost" className="text-danger" onClick={() => { onRemove(); onClose(); }}>Gỡ khối danh sách</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Hủy</Button>
            <Button onClick={luu} disabled={!ds.nguon}>Lưu khối danh sách</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
