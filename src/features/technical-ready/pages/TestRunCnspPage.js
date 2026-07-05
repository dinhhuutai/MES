import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import SidePanel from '../../../components/common/SidePanel';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import {
  listTestRunCandidates, getLenhDetail, confirmCNSP, cancelCNSP, confirmCNSPBatch, testRunHistory, testCnspDone,
} from '../../../services/planningService';
import { fmtNum } from '../../../utils/format';

const fmt = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');
const ketQuaBadge = (kq) =>
  kq === 'CO_LOI' || kq === 'LOI'
    ? <Badge tone="danger">Lỗi</Badge>
    : <Badge tone="success">Đạt</Badge>;

export default function TestRunCnspPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canCNSP = can('TESTRUN_CNSP');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [batching, setBatching] = useState(false);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTestRunCandidates({ search, limit: 50 });
      setRows(res.data.items);
      setSelected(new Set());
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const open = async (row) => {
    setDetail({ lenh: { id: row.id, ma_lenh_san_xuat: row.ma_lenh_san_xuat, cnsp_done: row.cnsp_done }, _row: row });
    setDetailLoading(true);
    try {
      const res = await getLenhDetail(row.id);
      setDetail({ ...res.data, _row: row });
    } catch (e) {
      show(e.message || 'Lỗi tải chi tiết', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const doConfirm = async () => {
    setSaving(true);
    try {
      await confirmCNSP(detail._row.id);
      show('CNSP đã xác nhận');
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Xóa mềm (hủy) xác nhận CNSP để làm lại.
  const doCancel = async () => {
    setSaving(true);
    try {
      await cancelCNSP(detail._row.id);
      show('Đã hủy xác nhận CNSP');
      setDetail(null);
      load();
    } catch (e) {
      show(e.message || 'Hủy thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Chỉ chọn được lệnh chưa CNSP.
  const selectable = (r) => !r.cnsp_done;
  const toggleOne = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selRows = rows.filter(selectable);
  const allChecked = selRows.length > 0 && selRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allChecked ? new Set() : new Set(selRows.map((r) => r.id))));

  const doBatch = async () => {
    setBatching(true);
    try {
      const res = await confirmCNSPBatch([...selected]);
      const { okCount, failedCount } = res.data;
      show(failedCount ? `CNSP xác nhận ${okCount} lệnh, ${failedCount} lỗi` : `Đã CNSP xác nhận ${okCount} lệnh`,
        failedCount ? 'error' : 'success');
      load();
    } catch (e) {
      show(e.message || 'Xác nhận thất bại', 'error');
    } finally {
      setBatching(false);
    }
  };

  const state = detail?.state || {};

  const columns = [
    { key: 'sel', className: 'w-10', selection: true,
      header: canCNSP ? <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" /> : '',
      render: (r) => canCNSP && selectable(r) && (
        <input type="checkbox" checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)} aria-label="Chọn lệnh" />
      ) },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => (
      <div>{r.ma_hang || '—'}{r.so_dot_vai > 1 && <div className="mt-0.5"><Badge tone="warning">Gom set ({r.so_dot_vai} đợt)</Badge></div>}</div>
    ) },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'chuyen', header: 'Chuyền', render: (r) => r.ten_chuyen || '—' },
    { key: 'so_lan_test', header: 'Lần test', className: 'text-right tabular-nums', render: (r) => r.so_lan_test },
    { key: 'cnsp_done', header: 'CNSP', render: (r) => r.cnsp_done ? <Badge tone="success">✓</Badge> : <Badge tone="warning">Chờ</Badge> },
  ];

  return (
    <div>
      <Toolbar title="Test Run - CNSP" subtitle="Kỹ thuật (CNSP) xác nhận test cho lệnh sản xuất"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm mã lệnh, code phần, mã hàng, màu/kích...">
        {canCNSP && selected.size > 0 && (
          <Button loading={batching} onClick={doBatch}>CNSP xác nhận ({selected.size})</Button>
        )}
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="info">{rows.length} lệnh</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={open} sttStart={0}
        emptyText="Không có lệnh nào đang Test Run" />

      <SidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Test Run CNSP — ${detail.lenh?.ma_lenh_san_xuat || ''}` : 'Test Run CNSP'}
        subtitle={detail?._row ? `${detail._row.ten_khach_hang || ''} · ${detail._row.mau_vai || ''}` : ''}
        footer={canCNSP && detail ? (
          state.cnsp_done
            ? <Button variant="danger" onClick={doCancel} loading={saving} disabled={detailLoading}>Hủy xác nhận CNSP</Button>
            : <Button onClick={doConfirm} loading={saving} disabled={detailLoading}>CNSP xác nhận</Button>
        ) : null}
      >
        {detailLoading || !detail?.dot_vai ? (
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

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Đợt vải / phần in ({detail.dot_vai.length})</h3>
              <div className="space-y-1.5">
                {detail.dot_vai.map((dv) => (
                  <div key={dv.dot_vai_id} className="flex items-center justify-between rounded-control border border-line px-3 py-2 text-sm">
                    <span><b className="text-ink">{dv.ma_phan}</b> · {dv.mau_vai} · {dv.ma_dot_vai}</span>
                    <span className="text-ink-soft">{fmtNum(dv.so_luong_vai_ve)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Lịch sử test ({detail.test_runs.length})</h3>
              {detail.test_runs.length === 0 ? (
                <p className="text-sm text-ink-soft">Chưa có lần test nào.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.test_runs.map((t) => (
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
          </div>
        )}
      </SidePanel>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử Test Run" fetcher={testRunHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Lệnh đã CNSP xác nhận" maHeader="Lệnh" fetcher={testCnspDone} />

      <Toast toast={toast} />
    </div>
  );
}
