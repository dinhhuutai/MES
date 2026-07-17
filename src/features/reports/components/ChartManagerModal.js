import { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import { Field, Input, Select } from '../../../components/common/controls';
import { CHART_KIEU } from './ReportChart';

const moi = () => ({
  id: `bd_${Date.now().toString(36)}`, ten: 'Biểu đồ mới', kieu: 'cot',
  nguon: 'danh_sach', tu_o: '', cot_nhan: '', cot_gia_tri: '', metrics: [], gioi_han: 15, cao: 260,
});

// Quản lý danh sách biểu đồ của báo cáo (render DƯỚI lưới).
// dsBlocks: [{ oKey, nguon, cot:[{key,ten,kieu}] }] — các khối danh sách đang có để chọn làm nguồn.
export default function ChartManagerModal({ open, onClose, value = [], dsBlocks = [], metrics = [], onSave }) {
  const [list, setList] = useState([]);
  useEffect(() => { if (open) setList(Array.isArray(value) ? value.map((x) => ({ ...x })) : []); }, [open, value]);

  const patch = (i, p) => setList((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const xoa = (i) => setList((l) => l.filter((_, j) => j !== i));
  const soMetric = metrics.filter((m) => (m.kieu || 'so') === 'so');

  return (
    <Modal open={open} onClose={onClose} size="xl" title="Biểu đồ của báo cáo">
      <div className="space-y-4">
        <p className="rounded-control border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300">
          Biểu đồ hiển thị <b>dưới lưới</b> khi Xem trước / Xem báo cáo. Nguồn có thể là một <b>khối danh sách</b>
          (chọn cột nhãn + cột số) hoặc một nhóm <b>chỉ số (metric)</b>.
        </p>

        {list.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-soft">Chưa có biểu đồ nào. Bấm “Thêm biểu đồ” bên dưới.</p>
        )}

        {list.map((b, i) => {
          const blk = dsBlocks.find((x) => x.oKey === b.tu_o);
          return (
            <div key={b.id} className="rounded-card border border-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <Icon name="bar-chart-3" size={16} className="text-primary" />
                <Input value={b.ten} onChange={(e) => patch(i, { ten: e.target.value })} className="!h-8 flex-1" />
                <button type="button" onClick={() => xoa(i)} className="px-1 text-ink-soft hover:text-danger" aria-label="Xóa biểu đồ">
                  <Icon name="trash-2" size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Field label="Kiểu">
                  <Select value={b.kieu} onChange={(e) => patch(i, { kieu: e.target.value })}>
                    {CHART_KIEU.map((k) => <option key={k.v} value={k.v}>{k.ten}</option>)}
                  </Select>
                </Field>
                <Field label="Nguồn">
                  <Select value={b.nguon} onChange={(e) => patch(i, { nguon: e.target.value })}>
                    <option value="danh_sach">Khối danh sách</option>
                    <option value="metric">Nhóm chỉ số (metric)</option>
                  </Select>
                </Field>

                {b.nguon === 'danh_sach' ? (
                  <>
                    <Field label="Lấy từ khối">
                      <Select value={b.tu_o} onChange={(e) => patch(i, { tu_o: e.target.value, cot_nhan: '', cot_gia_tri: '' })}>
                        <option value="">— chọn khối —</option>
                        {dsBlocks.map((x) => <option key={x.oKey} value={x.oKey}>{`Ô ${x.oKey} · ${x.ten}`}</option>)}
                      </Select>
                    </Field>
                    <Field label="Giới hạn dòng">
                      <Input type="number" min="1" max="50" value={b.gioi_han} onChange={(e) => patch(i, { gioi_han: e.target.value })} />
                    </Field>
                    <Field label="Cột nhãn (trục X)">
                      <Select value={b.cot_nhan} onChange={(e) => patch(i, { cot_nhan: e.target.value })} disabled={!blk}>
                        <option value="">— chọn cột —</option>
                        {(blk?.cot || []).map((c) => <option key={c.key} value={c.key}>{c.ten}</option>)}
                      </Select>
                    </Field>
                    <Field label="Cột giá trị (số)">
                      <Select value={b.cot_gia_tri} onChange={(e) => patch(i, { cot_gia_tri: e.target.value })} disabled={!blk}>
                        <option value="">— chọn cột —</option>
                        {(blk?.cot || []).filter((c) => c.kieu === 'so').map((c) => <option key={c.key} value={c.key}>{c.ten}</option>)}
                      </Select>
                    </Field>
                  </>
                ) : (
                  <div className="col-span-2 lg:col-span-2">
                    <Field label="Chỉ số (chọn nhiều — mỗi chỉ số là 1 cột)">
                      <select multiple size={5} value={b.metrics || []}
                        onChange={(e) => patch(i, { metrics: [...e.target.selectedOptions].map((o) => o.value) })}
                        className="w-full rounded-input border border-line bg-surface p-2 text-sm focus:border-primary focus:outline-none">
                        {soMetric.map((m) => <option key={m.ma} value={m.ma}>{m.ten}</option>)}
                      </select>
                    </Field>
                  </div>
                )}
                <Field label="Chiều cao (px)">
                  <Input type="number" min="140" max="600" value={b.cao} onChange={(e) => patch(i, { cao: e.target.value })} />
                </Field>
              </div>
            </div>
          );
        })}

        <div className="flex justify-between border-t border-line pt-3">
          <Button variant="secondary" icon="plus" onClick={() => setList((l) => [...l, moi()])}>Thêm biểu đồ</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Hủy</Button>
            <Button onClick={() => { onSave(list); onClose(); }}>Lưu biểu đồ</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
