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
import { listOqcCandidates, recordOqc } from '../../../services/qualityService';
import { fmtNum } from '../../../utils/format';

export default function OqcPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canOqc = can('OQC');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ soLuongKiem: '', soLuongDat: '', soLuongLoi: '', ketQua: 'DAT' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOqcCandidates({ search });
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

  const open = (row) => {
    setEditing(row);
    setForm({ soLuongKiem: String(row.so_luong || ''), soLuongDat: String(row.so_luong || ''), soLuongLoi: '', ketQua: 'DAT' });
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await recordOqc(editing.tem_id, form);
      const map = { OQC_DAT: 'OQC đạt ✓', CHO_SUA: 'không đạt → chuyển Sửa' };
      show(`OQC ${editing.ma_tem}: ${map[r.data.next] || r.data.next}`);
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
      canOqc && <Button className="px-3 py-1.5" onClick={() => open(r)}>Kiểm OQC</Button> },
  ];

  return (
    <div>
      <Toolbar title="OQC — Kiểm cuối" subtitle="Kiểm cuối theo tem trước giao hàng"
        search={search} onSearch={setSearch} searchPlaceholder="Quét/nhập mã tem...">
        <Badge tone="warning">{rows.length} tem chờ OQC</Badge>
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey="tem_id"
        emptyText="Không có tem nào chờ OQC" />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`OQC — ${editing?.ma_tem || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={save} loading={saving} variant={form.ketQua === 'DAT' ? 'primary' : 'danger'}>
              {form.ketQua === 'DAT' ? 'Xác nhận đạt' : 'Xác nhận không đạt'}
            </Button>
          </>
        }
      >
        <div className="mb-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-soft">
          {editing?.ma_lenh_san_xuat} · {editing?.phan_list} · SL tem {fmtNum(editing?.so_luong)}
        </div>
        <div className="grid grid-cols-3 gap-x-4">
          <Field label="SL kiểm">
            <Input type="number" min="0" value={form.soLuongKiem} onChange={(e) => setForm({ ...form, soLuongKiem: e.target.value })} />
          </Field>
          <Field label="SL đạt">
            <Input type="number" min="0" value={form.soLuongDat} onChange={(e) => setForm({ ...form, soLuongDat: e.target.value })} />
          </Field>
          <Field label="SL lỗi">
            <Input type="number" min="0" value={form.soLuongLoi} onChange={(e) => setForm({ ...form, soLuongLoi: e.target.value })} />
          </Field>
        </div>
        <Field label="Kết quả">
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...form, ketQua: 'DAT' })}
              className={`flex-1 rounded-control border px-4 py-2.5 text-sm font-semibold transition ${
                form.ketQua === 'DAT' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-line text-ink-soft'
              }`}>Đạt</button>
            <button type="button" onClick={() => setForm({ ...form, ketQua: 'KHONG_DAT' })}
              className={`flex-1 rounded-control border px-4 py-2.5 text-sm font-semibold transition ${
                form.ketQua === 'KHONG_DAT' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-line text-ink-soft'
              }`}>Không đạt</button>
          </div>
        </Field>
        <p className="text-xs text-ink-soft">Đạt → sẵn sàng giao hàng; Không đạt → chuyển lại Sửa.</p>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
