import { useEffect, useState, useCallback } from 'react';
import Toolbar from '../../../components/common/Toolbar';
import DataTable from '../../../components/common/DataTable';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import SidePanel from '../../../components/common/SidePanel';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Toast from '../../../components/common/Toast';
import SearchableSelect from '../../../components/common/SearchableSelect';
import { Field, Textarea } from '../../../components/common/controls';
import useToast from '../../../hooks/useToast';
import usePermissions from '../../../hooks/usePermissions';
import ReportGrid from '../components/ReportGrid';
import ReportChart, { chartData } from '../components/ReportChart';
import exportReportExcel from '../utils/exportReportExcel';
import {
  listPhongBanApDung, listAllReports, deXuatApDung, duyetApDung, tuChoiApDung,
  getPhongBanHienHanh, huyApDungPhongBan,
} from '../../../services/baoCaoService';
import { fmtDate } from '../../../utils/format';

export default function ReportByDeptPage() {
  const { can } = usePermissions();
  const { toast, show } = useToast();
  const canAssign = can('BAOCAO_ASSIGN');
  const canApprove = can('BAOCAO_APPROVE');

  const [data, setData] = useState({ phong_ban: [], cho_duyet: [] });
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [propose, setPropose] = useState(null); // { phongBanId, ten, baoCaoId, ghiChu }
  const [reject, setReject] = useState(null); // { id, lyDo }
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null); // { ten, content }
  const [huy, setHuy] = useState(null); // phòng ban đang gỡ báo cáo
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPhongBanApDung();
      setData(res.data);
      if (canAssign) {
        try { setAllReports((await listAllReports()).data); } catch { /* thiếu quyền tat-ca */ }
      }
    } catch (e) { show(e.message || 'Lỗi tải', 'error'); }
    finally { setLoading(false); }
  }, [show, canAssign]);

  useEffect(() => { load(); }, [load]);

  const doPropose = async () => {
    setSaving(true);
    try {
      await deXuatApDung(propose.phongBanId, { baoCaoId: propose.baoCaoId, ghiChu: propose.ghiChu });
      show('Đã gửi đề xuất, chờ duyệt');
      setPropose(null); load();
    } catch (e) { show(e.message || 'Đề xuất thất bại', 'error'); }
    finally { setSaving(false); }
  };

  const doDuyet = async (id) => {
    try { await duyetApDung(id); show('Đã duyệt áp dụng'); load(); }
    catch (e) { show(e.message || 'Duyệt thất bại', 'error'); }
  };

  const doTuChoi = async () => {
    try { await tuChoiApDung(reject.id, reject.lyDo); show('Đã từ chối'); setReject(null); load(); }
    catch (e) { show(e.message || 'Từ chối thất bại', 'error'); }
  };

  const doView = async (row) => {
    try {
      const res = await getPhongBanHienHanh(row.phong_ban_id);
      if (!res.data) { show('Phòng ban chưa có báo cáo áp dụng', 'error'); return; }
      setViewing({ ten: row.ten_phong_ban, content: res.data });
    } catch (e) { show(e.message || 'Lỗi xem', 'error'); }
  };

  const doExcel = async (row) => {
    setExporting(true);
    try {
      const res = await getPhongBanHienHanh(row.phong_ban_id);
      if (!res.data) { show('Phòng ban chưa có báo cáo áp dụng', 'error'); return; }
      await exportReportExcel(res.data, `${row.ten_phong_ban}-${res.data.ma_bao_cao || 'bao-cao'}`);
    } catch (e) { show(e.message || 'Tải Excel thất bại', 'error'); }
    finally { setExporting(false); }
  };

  const doHuy = async () => {
    try {
      await huyApDungPhongBan(huy.phong_ban_id);
      show(`Đã gỡ báo cáo khỏi ${huy.ten_phong_ban}`);
      setHuy(null); load();
    } catch (e) { show(e.message || 'Gỡ thất bại', 'error'); }
  };

  const columns = [
    { key: 'ten_phong_ban', header: 'Phòng ban', className: 'font-medium text-ink' },
    { key: 'bao_cao', header: 'Báo cáo áp dụng', render: (r) => r.hh_bao_cao_id
      ? <div><div className="text-ink">{r.hh_ten}</div><div className="text-xs text-ink-soft">{r.hh_ma}</div></div>
      : <span className="text-ink-soft">— Chưa áp dụng —</span> },
    { key: 'hh_nguoi_duyet', header: 'Người duyệt', render: (r) => r.hh_nguoi_duyet || '—' },
    { key: 'hh_ngay', header: 'Ngày duyệt', render: (r) => r.hh_ngay ? fmtDate(r.hh_ngay) : '—' },
    { key: 'actions', header: '', className: 'text-right', render: (r) => (
      <div className="flex justify-end gap-1.5">
        {r.hh_bao_cao_id && <Button variant="ghost" className="px-3 py-1.5" onClick={(e) => { e.stopPropagation(); doView(r); }}>Xem</Button>}
        {r.hh_bao_cao_id && <Button variant="ghost" icon="download" className="px-3 py-1.5" disabled={exporting} onClick={(e) => { e.stopPropagation(); doExcel(r); }}>Excel</Button>}
        {r.hh_bao_cao_id && canApprove && <Button variant="ghost" className="px-3 py-1.5 !text-danger" onClick={(e) => { e.stopPropagation(); setHuy(r); }}>Hủy</Button>}
        {canAssign && <Button className="px-3 py-1.5" onClick={(e) => { e.stopPropagation(); setPropose({ phongBanId: r.phong_ban_id, ten: r.ten_phong_ban, baoCaoId: '', ghiChu: '' }); }}>Đề xuất</Button>}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar title="Báo cáo phòng ban" subtitle="Mỗi phòng ban áp dụng 1 báo cáo — đề xuất & duyệt" />

      {/* Chờ duyệt */}
      {data.cho_duyet?.length > 0 && (
        <div className="mb-4 card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Đề xuất chờ duyệt ({data.cho_duyet.length})</h3>
          <div className="space-y-2">
            {data.cho_duyet.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">{d.ten_phong_ban} ← {d.ten_bao_cao} <span className="font-mono text-xs text-ink-soft">({d.ma_bao_cao})</span></div>
                  <div className="text-xs text-ink-soft">Đề xuất bởi {d.nguoi_de_xuat || '—'}{d.ghi_chu ? ` · ${d.ghi_chu}` : ''}</div>
                </div>
                {canApprove ? (
                  <div className="flex gap-1.5">
                    <Button className="px-3 py-1.5" onClick={() => doDuyet(d.id)}>Duyệt</Button>
                    <Button variant="danger" className="px-3 py-1.5" onClick={() => setReject({ id: d.id, lyDo: '' })}>Từ chối</Button>
                  </div>
                ) : <Badge tone="warning">Chờ duyệt</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable columns={columns} rows={data.phong_ban} rowKey="phong_ban_id" loading={loading}
        emptyText="Chưa có phòng ban" />

      {/* Đề xuất áp dụng */}
      <Modal open={!!propose} onClose={() => setPropose(null)} title={`Đề xuất báo cáo cho ${propose?.ten || ''}`}
        footer={<>
          <Button variant="ghost" onClick={() => setPropose(null)}>Hủy</Button>
          <Button onClick={doPropose} loading={saving} disabled={!propose?.baoCaoId}>Gửi đề xuất</Button>
        </>}>
        <Field label="Chọn báo cáo áp dụng" required hint="Có thể chọn báo cáo của bất kỳ người dùng">
          <SearchableSelect
            value={propose?.baoCaoId || ''}
            onChange={(v) => setPropose((p) => ({ ...p, baoCaoId: v }))}
            options={allReports}
            getValue={(o) => o.id}
            getLabel={(o) => `${o.ten_bao_cao} (${o.ma_bao_cao}) — ${o.nguoi_tao || ''}`}
            placeholder="Tìm báo cáo..."
          />
        </Field>
        <Field label="Ghi chú">
          <Textarea rows={2} value={propose?.ghiChu || ''} onChange={(e) => setPropose((p) => ({ ...p, ghiChu: e.target.value }))} />
        </Field>
      </Modal>

      {/* Từ chối */}
      <Modal open={!!reject} onClose={() => setReject(null)} title="Từ chối đề xuất" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setReject(null)}>Hủy</Button>
          <Button variant="danger" onClick={doTuChoi}>Từ chối</Button>
        </>}>
        <Field label="Lý do từ chối">
          <Textarea rows={2} value={reject?.lyDo || ''} onChange={(e) => setReject((r) => ({ ...r, lyDo: e.target.value }))} />
        </Field>
      </Modal>

      {/* Xem báo cáo áp dụng */}
      <SidePanel open={!!viewing} onClose={() => setViewing(null)}
        title={viewing ? `Báo cáo — ${viewing.ten}` : ''}
        subtitle={viewing?.content?.ten_bao_cao} width="max-w-4xl">
        {viewing && (
          <>
            <ReportGrid
              grid={{ so_cot: viewing.content.so_cot, so_hang: viewing.content.so_hang, o: viewing.content.o,
                merges: viewing.content.merges || [], dinh_dang: viewing.content.dinh_dang || {},
                cot_w: viewing.content.cot_w || {}, hang_h: viewing.content.hang_h || {},
                dong_bang: viewing.content.dong_bang || null }}
              ketQua={viewing.content.ket_qua} danhSach={viewing.content.danh_sach || {}} mode="view" />

            {/* Biểu đồ của báo cáo — dưới lưới, giống trình thiết kế. */}
            {(viewing.content.bieu_do || []).length > 0 && (
              <div className="mt-4 space-y-4">
                {viewing.content.bieu_do.map((b) => (
                  <div key={b.id} className="card p-3">
                    <h3 className="mb-1 text-sm font-semibold text-ink">{b.ten}</h3>
                    <ReportChart cfg={b} cao={Number(b.cao) || 260}
                      data={chartData(b, {
                        danhSach: viewing.content.danh_sach || {},
                        metricValues: viewing.content.metric_values || {},
                        metricsByMa: Object.fromEntries(
                          Object.entries(viewing.content.metric_names || {}).map(([ma, ten]) => [ma, { ten }])),
                      })} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </SidePanel>

      <ConfirmDialog open={!!huy} onClose={() => setHuy(null)} onConfirm={doHuy}
        title="Gỡ báo cáo khỏi phòng ban"
        message={huy ? `Gỡ báo cáo "${huy.hh_ten || ''}" khỏi phòng ban ${huy.ten_phong_ban}? Phòng ban sẽ không còn báo cáo áp dụng.` : ''}
        confirmText="Gỡ báo cáo" />

      <Toast toast={toast} />
    </div>
  );
}
