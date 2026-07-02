import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import { Field, Select, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNow, { fmtRemain } from '../../../hooks/useNow';
import {
  getXePhoi, listTemChoPhoi, addTemToXe, adjustPhoi,
} from '../../../services/productionService';
import { fmtNum } from '../../../utils/format';

const NEAR_MS = 5 * 60 * 1000; // ngưỡng "sắp xong" — nhấp nháy cảnh báo

export default function XePhoiPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow();
  const canXe = can('XEPHOI');

  const [xe, setXe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [temChoPhoi, setTemChoPhoi] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ temId: '', xeId: '', soLuongPhoi: '', phut: '60' });
  const [saving, setSaving] = useState(false);
  const [adjust, setAdjust] = useState(null); // { tem_xe_id, ma_tem } đang chỉnh giờ
  const [adjustMin, setAdjustMin] = useState('60');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getXePhoi();
      setXe(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const openAdd = async (xeId) => {
    try {
      const res = await listTemChoPhoi({});
      setTemChoPhoi(res.data);
      const first = res.data[0];
      setForm({ temId: first?.tem_id || '', xeId: xeId || '', soLuongPhoi: String(first?.so_luong || ''), phut: '60' });
      setModalOpen(true);
    } catch (e) {
      show(e.message || 'Lỗi', 'error');
    }
  };

  const doAdd = async () => {
    setSaving(true);
    try {
      await addTemToXe({
        temId: form.temId, xeId: form.xeId,
        soLuongPhoi: form.soLuongPhoi ? Number(form.soLuongPhoi) : null,
        phut: form.phut ? Number(form.phut) : 0,
      });
      show('Đã đưa tem vào xe phơi');
      setModalOpen(false);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openAdjust = (t) => { setAdjust(t); setAdjustMin('60'); };
  const doAdjust = async () => {
    setSaving(true);
    try {
      await adjustPhoi(adjust.tem_xe_id, Number(adjustMin) || 0);
      show(`Đã chỉnh thời gian phơi tem ${adjust.ma_tem}`);
      setAdjust(null);
      load();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Toolbar title="Tình trạng xe phơi" subtitle="Đưa tem vào xe, đếm ngược thời gian phơi (tự làm mới 15s)">
        {canXe && <Button icon="truck" onClick={() => openAdd('')}>Đưa tem vào xe</Button>}
      </Toolbar>

      {loading ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {xe.map((x) => (
            <div key={x.id} className="card flex flex-col p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="truck" size={18} className="text-primary" />
                  <span className="font-bold text-ink">{x.ma_xe_phoi}</span>
                </div>
                <Badge tone={x.tems.length ? 'info' : 'default'}>{x.tems.length} tem</Badge>
              </div>

              <div className="flex-1 space-y-2">
                {x.tems.length === 0 && <div className="py-6 text-center text-xs text-ink-soft">Trống</div>}
                {x.tems.map((t) => {
                  const ms = new Date(t.tg_kt_phoi).getTime() - now;
                  const done = ms <= 0;
                  const soon = !done && ms <= NEAR_MS; // sắp xong → nhấp nháy cảnh báo
                  return (
                    <div key={t.tem_xe_id}
                      className={`rounded-control border-2 px-3 py-2 text-sm transition ${
                        done ? 'animate-blink-danger border-rose-400'
                          : soon ? 'animate-blink-warning border-amber-400'
                          : 'border-line'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">{t.ma_tem}</span>
                        <span className={`font-mono text-xs font-bold ${
                          done ? 'text-rose-800' : soon ? 'text-amber-800' : 'text-ink-soft'
                        }`}>
                          {fmtRemain(ms)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-soft">
                        {[t.ten_khach_hang, t.ma_don_hang, t.ma_hang].filter(Boolean).join(' · ')}
                      </div>
                      <div className="text-xs text-ink-soft">
                        {[t.mau_vai, t.kich_vai && `${t.kich_vai}/${t.kich_phim || ''}`].filter(Boolean).join(' · ')}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ink">SL {fmtNum(t.so_luong_phoi)} pcs</span>
                        {canXe && (
                          <button onClick={() => openAdjust(t)}
                            className="text-xs font-medium text-primary hover:underline">Chỉnh giờ</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {canXe && (
                <button onClick={() => openAdd(x.id)}
                  className="mt-3 rounded-control border border-dashed border-line py-2 text-xs font-medium text-ink-soft hover:bg-surface-muted">
                  + Thêm tem
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Đưa tem vào xe phơi"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button onClick={doAdd} loading={saving} disabled={!form.temId || !form.xeId}>Xác nhận</Button>
          </>
        }
      >
        {temChoPhoi.length === 0 ? (
          <p className="text-sm text-ink-soft">Không có tem nào chờ phơi (tem trạng thái "Chờ phơi").</p>
        ) : (
          <>
            <Field label="Tem" required>
              <Select value={form.temId} onChange={(e) => {
                const t = temChoPhoi.find((x) => x.tem_id === e.target.value);
                setForm({ ...form, temId: e.target.value, soLuongPhoi: String(t?.so_luong || '') });
              }}>
                {temChoPhoi.map((t) => (
                  <option key={t.tem_id} value={t.tem_id}>{t.ma_tem} · {t.ma_lenh_san_xuat} · SL {t.so_luong}</option>
                ))}
              </Select>
            </Field>
            <Field label="Xe phơi" required>
              <Select value={form.xeId} onChange={(e) => setForm({ ...form, xeId: e.target.value })}>
                <option value="">— Chọn xe —</option>
                {xe.map((x) => <option key={x.id} value={x.id}>{x.ma_xe_phoi} — {x.ten_xe_phoi}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-x-4">
              <Field label="Số lượng phơi">
                <Input type="number" value={form.soLuongPhoi} onChange={(e) => setForm({ ...form, soLuongPhoi: e.target.value })} />
              </Field>
              <Field label="Thời gian phơi (phút)">
                <Input type="number" value={form.phut} onChange={(e) => setForm({ ...form, phut: e.target.value })} />
              </Field>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!adjust}
        onClose={() => setAdjust(null)}
        title={adjust ? `Chỉnh giờ phơi — ${adjust.ma_tem}` : 'Chỉnh giờ phơi'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjust(null)}>Hủy</Button>
            <Button onClick={doAdjust} loading={saving}>Cập nhật</Button>
          </>
        }
      >
        <Field label="Thời gian phơi còn lại (phút, tính từ bây giờ)" required>
          <Input type="number" value={adjustMin} onChange={(e) => setAdjustMin(e.target.value)} placeholder="vd: 60" />
        </Field>
        <p className="text-xs text-ink-soft">Đếm ngược sẽ được đặt lại = bây giờ + số phút nhập.</p>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
