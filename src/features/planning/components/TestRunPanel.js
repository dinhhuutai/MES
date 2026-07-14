import { useEffect, useState, useCallback } from 'react';
import SidePanel from '../../../components/common/SidePanel';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Toast from '../../../components/common/Toast';
import { Input, Textarea, Field, Select } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { getLenhDetail, recordTestRun, confirmQA, cancelQA, returnTestRunToRelease1 } from '../../../services/planningService';
import { fmtNum } from '../../../utils/format';

const fmt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');
const ketQuaBadge = (kq) =>
  kq === 'CO_LOI' || kq === 'LOI'
    ? <Badge tone="danger">Lỗi</Badge>
    : <Badge tone="success">Đạt</Badge>;

// Panel QA xác nhận Test Run cho 1 lệnh: nhập số lượng test, ghi nhận test lỗi (kèm lý do), xác nhận đạt.
export default function TestRunPanel({ lenhId, onClose, onChanged }) {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canQA = can('TESTRUN_QA');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null); // 'fail' | 'pass' | 'return'
  const [soLuong, setSoLuong] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [nguoiTest, setNguoiTest] = useState('');
  const [loaiTest, setLoaiTest] = useState('TEST_RUN');
  const [ghiChuQA, setGhiChuQA] = useState('');
  const [returnMode, setReturnMode] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const state = data?.state || {};
  const done = state.qa_done;

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

  // Ghi nhận test lỗi → lệnh ở lại Test Run.
  const doFail = async () => {
    if (!lyDo.trim()) { show('Nhập lý do lỗi', 'error'); return; }
    setBusy('fail');
    try {
      await recordTestRun(lenhId, { soLuong: Number(soLuong) || null, ketQua: 'CO_LOI', ghiChu: lyDo.trim() });
      show('Đã ghi nhận test lỗi — lệnh ở lại Test Run');
      setSoLuong(''); setLyDo('');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(null);
    }
  };

  // Xóa mềm (hủy) xác nhận QA để làm lại.
  const doCancel = async () => {
    setBusy('cancel');
    try {
      await cancelQA(lenhId);
      show('Đã hủy xác nhận QA');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Hủy thất bại', 'error');
    } finally {
      setBusy(null);
    }
  };

  // Xác nhận đạt → QA xác nhận đạt = tính 1 LẦN TEST (đạt), kèm số lượng nếu nhập → qua checkpoint tiếp theo.
  const doPass = async () => {
    if (!nguoiTest.trim()) { show('Bắt buộc nhập người test khi xác nhận đạt', 'error'); return; }
    setBusy('pass');
    try {
      await confirmQA(lenhId, {
        soLuong: soLuong ? Number(soLuong) : null,
        nguoiTest: nguoiTest.trim() || null,
        loaiTest,
        ghiChu: ghiChuQA.trim() || null,
      });
      show('QA xác nhận đạt — chuyển bước tiếp theo');
      setSoLuong(''); setLyDo(''); setNguoiTest(''); setGhiChuQA(''); setLoaiTest('TEST_RUN');
      await load();
      onChanged?.();
    } catch (e) {
      show(e.message || 'Thất bại', 'error');
    } finally {
      setBusy(null);
    }
  };

  // Trả về Release 1 → hủy lệnh, đợt vải về pool Release 1 (kèm lý do bắt buộc).
  const doReturn = async () => {
    if (!returnReason.trim()) { show('Nhập lý do trả về Release 1', 'error'); return; }
    setBusy('return');
    try {
      await returnTestRunToRelease1(lenhId, { lyDo: returnReason.trim() });
      show('Đã trả về Release 1 — đợt vải quay lại danh sách chờ release');
      onChanged?.();
      onClose?.();
    } catch (e) {
      show(e.message || 'Trả về thất bại', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SidePanel
      open={!!lenhId}
      onClose={onClose}
      title={data?.lenh ? `Test Run QA — ${data.lenh.ma_lenh_san_xuat}` : 'Test Run QA'}
      subtitle={data?.lenh ? `Chuyền ${data.lenh.ma_chuyen || '—'} · SL ${fmtNum(data.lenh.so_luong_release)}` : ''}
      footer={canQA ? (
        done ? (
          <Button variant="danger" onClick={doCancel} loading={busy === 'cancel'}>Hủy xác nhận QA</Button>
        ) : (
          <>
            <Button variant="danger" onClick={doFail} loading={busy === 'fail'} disabled={busy === 'pass'}>
              Xác nhận test lỗi
            </Button>
            <Button onClick={doPass} loading={busy === 'pass'} disabled={busy === 'fail' || !nguoiTest.trim()}>
              QA xác nhận đạt
            </Button>
          </>
        )
      ) : null}
    >
      {loading || !data ? (
        <div className="py-10 text-center text-ink-soft">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-2">
            <div className="rounded-control border border-line p-3">
              <div className="text-xs text-ink-soft">CNSP (kỹ thuật)</div>
              {state.cnsp_done ? <Badge tone="success">Đã xác nhận</Badge> : <Badge tone="warning">Chờ</Badge>}
              {state.cnsp_done && (state.cnsp_nguoi || state.cnsp_tg) && (
                <div className="mt-1 text-xs text-ink-soft">
                  {state.cnsp_nguoi ? <div className="font-medium text-ink">{state.cnsp_nguoi}</div> : null}
                  {state.cnsp_tg ? <div>{fmt(state.cnsp_tg)}</div> : null}
                </div>
              )}
            </div>
            <div className="rounded-control border border-line p-3">
              <div className="text-xs text-ink-soft">QA (chất lượng)</div>
              {state.qa_done ? <Badge tone="success">Đã xác nhận</Badge> : <Badge tone="warning">Chờ</Badge>}
              {state.qa_done && (state.qa_nguoi || state.qa_tg) && (
                <div className="mt-1 text-xs text-ink-soft">
                  {state.qa_nguoi ? <div className="font-medium text-ink">{state.qa_nguoi}</div> : null}
                  {state.qa_tg ? <div>{fmt(state.qa_tg)}</div> : null}
                </div>
              )}
            </div>
          </section>

          {done && (
            <div className="rounded-control border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              QA đã xác nhận đạt{state.cnsp_done ? ' — đủ điều kiện chờ Kế hoạch duyệt Release 2.' : ' — còn chờ CNSP (kỹ thuật) xác nhận.'}
            </div>
          )}

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Đợt vải / phần in ({data.dot_vai.length})</h3>
            <div className="space-y-1.5">
              {data.dot_vai.map((dv) => (
                <div key={dv.dot_vai_id} className="flex items-center justify-between rounded-control border border-line px-3 py-2 text-sm">
                  <span><b className="text-ink">{dv.ma_phan}</b> · {dv.mau_vai} · {dv.ma_dot_vai}</span>
                  <span className="text-ink-soft">{fmtNum(dv.so_luong_vai_ve)}</span>
                </div>
              ))}
            </div>
          </section>

          {canQA && !done && (
            <section className="border-t border-line pt-4">
              {!returnMode ? (
                <button type="button" onClick={() => setReturnMode(true)}
                  className="text-xs font-medium text-danger hover:underline">↩ Trả về Release 1 (test không đạt)</button>
              ) : (
                <div className="rounded-control border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/40">
                  <p className="mb-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                    Trả về Release 1 sẽ <b>hủy lệnh</b> — đợt vải quay lại danh sách chờ release để lập lại. Lý do bắt buộc.
                  </p>
                  <Field label="Lý do trả về Release 1" required>
                    <Textarea rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Vì sao trả về Release 1..." />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" className="px-3 py-1.5" onClick={() => { setReturnMode(false); setReturnReason(''); }}>Hủy</Button>
                    <Button variant="danger" className="px-3 py-1.5" onClick={doReturn} loading={busy === 'return'} disabled={!returnReason.trim()}>
                      Trả về Release 1
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Lịch sử test ({data.test_runs.length})</h3>
            {data.test_runs.length === 0 ? (
              <p className="text-sm text-ink-soft">Chưa có lần test nào.</p>
            ) : (
              <div className="space-y-1.5">
                {data.test_runs.map((t) => (
                  <div key={t.id} className="rounded-control bg-surface-muted px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Lần {t.lan_test} · SL {fmtNum(t.so_luong)}</span>
                      <div className="flex items-center gap-2">
                        {ketQuaBadge(t.ket_qua)}
                        <span className="text-xs text-ink-soft">{fmt(t.tg_bd_test)}</span>
                      </div>
                    </div>
                    {t.ghi_chu ? <div className="mt-1 text-xs text-danger">Lý do: {t.ghi_chu}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {canQA && !done && (
            <section className="space-y-3 border-t border-line pt-4">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Số lượng test">
                  <Input type="number" value={soLuong} onChange={(e) => setSoLuong(e.target.value)} placeholder="vd: 50" />
                </Field>
                <Field label="Loại">
                  <Select value={loaiTest} onChange={(e) => setLoaiTest(e.target.value)}>
                    <option value="TEST_RUN">Test Run</option>
                    <option value="DAP_PHAN">Đập phấn</option>
                  </Select>
                </Field>
              </div>
              <Field label="Người test" required>
                <Input value={nguoiTest} onChange={(e) => setNguoiTest(e.target.value)} placeholder="Tên người thực hiện test (= CNSP kỹ thuật)"
                  className={!nguoiTest.trim() ? 'border-danger' : ''} />
              </Field>
              <Field label="Ghi chú">
                <Textarea rows={2} value={ghiChuQA} onChange={(e) => setGhiChuQA(e.target.value)} placeholder="Ghi chú khi QA xác nhận đạt (tùy chọn)" />
              </Field>
              <Field label="Lý do lỗi (nếu test lỗi)">
                <Textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)}
                  placeholder="Bắt buộc khi xác nhận test lỗi" />
              </Field>
            </section>
          )}
        </div>
      )}
      <Toast toast={toast} />
    </SidePanel>
  );
}
