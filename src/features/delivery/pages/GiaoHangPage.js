import { useEffect, useState, useCallback, useMemo } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Toast from '../../../components/common/Toast';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import {
  listTemSanSang, createGiaoHang, listGiaoHang,
} from '../../../services/deliveryService';
import { fmtNum, fmtDate } from '../../../utils/format';
import GiaoHangPanel from '../components/GiaoHangPanel';

export default function GiaoHangPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const canManage = can('DELIVERY_MANAGE');

  const [tab, setTab] = useState('tao');
  const [tems, setTems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [sel, setSel] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, h] = await Promise.all([listTemSanSang({}), listGiaoHang({})]);
      setTems(t.data);
      setHistory(h.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const toggle = (row) =>
    setSelected((s) => {
      const n = { ...s };
      if (n[row.tem_id]) delete n[row.tem_id]; else n[row.tem_id] = row;
      return n;
    });

  const doCreate = async () => {
    setCreating(true);
    try {
      const r = await createGiaoHang({ temIds: selectedList.map((t) => t.tem_id) });
      show(`Đã tạo phiếu giao ${r.data.ma_phieu_giao}`);
      setSelected({});
      setSel(r.data.id);
      setTab('lichsu');
      load();
    } catch (e) {
      show(e.message || 'Tạo phiếu thất bại', 'error');
    } finally {
      setCreating(false);
    }
  };

  const temCols = [
    { key: 'sel', header: '', className: 'w-10', selection: true, render: (r) => (
      <input type="checkbox" checked={!!selected[r.tem_id]} onChange={() => toggle(r)}
        className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />
    ) },
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone="info">{r.ma_tem}</Badge> },
    { key: 'khach_list', header: 'Khách hàng', className: 'font-medium text-ink' },
    { key: 'don_list', header: 'Đơn hàng' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'so_luong', header: 'SL pcs', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
  ];

  const histCols = [
    { key: 'ma_phieu_giao', header: 'Mã phiếu', render: (r) => <Badge tone="info">{r.ma_phieu_giao}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink' },
    { key: 'ma_don_hang', header: 'Đơn hàng' },
    { key: 'so_tem', header: 'Số tem', className: 'text-right' },
    { key: 'tong_sl', header: 'Tổng SL', className: 'text-right tabular-nums', render: (r) => fmtNum(r.tong_sl) },
    { key: 'ngay_giao', header: 'Ngày giao', render: (r) => fmtDate(r.ngay_giao) },
    { key: 'trang_thai', header: 'Trạng thái', render: (r) =>
      r.trang_thai === 'DA_GIAO' ? <Badge tone="success">Đã giao</Badge> : <Badge tone="warning">Chờ giao</Badge> },
  ];

  return (
    <div>
      <Toolbar title="Giao hàng" subtitle="Gom tem OQC đạt thành phiếu giao → DONE DELIVERY" />

      <div className="mb-4 flex gap-1 rounded-control bg-surface-muted p-1">
        {[['tao', `Tạo phiếu (${tems.length})`], ['lichsu', `Lịch sử (${history.length})`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-[10px] px-4 py-2 text-sm font-semibold transition ${
              tab === k ? 'bg-surface text-primary shadow-card' : 'text-ink-soft'
            }`}>{label}</button>
        ))}
      </div>

      {tab === 'tao' ? (
        <>
          <DataTable columns={temCols} rows={tems} loading={loading} rowKey="tem_id" sttStart={0}
            rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
            emptyText="Không có tem OQC đạt nào chờ giao" />
          {selectedList.length > 0 && (
            <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-card border border-line bg-surface px-5 py-3 shadow-card-hover">
              <span className="text-sm text-ink">Đã chọn <b>{selectedList.length}</b> tem · Tổng <b>{fmtNum(selectedList.reduce((s, t) => s + (Number(t.so_luong) || 0), 0))}</b></span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setSelected({})}>Bỏ chọn</Button>
                {canManage && <Button onClick={doCreate} loading={creating}>Tạo phiếu giao</Button>}
              </div>
            </div>
          )}
        </>
      ) : (
        <DataTable columns={histCols} rows={history} loading={loading} onRowClick={(r) => setSel(r.id)}
          emptyText="Chưa có phiếu giao nào" />
      )}

      {sel && <GiaoHangPanel giaoHangId={sel} onClose={() => setSel(null)} onChanged={load} />}
      <Toast toast={toast} />
    </div>
  );
}
