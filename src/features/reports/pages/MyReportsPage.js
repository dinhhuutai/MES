import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import SidePanel from '../../../components/common/SidePanel';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import { Field, Input, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import ReportGrid from '../components/ReportGrid';
import ReportChart, { chartData } from '../components/ReportChart';
import exportReportExcel from '../utils/exportReportExcel';
import { listMyReports, createReport, deleteReport, renderReport } from '../../../services/baoCaoService';
import { fmtDate, fmtDateTime } from '../../../utils/format';

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
  const [viewing, setViewing] = useState(null);   // { ten, content } — xem nhanh khỏi cần vào trình thiết kế
  const [busyId, setBusyId] = useState(null);     // id báo cáo đang render (Xem trước / Excel)

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

  // Xem nhanh: render realtime rồi mở SidePanel — không phải vào trình thiết kế.
  const doPreview = async (r) => {
    setBusyId(r.id);
    try {
      const res = await renderReport(r.id, {});
      setViewing({ ten: r.ten_bao_cao, content: res.data });
    } catch (e) { show(e.message || 'Xem trước lỗi', 'error'); }
    finally { setBusyId(null); }
  };

  const doExcel = async (r) => {
    setBusyId(r.id);
    try {
      const res = await renderReport(r.id, {});
      await exportReportExcel(res.data, `${r.ma_bao_cao || 'bao-cao'}-${r.ten_bao_cao}`.slice(0, 80));
    } catch (e) { show(e.message || 'Tải Excel thất bại', 'error'); }
    finally { setBusyId(null); }
  };

  const columns = [
    { key: 'ma_bao_cao', header: 'Mã', render: (r) => <Badge tone="info">{r.ma_bao_cao}</Badge> },
    { key: 'ten_bao_cao', header: 'Tên báo cáo', className: 'font-medium text-ink' },
    { key: 'mo_ta', header: 'Mô tả', render: (r) => r.mo_ta || '—' },
    { key: 'updated_date', header: 'Cập nhật', render: (r) => fmtDate(r.updated_date || r.created_date) },
    { key: 'actions', header: '', className: 'text-right', render: (r) => (
      <div className="flex justify-end gap-1.5">
        {/* Xem nhanh + Excel: đứng TRƯỚC Mở/Xóa — số liệu lấy realtime, khỏi vào trình thiết kế. */}
        <Button variant="secondary" icon="eye" className="px-3 py-1.5" disabled={busyId === r.id}
          onClick={(e) => { e.stopPropagation(); doPreview(r); }}>Xem trước</Button>
        <Button variant="ghost" icon="download" className="px-3 py-1.5" disabled={busyId === r.id}
          onClick={(e) => { e.stopPropagation(); doExcel(r); }}>Excel</Button>
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

      {/* Xem trước — số liệu realtime, giống chế độ Xem của trình thiết kế (kèm khối danh sách + biểu đồ). */}
      <SidePanel open={!!viewing} onClose={() => setViewing(null)}
        title={viewing ? `Xem trước — ${viewing.ten}` : ''}
        subtitle={viewing ? `${viewing.content?.ma_bao_cao || ''} · tính lúc ${fmtDateTime(viewing.content?.tinh_luc)}` : ''}
        width="max-w-5xl">
        {viewing && (
          <>
            <ReportGrid mode="view"
              grid={{ so_cot: viewing.content.so_cot, so_hang: viewing.content.so_hang, o: viewing.content.o,
                merges: viewing.content.merges || [], dinh_dang: viewing.content.dinh_dang || {},
                cot_w: viewing.content.cot_w || {}, hang_h: viewing.content.hang_h || {},
                dong_bang: viewing.content.dong_bang || null }}
              ketQua={viewing.content.ket_qua} danhSach={viewing.content.danh_sach || {}} />

            {(viewing.content.bieu_do || []).length > 0 && (
              <div className="mt-4 space-y-4">
                {viewing.content.bieu_do.map((b) => (
                  <div key={b.id} className="card p-3">
                    <h3 className="mb-1 text-sm font-semibold text-ink">{b.ten}</h3>
                    <ReportChart cfg={b} cao={Number(b.cao) || 260}
                      data={chartData(b, {
                        danhSach: viewing.content.danh_sach || {},
                        metricValues: viewing.content.metric_values || {},
                        metricsByMa: {},
                      })} />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="ghost" icon="download"
                onClick={() => exportReportExcel(viewing.content, viewing.content.ma_bao_cao)}>Xuất Excel</Button>
              <Button icon="pencil" onClick={() => navigate(`/bao-cao/thiet-ke/${viewing.content.id}`)}>Mở để sửa</Button>
            </div>
          </>
        )}
      </SidePanel>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={doDelete}
        title="Xóa báo cáo" message={confirm ? `Xóa báo cáo "${confirm.ten_bao_cao}"?` : ''}
        confirmText="Xóa" variant="danger" />

      <Toast toast={toast} />
    </div>
  );
}
