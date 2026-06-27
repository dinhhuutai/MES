import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import Toast from '../../../components/common/Toast';
import { Field, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  getReadyDetail, saveReadyDraft, confirmReadyTech, confirmReadyQC,
} from '../../../services/readyService';

const emptyForm = { khuon: '', film: '', muc: '', hskt: false };

export default function ReadyPanel({ phanInId, onClose, onChanged }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canTech = can('READY_TECH');
  const canQC = can('READY_QC');

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const byMa = (detail?.checkpoints || []).reduce((acc, c) => ({ ...acc, [c.ma_checkpoint]: c }), {});
  const state = detail?.state || {};
  const locked = !!state.kt_done; // sau khi xác nhận kỹ thuật thì khóa nhập

  const load = useCallback(async () => {
    if (!phanInId) return;
    setLoading(true);
    try {
      const res = await getReadyDetail(phanInId);
      setDetail(res.data);
      const m = res.data.checkpoints.reduce((acc, c) => ({ ...acc, [c.ma_checkpoint]: c }), {});
      setForm({
        khuon: m.KHUON?.gia_tri_text || '',
        film: m.FILM?.gia_tri_text || '',
        muc: m.MUC?.gia_tri_text || '',
        hskt: m.HSKT?.trang_thai === 'DAT',
      });
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [phanInId, show]);

  useEffect(() => { load(); }, [load]);

  const doSaveDraft = async () => {
    setBusy(true);
    try {
      await saveReadyDraft(phanInId, form);
      show('Đã lưu tạm');
      await load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doConfirmTech = async () => {
    setBusy(true);
    try {
      await saveReadyDraft(phanInId, form); // lưu trước khi xác nhận
      await confirmReadyTech(phanInId);
      show('Đã xác nhận kỹ thuật — chờ QC');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doConfirmQC = async () => {
    setBusy(true);
    try {
      await confirmReadyQC(phanInId);
      show('QC xác nhận — READY hoàn thành 🎉');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const StatusLine = ({ label, done, waiting }) => (
    <div className="flex items-center justify-between rounded-control border border-line px-3 py-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      {done ? <Badge tone="success">Đã xác nhận</Badge>
        : waiting ? <Badge tone="warning">Chờ xác nhận</Badge>
        : <Badge tone="default">Chưa tới</Badge>}
    </div>
  );

  return (
    <SidePanel
      open={!!phanInId}
      onClose={onClose}
      title={detail?.phan_in ? `READY — ${detail.phan_in.ma_phan}` : 'Chuẩn bị kỹ thuật'}
      subtitle={detail?.phan_in ? `${detail.phan_in.ten_khach_hang} · ${detail.phan_in.mau_vai}` : ''}
      footer={
        !state.qc_done && (
          <>
            {!locked && canTech && (
              <Button variant="ghost" onClick={doSaveDraft} loading={busy}>Lưu tạm</Button>
            )}
            {!locked && canTech && (
              <Button onClick={doConfirmTech} loading={busy}
                disabled={!form.khuon || !form.film || !form.muc || !form.hskt}>
                Xác nhận kỹ thuật
              </Button>
            )}
            {locked && canQC && (
              <Button onClick={doConfirmQC} loading={busy}>QC xác nhận</Button>
            )}
          </>
        )
      }
    >
      {loading || !detail ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : state.qc_done ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-card bg-emerald-50 text-emerald-600">
            <Icon name="shield-check" size={30} />
          </div>
          <div className="text-lg font-semibold text-ink">READY hoàn thành</div>
          <div className="text-sm text-ink-soft">Phần in đã sẵn sàng để Release 1.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {locked && (
            <div className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Đã xác nhận kỹ thuật — dữ liệu đã khóa, chờ QC xác nhận.
            </div>
          )}

          <Field label="Khuôn" required>
            <Select value={form.khuon} disabled={locked} onChange={(e) => setForm({ ...form, khuon: e.target.value })}>
              <option value="">— Chọn —</option>
              {(byMa.KHUON?.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Film" required>
            <Select value={form.film} disabled={locked} onChange={(e) => setForm({ ...form, film: e.target.value })}>
              <option value="">— Chọn —</option>
              {(byMa.FILM?.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Mực" required>
            <Select value={form.muc} disabled={locked} onChange={(e) => setForm({ ...form, muc: e.target.value })}>
              <option value="">— Chọn —</option>
              {(byMa.MUC?.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Hồ sơ kỹ thuật (HSKT)" required>
            <button type="button" disabled={locked}
              onClick={() => setForm({ ...form, hskt: !form.hskt })}
              className={`flex w-full items-center gap-2 rounded-input border px-3.5 py-2.5 text-sm transition disabled:opacity-60 ${
                form.hskt ? 'border-primary bg-primary-wash text-primary' : 'border-line text-ink-soft'
              }`}>
              <Icon name={form.hskt ? 'shield-check' : 'circle'} size={18} />
              {form.hskt ? 'Đã có HSKT' : 'Xác nhận đã có HSKT'}
            </button>
          </Field>

          <div className="space-y-2 border-t border-line pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Tiến trình xác nhận</h3>
            <StatusLine label="Kỹ thuật xác nhận" done={state.kt_done} waiting={!state.kt_done} />
            <StatusLine label="QC xác nhận" done={state.qc_done} waiting={state.kt_done && !state.qc_done} />
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </SidePanel>
  );
}
