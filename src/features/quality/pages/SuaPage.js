import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import OwnerHint from '../../../components/common/OwnerHint';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import HistoryPanel from '../../../components/common/HistoryPanel';
import DonePanel from '../../../components/common/DonePanel';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import useNow from '../../../hooks/useNow';
import { evalSla, slaRowClass } from '../../../utils/sla';
import usePermissions from '../../../hooks/usePermissions';
import { listSuaCandidates, recordSua, suaHistory, suaDone } from '../../../services/qualityService';
import { fmtNum } from '../../../utils/format';

const empty = { soLuongHuyThang: '', soLuongSua: '', soLuongSuaDat: '', soLuongSuaHuy: '' };

export default function SuaPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const now = useNow(1000);
  const canSua = can('SUA');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSuaCandidates({ search });
      setRows(res.data);
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

  const save = async () => {
    setSaving(true);
    try {
      const r = await recordSua(editing.tem_id, form);
      const map = { CHO_OQC: 'chuyển OQC', LOAI: 'loại bỏ' };
      show(`Sửa ${editing.ma_tem} → ${map[r.data.next] || r.data.next}`);
      setEditing(null);
      load();
    } catch (e) {
      show(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'ma_tem', header: 'Tem', render: (r) => <Badge tone="info">{r.ma_tem}</Badge> },
    { key: 'ten_khach_hang', header: 'Khách hàng', className: 'font-medium text-ink', render: (r) => r.ten_khach_hang || '—' },
    { key: 'ma_don_hang', header: 'Đơn hàng', render: (r) => r.ma_don_hang || '—' },
    { key: 'ma_hang', header: 'Mã hàng', render: (r) => r.ma_hang || '—' },
    { key: 'mau_vai', header: 'Màu vải', render: (r) => r.mau_vai || '—' },
    { key: 'kich_vai', header: 'Kích vải', render: (r) => r.kich_vai || '—' },
    { key: 'kich_phim', header: 'Kích phim', render: (r) => r.kich_phim || '—' },
    { key: 'so_luong', header: 'SL cần sửa', className: 'text-right tabular-nums font-semibold',
      render: (r) => <span className="text-amber-600">{fmtNum(r.so_luong)}</span> },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canSua && <Button className="px-3 py-1.5" onClick={() => { setEditing(r); setForm({ ...empty, soLuongSua: String(r.so_luong || '') }); }}>Sửa</Button> },
  ];

  const N = (f, label) => (
    <Field label={label}>
      <Input type="number" min="0" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
    </Field>
  );

  return (
    <div>
      <Toolbar title="Sửa hàng lỗi" subtitle="Xử lý tem lỗi từ KCS / OQC"
        search={search} onSearch={setSearch} searchPlaceholder="Quét/nhập mã tem...">
        <Button variant="ghost" icon="check-circle" onClick={() => setDoneOpen(true)}>Đã hoàn thành</Button>
        <Button variant="ghost" icon="history" onClick={() => setHistOpen(true)}>Lịch sử</Button>
        <Badge tone="warning">{rows.length} tem chờ sửa</Badge>
      </Toolbar>

      <OwnerHint tram="SUA" className="mb-3" />

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="tem_id"
        rowClassName={(r) => slaRowClass(evalSla(r.tg_vao, r.sla_phut, r.canh_bao_truoc_phut, now).status)}
        emptyText="Không có tem nào chờ sửa" />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Sửa — ${editing?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving}>Xác nhận sửa</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {editing?.ma_lenh_san_xuat} · {editing?.phan_list} · <b className="text-amber-600">SL cần sửa {fmtNum(editing?.so_luong)}</b> (kế thừa từ KCS)
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          {N('soLuongHuyThang', 'Hủy thẳng')}
          {N('soLuongSua', 'Số lượng sửa')}
          {N('soLuongSuaDat', 'Sửa đạt')}
          {N('soLuongSuaHuy', 'Sửa hủy')}
        </div>
        <p className="text-xs text-ink-soft">Sửa đạt &gt; 0 → <b>sinh tem mới</b> chuyển <b>OQC</b>; phần còn lại loại bỏ.</p>
      </Modal>

      <HistoryPanel open={histOpen} onClose={() => setHistOpen(false)}
        title="Lịch sử Sửa" fetcher={suaHistory} />
      <DonePanel open={doneOpen} onClose={() => setDoneOpen(false)}
        title="Tem đã sửa" maHeader="Tem" fetcher={suaDone} />

      <Toast toast={toast} />
    </div>
  );
}
