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
import { Input } from '../../../components/common/controls';
import { fmtNum, fmtDate } from '../../../utils/format';
import GiaoHangPanel from '../components/GiaoHangPanel';
import TemJourneyPanel from '../../../components/common/TemJourneyPanel';
import Icon from '../../../components/common/Icon';
import { getTemHanhTrinh } from '../../../services/qualityService';

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
  const [journey, setJourney] = useState(null); // { temId, maTem } — panel hành trình theo tem
  // Mặc định lọc theo NGÀY IN TEM = hôm nay (giờ máy = giờ VN).
  const [ngay, setNgay] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, h] = await Promise.all([listTemSanSang({ ngay: ngay || undefined }), listGiaoHang({})]);
      setTems(t.data);
      setHistory(h.data);
    } catch (e) {
      show(e.message || 'Lỗi tải', 'error');
    } finally {
      setLoading(false);
    }
  }, [ngay, show]);

  useEffect(() => { load(); }, [load]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);

  // Mỗi tem chọn = { row, qty } — qty = SL giao lần này (mặc định = còn giao). Giao TỪNG PHẦN nhiều lần.
  const toggle = (row) =>
    setSelected((s) => {
      const n = { ...s };
      if (n[row.tem_id]) delete n[row.tem_id]; else n[row.tem_id] = { row, qty: Number(row.con_giao) || 0 };
      return n;
    });
  const setQty = (temId, v) => setSelected((s) => (s[temId] ? { ...s, [temId]: { ...s[temId], qty: v } } : s));

  const doCreate = async () => {
    setCreating(true);
    try {
      const items = selectedList.map((x) => ({ temId: x.row.tem_id, soLuong: Number(x.qty) || null }));
      const r = await createGiaoHang({ items });
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
    { key: 'nguoi_truoc', header: 'Người XN trạm trước', render: (r) => r.nguoi_truoc || '—' },
    { key: 'so_luong', header: 'SL in', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'con_giao', header: 'Còn giao', className: 'text-right tabular-nums font-medium text-primary', render: (r) => fmtNum(r.con_giao) },
    { key: 'giao_qty', header: 'SL giao lần này', className: 'w-32', render: (r) => (
      selected[r.tem_id] ? (
        <Input type="number" min="1" max={r.con_giao} value={selected[r.tem_id].qty}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setQty(r.tem_id, e.target.value)} className="py-1 text-right" />
      ) : <span className="text-ink-soft">—</span>
    ) },
    { key: 'ht', header: '', className: 'text-right', render: (r) => (
      <Button variant="ghost" className="px-3 py-1.5"
        onClick={(e) => { e.stopPropagation(); setJourney({ temId: r.tem_id, maTem: r.ma_tem }); }}>Hành trình</Button>
    ) },
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
          <div className="mb-3 flex items-center gap-1.5 text-xs text-ink-soft">
            <span>Lọc theo ngày in tem</span>
            <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)}
              className="h-9 rounded-input border border-line bg-surface px-2 text-sm" />
            {ngay && <button type="button" onClick={() => setNgay('')} className="text-ink-soft hover:text-danger" aria-label="Xóa lọc ngày"><Icon name="x" size={14} /></button>}
          </div>
          <DataTable columns={temCols} rows={tems} loading={loading} rowKey="tem_id" sttStart={0}
            rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
            emptyText="Không có tem OQC đạt nào chờ giao" />
          {selectedList.length > 0 && (
            <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-card border border-line bg-surface px-5 py-3 shadow-card-hover">
              <span className="text-sm text-ink">Đã chọn <b>{selectedList.length}</b> tem · Tổng giao <b>{fmtNum(selectedList.reduce((s, x) => s + (Number(x.qty) || 0), 0))}</b></span>
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
      {journey && (
        <TemJourneyPanel temId={journey.temId} maTem={journey.maTem}
          fetcher={getTemHanhTrinh} onClose={() => setJourney(null)} />
      )}
      <Toast toast={toast} />
    </div>
  );
}
