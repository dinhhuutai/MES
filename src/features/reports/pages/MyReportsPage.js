import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import { Field, Input, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import { listMyReports, createReport, deleteReport } from '../../../services/baoCaoService';
import { fmtDate } from '../../../utils/format';

export default function MyReportsPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const navigate = useNavigate();
  const canDesign = can('BAOCAO_DESIGN');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(null); // { tenBaoCao, moTa }
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await listMyReports({ search })).data); }
    catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [search, show]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const doCreate = async () => {
    setSaving(true);
    try {
      const res = await createReport({ tenBaoCao: creating.tenBaoCao, moTa: creating.moTa });
      show('Đã tạo báo cáo');
      navigate(`/bao-cao/thiet-ke/${res.data.id}`);
    } catch (e) { show(e.message || 'Tạo thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    try { await deleteReport(confirm.id); show('Đã xóa'); setConfirm(null); load(); }
    catch (e) { show(e.message || 'Xóa thất bại', 'error'); }
  };

  const columns = [
    { key: 'ma_bao_cao', header: 'Mã', render: (r) => <Badge tone="info">{r.ma_bao_cao}</Badge> },
    { key: 'ten_bao_cao', header: 'Tên báo cáo', className: 'font-medium text-ink' },
    { key: 'mo_ta', header: 'Mô tả', render: (r) => r.mo_ta || '—' },
    { key: 'updated_date', header: 'Cập nhật', render: (r) => fmtDate(r.updated_date || r.created_date) },
    { key: 'actions', header: '', className: 'text-right', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <Button className="px-3 py-1.5" onClick={(e) => { e.stopPropagation(); navigate(`/bao-cao/thiet-ke/${r.id}`); }}>Mở</Button>
        {canDesign && (
          <Button variant="danger" className="px-3 py-1.5" onClick={(e) => { e.stopPropagation(); setConfirm(r); }}>Xóa</Button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Báo cáo của tôi" subtitle="Tự thiết kế báo cáo dạng bảng tính từ dữ liệu hệ thống"
        search={search} onSearch={setSearch} searchPlaceholder="Tìm báo cáo...">
        {canDesign && <Button icon="plus" onClick={() => setCreating({ tenBaoCao: '', moTa: '' })}>Tạo báo cáo</Button>}
      </Toolbar>

      <DataTable columns={columns} rows={rows} loading={loading}
        onRowClick={(r) => navigate(`/bao-cao/thiet-ke/${r.id}`)} emptyText="Chưa có báo cáo — bấm Tạo báo cáo" />

      <Modal open={!!creating} onClose={() => setCreating(null)} title="Tạo báo cáo mới"
        footer={<>
          <Button variant="ghost" onClick={() => setCreating(null)}>Hủy</Button>
          <Button onClick={doCreate} loading={saving} disabled={!creating?.tenBaoCao}>Tạo & thiết kế</Button>
        </>}>
        <Field label="Tên báo cáo" required>
          <Input value={creating?.tenBaoCao || ''} onChange={(e) => setCreating({ ...creating, tenBaoCao: e.target.value })} />
        </Field>
        <Field label="Mô tả">
          <Textarea rows={2} value={creating?.moTa || ''} onChange={(e) => setCreating({ ...creating, moTa: e.target.value })} />
        </Field>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={doDelete}
        title="Xóa báo cáo" message={confirm ? `Xóa báo cáo "${confirm.ten_bao_cao}"?` : ''}
        confirmText="Xóa" variant="danger" />

      <Toast toast={toast} />
    </div>
  );
}
