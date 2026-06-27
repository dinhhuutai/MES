import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import { Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  getLenhDetail, recordTestRun, confirmCNSP, confirmQA,
} from '../../../services/planningService';
import { fmtNum, fmtDate } from '../../../utils/format';

export default function TestRunPanel({ lenhId, onClose, onChanged }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canCNSP = can('TESTRUN_CNSP');
  const canQA = can('TESTRUN_QA');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [soLuong, setSoLuong] = useState('');

  const state = data?.state || {};

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLenhDetail(lenhId);
      setData(res.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [lenhId, show]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      show(okMsg);
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const addTestRun = () =>
    run(async () => { await recordTestRun(lenhId, { soLuong: Number(soLuong) || null, ketQua: 'OK' }); setSoLuong(''); }, 'Đã ghi nhận lần test');

  return (
    <SidePanel
      open={!!lenhId}
      onClose={onClose}
      title={data?.lenh ? `Test Run — ${data.lenh.ma_lenh_san_xuat}` : 'Test Run'}
      subtitle={data?.lenh ? `Chuyền ${data.lenh.ma_chuyen || '—'} · SL ${fmtNum(data.lenh.so_luong_release)}` : ''}
      footer={
        <>
          {canCNSP && !state.cnsp_done && (
            <Button onClick={() => run(() => confirmCNSP(lenhId), 'CNSP đã xác nhận')} loading={busy}>
              CNSP xác nhận
            </Button>
          )}
          {canQA && !state.qa_done && (
            <Button onClick={() => run(() => confirmQA(lenhId), 'QA đã xác nhận')} loading={busy}>
              QA xác nhận
            </Button>
          )}
        </>
      }
    >
      {loading || !data ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-2">
            <div className="rounded-control border border-line p-3">
              <div className="text-xs text-ink-soft">CNSP (kỹ thuật)</div>
              {state.cnsp_done ? <Badge tone="success">Đã xác nhận</Badge> : <Badge tone="warning">Chờ</Badge>}
            </div>
            <div className="rounded-control border border-line p-3">
              <div className="text-xs text-ink-soft">QA (chất lượng)</div>
              {state.qa_done ? <Badge tone="success">Đã xác nhận</Badge> : <Badge tone="warning">Chờ</Badge>}
            </div>
          </section>

          {state.cnsp_done && state.qa_done && (
            <div className="rounded-control border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Đã đủ xác nhận test — chờ Kế hoạch duyệt Release 2.
            </div>
          )}

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Đợt vải ({data.dot_vai.length})</h3>
            <div className="space-y-1.5">
              {data.dot_vai.map((dv) => (
                <div key={dv.dot_vai_id} className="flex items-center justify-between rounded-control border border-line px-3 py-2 text-sm">
                  <span><b className="text-ink">{dv.ma_phan}</b> · {dv.mau_vai} · {dv.ma_dot_vai}</span>
                  <span className="text-ink-soft">{fmtNum(dv.so_luong_vai_ve)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Lần test ({data.test_runs.length})</h3>
            {data.test_runs.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {data.test_runs.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-control bg-surface-muted px-3 py-2 text-sm">
                    <span>Lần {t.lan_test} · SL {fmtNum(t.so_luong)} · {t.ket_qua || '—'}</span>
                    <span className="text-xs text-ink-soft">{fmtDate(t.tg_bd_test)}</span>
                  </div>
                ))}
              </div>
            )}
            {(canCNSP || canQA) && !(state.cnsp_done && state.qa_done) && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-ink-soft">Số lượng test</label>
                  <Input type="number" value={soLuong} onChange={(e) => setSoLuong(e.target.value)} placeholder="vd: 50" />
                </div>
                <Button variant="secondary" onClick={addTestRun} loading={busy} disabled={!soLuong}>Ghi nhận</Button>
              </div>
            )}
          </section>
        </div>
      )}
      <Toast toast={toast} />
    </SidePanel>
  );
}
