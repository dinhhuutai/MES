import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Toast from '../../../components/common/Toast';
import { Field, Input } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listKcsCandidates, recordKcs } from '../../../services/qualityService';
import { fmtNum } from '../../../utils/format';

const empty = { soLuongDat: '', soLuongThieu: '', soLuongDu: '', soLuongMau: '', soLuongHu: '', soLuongSua: '' };

export default function KcsPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canKcs = can('KCS');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listKcsCandidates({ search });
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

  const open = (row) => { setEditing(row); setForm({ ...empty, soLuongDat: String(row.so_luong || '') }); };

  const save = async () => {
    setSaving(true);
    try {
      const r = await recordKcs(editing.tem_id, form);
      const map = { CHO_SUA: 'chuyển Sửa', CHO_OQC: 'chuyển OQC', LOAI: 'loại bỏ' };
      show(`KCS ${editing.ma_tem} → ${map[r.data.next] || r.data.next}`);
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
    { key: 'ma_lenh_san_xuat', header: 'Lệnh SX' },
    { key: 'phan_list', header: 'Phần in' },
    { key: 'so_luong', header: 'SL tem', className: 'text-right tabular-nums', render: (r) => fmtNum(r.so_luong) },
    { key: 'actions', header: '', className: 'text-right', render: (r) =>
      canKcs && <Button className="px-3 py-1.5" onClick={() => open(r)}>Kiểm KCS</Button> },
  ];

  const N = (k) => (
    <Field label={k.label} key={k.f}>
      <Input type="number" min="0" value={form[k.f]} onChange={(e) => setForm({ ...form, [k.f]: e.target.value })} />
    </Field>
  );

  return (
    <div>
      <Toolbar title="KCS — Kiểm tra chất lượng" subtitle="Kiểm theo tem (tem đã khô)"
        search={search} onSearch={setSearch} searchPlaceholder="Quét/nhập mã tem...">
        <Badge tone="warning">{rows.length} tem chờ kiểm</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="tem_id"
        emptyText="Không có tem nào chờ KCS" />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`KCS — ${editing?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving}>Xác nhận KCS</Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {editing?.ma_lenh_san_xuat} · {editing?.phan_list} · SL tem {fmtNum(editing?.so_luong)}
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          {N({ f: 'soLuongDat', label: 'Số lượng đạt' })}
          {N({ f: 'soLuongHu', label: 'Số lượng hư' })}
          {N({ f: 'soLuongThieu', label: 'Số lượng thiếu' })}
          {N({ f: 'soLuongDu', label: 'Số lượng dư' })}
          {N({ f: 'soLuongMau', label: 'Số lượng mẫu' })}
          {N({ f: 'soLuongSua', label: 'Quyết định sửa (≤ hư)' })}
        </div>
        <p className="text-xs text-ink-soft">
          Hư &gt; 0 và quyết định sửa &gt; 0 → tem chuyển <b>Sửa</b>; còn lại → <b>OQC</b>.
        </p>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
